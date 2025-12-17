/**
 * customPokemonClones.js
 *
 * Supports "custom Pokémon" that are 1:1 clones of existing species for gameplay
 * (moves, stats, XP, cries...), but with a different display name + sprite.
 *
 * Implementation strategy:
 * - Keep the original `species_id` (so everything gameplay-related stays identical).
 * - Use the Pokémon nickname/name to detect custom clones.
 * - Override sprite URLs to local assets served from `public/assets`.
 */

const CUSTOM_SPRITE_BASE_PATH = '/assets/pokemon/custom';

// Keyed by lowercase display name.
export const CUSTOM_POKEMON_CLONES = {
    gaara: { cloneOfSpeciesId: 552, spriteBaseName: 'gaara' }, // Escroco
    floki: { cloneOfSpeciesId: 471, spriteBaseName: 'floki' }, // Givrali
    tanuki: { cloneOfSpeciesId: 405, spriteBaseName: 'tanuki' }, // Luxray
    sirius: { cloneOfSpeciesId: 59, spriteBaseName: 'sirius' } // Arcanin
};

function normalizeName(value) {
    if (!value) return '';
    return String(value).trim().toLowerCase();
}

/**
 * Returns a normalized key (e.g. 'gaara') if this Pokémon matches a custom clone.
 */
export function getCustomCloneKey(pokemon) {
    if (!pokemon) return null;

    // Prefer nickname/name; species names are not useful for clone detection.
    const candidate =
        pokemon.nickname ||
        pokemon.name ||
        pokemon.species_name_fr ||
        pokemon.species_name;

    const key = normalizeName(candidate);
    if (!key) return null;

    return CUSTOM_POKEMON_CLONES[key] ? key : null;
}

/**
 * Returns sprite URL overrides for the custom clone if any.
 *
 * Expected assets:
 * - `${name}_front.png`
 * - `${name}_back.png`
 *
 * We reuse the front sprite for menu display.
 */
export function getCustomCloneSpriteUrls(pokemon) {
    const key = getCustomCloneKey(pokemon);
    if (!key) return null;

    const baseName = CUSTOM_POKEMON_CLONES[key].spriteBaseName;
    const frontUrl = `${CUSTOM_SPRITE_BASE_PATH}/${baseName}_front.png`;
    const backUrl = `${CUSTOM_SPRITE_BASE_PATH}/${baseName}_back.png`;

    return {
        menu: frontUrl,
        front: frontUrl,
        back: backUrl,
        frontCombat: frontUrl,
        backCombat: backUrl
    };
}

export default getCustomCloneSpriteUrls;
