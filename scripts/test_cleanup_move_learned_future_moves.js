// test_cleanup_move_learned_future_moves.js
// This test ensures that defensive filtering removes future-level moves from the returned Pokemon object
// Usage: MONGO_URI + API_URL (server running)

let fetch;
const { MongoClient, ObjectId } = require('mongodb');
const API_URL = process.env.API_URL || (process.env.REACT_APP_API_URL || 'http://localhost:3000');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/oppede';

(async () => {
  const nf = await import('node-fetch');
  fetch = nf.default;
  const client = new MongoClient(MONGO_URI, { useUnifiedTopology: true });
  await client.connect();
  const db = client.db();
  const collection = db.collection('pokemonPlayer');

  // Create Carapuce at level 11 but artificially add 'bite' to move_learned
  const speciesId = 7; // Carapuce / Squirtle
  const doc = {
    owner_id: null,
    species_id: speciesId,
    species_name: 'squirtle',
    nickname: 'TestCarapuce',
    level: 11,
    experience: 0,
    moveset: [],
    // Bite is learned at level 12, so it's a future-level move for level 11
    move_learned: ['bite'],
    currentHP: 20,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const insertRes = await collection.insertOne(doc);
  const pid = insertRes.insertedId;

  try {
    // Fetch via API which applies defensive filtering
    const response = await fetch(`${API_URL}/api/pokemon/${pid.toString()}`);
    if (!response.ok) {
      console.error('Failed to GET pokemon:', response.status);
      process.exit(1);
    }
    const body = await response.json();
    const moveLearned = (body.pokemon && body.pokemon.move_learned) || [];
    console.log('[TestCleanup] move_learned returned from API:', moveLearned);
    if (moveLearned.includes('bite')) {
      console.error('[TestCleanup] ❌ bite should have been filtered out by defensive logic');
      process.exit(2);
    }

    // Run the cleanup script (expected to modify DB on disk)
    // We will spawn the node script
    const child_process = require('child_process');
    const cp = child_process.execSync(`node scripts/cleanup_move_learned_future_moves.js`, { env: process.env, stdio: 'inherit' });

    // Reload directly from DB and assert it's been removed
    const dbDoc = await collection.findOne({ _id: pid });
    const dbMoveList = dbDoc.move_learned || [];
    console.log('[TestCleanup] move_learned in DB after cleanup:', dbMoveList);
    if (dbMoveList.includes('bite')) {
      console.error('[TestCleanup] ❌ DB still contains bite after cleanup');
      process.exit(3);
    }

    console.log('✅ Test cleanup_move_learned_future_moves PASSED');
  } finally {
    await collection.deleteOne({ _id: pid });
    await client.close();
  }

  process.exit(0);
})();
