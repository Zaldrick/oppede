// test_cache_learnable_moves.js
// Quick script to ensure cache is used by PokemonDatabaseManager.getAllLearnableMoves

const DatabaseManager = require('../managers/DatabaseManager');
const PokemonDatabaseManager = require('../managers/PokemonDatabaseManager');

(async () => {
  const dbManager = new DatabaseManager();
  await dbManager.connectToDatabase();
  const pokemonDBManager = new PokemonDatabaseManager(dbManager);
  await pokemonDBManager.initialize();

  const speciesId = process.argv[2] || 7; // default Squirtle
  const level = parseInt(process.argv[3] || 12, 10);

  console.log(`Testing cache for species ${speciesId} up to level ${level}`);

  // First call should populate cache
  const moves1 = await pokemonDBManager.getAllLearnableMoves(speciesId, level);
  console.log(`[Test] First call returned ${moves1.length} moves`);

  // second call should use cache
  const moves2 = await pokemonDBManager.getAllLearnableMoves(speciesId, level);
  console.log(`[Test] Second call returned ${moves2.length} moves`);

  // clear cache and call again
  pokemonDBManager.clearLearnableMovesCache(speciesId);
  const moves3 = await pokemonDBManager.getAllLearnableMoves(speciesId, level);
  console.log(`[Test] After clear, call returned ${moves3.length} moves`);

  process.exit(0);
})();
