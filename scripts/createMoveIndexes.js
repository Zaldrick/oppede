/**
 * createMoveIndexes.js
 * Crée les index pour la collection pokemonMoves
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://zaldrick:oppede@cluster0.o7rtbxe.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = 'oppede';

async function createIndexes() {
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        console.log('✓ Connecté à MongoDB');

        const db = client.db(DB_NAME);
        const movesCollection = db.collection('pokemonMoves');

        // Créer index sur le nom (pour recherche rapide)
        await movesCollection.createIndex({ name: 1 }, { unique: true });
        console.log('✓ Index créé sur le champ "name"');

        // Créer index sur l'ID (pour recherche alternative)
        await movesCollection.createIndex({ id: 1 });
        console.log('✓ Index créé sur le champ "id"');

        // Créer index sur le type (pour filtres futurs)
        await movesCollection.createIndex({ type: 1 });
        console.log('✓ Index créé sur le champ "type"');

        console.log('\n✓ Tous les index ont été créés avec succès');

        // Afficher les index existants
        const indexes = await movesCollection.indexes();
        console.log('\nIndex existants:');
        indexes.forEach(index => {
            console.log(`  - ${index.name}:`, index.key);
        });

    } catch (error) {
        console.error('✗ Erreur lors de la création des index:', error);
        process.exit(1);
    } finally {
        await client.close();
        console.log('\n✓ Connexion fermée');
    }
}

createIndexes();
