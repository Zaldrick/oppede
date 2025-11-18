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

export default class BattleSpriteManager {
    constructor(scene) {
        this.scene = scene;
    }

    /**
     * Crée le sprite adversaire (FACE)
     */
    async createOpponentSprite(width, height) {
        const opponent = this.scene.battleState.opponentActive;
        const opponentSpriteX = width * 0.68;
        const opponentSpriteY = height * 0.26;
        
        if (opponent.sprites && opponent.sprites.frontCombat) {
            try {
                const sprite = await SpriteLoader.displaySprite(
                    this.scene,
                    opponentSpriteX,
                    opponentSpriteY,
                    opponent.sprites.frontCombat,
                    opponent.name.substring(0, 2),
                    2.5
                );
                
                if (sprite) {
                    this.scene.opponentSprite = sprite;
                    sprite.setAlpha(0);
                    sprite.setDepth(5);
                    
                    const shadow = this.scene.add.graphics();
                    shadow.fillStyle(0x000000, 0.6);
                    const shadowOffsetY = sprite.displayHeight * 0.45;
                    shadow.fillEllipse(opponentSpriteX, opponentSpriteY + shadowOffsetY, sprite.displayWidth * 0.8, sprite.displayHeight * 0.15);
                    shadow.setDepth(0);
                    this.scene.opponentShadow = shadow;
                }
            } catch (error) {
                console.error('[BattleSpriteManager] Erreur sprite adversaire:', error);
            }
        }
    }

    /**
     * Crée le sprite joueur (DOS)
     */
    async createPlayerSprite(width, height) {
        const player = this.scene.battleState.playerActive;
        const playerSpriteX = width * 0.22;
        const playerSpriteY = height * 0.45;
        
        if (player.sprites && player.sprites.backCombat) {
            try {
                const sprite = await SpriteLoader.displaySprite(
                    this.scene,
                    playerSpriteX,
                    playerSpriteY,
                    player.sprites.backCombat,
                    player.name.substring(0, 2),
                    3
                );
                
                if (sprite) {
                    this.scene.playerSprite = sprite;
                    sprite.setAlpha(0);
                    sprite.setDepth(1);
                    
                    const shadow = this.scene.add.graphics();
                    shadow.fillStyle(0x000000, 0.6);
                    const shadowOffsetY = sprite.displayHeight * 0.45;
                    shadow.fillEllipse(playerSpriteX, playerSpriteY + shadowOffsetY, sprite.displayWidth * 0.85, sprite.displayHeight * 0.15);
                    shadow.setDepth(0);
                    this.scene.playerShadow = shadow;
                }
            } catch (error) {
                console.error('[BattleSpriteManager] Erreur sprite joueur:', error);
            }
        }
    }

    /**
     * Recrée le sprite joueur après switch
     */
    async recreatePlayerSprite(pokemon) {
        const { width, height } = this.scene.scale;
        const playerSpriteX = width * 0.22;
        const playerSpriteY = height * 0.45;
        
        if (pokemon.sprites && pokemon.sprites.backCombat) {
            try {
                const spriteKey = pokemon.nickname?.substring(0, 2) || pokemon.name?.substring(0, 2) || 'PK';
                const sprite = await SpriteLoader.displaySprite(
                    this.scene,
                    playerSpriteX,
                    playerSpriteY,
                    pokemon.sprites.backCombat,
                    spriteKey,
                    3
                );
                
                if (sprite) {
                    this.scene.playerSprite = sprite;
                    sprite.setAlpha(0);
                    sprite.setDepth(1);
                    
                    const shadow = this.scene.add.graphics();
                    shadow.fillStyle(0x000000, 0.6);
                    const shadowOffsetY = sprite.displayHeight * 0.45;
                    shadow.fillEllipse(playerSpriteX, playerSpriteY + shadowOffsetY, sprite.displayWidth * 0.85, sprite.displayHeight * 0.15);
                    shadow.setDepth(0);
                    this.scene.playerShadow = shadow;
                    shadow.setAlpha(0);
                    
                    // Animation entrée
                    await new Promise(resolve => {
                        this.scene.tweens.add({
                            targets: [sprite, shadow],
                            alpha: 1,
                            duration: 500,
                            ease: 'Power2',
                            onComplete: resolve
                        });
                    });
                }
            } catch (error) {
                console.error('[BattleSpriteManager] Erreur création sprite:', error);
            }
        }
    }
}
