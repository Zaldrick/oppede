/**
 * pokemonStats.js
 * Utilitaire pour le calcul des statistiques des Pokémon
 */

const NATURE_TABLE = {
    lonely: { up: 'attack', down: 'defense' },
    brave: { up: 'attack', down: 'speed' },
    adamant: { up: 'attack', down: 'sp_attack' },
    naughty: { up: 'attack', down: 'sp_defense' },
    bold: { up: 'defense', down: 'attack' },
    relaxed: { up: 'defense', down: 'speed' },
    impish: { up: 'defense', down: 'sp_attack' },
    lax: { up: 'defense', down: 'sp_defense' },
    timid: { up: 'speed', down: 'attack' },
    hasty: { up: 'speed', down: 'defense' },
    jolly: { up: 'speed', down: 'sp_attack' },
    naive: { up: 'speed', down: 'sp_defense' },
    modest: { up: 'sp_attack', down: 'attack' },
    mild: { up: 'sp_attack', down: 'defense' },
    quiet: { up: 'sp_attack', down: 'speed' },
    rash: { up: 'sp_attack', down: 'sp_defense' },
    calm: { up: 'sp_defense', down: 'attack' },
    gentle: { up: 'sp_defense', down: 'defense' },
    sassy: { up: 'sp_defense', down: 'speed' },
    careful: { up: 'sp_defense', down: 'sp_attack' }
};

/**
 * Retourne les multiplicateurs de nature
 * @param {string} nature 
 * @returns {Object} { attack: 1.1, defense: 0.9, ... }
 */
function getNatureMultipliers(nature) {
    const multipliers = {
        attack: 1, defense: 1, sp_attack: 1, sp_defense: 1, speed: 1
    };
    
    const effect = NATURE_TABLE[nature.toLowerCase()];
    if (effect) {
        multipliers[effect.up] = 1.1;
        multipliers[effect.down] = 0.9;
    }
    
    return multipliers;
}

/**
 * Calcule les PV max d'un Pokémon
 * @param {number} baseHP - Base stat HP
 * @param {number} level - Niveau
 * @param {number} iv - IV HP (0-31)
 * @param {number} ev - EV HP (0-255)
 * @returns {number} Max HP
 */
function calculateMaxHP(baseHP, level, iv = 0, ev = 0) {
    // Shedinja case (toujours 1 PV)
    if (baseHP === 1) return 1;
    
    // Formule: ((2 * Base + IV + (EV/4)) * Level / 100) + Level + 10
    return Math.floor(((2 * baseHP + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
}

/**
 * Calcule une stat (hors HP)
 * @param {string} statName - Nom de la stat (attack, defense, etc.)
 * @param {number} baseStat - Base stat
 * @param {number} level - Niveau
 * @param {number} iv - IV (0-31)
 * @param {number} ev - EV (0-255)
 * @param {string} nature - Nature du Pokémon
 * @returns {number} Valeur de la stat
 */
function calculateStat(statName, baseStat, level, iv = 0, ev = 0, nature = 'hardy') {
    const multipliers = getNatureMultipliers(nature);
    const multiplier = multipliers[statName] || 1;
    
    // Formule: (((2 * Base + IV + (EV/4)) * Level / 100) + 5) * Nature
    return Math.floor((Math.floor(((2 * baseStat + iv + Math.floor(ev / 4)) * level) / 100) + 5) * multiplier);
}

/**
 * Calcule toutes les stats d'un Pokémon
 * @param {Object} baseStats - { hp, attack, defense, sp_attack, sp_defense, speed }
 * @param {number} level 
 * @param {Object} ivs 
 * @param {Object} evs 
 * @param {string} nature 
 * @returns {Object} { maxHP, attack, defense, ... }
 */
function calculateAllStats(baseStats, level, ivs, evs, nature) {
    return {
        maxHP: calculateMaxHP(baseStats.hp, level, ivs.hp, evs.hp),
        attack: calculateStat('attack', baseStats.attack, level, ivs.attack, evs.attack, nature),
        defense: calculateStat('defense', baseStats.defense, level, ivs.defense, evs.defense, nature),
        sp_attack: calculateStat('sp_attack', baseStats.sp_attack, level, ivs.sp_attack, evs.sp_attack, nature),
        sp_defense: calculateStat('sp_defense', baseStats.sp_defense, level, ivs.sp_defense, evs.sp_defense, nature),
        speed: calculateStat('speed', baseStats.speed, level, ivs.speed, evs.speed, nature)
    };
}

module.exports = {
    calculateMaxHP,
    calculateStat,
    calculateAllStats,
    getNatureMultipliers
};
