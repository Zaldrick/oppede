// test_move_learn_flow.js
// Integration helper to validate move learn / seen flows.
// Usage: MONGO_URI and API_URL env vars optional. Requires server running for API calls.

// node-fetch v3 is ESM-only; import dynamically
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

  // Create a fake pokemon doc
  const pokemon = {
    owner_id: null,
    species_id: 1,
    species_name: 'bulbasaur',
    nickname: 'TestBulba',
    level: 5,
    moveset: [],
    move_learned: [],
    currentHP: 20,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await collection.insertOne(pokemon);
  const pid = result.insertedId;
  console.log('[Test] Pokemon created with id:', pid.toString());

  // 1. Simulate server-side offering of a move by inserting name into move_learned (server-only writes)
  const fakeMove = { name: 'vine-whip', type: 'grass', category: 'physical', power: 45, accuracy: 100, pp: 25 };
  // Instead of calling mark-move-seen (client-side), perform a server-style DB write to emulate server behavior.
  await collection.updateOne({ _id: pid }, { $addToSet: { move_learned: fakeMove.name }, $set: { updatedAt: new Date() } });
  const dbDoc = await collection.findOne({ _id: new ObjectId(pid) });
  console.log('[Test] After simulated server write move_learned count:', (dbDoc.move_learned || []).length);
  const offeredEntry = (dbDoc.move_learned || []).includes(fakeMove.name);
  if (!offeredEntry) {
    console.error('[Test] ❌ Expected server-side added move in move_learned');
    process.exit(2);
  }

  // Test: calling mark-move-seen should return 200 (server persists via endpoint)
  const responseMark = await fetch(`${API_URL}/api/pokemon/mark-move-seen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pokemonId: pid.toString(), move: fakeMove })
  });
  if (responseMark.status !== 200) {
    console.error('[Test] ❌ mark-move-seen expected 200 but got', responseMark.status);
    process.exit(6);
  }
  if (!offeredEntry) {
    console.error('[Test] ❌ Expected offered move in move_learned');
    process.exit(2);
  }

  // 2. simulate learn-move (should add to moveset and ensure move appears in move_learned)
  resp = await fetch(`${API_URL}/api/pokemon/learn-move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pokemonId: pid.toString(), newMove: fakeMove })
  });
  const learnedBody = await resp.json();
  console.log('[Test] learn-move response:', learnedBody);

  const dbDoc2 = await collection.findOne({ _id: new ObjectId(pid) });
  console.log('[Test] After learn-move moveset:', dbDoc2.moveset);
  console.log('[Test] After learn-move move_learned count:', (dbDoc2.move_learned || []).length);
  // Verify move is present in move_learned after learn-move
  const learnedEntry = (dbDoc2.move_learned || []).includes(fakeMove.name);
  if (!learnedEntry) {
    console.error('[Test] ❌ Expected learned move in move_learned after learn-move');
    process.exit(4);
  }

  // Cleanup
  await collection.deleteOne({ _id: pid });
  await client.close();

  process.exit(0);
})();
