/**
 * typeEffectiveness.js
 * Table de multiplicateurs d'efficacité des types Pokémon
 * Format: [Type Attaque][Type Défense] = Multiplicateur
 * 
 * Multiplicateurs:
 * - 2.0: Super efficace
 * - 1.0: Efficacité normale
 * - 0.5: Peu efficace
 * - 0.25: Très peu efficace (double résistance)
 * - 0: Immunité totale
 */

const TYPE_CHART = {
    normal: {
        normal: 1.0, fire: 1.0, water: 1.0, electric: 1.0, grass: 1.0,
        ice: 1.0, fighting: 1.0, poison: 1.0, ground: 1.0, flying: 1.0,
        psychic: 1.0, bug: 1.0, rock: 0.5, ghost: 0, dragon: 1.0,
        dark: 1.0, steel: 0.5, fairy: 1.0
    },
    fire: {
        normal: 1.0, fire: 0.5, water: 0.5, electric: 1.0, grass: 2.0,
        ice: 2.0, fighting: 1.0, poison: 1.0, ground: 1.0, flying: 1.0,
        psychic: 1.0, bug: 2.0, rock: 0.5, ghost: 1.0, dragon: 0.5,
        dark: 1.0, steel: 2.0, fairy: 1.0
    },
    water: {
        normal: 1.0, fire: 2.0, water: 0.5, electric: 1.0, grass: 0.5,
        ice: 1.0, fighting: 1.0, poison: 1.0, ground: 2.0, flying: 1.0,
        psychic: 1.0, bug: 1.0, rock: 2.0, ghost: 1.0, dragon: 0.5,
        dark: 1.0, steel: 1.0, fairy: 1.0
    },
    electric: {
        normal: 1.0, fire: 1.0, water: 2.0, electric: 0.5, grass: 0.5,
        ice: 1.0, fighting: 1.0, poison: 1.0, ground: 0, flying: 2.0,
        psychic: 1.0, bug: 1.0, rock: 1.0, ghost: 1.0, dragon: 0.5,
        dark: 1.0, steel: 1.0, fairy: 1.0
    },
    grass: {
        normal: 1.0, fire: 0.5, water: 2.0, electric: 1.0, grass: 0.5,
        ice: 1.0, fighting: 1.0, poison: 0.5, ground: 2.0, flying: 0.5,
        psychic: 1.0, bug: 0.5, rock: 2.0, ghost: 1.0, dragon: 0.5,
        dark: 1.0, steel: 0.5, fairy: 1.0
    },
    ice: {
        normal: 1.0, fire: 0.5, water: 0.5, electric: 1.0, grass: 2.0,
        ice: 0.5, fighting: 1.0, poison: 1.0, ground: 2.0, flying: 2.0,
        psychic: 1.0, bug: 1.0, rock: 1.0, ghost: 1.0, dragon: 2.0,
        dark: 1.0, steel: 0.5, fairy: 1.0
    },
    fighting: {
        normal: 2.0, fire: 1.0, water: 1.0, electric: 1.0, grass: 1.0,
        ice: 2.0, fighting: 1.0, poison: 0.5, ground: 1.0, flying: 0.5,
        psychic: 0.5, bug: 0.5, rock: 2.0, ghost: 0, dragon: 1.0,
        dark: 2.0, steel: 2.0, fairy: 0.5
    },
    poison: {
        normal: 1.0, fire: 1.0, water: 1.0, electric: 1.0, grass: 2.0,
        ice: 1.0, fighting: 1.0, poison: 0.5, ground: 0.5, flying: 1.0,
        psychic: 1.0, bug: 1.0, rock: 0.5, ghost: 0.5, dragon: 1.0,
        dark: 1.0, steel: 0, fairy: 2.0
    },
    ground: {
        normal: 1.0, fire: 2.0, water: 1.0, electric: 2.0, grass: 0.5,
        ice: 1.0, fighting: 1.0, poison: 2.0, ground: 1.0, flying: 0,
        psychic: 1.0, bug: 0.5, rock: 2.0, ghost: 1.0, dragon: 1.0,
        dark: 1.0, steel: 2.0, fairy: 1.0
    },
    flying: {
        normal: 1.0, fire: 1.0, water: 1.0, electric: 0.5, grass: 2.0,
        ice: 1.0, fighting: 2.0, poison: 1.0, ground: 1.0, flying: 1.0,
        psychic: 1.0, bug: 2.0, rock: 0.5, ghost: 1.0, dragon: 1.0,
        dark: 1.0, steel: 0.5, fairy: 1.0
    },
    psychic: {
        normal: 1.0, fire: 1.0, water: 1.0, electric: 1.0, grass: 1.0,
        ice: 1.0, fighting: 2.0, poison: 2.0, ground: 1.0, flying: 1.0,
        psychic: 0.5, bug: 1.0, rock: 1.0, ghost: 1.0, dragon: 1.0,
        dark: 0, steel: 0.5, fairy: 1.0
    },
    bug: {
        normal: 1.0, fire: 0.5, water: 1.0, electric: 1.0, grass: 2.0,
        ice: 1.0, fighting: 0.5, poison: 0.5, ground: 1.0, flying: 0.5,
        psychic: 2.0, bug: 1.0, rock: 1.0, ghost: 0.5, dragon: 1.0,
        dark: 2.0, steel: 0.5, fairy: 0.5
    },
    rock: {
        normal: 1.0, fire: 2.0, water: 1.0, electric: 1.0, grass: 1.0,
        ice: 2.0, fighting: 0.5, poison: 1.0, ground: 0.5, flying: 2.0,
        psychic: 1.0, bug: 2.0, rock: 1.0, ghost: 1.0, dragon: 1.0,
        dark: 1.0, steel: 0.5, fairy: 1.0
    },
    ghost: {
        normal: 0, fire: 1.0, water: 1.0, electric: 1.0, grass: 1.0,
        ice: 1.0, fighting: 1.0, poison: 1.0, ground: 1.0, flying: 1.0,
        psychic: 2.0, bug: 1.0, rock: 1.0, ghost: 2.0, dragon: 1.0,
        dark: 0.5, steel: 1.0, fairy: 1.0
    },
    dragon: {
        normal: 1.0, fire: 1.0, water: 1.0, electric: 1.0, grass: 1.0,
        ice: 1.0, fighting: 1.0, poison: 1.0, ground: 1.0, flying: 1.0,
        psychic: 1.0, bug: 1.0, rock: 1.0, ghost: 1.0, dragon: 2.0,
        dark: 1.0, steel: 0.5, fairy: 0
    },
    dark: {
        normal: 1.0, fire: 1.0, water: 1.0, electric: 1.0, grass: 1.0,
        ice: 1.0, fighting: 0.5, poison: 1.0, ground: 1.0, flying: 1.0,
        psychic: 2.0, bug: 1.0, rock: 1.0, ghost: 2.0, dragon: 1.0,
        dark: 0.5, steel: 1.0, fairy: 0.5
    },
    steel: {
        normal: 1.0, fire: 0.5, water: 0.5, electric: 0.5, grass: 1.0,
        ice: 2.0, fighting: 1.0, poison: 1.0, ground: 1.0, flying: 1.0,
        psychic: 1.0, bug: 1.0, rock: 2.0, ghost: 1.0, dragon: 1.0,
        dark: 1.0, steel: 0.5, fairy: 2.0
    },
    fairy: {
        normal: 1.0, fire: 0.5, water: 1.0, electric: 1.0, grass: 1.0,
        ice: 1.0, fighting: 2.0, poison: 0.5, ground: 1.0, flying: 1.0,
        psychic: 1.0, bug: 1.0, rock: 1.0, ghost: 1.0, dragon: 2.0,
        dark: 2.0, steel: 0.5, fairy: 1.0
    }
};

/**
 * Calcule l'efficacité d'un type d'attaque contre un ou plusieurs types de défense
 * @param {string} attackType - Type de l'attaque (ex: "fire")
 * @param {string|string[]} defenseTypes - Type(s) du défenseur (ex: "grass" ou ["grass", "poison"])
 * @returns {number} - Multiplicateur d'efficacité (0, 0.25, 0.5, 1.0, 2.0, 4.0)
 */
export function getTypeEffectiveness(attackType, defenseTypes) {
    if (!attackType || !defenseTypes) return 1.0;

    const attackTypeLower = attackType.toLowerCase();
    const defenseTypesArray = Array.isArray(defenseTypes) ? defenseTypes : [defenseTypes];

    // Si le type d'attaque n'existe pas dans la table
    if (!TYPE_CHART[attackTypeLower]) {
        console.warn(`[TypeEffectiveness] Type d'attaque inconnu: ${attackType}`);
        return 1.0;
    }

    // Multiplier l'efficacité pour chaque type de défense
    let effectiveness = 1.0;
    for (const defenseType of defenseTypesArray) {
        const defenseTypeLower = defenseType.toLowerCase();
        
        if (TYPE_CHART[attackTypeLower][defenseTypeLower] !== undefined) {
            effectiveness *= TYPE_CHART[attackTypeLower][defenseTypeLower];
        } else {
            console.warn(`[TypeEffectiveness] Type de défense inconnu: ${defenseType}`);
        }
    }

    return effectiveness;
}

/**
 * Retourne un message descriptif de l'efficacité
 * @param {number} effectiveness - Multiplicateur d'efficacité
 * @returns {string} - Message descriptif
 */
export function getEffectivenessMessage(effectiveness) {
    if (effectiveness === 0) return "Ça n'a aucun effet...";
    if (effectiveness <= 0.25) return "Ce n'est vraiment pas efficace...";
    if (effectiveness <= 0.5) return "Ce n'est pas très efficace...";
    if (effectiveness === 1.0) return "";
    if (effectiveness >= 4.0) return "C'est incroyablement efficace!";
    if (effectiveness >= 2.0) return "C'est super efficace!";
    return "";
}

/**
 * Vérifie si une immunité existe (effectiveness = 0)
 * @param {string} attackType - Type de l'attaque
 * @param {string|string[]} defenseTypes - Type(s) du défenseur
 * @returns {boolean}
 */
export function isImmune(attackType, defenseTypes) {
    return getTypeEffectiveness(attackType, defenseTypes) === 0;
}

export default {
    TYPE_CHART,
    getTypeEffectiveness,
    getEffectivenessMessage,
    isImmune
};
