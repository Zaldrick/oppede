const { MongoClient, ObjectId } = require('mongodb');

/**
 * Cleanup migration script
 * - Scans pokemonPlayer collection
 * - For each pokemon, ensures move_learned only contains moves that have learnLevel <= pokemon.level
 * - Removes any move entries that correspond to learn levels higher than pokemon.level
 * - Usage: MONGO_URI="mongodb://..." node scripts/cleanup_move_learned_future_moves.js
 */

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/oppede';
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  const db = client.db('oppede');
  const collection = db.collection('pokemonPlayer');

  // load small cache for getAllLearnableMoves via direct fetch
  const fetch = (await import('node-fetch')).default;

  let processed = 0;
  const cursor = collection.find({ move_learned: { $exists: true, $ne: [] } });
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const speciesId = doc.species_id;
    const pokemonLevel = doc.level || 1;
    const moveList = Array.isArray(doc.move_learned) ? doc.move_learned : [];

    // Build map of moveName -> learnLevel by fetching all learnable moves for the species (up to 100)
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}`);
    if (!response.ok) {
      console.warn(`  ⚠️ Could not fetch species ${speciesId} - skipping`);
      continue;
    }
    const pokeData = await response.json();
    const potentialMoves = [];

    for (const moveEntry of pokeData.moves) {
      const svDetail = moveEntry.version_group_details.find(detail =>
        detail.version_group && detail.version_group.name === 'scarlet-violet' &&
        detail.move_learn_method && detail.move_learn_method.name === 'level-up'
      );

      if (svDetail) {
        potentialMoves.push({ name: moveEntry.move.name, learnLevel: svDetail.level_learned_at });
      }
    }

    const moveMap = new Map();
    for (const m of potentialMoves) { moveMap.set(m.name, m.learnLevel); }

    const filtered = moveList.filter(name => {
      const ll = moveMap.get(name);
      // if we don't find the move in PokeAPI's learnable list we keep it (safe fallback)
      if (ll === undefined || ll === null) return true;
      return ll <= pokemonLevel;
    });

    if (filtered.length !== moveList.length) {
      await collection.updateOne({ _id: doc._id }, { $set: { move_learned: filtered, updatedAt: new Date() } });
      console.log(`  ✨ Cleaned ${doc._id} (${doc.species_id}) - kept ${filtered.length}/${moveList.length}`);
    }

    processed++;
  }

  console.log(`Done. Processed ${processed} documents.`);
  await client.close();
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
