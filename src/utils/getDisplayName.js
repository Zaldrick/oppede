// Utility to consistently return a display name for Pokemon or related data structures
// Prefers: nickname > speciesData.name_fr > species_name_fr > speciesData.name > species_name > name
export function getPokemonDisplayName(pokemon) {
    if (!pokemon) return '';

    // nickname set and not empty
    if (pokemon.nickname && String(pokemon.nickname).trim().length > 0) return pokemon.nickname;

    // Prefer FR name when available.
    // Note: in some flows (battle payload), speciesData may only contain the EN name.
    // When the DB already provides a FR name (species_name_fr), prefer it over EN.
    if (pokemon.speciesData?.name_fr) return pokemon.speciesData.name_fr;
    if (pokemon.species_name_fr) return pokemon.species_name_fr;

    // English fallbacks
    if (pokemon.speciesData?.name) return pokemon.speciesData.name;
    if (pokemon.species_name) return pokemon.species_name;

    // last resort
    if (pokemon.name) return pokemon.name;

    return '';
}

export default getPokemonDisplayName;
