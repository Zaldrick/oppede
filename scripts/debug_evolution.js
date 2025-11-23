// Simple script to test evolution perform API via managers
const DatabaseManager = require('../managers/DatabaseManager');
const PokemonEvolutionManager = require('../managers/PokemonEvolutionManager');

(async () => {
    try {
        const dbm = new DatabaseManager();
        await dbm.initialize();
        const em = new PokemonEvolutionManager(dbm);
        const pokemonId = process.argv[2];
        const targetSpeciesId = parseInt(process.argv[3]);
        if (!pokemonId || !targetSpeciesId) {
            console.error('Usage: node debug_evolution.js <pokemonId> <targetSpeciesId>');
            process.exit(1);
        }

        const result = await em.performEvolution(pokemonId, targetSpeciesId);
        console.log('Evolution result:', result);
    } catch (err) {
        console.error('Error executing debug evolution:', err);
    } finally {
        process.exit(0);
    }
})();
