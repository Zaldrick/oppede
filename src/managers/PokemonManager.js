/**
 * PokemonManager.js - Client-side Pokémon Manager
 * Gère les appels API pour les Pokémon du joueur + fetch lazy depuis PokéAPI
 * Caching local + synchronisation serveur
 */

import PokemonAPIManager from './PokemonAPIManager';

class PokemonManager {
    constructor(socket) {
        this.socket = socket;
        this.baseUrl = process.env.REACT_APP_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:5000';
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
    async createPokemon(playerId, speciesId, nickname = null) {
        try {
            this.isLoading = true;
            
            const response = await fetch(`${this.baseUrl}/api/pokemon/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId,
                    speciesId,
                    nickname: nickname || null
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
     */
    calculateStats(pokemon, species, nature) {
        if (!pokemon || !species) return null;

        const level = pokemon.level || 1;
        const ivs = pokemon.ivs || {};
        const evs = pokemon.evs || {};

        // Multiplicateur nature
        const natures = {
            timid: { increase: 'speed', decrease: 'attack' },
            bold: { increase: 'defense', decrease: 'attack' },
            hardy: { increase: null, decrease: null },
            // ... ajouter les 25 natures au besoin
        };

        const natureData = natures[nature] || natures.hardy;

        // Formule HP : ((2 * base + IV + EV/4) * level/100 + level + 5)
        const hp = Math.floor((2 * species.baseStats.hp + (ivs.hp || 0) + (evs.hp || 0) / 4) * level / 100 + level + 5);

        // Formule autres stats
        const calculateStat = (base, iv, ev, stat) => {
            const multiplier = stat === natureData.increase ? 1.1 : (stat === natureData.decrease ? 0.9 : 1.0);
            return Math.floor(((2 * base + (iv || 0) + (ev || 0) / 4) * level / 100 + 5) * multiplier);
        };

        return {
            hp,
            attack: calculateStat(species.baseStats.attack, ivs.attack, evs.attack, 'attack'),
            defense: calculateStat(species.baseStats.defense, ivs.defense, evs.defense, 'defense'),
            sp_attack: calculateStat(species.baseStats.sp_attack, ivs.sp_attack, evs.sp_attack, 'sp_attack'),
            sp_defense: calculateStat(species.baseStats.sp_defense, ivs.sp_defense, evs.sp_defense, 'sp_defense'),
            speed: calculateStat(species.baseStats.speed, ivs.speed, evs.speed, 'speed')
        };
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
