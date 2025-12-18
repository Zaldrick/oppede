/**
 * PokemonManager.js - Client-side Pokémon Manager
 * Gère les appels API pour les Pokémon du joueur + fetch lazy depuis PokéAPI
 * Caching local + synchronisation serveur
 */

import PokemonAPIManager from './PokemonAPIManager';
import { calculateAllStats } from '../utils/pokemonStats';

class PokemonManager {
    constructor(socket) {
        this.socket = socket;
        this.baseUrl = process.env.REACT_APP_API_URL;
        this.team = [];
        this.pokemonDetail = {};
        this.speciesCache = {};
        this.isLoading = false;
    }

    /**
     * Configure le base URL (pour production)
     */
    setBaseUrl(url) {
        this.baseUrl = url;
    }

    /**
     * Récupère l'équipe complète du joueur
     */
    async getTeam(playerId) {
        try {
            this.isLoading = true;
            const response = await fetch(`${this.baseUrl}/api/pokemon/team/${playerId}`);
            
            if (!response.ok) {
                throw new Error(`Erreur ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.success) {
                this.team = data.team || [];
                console.log(`[PokemonManager] Équipe chargée: ${this.team.length} Pokémon`);
                return this.team;
            } else {
                console.warn('[PokemonManager] Erreur API:', data.error);
                return [];
            }
        } catch (error) {
            console.error('[PokemonManager] Erreur getTeam:', error);
            return [];
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Récupère les détails d'un Pokémon spécifique
     */
    async getPokemonDetail(pokemonId) {
        try {
            // Vérifier cache
            if (this.pokemonDetail[pokemonId]) {
                return this.pokemonDetail[pokemonId];
            }

            const response = await fetch(`${this.baseUrl}/api/pokemon/${pokemonId}`);
            
            if (!response.ok) {
                throw new Error(`Erreur ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                // Enrichir avec données espèce depuis PokéAPI
                const speciesData = await PokemonAPIManager.getPokemonData(data.pokemon.species_id);
                const pokemonFull = { 
                    ...data.pokemon, 
                    speciesData 
                };
                
                this.pokemonDetail[pokemonId] = pokemonFull;
                console.log(`[PokemonManager] Détails ${pokemonFull.nickname} chargés`);
                return pokemonFull;
            }
            
            return null;
        } catch (error) {
            console.error('[PokemonManager] Erreur getPokemonDetail:', error);
            return null;
        }
    }

    /**
     * Récupère les données d'une espèce (lazy fetch depuis PokéAPI)
     */
    async getSpecies(speciesId) {
        try {
            // Vérifier cache local
            if (this.speciesCache[speciesId]) {
                return this.speciesCache[speciesId];
            }

            // Si speciesId est un ObjectId MongoDB, extraire le pokedexId
            // Sinon supposer que c'est directement le pokedexId
            let pokedexId = speciesId;
            
            // Si c'est une chaîne longue (ObjectId), essayer de récupérer depuis serveur
            if (typeof speciesId === 'string' && speciesId.length > 10) {
                const response = await fetch(`${this.baseUrl}/api/pokemon/species/${speciesId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.species) {
                        pokedexId = data.species.pokedexId;
                    }
                }
            }

            // Fetch depuis PokéAPI
            const speciesData = await PokemonAPIManager.getPokemonData(pokedexId);
            
            if (speciesData) {
                this.speciesCache[speciesId] = speciesData;
                return speciesData;
            }
            
            return null;
        } catch (error) {
            console.error('[PokemonManager] Erreur getSpecies:', error);
            return null;
        }
    }

    /**
     * Crée un nouveau Pokémon pour le joueur
     */
    async createPokemon(playerId, speciesId, nickname = null, level = null) {
        try {
            this.isLoading = true;
            
            const response = await fetch(`${this.baseUrl}/api/pokemon/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId,
                    speciesId,
                    nickname: nickname || null,
                    level: level ?? null
                })
            });

            if (!response.ok) {
                throw new Error(`Erreur ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                console.log(`[PokemonManager] Pokémon créé: ${data.pokemon.nickname}`);
                this.team.push(data.pokemon);
                return data.pokemon;
            }
            
            return null;
        } catch (error) {
            console.error('[PokemonManager] Erreur createPokemon:', error);
            return null;
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Réorganise l'équipe du joueur
     */
    async reorderTeam(playerId, newOrder) {
        try {
            this.isLoading = true;

            const response = await fetch(`${this.baseUrl}/api/pokemon/team/reorder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId,
                    newOrder
                })
            });

            if (!response.ok) {
                throw new Error(`Erreur ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                console.log('[PokemonManager] Équipe réorganisée');
                // Recharger l'équipe pour avoir la BD à jour
                await this.getTeam(playerId);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('[PokemonManager] Erreur reorderTeam:', error);
            return false;
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Met à jour les stats d'un Pokémon
     */
    async updatePokemon(pokemonId, updates) {
        try {
            const response = await fetch(`${this.baseUrl}/api/pokemon/${pokemonId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });

            if (!response.ok) {
                throw new Error(`Erreur ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                console.log('[PokemonManager] Pokémon mis à jour');
                // Invalider cache
                delete this.pokemonDetail[pokemonId];
                return data.pokemon;
            }
            
            return null;
        } catch (error) {
            console.error('[PokemonManager] Erreur updatePokemon:', error);
            return null;
        }
    }

    /**
     * Récupère un Pokémon sauvage aléatoire (pour combats)
     */
    async getWildPokemon(mapId) {
        try {
            const response = await fetch(`${this.baseUrl}/api/pokemon/wild/${mapId}`);
            
            if (!response.ok) {
                return null;
            }

            const data = await response.json();
            
            if (data.success) {
                console.log(`[PokemonManager] Pokémon sauvage généré: ${data.pokemon.species_name} Lvl ${data.pokemon.level}`);
                return data.pokemon;
            }
            
            return null;
        } catch (error) {
            console.error('[PokemonManager] Erreur getWildPokemon:', error);
            return null;
        }
    }

    /**
     * Retourne le Pokémon actuellement en combat (position 0)
     */
    getActivePokemon() {
        return this.team.length > 0 ? this.team[0] : null;
    }

    /**
     * Retourne les Pokémon disponibles (pas en combat)
     */
    getAvailablePokemon() {
        return this.team.slice(1);
    }

    /**
     * Calcule les stats d'un Pokémon selon les formules Pokémon
     * Utilise l'utilitaire partagé pour garantir la cohérence avec le backend
     */
    calculateStats(pokemon, species, nature) {
        if (!pokemon || !species) return null;

        const level = pokemon.level || 1;
        const ivs = pokemon.ivs || {};
        const evs = pokemon.evs || {};
        const natureToUse = nature || pokemon.nature || 'hardy';

        // 🆕 Support pour les deux formats de species (frontend avec baseStats, backend avec stats)
        // Backend envoie parfois 'stats' au lieu de 'baseStats' dans l'objet species
        const baseStats = species.baseStats || species.stats || { hp: 45, attack: 45, defense: 45, sp_attack: 45, sp_defense: 45, speed: 45 };

        // Utiliser l'utilitaire partagé
        return calculateAllStats(baseStats, level, ivs, evs, natureToUse);
    }

    /**
     * Efface le cache
     */
    clearCache() {
        this.cache = {};
        this.pokemonDetail = {};
        console.log('[PokemonManager] Cache vidé');
    }

    /**
     * Retourne les Pokémon de l'équipe formatés pour l'affichage
     */
    async getFormattedTeam(playerId) {
        const team = await this.getTeam(playerId);
        const formatted = [];

        for (const pokemon of team) {
            const speciesData = await this.getSpecies(pokemon.species_id);
            
            formatted.push({
                ...pokemon,
                speciesData,
                healthPercent: (pokemon.hp / pokemon.maxHP) * 100
            });
        }

        return formatted;
    }

    /**
     * Récupère les mouvements d'un Pokémon avec détails
     */
    async getMoveDetails(moveset, speciesData) {
        if (!moveset || !speciesData?.moves) {
            return [];
        }

        return speciesData.moves.filter(m => moveset.includes(m.moveId)).slice(0, 4);
    }
}

export default PokemonManager;
