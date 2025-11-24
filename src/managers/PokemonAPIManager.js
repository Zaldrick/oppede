/**
 * PokemonAPIManager.js (Client-side)
 * Récupère les données Pokémon depuis PokéAPI à la demande
 * Utilise un cache local pour les noms français et les sprites
 */

import { pokemonFrenchNames } from '../utils/pokemonNames';

const POKEAPI_URL = 'https://pokeapi.co/api/v2';

class PokemonAPIManager {
    constructor() {
        this.cache = {};
        this.requestQueue = [];
        this.isProcessing = false;
    }

    /**
     * Récupère les données d'un Pokémon avec rate limiting
     */
    async fetchWithDelay(url, delayMs = 300) {
        return new Promise((resolve) => {
            this.requestQueue.push(async () => {
                await new Promise(r => setTimeout(r, delayMs));
                try {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return await response.json();
                } catch (error) {
                    console.error(`[PokemonAPI] Erreur fetch ${url}:`, error.message);
                    return null;
                }
            });
            this.processQueue();
            resolve();
        });
    }

    /**
     * Traite la queue de requêtes
     */
    async processQueue() {
        if (this.isProcessing || this.requestQueue.length === 0) return;
        
        this.isProcessing = true;
        while (this.requestQueue.length > 0) {
            const task = this.requestQueue.shift();
            await task();
        }
        this.isProcessing = false;
    }

    /**
     * Récupère les données complètes d'un Pokémon (avec sprites optimisés)
     */
    async getPokemonData(pokedexId) {
        // Vérifier cache
        if (this.cache[pokedexId]) {
            console.log(`[PokemonAPI] Cache hit pour #${pokedexId}`);
            return this.cache[pokedexId];
        }

        console.log(`[PokemonAPI] Fetching #${pokedexId} depuis PokéAPI...`);

        try {
            // Fetch données PokéAPI
            const pokemonUrl = `${POKEAPI_URL}/pokemon/${pokedexId}`;
            const response = await fetch(pokemonUrl);
            
            if (!response.ok) {
                console.warn(`[PokemonAPI] Pokémon ${pokedexId} non trouvé`);
                return null;
            }

            const pokemonData = await response.json();
            
            // Extraire les sprites selon les chemins spécifiés
            const sprites = {
                // Menu : Gen VII (Ultra Sun/Moon)
                menu: pokemonData.sprites?.versions?.['generation-vii']?.['ultra-sun-ultra-moon']?.front_default,
                
                // Combat - Front: Gen V (Black/White) animé
                front: pokemonData.sprites?.versions?.['generation-v']?.['black-white']?.animated?.front_default,
                
                // Combat - Back: Gen V (Black/White) animé
                back: pokemonData.sprites?.versions?.['generation-v']?.['black-white']?.animated?.back_default
            };

            // Récupérer les infos de l'espèce (pour Pokédex entry FR)
            const speciesUrl = `${POKEAPI_URL}/pokemon-species/${pokedexId}`;
            const speciesResponse = await fetch(speciesUrl);
            const speciesData = speciesResponse.ok ? await speciesResponse.json() : null;

            // Récupérer la description française si disponible
            let frenchEntry = '';
            if (speciesData?.flavor_text_entries) {
                const frEntry = speciesData.flavor_text_entries.find(e => e.language.name === 'fr');
                frenchEntry = frEntry?.flavor_text?.replace(/\n/g, ' ') || '';
            }

            // Construire l'objet données
            const pokemonInfo = {
                pokedexId,
                name: pokemonFrenchNames[pokedexId] || pokemonData.name.charAt(0).toUpperCase() + pokemonData.name.slice(1),
                englishName: pokemonData.name,
                types: pokemonData.types.map(t => t.type.name),
                baseStats: {
                    hp: pokemonData.stats[0].base_stat,
                    attack: pokemonData.stats[1].base_stat,
                    defense: pokemonData.stats[2].base_stat,
                    sp_attack: pokemonData.stats[3].base_stat,
                    sp_defense: pokemonData.stats[4].base_stat,
                    speed: pokemonData.stats[5].base_stat
                },
                sprites,
                height: pokemonData.height,
                weight: pokemonData.weight,
                baseExperience: pokemonData.base_experience,
                frenchEntry,
                moves: pokemonData.moves.slice(0, 4).map(m => ({
                    name: m.move.name,
                    url: m.move.url
                }))
            };

            // Cacher les résultats
            this.cache[pokedexId] = pokemonInfo;
            console.log(`[PokemonAPI] ✅ ${pokemonInfo.name} (#${pokedexId}) chargé`);
            
            return pokemonInfo;

        } catch (error) {
            console.error(`[PokemonAPI] Erreur ${pokedexId}:`, error.message);
            return null;
        }
    }

    /**
     * Récupère les détails d'un mouvement
     */
    async getMoveData(moveUrl) {
        try {
            const response = await fetch(moveUrl);
            if (!response.ok) return null;
            
            const moveData = await response.json();
            
            return {
                name: moveData.name,
                type: moveData.type.name,
                power: moveData.power || 0,
                accuracy: moveData.accuracy || 100,
                pp: moveData.pp,
                category: moveData.damage_class.name,
                effect: moveData.effect_entries[0]?.short_effect || ''
            };
        } catch (error) {
            console.error('[PokemonAPI] Erreur move:', error.message);
            return null;
        }
    }

    /**
     * Efface le cache (pour dev)
     */
    clearCache() {
        this.cache = {};
        console.log('[PokemonAPI] Cache effacé');
    }
}

const pokemonAPIManager = new PokemonAPIManager();
export default pokemonAPIManager;
