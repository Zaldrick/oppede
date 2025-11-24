// test_carapuce_bite_flow.js
// Verifies that a Carapuce at level 11 with 'bite' in move_learned WILL still be offered 'bite' on levelup to 12
// Usage: MONGO_URI env var; executes directly via node

const { MongoClient, ObjectId } = require('mongodb');
const PokemonBattleManager = require('../managers/PokemonBattleManager');
const PokemonDatabaseManager = require('../managers/PokemonDatabaseManager');
const DatabaseManager = require('../managers/DatabaseManager');

(async () => {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/oppede';
  const client = new MongoClient(MONGO_URI, { useUnifiedTopology: true });
  await client.connect();
  const db = client.db();
  const pokemonCollection = db.collection('pokemonPlayer');

  // Setup managers (approx) via DatabaseManager
  process.env.MONGO_URI = MONGO_URI;
  const databaseManager = new DatabaseManager();
  await databaseManager.connectToDatabase();

  const pokemonDBManager = new PokemonDatabaseManager(databaseManager);
  await pokemonDBManager.initialize();
  const battleManager = new PokemonBattleManager(databaseManager);
  // Wire the pokemonDBManager for internal calls
  battleManager.pokemonDatabaseManager = pokemonDBManager;

  try {
    // Create a test Carapuce at level 11 with bite recorded in db
    const speciesId = 7; // squirtle
    const pokemon = {
      owner_id: null,
      species_id: speciesId,
      species_name: 'squirtle',
      nickname: 'TestCarapuce2',
      level: 11,
      experience: pokemonDBManager.calculateXPFromLevel ? pokemonDBManager.calculateXPFromLevel(11) : 0,
      moveset: [],
      move_learned: ['bite'],
      currentHP: 20,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const insert = await pokemonCollection.insertOne(pokemon);
    const pid = insert.insertedId;

    // Build a minimal battleState where the player's first pokemon is this creature
    const battleState = {
      player_team: [ { ...pokemon, _id: pid } ],
      opponent_team: [ { species_id: 10, level: 10, nickname: 'Dummy', currentHP: 10, moveset: [] } ],
      player_active_index: 0,
      opponent_active_index: 0
    };

    const xpGains = await battleManager.updatePokemonHPAndXP(battleState, 'player', null, null);

    console.log('XP Gains returned:', xpGains);
    const forThis = xpGains.find(x => x.pokemonId && x.pokemonId.toString() === pid.toString());
    if (!forThis) {
      console.error('No xp result for test pokemon');
      process.exit(2);
    }

    console.log('newMovesAvailable:', forThis.newMovesAvailable.map(m => m.name));
    // Since the pokemon had bite in move_learned but at level 11, bite should still be offered at level 12
    const hasBite = forThis.newMovesAvailable.some(m => m.name === 'bite');
    if (!hasBite) {
      console.error('❌ Expected bite to be offered but it was filtered out');
      process.exit(3);
    }

    console.log('✅ test_carapuce_bite_flow passed');

  } catch (err) {
    console.error('Error in test', err);
    process.exit(1);
  } finally {
    await pokemonCollection.deleteMany({ nickname: 'TestCarapuce2' });
    await client.close();
  }
})();
