/**
 * ItemManager.js
 * Gestion de l'inventaire et des objets (Potions, Antidotes, Poké Balls, etc.)
 * 
 * Collections MongoDB:
 * - player_inventory: { player_id, item_id, quantity }
 * - items: { item_id, name, name_fr, type, effect, value }
 */

const { ObjectId } = require('mongodb');

class ItemManager {
    constructor(databaseManager) {
        this.databaseManager = databaseManager;
        this.inventoryCollection = null;
        this.itemsCollection = null;
        console.log('[ItemManager] Initialisé');
    }

    /**
     * Initialise les collections et seed items de base
     */
    async initialize() {
        const db = await this.databaseManager.connectToDatabase();
        this.inventoryCollection = db.collection('player_inventory');
        this.itemsCollection = db.collection('items');

        // Créer index uniquement si nécessaire
        try {
            await this.inventoryCollection.createIndex({ player_id: 1, item_id: 1 }, { unique: true });
        } catch (e) {
            // Index existe déjà
        }

        // Seed items Pokémon de base (toujours exécuter pour mise à jour)
        await this.seedBaseItems();

        console.log('[ItemManager] Collections initialisées');
    }

    /**
     * Seed items de base dans la DB (Mise à jour forcée)
     */
    async seedBaseItems() {
        const baseItems = [
            // Soins HP
            { item_id: 'potion', name: 'Potion', name_fr: 'Potion', type: 'healing', effect: 'heal', value: 20, price: 300, usage_context: ['Battle', 'Menu'] },
            { item_id: 'super-potion', name: 'Super Potion', name_fr: 'Super Potion', type: 'healing', effect: 'heal', value: 50, price: 700, usage_context: ['Battle', 'Menu'] },
            { item_id: 'hyper-potion', name: 'Hyper Potion', name_fr: 'Hyper Potion', type: 'healing', effect: 'heal', value: 200, price: 1200, usage_context: ['Battle', 'Menu'] },
            { item_id: 'max-potion', name: 'Max Potion', name_fr: 'Potion Max', type: 'healing', effect: 'heal-full', value: 9999, price: 2500, usage_context: ['Battle', 'Menu'] },
            
            // Soins statuts
            { item_id: 'antidote', name: 'Antidote', name_fr: 'Antidote', type: 'status-heal', effect: 'cure-poison', value: 0, price: 100, usage_context: ['Battle', 'Menu'] },
            { item_id: 'paralyze-heal', name: 'Paralyze Heal', name_fr: 'Anti-Para', type: 'status-heal', effect: 'cure-paralysis', value: 0, price: 200, usage_context: ['Battle', 'Menu'] },
            { item_id: 'awakening', name: 'Awakening', name_fr: 'Réveil', type: 'status-heal', effect: 'cure-sleep', value: 0, price: 250, usage_context: ['Battle', 'Menu'] },
            { item_id: 'burn-heal', name: 'Burn Heal', name_fr: 'Anti-Brûle', type: 'status-heal', effect: 'cure-burn', value: 0, price: 250, usage_context: ['Battle', 'Menu'] },
            { item_id: 'ice-heal', name: 'Ice Heal', name_fr: 'Antigel', type: 'status-heal', effect: 'cure-freeze', value: 0, price: 250, usage_context: ['Battle', 'Menu'] },
            { item_id: 'full-heal', name: 'Full Heal', name_fr: 'Total Soin', type: 'status-heal', effect: 'cure-all', value: 0, price: 600, usage_context: ['Battle', 'Menu'] },

            // Poké Balls
            { item_id: 'poke-ball', name: 'Poké Ball', name_fr: 'Poké Ball', type: 'pokeball', effect: 'capture', value: 1.0, price: 200, usage_context: ['Battle'], image: 'pokeball1.png' },
            { item_id: 'great-ball', name: 'Great Ball', name_fr: 'Super Ball', type: 'pokeball', effect: 'capture', value: 1.5, price: 600, usage_context: ['Battle'], image: 'pokeball2.png' },
            { item_id: 'ultra-ball', name: 'Ultra Ball', name_fr: 'Hyper Ball', type: 'pokeball', effect: 'capture', value: 2.0, price: 1200, usage_context: ['Battle'], image: 'pokeball2.png' },

            // Objets tenus
            { item_id: 'lucky-egg', name: 'Lucky Egg', name_fr: 'Œuf Chance', type: 'held', effect: 'exp-boost', value: 1.5, price: 5000, usage_context: ['Menu'] }
        ];

        const operations = baseItems.map(item => ({
            updateOne: {
                filter: { item_id: item.item_id },
                update: { $set: item },
                upsert: true
            }
        }));

        if (operations.length > 0) {
            await this.itemsCollection.bulkWrite(operations);
            console.log(`✅ ${operations.length} items de base mis à jour/ajoutés`);
        }
    }

    /**
     * Configure les routes Express
     */
    setupRoutes(app) {
        console.log('[ItemManager] Configuration des routes...');

        // 📦 Récupérer l'inventaire d'un joueur
        app.get('/api/inventory/:playerId', async (req, res) => {
            try {
                const { playerId } = req.params;
                const inventory = await this.getPlayerInventory(playerId);
                res.json({ success: true, inventory });
            } catch (error) {
                console.error('Erreur get inventory:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // 🎁 Ajouter un item à l'inventaire
        app.post('/api/inventory/add', async (req, res) => {
            try {
                const { playerId, itemId, quantity = 1 } = req.body;
                
                if (!playerId || !itemId) {
                    return res.status(400).json({ success: false, error: 'playerId et itemId requis' });
                }

                await this.addItem(playerId, itemId, quantity);
                res.json({ success: true, message: `${quantity}x ${itemId} ajouté` });
            } catch (error) {
                console.error('Erreur add item:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // 💊 Utiliser un item (hors combat)
        app.post('/api/inventory/use', async (req, res) => {
            try {
                const { playerId, itemId, targetPokemonId } = req.body;

                if (!playerId || !itemId) {
                    return res.status(400).json({ success: false, error: 'playerId et itemId requis' });
                }

                const result = await this.useItem(playerId, itemId, targetPokemonId);
                res.json({ success: true, ...result });
            } catch (error) {
                console.error('Erreur use item:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // 📋 Liste de tous les items disponibles
        app.get('/api/items', async (req, res) => {
            try {
                const items = await this.itemsCollection.find({}).toArray();
                res.json({ success: true, items });
            } catch (error) {
                console.error('Erreur get items:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });
    }

    /**
     * Récupérer l'inventaire complet d'un joueur
     */
    async getPlayerInventory(playerId) {
        const inventory = await this.inventoryCollection.find({ player_id: playerId }).toArray();
        
        // Enrichir avec données items
        const enriched = [];
        for (const entry of inventory) {
            const item = await this.itemsCollection.findOne({ item_id: entry.item_id });
            if (item) {
                enriched.push({
                    ...entry,
                    itemData: item
                });
            }
        }

        return enriched;
    }

    /**
     * Ajouter un item à l'inventaire
     */
    async addItem(playerId, itemId, quantity = 1) {
        // Vérifier que l'item existe
        const item = await this.itemsCollection.findOne({ item_id: itemId });
        if (!item) {
            throw new Error(`Item ${itemId} introuvable`);
        }

        // Ajouter ou incrémenter
        await this.inventoryCollection.updateOne(
            { player_id: playerId, item_id: itemId },
            { 
                $inc: { quantity: quantity },
                $setOnInsert: { player_id: playerId, item_id: itemId }
            },
            { upsert: true }
        );

        console.log(`[ItemManager] +${quantity}x ${itemId} pour ${playerId}`);
    }

    /**
     * Utiliser un item (hors combat)
     */
    async useItem(playerId, itemId, targetPokemonId) {
        // Vérifier quantité
        const inventoryEntry = await this.inventoryCollection.findOne({ 
            player_id: playerId, 
            item_id: itemId 
        });

        if (!inventoryEntry || inventoryEntry.quantity <= 0) {
            throw new Error('Item non disponible dans l\'inventaire');
        }

        // Récupérer item data
        const item = await this.itemsCollection.findOne({ item_id: itemId });
        if (!item) throw new Error('Item introuvable');

        // Appliquer effet selon type
        const result = await this.applyItemEffect(item, targetPokemonId, playerId);

        // Décrémenter quantité
        await this.inventoryCollection.updateOne(
            { player_id: playerId, item_id: itemId },
            { $inc: { quantity: -1 } }
        );

        // Supprimer si quantité = 0
        await this.inventoryCollection.deleteMany({ 
            player_id: playerId, 
            quantity: { $lte: 0 } 
        });

        return { ...result, itemUsed: item.name_fr };
    }

    /**
     * Appliquer effet d'un item
     */
    async applyItemEffect(item, targetPokemonId, playerId) {
        const db = await this.databaseManager.connectToDatabase();
        const pokemonCollection = db.collection('pokemonPlayer');

        if (!targetPokemonId) {
            throw new Error('targetPokemonId requis pour cet item');
        }

        const pokemon = await pokemonCollection.findOne({ _id: new ObjectId(targetPokemonId) });
        if (!pokemon) throw new Error('Pokémon introuvable');

        const result = { message: '', healed: 0, statusCured: false };

        switch (item.effect) {
            case 'heal':
                // Soigner HP
                const healAmount = Math.min(item.value, pokemon.maxHP - pokemon.currentHP);
                await pokemonCollection.updateOne(
                    { _id: new ObjectId(targetPokemonId) },
                    { $inc: { currentHP: healAmount } }
                );
                result.healed = healAmount;
                result.message = `${pokemon.nickname || pokemon.species_name} récupère ${healAmount} PV !`;
                break;

            case 'heal-full':
                // Soigner complètement
                const fullHeal = pokemon.maxHP - pokemon.currentHP;
                await pokemonCollection.updateOne(
                    { _id: new ObjectId(targetPokemonId) },
                    { $set: { currentHP: pokemon.maxHP } }
                );
                result.healed = fullHeal;
                result.message = `${pokemon.nickname || pokemon.species_name} est en pleine forme !`;
                break;

            case 'cure-poison':
            case 'cure-paralysis':
            case 'cure-sleep':
            case 'cure-burn':
            case 'cure-freeze':
                // Soigner un statut spécifique
                const statusType = item.effect.replace('cure-', '');
                if (pokemon.statusCondition?.type === statusType) {
                    await pokemonCollection.updateOne(
                        { _id: new ObjectId(targetPokemonId) },
                        { $set: { 'statusCondition.type': null, 'statusCondition.turns': 0 } }
                    );
                    result.statusCured = true;
                    result.message = `${pokemon.nickname || pokemon.species_name} est guéri !`;
                } else {
                    result.message = `${pokemon.nickname || pokemon.species_name} n'est pas affecté par ce statut.`;
                }
                break;

            case 'cure-all':
                // Soigner tous les statuts
                await pokemonCollection.updateOne(
                    { _id: new ObjectId(targetPokemonId) },
                    { $set: { 'statusCondition.type': null, 'statusCondition.turns': 0 } }
                );
                result.statusCured = true;
                result.message = `${pokemon.nickname || pokemon.species_name} est complètement guéri !`;
                break;

            default:
                result.message = `Effet ${item.effect} non implémenté`;
        }

        console.log(`[ItemManager] ${item.name} utilisé sur ${pokemon.nickname || pokemon.species_name}`);
        return result;
    }
}

module.exports = ItemManager;
