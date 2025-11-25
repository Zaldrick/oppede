const { calculateStat, calculateMaxHP } = require('../utils/pokemonStats');

// Table d'efficacité des types (copie serveur pour éviter import ES6)
function getTypeEffectiveness(attackType, defenseTypes) {
    const TYPE_CHART = {
        normal: { rock: 0.5, ghost: 0, steel: 0.5 },
        fire: { fire: 0.5, water: 0.5, grass: 2.0, ice: 2.0, bug: 2.0, rock: 0.5, dragon: 0.5, steel: 2.0 },
        water: { fire: 2.0, water: 0.5, grass: 0.5, ground: 2.0, rock: 2.0, dragon: 0.5 },
        electric: { water: 2.0, electric: 0.5, grass: 0.5, ground: 0, flying: 2.0, dragon: 0.5 },
        grass: { fire: 0.5, water: 2.0, grass: 0.5, poison: 0.5, ground: 2.0, flying: 0.5, bug: 0.5, rock: 2.0, dragon: 0.5, steel: 0.5 },
        ice: { fire: 0.5, water: 0.5, grass: 2.0, ice: 0.5, ground: 2.0, flying: 2.0, dragon: 2.0, steel: 0.5 },
        fighting: { normal: 2.0, ice: 2.0, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2.0, ghost: 0, dark: 2.0, steel: 2.0, fairy: 0.5 },
        poison: { grass: 2.0, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2.0 },
        ground: { fire: 2.0, electric: 2.0, grass: 0.5, poison: 2.0, flying: 0, bug: 0.5, rock: 2.0, steel: 2.0 },
        flying: { electric: 0.5, grass: 2.0, fighting: 2.0, bug: 2.0, rock: 0.5, steel: 0.5 },
        psychic: { fighting: 2.0, poison: 2.0, psychic: 0.5, dark: 0, steel: 0.5 },
        bug: { fire: 0.5, grass: 2.0, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2.0, ghost: 0.5, dark: 2.0, steel: 0.5, fairy: 0.5 },
        rock: { fire: 2.0, ice: 2.0, fighting: 0.5, ground: 0.5, flying: 2.0, bug: 2.0, steel: 0.5 },
        ghost: { normal: 0, psychic: 2.0, ghost: 2.0, dark: 0.5 },
        dragon: { dragon: 2.0, steel: 0.5, fairy: 0 },
        dark: { fighting: 0.5, psychic: 2.0, ghost: 2.0, dark: 0.5, fairy: 0.5 },
        steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2.0, rock: 2.0, steel: 0.5, fairy: 2.0 },
        fairy: { fire: 0.5, fighting: 2.0, poison: 0.5, dragon: 2.0, dark: 2.0, steel: 0.5 }
    };

    if (!attackType || !defenseTypes) return 1.0;
    const attackTypeLower = attackType.toLowerCase();
    const defenseTypesArray = Array.isArray(defenseTypes) ? defenseTypes : [defenseTypes];
    if (!TYPE_CHART[attackTypeLower]) return 1.0;

    let effectiveness = 1.0;
    for (const defenseType of defenseTypesArray) {
        const defenseTypeLower = defenseType.toLowerCase();
        effectiveness *= (TYPE_CHART[attackTypeLower][defenseTypeLower] ?? 1.0);
    }
    return effectiveness;
}

class PokemonBattleLogicManager {
    constructor() {
        this.battleState = null;
        this.participants = new Set(); // 🆕 Tracker les Pokémon qui ont participé
    }

    // Utilitaire pour récupérer le nom à afficher (préférence FR)
    getDisplayName(pokemon) {
        if (!pokemon) return 'Unknown';
        return pokemon.nickname || pokemon.speciesData?.name_fr || pokemon.speciesData?.name || pokemon.species_name_fr || pokemon.species_name || (pokemon._id ? pokemon._id.toString() : 'Pokemon');
    }

    /**
     * Initialise un nouveau combat
     * @param {Array} playerTeam - Équipe du joueur (6 Pokémon max)
     * @param {Array} opponentTeam - Équipe adverse (ou Pokémon sauvage)
     * @param {string} battleType - "wild" ou "pvp"
     * @returns {Object} - État initial du combat
     */
    initializeBattle(playerTeam, opponentTeam, battleType = 'wild') {
        console.log('[BattleLogic] Initialisation combat:', battleType);
        
        // Réinitialiser les participants
        this.participants = new Set();

        // ✅ NE PAS filtrer les Pokémon K.O. - garder l'équipe complète pour que les index correspondent
        // Le client envoie tous les Pokémon (positions 1-6), on doit garder le même array
        if (playerTeam.length === 0 || opponentTeam.length === 0) {
            throw new Error('Équipe invalide: aucun Pokémon');
        }

        // Vérifier qu'il y a au moins un Pokémon valide
        const hasValidPlayer = playerTeam.some(p => p.currentHP > 0);
        const hasValidOpponent = opponentTeam.some(p => p.currentHP > 0);
        
        if (!hasValidPlayer || !hasValidOpponent) {
            throw new Error('Équipe invalide: tous les Pokémon sont KO');
        }

        // Trouver le premier Pokémon non-KO en position 1, sinon le suivant
        const findFirstValidPokemon = (team) => {
            // D'abord chercher position 1
            let firstPokemon = team.find(p => p.position === 1 && p.currentHP > 0);
            if (firstPokemon) return team.indexOf(firstPokemon);

            // Sinon chercher le premier avec currentHP > 0
            for (let i = 0; i < team.length; i++) {
                if (team[i].currentHP > 0) return i;
            }
            return 0; // Fallback
        };

        const playerActiveIndex = findFirstValidPokemon(playerTeam);
        const opponentActiveIndex = findFirstValidPokemon(opponentTeam);

        const playerActive = playerTeam[playerActiveIndex];
        const opponentActive = opponentTeam[opponentActiveIndex];
        
        // Ajouter le Pokémon actif initial aux participants
        this.participants.add(playerActive._id.toString());

        this.battleState = {
            battle_type: battleType,
            player_team: playerTeam,
            opponent_team: opponentTeam,
            
            player_active_index: playerActiveIndex,
            opponent_active_index: opponentActiveIndex,
            
            turn_count: 0,
            battle_log: [],
            
            status_effects: {
                player: {},
                opponent: {}
            },
            
            state: 'ongoing'
        };

        this.addToBattleLog('Le combat commence!');
        this.addToBattleLog(`${this.getDisplayName(playerActive)} affronte ${this.getDisplayName(opponentActive)}!`);

        return this.battleState;
    }

    /**
     * Détermine qui attaque en premier selon la vitesse
     * @param {Object} playerPokemon - Pokémon du joueur
     * @param {Object} opponentPokemon - Pokémon adverse
     * @param {Object} playerMove - Move choisi par le joueur
     * @param {Object} opponentMove - Move choisi par l'adversaire
     * @returns {string} - "player" ou "opponent"
     */
    calculateTurnOrder(playerPokemon, opponentPokemon, playerMove = {}, opponentMove = {}) {
        // Priorité des moves
        const playerPriority = playerMove.priority || 0;
        const opponentPriority = opponentMove.priority || 0;

        if (playerPriority > opponentPriority) return 'player';
        if (opponentPriority > playerPriority) return 'opponent';

        // Vitesse
        const playerSpeed = this.calculateStat(playerPokemon, 'speed');
        const opponentSpeed = this.calculateStat(opponentPokemon, 'speed');

        if (playerSpeed > opponentSpeed) return 'player';
        if (opponentSpeed > playerSpeed) return 'opponent';

        // Égalité: random
        return Math.random() > 0.5 ? 'player' : 'opponent';
    }

    /**
     * Calcule une statistique avec nature et IVs/EVs
     * @param {Object} pokemon - Pokémon
     * @param {string} statName - 'hp', 'attack', 'defense', 'sp_attack', 'sp_defense', 'speed'
     * @returns {number}
     */
    calculateStat(pokemon, statName,level = 1) {
        // 🆕 Si les stats sont déjà calculées dans l'objet (via PokemonBattleManager), les utiliser directement
        if (pokemon.stats && pokemon.stats[statName] && typeof pokemon.stats[statName] === 'number' && pokemon.stats[statName] > 0) {
            // Vérifier si c'est une stat calculée (valeur > 5) ou une base stat (valeur brute)
            // Pour être sûr, on recalcule si on a un doute, mais si PokemonBattleManager a fait son job, c'est bon.
            // Le problème est que pokemon.stats contient parfois les Base Stats (si speciesData) et parfois les Calculated Stats.
            
            // Si on a maxHP dans stats, c'est probablement un objet de stats calculées
            if (pokemon.stats.maxHP) {
                return pokemon.stats[statName];
            }
        }

        // Fallback: Recalcul complet (comme avant)
        let base = 50;
        
        if (pokemon.speciesData && pokemon.speciesData.stats) {
            // speciesData.stats est toujours Base Stats
            base = pokemon.speciesData.stats[statName];
        } else if (pokemon.stats) {
            base = pokemon.stats[statName];
        }

        const iv = pokemon.ivs?.[statName] || 15;
        const ev = pokemon.evs?.[statName] || 0;
        
        // 🔧 FIXE: S'assurer que le niveau est valide
        //let level = pokemon.level;
        if (!level || isNaN(level)) level = 1;
        if (statName === 'hp') {
            return calculateMaxHP(base, level, iv, ev);
        } else {
            return calculateStat(statName, base, level, iv, ev, pokemon.nature);
        }
    }

    /**
     * Traite un tour de combat
     * @param {Object} attacker - Pokémon attaquant
     * @param {Object} defender - Pokémon défenseur
     * @param {Object} move - Move utilisé
     * @param {string} attackerSide - "player" ou "opponent"
     * @returns {Object} - Résultat du tour (dégâts, effets, messages)
     */
    processTurn(attacker, defender, move, attackerSide) {
        // 🆕 VÉRIFIER SI L'ATTAQUANT EST K.O. AVANT D'AGIR
            if (attacker.currentHP <= 0) {
            return {
                attacker: attacker.nickname || attacker.speciesData?.name,
                defender: defender.nickname || defender.speciesData?.name,
                move: move.name,
                damage: 0,
                effectiveness: 1.0,
                critical: false,
                missed: true,
                defenderHP: defender.currentHP,
                defenderKO: false,
                message: `${this.getDisplayName(attacker)} est K.O. et ne peut pas attaquer!`,
                statusEffects: null
            };
        }
        
        // 🆕 Tracker les participants (seulement côté joueur)
        if (attackerSide === 'player' && attacker._id) {
            this.participants.add(attacker._id.toString());
        }
        
        const result = {
            attacker: this.getDisplayName(attacker),
            defender: this.getDisplayName(defender),
            move: move.name,
            damage: 0,
            effectiveness: 1.0,
            critical: false,
            missed: false,
            defenderHP: defender.currentHP,
            defenderKO: false,
            message: '',
            statusEffects: null // 🆕 Effets de statut appliqués
        };

        // 🆕 Appliquer effets de statut au début du tour
        const statusEffect = this.applyStatusEffects(attacker);
        result.statusEffects = statusEffect;

        // Si le statut empêche d'agir, skip le tour
        if (!statusEffect.canAct) {
            result.missed = true;
            result.message = statusEffect.message;
            return result;
        }

        // Vérifier précision du move
        const accuracy = move.accuracy || 100;
        if (Math.random() * 100 > accuracy) {
            result.missed = true;
            result.message = `${result.attacker} utilise ${move.name} mais rate!`;
            this.addToBattleLog(result.message);
            return result;
        }

        // Calcul des dégâts
        if (move.power && move.power > 0) {
            const damageResult = this.calculateDamage(attacker, defender, move);
            result.damage = damageResult.damage;
            result.effectiveness = damageResult.effectiveness;
            result.critical = damageResult.critical;

            // Appliquer les dégâts
            defender.currentHP = Math.max(0, defender.currentHP - result.damage);
            result.defenderHP = defender.currentHP;

            if (defender.currentHP === 0) {
                result.defenderKO = true;
            }

            // Message
            result.message = `${this.getDisplayName(attacker)} utilise ${move.name}!`;
            this.addToBattleLog(result.message);

            if (result.critical) {
                this.addToBattleLog('Coup critique!');
            }

            if (result.effectiveness > 1) {
                this.addToBattleLog("C'est super efficace!");
            } else if (result.effectiveness < 1 && result.effectiveness > 0) {
                this.addToBattleLog("Ce n'est pas très efficace...");
            } else if (result.effectiveness === 0) {
                this.addToBattleLog("Ça n'a aucun effet...");
            }

            this.addToBattleLog(`${this.getDisplayName(defender)} perd ${result.damage} PV!`);

            if (result.defenderKO) {
                this.addToBattleLog(`${this.getDisplayName(defender)} est K.O.!`);
            }

        } else {
            // Move de statut (pas de dégâts)
            result.message = `${this.getDisplayName(attacker)} utilise ${move.name}!`;
            this.addToBattleLog(result.message);
            
            // TODO: Appliquer effets de statut (paralysie, poison, etc.)
        }

        return result;
    }

    /**
     * Calcule les dégâts d'une attaque
     * @param {Object} attacker - Pokémon attaquant
     * @param {Object} defender - Pokémon défenseur
     * @param {Object} move - Move utilisé
     * @returns {Object} - { damage, effectiveness, critical }
     */
    calculateDamage(attacker, defender, move) {
        const level = attacker.level || 5;
        const power = move.power;
        
        // Attaque physique ou spéciale
        const isPhysical = move.category === 'physical';
        const attack = isPhysical 
            ? this.calculateStat(attacker, 'attack')
            : this.calculateStat(attacker, 'sp_attack');
        const defense = isPhysical
            ? this.calculateStat(defender, 'defense')
            : this.calculateStat(defender, 'sp_defense');

        // Formule de dégâts Gen V
        const baseDamage = Math.floor(((2 * level / 5 + 2) * power * attack / defense) / 50) + 2;

        // Multiplicateurs
        let modifier = 1.0;

        // STAB (Same Type Attack Bonus)
        const attackerTypes = attacker.speciesData?.types || [];
        if (attackerTypes.includes(move.type)) {
            modifier *= 1.5;
        }

        // Efficacité des types
        const defenderTypes = defender.speciesData?.types || [];
        const effectiveness = getTypeEffectiveness(move.type, defenderTypes);
        modifier *= effectiveness;

        // Coup critique (6.25% de chance)
        const critical = Math.random() < 0.0625;
        if (critical) {
            modifier *= 2.0;
        }

        // Random factor (0.85 à 1.0)
        const randomFactor = 0.85 + Math.random() * 0.15;
        modifier *= randomFactor;

        // Dégâts finaux
        const damage = Math.max(1, Math.floor(baseDamage * modifier));

        return {
            damage,
            effectiveness,
            critical
        };
    }

    /**
     * Génère une action IA pour l'adversaire
     * @param {Object} opponentPokemon - Pokémon adverse
     * @param {Object} playerPokemon - Pokémon du joueur
     * @returns {Object} - Move choisi
     */
    generateAIAction(opponentPokemon, playerPokemon) {
        const moveset = opponentPokemon.moveset || [];

        if (moveset.length === 0) {
            // Attaque par défaut: Tackle
            return {
                name: 'tackle',
                type: 'normal',
                category: 'physical',
                power: 40,
                accuracy: 100,
                pp: 35
            };
        }

        // IA basique: choisir le move avec meilleure efficacité
        let bestMove = moveset[0];
        let bestEffectiveness = 0;

        for (const move of moveset) {
            if (!move.type) continue;

            const playerTypes = playerPokemon.speciesData?.types || [];
            const effectiveness = getTypeEffectiveness(move.type, playerTypes);

            if (effectiveness > bestEffectiveness) {
                bestEffectiveness = effectiveness;
                bestMove = move;
            }
        }

        console.log(`[BattleLogic] IA choisit ${bestMove.name} (efficacité: ${bestEffectiveness})`);
        return bestMove;
    }

    /**
     * Vérifie si le combat est terminé
     * @returns {Object} - { isOver, winner }
     */
    isBattleOver() {
        const playerAlive = this.battleState.player_team.some(p => p.currentHP > 0);
        const opponentAlive = this.battleState.opponent_team.some(p => p.currentHP > 0);

        if (!playerAlive) {
            this.battleState.state = 'opponent_won';
            return { isOver: true, winner: 'opponent' };
        }

        if (!opponentAlive) {
            this.battleState.state = 'player_won';
            return { isOver: true, winner: 'player' };
        }

        return { isOver: false, winner: null };
    }

    /**
     * Vérifie si un statut empêche l'action (paralysie, sommeil, etc.)
     * @param {Object} pokemon - Pokémon
     * @param {string} side - "player" ou "opponent"
     * @returns {boolean}
     */
    checkStatusPreventAction(pokemon, side) {
        // TODO: Implémenter statuts (paralysie 25% chance de fail, sommeil, etc.)
        return false;
    }

    /**
     * Ajoute une entrée au log de combat
     * @param {string} message
     */
    addToBattleLog(message) {
        if (!this.battleState) return;

        this.battleState.battle_log.push({
            turn: this.battleState.turn_count,
            message,
            timestamp: Date.now()
        });

        console.log(`[Battle Turn ${this.battleState.turn_count}] ${message}`);
    }

    /**
     * Retourne l'état actuel du combat
     */
    getBattleState() {
        return this.battleState;
    }

    /**
     * Change le Pokémon actif (switch)
     * @param {string} side - "player" ou "opponent"
     * @param {number} newIndex - Index du nouveau Pokémon
     */
    switchPokemon(side, newIndex) {
        const team = side === 'player' ? this.battleState.player_team : this.battleState.opponent_team;
        const newPokemon = team[newIndex];

        if (!newPokemon || newPokemon.currentHP === 0) {
            throw new Error('Pokémon invalide ou K.O.');
        }

        if (side === 'player') {
            this.battleState.player_active_index = newIndex;
        } else {
            this.battleState.opponent_active_index = newIndex;
        }

        this.addToBattleLog(`${newPokemon.nickname || newPokemon.speciesData?.name} entre en combat!`);
    }

    /**
     * Récupère la liste des IDs des Pokémon ayant participé au combat
     * @returns {Array<string>} - Tableau des IDs
     */
    getParticipants() {
        return Array.from(this.participants);
    }

    /**
     * Calcule l'XP gagné après victoire (formule Gen 1-5)
     * @param {Object} defeatedPokemon - Pokémon vaincu
     * @param {Array} participants - Liste des Pokémon ayant participé au combat
     * @param {string} currentTrainerId - ID du dresseur actuel
     * @returns {Array} - [{pokemonId, xpGained, isTraded, heldItem}, ...]
     */
    calculateExperienceGain(defeatedPokemon, participants, currentTrainerId) {
        const baseXP = defeatedPokemon.speciesData?.base_experience || 100;
        console.log(`[BattleLogic] Debug: defeatedPokemon id:${defeatedPokemon._id || defeatedPokemon.species_id} baseXP:${baseXP} level:${defeatedPokemon.level}`);
        console.log(`[BattleLogic] Debug: received participants: ${JSON.stringify(participants.map(p => ({ id: p._id ? p._id.toString() : null, name: p.nickname || p.species_name, currentHP: p.currentHP, level: p.level })))} );`);
        const level = defeatedPokemon.level;
        
        // 🆕 Filtrer les Pokémon K.O. - ils ne gagnent pas d'XP
        const aliveParticipants = participants.filter(p => p.currentHP > 0);
        console.log(`[BattleLogic] Debug: aliveParticipants count:${aliveParticipants.length}`);
        const participantCount = aliveParticipants.length;
        
        console.log(`[BattleLogic] Calcul XP pour ${aliveParticipants.length}/${participants.length} participants vivants`);

        const xpResults = [];

        for (const pokemon of aliveParticipants) {
            // Facteur "traded" (a)
            const isTraded = pokemon.originalTrainer && pokemon.originalTrainer !== currentTrainerId;
            const tradedMultiplier = isTraded ? 1.5 : 1.0;

            // Facteur Lucky Egg (e)
            const hasLuckyEgg = pokemon.heldItem === 'lucky-egg';
            const luckyEggMultiplier = hasLuckyEgg ? 1.5 : 9.0;

            // Calcul de base
            let xpGained = Math.floor((tradedMultiplier * baseXP * level) / (7 * participantCount));

            // Appliquer Lucky Egg
            xpGained = Math.floor(xpGained * luckyEggMultiplier);

            xpResults.push({
                pokemonId: pokemon._id,
                pokemonName: pokemon.nickname || pokemon.species_name,
                xpGained: xpGained,
                isTraded: isTraded,
                hasLuckyEgg: hasLuckyEgg,
                currentLevel: pokemon.level,
                currentXP: pokemon.experience
            });

            console.log(`  - ${pokemon.nickname || pokemon.species_name}: +${xpGained} XP (traded: ${isTraded}, lucky egg: ${hasLuckyEgg})`);
        }

        console.log('[BattleLogic] Debug: final xpResults:', xpResults);
        return xpResults;
    }

    /**
     * Applique les effets de statut au début du tour
     * @param {Object} pokemon - Pokémon affecté
     * @returns {Object} - { canAct: boolean, damage: number, message: string }
     */
    applyStatusEffects(pokemon) {
        const result = { canAct: true, damage: 0, message: '' };

        if (!pokemon.statusCondition || !pokemon.statusCondition.type) {
            return result;
        }

        const status = pokemon.statusCondition.type;

        switch (status) {
            case 'poison':
                // Poison: 1/8 HP de dégâts par tour
                result.damage = Math.max(1, Math.floor(pokemon.maxHP / 8));
                pokemon.currentHP = Math.max(0, pokemon.currentHP - result.damage);
                result.message = `${this.getDisplayName(pokemon)} souffre du poison! (-${result.damage} PV)`;
                this.addToBattleLog(result.message);
                break;

            case 'burn':
                // Brûlure: 1/16 HP de dégâts par tour + attaque réduite
                result.damage = Math.max(1, Math.floor(pokemon.maxHP / 16));
                pokemon.currentHP = Math.max(0, pokemon.currentHP - result.damage);
                result.message = `${this.getDisplayName(pokemon)} souffre de sa brûlure! (-${result.damage} PV)`;
                this.addToBattleLog(result.message);
                break;

            case 'paralysis':
                // Paralysie: 25% de chance de ne pas agir
                if (Math.random() < 0.25) {
                    result.canAct = false;
                    result.message = `${this.getDisplayName(pokemon)} est paralysé! Il ne peut pas attaquer!`;
                    this.addToBattleLog(result.message);
                }
                break;

            case 'sleep':
                // Sommeil: ne peut pas agir, compteur diminue
                if (pokemon.statusCondition.turns > 0) {
                    pokemon.statusCondition.turns--;
                    result.canAct = false;
                    result.message = `${this.getDisplayName(pokemon)} dort profondément...`;
                    this.addToBattleLog(result.message);

                    if (pokemon.statusCondition.turns === 0) {
                        pokemon.statusCondition.type = null;
                        this.addToBattleLog(`${pokemon.nickname || pokemon.species_name} se réveille!`);
                    }
                } else {
                    // Guérison automatique
                    pokemon.statusCondition.type = null;
                }
                break;

            case 'freeze':
                // Gel: ne peut pas agir, 20% de chance de dégel
                if (Math.random() < 0.20) {
                    pokemon.statusCondition.type = null;
                    result.message = `${this.getDisplayName(pokemon)} a dégelé!`;
                    this.addToBattleLog(result.message);
                } else {
                    result.canAct = false;
                    result.message = `${this.getDisplayName(pokemon)} est gelé! Il ne peut pas attaquer!`;
                    this.addToBattleLog(result.message);
                }
                break;
        }

        return result;
    }

    /**
     * Applique un statut à un Pokémon (via move de statut)
     * @param {Object} pokemon - Pokémon cible
     * @param {string} statusType - Type de statut (poison, burn, paralysis, sleep, freeze)
     * @returns {boolean} - Succès de l'application
     */
    applyStatusCondition(pokemon, statusType) {
        // Ne peut pas avoir plusieurs statuts en même temps
        if (pokemon.statusCondition && pokemon.statusCondition.type) {
            this.addToBattleLog(`${pokemon.nickname || pokemon.species_name} est déjà affecté par un statut!`);
            return false;
        }

        // TODO: Vérifier immunités de type (ex: Poison sur type Poison)

        pokemon.statusCondition = {
            type: statusType,
            turns: statusType === 'sleep' ? (1 + Math.floor(Math.random() * 3)) : 0 // Sleep: 1-3 tours
        };

        const messages = {
            poison: 'est empoisonné!',
            burn: 'est brûlé!',
            paralysis: 'est paralysé!',
            sleep: 's\'endort profondément!',
            freeze: 'est gelé!'
        };

        this.addToBattleLog(`${pokemon.nickname || pokemon.species_name} ${messages[statusType]}`);
        return true;
    }

    /**
     * Calcule le taux de capture (formule Gen 3-4)
     * @param {Object} pokemon - Pokémon sauvage à capturer
     * @param {number} ballRate - Multiplicateur de la ball (1.0 = Poké Ball, 1.5 = Great Ball, 2.0 = Ultra Ball)
     * @returns {Object} - { captured: boolean, shakes: number }
     */
    calculateCapture(pokemon, ballRate = 1.0) {
        console.log('[Capture] Calcul pour', this.getDisplayName(pokemon), 'avec ball rate', ballRate);

        // Formule Gen 3-4:
        // a = ((3 × MaxHP - 2 × CurrentHP) × CatchRate × BallRate) / (3 × MaxHP) × StatusBonus
        
        const maxHP = pokemon.maxHP;
        const currentHP = pokemon.currentHP;
        const catchRate = pokemon.speciesData?.capture_rate || 45; // Défaut moyen si pas de data

        // Bonus de statut
        let statusBonus = 1.0;
        if (pokemon.statusCondition?.type) {
            const status = pokemon.statusCondition.type;
            if (status === 'sleep' || status === 'freeze') {
                statusBonus = 2.0; // x2 pour Sommeil et Gel
            } else if (status === 'poison' || status === 'burn' || status === 'paralysis') {
                statusBonus = 1.5; // x1.5 pour les autres
            }
        }

        // 1. Calcul du taux modifié 'a'
        // Note: Math.floor est appliqué à chaque étape importante dans les jeux originaux
        let a = Math.floor(((3 * maxHP - 2 * currentHP) * catchRate * ballRate) / (3 * maxHP));
        a = Math.floor(a * statusBonus);

        console.log(`  HP: ${currentHP}/${maxHP}, CatchRate: ${catchRate}, StatusBonus: ${statusBonus}, BallRate: ${ballRate}, a: ${a}`);

        if (a >= 255) {
            console.log('  → Capture critique (a >= 255)');
            return { captured: true, shakes: 3, catchRate, statusBonus, a };
        }

        // 2. Calcul de la probabilité de secousse 'b'
        // b = 65536 * (a / 255) ^ 0.25
        // Approximation utilisée dans les jeux : b = 1048560 / sqrt(sqrt(16711680 / a))
        const b = Math.floor(1048560 / Math.sqrt(Math.sqrt(16711680 / a)));
        
        console.log(`  → Shake probability b: ${b} / 65536`);

        // 3. 4 secousses (checks)
        let shakes = 0;
        for (let i = 0; i < 4; i++) {
            const rand = Math.floor(Math.random() * 65536); // 0 à 65535
            if (rand < b) {
                shakes++;
            } else {
                break; // Échappe
            }
        }

        const captured = shakes === 4;

        console.log(`  → ${shakes} secousse(s), ${captured ? 'CAPTURÉ' : 'ÉCHAPPÉ'}`);

        return { captured, shakes, catchRate, statusBonus, a, b };
    }
}

module.exports = PokemonBattleLogicManager;
