/**
 * BattleSpriteManager.js
 * Gère la création et manipulation des sprites Pokémon
 * 
 * Responsabilités:
 * - Création sprites joueur et adversaire
 * - Recreation sprite après switch
 * - Gestion des ombres
 * - Z-index des sprites
 */

import SpriteLoader from '../utils/spriteLoader';
import getPokemonDisplayName from '../utils/getDisplayName';

export default class BattleSpriteManager {
    constructor(scene) {
        this.scene = scene;
    }

    /**
     * 🆕 Détruit un sprite (GÉNÉRIQUE - GIF ou PNG)
     */
    destroySprite(spriteData) {
        if (!spriteData) return;
        
        if (spriteData.type === 'phaser' && spriteData.sprite) {
            spriteData.sprite.destroy();
        } else if (spriteData.type === 'gif' && spriteData.gifContainer) {
            SpriteLoader.removeAnimatedGif(spriteData.gifContainer);
        }
    }

    /**
     * 🆕 Anime l'apparition d'un sprite (GÉNÉRIQUE)
     */
    async fadeInSprite(spriteData, shadow, duration = 500) {
        if (spriteData.type === 'phaser' && spriteData.sprite) {
            const targets = shadow ? [spriteData.sprite, shadow] : [spriteData.sprite];
            return new Promise(resolve => {
                this.scene.tweens.add({
                    targets: targets,
                    alpha: 1,
                    duration,
                    ease: 'Power2',
                    onComplete: resolve
                });
            });
        } else if (spriteData.type === 'gif' && spriteData.gifContainer) {
            return new Promise(resolve => {
                // Animation CSS pour GIF
                spriteData.gifContainer.style.transition = `opacity ${duration}ms ease`;
                spriteData.gifContainer.style.opacity = '1';
                
                if (shadow) {
                    this.scene.tweens.add({
                        targets: shadow,
                        alpha: 1,
                        duration,
                        ease: 'Power2',
                        onComplete: resolve
                    });
                } else {
                    setTimeout(resolve, duration);
                }

            });
        }
    }

    /**
     * Animate entrance of sprite either by sliding from off-screen or fade.
     * Supports both Phaser (spriteData.type === 'phaser') and GIF (type === 'gif').
     * @param {Object} spriteData
     * @param {Phaser.GameObjects.Graphics} shadow
     * @param {number} duration
     * @param {'left'|'right'} fromSide - side the sprite will come from; 'left' slides in from left, 'right' from right.
     */
    async animateEntrance(spriteData, shadow, duration = 600, fromSide = 'left') {
        if (!spriteData) return;

        const scene = this.scene;
        const width = scene.scale.width;
        const margin = 40; // px

        if (spriteData.type === 'phaser' && spriteData.sprite) {
            const sprite = spriteData.sprite;
            // Determine off-screen X
            const spriteHalf = (sprite.displayWidth || 96) / 2;
            const targetX = sprite.x;
            const offscreenX = fromSide === 'left' ? -spriteHalf - margin : width + spriteHalf + margin;
            // Set initial
            sprite.x = offscreenX;
            sprite.setAlpha(1);
            return new Promise(resolve => {
                scene.tweens.add({
                    targets: sprite,
                    x: targetX,
                    duration,
                    ease: 'Back.easeOut',
                    onComplete: () => resolve(true)
                });
                if (shadow) {
                    // Animate shadow alpha and keep it in sync
                    scene.tweens.add({ targets: shadow, alpha: 1, duration });
                }
            });
        } else if (spriteData.type === 'gif' && spriteData.gifContainer) {
            const container = spriteData.gifContainer;
            // Compute DOM positions
            const gameCanvas = scene.game.canvas;
            const canvasRect = gameCanvas.getBoundingClientRect();
            const domWidth = canvasRect.width;
            const domHeight = canvasRect.height;
            const targetDomX = canvasRect.left + (spriteData.x / scene.scale.width) * domWidth - (spriteData.displayWidth / 2);
            const targetDomY = canvasRect.top + (spriteData.y / scene.scale.height) * domHeight - (spriteData.displayHeight / 2);
            const offDomX = fromSide === 'left' ? -spriteData.displayWidth - margin + canvasRect.left : canvasRect.left + canvasRect.width + margin;
            // Apply initial state
            container.style.left = `${offDomX}px`;
            container.style.top = `${targetDomY}px`;
            container.style.opacity = '1';
            container.style.transition = `left ${duration}ms cubic-bezier(0.68, -0.55, 0.265, 1.55)`;
            return new Promise(resolve => {
                // Force reflow then set target
                void container.offsetWidth;
                container.style.left = `${targetDomX}px`;
                setTimeout(() => resolve(true), duration + 20);
            });
        }
        // fallback: no animation
        return true;
    }

    /**
     * 🆕 Crée le sprite adversaire (GÉNÉRIQUE - GIF ou PNG)
     */
    async createOpponentSprite(width, height) {
        const opponent = this.scene.battleState.opponentActive;
        const opponentSpriteX = width * 0.68;
        const opponentSpriteY = height * 0.26;
        
        if (opponent.sprites && opponent.sprites.frontCombat) {
            try {
                // 🆕 Utiliser la méthode générique
                const result = await SpriteLoader.displaySpriteAuto(
                    this.scene,
                    opponentSpriteX,
                    opponentSpriteY,
                    opponent.sprites.frontCombat,
                    getPokemonDisplayName(opponent).substring(0, 2),
                    2.5,
                    5, // depth
                    this.scene.useAnimatedSprites, // Option globale
                    { alpha: 0 } // 🆕 Démarrer invisible pour éviter le flash/double animation
                );
                
                // Stocker les références (unifiées)
                this.scene.opponentSpriteData = result;
                
                if (result.type === 'phaser') {
                    this.scene.opponentSprite = result.sprite;
                    result.sprite.setAlpha(0);
                } else if (result.type === 'gif') {
                    this.scene.opponentGifContainer = result.gifContainer;
                    result.gifContainer.style.opacity = '0';
                }
                
                // Ombre (identique pour les deux)
                const shadow = this.scene.add.graphics();
                shadow.fillStyle(0x000000, 0.6);
                
                // 🆕 Utiliser les dimensions réelles (Phaser ou GIF)
                const spriteWidth = result.displayWidth || 96;
                const spriteHeight = result.displayHeight || 96;
                
                // 🆕 LIMITER LA TAILLE DU SPRITE (Responsive)
                // Adversaire (face) = un peu plus petit
                const maxWidth = Math.max(width * 0.45, 300); 
                const maxHeight = Math.max(height * 0.50, 300);
                
                if (result.type === 'phaser' && result.sprite) {
                    // NOUVELLE LOGIQUE RESPONSIVE (Portrait vs Landscape)
                    const isPortrait = height > width;
                    let finalScale;

                    if (isPortrait) {
                        // En portrait, on se base sur la LARGEUR pour éviter que le sprite ne déborde
                        // On veut que le sprite prenne environ 40% de la largeur de l'écran
                        const targetWidth = maxWidth * 0.45;
                        // On estime la taille de base du sprite à 96px pour le calcul du scale
                        finalScale = targetWidth / 96;
                    } else {
                        // En landscape, on se base sur la HAUTEUR (logique précédente)
                        const referenceHeight = 1080;
                        const screenScale = height / referenceHeight;
                        const baseScale = 4 ; 
                        finalScale = baseScale * screenScale;
                    }
                    
                    // Appliquer l'échelle
                    result.sprite.setScale(finalScale);

                    // Sécurité : si le sprite devient vraiment trop grand (ex: dépasse 50% de l'écran), on le cap
                    if (result.sprite.displayHeight > maxHeight) {
                        const clampScale = maxHeight / result.sprite.height;
                        result.sprite.setScale(clampScale);
                    }
                } else if (result.type === 'gif' && result.gifContainer) {
                    // NOUVELLE LOGIQUE RESPONSIVE (Portrait vs Landscape)
                    const isPortrait = height > width;
                    let finalScale;

                    if (isPortrait) {
                        const targetWidth = width * 0.40;
                        finalScale = targetWidth / 96;
                    } else {
                        const referenceHeight = 1080;
                        const screenScale = height / referenceHeight;
                        const baseScale = 4 ; 
                        finalScale = baseScale * screenScale;
                    }

                    // Reset des contraintes précédentes
                    result.gifContainer.style.width = 'auto';
                    result.gifContainer.style.height = 'auto';
                    result.gifContainer.style.minHeight = '0'; 
                    result.gifContainer.style.maxWidth = 'none';
                    result.gifContainer.style.maxHeight = 'none';
                    
                    // Application de l'échelle
                    result.gifContainer.style.transform = `scale(${finalScale})`;
                    result.gifContainer.style.transformOrigin = 'center center';
                }

                // 🆕 CALCUL DE L'OMBRE APRÈS REDIMENSIONNEMENT
                // On récupère les dimensions réelles affichées
                let displayWidth = 96;
                let displayHeight = 96;

                if (result.type === 'phaser' && result.sprite) {
                    displayWidth = result.sprite.displayWidth;
                    displayHeight = result.sprite.displayHeight;
                } else if (result.type === 'gif' && result.gifContainer) {
                    // Estimation pour le GIF (car le DOM n'est pas encore rendu)
                    // On utilise la taille max comme référence si on ne peut pas mesurer
                    displayWidth = Math.min(spriteWidth, maxWidth);
                    displayHeight = Math.min(spriteHeight, maxHeight);
                }

                const shadowSize = {
                    width: displayWidth * 0.8,
                    height: displayHeight * 0.15,
                    offsetY: displayHeight * 0.45
                };
                
                shadow.fillEllipse(opponentSpriteX, opponentSpriteY + shadowSize.offsetY, shadowSize.width, shadowSize.height);
                shadow.setDepth(0);
                this.scene.opponentShadow = shadow;

                // No animation or cry here; animations are handled by BattleAnimationManager to avoid duplicates.
                
            } catch (error) {
                console.error('[BattleSpriteManager] Erreur sprite adversaire:', error);
            }
        }
    }

    /**
     * 🆕 Crée le sprite joueur (GÉNÉRIQUE - GIF ou PNG)
     */
    async createPlayerSprite(width, height) {
        const player = this.scene.battleState.playerActive;
        const playerSpriteX = width * 0.22;
        const playerSpriteY = height * 0.45;
        
        if (player.sprites && player.sprites.backCombat) {
            try {
                // 🆕 Utiliser la méthode générique
                const result = await SpriteLoader.displaySpriteAuto(
                    this.scene,
                    playerSpriteX,
                    playerSpriteY,
                    player.sprites.backCombat,
                    getPokemonDisplayName(player).substring(0, 2),
                    3,
                    1, // depth
                    this.scene.useAnimatedSprites, // Option globale
                    { alpha: 0 } // 🆕 Démarrer invisible pour éviter le flash/double animation
                );
                
                // Stocker les références (unifiées)
                this.scene.playerSpriteData = result;
                
                if (result.type === 'phaser') {
                    this.scene.playerSprite = result.sprite;
                    result.sprite.setAlpha(0);
                } else if (result.type === 'gif') {
                    this.scene.playerGifContainer = result.gifContainer;
                    result.gifContainer.style.opacity = '0';
                }
                
                // Ombre (identique pour les deux)
                const shadow = this.scene.add.graphics();
                shadow.fillStyle(0x000000, 0.6);
                
                // 🆕 Utiliser les dimensions réelles (Phaser ou GIF)
                const spriteWidth = result.displayWidth || 96;
                const spriteHeight = result.displayHeight || 96;

                // 🆕 LIMITER LA TAILLE DU SPRITE (Responsive)
                // Joueur (dos) = plus grand pour perspective
                const maxWidth = Math.max(width * 0.55, 400);
                const maxHeight = Math.max(height * 0.60, 400);
                
                if (result.type === 'phaser' && result.sprite) {
                    // NOUVELLE LOGIQUE RESPONSIVE (Portrait vs Landscape)
                    const isPortrait = height > width;
                    let finalScale;

                    if (isPortrait) {
                        // En portrait, on se base sur la LARGEUR
                        // Le joueur est plus proche, on lui donne 55% de la largeur
                        const targetWidth = maxWidth * 0.55;
                        finalScale = targetWidth / 96;
                    } else {
                        // En landscape, on se base sur la HAUTEUR
                        const referenceHeight = 1080;
                        const screenScale = height / referenceHeight;
                        const baseScale = 4 ; 
                        finalScale = baseScale * screenScale;
                    }
                    
                    // Appliquer l'échelle
                    result.sprite.setScale(finalScale);

                    // Sécurité : si le sprite devient vraiment trop grand
                    if (result.sprite.displayHeight > maxHeight) {
                        const clampScale = maxHeight / result.sprite.height;
                        result.sprite.setScale(clampScale);
                    }

                } else if (result.type === 'gif' && result.gifContainer) {
                    // Pour les GIFs, on force la taille CSS
                    result.gifContainer.style.width = 'auto'; // Garder ratio
                    result.gifContainer.style.height = 'auto';
                    // Max limits
                    result.gifContainer.style.maxWidth = `${maxWidth}px`;
                    result.gifContainer.style.maxHeight = `${maxHeight}px`;
                    
                    // Min limits (pour éviter les GIFs minuscules sur 4K)
                    result.gifContainer.style.minHeight = `${height * 0.25}px`;
                }

                // 🆕 CALCUL DE L'OMBRE APRÈS REDIMENSIONNEMENT
                let displayWidth = 96;
                let displayHeight = 96;

                if (result.type === 'phaser' && result.sprite) {
                    displayWidth = result.sprite.displayWidth;
                    displayHeight = result.sprite.displayHeight;
                } else if (result.type === 'gif' && result.gifContainer) {
                    displayWidth = Math.min(spriteWidth, maxWidth);
                    displayHeight = Math.min(spriteHeight, maxHeight);
                }

                const shadowSize = {
                    width: displayWidth * 0.85,
                    height: displayHeight * 0.15,
                    offsetY: displayHeight * 0.45
                };
                
                shadow.fillEllipse(playerSpriteX, playerSpriteY + shadowSize.offsetY, shadowSize.width, shadowSize.height);
                shadow.setDepth(0);
                this.scene.playerShadow = shadow;
                // Do not animate or play cry here; animations are centralized in BattleAnimationManager to avoid duplicates.
            } catch (error) {
                console.error('[BattleSpriteManager] Erreur sprite joueur:', error);
            }
        }
    }

    /**
     * Recrée le sprite joueur après switch
     */
    async recreatePlayerSprite(pokemon) {
        // 🔧 FIXE: Rediriger vers la méthode générique qui supporte les GIFs
        return this.createOrUpdatePlayerSprite(pokemon, true);
    }

    /**
     * 🆕 Crée/Recrée le sprite joueur avec animation (GÉNÉRIQUE pour init + switch - GIF ou PNG)
     * @param {Object} pokemon - Données du Pokémon
     * @param {boolean} animate - Si true, anime l'apparition
     */
    async createOrUpdatePlayerSprite(pokemon, animate = true) {
        const { width, height } = this.scene.scale;
        const playerSpriteX = width * 0.22;
        const playerSpriteY = height * 0.45;
        
        // Détruire ancien sprite si existe (GIF ou PNG)
        if (this.scene.playerSpriteData) {
            this.destroySprite(this.scene.playerSpriteData);
        }
        if (this.scene.playerSprite) this.scene.playerSprite.destroy();
        if (this.scene.playerShadow) this.scene.playerShadow.destroy();
        
        if (pokemon.sprites && pokemon.sprites.backCombat) {
            try {
                // 🆕 Utiliser la méthode générique
                const result = await SpriteLoader.displaySpriteAuto(
                    this.scene,
                    playerSpriteX,
                    playerSpriteY,
                    pokemon.sprites.backCombat,
                    pokemon.nickname?.substring(0, 2) || getPokemonDisplayName(pokemon).substring(0, 2) || 'PK',
                    3,
                    1, // depth
                    this.scene.useAnimatedSprites // Option globale
                );
                
                // Stocker les références
                this.scene.playerSpriteData = result;
                
                if (result.type === 'phaser') {
                    this.scene.playerSprite = result.sprite;
                    result.sprite.setAlpha(animate ? 0 : 1);
                } else if (result.type === 'gif') {
                    this.scene.playerGifContainer = result.gifContainer;
                    result.gifContainer.style.opacity = animate ? '0' : '1';
                }
                
                // Créer ombre
                const shadow = this.scene.add.graphics();
                shadow.fillStyle(0x000000, 0.6);
                
                // 🆕 LIMITER LA TAILLE DU SPRITE (Responsive)
                // Joueur (dos) = plus grand pour perspective
                const maxWidth = Math.max(width * 0.55, 400);
                const maxHeight = Math.max(height * 0.60, 400);
                
                if (result.type === 'phaser' && result.sprite) {
                    // NOUVELLE LOGIQUE RESPONSIVE (Portrait vs Landscape)
                    const isPortrait = height > width;
                    let finalScale;

                    if (isPortrait) {
                        // En portrait, on se base sur la LARGEUR
                        // Le joueur est plus proche, on lui donne 55% de la largeur
                        const targetWidth = maxWidth * 0.55;
                        finalScale = targetWidth / 96;
                    } else {
                        // En landscape, on se base sur la HAUTEUR
                        const referenceHeight = 1080;
                        const screenScale = height / referenceHeight;
                        const baseScale = 5.2; 
                        finalScale = baseScale * screenScale;
                    }
                    
                    // Appliquer l'échelle
                    result.sprite.setScale(finalScale);

                    // Sécurité : si le sprite devient vraiment trop grand
                    if (result.sprite.displayHeight > maxHeight) {
                        const clampScale = maxHeight / result.sprite.height;
                        result.sprite.setScale(clampScale);
                    }
                } else if (result.type === 'gif' && result.gifContainer) {
                    // NOUVELLE LOGIQUE RESPONSIVE (Portrait vs Landscape)
                    const isPortrait = height > width;
                    let finalScale;

                    if (isPortrait) {
                        const targetWidth = maxWidth * 0.5;
                        finalScale = targetWidth / 96;
                    } else {
                        const referenceHeight = 1080;
                        const screenScale = height / referenceHeight;
                        const baseScale = 5.2; 
                        finalScale = baseScale * screenScale;
                    }
                    

                    // Reset des contraintes précédentes
                    result.gifContainer.style.width = 'auto';
                    result.gifContainer.style.height = 'auto';
                    result.gifContainer.style.minHeight = '0'; 
                    result.gifContainer.style.maxWidth = 'none';
                    result.gifContainer.style.maxHeight = 'none';
                    
                    // Application de l'échelle
                    result.gifContainer.style.transform = `scale(${finalScale})`;
                    result.gifContainer.style.transformOrigin = 'center center';
                }

                const shadowSize = result.type === 'phaser' && result.sprite 
                    ? { width: result.sprite.displayWidth * 0.85, height: result.sprite.displayHeight * 0.15, offsetY: result.sprite.displayHeight * 0.45 }
                    : { width: 90, height: 15, offsetY: 50 };
                shadow.fillEllipse(playerSpriteX, playerSpriteY + shadowSize.offsetY, shadowSize.width, shadowSize.height);
                shadow.setDepth(0);
                this.scene.playerShadow = shadow;
                shadow.setAlpha(animate ? 0 : 1);
                
                // Animation entrée si demandé (et play cry at the end)
                if (animate) {
                    try {
                        // Slide the player sprite in from the left to match PNJ-style motion
                        await this.animateEntrance(result, shadow, 500, 'left');
                        if (this.scene && this.scene.soundManager) {
                            try {
                                console.debug(`[BattleSpriteManager] Requesting player cry for ${pokemon.species_id}`);
                                const played = await this.scene.soundManager.playPokemonCry(pokemon.species_id);
                                console.debug(`[BattleSpriteManager] Player cry played=${played} for ${pokemon.species_id}`);
                            } catch (e) { console.warn('[BattleSpriteManager] Error playing player cry', e); }
                        }
                    } catch (e) {
                        // If animateEntrance threw, attempt to play the cry anyway
                        try {
                            if (this.scene && this.scene.soundManager) {
                                console.debug(`[BattleSpriteManager] Requesting player cry (entrance failed) for ${pokemon.species_id}`);
                                const played = await this.scene.soundManager.playPokemonCry(pokemon.species_id);
                                console.debug(`[BattleSpriteManager] Player cry (entrance failed) played=${played} for ${pokemon.species_id}`);
                            }
                        } catch (err) { console.warn('[BattleSpriteManager] Error playing player cry (entrance failed)', err); }
                    }
                }
            } catch (error) {
                console.error('[BattleSpriteManager] Erreur création sprite joueur:', error);
            }
        }
    }
}
