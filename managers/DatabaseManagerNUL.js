const { MongoClient, ObjectId } = require('mongodb');

class DatabaseManager {
    constructor() {
        this.mongoClient = null;
        this.db = null;
        this.photosCollection = null;
        this.MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://zaldrick:xtHDAM0ZFpq2iL9L@oppede.zfhlzph.mongodb.net/oppede';
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
                const playerList = await players.find({}, { projection: { pseudo: 1 } }).toArray();

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

                console.log(`Player data for ${pseudo} fetched from MongoDB:`, player);
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
                            quantite: 1,
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

            const questions = await questionsCollection.aggregate([
                { $match: filter },
                { $sample: { size: Math.min(count, totalAvailable) } }
            ]).toArray();

            console.log(`[Quiz] ${questions.length} questions récupérées depuis la BDD`);

            if (questions.length < count) {
                console.warn(`[Quiz] Seulement ${questions.length} questions trouvées sur ${count} demandées, ajout de questions d'exemple`);
                const sampleQuestions = this.getSampleQuestions(count - questions.length);
                questions.push(...sampleQuestions);
            }

            return questions;
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