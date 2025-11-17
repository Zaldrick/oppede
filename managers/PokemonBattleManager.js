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
                        experience: p.experience, // 🆕 ESSENTIEL pour calcul XP bar
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
                        experience: p.experience || 0, // 🆕 Pour Pokémon sauvages
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

                // Récupérer le combat depuis la DB pour avoir le player_id
                const db = await this.databaseManager.connectToDatabase();
                const battlesCollection = db.collection('battles');
                const battleDoc = await battlesCollection.findOne({ _id: new ObjectId(battleId) });

                if (!battleDoc) {
                    return res.status(404).json({ error: 'Combat introuvable en DB' });
                }

                const playerId = battleDoc.player_id.toString();

                // Récupérer l'instance de combat
                const battleLogic = this.activeBattles.get(battleId);
                if (!battleLogic) {
                    return res.status(404).json({ error: 'Combat introuvable en mémoire' });
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
            
            // Si l'adversaire n'est pas KO (vérifier HP réel), il contre-attaque
            if (opponentPokemon.currentHP > 0) {
                console.log('[Battle] Adversaire contre-attaque avec', opponentMove.name);
                opponentResult = battleLogic.processTurn(opponentPokemon, playerPokemon, opponentMove, 'opponent');
                console.log('[Battle] Résultat adversaire:', opponentResult);
            } else {
                console.log('[Battle] Adversaire K.O., ne peut pas contre-attaquer');
            }
        } else {
            // Adversaire attaque en premier
            console.log('[Battle] Adversaire attaque avec', opponentMove.name);
            opponentResult = battleLogic.processTurn(opponentPokemon, playerPokemon, opponentMove, 'opponent');
            console.log('[Battle] Résultat adversaire:', opponentResult);
            
            // Si le joueur n'est pas KO (vérifier HP réel), il contre-attaque
            if (playerPokemon.currentHP > 0) {
                console.log('[Battle] Joueur contre-attaque avec', playerMove.name);
                playerResult = battleLogic.processTurn(playerPokemon, opponentPokemon, playerMove, 'player');
                console.log('[Battle] Résultat joueur:', playerResult);
            } else {
                console.log('[Battle] Joueur K.O., ne peut pas contre-attaquer');
            }
        }                // Vérifier fin de combat
                const battleEnd = battleLogic.isBattleOver();

                // Sauvegarder en BDD (réutiliser la connexion db existante)
                const battlesCollection2 = db.collection('battles');

                await battlesCollection2.updateOne(
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

                // Si combat terminé, update HP et distribuer XP
                if (battleEnd.isOver) {
                    const xpGains = await this.updatePokemonHPAndXP(battleState, battleEnd.winner, playerId);
                    this.activeBattles.delete(battleId);
                    
                    // Retourner aussi les gains XP
                    return res.json({
                        battleId,
                        turnCount: battleState.turn_count,
                        playerAction: playerResult,
                        opponentAction: opponentResult,
                        battleLog: battleState.battle_log.slice(-5),
                        playerHP: playerPokemon.currentHP,
                        opponentHP: opponentPokemon.currentHP,
                        isOver: battleEnd.isOver,
                        winner: battleEnd.winner,
                        state: battleState.state,
                        xpGains: xpGains // 🆕 Gains XP pour affichage
                    });
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

        // 🆕 Route de capture
        app.post('/api/battle/capture', async (req, res) => {
            try {
                const { battleId, playerId, ballType } = req.body;

                if (!battleId || !playerId || !ballType) {
                    return res.status(400).json({ error: 'battleId, playerId et ballType requis' });
                }

                console.log('[Battle] Tentative de capture avec', ballType);

                // Récupérer l'état du combat
                const battleLogic = this.activeBattles.get(battleId);
                if (!battleLogic) {
                    return res.status(404).json({ error: 'Combat introuvable' });
                }

                const battleState = battleLogic.getBattleState();

                // Vérifier que c'est un combat sauvage
                if (battleState.battle_type !== 'wild') {
                    return res.status(400).json({ error: 'On ne peut capturer que des Pokémon sauvages' });
                }

                // Récupérer le Pokémon sauvage (adversaire actif)
                const wildPokemon = battleState.opponent_team[battleState.opponent_active_index];

                // Tenter la capture
                const captureResult = await this.attemptCapture(playerId, wildPokemon, ballType);

                // Si capturé, terminer le combat
                if (captureResult.captured) {
                    const db = await this.databaseManager.connectToDatabase();
                    const battlesCollection = db.collection('battles');

                    await battlesCollection.updateOne(
                        { _id: new ObjectId(battleId) },
                        {
                            $set: {
                                state: 'captured',
                                winner: 'player',
                                captured_pokemon_id: captureResult.pokemonId,
                                updated_at: new Date()
                            }
                        }
                    );

                    // Retirer le combat de la mémoire
                    this.activeBattles.delete(battleId);

                    console.log('[Battle] Pokémon capturé avec succès !');
                }

                res.json({
                    ...captureResult,
                    battleId
                });

            } catch (error) {
                console.error('[Battle] Erreur capture:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // 🆕 Route de changement de Pokémon (switch)
        app.post('/api/battle/switch', async (req, res) => {
            try {
                const { battleId, newIndex } = req.body;

                if (!battleId || newIndex === undefined) {
                    return res.status(400).json({ error: 'battleId et newIndex requis' });
                }

                console.log(`[Battle] Switch Pokémon dans combat ${battleId} vers index ${newIndex}`);

                // Récupérer l'instance de combat
                const battleLogic = this.activeBattles.get(battleId);
                if (!battleLogic) {
                    return res.status(404).json({ error: 'Combat introuvable en mémoire' });
                }

                const battleState = battleLogic.getBattleState();
                if (battleState.state !== 'ongoing') {
                    return res.status(400).json({ error: 'Combat terminé' });
                }

                // Vérifier que le Pokémon est valide
                const newPokemon = battleState.player_team[newIndex];
                if (!newPokemon) {
                    return res.status(400).json({ error: 'Index invalide' });
                }

                if (newPokemon.currentHP <= 0) {
                    return res.status(400).json({ error: 'Ce Pokémon est K.O.' });
                }

                if (battleState.player_active_index === newIndex) {
                    return res.status(400).json({ error: 'Ce Pokémon est déjà actif' });
                }

                // Effectuer le switch dans la logique
                battleLogic.switchPokemon('player', newIndex);

                // Mettre à jour la BDD
                const db = await this.databaseManager.connectToDatabase();
                const battlesCollection = db.collection('battles');
                
                await battlesCollection.updateOne(
                    { _id: new ObjectId(battleId) },
                    {
                        $set: {
                            player_active_index: newIndex,
                            updated_at: new Date()
                        },
                        $push: {
                            battle_log: {
                                turn: battleState.turn_count,
                                message: `${newPokemon.nickname || newPokemon.speciesData?.name} entre en combat!`,
                                timestamp: Date.now()
                            }
                        }
                    }
                );

                console.log(`[Battle] Switch effectué: player_active_index = ${newIndex}`);

                res.json({
                    success: true,
                    newActiveIndex: newIndex,
                    newActiveName: newPokemon.nickname || newPokemon.speciesData?.name
                });

            } catch (error) {
                console.error('[Battle] Erreur switch:', error);
                res.status(500).json({ error: error.message });
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
    /**
     * Met à jour HP et distribue XP après fin de combat
     */
    async updatePokemonHPAndXP(battleState, winner, playerId) {
        try {
            const db = await this.databaseManager.connectToDatabase();
            const pokemonCollection = db.collection('pokemonPlayer');

            let xpGains = [];

            // Si le joueur a gagné, distribuer XP
            if (winner === 'player') {
                console.log('[Battle] Victoire joueur - Distribution XP');
                
                // Récupérer le Pokémon vaincu (premier adversaire, car combat sauvage = 1 seul)
                const defeatedPokemon = battleState.opponent_team[0];
                
                // Récupérer le BattleLogicManager pour avoir les vrais participants
                // battleState._id est l'ObjectId MongoDB du combat
                const battleKey = battleState._id?.toString();
                console.log('[Battle] Recherche BattleLogic avec clé:', battleKey);
                console.log('[Battle] Clés disponibles dans activeBattles:', Array.from(this.activeBattles.keys()));
                
                let participants = [];
                const battleLogic = this.activeBattles.get(battleKey);
                if (!battleLogic) {
                    console.error('[Battle] ⚠️ BattleLogic non trouvé! Impossible de récupérer les participants.');
                    // Fallback: prendre seulement le Pokémon actif
                    participants = [battleState.player_team.find(p => 
                        p._id && p._id.toString() === battleState.player_active_index.toString()
                    ) || battleState.player_team[0]].filter(p => p);
                    
                    console.log('[Battle] Fallback: seulement Pokémon actif', participants[0]?.nickname);
                    xpGains = new PokemonBattleLogicManager().calculateExperienceGain(defeatedPokemon, participants, playerId);
                } else {
                    const participantIds = battleLogic.getParticipants();
                    
                    // Filtrer l'équipe pour ne garder que les participants réels
                    participants = battleState.player_team.filter(p => 
                        p._id && participantIds.includes(p._id.toString())
                    );
                    
                    console.log(`[Battle] Participants réels: ${participants.length}/${battleState.player_team.length}`, participantIds);
                    
                    // Calculer XP via BattleLogicManager
                    xpGains = battleLogic.calculateExperienceGain(defeatedPokemon, participants, playerId);
                }
                
                // Mettre à jour la DB (seulement l'XP, pas le level !)
                for (const xpResult of xpGains) {
                    const newXP = xpResult.currentXP + xpResult.xpGained;
                    const newLevel = this.calculateLevel(newXP);
                    const oldLevel = xpResult.currentLevel;
                    
                    await pokemonCollection.updateOne(
                        { _id: xpResult.pokemonId },
                        { 
                            $set: { 
                                experience: newXP
                                // Le level sera calculé à la volée depuis l'XP
                            } 
                        }
                    );
                    
                    xpResult.newLevel = newLevel;
                    xpResult.leveledUp = newLevel > oldLevel;
                    
                    // 🆕 Mettre à jour le level ET l'XP dans battleState pour le client
                    const pokemon = participants.find(p => p._id.toString() === xpResult.pokemonId.toString());
                    if (pokemon) {
                        pokemon.level = newLevel;
                        pokemon.experience = newXP;
                        pokemon.experience = newXP;
                    }
                    
                    // 📚 Si level up, vérifier nouveaux moves disponibles
                    if (xpResult.leveledUp) {
                        const pokemon = participants.find(p => p._id.toString() === xpResult.pokemonId.toString());
                        if (pokemon) {
                            const newMoves = await this.databaseManager.getAvailableMovesAtLevel(
                                pokemon.species_id, 
                                newLevel
                            );
                            xpResult.newMovesAvailable = newMoves;
                        }
                    }
                    
                    console.log(`  - ${xpResult.pokemonName}: ${xpResult.currentXP} → ${newXP} XP${xpResult.leveledUp ? ` (Niv. ${newLevel}!)` : ''}`);
                    if (xpResult.newMovesAvailable && xpResult.newMovesAvailable.length > 0) {
                        console.log(`    → ${xpResult.newMovesAvailable.length} nouveau(x) move(s) disponible(s)`);
                    }
                }
            }

            // Update HP pour tous
            for (const pokemon of battleState.player_team) {
                if (pokemon._id) {
                    await pokemonCollection.updateOne(
                        { _id: pokemon._id },
                        { $set: { currentHP: pokemon.currentHP } }
                    );
                }
            }

            for (const pokemon of battleState.opponent_team) {
                if (pokemon._id) {
                    await pokemonCollection.updateOne(
                        { _id: pokemon._id },
                        { $set: { currentHP: pokemon.currentHP } }
                    );
                }
            }

            console.log('[Battle] HP et XP mis à jour en BDD');
            return xpGains;
            
        } catch (error) {
            console.error('[Battle] Erreur update HP/XP:', error);
            return [];
        }
    }

    /**
     * Calcule le niveau basé sur l'XP (formule medium-slow growth)
     */
    calculateLevel(experience) {
        // Formule medium-slow (la plus commune, ex: Bulbizarre, Carapuce, Salamèche)
        // Level = racine cubique((5 * XP) / 4)
        // Simplifié: on itère pour trouver le bon niveau
        
        for (let level = 1; level <= 100; level++) {
            const xpNeeded = Math.floor(1.2 * Math.pow(level, 3) - 15 * Math.pow(level, 2) + 100 * level - 140);
            if (experience < xpNeeded) {
                return level - 1;
            }
        }
        return 100; // Max level
    }

    /**
     * Ancienne méthode (conservée pour rétrocompatibilité)
     */
    async updatePokemonHP(battleState) {
        return this.updatePokemonHPAndXP(battleState, null, null);
    }

    /**
     * Tenter de capturer un Pokémon sauvage
     * @param {string} playerId - ID du joueur
     * @param {Object} wildPokemon - Pokémon sauvage
     * @param {string} ballType - Type de ball (poke-ball, great-ball, ultra-ball)
     * @returns {Promise<Object>} - Résultat de la capture
     */
    async attemptCapture(playerId, wildPokemon, ballType = 'poke-ball') {
        try {
            console.log('[PokemonBattleManager] Tentative de capture:', wildPokemon.species_name, 'avec', ballType);

            // Taux de ball
            const ballRates = {
                'poke-ball': 1.0,
                'great-ball': 1.5,
                'ultra-ball': 2.0,
                'master-ball': 255.0
            };

            const ballRate = ballRates[ballType] || 1.0;

            // Calculer la capture via BattleLogicManager
            const captureResult = this.battleLogicManager.calculateCapture(wildPokemon, ballRate);

            if (captureResult.captured) {
                // Créer le Pokémon capturé
                const playerObjectId = new ObjectId(playerId);
                const pokemonCollection = this.db.collection('pokemonPlayer');

                const capturedPokemon = {
                    player_id: playerObjectId,
                    species_id: wildPokemon.species_id,
                    species_name: wildPokemon.species_name,
                    nickname: null,
                    level: wildPokemon.level,
                    experience: Math.pow(wildPokemon.level, 3) * 0.8, // Medium-slow
                    currentHP: wildPokemon.currentHP,
                    maxHP: wildPokemon.maxHP,
                    attack: wildPokemon.attack,
                    defense: wildPokemon.defense,
                    speed: wildPokemon.speed,
                    moveset: wildPokemon.moveset || [],
                    originalTrainer: playerObjectId,
                    heldItem: null,
                    statusCondition: {
                        type: null,
                        turns: 0
                    }
                };

                const insertResult = await pokemonCollection.insertOne(capturedPokemon);

                console.log(`  → CAPTURÉ ! ID:`, insertResult.insertedId);

                return {
                    success: true,
                    captured: true,
                    shakes: captureResult.shakes,
                    pokemonId: insertResult.insertedId,
                    pokemon: { ...capturedPokemon, _id: insertResult.insertedId }
                };

            } else {
                console.log(`  → ÉCHAPPÉ après ${captureResult.shakes} secousse(s)`);

                return {
                    success: true,
                    captured: false,
                    shakes: captureResult.shakes
                };
            }

        } catch (error) {
            console.error('[PokemonBattleManager] Erreur attemptCapture:', error);
            throw error;
        }
    }
}

module.exports = PokemonBattleManager;
