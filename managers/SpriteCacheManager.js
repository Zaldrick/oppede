/**
 * SpriteCacheManager (version serveur Node.js)
 * Cache en mémoire des sprites PokeAPI
 */

class SpriteCacheManager {
    constructor() {
        this.cache = new Map(); // speciesId -> sprites
        console.log('[SpriteCacheManager] Initialisé (serveur)');
    }

    /**
     * Récupère les sprites depuis le cache
     * @param {number} speciesId - ID du Pokémon
     * @returns {Object|null} Sprites ou null
     */
    getSprites(speciesId) {
        return this.cache.get(speciesId) || null;
    }

    /**
     * Met en cache les sprites d'un Pokémon
     * @param {number} speciesId - ID du Pokémon
     * @param {Object} sprites - Objet contenant menu, frontCombat, backCombat
     */
    setSprites(speciesId, sprites) {
        this.cache.set(speciesId, sprites);
        console.log(`[SpriteCacheManager] Sprites #${speciesId} mis en cache (${this.cache.size} entrées)`);
    }

    /**
     * Vide le cache
     */
    clearCache() {
        this.cache.clear();
        console.log('[SpriteCacheManager] Cache vidé');
    }

    /**
     * Récupère les stats du cache
     */
    getStats() {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys())
        };
    }
}

// Export singleton
module.exports = new SpriteCacheManager();
