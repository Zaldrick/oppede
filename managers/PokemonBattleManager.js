/**
 * PokemonBattleManager.js
 * Gestion des routes API pour les combats Pokémon
 * 
 * Routes:
 * - POST /api/battle/start - Démarrer un combat
 * - POST /api/battle/turn - Exécuter un tour
 * - GET  /api/battle/:battleId - Récupérer l'état du combat
 * - POST /api/battle/end - Terminer un combat
 */

const { ObjectId } = require('mongodb');
const PokemonBattleLogicManager = require('./PokemonBattleLogicManager');

class PokemonBattleManager {
    constructor(databaseManager) {
        this.databaseManager = databaseManager;
        this.activeBattles = new Map(); // battleId -> PokemonBattleLogicManager instance
        console.log('[BattleManager] Initialisé');
    }

    /**
     * Configure les routes Express
     */
    setupRoutes(app) {
        console.log('[BattleManager] Configuration des routes...');

        // Démarrer un nouveau combat
        app.post('/api/battle/start', async (req, res) => {
            try {
                const { playerId, opponentId, battleType = 'wild' } = req.body;

                if (!playerId) {
                    return res.status(400).json({ error: 'playerId requis' });
                }

                console.log(`[Battle] Démarrage combat ${battleType} pour joueur:`, playerId);

                const db = await this.databaseManager.connectToDatabase();
                const pokemonCollection = db.collection('pokemonPlayer');
                const battlesCollection = db.collection('battles');

                // Récupérer l'équipe du joueur
                const playerTeam = await pokemonCollection.find({
                    owner_id: new ObjectId(playerId),
                    position: { $gte: 1, $lte: 6 }
                }).sort({ position: 1 }).toArray();

                if (playerTeam.length === 0) {
                    return res.status(400).json({ error: 'Aucun Pokémon dans l\'équipe' });
                }

                // Enrichir avec données d'espèce
                for (const pokemon of playerTeam) {
                    const speciesData = await this.getSpeciesData(pokemon.species_id);
                    pokemon.speciesData = speciesData;
                }

                let opponentTeam;

                if (battleType === 'wild') {
                    // Générer un Pokémon sauvage
                    opponentTeam = [await this.generateWildPokemon()];
                } else {
                    // Combat PvP: charger l'équipe adverse
                    if (!opponentId) {
                        return res.status(400).json({ error: 'opponentId requis pour combat PvP' });
                    }
                    opponentTeam = await pokemonCollection.find({
                        owner_id: new ObjectId(opponentId),
                        position: { $gte: 1, $lte: 6 }
                    }).sort({ position: 1 }).toArray();

                    for (const pokemon of opponentTeam) {
                        const speciesData = await this.getSpeciesData(pokemon.species_id);
                        pokemon.speciesData = speciesData;
                    }
                }

                // Initialiser la logique de combat
                const battleLogic = new PokemonBattleLogicManager();
                const battleState = battleLogic.initializeBattle(playerTeam, opponentTeam, battleType);

                // Sauvegarder en BDD
                const battleDoc = {
                    player_id: new ObjectId(playerId),
                    opponent_id: opponentId ? new ObjectId(opponentId) : null,
                    battle_type: battleType,
                    player_team_ids: playerTeam.map(p => p._id),
                    opponent_team_ids: opponentTeam.map(p => p._id || null),
                    player_active_index: 0,
                    opponent_active_index: 0,
                    turn_count: 0,
                    battle_log: battleState.battle_log,
                    state: 'ongoing',
                    created_at: new Date()
                };

                const result = await battlesCollection.insertOne(battleDoc);
                const battleId = result.insertedId;

                // Stocker l'instance en mémoire
                this.activeBattles.set(battleId.toString(), battleLogic);

                console.log('[Battle] Combat créé:', battleId);

                res.json({
                    battleId,
                    playerTeam: playerTeam.map(p => ({
                        _id: p._id,
                        species_id: p.species_id,
                        name: p.nickname || p.speciesData?.name,
                        level: p.level,
                        currentHP: p.currentHP,
                        maxHP: p.maxHP,
                        types: p.speciesData?.types,
                        moveset: p.moveset || [],
                        sprites: p.speciesData?.sprites
                    })),
                    opponentTeam: opponentTeam.map(p => ({
                        _id: p._id || 'wild',
                        species_id: p.species_id,
                        name: p.nickname || p.speciesData?.name,
                        level: p.level,
                        currentHP: p.currentHP,
                        maxHP: p.maxHP,
                        types: p.speciesData?.types,
                        moveset: p.moveset || [],
                        sprites: p.speciesData?.sprites
                    })),
                    battleLog: battleState.battle_log
                });

            } catch (error) {
                console.error('[Battle] Erreur démarrage combat:', error);
                res.status(500).json({ error: 'Erreur serveur' });
            }
        });

        // Exécuter un tour
        app.post('/api/battle/turn', async (req, res) => {
            try {
                const { battleId, actionType, moveId, moveName, targetId } = req.body;

                if (!battleId) {
                    return res.status(400).json({ error: 'battleId requis' });
                }

                console.log(`[Battle] Tour dans combat ${battleId}:`, { actionType, moveName });

                // Récupérer l'instance de combat
                const battleLogic = this.activeBattles.get(battleId);
                if (!battleLogic) {
                    return res.status(404).json({ error: 'Combat introuvable' });
                }

                const battleState = battleLogic.getBattleState();
                if (battleState.state !== 'ongoing') {
                    return res.status(400).json({ error: 'Combat terminé' });
                }

                // Pokémon actifs
                const playerPokemon = battleState.player_team[battleState.player_active_index];
                const opponentPokemon = battleState.opponent_team[battleState.opponent_active_index];

                // Move du joueur
                let playerMove;
                if (moveName) {
                    // Rechercher dans le moveset (insensible à la casse)
                    playerMove = playerPokemon.moveset.find(m => 
                        m.name.toLowerCase() === moveName.toLowerCase()
                    );
                    
                    console.log('[Battle] Recherche move:', moveName, 'trouvé:', !!playerMove);
                    console.log('[Battle] Moveset disponible:', playerPokemon.moveset.map(m => m.name));
                    
                    if (!playerMove) {
                        // Fallback: chercher en BDD moves
                        console.log('[Battle] Move pas trouvé dans moveset, recherche BDD...');
                        playerMove = await this.getMoveData(moveName);
                    }
                    
                    if (!playerMove) {
                        return res.status(400).json({ 
                            error: `Move "${moveName}" introuvable`,
                            availableMoves: playerPokemon.moveset.map(m => m.name)
                        });
                    }
                } else {
                    return res.status(400).json({ error: 'moveName requis' });
                }

                // Move de l'adversaire (IA)
                const opponentMove = battleLogic.generateAIAction(opponentPokemon, playerPokemon);

                // Déterminer l'ordre des tours
                const firstAttacker = battleLogic.calculateTurnOrder(
                    playerPokemon,
                    opponentPokemon,
                    playerMove,
                    opponentMove
                );

                battleState.turn_count++;

                let playerResult, opponentResult;

                // Exécuter les tours
                if (firstAttacker === 'player') {
                    // Joueur attaque en premier
                    console.log('[Battle] Joueur attaque avec', playerMove.name);
                    playerResult = battleLogic.processTurn(playerPokemon, opponentPokemon, playerMove, 'player');
                    console.log('[Battle] Résultat joueur:', playerResult);
                    
                    // Si l'adversaire n'est pas KO, il contre-attaque
                    if (!playerResult.defenderKO) {
                        console.log('[Battle] Adversaire contre-attaque avec', opponentMove.name);
                        opponentResult = battleLogic.processTurn(opponentPokemon, playerPokemon, opponentMove, 'opponent');
                        console.log('[Battle] Résultat adversaire:', opponentResult);
                    }
                } else {
                    // Adversaire attaque en premier
                    console.log('[Battle] Adversaire attaque avec', opponentMove.name);
                    opponentResult = battleLogic.processTurn(opponentPokemon, playerPokemon, opponentMove, 'opponent');
                    console.log('[Battle] Résultat adversaire:', opponentResult);
                    
                    // Si le joueur n'est pas KO, il contre-attaque
                    if (!opponentResult.defenderKO) {
                        console.log('[Battle] Joueur contre-attaque avec', playerMove.name);
                        playerResult = battleLogic.processTurn(playerPokemon, opponentPokemon, playerMove, 'player');
                        console.log('[Battle] Résultat joueur:', playerResult);
                    }
                }

                // Vérifier fin de combat
                const battleEnd = battleLogic.isBattleOver();

                // Sauvegarder en BDD
                const db = await this.databaseManager.connectToDatabase();
                const battlesCollection = db.collection('battles');

                await battlesCollection.updateOne(
                    { _id: new ObjectId(battleId) },
                    {
                        $set: {
                            turn_count: battleState.turn_count,
                            battle_log: battleState.battle_log,
                            state: battleState.state,
                            updated_at: new Date()
                        }
                    }
                );

                // Si combat terminé, update HP des Pokémon
                if (battleEnd.isOver) {
                    await this.updatePokemonHP(battleState);
                    this.activeBattles.delete(battleId);
                }

                res.json({
                    battleId,
                    turnCount: battleState.turn_count,
                    playerAction: playerResult,
                    opponentAction: opponentResult,
                    battleLog: battleState.battle_log.slice(-5), // 5 dernières entrées
                    playerHP: playerPokemon.currentHP,
                    opponentHP: opponentPokemon.currentHP,
                    isOver: battleEnd.isOver,
                    winner: battleEnd.winner,
                    state: battleState.state
                });

            } catch (error) {
                console.error('[Battle] Erreur tour combat:', error);
                res.status(500).json({ error: 'Erreur serveur', details: error.message });
            }
        });

        // Récupérer l'état du combat
        app.get('/api/battle/:battleId', async (req, res) => {
            try {
                const { battleId } = req.params;

                const db = await this.databaseManager.connectToDatabase();
                const battlesCollection = db.collection('battles');

                const battle = await battlesCollection.findOne({ _id: new ObjectId(battleId) });

                if (!battle) {
                    return res.status(404).json({ error: 'Combat introuvable' });
                }

                res.json(battle);

            } catch (error) {
                console.error('[Battle] Erreur récupération combat:', error);
                res.status(500).json({ error: 'Erreur serveur' });
            }
        });

        // Terminer un combat
        app.post('/api/battle/end', async (req, res) => {
            try {
                const { battleId, winner } = req.body;

                if (!battleId) {
                    return res.status(400).json({ error: 'battleId requis' });
                }

                console.log(`[Battle] Fin de combat ${battleId}, vainqueur: ${winner}`);

                const db = await this.databaseManager.connectToDatabase();
                const battlesCollection = db.collection('battles');

                await battlesCollection.updateOne(
                    { _id: new ObjectId(battleId) },
                    {
                        $set: {
                            state: winner === 'player' ? 'player_won' : 'opponent_won',
                            ended_at: new Date()
                        }
                    }
                );

                // Supprimer de la mémoire
                this.activeBattles.delete(battleId);

                // TODO: Calcul XP et récompenses
                res.json({
                    success: true,
                    winner,
                    rewards: {
                        xp: 150,
                        money: 500
                    }
                });

            } catch (error) {
                console.error('[Battle] Erreur fin combat:', error);
                res.status(500).json({ error: 'Erreur serveur' });
            }
        });

        console.log('[BattleManager] Routes configurées');
    }

    /**
     * Récupère les données d'une espèce depuis PokéAPI (avec cache)
     */
    async getSpeciesData(speciesId) {
        try {
            const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}`);
            const data = await response.json();

            return {
                name: data.name,
                types: data.types.map(t => t.type.name),
                sprites: {
                    menu: data.sprites.versions?.['generation-vii']?.icons?.front_default,
                    frontCombat: data.sprites.versions?.['generation-v']?.['black-white']?.animated?.front_default || data.sprites.front_default,
                    backCombat: data.sprites.versions?.['generation-v']?.['black-white']?.animated?.back_default || data.sprites.back_default
                },
                stats: {
                    hp: data.stats.find(s => s.stat.name === 'hp')?.base_stat || 45,
                    attack: data.stats.find(s => s.stat.name === 'attack')?.base_stat || 49,
                    defense: data.stats.find(s => s.stat.name === 'defense')?.base_stat || 49,
                    sp_attack: data.stats.find(s => s.stat.name === 'special-attack')?.base_stat || 65,
                    sp_defense: data.stats.find(s => s.stat.name === 'special-defense')?.base_stat || 65,
                    speed: data.stats.find(s => s.stat.name === 'speed')?.base_stat || 45
                }
            };
        } catch (error) {
            console.error('[Battle] Erreur récupération espèce:', error);
            return null;
        }
    }

    /**
     * Génère un Pokémon sauvage
     */
    async generateWildPokemon() {
        // Liste de Pokémon sauvages communs (Gen I)
        const wildSpecies = [16, 19, 21, 23, 41, 43, 46, 60, 63, 69]; // Pidgey, Rattat, Spearow, etc.
        const randomSpeciesId = wildSpecies[Math.floor(Math.random() * wildSpecies.length)];

        const speciesData = await this.getSpeciesData(randomSpeciesId);
        const level = 3 + Math.floor(Math.random() * 5); // Level 3-7

        // Calculer HP max
        const baseHP = speciesData.stats.hp;
        const maxHP = Math.floor(((2 * baseHP + 15) * level) / 100) + level + 10;

        return {
            species_id: randomSpeciesId,
            nickname: null,
            level,
            currentHP: maxHP,
            maxHP,
            experience: 0,
            ivs: {
                hp: 15, attack: 15, defense: 15,
                sp_attack: 15, sp_defense: 15, speed: 15
            },
            evs: { hp: 0, attack: 0, defense: 0, sp_attack: 0, sp_defense: 0, speed: 0 },
            nature: 'Hardy',
            moveset: [
                { name: 'Charge', type: 'normal', category: 'physical', power: 40, accuracy: 100, pp: 35 },
                { name: 'Groz\'Yeux', type: 'normal', category: 'status', power: 0, accuracy: 100, pp: 30 },
                { name: 'Vive-Attaque', type: 'normal', category: 'physical', power: 40, accuracy: 100, pp: 30 },
                { name: 'Tornade', type: 'flying', category: 'special', power: 40, accuracy: 100, pp: 35 }
            ],
            stats: speciesData.stats,
            speciesData
        };
    }

    /**
     * Récupère les données d'un move
     */
    async getMoveData(moveName) {
        try {
            const db = await this.databaseManager.connectToDatabase();
            const movesCollection = db.collection('pokemonMoves');

            let move = await movesCollection.findOne({ name: moveName });

            if (!move) {
                // Fallback PokéAPI
                const response = await fetch(`https://pokeapi.co/api/v2/move/${moveName}`);
                const data = await response.json();

                move = {
                    name: data.name,
                    type: data.type.name,
                    category: data.damage_class.name,
                    power: data.power,
                    accuracy: data.accuracy,
                    pp: data.pp,
                    priority: data.priority
                };

                await movesCollection.insertOne(move);
            }

            return move;
        } catch (error) {
            console.error('[Battle] Erreur récupération move:', error);
            return {
                name: moveName,
                type: 'normal',
                category: 'physical',
                power: 40,
                accuracy: 100,
                pp: 35,
                priority: 0
            };
        }
    }

    /**
     * Met à jour les HP des Pokémon dans la BDD après le combat
     */
    async updatePokemonHP(battleState) {
        try {
            const db = await this.databaseManager.connectToDatabase();
            const pokemonCollection = db.collection('pokemonPlayer');

            // Update HP joueur
            for (const pokemon of battleState.player_team) {
                if (pokemon._id) {
                    await pokemonCollection.updateOne(
                        { _id: pokemon._id },
                        { $set: { currentHP: pokemon.currentHP } }
                    );
                }
            }

            // Update HP adversaire (si PvP)
            for (const pokemon of battleState.opponent_team) {
                if (pokemon._id) {
                    await pokemonCollection.updateOne(
                        { _id: pokemon._id },
                        { $set: { currentHP: pokemon.currentHP } }
                    );
                }
            }

            console.log('[Battle] HP mis à jour en BDD');
        } catch (error) {
            console.error('[Battle] Erreur update HP:', error);
        }
    }
}

module.exports = PokemonBattleManager;
