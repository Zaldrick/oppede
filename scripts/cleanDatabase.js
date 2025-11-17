/**
 * cleanDatabase.js
 * Nettoie la base : supprime la collection pokemonSpecies
 * (plus besoin, tout vient de PokéAPI en lazy)
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://zaldrick:xtHDAM0ZFpq2iL9L@oppede.zfhlzph.mongodb.net/oppede';

async function cleanDatabase() {
    const client = new MongoClient(MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    try {
        await client.connect();
        const db = client.db('oppede');

        console.log('🧹 Nettoyage de la base données...\n');

        // Supprimer collection pokemonSpecies (plus besoin)
        const collections = await db.listCollections().toArray();
        
        if (collections.find(c => c.name === 'pokemonSpecies')) {
            await db.collection('pokemonSpecies').drop();
            console.log('✅ Collection pokemonSpecies supprimée');
        } else {
            console.log('ℹ️  Collection pokemonSpecies n\'existe pas');
        }

        // Afficher les collections restantes
        console.log('\n📊 Collections restantes:');
        const remainingCollections = await db.listCollections().toArray();
        remainingCollections.forEach(c => {
            console.log(`  • ${c.name}`);
        });

        console.log('\n✅ Nettoyage terminé!');
    } catch (error) {
        console.error('❌ Erreur:', error);
    } finally {
        await client.close();
    }
}

cleanDatabase();
