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

    /**
     * 🆕 Détecte si une URL est un GIF animé
     * @param {string} url - URL du sprite
     * @returns {boolean}
     */
    static isAnimatedGif(url) {
        if (!url) return false;
        return url.includes('/animated/') && url.endsWith('.gif');
    }

    /**
     * 🆕 Affiche un GIF animé via DOM overlay
     * @param {Phaser.Scene} scene - Scène Phaser
     * @param {number} x - Position X (Phaser coordinates)
     * @param {number} y - Position Y (Phaser coordinates)
     * @param {string} gifUrl - URL du GIF
     * @param {number} width - Largeur en pixels
     * @param {number} height - Hauteur en pixels
     * @param {number} depth - Z-index (pour layer ordering)
     * @returns {Object} - { element: HTMLImageElement, container: HTMLDivElement }
     */
    static async displayAnimatedGif(scene, x, y, gifUrl, targetWidth, depth = 1) {
        return new Promise((resolve) => {
            // Créer image GIF temporaire pour obtenir dimensions réelles
            const tempImg = new Image();
            tempImg.crossOrigin = 'anonymous';
            
            tempImg.onload = () => {
                // Calculer dimensions finales (maintenir ratio)
                const aspectRatio = tempImg.height / tempImg.width;
                const finalWidth = targetWidth;
                const finalHeight = targetWidth * aspectRatio;
                
                // Créer container DOM
                const container = document.createElement('div');
                container.style.position = 'absolute';
                container.style.pointerEvents = 'none';
                container.style.zIndex = depth.toString();
                container.style.imageRendering = 'pixelated';
                
                // Créer image GIF définitive
                const img = document.createElement('img');
                img.src = gifUrl;
                img.style.width = `${finalWidth}px`;
                img.style.height = `${finalHeight}px`;
                img.style.imageRendering = 'pixelated';
                img.crossOrigin = 'anonymous';
                
                container.appendChild(img);
                
                // Ajouter au DOM (par-dessus le canvas Phaser)
                const gameCanvas = scene.game.canvas;
                gameCanvas.parentElement.appendChild(container);
                
                // Convertir coordonnées Phaser → DOM
                this.updateGifPosition(scene, container, x, y, finalWidth, finalHeight);
                
                // Stocker référence pour nettoyage
                if (!scene.gifContainers) scene.gifContainers = [];
                scene.gifContainers.push(container);
                
                console.log(`[SpriteLoader] ✅ GIF animé créé: ${finalWidth}x${finalHeight}px`, gifUrl);
                
                resolve({ element: img, container, width: finalWidth, height: finalHeight, naturalWidth: tempImg.width, naturalHeight: tempImg.height });
            };
            
            tempImg.onerror = () => {
                console.error(`[SpriteLoader] Erreur chargement GIF:`, gifUrl);
                resolve({ element: null, container: null, width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
            };
            
            tempImg.src = gifUrl;
        });
    }

    /**
     * 🆕 Met à jour la position d'un GIF (coordonnées Phaser → DOM)
     */
    static updateGifPosition(scene, container, x, y, width, height) {
        const gameCanvas = scene.game.canvas;
        const canvasRect = gameCanvas.getBoundingClientRect();
        
        // Calculer position DOM (centre du sprite)
        const domX = canvasRect.left + (x / scene.scale.width) * canvasRect.width - width / 2;
        const domY = canvasRect.top + (y / scene.scale.height) * canvasRect.height - height / 2;
        
        container.style.left = `${domX}px`;
        container.style.top = `${domY}px`;
    }

    /**
     * 🆕 Supprime un container GIF du DOM
     */
    static removeAnimatedGif(container) {
        if (container && container.parentElement) {
            container.parentElement.removeChild(container);
        }
    }

    /**
     * 🆕 Masque tous les GIFs de la scène
     */
    static hideAllGifs(scene) {
        if (scene.gifContainers) {
            scene.gifContainers.forEach(c => c.style.display = 'none');
        }
    }

    /**
     * 🆕 Réaffiche tous les GIFs de la scène
     */
    static showAllGifs(scene) {
        if (scene.gifContainers) {
            scene.gifContainers.forEach(c => c.style.display = 'block');
        }
    }

    /**
     * 🆕 MÉTHODE GÉNÉRIQUE - Affiche un sprite (GIF ou PNG)
     * Détecte automatiquement le type et utilise la bonne méthode
     * @param {Phaser.Scene} scene
     * @param {number} x
     * @param {number} y
     * @param {string} spriteUrl
     * @param {string} fallbackText
     * @param {number} scale
     * @param {number} depth
     * @param {boolean} useAnimated - Force l'utilisation de GIF (défaut: auto-detect)
     * @returns {Promise<Object>} - { type: 'phaser'|'gif', sprite: ..., container: ..., x, y, scale, depth }
     */
    static async displaySpriteAuto(scene, x, y, spriteUrl, fallbackText, scale, depth, useAnimated = null) {
        const shouldUseGif = useAnimated !== null ? useAnimated : this.isAnimatedGif(spriteUrl);
        
        if (shouldUseGif && this.isAnimatedGif(spriteUrl)) {
            // GIF animé
            // 🆕 Calculer taille responsive: base sur largeur écran
            const screenWidth = scene.scale.width;
            const targetWidth = screenWidth * 0.12 * scale; // 12% de l'écran * multiplicateur
            
            const gif = await this.displayAnimatedGif(scene, x, y, spriteUrl, targetWidth, depth);
            
            return {
                type: 'gif',
                sprite: null,
                gifContainer: gif.container,
                gifElement: gif.element,
                displayWidth: gif.width,
                displayHeight: gif.height,
                naturalWidth: gif.naturalWidth,
                naturalHeight: gif.naturalHeight,
                x, y, scale, depth
            };
        } else {
            // Sprite statique (existant)
            const sprite = await this.displaySprite(scene, x, y, spriteUrl, fallbackText, scale);
            
            if (sprite && sprite.setDepth) {
                sprite.setDepth(depth);
            }
            
            return {
                type: 'phaser',
                sprite: sprite,
                gifContainer: null,
                gifElement: null,
                displayWidth: sprite?.displayWidth || 0,
                displayHeight: sprite?.displayHeight || 0,
                x, y, scale, depth
            };
        }
    }
}

export default SpriteLoader;
