/**
 * typeLabelsFR.js
 * Helpers de libellés FR pour les types Pokémon.
 */

export const TYPE_LABELS_FR = {
    normal: 'Normal',
    fire: 'Feu',
    water: 'Eau',
    electric: 'Électrik',
    grass: 'Plante',
    ice: 'Glace',
    fighting: 'Combat',
    poison: 'Poison',
    ground: 'Sol',
    flying: 'Vol',
    psychic: 'Psy',
    bug: 'Insecte',
    rock: 'Roche',
    ghost: 'Spectre',
    dragon: 'Dragon',
    dark: 'Ténèbres',
    steel: 'Acier',
    fairy: 'Fée'
};

export const TYPE_LABELS_FR_SHORT = {
    normal: 'NOR',
    fire: 'FEU',
    water: 'EAU',
    electric: 'ELE',
    grass: 'PLA',
    ice: 'GLA',
    fighting: 'COM',
    poison: 'POI',
    ground: 'SOL',
    flying: 'VOL',
    psychic: 'PSY',
    bug: 'INS',
    rock: 'ROC',
    ghost: 'SPE',
    dragon: 'DRA',
    dark: 'TEN',
    steel: 'ACI',
    fairy: 'FEE'
};

/**
 * Retourne le libellé FR d'un type Pokémon.
 * @param {string} type - ex: "water", "fire"
 * @param {{ short?: boolean }} [options]
 */
export function getPokemonTypeLabelFR(type, options = {}) {
    const short = !!options.short;

    const normalized = (type || 'normal').toString().trim().toLowerCase();
    const table = short ? TYPE_LABELS_FR_SHORT : TYPE_LABELS_FR;

    const label = table[normalized] || TYPE_LABELS_FR[normalized] || normalized;

    return short ? String(label).toUpperCase() : String(label).toUpperCase();
}
