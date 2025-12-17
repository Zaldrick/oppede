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
const spriteCacheManager = require('./SpriteCacheManager');
const PokemonEvolutionManager = require('./PokemonEvolutionManager');
const { pickFromEncounterTable } = require('./wildEncounterTables');

class PokemonBattleManager {
    constructor(databaseManager) {
        this.databaseManager = databaseManager;
        this.evolutionManager = new PokemonEvolutionManager(databaseManager);
        this.activeBattles = new Map(); // battleId -> PokemonBattleLogicManager instance
        console.log('[BattleManager] Initialisé');
    }

    toClientPokemonPayload(pokemon) {
        if (!pokemon) return null;

        // ✅ Le niveau des Pokémon sauvages/dresseur doit rester celui généré.
        // Les Pokémon du joueur (collection pokemonPlayer) utilisent l'XP comme source de vérité.
        const isPlayerOwned = !!pokemon.owner_id;
        const hasExperience = pokemon.experience !== undefined && pokemon.experience !== null;
        const resolvedLevel = (isPlayerOwned && hasExperience)
            ? this.calculateLevel(pokemon.experience)
            : (pokemon.level || 1);

        return {
            _id: pokemon._id || 'wild',
            species_id: pokemon.species_id,
            name: pokemon.nickname || pokemon.speciesData?.name_fr || pokemon.speciesData?.name,
            level: resolvedLevel,
            experience: pokemon.experience || 0,
            currentHP: pokemon.currentHP,
            maxHP: pokemon.stats?.maxHP,
            stats: pokemon.stats,
            types: pokemon.speciesData?.types,
            moveset: pokemon.moveset || [],
            sprites: pokemon.speciesData?.sprites
        };
    }

    /**
     * Distribue l'XP à chaque K.O. d'un Pokémon adverse.
     * Le tracking de participation est géré dans PokemonBattleLogicManager.
     */
    async awardXpForDefeatedOpponent(battleState, defeatedPokemon, playerId, battleId) {
        try {
            if (!defeatedPokemon) return [];
            const db = await this.databaseManager.connectToDatabase();
            const pokemonCollection = db.collection('pokemonPlayer');

            const battleLogic = this.activeBattles.get(battleId) || this.activeBattles.get(battleId.toString());

            // Résoudre la liste des participants depuis BattleLogic
            let participants = [];
            if (battleLogic) {
                const participantIds = battleLogic.getParticipants();
                participants = battleState.player_team.filter(p => p && p._id && participantIds.includes(p._id.toString()));
            }
            // Fallback: Pokémon actif uniquement
            if (!participants || participants.length === 0) {
                const activePokemon = battleState.player_team[battleState.player_active_index] || battleState.player_team[0];
                participants = [activePokemon].filter(p => p && p.currentHP > 0);
            }

            const xpGains = battleLogic
                ? battleLogic.calculateExperienceGain(defeatedPokemon, participants, playerId)
                : new PokemonBattleLogicManager().calculateExperienceGain(defeatedPokemon, participants, playerId);

            for (const xpResult of xpGains) {
                const newXP = (xpResult.currentXP || 0) + (xpResult.xpGained || 0);
                const newLevel = this.calculateLevel(newXP);
                const oldLevel = xpResult.currentLevel || 1;

                const pokemonId = typeof xpResult.pokemonId === 'string'
                    ? new ObjectId(xpResult.pokemonId)
                    : xpResult.pokemonId;

                await pokemonCollection.updateOne(
                    { _id: pokemonId },
                    { $set: { experience: newXP } }
                );

                xpResult.newLevel = newLevel;
                xpResult.leveledUp = newLevel > oldLevel;

                // Mettre à jour l'objet en mémoire (utile si le joueur switch plus tard)
                const pokemon = participants.find(p => p && p._id && p._id.toString() === xpResult.pokemonId.toString());
                if (pokemon) {
                    pokemon.experience = newXP;
                    pokemon.level = newLevel;
                }
            }

            return xpGains;
        } catch (e) {
            console.error('[Battle] Erreur awardXpForDefeatedOpponent:', e);
            return [];
        }
    }

    getNextAliveIndex(team, currentIndex) {
        if (!Array.isArray(team) || team.length === 0) return -1;
        for (let offset = 1; offset <= team.length; offset++) {
            const idx = (currentIndex + offset) % team.length;
            if (idx === currentIndex) continue;
            const mon = team[idx];
            if (mon && mon.currentHP > 0) return idx;
        }
        return -1;
    }

    /**
     * Configure les routes Express
     */
    setupRoutes(app) {
        console.log('[BattleManager] Configuration des routes...');

        // Démarrer un nouveau combat
        app.post('/api/battle/start', async (req, res) => {
            try {
                const { playerId, opponentId, battleType = 'wild', trainer, wildEncounter } = req.body;

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

                // Enrichir avec données d'espèce et calculer stats
                for (const pokemon of playerTeam) {
                    const speciesData = await this.getSpeciesData(pokemon.species_id);
                    pokemon.speciesData = speciesData;
                    pokemon.stats = this.calculateStats(pokemon, speciesData);
                }

                let opponentTeam;

                if (battleType === 'wild') {
                    // Générer un Pokémon sauvage
                    const wildMon = await this.generateWildPokemon(wildEncounter);
                    // Recalculer stats proprement pour wildMon
                    wildMon.stats = this.calculateStats(wildMon, wildMon.speciesData);
                    opponentTeam = [wildMon];
                } else if (battleType === 'trainer') {
                    const trainerId = trainer?.trainerId;
                    const trainerTeamSpec = trainer?.team;

                    if (!trainerId) {
                        return res.status(400).json({ error: 'trainer.trainerId requis pour combat de dresseur' });
                    }
                    if (!Array.isArray(trainerTeamSpec) || trainerTeamSpec.length === 0) {
                        return res.status(400).json({ error: 'trainer.team requis (array non vide) pour combat de dresseur' });
                    }

                    opponentTeam = [];
                    for (const member of trainerTeamSpec) {
                        const speciesId = member?.speciesId;
                        const level = member?.level;
                        if (!speciesId || !level) {
                            return res.status(400).json({ error: 'Chaque Pokémon du dresseur doit avoir speciesId et level' });
                        }

                        const trainerMon = await this.generateTrainerPokemon(speciesId, level);
                        trainerMon.stats = this.calculateStats(trainerMon, trainerMon.speciesData);
                        trainerMon.currentHP = trainerMon.stats.maxHP;
                        opponentTeam.push(trainerMon);
                    }
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
                        pokemon.stats = this.calculateStats(pokemon, speciesData);
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
                    trainer_npc: battleType === 'trainer' ? {
                        trainerId: trainer?.trainerId,
                        mapKey: trainer?.mapKey || null,
                        name: trainer?.name || null
                    } : null,
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
                        name: p.nickname || p.speciesData?.name_fr || p.speciesData?.name,
                        // Normalize level from experience to avoid mismatch issues
                        level: (p.experience !== undefined && p.experience !== null) ? this.calculateLevel(p.experience) : (p.level || 1),
                        experience: p.experience, // 🆕 ESSENTIEL pour calcul XP bar
                        currentHP: p.currentHP,
                        maxHP: p.stats.maxHP, // Utiliser la stat calculée
                        stats: p.stats, // 🆕 Envoyer les stats complètes
                        types: p.speciesData?.types,
                        moveset: p.moveset || [],
                        sprites: p.speciesData?.sprites
                    })),
                    opponentTeam: opponentTeam.map(p => ({
                        _id: p._id || 'wild',
                        species_id: p.species_id,
                        name: p.nickname || p.speciesData?.name_fr || p.speciesData?.name,
                        // ✅ Ne pas dériver le niveau des adversaires (wild/trainer) depuis experience=0
                        level: (battleType === 'pvp' && p.experience !== undefined && p.experience !== null)
                            ? this.calculateLevel(p.experience)
                            : (p.level || 1),
                        experience: p.experience || 0, // 🆕 Pour Pokémon sauvages
                        currentHP: p.currentHP,
                        maxHP: p.stats.maxHP, // Utiliser la stat calculée
                        stats: p.stats, // 🆕 Envoyer les stats complètes
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
                const battleLogic = this.activeBattles.get(battleId) || this.activeBattles.get(battleId.toString());
                if (!battleLogic) {
                    return res.status(404).json({ error: 'Combat introuvable en mémoire' });
                }

                const battleState = battleLogic.getBattleState();
                if (battleState.state !== 'ongoing') {
                    return res.status(400).json({ error: 'Combat terminé' });
                }

                // Pokémon actifs
                const playerPokemon = battleState.player_team[battleState.player_active_index];
                let opponentPokemon = battleState.opponent_team[battleState.opponent_active_index];

                // 🆕 Combat dresseur: si le Pokémon adverse actif est déjà K.O., envoyer le suivant automatiquement
                if (battleState.battle_type === 'trainer' && opponentPokemon && opponentPokemon.currentHP <= 0) {
                    const nextIdx = this.getNextAliveIndex(battleState.opponent_team, battleState.opponent_active_index);
                    if (nextIdx >= 0) {
                        try {
                            battleLogic.switchPokemon('opponent', nextIdx);
                        } catch (e) {
                            console.warn('[Battle] Auto-switch adverse (pre-turn) a échoué:', e.message);
                        }
                        opponentPokemon = battleState.opponent_team[battleState.opponent_active_index];
                    }
                }

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

                // ✅ Vérifier que les deux Pokémon sont vivants avant de générer les actions
                if (playerPokemon.currentHP <= 0) {
                    return res.status(400).json({ error: 'Le Pokémon du joueur est K.O.' });
                }
                if (!opponentPokemon || opponentPokemon.currentHP <= 0) {
                    return res.status(400).json({ error: 'Le Pokémon adverse est K.O.' });
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
            console.log('[Battle] AVANT attaque - Adversaire HP:', opponentPokemon.currentHP);
            playerResult = battleLogic.processTurn(playerPokemon, opponentPokemon, playerMove, 'player');
            console.log('[Battle] Résultat joueur:', playerResult);
            console.log('[Battle] APRÈS attaque - Adversaire HP:', opponentPokemon.currentHP);
            
            // ✅ Si l'adversaire n'est pas KO après l'attaque, il contre-attaque
            if (opponentPokemon.currentHP > 0) {
                console.log('[Battle] Adversaire contre-attaque avec', opponentMove.name);
                opponentResult = battleLogic.processTurn(opponentPokemon, playerPokemon, opponentMove, 'opponent');
                console.log('[Battle] Résultat adversaire:', opponentResult);
            } else {
                console.log('[Battle] ✅ Adversaire K.O., ne peut pas contre-attaquer');
                // Créer un résultat vide pour ne pas casser l'UI
                opponentResult = {
                    attacker: opponentPokemon.nickname || opponentPokemon.speciesData?.name,
                    defender: playerPokemon.nickname || playerPokemon.speciesData?.name,
                    move: opponentMove.name,
                    damage: 0,
                    missed: true,
                    defenderHP: playerPokemon.currentHP,
                    defenderKO: false,
                    message: `${opponentPokemon.nickname || opponentPokemon.speciesData?.name} est K.O. et ne peut pas attaquer!`
                };
            }
            } else {
            // Adversaire attaque en premier
            console.log('[Battle] Adversaire attaque avec', opponentMove.name);
            opponentResult = battleLogic.processTurn(opponentPokemon, playerPokemon, opponentMove, 'opponent');
            console.log('[Battle] Résultat adversaire:', opponentResult);
            
            // ✅ Si le joueur n'est pas KO après l'attaque, il contre-attaque
            if (playerPokemon.currentHP > 0) {
                console.log('[Battle] Joueur contre-attaque avec', playerMove.name);
                playerResult = battleLogic.processTurn(playerPokemon, opponentPokemon, playerMove, 'player');
                console.log('[Battle] Résultat joueur:', playerResult);
            } else {
                console.log('[Battle] ✅ Joueur K.O., ne peut pas contre-attaquer');
                // Créer un résultat vide pour ne pas casser l'UI
                playerResult = {
                    attacker: playerPokemon.nickname || playerPokemon.speciesData?.name,
                    defender: opponentPokemon.nickname || opponentPokemon.speciesData?.name,
                    move: playerMove.name,
                    damage: 0,
                    missed: true,
                    defenderHP: opponentPokemon.currentHP,
                    defenderKO: false,
                    message: `${playerPokemon.nickname || playerPokemon.speciesData?.name} est K.O. et ne peut pas attaquer!`
                };
            }
                }

                // Vérifier fin de combat
                const battleEnd = battleLogic.isBattleOver();

                // 🆕 Distribuer l'XP à chaque K.O. adverse (et pas uniquement à la fin)
                let xpGains = [];
                const opponentJustFainted = opponentPokemon && opponentPokemon.currentHP <= 0;
                const playerStillAlive = playerPokemon && playerPokemon.currentHP > 0;
                if (opponentJustFainted && playerStillAlive && (battleState.battle_type === 'wild' || battleState.battle_type === 'trainer')) {
                    // Note: en combat dresseur, on donne l'XP à chaque K.O. (pas seulement à la fin).
                    xpGains = await this.awardXpForDefeatedOpponent(battleState, opponentPokemon, playerId, battleId);
                }

                // 🆕 Combat dresseur: si l'adversaire est K.O. mais le combat continue, envoyer le prochain Pokémon
                let opponentSwitched = false;
                let newOpponentActiveIndex = null;
                let newOpponentActive = null;
                if (!battleEnd.isOver && battleState.battle_type === 'trainer') {
                    const currentOpp = battleState.opponent_team[battleState.opponent_active_index];
                    if (currentOpp && currentOpp.currentHP <= 0) {
                        const nextIdx = this.getNextAliveIndex(battleState.opponent_team, battleState.opponent_active_index);
                        if (nextIdx >= 0) {
                            try {
                                battleLogic.switchPokemon('opponent', nextIdx);
                                opponentSwitched = true;
                                newOpponentActiveIndex = battleState.opponent_active_index;
                                newOpponentActive = this.toClientPokemonPayload(battleState.opponent_team[battleState.opponent_active_index]);

                                // ✅ Reset participation pour le nouveau Pokémon adverse (seulement le Pokémon joueur présent au moment de l'envoi)
                                battleLogic.resetParticipantsForNewOpponent(battleState.player_team[battleState.player_active_index]);
                            } catch (e) {
                                console.warn('[Battle] Auto-switch adverse (post-turn) a échoué:', e.message);
                            }
                        }
                    }
                }

                // Sauvegarder en BDD (réutiliser la connexion db existante)
                const battlesCollection2 = db.collection('battles');

                await battlesCollection2.updateOne(
                    { _id: new ObjectId(battleId) },
                    {
                        $set: {
                            turn_count: battleState.turn_count,
                            battle_log: battleState.battle_log,
                            state: battleState.state,
                            player_active_index: battleState.player_active_index,
                            opponent_active_index: battleState.opponent_active_index,
                            updated_at: new Date()
                        }
                    }
                );

                // Si combat terminé, update HP et distribuer XP
                if (battleEnd.isOver) {
                    console.log('[Battle] ✅ Combat terminé, winner:', battleEnd.winner);

                    // ✅ L'XP est déjà distribuée au moment du K.O. final via awardXpForDefeatedOpponent.
                    // Ici on persiste seulement les HP.
                    await this.updatePokemonHPAndXP(battleState, null, playerId, battleId);
                    console.log('[Battle] ✅ HP persistés (XP déjà traitée sur K.O.)');
                    this.activeBattles.delete(battleId);
                    
                    // Retourner aussi les gains XP
                    const response = {
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
                    };
                    console.log('[Battle] ✅ Réponse envoyée au client:', JSON.stringify(response, null, 2));
                    return res.json(response);
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
                    state: battleState.state,
                    opponentSwitched,
                    newOpponentActiveIndex,
                    newOpponentActive,
                    xpGains
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

                const battleDoc = await battlesCollection.findOne({ _id: new ObjectId(battleId) });
                if (!battleDoc) {
                    return res.status(404).json({ error: 'Combat introuvable' });
                }

                await battlesCollection.updateOne(
                    { _id: new ObjectId(battleId) },
                    {
                        $set: {
                            state: winner === 'player' ? 'player_won' : 'opponent_won',
                            ended_at: new Date()
                        }
                    }
                );

                // Si c'est un combat de dresseur et que le joueur gagne, marquer le PNJ comme battu (par joueur)
                try {
                    if (winner === 'player' && battleDoc.battle_type === 'trainer' && battleDoc.trainer_npc?.trainerId) {
                        await db.collection('trainerNpcDefeats').updateOne(
                            {
                                player_id: battleDoc.player_id,
                                trainerId: battleDoc.trainer_npc.trainerId
                            },
                            {
                                $set: {
                                    player_id: battleDoc.player_id,
                                    trainerId: battleDoc.trainer_npc.trainerId,
                                    mapKey: battleDoc.trainer_npc.mapKey || null,
                                    defeated_at: new Date()
                                }
                            },
                            { upsert: true }
                        );
                    }
                } catch (e) {
                    console.warn('[Battle] Impossible d\'enregistrer trainerNpcDefeat:', e);
                }

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
                const battleLogic = this.activeBattles.get(battleId) || this.activeBattles.get(battleId.toString());
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
                const captureResult = await this.attemptCapture(playerId, wildPokemon, ballType, battleLogic);

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
                const battleLogic = this.activeBattles.get(battleId) || this.activeBattles.get(battleId.toString());
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

        // 🆕 Route de fuite
        app.post('/api/battle/flee', async (req, res) => {
            try {
                const { battleId, playerId } = req.body;

                if (!battleId || !playerId) {
                    return res.status(400).json({ error: 'battleId et playerId requis' });
                }

                console.log(`[Battle] Fuite du combat ${battleId} par joueur ${playerId}`);

                const db = await this.databaseManager.connectToDatabase();
                const battlesCollection = db.collection('battles');

                // Récupérer l'état du combat
                const battleLogic = this.activeBattles.get(battleId) || this.activeBattles.get(battleId.toString());
                if (battleLogic) {
                    const battleState = battleLogic.getBattleState();
                    
                    // Sauvegarder les HP actuels
                    await this.updatePokemonHPAndXP(battleState, null, playerId, battleId);
                    
                    // Supprimer de la mémoire
                    this.activeBattles.delete(battleId);
                }

                // Mettre à jour le statut du combat
                await battlesCollection.updateOne(
                    { _id: new ObjectId(battleId) },
                    {
                        $set: {
                            state: 'fled',
                            ended_at: new Date()
                        }
                    }
                );

                res.json({ success: true, message: 'Fuite réussie' });

            } catch (error) {
                console.error('[Battle] Erreur fuite:', error);
                res.status(500).json({ error: 'Erreur serveur' });
            }
        });

        console.log('[BattleManager] Routes configurées');
    }

    /**
     * Récupère les données d'une espèce (types, sprites, stats)
     */
    async getSpeciesData(speciesId) {
        try {
            // 👾 Essayer de récupérer depuis le cache d'abord
            const cachedSprites = spriteCacheManager.getSprites(speciesId);
            if (cachedSprites) {
                console.log(`[Battle] ✅ Sprites #${speciesId} depuis cache serveur (évite PokeAPI)`);
            }
            
            const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}`);
            const data = await response.json();

            // 🆕 Récupérer les données d'espèce (capture rate, noms fr, etc.)
            let captureRate = 45;
            try {
                const speciesResponse = await fetch(data.species.url);
                const speciesDetails = await speciesResponse.json();
                captureRate = speciesDetails.capture_rate;
            } catch (e) {
                console.warn(`[Battle] Impossible de récupérer species data pour ${speciesId}, capture_rate par défaut (45)`);
            }
            
            const sprites = cachedSprites || {
                menu: data.sprites.versions?.['generation-vii']?.icons?.front_default,
                frontCombat: data.sprites.versions?.['generation-v']?.['black-white']?.animated?.front_default || data.sprites.front_default,
                backCombat: data.sprites.versions?.['generation-v']?.['black-white']?.animated?.back_default || data.sprites.back_default
            };
            
            // ✨ Mettre en cache si pas déjà fait
            if (!cachedSprites) {
                spriteCacheManager.setSprites(speciesId, sprites);
            }
            const nameFr = (this.translationManager && typeof this.translationManager.getPokemonNameFR === 'function') ? await this.translationManager.getPokemonNameFR(speciesId) : null;
            return {
                name: data.name,
                name_fr: nameFr || null,
                capture_rate: captureRate, // 🆕 Taux de capture correct
                base_experience: data.base_experience || 50, // 🆕 XP de base pour calcul gains XP
                types: data.types.map(t => t.type.name),
                sprites,
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
    async generateWildPokemon(wildEncounter = null) {
        // Si une table est fournie (via zone Tiled), piocher dedans.
        const tableId = wildEncounter?.encounterTableId;
        const picked = tableId ? pickFromEncounterTable(tableId) : null;

        // Fallback: Liste de Pokémon sauvages communs (Gen I)
        const fallbackSpecies = [16, 19, 21, 23, 41, 43, 46, 60, 63, 69]; // Pidgey, Rattata, Spearow, etc.
        const fallbackSpeciesId = fallbackSpecies[Math.floor(Math.random() * fallbackSpecies.length)];

        const speciesId = Number.isFinite(Number(picked?.speciesId)) ? Number(picked.speciesId) : fallbackSpeciesId;
        const minLevel = Number.isFinite(Number(picked?.minLevel)) ? Number(picked.minLevel) : 3;
        const maxLevel = Number.isFinite(Number(picked?.maxLevel)) ? Number(picked.maxLevel) : 7;
        const resolvedMax = Math.max(minLevel, maxLevel);
        const level = minLevel + Math.floor(Math.random() * (resolvedMax - minLevel + 1));

        const speciesData = await this.getSpeciesData(speciesId);

        // Calculer HP max
        const baseHP = speciesData.stats.hp;
        const maxHP = Math.floor(((2 * baseHP + 15) * level) / 100) + level + 10;

        return {
            species_id: speciesId,
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
     * Génère un Pokémon dresseur (espèce + niveau imposés)
     */
    async generateTrainerPokemon(speciesId, level) {
        const numericSpeciesId = parseInt(speciesId);
        const numericLevel = parseInt(level);

        const speciesData = await this.getSpeciesData(numericSpeciesId);
        if (!speciesData) {
            throw new Error(`Species introuvable pour speciesId=${speciesId}`);
        }

        return {
            species_id: numericSpeciesId,
            nickname: null,
            level: numericLevel,
            currentHP: 1, // sera recalculé après calculateStats
            maxHP: 1,
            experience: 0,
            ivs: {
                hp: 15, attack: 15, defense: 15,
                sp_attack: 15, sp_defense: 15, speed: 15
            },
            evs: { hp: 0, attack: 0, defense: 0, sp_attack: 0, sp_defense: 0, speed: 0 },
            nature: 'Hardy',
            // Moveset simple (placeholder) pour que le combat fonctionne sans dépendre de la DB de moves
            moveset: [
                { name: 'Charge', type: 'normal', category: 'physical', power: 40, accuracy: 100, pp: 35 },
                { name: "Groz'Yeux", type: 'normal', category: 'status', power: 0, accuracy: 100, pp: 30 },
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
     * @param {string} battleId - ID du combat (pour récupérer le BattleLogic)
     */
    async updatePokemonHPAndXP(battleState, winner, playerId, battleId) {
        try {
            const db = await this.databaseManager.connectToDatabase();
            const pokemonCollection = db.collection('pokemonPlayer');

            let xpGains = [];

            // Si le joueur a gagné, distribuer XP
            if (winner === 'player') {
                console.log('[Battle] ✅✅✅ Victoire joueur - Distribution XP ✅✅✅');
                
                // Récupérer le Pokémon vaincu (premier adversaire, car combat sauvage = 1 seul)
                const defeatedPokemon = battleState.opponent_team[0];
                console.log('[Battle] Pokémon vaincu:', defeatedPokemon.nickname || defeatedPokemon.speciesData?.name, 'Lvl', defeatedPokemon.level);
                
                // Récupérer le BattleLogicManager pour avoir les vrais participants
                // console.log('[Battle] Recherche BattleLogic avec clé:', battleId);
                
                // 🔧 FIXE: Déclarer participants avant le bloc pour qu'il soit accessible partout
                let participants = [];
                
                // 🔧 FIXE: Récupérer les participants via BattleLogic (track tous les Pokémon utilisés)
                const battleLogic = this.activeBattles.get(battleId) || this.activeBattles.get(battleId.toString());
                
                if (!battleLogic) {
                    // console.error('[Battle] ⚠️ BattleLogic non trouvé! Fallback sur Pokémon actif uniquement');
                    // Fallback: seulement le Pokémon actif
                    // Correct fallback: activePokemon is at player_active_index (it's an index, not an ID)
                    const activePokemon = battleState.player_team[battleState.player_active_index] || battleState.player_team[0];
                    
                    participants = [activePokemon].filter(p => p && p.currentHP > 0);
                    xpGains = new PokemonBattleLogicManager().calculateExperienceGain(defeatedPokemon, participants, playerId);
                } else {
                    // Récupérer les IDs des participants depuis BattleLogic
                    const participantIds = battleLogic.getParticipants();
                    console.log(`[Battle] Debug: participantIds from BattleLogic: ${JSON.stringify(participantIds)}`);
                    // console.log('[Battle] Participants trackés:', participantIds);
                    
                    // Filtrer l'équipe pour ne garder que les participants
                    participants = battleState.player_team.filter(p => {
                        const hasId = !!p._id;
                        const idStr = hasId ? p._id.toString() : null;
                        const included = idStr ? participantIds.includes(idStr) : false;
                        return hasId && included;
                    });
                    console.log(`[Battle] Debug: participants resolved from battleState: ${participants.map(p => ({id: p._id ? p._id.toString() : null, name: p.nickname || p.speciesData?.name, currentHP: p.currentHP}))}`);
                    // Fallback: If participant tracking failed (empty array), fall back to active Pokémon
                    if (!participants || participants.length === 0) {
                        console.warn('[Battle] ⚠️ Aucun participant tracké ! Utilisation fallback: Pokémon actif');
                        const activePokemon = battleState.player_team[battleState.player_active_index] || battleState.player_team[0];
                        participants = [activePokemon].filter(p => p && p.currentHP > 0);
                    }
                    console.log(`[Battle] Debug: participants resolved from battleState: ${participants.map(p => ({id: p._id ? p._id.toString() : null, name: p.nickname || p.speciesData?.name, currentHP: p.currentHP}))}`);
                    
                    // console.log(`[Battle] Distribution XP à ${participants.length} Pokémon:`, participants.map(p => p.nickname || p.speciesData?.name));
                    
                    // Calculer XP pour tous les participants
                    xpGains = battleLogic.calculateExperienceGain(defeatedPokemon, participants, playerId);
                    console.log(`[Battle] Debug: XP results raw (before DB updates): ${JSON.stringify(xpGains)}`);
                }
                
                // Mettre à jour la DB (seulement l'XP, pas le level !)
                for (const xpResult of xpGains) {
                    const newXP = xpResult.currentXP + xpResult.xpGained;
                    const newLevel = this.calculateLevel(newXP);
                    const oldLevel = xpResult.currentLevel;
                    
                    // Convertir l'ID en ObjectId si nécessaire
                    const pokemonId = typeof xpResult.pokemonId === 'string' 
                        ? new ObjectId(xpResult.pokemonId) 
                        : xpResult.pokemonId;
                    
                    await pokemonCollection.updateOne(
                        { _id: pokemonId },
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
                        
                        // 🆕 Recalculer MaxHP si niveau gagné
                        if (xpResult.leveledUp && pokemon.speciesData && pokemon.speciesData.stats) {
                            const baseHP = pokemon.speciesData.stats.hp || 45;
                            const ivHP = pokemon.ivs?.hp || 0;
                            const evHP = pokemon.evs?.hp || 0;
                            
                            // Formule HP
                            const newMaxHP = Math.floor(((2 * baseHP + ivHP + Math.floor(evHP / 4)) * newLevel) / 100) + newLevel + 10;
                            
                            // Mettre à jour en BDD
                            await pokemonCollection.updateOne(
                                { _id: pokemonId },
                                { $set: { maxHP: newMaxHP } }
                            );
                            
                            // Mettre à jour l'objet en mémoire
                            pokemon.maxHP = newMaxHP;
                            // Soigner le gain de PV (optionnel, mais sympa)
                            // pokemon.currentHP += (newMaxHP - oldMaxHP);
                            
                            console.log(`  → Level Up! MaxHP: ${newMaxHP} (Base: ${baseHP})`);
                        }
                    }
                    
                    // 📚 Vérifier nouveaux moves disponibles
                    if (xpResult.leveledUp) {
                        // Vérifier pour chaque niveau gagné (au cas où +2 niveaux d'un coup)
                        xpResult.newMovesAvailable = [];
                        
                        for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
                            // Use the PokemonDatabaseManager if available, otherwise fallback to databaseManager (deprecated)
                            const movesAtLevel = this.pokemonDatabaseManager
                                ? await this.pokemonDatabaseManager.getAvailableMovesAtLevel(pokemon.species_id, lvl)
                                : await this.databaseManager.getAvailableMovesAtLevel(pokemon.species_id, lvl);
                            if (movesAtLevel && movesAtLevel.length > 0) {
                                    xpResult.newMovesAvailable.push(...movesAtLevel);
                                }
                        }
                        // Filtrer les moves déjà 'offered' (comme ignorés précédemment) et dedupe
                        try {
                            const existingPokemon = await pokemonCollection.findOne({ _id: new ObjectId(xpResult.pokemonId) });
                            let learnedMoves = existingPokemon && existingPokemon.move_learned ? existingPokemon.move_learned.map(m => (typeof m === 'string' ? m : (m.name || m))) : [];
                            // Defensive: remove any moves that correspond to learn levels higher than the current pokemon level
                            try {
                                const allowedMoves = this.pokemonDatabaseManager
                                    ? await this.pokemonDatabaseManager.getAllLearnableMoves(existingPokemon.species_id, existingPokemon.level)
                                    : await this.databaseManager.getAllLearnableMoves(existingPokemon.species_id, existingPokemon.level);
                                const allowedNames = new Set(allowedMoves.map(m => m.name));
                                learnedMoves = learnedMoves.filter(n => allowedNames.has(n));
                            } catch (err) {
                                // ignore any fetch issue; fallback to raw learnedMoves
                            }
                            if (learnedMoves.length > 0) {
                                const learnedSet = new Set(learnedMoves);
                                xpResult.newMovesAvailable = xpResult.newMovesAvailable.filter(m => !learnedSet.has(m.name));
                            }
                            // Dedupe by name to avoid multiple identical entries (e.g. moves repeated across versions)
                            const seenNames = new Set();
                            xpResult.newMovesAvailable = xpResult.newMovesAvailable.filter(m => {
                                if (!m || !m.name) return false;
                                if (seenNames.has(m.name)) return false;
                                seenNames.add(m.name);
                                return true;
                            });
                            // Do NOT persist offered moves here; persistence occurs on client action via the mark/learn endpoints.
                        } catch (err) {
                            console.warn('[Battle] Échec filtration learnedMoves:', err.message);
                        }
                    } else {
                        xpResult.newMovesAvailable = [];
                    }
                    
                    // 🧬 Vérifier l'évolution
                    // 🔧 FIXE: Vérifier l'évolution MÊME SI pas de level up (cas où le Pokémon a déjà le niveau requis mais n'a pas évolué)
                    // On vérifie si le niveau actuel est suffisant pour évoluer
                    const pokemonForEvo = participants.find(p => p._id.toString() === xpResult.pokemonId.toString());
                    if (pokemonForEvo) {
                        // Mettre à jour le niveau temporairement pour la vérification
                        const tempPokemon = { ...pokemonForEvo, level: newLevel };
                        console.log(`[Battle] Vérification évolution pour ${pokemonForEvo.nickname} (Lvl ${newLevel})`);
                        
                        // On passe 'level-up' comme trigger, même si le niveau n'a pas changé ce tour-ci,
                        // car on veut vérifier si le niveau actuel permet l'évolution
                        const evolutionCheck = await this.evolutionManager.checkEvolution(tempPokemon, 'level-up', newLevel);
                        
                        // 🆕 DEBUG: Toujours renvoyer le résultat du check au client pour comprendre ce qui se passe
                        xpResult.evolutionCheckDebug = evolutionCheck;

                        if (evolutionCheck.canEvolve) {
                            console.log(`[Battle] 🧬 Évolution disponible pour ${pokemonForEvo.nickname}: ${evolutionCheck.targetSpeciesName}`);
                            xpResult.evolution = evolutionCheck;
                        } else {
                            console.log(`[Battle] Pas d'évolution pour ${pokemonForEvo.nickname} (Raison: ${evolutionCheck.error || 'Conditions non remplies'})`);
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
                    const pokemonId = typeof pokemon._id === 'string' 
                        ? new ObjectId(pokemon._id) 
                        : pokemon._id;
                    
                    await pokemonCollection.updateOne(
                        { _id: pokemonId },
                        { $set: { currentHP: pokemon.currentHP } }
                    );
                }
            }

            for (const pokemon of battleState.opponent_team) {
                if (pokemon._id) {
                    const pokemonId = typeof pokemon._id === 'string' 
                        ? new ObjectId(pokemon._id) 
                        : pokemon._id;
                    
                    await pokemonCollection.updateOne(
                        { _id: pokemonId },
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
        return this.updatePokemonHPAndXP(battleState, null, null, null);
    }

    /**
     * Tenter de capturer un Pokémon sauvage
     * @param {string} playerId - ID du joueur
     * @param {Object} wildPokemon - Pokémon sauvage
     * @param {string} ballType - Type de ball (poke-ball, great-ball, ultra-ball)
     * @param {Object} battleLogic - Instance de PokemonBattleLogicManager
     * @returns {Promise<Object>} - Résultat de la capture
     */
    async attemptCapture(playerId, wildPokemon, ballType = 'poke-ball', battleLogic) {
        try {
            console.log('[PokemonBattleManager] Tentative de capture:', wildPokemon.species_name, 'avec', ballType);

            // Taux de ball
            const ballRates = {
                'poke-ball': 1.0,
                'great-ball': 1.5,
                'ultra-ball': 2.0,
                'master-ball': 255.0,
                // Mapping noms français
                'Poké Ball': 1.0,
                'Super Ball': 1.5,
                'Hyper Ball': 2.0,
                'Master Ball': 255.0
            };

            const ballRate = ballRates[ballType] || 1.0;

            // Calculer la capture via BattleLogicManager
            // Si battleLogic n'est pas fourni, on en crée un temporaire (pour tests hors combat)
            const logic = battleLogic || new PokemonBattleLogicManager();
            const captureResult = logic.calculateCapture(wildPokemon, ballRate);

            if (captureResult.captured) {
                // Créer le Pokémon capturé
                const playerObjectId = new ObjectId(playerId);
                const db = await this.databaseManager.connectToDatabase();
                const pokemonCollection = db.collection('pokemonPlayer');

                // 🆕 Logique de position (équipe vs PC)
                // Récupérer les positions occupées
                const existingPokemon = await pokemonCollection.find(
                    { owner_id: playerObjectId }
                ).project({ position: 1 }).toArray();

                const occupiedPositions = new Set(existingPokemon.map(p => p.position).filter(p => p));
                
                // Trouver la première position libre (1, 2, 3...)
                let newPosition = 1;
                while (occupiedPositions.has(newPosition)) {
                    newPosition++;
                }

                console.log(`[Capture] Nouvelle position assignée: ${newPosition} (Occupées: ${Array.from(occupiedPositions).join(', ')})`);

                const capturedPokemon = {
                    owner_id: playerObjectId, // Clé principale pour les requêtes
                    player_id: playerObjectId, // Gardé pour compatibilité
                    species_id: wildPokemon.species_id,
                    species_name: wildPokemon.speciesData?.name || wildPokemon.species_name, // Fallback
                    nickname: null,
                    level: wildPokemon.level,
                    experience: Math.pow(wildPokemon.level, 3) * 0.8, // Medium-slow
                    currentHP: wildPokemon.currentHP,
                    maxHP: wildPokemon.maxHP,
                    attack: wildPokemon.stats?.attack || wildPokemon.attack,
                    defense: wildPokemon.stats?.defense || wildPokemon.defense,
                    speed: wildPokemon.stats?.speed || wildPokemon.speed,
                    moveset: wildPokemon.moveset || [],
                    originalTrainer: playerObjectId,
                    heldItem: null,
                    statusCondition: {
                        type: null,
                        turns: 0
                    },
                    position: newPosition, // 🆕 Position 1-6 (équipe) ou 7+ (PC)
                    teamPosition: newPosition - 1, // 🆕 Position 0-5 (interne)
                    capturedAt: new Date()
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

    /**
     * Calcule les statistiques réelles d'un Pokémon
     */
    calculateStats(pokemon, speciesData) {
        let level = pokemon.level;
        
        // Si niveau manquant ou invalide, essayer de calculer depuis l'XP
        if (!level || isNaN(level)) {
            if (pokemon.experience) {
                level = this.calculateLevel(pokemon.experience);
            } else {
                level = 1;
            }
        }
        
        // S'assurer que c'est un nombre
        level = parseInt(level);
        
        const ivs = pokemon.ivs || { hp: 0, attack: 0, defense: 0, sp_attack: 0, sp_defense: 0, speed: 0 };
        const evs = pokemon.evs || { hp: 0, attack: 0, defense: 0, sp_attack: 0, sp_defense: 0, speed: 0 };
        const nature = pokemon.nature || 'Hardy'; // TODO: Implémenter les multiplicateurs de nature
        
        const stats = {};
        const statNames = ['hp', 'attack', 'defense', 'sp_attack', 'sp_defense', 'speed'];
        
        // Mapping noms API -> noms internes
        const apiToInternal = {
            'hp': 'hp',
            'attack': 'attack',
            'defense': 'defense',
            'special-attack': 'sp_attack',
            'special-defense': 'sp_defense',
            'speed': 'speed'
        };

        // Récupérer les base stats depuis speciesData
        const baseStats = {};
        if (speciesData) {
            if (Array.isArray(speciesData.stats)) {
                // Format PokeAPI array
                speciesData.stats.forEach(s => {
                    const name = apiToInternal[s.stat.name];
                    if (name) baseStats[name] = s.base_stat;
                });
            } else if (speciesData.stats) {
                // Format interne object
                Object.assign(baseStats, speciesData.stats);
            }
        }

        // Calcul HP
        // Formule: ((2 * Base + IV + (EV/4)) * Level / 100) + Level + 10
        const hpBase = baseStats.hp || 45;
        const hpIV = ivs.hp || 0;
        const hpEV = evs.hp || 0;
        stats.maxHP = Math.floor(((2 * hpBase + hpIV + Math.floor(hpEV / 4)) * level) / 100) + level + 10;
        stats.hp = stats.maxHP; // Alias pour compatibilité

        // Calcul autres stats
        // Formule: (((2 * Base + IV + (EV/4)) * Level / 100) + 5) * Nature
        const otherStats = ['attack', 'defense', 'sp_attack', 'sp_defense', 'speed'];
        otherStats.forEach(stat => {
            const base = baseStats[stat] || 50;
            const iv = ivs[stat] || 0;
            const ev = evs[stat] || 0;
            
            let val = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;
            
            // TODO: Appliquer nature
            
            stats[stat] = val;
        });
        
        // Debug pour comprendre pourquoi 39/12
        if (stats.maxHP < pokemon.currentHP) {
            console.warn(`[Stats] Incohérence HP pour ${pokemon.nickname || 'Pokemon'}: Current ${pokemon.currentHP} > Max ${stats.maxHP}`);
            console.warn(`[Stats] Debug: Level=${level} (DB=${pokemon.level}), BaseHP=${hpBase}, IV=${hpIV}, EV=${hpEV}`);
            // Force update level in object for display
            pokemon.level = level;
        }

        return stats;
    }
}

module.exports = PokemonBattleManager;
