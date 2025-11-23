const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pokemon_game';
const PLAYER_ID = '691f00b806b67d633ea32801'; // ID récupéré des logs

async function giveRareCandy() {
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('Connecté à MongoDB');

        const db = client.db();
        const inventory = db.collection('player_inventory');
        const items = db.collection('items');

        // Vérifier si l'item existe
        const rareCandy = await items.findOne({ item_id: 'rare-candy' });
        if (!rareCandy) {
            console.log('Création de l\'item Rare Candy...');
            await items.insertOne({
                item_id: 'rare-candy',
                name: 'Rare Candy',
                name_fr: 'Super Bonbon',
                type: 'consumable',
                effect: 'level-up',
                value: 1,
                price: 10000,
                usage_context: ['Menu'],
                image: 'rarecandy.png'
            });
        }

        // Ajouter à l'inventaire
        const result = await inventory.updateOne(
            { player_id: PLAYER_ID, item_id: 'rare-candy' },
            { 
                $inc: { quantity: 5 },
                $setOnInsert: { player_id: PLAYER_ID, item_id: 'rare-candy' }
            },
            { upsert: true }
        );

        console.log(`✅ 5 Super Bonbons ajoutés au joueur ${PLAYER_ID}`);

    } catch (error) {
        console.error('Erreur:', error);
    } finally {
        await client.close();
    }
}

giveRareCandy();
