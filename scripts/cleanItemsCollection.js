/**
 * Script pour nettoyer la collection items
 * Usage: node scripts/cleanItemsCollection.js
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://zaldrick:xtHDAM0ZFpq2iL9L@oppede.zfhlzph.mongodb.net/oppede';

async function cleanItems() {
    const client = new MongoClient(MONGO_URI);

    try {
        console.log('🔌 Connexion à MongoDB...');
        await client.connect();
        const db = client.db();

        const itemsCollection = db.collection('items');

        // Supprimer tous les documents avec item_id null
        const deleteResult = await itemsCollection.deleteMany({ item_id: null });
        console.log(`🗑️ Supprimé ${deleteResult.deletedCount} document(s) avec item_id null`);

        // Supprimer tous les index existants
        console.log('🗑️ Suppression des index existants...');
        await itemsCollection.dropIndexes();

        // Supprimer toute la collection et la recréer proprement
        console.log('🗑️ Suppression complète de la collection items...');
        await itemsCollection.drop();
        console.log('✅ Collection items nettoyée');

        console.log('✅ Nettoyage terminé ! Redémarrez le serveur pour recréer la collection.');

    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    } finally {
        await client.close();
        process.exit(0);
    }
}

cleanItems();
