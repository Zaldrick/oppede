/**
 * spriteLoader.js
 * Utilitaire pour charger et afficher les sprites Pokémon depuis URLs
 * Utilise une technique de canvas pour éviter les limitations CORS/texture key
 */

export class SpriteLoader {
    /**
     * Charge une image depuis une URL et la stocke comme texture Phaser
     * @param {Phaser.Scene} scene - Scène Phaser courante
     * @param {string} url - URL de l'image
     * @param {string} key - Clé texture unique (ex: "pokemon_1_menu")
     * @returns {Promise<boolean>} true si succès
     */
    static async loadAndCacheSprite(scene, url, key) {
        return new Promise((resolve) => {
            if (!url) {
                console.warn(`[SpriteLoader] URL vide pour ${key}`);
                resolve(false);
                return;
            }

            // Vérifier si déjà chargé
            if (scene.textures.exists(key)) {
                console.log(`[SpriteLoader] ${key} déjà en cache`);
                resolve(true);
                return;
            }

            // Créer une image temporaire pour charger l'URL
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                try {
                    // Créer un canvas et copier l'image dedans
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    
                    // Créer une texture Phaser depuis le canvas
                    scene.textures.addCanvas(key, canvas);
                    console.log(`[SpriteLoader] ✅ ${key} (${img.width}x${img.height}) chargé`);
                    resolve(true);
                } catch (e) {
                    console.error(`[SpriteLoader] Erreur texture ${key}:`, e);
                    resolve(false);
                }
            };

            img.onerror = () => {
                console.warn(`[SpriteLoader] Impossible de charger ${key}:`, url);
                resolve(false);
            };

            img.src = url;
        });
    }

    /**
     * Crée et affiche un sprite à partir d'une URL
     * Charge automatiquement si nécessaire
     * @param {Phaser.Scene} scene - Scène Phaser
     * @param {number} x - Position X
     * @param {number} y - Position Y
     * @param {string} spriteUrl - URL du sprite
     * @param {string} fallbackText - Texte de secours si chargement échoue
     * @param {number} scale - Échelle (défaut 1)
     * @returns {Promise<Phaser.GameObjects.Image|Phaser.GameObjects.Text>}
     */
    static async displaySprite(scene, x, y, spriteUrl, fallbackText = '?', scale = 1) {
        if (!spriteUrl) {
            // Pas d'URL, afficher texte
            return scene.add.text(x, y, fallbackText, {
                fontSize: '16px',
                fill: '#FFD700',
                fontStyle: 'bold'
            }).setOrigin(0.5);
        }

        // Générer clé unique
        const key = this.generateKey(spriteUrl);

        // Charger la texture
        const loaded = await this.loadAndCacheSprite(scene, spriteUrl, key);

        if (loaded) {
            try {
                return scene.add.image(x, y, key)
                    .setScale(scale)
                    .setOrigin(0.5);
            } catch (e) {
                console.error('[SpriteLoader] Erreur création image:', e);
                return scene.add.text(x, y, fallbackText, {
                    fontSize: '16px',
                    fill: '#FFD700',
                    fontStyle: 'bold'
                }).setOrigin(0.5);
            }
        } else {
            // Fallback: afficher initiales ou texte
            return scene.add.text(x, y, fallbackText, {
                fontSize: '16px',
                fill: '#FFD700',
                fontStyle: 'bold'
            }).setOrigin(0.5);
        }
    }

    /**
     * Génère une clé de texture safe à partir d'une URL
     * @param {string} url - URL du sprite
     * @returns {string} Clé unique et valide
     */
    static generateKey(url) {
        if (!url) return 'sprite_unknown';
        
        // Hash simple basée sur l'URL
        let hash = 0;
        for (let i = 0; i < url.length; i++) {
            const char = url.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        
        return `sprite_${Math.abs(hash)}`;
    }

    /**
     * Pré-charge plusieurs sprites en parallèle
     * @param {Phaser.Scene} scene - Scène Phaser
     * @param {Array} spriteUrls - Liste des URLs à charger
     * @returns {Promise<number>} Nombre de sprites chargés avec succès
     */
    static async preloadSprites(scene, spriteUrls) {
        const results = await Promise.all(
            spriteUrls
                .filter(url => url) // Filtrer URLs vides
                .map(url => {
                    const key = this.generateKey(url);
                    return this.loadAndCacheSprite(scene, url, key);
                })
        );

        const successCount = results.filter(r => r).length;
        console.log(`[SpriteLoader] ${successCount}/${spriteUrls.length} sprites pré-chargés`);
        return successCount;
    }
}

export default SpriteLoader;
