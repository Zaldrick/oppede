/**
 * PokemonBattleLogicManager.js
 * Gestion de la logique de combat Pokémon (calculs purs, pas d'I/O)
 * 
 * Responsabilités:
 * - Calcul des dégâts
 * - Ordre des tours (vitesse)
 * - Efficacité des types
 * - Génération d'actions IA
 * - Vérification fin de combat
 */

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

        // Filtrer les Pokémon KO
        const validPlayerTeam = playerTeam.filter(p => p.currentHP > 0);
        const validOpponentTeam = opponentTeam.filter(p => p.currentHP > 0);

        if (validPlayerTeam.length === 0 || validOpponentTeam.length === 0) {
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

        const playerActiveIndex = findFirstValidPokemon(validPlayerTeam);
        const opponentActiveIndex = findFirstValidPokemon(validOpponentTeam);

        const playerActive = validPlayerTeam[playerActiveIndex];
        const opponentActive = validOpponentTeam[opponentActiveIndex];

        this.battleState = {
            battle_type: battleType,
            player_team: validPlayerTeam,
            opponent_team: validOpponentTeam,
            
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
        this.addToBattleLog(`${playerActive.nickname || playerActive.speciesData?.name} affronte ${opponentActive.nickname || opponentActive.speciesData?.name}!`);

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
     * @param {string} statName - 'attack', 'defense', 'sp_attack', 'sp_defense', 'speed'
     * @returns {number}
     */
    calculateStat(pokemon, statName) {
        const base = pokemon.stats?.[statName] || 50;
        const iv = pokemon.ivs?.[statName] || 15;
        const ev = pokemon.evs?.[statName] || 0;
        const level = pokemon.level || 5;

        // Formule Pokémon Gen III+
        const stat = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) + 5;

        // Bonus/malus de nature (simplifié, à implémenter plus tard)
        return stat;
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
        const result = {
            attacker: attacker.nickname || attacker.speciesData?.name,
            defender: defender.nickname || defender.speciesData?.name,
            move: move.name,
            damage: 0,
            effectiveness: 1.0,
            critical: false,
            missed: false,
            defenderHP: defender.currentHP,
            defenderKO: false,
            message: ''
        };

        // Vérifier statut (paralysie, sommeil, etc.)
        if (this.checkStatusPreventAction(attacker, attackerSide)) {
            result.missed = true;
            result.message = `${result.attacker} ne peut pas attaquer!`;
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
            result.message = `${result.attacker} utilise ${move.name}!`;
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

            this.addToBattleLog(`${result.defender} perd ${result.damage} PV!`);

            if (result.defenderKO) {
                this.addToBattleLog(`${result.defender} est K.O.!`);
            }

        } else {
            // Move de statut (pas de dégâts)
            result.message = `${result.attacker} utilise ${move.name}!`;
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
}

module.exports = PokemonBattleLogicManager;
