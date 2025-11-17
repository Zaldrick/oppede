/**
 * Script pour ajouter des Poké Balls aux joueurs
 * Usage: node scripts/giveStarterItems.js
 */

const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/oppede';

async function giveStarterItems() {
    const client = new MongoClient(MONGO_URI);

    try {
        console.log('🔌 Connexion à MongoDB...');
        await client.connect();
        const db = client.db();

        const playersCollection = db.collection('players');
        const inventoryCollection = db.collection('inventory');

        // Récupérer tous les joueurs
        const players = await playersCollection.find({}).toArray();

        console.log(`📦 Attribution d'items de départ à ${players.length} joueur(s)...`);

        for (const player of players) {
            console.log(`  → Joueur: ${player.pseudo}`);

            // Items de départ
            const starterItems = [
                { item_id: 'poke-ball', quantity: 10 },
                { item_id: 'great-ball', quantity: 5 },
                { item_id: 'potion', quantity: 10 },
                { item_id: 'super-potion', quantity: 5 },
                { item_id: 'antidote', quantity: 5 },
                { item_id: 'paralyze-heal', quantity: 5 }
            ];

            for (const item of starterItems) {
                await inventoryCollection.updateOne(
                    { player_id: player._id.toString(), item_id: item.item_id },
                    { 
                        $setOnInsert: { 
                            player_id: player._id.toString(), 
                            item_id: item.item_id, 
                            quantity: 0 
                        },
                        $inc: { quantity: item.quantity }
                    },
                    { upsert: true }
                );

                console.log(`    ✅ +${item.quantity}x ${item.item_id}`);
            }
        }

        console.log('✅ Items de départ attribués avec succès !');

    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    } finally {
        await client.close();
        process.exit(0);
    }
}

giveStarterItems();
