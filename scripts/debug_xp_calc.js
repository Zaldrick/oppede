const DatabaseManager = require('../managers/DatabaseManager');
const PokemonDatabaseManager = require('../managers/PokemonDatabaseManager');
const PokemonBattleManager = require('../managers/PokemonBattleManager');
const PokemonBattleLogicManager = require('../managers/PokemonBattleLogicManager');
const { ObjectId } = require('mongodb');

async function runDebug() {
    const databaseManager = new DatabaseManager();
    await databaseManager.initialize();
    const pokemonDBManager = new PokemonDatabaseManager(databaseManager);
    await pokemonDBManager.initialize();

    const battleManager = new PokemonBattleManager(databaseManager);
    // Ensure translationManager and pokemonDB assigned for correct FR names
    const translationManager = new (require('../managers/TranslationManager'))(databaseManager);
    await translationManager.initialize();
    pokemonDBManager.translationManager = translationManager;
    battleManager.translationManager = translationManager;
    // Ensure battle manager references PokemonDatabaseManager for move lookups
    battleManager.pokemonDatabaseManager = pokemonDBManager;

    // Create a debug player (seeded in DB via seed scripts, but we'll just find an existing one)
    const db = await databaseManager.connectToDatabase();
    const playersCol = db.collection('players');
    const player = await playersCol.findOne({ pseudo: 'Mehdi' });
    if (!player) {
        console.error('Player Mehdi not found. Run seed scripts.');
        process.exit(1);
    }

    // Ensure the player has at least one Pokémon in DB; if not, create one via createDebugPokemon
    const pokemonPlayers = db.collection('pokemonPlayer');
    const existing = await pokemonPlayers.findOne({ owner_id: new ObjectId(player._id) });
    let playerPokemon;
    if (!existing) {
        console.log('No Pokemon for Mehdi, creating debug Pokemon');
        const created = await pokemonDBManager.createDebugPokemon(player._id.toString(), 7); // species 7
        playerPokemon = created;
    } else {
        playerPokemon = existing;
    }

    // Generate a weak wild Pokemon
    const wild = await pokemonDBManager.generatePokemonData(16, 3); // Pidgey at level 3
    wild.speciesData = await battleManager.getSpeciesData(wild.species_id);
    wild.stats = battleManager.calculateStats(wild, wild.speciesData);

    // Build teams
    const playerTeam = [playerPokemon];
    const opponentTeam = [wild];

    const battleLogic = new PokemonBattleLogicManager();
    const battleState = battleLogic.initializeBattle(playerTeam, opponentTeam, 'wild');

    // Simulate attack from player that KOs wild
    // Create a strong move
    const move = { name: 'debug-hit', power: 200, category: 'physical', type: 'normal', accuracy: 100 };
    const result = battleLogic.processTurn(playerTeam[0], wild, move, 'player');
    console.log('Simulated attack result:', result);

    // After KO, call updatePokemonHPAndXP
    const battleId = new ObjectId();
    battleManager.activeBattles.set(battleId.toString(), battleLogic);

    const xpGains = await battleManager.updatePokemonHPAndXP(battleState, 'player', player._id.toString(), battleId.toString());
    console.log('XP Gains result:', xpGains);
    process.exit(0);
}

runDebug().catch(err => { console.error(err); process.exit(1); });
