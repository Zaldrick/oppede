/**
 * spriteCacheManager.js
 * Gère le cache persistant des URLs de sprites PokeAPI
 * Évite de refaire les appels API à chaque chargement
 */

export class SpriteCacheManager {
    static CACHE_KEY = 'pokemon_sprite_cache';
    static CACHE_VERSION = '1.0';
    static MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 jours en millisecondes

    /**
     * Initialise le cache depuis localStorage
     * @returns {Object} Cache existant ou nouveau
     */
    static initCache() {
        try {
            const stored = localStorage.getItem(this.CACHE_KEY);
            if (!stored) {
                return this.createNewCache();
            }

            const cache = JSON.parse(stored);
            
            // Vérifier version et expiration
            if (cache.version !== this.CACHE_VERSION) {
                console.log('[SpriteCache] Version obsolète, recréation cache');
                return this.createNewCache();
            }

            const age = Date.now() - cache.createdAt;
            if (age > this.MAX_CACHE_AGE) {
                console.log('[SpriteCache] Cache expiré, recréation');
                return this.createNewCache();
            }

            console.log(`[SpriteCache] Cache chargé: ${Object.keys(cache.sprites).length} sprites`);
            return cache;
        } catch (e) {
            console.error('[SpriteCache] Erreur lecture cache:', e);
            return this.createNewCache();
        }
    }

    /**
     * Crée un nouveau cache vide
     */
    static createNewCache() {
        return {
            version: this.CACHE_VERSION,
            createdAt: Date.now(),
            sprites: {} // format: { speciesId_type: url }
        };
    }

    /**
     * Récupère l'URL d'un sprite depuis le cache
     * @param {number} speciesId - ID du Pokémon
     * @param {string} type - Type de sprite ('front', 'back', 'frontShiny', 'backShiny')
     * @returns {string|null} URL du sprite ou null si absent
     */
    static getSpriteUrl(speciesId, type = 'front') {
        const cache = this.initCache();
        const key = `${speciesId}_${type}`;
        return cache.sprites[key] || null;
    }

    /**
     * Enregistre l'URL d'un sprite dans le cache
     * @param {number} speciesId - ID du Pokémon
     * @param {string} type - Type de sprite
     * @param {string} url - URL du sprite
     */
    static setSpriteUrl(speciesId, type, url) {
        try {
            const cache = this.initCache();
            const key = `${speciesId}_${type}`;
            cache.sprites[key] = url;
            localStorage.setItem(this.CACHE_KEY, JSON.stringify(cache));
            console.log(`[SpriteCache] ✅ Sprite ${key} mis en cache`);
        } catch (e) {
            console.error('[SpriteCache] Erreur sauvegarde:', e);
        }
    }

    /**
     * Enregistre tous les sprites d'un Pokémon
     * @param {number} speciesId - ID du Pokémon
     * @param {Object} sprites - Objet contenant front, back, frontShiny, backShiny
     */
    static setCachedSprites(speciesId, sprites) {
        if (sprites.front) this.setSpriteUrl(speciesId, 'front', sprites.front);
        if (sprites.back) this.setSpriteUrl(speciesId, 'back', sprites.back);
        if (sprites.frontShiny) this.setSpriteUrl(speciesId, 'frontShiny', sprites.frontShiny);
        if (sprites.backShiny) this.setSpriteUrl(speciesId, 'backShiny', sprites.backShiny);
    }

    /**
     * Récupère tous les sprites d'un Pokémon depuis le cache
     * @param {number} speciesId - ID du Pokémon
     * @returns {Object|null} Objet sprites ou null si aucun sprite trouvé
     */
    static getCachedSprites(speciesId) {
        const front = this.getSpriteUrl(speciesId, 'front');
        const back = this.getSpriteUrl(speciesId, 'back');
        const frontShiny = this.getSpriteUrl(speciesId, 'frontShiny');
        const backShiny = this.getSpriteUrl(speciesId, 'backShiny');

        // Retourner null si aucun sprite trouvé
        if (!front && !back && !frontShiny && !backShiny) {
            return null;
        }

        return { front, back, frontShiny, backShiny };
    }

    /**
     * Vide complètement le cache
     */
    static clearCache() {
        try {
            localStorage.removeItem(this.CACHE_KEY);
            console.log('[SpriteCache] Cache vidé');
        } catch (e) {
            console.error('[SpriteCache] Erreur vidage cache:', e);
        }
    }

    /**
     * Récupère les statistiques du cache
     * @returns {Object} Stats du cache
     */
    static getCacheStats() {
        const cache = this.initCache();
        const age = Date.now() - cache.createdAt;
        const ageInDays = Math.floor(age / (24 * 60 * 60 * 1000));

        return {
            version: cache.version,
            spriteCount: Object.keys(cache.sprites).length,
            ageInDays,
            createdAt: new Date(cache.createdAt).toLocaleString(),
            sizeKB: new Blob([JSON.stringify(cache)]).size / 1024
        };
    }

    /**
     * Fetch les sprites depuis PokeAPI et les met en cache
     * @param {number} speciesId - ID du Pokémon
     * @returns {Promise<Object>} Objet sprites
     */
    static async fetchAndCacheSprites(speciesId) {
        try {
            console.log(`[SpriteCache] Fetch PokeAPI pour Pokémon ${speciesId}...`);
            const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}`);
            
            if (!response.ok) {
                throw new Error(`PokeAPI error: ${response.status}`);
            }

            const data = await response.json();
            const sprites = {
                front: data.sprites?.front_default || null,
                back: data.sprites?.back_default || null,
                frontShiny: data.sprites?.front_shiny || null,
                backShiny: data.sprites?.back_shiny || null
            };

            // Mettre en cache
            this.setCachedSprites(speciesId, sprites);

            return sprites;
        } catch (error) {
            console.error(`[SpriteCache] Erreur fetch Pokémon ${speciesId}:`, error);
            return { front: null, back: null, frontShiny: null, backShiny: null };
        }
    }

    /**
     * Récupère les sprites (cache → API si nécessaire)
     * @param {number} speciesId - ID du Pokémon
     * @param {boolean} forceRefresh - Forcer le refresh depuis l'API
     * @returns {Promise<Object>} Objet sprites
     */
    static async getSprites(speciesId, forceRefresh = false) {
        if (!forceRefresh) {
            const cached = this.getCachedSprites(speciesId);
            if (cached) {
                console.log(`[SpriteCache] ✅ Sprites ${speciesId} depuis cache`);
                return cached;
            }
        }

        // Pas en cache ou refresh forcé → fetch API
        return await this.fetchAndCacheSprites(speciesId);
    }
}

export default SpriteCacheManager;

// Exposer dans window pour debug console
if (typeof window !== 'undefined') {
    window.SpriteCacheManager = SpriteCacheManager;
    console.log('💾 SpriteCacheManager disponible dans window.SpriteCacheManager');
    console.log('📊 Commandes disponibles:');
    console.log('  - window.SpriteCacheManager.getCacheStats() : Stats du cache');
    console.log('  - window.SpriteCacheManager.clearCache() : Vider le cache');
}
