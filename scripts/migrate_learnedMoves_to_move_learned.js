// migrate_learnedMoves_to_move_learned.js
// Safe migration script: copies 'learnedMoves' => 'move_learned' for all documents
// Usage:
//   MONGO_URI="mongodb://localhost:27017/oppede" node migrate_learnedMoves_to_move_learned.js
//   Add --cleanup to remove 'learnedMoves' after migration

const { MongoClient } = require('mongodb');
let fetch;
(async () => { const nf = await import('node-fetch'); fetch = nf.default; })();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/oppede';
const CLEANUP = process.argv.includes('--cleanup');

 (async () => {
  const client = new MongoClient(MONGO_URI, { useUnifiedTopology: true });
  const nf = await import('node-fetch');
  const fetch = nf.default;
  try {
    await client.connect();
    console.log('[Migration] Connected to MongoDB');
    const db = client.db();
    const collection = db.collection('pokemonPlayer');

    // Find documents with 'learnedMoves' OR without move_learned but with data
    const cursor = collection.find({ $or: [{ learnedMoves: { $exists: true } }, { move_learned: { $exists: false } }] });

    let count = 0;
    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      const learnedMoves = Array.isArray(doc.learnedMoves) ? doc.learnedMoves : [];
      const move_learned = Array.isArray(doc.move_learned) ? doc.move_learned.map(m => (typeof m === 'string' ? m : (m.name || m))) : [];

      const existing = new Set(move_learned);

      let changed = false;
      for (const m of learnedMoves) {
        const name = typeof m === 'string' ? m : (m.name || null);
        if (!name) continue;
        if (!existing.has(name)) {
          move_learned.push(name);
          existing.add(name);
          changed = true;
        }
      }

      // Defensive: if pokemon has a known level and species, filter out future-level moves
      try {
        if (doc.level && doc.species_id) {
          const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${doc.species_id}`);
          if (response.ok) {
            const pokeData = await response.json();
            const potentialMoves = [];
            for (const moveEntry of pokeData.moves) {
              const svDetail = moveEntry.version_group_details.find(detail =>
                detail.version_group && detail.version_group.name === 'scarlet-violet' &&
                detail.move_learn_method && detail.move_learn_method.name === 'level-up'
              );
              if (svDetail) potentialMoves.push({ name: moveEntry.move.name, learnLevel: svDetail.level_learned_at });
            }
            const allowed = new Set(potentialMoves.filter(m => m.learnLevel <= doc.level).map(m => m.name));
            const beforeCount = move_learned.length;
            move_learned = move_learned.filter(n => allowed.has(n));
            if (move_learned.length !== beforeCount) changed = true;
          }
        }
      } catch (err) {
        // ignore; we'll keep whatever move_learned was
      }
      if (changed) {
        const update = { $set: { move_learned, updatedAt: new Date() } };
        if (CLEANUP && doc.learnedMoves) update.$unset = { learnedMoves: "" };
        await collection.updateOne({ _id: doc._id }, update);
        console.log(`[Migration] Updated pokemon ${doc._id} with ${learnedMoves.length} moves migrated.`);
        count++;
      }
    }

    console.log(`[Migration] Completed. ${count} documents updated.`);
    process.exit(0);
  } catch (e) {
    console.error('[Migration] Error:', e);
    process.exit(1);
  } finally {
    await client.close();
  }
})();
