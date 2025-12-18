const { MongoClient, ObjectId } = require('mongodb');
const { calculateMaxHP } = require('../utils/pokemonStats');

class DatabaseManager {
    constructor() {
        this.mongoClient = null;
        this.db = null;
        this.photosCollection = null;
        this.pokemonBaseStatsCache = new Map();
        this.MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://zaldrick:xtHDAM0ZFpq2iL9L@oppede.zfhlzph.mongodb.net/oppede';
    }

    async getPokemonBaseStats(speciesId) {
        const sid = Number(speciesId);
        if (!sid || sid <= 0) return null;

        const cached = this.pokemonBaseStatsCache.get(sid);
        if (cached) return cached;

        try {
            const fetch = (await import('node-fetch')).default;
            const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${sid}`);
            if (!response.ok) return null;
            const data = await response.json();

            const getStat = (key) => Number(data?.stats?.find(s => s?.stat?.name === key)?.base_stat ?? 0);
            const baseStats = {
                hp: getStat('hp'),
                attack: getStat('attack'),
                defense: getStat('defense'),
                sp_attack: getStat('special-attack'),
                sp_defense: getStat('special-defense'),
                speed: getStat('speed')
            };

            if (!baseStats.hp) return null;
            this.pokemonBaseStatsCache.set(sid, baseStats);
            return baseStats;
        } catch (e) {
            return null;
        }
    }

    async connectToDatabase() {
        if (!this.mongoClient) {
            this.mongoClient = new MongoClient(this.MONGO_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            await this.mongoClient.connect();
        }
        this.db = this.mongoClient.db('oppede');
        return this.db;
    }

    async initialize() {
        try {
            const db = await this.connectToDatabase();
            this.photosCollection = db.collection('photos');
            console.log("Connecté à la collection 'photos'");

            // Ensure admin flag exists and promote known admins.
            try {
                const players = db.collection('players');
                await players.updateMany(
                    { isAdmin: { $exists: false } },
                    { $set: { isAdmin: false } }
                );
                await players.updateMany(
                    { pseudo: { $in: ['Admin', 'Mehdi'] } },
                    { $set: { isAdmin: true } }
                );
            } catch (e) {
                console.warn('[DatabaseManager] Failed to ensure isAdmin flags:', e?.message || e);
            }
        } catch (err) {
            console.error("Erreur de connexion à la collection 'photos':", err);
        }
    }

    getDatabase() {
        return this.db;
    }

    setupRoutes(app) {
        // Route pour récupérer les joueurs disponibles
        app.get('/api/players', async (req, res) => {
            try {
                const db = await this.connectToDatabase();
                if (!db) {
                    console.error('Database connection failed');
                    return res.status(500).json({ error: 'Database connection failed', players: [] });
                }
                const players = db.collection('players');
                const playerList = await players.find({}, { projection: { pseudo: 1, isActif: 1 } }).toArray();

                // Log the pseudo values to the console
                playerList.forEach(player => console.log(`Pseudo: ${player.pseudo}`));

                res.json(playerList);
            } catch (error) {
                console.error('Error fetching players:', error);
                res.status(500).json({ error: 'Failed to fetch players', players: [] });
            }
        });

        // Route for apparences
        app.get('/assets/apparences', (req, res) => {
            const fs = require('fs');
            const path = require('path');
            const apparencesDir = path.join(__dirname, '../public', 'assets', 'apparences');
            fs.readdir(apparencesDir, (err, files) => {
                if (err) {
                    console.error('Error reading apparences directory:', err);
                    return res.status(500).json({ error: 'Failed to load apparences' });
                }
                const imageFiles = files.filter(file => /\.(png|jpg|jpeg|gif)$/i.test(file));
                res.json(imageFiles);
            });
        });

        // Route pour récupérer un joueur spécifique
        app.get('/api/players/:pseudo', async (req, res) => {
            try {
                const { pseudo } = req.params;
                const db = await this.connectToDatabase();
                const players = db.collection('players');

                const player = await players.findOne({ pseudo });

                if (!player) {
                    return res.status(404).json({ error: 'Player not found' });
                }

                //console.log(`Player data for ${pseudo} fetched from MongoDB:`, player);
                res.json(player);
            } catch (error) {
                console.error('Error fetching player data:', error);
                res.status(500).json({ error: 'Failed to fetch player data' });
            }
        });

        // Route pour mettre à jour la position d'un joueur
        app.post('/api/players/update-position', async (req, res) => {
            try {
                const { pseudo, posX, posY, mapId } = req.body;

                if (!pseudo || posX === undefined || posY === undefined || mapId === undefined) {
                    console.error("Invalid request body:", req.body);
                    return res.status(400).json({ error: 'Invalid request. Missing pseudo, posX, posY, or mapId.' });
                }

                const db = await this.connectToDatabase();
                const players = db.collection('players');

                const result = await players.updateOne(
                    { pseudo },
                    { $set: { posX, posY, mapId, updatedAt: new Date() } }
                );

                if (result.matchedCount === 0) {
                    console.warn(`Player not found: ${pseudo}`);
                    return res.status(404).json({ error: 'Player not found' });
                }
                res.json({ success: true, message: 'Player position updated successfully.' });
            } catch (error) {
                console.error('Error updating player position:', error);
                res.status(500).json({ error: 'Failed to update player position' });
            }
        });

        // 🆕 Route: mémoriser le dernier endroit où le joueur s'est soigné
        // Utilisé pour le respawn après une défaite.
        app.post('/api/players/update-last-heal', async (req, res) => {
            try {
                const { playerId, pseudo, mapKey, mapId, posX, posY } = req.body;

                if (!playerId && !pseudo) {
                    return res.status(400).json({ error: 'playerId ou pseudo requis' });
                }

                if (posX === undefined || posY === undefined || mapId === undefined) {
                    return res.status(400).json({ error: 'posX, posY et mapId requis' });
                }

                const db = await this.connectToDatabase();
                const players = db.collection('players');

                const query = playerId
                    ? { _id: new ObjectId(playerId) }
                    : { pseudo };

                const lastHeal = {
                    mapKey: mapKey ?? null,
                    mapId: Number(mapId),
                    posX: Number(posX),
                    posY: Number(posY),
                    updatedAt: new Date()
                };

                const result = await players.updateOne(query, { $set: { lastHeal } });
                if (result.matchedCount === 0) {
                    return res.status(404).json({ error: 'Player not found' });
                }

                res.json({ success: true, lastHeal });
            } catch (error) {
                console.error('Error updating lastHeal:', error);
                res.status(500).json({ error: 'Failed to update lastHeal' });
            }
        });

        // 🆕 Route: persister l'ouverture d'un coffre (par joueur)
        app.post('/api/players/opened-chests/add', async (req, res) => {
            try {
                const { playerId, chestId } = req.body;
                if (!playerId || !chestId) {
                    return res.status(400).json({ error: 'playerId et chestId requis' });
                }

                const db = await this.connectToDatabase();
                const players = db.collection('players');

                const result = await players.updateOne(
                    { _id: new ObjectId(playerId) },
                    {
                        $addToSet: { openedChests: String(chestId) },
                        $set: { updatedAt: new Date() }
                    }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({ error: 'Player not found' });
                }

                res.json({ success: true });
            } catch (error) {
                console.error('Error adding opened chest:', error);
                res.status(500).json({ error: 'Failed to persist opened chest' });
            }
        });

        // 🆕 Route: persister un pickup collecté (par joueur)
        // Exemple: Poké Ball qui disparaît définitivement après récupération.
        app.post('/api/players/collected-world-items/add', async (req, res) => {
            try {
                const { playerId, itemId } = req.body;
                if (!playerId || !itemId) {
                    return res.status(400).json({ error: 'playerId et itemId requis' });
                }

                const db = await this.connectToDatabase();
                const players = db.collection('players');

                const result = await players.updateOne(
                    { _id: new ObjectId(playerId) },
                    {
                        $addToSet: { collectedWorldItems: String(itemId) },
                        $set: { updatedAt: new Date() }
                    }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({ error: 'Player not found' });
                }

                res.json({ success: true });
            } catch (error) {
                console.error('Error adding collected world item:', error);
                res.status(500).json({ error: 'Failed to persist collected world item' });
            }
        });

        // Route pour récupérer la position d'un joueur
        app.get('/api/players/position/:pseudo', async (req, res) => {
            try {
                const { pseudo } = req.params;
                const db = await this.connectToDatabase();
                const players = db.collection('players');

                const player = await players.findOne({ pseudo }, { projection: { posX: 1, posY: 1 } });

                if (!player) {
                    return res.status(404).json({ error: 'Player not found' });
                }

                res.json({ x: player.posX, y: player.posY });
            } catch (error) {
                console.error('Error fetching player position:', error);
                res.status(500).json({ error: 'Failed to fetch player position' });
            }
        });

        // Routes d'inventaire
        app.get('/api/inventory/:playerId', async (req, res) => {
            try {
                const { playerId } = req.params;
                const db = await this.connectToDatabase();
                const inventoryCollection = db.collection('inventory');

                const inventory = await inventoryCollection.aggregate([
                    { $match: { player_id: new ObjectId(playerId) } },
                    {
                        $lookup: {
                            from: 'items',
                            localField: 'item_id',
                            foreignField: '_id',
                            as: 'itemDetails',
                        },
                    },
                    { $unwind: '$itemDetails' },
                    {
                        $lookup: {
                            from: 'itemActions',
                            localField: 'item_id',
                            foreignField: 'item_id',
                            as: 'actions',
                        },
                    },
                    {
                        $project: {
                            _id: 1,
                            player_id: 1,
                            item_id: 1,
                            quantite: '$quantité', 
                            nom: '$itemDetails.nom',
                            image: '$itemDetails.image',
                            is_echangeable: '$itemDetails.is_echangeable',
                            prix: '$itemDetails.prix',
                            actions: 1,
                            type: '$itemDetails.type',
                            possibleCards: '$itemDetails.possibleCards',
                            cardCount: '$itemDetails.cardCount',
                            rarityChances: '$itemDetails.rarityChances',
                            description: '$itemDetails.description',
                            usage_context: '$itemDetails.usage_context',
                        },
                    },
                ]).toArray();

                if (!inventory || inventory.length === 0) {
                    return res.status(404).json({ error: 'Inventory not found' });
                }

                const booster = inventory.find(i => i.type === "booster" || i.nom?.toLowerCase().includes("booster"));
                if (booster) {
                    console.log("Booster dans l'inventaire envoyé au front:", booster);
                }

                res.json(inventory);
            } catch (error) {
                console.error('Error fetching inventory:', error);
                res.status(500).json({ error: 'Failed to fetch inventory' });
            }
        });

        // Route pour ajouter un item à l'inventaire via son nom (utile pour quêtes/rewards)
        app.post('/api/inventory/add-by-name', async (req, res) => {
            try {
                const { playerId, itemName, quantity = 1 } = req.body;
                if (!playerId || !itemName) {
                    return res.status(400).json({ error: 'playerId et itemName requis' });
                }

                const qty = Number(quantity) || 1;
                const db = await this.connectToDatabase();
                const { ObjectId } = require('mongodb');
                const itemsCol = db.collection('items');
                const inventoryCol = db.collection('inventory');

                let itemDoc = await itemsCol.findOne({ nom: itemName });

                // Si l'item existe déjà mais a été créé sans image, on le complète.
                if (itemDoc && itemName === 'ticket de métro' && !itemDoc.image) {
                    try {
                        await itemsCol.updateOne(
                            { _id: itemDoc._id },
                            { $set: { image: 'ticket.png', updatedAt: new Date() } }
                        );
                        itemDoc.image = 'ticket.png';
                    } catch (e) {
                        // ignore
                    }
                }

                // Cas spécial: item clé requis par la map "metro".
                // On évite de dépendre d'un seed DB potentiellement destructif.
                if (!itemDoc && itemName === 'ticket de métro') {
                    const docToInsert = {
                        nom: 'ticket de métro',
                        type: 'key_items',
                        image: 'ticket.png',
                        description: "Un ticket de métro.",
                        prix: 0,
                        is_echangeable: false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    const insertRes = await itemsCol.insertOne(docToInsert);
                    itemDoc = { ...docToInsert, _id: insertRes.insertedId };
                }

                // Cas spécial: récompense de coffre (qwest).
                // On évite un 404 si la DB n'a pas été seedée avec l'item.
                if (!itemDoc && itemName === 'Sirius') {
                    const docToInsert = {
                        nom: 'Sirius',
                        type: 'item',
                        image: 'Sirius.png',
                        prix: 999,
                        is_echangeable: false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    const insertRes = await itemsCol.insertOne(docToInsert);
                    itemDoc = { ...docToInsert, _id: insertRes.insertedId };
                }

                if (!itemDoc) {
                    return res.status(404).json({ error: `Item not found: ${itemName}` });
                }

                await inventoryCol.updateOne(
                    { player_id: new ObjectId(playerId), item_id: itemDoc._id },
                    { $inc: { quantité: qty } },
                    { upsert: true }
                );

                res.json({ success: true });
            } catch (error) {
                console.error('Error add-by-name inventory:', error);
                res.status(500).json({ error: 'Failed to add item' });
            }
        });

        // Route pour supprimer un item de l'inventaire
        app.post('/api/inventory/remove-item', async (req, res) => {
            const { playerId, itemId } = req.body;
            console.log("[remove-item] Appel reçu avec:", { playerId, itemId });

            if (!playerId || !itemId) {
                console.warn("[remove-item] playerId ou itemId manquant !");
                return res.status(400).json({ error: "playerId et itemId requis" });
            }
            try {
                const db = await this.connectToDatabase();
                const inventory = db.collection('inventory');
                console.log("[remove-item] Connexion BDD OK");

                const item = await inventory.findOne({
                    player_id: new ObjectId(playerId),
                    item_id: new ObjectId(itemId)
                });
                console.log("[remove-item] Résultat findOne:", item);

                if (!item) {
                    console.warn("[remove-item] Item non trouvé dans l'inventaire !");
                    return res.status(404).json({ error: "Item not found" });
                }

                if (item.quantite > 1) {
                    const updateRes = await inventory.updateOne(
                        { player_id: new ObjectId(playerId), item_id: new ObjectId(itemId) },
                        { $inc: { quantite: -1 } }
                    );
                    console.log(`[remove-item] Décrément quantité, résultat:`, updateRes);
                } else {
                    const deleteRes = await inventory.deleteOne({
                        player_id: new ObjectId(playerId),
                        item_id: new ObjectId(itemId)
                    });
                    console.log(`[remove-item] Suppression item, résultat:`, deleteRes);
                }
                res.json({ success: true });
            } catch (err) {
                console.error("[remove-item] Erreur serveur:", err);
                res.status(500).json({ error: err.message });
            }
        });

        // 💊 Route pour utiliser un item (soins) sur un Pokémon
        app.post('/api/inventory/use', async (req, res) => {
            try {
                const { playerId, itemId, targetPokemonId } = req.body;

                if (!playerId || !itemId || !targetPokemonId) {
                    return res.status(400).json({ error: 'playerId, itemId et targetPokemonId requis' });
                }

                const db = await this.connectToDatabase();
                const inventoryCol = db.collection('inventory');
                const itemsCol = db.collection('items');
                const itemActionsCol = db.collection('itemActions');
                const pokemonCol = db.collection('pokemonPlayer');

                const playerObjectId = new ObjectId(playerId);
                const itemObjectId = new ObjectId(itemId);
                const pokemonObjectId = new ObjectId(targetPokemonId);

                // Vérifier possession de l'item
                const invEntry = await inventoryCol.findOne({
                    player_id: playerObjectId,
                    item_id: itemObjectId
                });

                if (!invEntry) {
                    return res.status(404).json({ error: 'Item non disponible dans l\'inventaire' });
                }

                const quantityField = (invEntry['quantité'] !== undefined)
                    ? 'quantité'
                    : (invEntry.quantite !== undefined)
                        ? 'quantite'
                        : (invEntry.quantity !== undefined)
                            ? 'quantity'
                            : 'quantité';

                const currentQty = Number(invEntry[quantityField] ?? 0);
                if (currentQty <= 0) {
                    return res.status(400).json({ error: 'Item non disponible dans l\'inventaire' });
                }

                // Récupérer action et item
                const [itemDoc, actionDoc] = await Promise.all([
                    itemsCol.findOne({ _id: itemObjectId }),
                    itemActionsCol.findOne({ item_id: itemObjectId })
                ]);

                if (!itemDoc) {
                    return res.status(404).json({ error: 'Item introuvable' });
                }
                if (!actionDoc) {
                    return res.status(400).json({ error: 'Aucune action définie pour cet item' });
                }

                // Récupérer Pokémon cible (et vérifier qu'il appartient au joueur)
                const pokemon = await pokemonCol.findOne({ _id: pokemonObjectId, owner_id: playerObjectId });
                if (!pokemon) {
                    return res.status(404).json({ error: 'Pokémon introuvable' });
                }

                // Appliquer action
                let healed = 0;
                let message = '';

                if (actionDoc.action_type === 'heal') {
                    let maxHP = Number(pokemon.stats?.maxHP ?? pokemon.maxHP ?? 0);
                    if (!maxHP || maxHP <= 0) {
                        // Beaucoup de Pokémon persistés n'ont pas maxHP en DB (seulement currentHP + iv/ev/level)
                        // -> on le calcule ici pour que les potions fonctionnent.
                        const baseStats = await this.getPokemonBaseStats(pokemon.species_id);
                        if (baseStats?.hp) {
                            // ⚠️ Many persisted pokemon don't store `level` (it's derived from XP on fetch).
                            // If we default to 1, maxHP becomes wrong and potions are refused as "PV déjà au maximum".
                            const resolveLevel = (pokemonDoc) => {
                                const xpVal = Number(pokemonDoc?.experience ?? 0);
                                if (Number.isFinite(xpVal) && xpVal > 0) {
                                    for (let lvl = 1; lvl <= 100; lvl++) {
                                        const xpNeeded = Math.floor(1.2 * Math.pow(lvl, 3) - 15 * Math.pow(lvl, 2) + 100 * lvl - 140);
                                        if (xpVal < xpNeeded) return Math.max(1, lvl - 1);
                                    }
                                    return 100;
                                }
                                // Fallback: si l'XP est absente/0, utiliser le niveau persisté (meilleur que 1)
                                const lvl = Number(pokemonDoc?.level ?? 0);
                                if (Number.isFinite(lvl) && lvl > 0) return Math.floor(lvl);
                                return 1;
                            };

                            // Source of truth: XP quand dispo, sinon fallback niveau persisté.
                            const level = resolveLevel(pokemon);
                            const iv = Number(pokemon.ivs?.hp ?? 0);
                            const ev = Number(pokemon.evs?.hp ?? 0);
                            const safeIv = Number.isFinite(iv) ? iv : 0;
                            const safeEv = Number.isFinite(ev) ? ev : 0;
                            try {
                                maxHP = calculateMaxHP(baseStats.hp, level, safeIv, safeEv);
                            } catch (e) {
                                maxHP = 0;
                            }

                            // Persist pour les prochains usages (non bloquant)
                            if (maxHP && maxHP > 0) {
                                pokemonCol.updateOne(
                                    { _id: pokemonObjectId },
                                    { $set: { maxHP: Number(maxHP), updatedAt: new Date() } }
                                ).catch(() => {});
                            }
                        }
                    }
                    const currentHP = Number(pokemon.currentHP ?? 0);
                    const amount = Number(actionDoc.parameters?.amount ?? 0);

                    if (currentHP <= 0) {
                        return res.status(400).json({ error: 'Ce Pokémon est K.O.' });
                    }
                    if (!maxHP || maxHP <= 0) {
                        return res.status(400).json({ error: 'Stats Pokémon invalides' });
                    }
                    if (currentHP >= maxHP) {
                        return res.status(400).json({ error: 'PV déjà au maximum' });
                    }

                    healed = Math.min(amount, maxHP - currentHP);
                    if (healed <= 0) {
                        return res.status(400).json({ error: 'Aucun effet' });
                    }

                    await pokemonCol.updateOne(
                        { _id: pokemonObjectId },
                        { $inc: { currentHP: healed } }
                    );

                    message = `${pokemon.nickname || pokemon.species_name || 'Le Pokémon'} récupère ${healed} PV !`;
                } else if (actionDoc.action_type === 'heal_status') {
                    // Placeholder minimal: on accepte mais sans implémentation complète
                    return res.status(400).json({ error: 'Soins de statut non implémentés pour le moment' });
                } else {
                    return res.status(400).json({ error: `Action non supportée: ${actionDoc.action_type}` });
                }

                // Décrémenter inventaire seulement après succès
                await inventoryCol.updateOne(
                    { player_id: playerObjectId, item_id: itemObjectId },
                    { $inc: { [quantityField]: -1 } }
                );
                await inventoryCol.deleteMany({
                    player_id: playerObjectId,
                    item_id: itemObjectId,
                    [quantityField]: { $lte: 0 }
                });

                // Renvoyer Pokémon mis à jour et quantité restante
                const updatedPokemon = await pokemonCol.findOne({ _id: pokemonObjectId }, { projection: { currentHP: 1, maxHP: 1, stats: 1 } });
                const updatedInv = await inventoryCol.findOne({ player_id: playerObjectId, item_id: itemObjectId });
                const remaining = updatedInv ? Number(updatedInv[quantityField] ?? 0) : 0;

                res.json({
                    success: true,
                    message,
                    healed,
                    pokemon: {
                        _id: targetPokemonId,
                        currentHP: Number(updatedPokemon?.currentHP ?? (pokemon.currentHP + healed)),
                        maxHP: Number(updatedPokemon?.stats?.maxHP ?? updatedPokemon?.maxHP ?? pokemon.stats?.maxHP ?? pokemon.maxHP ?? maxHP ?? 0)
                    },
                    inventory: {
                        itemId,
                        quantity: remaining
                    },
                    item: {
                        name: itemDoc.nom
                    }
                });
            } catch (error) {
                console.error('Error using inventory item:', error);
                res.status(500).json({ error: 'Failed to use item' });
            }
        });

        // Routes pour les événements du monde
        app.get('/api/world-events', async (req, res) => {
            const mapKey = req.query.mapKey;
            if (!mapKey) return res.status(400).json({ error: "mapKey is required" });

            try {
                const db = await this.connectToDatabase();
                const events = await db.collection("worldEvents").find({ mapKey }).toArray();
                res.json(events);
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: "Database error" });
            }
        });

        app.post('/api/world-events/:id/state', async (req, res) => {
            const eventId = req.params.id;
            const newState = req.body;

            if (!eventId) return res.status(400).json({ error: "eventId is required" });

            try {
                const db = await this.connectToDatabase();
                const result = await db.collection("worldEvents").updateOne(
                    { _id: new ObjectId(eventId) },
                    { $set: { state: newState } }
                );
                if (result.modifiedCount === 0) {
                    return res.status(404).json({ error: "Event not found or not updated" });
                }
                res.json({ success: true });
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: "Database error" });
            }
        });

        // Routes pour PNJ dresseurs (progression par joueur)
        app.get('/api/trainer-npcs/defeated', async (req, res) => {
            const { playerId, mapKey } = req.query;
            if (!playerId) return res.status(400).json({ error: 'playerId is required' });

            try {
                const db = await this.connectToDatabase();
                const query = { player_id: new ObjectId(playerId) };
                if (mapKey) query.mapKey = mapKey;

                const docs = await db.collection('trainerNpcDefeats')
                    .find(query)
                    .project({ _id: 0, trainerId: 1 })
                    .toArray();

                res.json({ defeatedTrainerIds: docs.map(d => d.trainerId).filter(Boolean) });
            } catch (err) {
                console.error('[trainer-npcs/defeated] Database error:', err);
                res.status(500).json({ error: 'Database error' });
            }
        });

        // Liste des PNJ dresseurs (définition), filtrée par map
        app.get('/api/trainer-npcs', async (req, res) => {
            const { mapKey } = req.query;
            if (!mapKey) return res.status(400).json({ error: 'mapKey is required' });

            try {
                const db = await this.connectToDatabase();
                const docs = await db
                    .collection('trainerNpcs')
                    .find({ mapKey })
                    .sort({ tileY: 1, tileX: 1 })
                    .toArray();
                res.json(docs);
            } catch (err) {
                console.error('[trainer-npcs] Database error:', err);
                res.status(500).json({ error: 'Database error' });
            }
        });

        // Routes pour les cartes
        app.get('/api/cards', async (req, res) => {
            try {
                const db = await this.connectToDatabase();
                const cards = await db.collection('items').find({ type: "card" }).project({
                    _id: 1,
                    nom: 1,
                    image: 1,
                    rarity: 1,
                    powerUp: 1,
                    powerLeft: 1,
                    powerRight: 1,
                    powerDown: 1,
                    description: 1
                }).toArray();

                if (!cards || cards.length === 0) {
                    return res.status(404).json({ error: 'No cards found.' });
                }

                res.json(cards);
            } catch (e) {
                console.error('Error fetching all cards:', e);
                res.status(500).json({ error: e.message });
            }
        });

        app.get('/api/cards/:playerId', async (req, res) => {
            try {
                const { playerId } = req.params;
                const db = await this.connectToDatabase();

                const cards = await db.collection('inventory').aggregate([
                    { $match: { player_id: new ObjectId(playerId) } },
                    {
                        $lookup: {
                            from: 'items',
                            localField: 'item_id',
                            foreignField: '_id',
                            as: 'item'
                        }
                    },
                    { $unwind: '$item' },
                    { $match: { 'item.type': 'card' } },
                    {
                        $project: {
                            _id: '$item._id',
                            nom: '$item.nom',
                            image: '$item.image',
                            quantity: '$quantite',
                            rarity: '$item.rarity',
                            powerUp: '$item.powerUp',
                            powerLeft: '$item.powerLeft',
                            powerRight: '$item.powerRight',
                            powerDown: '$item.powerDown',
                            description: '$item.description'
                        }
                    }
                ]).toArray();

                if (!cards || cards.length === 0) {
                    return res.status(404).json({ error: 'No cards found for this player.' });
                }

                res.json(cards);
            } catch (e) {
                console.error('Error fetching cards:', e);
                res.status(500).json({ error: e.message });
            }
        });

        app.post('/api/inventory/add-cards', async (req, res) => {
            try {
                const { playerId, cards } = req.body;
                console.log("[add-cards] Reçu:", { playerId, cards: cards && cards.map(c => c._id) });
                if (!playerId || !Array.isArray(cards) || !cards.length) {
                    console.warn("[add-cards] playerId ou cards manquants !");
                    return res.status(400).json({ error: "playerId et cards requis" });
                }
                const db = await this.connectToDatabase();
                const inventory = db.collection('inventory');

                for (const card of cards) {
                    if (!card._id) {
                        console.warn("[add-cards] Carte sans _id:", card);
                        continue;
                    }
                    let playerObjId, cardObjId;
                    try {
                        playerObjId = new ObjectId(playerId);
                        cardObjId = new ObjectId(card._id);
                    } catch (e) {
                        console.error("[add-cards] Mauvais ObjectId:", playerId, card._id, e);
                        continue;
                    }

                    const existing = await inventory.findOne({
                        player_id: playerObjId,
                        item_id: cardObjId
                    });
                    if (existing) {
                        console.log(`[add-cards] Carte déjà présente, incrémentation: ${card._id}`);
                        await inventory.updateOne(
                            { _id: existing._id },
                            { $inc: { quantite: 1 } }
                        );
                    } else {
                        console.log(`[add-cards] Nouvelle carte ajoutée: ${card._id}`);
                        await inventory.insertOne({
                            player_id: playerObjId,
                            item_id: cardObjId,
                            quantite: 1
                        });
                    }
                }
                res.json({ success: true });
            } catch (err) {
                console.error("[add-cards] Erreur ajout cartes:", err);
                res.status(500).json({ error: "Erreur serveur lors de l'ajout des cartes" });
            }
        });

        // === NOUVELLE ROUTE : Cartes aléatoires pour l'IA ===
        app.get('/api/cards/ai/random', async (req, res) => {
            try {
                const count = parseInt(req.query.count) || 5;
                const difficulty = req.query.difficulty || 'medium';
                
                console.log(`[AI Cards] Récupération de ${count} cartes aléatoires pour IA (difficulté: ${difficulty})`);
                
                const db = await this.connectToDatabase();
                const cardsCollection = db.collection('items');
                
                // ✅ CORRIGÉ : Filtre selon la difficulté de l'IA (correspond au ConfigManager)
                let filter = { type: 'card' };
                
                switch (difficulty) {
                    case 'facile':
                        filter.rarity = { $in: [1, 2] }; // ✅ Cartes de rareté 1-2 (correspond à FACILE)
                        break;
                    case 'normal':
                        filter.rarity = { $in: [2, 3] }; // ✅ Cartes de rareté 2-3 (correspond à NORMAL)
                        break;
                    case 'difficile':
                        filter.rarity = { $in: [3, 4] }; // ✅ Cartes de rareté 3-4 (correspond à DIFFICILE)
                        break;
                    default:
                        console.warn(`[AI Cards] Difficulté inconnue: ${difficulty}, utilisation de 'medium' par défaut`);
                        filter.rarity = { $in: [2, 3] }; // ✅ Par défaut = medium
                        break;
                }
                
                const totalCards = await cardsCollection.countDocuments(filter);
                console.log(`[AI Cards] ${totalCards} cartes disponibles pour l'IA`);
                
                if (totalCards < count) {
                    console.warn(`[AI Cards] Pas assez de cartes (${totalCards}), fallback vers constantes`);
                    return res.json({ 
                        success: false, 
                        fallback: true,
                        message: 'Pas assez de cartes en BDD' 
                    });
                }
                
                // Récupère des cartes aléatoires
                const aiCards = await cardsCollection.aggregate([
                    { $match: filter },
                    { $sample: { size: count } }
                ]).toArray();
                
                console.log(`[AI Cards] ${aiCards.length} cartes récupérées pour l'IA`);
                res.json(aiCards);
                
            } catch (err) {
                console.error('[AI Cards] Erreur lors de la récupération des cartes IA:', err);
                res.status(500).json({ 
                    success: false, 
                    fallback: true,
                    error: 'Erreur serveur' 
                });
            }
        });


        // Route pour acheter un booster
        app.post('/api/shop/buy-booster', async (req, res) => {
            const { playerId, boosterId, price } = req.body;

            if (!playerId || !boosterId || !price) {
                return res.status(400).json({ error: "Paramètres manquants" });
            }

            try {
                const db = await databaseManager.connectToDatabase();
                const playersCol = db.collection('players');
                const inventoryCol = db.collection('inventory');
                const itemsCol = db.collection('items');

                // Vérifier que le joueur existe et a assez d'argent
                const player = await playersCol.findOne({ _id: new ObjectId(playerId) });
                if (!player) {
                    return res.status(404).json({ error: "Joueur non trouvé" });
                }

                if (player.totalScore < price) {
                    return res.status(400).json({ error: "Pas assez d'argent" });
                }

                // Vérifier que le booster existe
                const booster = await itemsCol.findOne({
                    _id: new ObjectId(boosterId),
                    type: "booster"
                });
                if (!booster) {
                    return res.status(404).json({ error: "Booster non trouvé" });
                }

                // Débiter l'argent du joueur
                await playersCol.updateOne(
                    { _id: new ObjectId(playerId) },
                    { $inc: { totalScore: -price } }
                );

                // Ajouter le booster à l'inventaire du joueur
                await inventoryCol.updateOne(
                    { player_id: new ObjectId(playerId), item_id: new ObjectId(boosterId) },
                    { $inc: { quantite: 1 } },
                    { upsert: true }
                );

                res.json({
                    success: true,
                    message: "Booster acheté avec succès",
                    newBalance: player.totalScore - price
                });

            } catch (error) {
                console.error('Erreur lors de l\'achat du booster:', error);
                res.status(500).json({ error: "Erreur serveur" });
            }
        });

        // Route pour récupérer les boosters disponibles à la vente
        app.get('/api/items', async (req, res) => {
            const { type } = req.query;

            try {
                const db = await databaseManager.connectToDatabase();
                const itemsCol = db.collection('items');

                let query = {};
                if (type) {
                    query.type = type;
                }

                const items = await itemsCol.find(query).toArray();
                res.json(items);

            } catch (error) {
                console.error('Erreur lors de la récupération des items:', error);
                res.status(500).json({ error: "Erreur serveur" });
            }
        });


        // Route pour échanger les positions de deux Pokémon
        app.post('/api/pokemon/swap-positions', async (req, res) => {
            try {
                const { pokemon1Id, pokemon2Id } = req.body;
                
                if (!pokemon1Id || !pokemon2Id) {
                    return res.status(400).json({ error: 'pokemon1Id et pokemon2Id requis' });
                }
                
                const db = await this.connectToDatabase();
                const pokemonCollection = db.collection('pokemonPlayer');
                
                // Récupérer les deux pokémon
                const pokemon1 = await pokemonCollection.findOne({ _id: new ObjectId(pokemon1Id) });
                const pokemon2 = await pokemonCollection.findOne({ _id: new ObjectId(pokemon2Id) });
                
                if (!pokemon1 || !pokemon2) {
                    return res.status(404).json({ error: 'Pokémon non trouvé' });
                }

                // 🔧 IMPORTANT:
                // Le client (TeamScene) manipule historiquement `position` (1-based).
                // Le combat serveur utilise aussi `teamPosition` (0-based) pour trier/charger.
                // Si on swap seulement `position`, on crée une désynchronisation:
                // - UI affiche un ordre
                // - serveur démarre/switch sur un autre index
                // => bugs "mauvais Pokémon actif" et "déjà actif".
                // Donc on maintient les deux champs en sync.
                const pos1 = Number(pokemon1.position);
                const pos2 = Number(pokemon2.position);
                const safePos1 = Number.isFinite(pos1) ? pos1 : null;
                const safePos2 = Number.isFinite(pos2) ? pos2 : null;
                const tp1 = (safePos2 && safePos2 >= 1) ? (safePos2 - 1) : null;
                const tp2 = (safePos1 && safePos1 >= 1) ? (safePos1 - 1) : null;
                
                // Échanger les positions
                await pokemonCollection.updateOne(
                    { _id: new ObjectId(pokemon1Id) },
                    { $set: { position: safePos2, teamPosition: tp1, updatedAt: new Date() } }
                );
                await pokemonCollection.updateOne(
                    { _id: new ObjectId(pokemon2Id) },
                    { $set: { position: safePos1, teamPosition: tp2, updatedAt: new Date() } }
                );
                
                console.log(`[Pokemon] Positions échangées: ${pokemon1.nickname} (${safePos1}) <-> ${pokemon2.nickname} (${safePos2})`);
                
                res.json({
                    success: true,
                    message: 'Positions échangées'
                });
            } catch (error) {
                console.error('[Pokemon] Erreur swap positions:', error);
                res.status(500).json({ error: 'Erreur serveur' });
            }
        });

        // === ROUTE: Récupérer détails d'un move ===
        app.get('/api/pokemon/move/:moveNameOrId', async (req, res) => {
            try {
                const { moveNameOrId } = req.params;
                console.log('[Move] Recherche détails pour:', moveNameOrId);

                const db = await this.connectToDatabase();
                const movesCollection = db.collection('pokemonMoves');

                // Chercher d'abord en BDD (par nom ou ID)
                let moveData = await movesCollection.findOne({
                    $or: [
                        { name: moveNameOrId },
                        { id: parseInt(moveNameOrId) || -1 }
                    ]
                });

                if (moveData) {
                    console.log('[Move] Trouvé en BDD:', moveData.name);
                    return res.json(moveData);
                }

                // Si pas trouvé, chercher sur PokéAPI
                console.log('[Move] Non trouvé en BDD, requête PokéAPI...');
                const pokeApiUrl = `https://pokeapi.co/api/v2/move/${moveNameOrId.toLowerCase()}`;
                const response = await fetch(pokeApiUrl);

                if (!response.ok) {
                    console.warn('[Move] Move non trouvé sur PokéAPI:', moveNameOrId);
                    return res.status(404).json({ error: 'Move introuvable' });
                }

                const apiData = await response.json();
                
                // Extraire l'effet en français ou anglais
                const effectEntry = apiData.effect_entries.find(e => e.language.name === 'en');
                const flavorEntry = apiData.flavor_text_entries.find(e => e.language.name === 'en');

                // Construire l'objet move normalisé
                moveData = {
                    id: apiData.id,
                    name: apiData.name,
                    type: apiData.type.name,
                    category: apiData.damage_class.name, // physical, special, status
                    power: apiData.power,
                    accuracy: apiData.accuracy,
                    pp: apiData.pp,
                    effect: effectEntry?.effect || flavorEntry?.flavor_text || 'No description available',
                    priority: apiData.priority,
                    target: apiData.target.name,
                    createdAt: new Date()
                };

                // Sauvegarder en BDD pour la prochaine fois
                await movesCollection.insertOne(moveData);
                console.log('[Move] Sauvegardé en BDD:', moveData.name);

                res.json(moveData);

            } catch (error) {
                console.error('[Move] Erreur récupération détails:', error);
                res.status(500).json({ error: 'Erreur serveur' });
            }
        });

        // === FIN NOUVELLE ROUTE ===
    }

    // Fonction pour obtenir des questions par catégorie et difficulté
    async getRandomQuestions(categories, difficulty, count = 10) {
        try {
            const db = await this.connectToDatabase();
            const questionsCollection = db.collection('quizQuestions');

            console.log(`[Quiz] Recherche de ${count} questions - Catégories: ${categories.join(', ')}, Difficulté: ${difficulty}`);

            const filter = {
                category: { $in: categories }
            };

            if (difficulty && difficulty !== 'mixte') {
                filter.difficulty = difficulty;
            }

            const totalAvailable = await questionsCollection.countDocuments(filter);
            console.log(`[Quiz] ${totalAvailable} questions disponibles pour les critères`);

            if (totalAvailable === 0) {
                console.warn(`[Quiz] Aucune question trouvée pour les critères spécifiés`);
                return this.getSampleQuestions(count);
            }

            // Solution 1: Si assez de questions, on récupère tout et on shuffle
            if (totalAvailable >= count) {
                const allQuestions = await questionsCollection.find(filter).toArray();
                
                // Shuffle avec l'algorithme Fisher-Yates pour garantir le hasard
                for (let i = allQuestions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
                }
                
                const questions = allQuestions.slice(0, count);
                console.log(`[Quiz] ${questions.length} questions uniques récupérées depuis la BDD`);
                return questions;
            } 
            // Solution 2: Si pas assez de questions, on prend toutes les disponibles + des questions d'exemple
            else {
                const questions = await questionsCollection.find(filter).toArray();
                console.log(`[Quiz] Seulement ${questions.length} questions trouvées sur ${count} demandées, ajout de questions d'exemple`);
                
                const sampleQuestions = this.getSampleQuestions(count - questions.length);
                return [...questions, ...sampleQuestions];
            }

        } catch (error) {
            console.error('[Quiz] Erreur récupération questions:', error);
            return this.getSampleQuestions(count);
        }
    }

    getSampleQuestions(count) {
        const sampleQuestions = [
            {
                question: "Quelle est la capitale de la France ?",
                answers: ["Paris", "Lyon", "Marseille", "Bordeaux"],
                correct: 0,
                category: "Géographie",
                difficulty: "facile"
            },
            {
                question: "Qui a peint 'La Joconde' ?",
                answers: ["Picasso", "Van Gogh", "Léonard de Vinci", "Monet"],
                correct: 2,
                category: "Art & Littérature",
                difficulty: "facile"
            },
            {
                question: "En quelle année a eu lieu la Révolution française ?",
                answers: ["1789", "1792", "1776", "1804"],
                correct: 0,
                category: "Histoire",
                difficulty: "facile"
            },
            {
                question: "Quel est l'élément chimique avec le symbole 'O' ?",
                answers: ["Or", "Oxygène", "Osmium", "Olivine"],
                correct: 1,
                category: "Science et Nature",
                difficulty: "facile"
            },
            {
                question: "Combien y a-t-il de joueurs dans une équipe de football ?",
                answers: ["10", "11", "12", "9"],
                correct: 1,
                category: "Sport",
                difficulty: "facile"
            }
        ];

        const shuffled = [...sampleQuestions].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(count, shuffled.length));
    }
}

module.exports = DatabaseManager;