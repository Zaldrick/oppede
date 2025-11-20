/**
 * BattleAnimationManager.js
 * Gère toutes les animations visuelles du combat
 * 
 * Responsabilités:
 * - Animations d'attaque
 * - Animations de dégâts (HP drain)
 * - Animations XP
 * - Animations K.O.
 * - Animations d'entrée
 */

export default class BattleAnimationManager {
    constructor(scene) {
        this.scene = scene;
    }

    /**
     * Transition d'entrée avec spiral
     */
    async playEntryTransition(width, height) {
        // Flash 1
        const flash1 = this.scene.add.rectangle(0, 0, width, height, 0xFFFFFF, 1).setOrigin(0);
        flash1.setDepth(10000);
        await new Promise(resolve => {
            this.scene.tweens.add({
                targets: flash1,
                alpha: 0,
                duration: 150,
                ease: 'Power2',
                onComplete: resolve
            });
        });
        
        await this.scene.wait(100);
        
        // Flash 2
        const flash2 = this.scene.add.rectangle(0, 0, width, height, 0xFFFFFF, 1).setOrigin(0);
        flash2.setDepth(10000);
        await new Promise(resolve => {
            this.scene.tweens.add({
                targets: flash2,
                alpha: 0,
                duration: 200,
                ease: 'Power2',
                onComplete: resolve
            });
        });
        
        // Spiral
        const spiral = this.scene.add.graphics();
        spiral.setDepth(10000);
        const centerX = width * 0.5;
        const centerY = height * 0.5;
        const maxRadius = Math.sqrt(width * width + height * height);
        
        spiral.setName('spiral');
        
        await new Promise(resolve => {
            let currentRadius = 0;
            const step = maxRadius / 30;
            
            const spiralTimer = this.scene.time.addEvent({
                delay: 16,
                repeat: 30,
                callback: () => {
                    spiral.clear();
                    spiral.fillStyle(0x000000, 1);
                    spiral.fillCircle(centerX, centerY, width * height);
                    
                    spiral.fillStyle(0xFFFFFF, 1);
                    for (let i = 0; i < 8; i++) {
                        const angle = (i / 8) * Math.PI * 2 + (currentRadius * 0.1);
                        const radius = maxRadius - currentRadius;
                        if (radius > 0) {
                            const arcStart = angle;
                            const arcEnd = angle + Math.PI * 0.2;
                            spiral.slice(centerX, centerY, radius, arcStart, arcEnd, false);
                            spiral.fillPath();
                        }
                    }
                    
                    if (currentRadius >= maxRadius * 0.8) {
                        const alpha = 1 - ((currentRadius - maxRadius * 0.8) / (maxRadius * 0.2));
                        spiral.setAlpha(alpha);
                    }
                    
                    currentRadius += step;
                    
                    if (currentRadius >= maxRadius) {
                        spiralTimer.remove();
                        resolve();
                    }
                }
            });
        });
    }

    /**
     * Animations d'entrée UI
     */
    async playUIEntryAnimations(width, height) {
        const opponentContainer = this.scene.children.getByName('opponentContainer');
        const playerContainer = this.scene.children.getByName('playerContainer');
        
        if (opponentContainer) opponentContainer.setAlpha(0);
        if (playerContainer) playerContainer.setAlpha(0);
        
        // Box adversaire
        if (opponentContainer) {
            await new Promise(resolve => {
                this.scene.tweens.add({
                    targets: [opponentContainer, ...this.scene.opponentUIElements],
                    alpha: 1,
                    duration: 300,
                    ease: 'Power2',
                    onComplete: resolve
                });
            });
        }
        
        await this.scene.wait(100);
        
        // Sprite adversaire (Phaser ou GIF)
        if (this.scene.opponentSpriteData) {
            if (this.scene.opponentSpriteData.type === 'phaser' && this.scene.opponentSprite) {
                const originalX = this.scene.opponentSprite.x;
                this.scene.opponentSprite.x = -width * 0.3;
                this.scene.opponentSprite.setAlpha(1);
                
                await new Promise(resolve => {
                    this.scene.tweens.add({
                        targets: this.scene.opponentSprite,
                        x: originalX,
                        duration: 600,
                        ease: 'Back.easeOut',
                        onComplete: resolve
                    });
                });
            } else if (this.scene.opponentSpriteData.type === 'gif' && this.scene.opponentGifContainer) {
                // Animation GIF via CSS
                const container = this.scene.opponentGifContainer;
                const originalX = parseFloat(container.style.left);
                container.style.left = `${-width * 0.3}px`;
                container.style.opacity = '1';
                container.style.transition = 'left 600ms cubic-bezier(0.68, -0.55, 0.265, 1.55)';
                
                await new Promise(resolve => {
                    setTimeout(() => {
                        container.style.left = `${originalX}px`;
                        setTimeout(resolve, 600);
                    }, 50);
                });
            }
        }
        
        await this.scene.wait(200);
        
        // Box joueur
        if (playerContainer) {
            await new Promise(resolve => {
                this.scene.tweens.add({
                    targets: [playerContainer, ...this.scene.playerUIElements],
                    alpha: 1,
                    duration: 300,
                    ease: 'Power2',
                    onComplete: resolve
                });
            });
        }
        
        await this.scene.wait(100);
        
        // Sprite joueur (Phaser ou GIF)
        if (this.scene.playerSpriteData) {
            if (this.scene.playerSpriteData.type === 'phaser' && this.scene.playerSprite) {
                const originalX = this.scene.playerSprite.x;
                this.scene.playerSprite.x = width * 1.3;
                this.scene.playerSprite.setAlpha(1);
                
                await new Promise(resolve => {
                    this.scene.tweens.add({
                        targets: this.scene.playerSprite,
                        x: originalX,
                        duration: 600,
                        ease: 'Back.easeOut',
                        onComplete: resolve
                    });
                });
            } else if (this.scene.playerSpriteData.type === 'gif' && this.scene.playerGifContainer) {
                // Animation GIF via CSS
                const container = this.scene.playerGifContainer;
                const originalX = parseFloat(container.style.left);
                container.style.left = `${width * 1.3}px`;
                container.style.opacity = '1';
                container.style.transition = 'left 600ms cubic-bezier(0.68, -0.55, 0.265, 1.55)';
                
                await new Promise(resolve => {
                    setTimeout(() => {
                        container.style.left = `${originalX}px`;
                        setTimeout(resolve, 600);
                    }, 50);
                });
            }
        }
        
        await this.scene.wait(300);
        
        // Menu
        await new Promise(resolve => {
            this.scene.tweens.add({
                targets: [this.scene.mainMenuBg, ...this.scene.mainMenuButtons],
                alpha: 1,
                duration: 400,
                ease: 'Power2',
                onComplete: resolve
            });
        });
        
        await this.scene.wait(200);
        
        const opponent = this.scene.battleState.opponentActive;
        this.scene.menuManager.showDialog(`Un ${opponent.name} sauvage apparaît !`);
        await this.scene.wait(1500);
        this.scene.menuManager.showDialog(`Que va faire ${this.scene.battleState.playerActive.name} ?`);
    }

    /**
     * Animation d'attaque
     */
    async animateAttack(attackerSprite, defenderSprite, actionData) {
        // Récupérer les conteneurs GIF si les sprites sont nuls
        const isPlayerAttacker = (attackerSprite === this.scene.playerSprite) || (!attackerSprite && this.scene.playerGifContainer);
        
        const attacker = isPlayerAttacker 
            ? (this.scene.playerSprite || { x: this.scene.scale.width * 0.22, y: this.scene.scale.height * 0.45, isGif: true, container: this.scene.playerGifContainer })
            : (this.scene.opponentSprite || { x: this.scene.scale.width * 0.68, y: this.scene.scale.height * 0.26, isGif: true, container: this.scene.opponentGifContainer });

        const defender = isPlayerAttacker
            ? (this.scene.opponentSprite || { x: this.scene.scale.width * 0.68, y: this.scene.scale.height * 0.26, isGif: true, container: this.scene.opponentGifContainer })
            : (this.scene.playerSprite || { x: this.scene.scale.width * 0.22, y: this.scene.scale.height * 0.45, isGif: true, container: this.scene.playerGifContainer });

        if (!attacker || !defender) {
            console.warn('[BattleAnimationManager] Sprites/GIFs manquants pour animation');
            return;
        }

        // Position cible (intermédiaire)
        const targetX = defender.x * 0.7 + attacker.x * 0.3;
        const targetY = defender.y * 0.7 + attacker.y * 0.3;
        const startX = attacker.x;
        const startY = attacker.y;

        await new Promise(resolve => {
            // Animation pour Sprite Phaser
            if (!attacker.isGif) {
                this.scene.tweens.add({
                    targets: attacker,
                    x: targetX,
                    y: targetY,
                    duration: 150,
                    yoyo: true,
                    onComplete: () => this.triggerImpact(defender, actionData, resolve)
                });
            } 
            // Animation pour GIF DOM
            else if (attacker.container) {
                const SpriteLoader = require('../utils/spriteLoader').default;
                // Tween sur un objet proxy pour mettre à jour le DOM
                const proxy = { x: startX, y: startY };
                
                this.scene.tweens.add({
                    targets: proxy,
                    x: targetX,
                    y: targetY,
                    duration: 150,
                    yoyo: true,
                    onUpdate: () => {
                        // Mettre à jour la position du DOM via SpriteLoader
                        // On assume une largeur/hauteur approximative ou on récupère du style
                        const width = parseFloat(attacker.container.querySelector('img').style.width);
                        const height = parseFloat(attacker.container.querySelector('img').style.height);
                        SpriteLoader.updateGifPosition(this.scene, attacker.container, proxy.x, proxy.y, width, height);
                    },
                    onComplete: () => this.triggerImpact(defender, actionData, resolve)
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Déclenche l'impact sur le défenseur
     */
    triggerImpact(defender, actionData, resolve) {
        if (actionData.damage > 0) {
            // Animation de secousse sur le défenseur
            if (!defender.isGif) {
                this.scene.tweens.add({
                    targets: defender,
                    x: defender.x + 10,
                    duration: 50,
                    yoyo: true,
                    repeat: 2
                });
            } else if (defender.container) {
                const SpriteLoader = require('../utils/spriteLoader').default;
                const startX = defender.x;
                const startY = defender.y;
                const proxy = { x: startX };
                
                this.scene.tweens.add({
                    targets: proxy,
                    x: startX + 10,
                    duration: 50,
                    yoyo: true,
                    repeat: 2,
                    onUpdate: () => {
                        const width = parseFloat(defender.container.querySelector('img').style.width);
                        const height = parseFloat(defender.container.querySelector('img').style.height);
                        SpriteLoader.updateGifPosition(this.scene, defender.container, proxy.x, startY, width, height);
                    }
                });
            }

            if (actionData.critical) {
                const flash = this.scene.add.rectangle(
                    0, 0,
                    this.scene.cameras.main.width,
                    this.scene.cameras.main.height,
                    0xFFFF00, 0.5
                ).setOrigin(0).setDepth(9999);
                
                this.scene.tweens.add({
                    targets: flash,
                    alpha: 0,
                    duration: 200,
                    onComplete: () => flash.destroy()
                });
            }
        }
        resolve();
    }

    /**
     * Animation drain HP
     */
    async animateHPDrain(hpBar, hpText, newHP, maxHP) {
        if (!hpBar) return;

        const hpPercent = Math.max(0, (newHP / maxHP) * 100);
        const props = hpBar === this.scene.playerHPBar ? this.scene.playerHPBarProps : this.scene.opponentHPBarProps;
        
        // 🔧 FIXE: Récupérer le pourcentage actuel stocké (évite bug de calcul)
        const isPlayerBar = hpBar === this.scene.playerHPBar;
        const currentPercentKey = isPlayerBar ? 'currentPlayerHPPercent' : 'currentOpponentHPPercent';
        
        // Si pas encore initialisé, calculer depuis HP actuel
        if (this.scene[currentPercentKey] === undefined) {
            const currentHP = isPlayerBar ? this.scene.battleState.playerActive.currentHP : this.scene.battleState.opponentActive.currentHP;
            this.scene[currentPercentKey] = Math.max(0, (currentHP / maxHP) * 100);
        }

        let hpColor1, hpColor2;
        if (hpPercent > 50) {
            hpColor1 = 0x2ECC71; hpColor2 = 0x27AE60;
        } else if (hpPercent > 25) {
            hpColor1 = 0xF39C12; hpColor2 = 0xE67E22;
        } else {
            hpColor1 = 0xE74C3C; hpColor2 = 0xC0392B;
        }

        await new Promise(resolve => {
            const startPercent = this.scene[currentPercentKey];
            const duration = 500;
            const startTime = Date.now();

            const updateHP = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const currentPercent = startPercent + (hpPercent - startPercent) * progress;

                hpBar.clear();
                hpBar.fillGradientStyle(hpColor1, hpColor1, hpColor2, hpColor2, 1, 1, 1, 1);
                hpBar.fillRoundedRect(
                    props.x + 2,
                    props.y - props.height/2 + 2,
                    (props.width - 4) * currentPercent / 100,
                    props.height - 4,
                    4
                );
                hpBar.setDepth(3); // 🔧 FIXE: Réappliquer depth après clear()

                if (hpText) {
                    hpText.setText(`${Math.max(0, Math.floor(newHP))}/${maxHP}`);
                }

                if (progress < 1) {
                    requestAnimationFrame(updateHP);
                } else {
                    // 🔧 FIXE: Stocker le pourcentage final pour la prochaine animation
                    this.scene[currentPercentKey] = hpPercent;
                    resolve();
                }
            };

            updateHP();
        });
    }

    /**
     * Animation K.O.
     */
    async animateKO(sprite, containerName, isOpponent) {
        // Gérer sprite Phaser ou GIF
        const isGif = !sprite && (isOpponent ? this.scene.opponentGifContainer : this.scene.playerGifContainer);
        const target = sprite || (isOpponent ? this.scene.opponentGifContainer : this.scene.playerGifContainer);

        if (!target) return;

        const container = this.scene.children.getByName(containerName);
        const shadow = isOpponent ? this.scene.opponentShadow : this.scene.playerShadow;
        const uiElements = isOpponent ? this.scene.opponentUIElements : this.scene.playerUIElements;

        await new Promise(resolve => {
            if (!isGif) {
                // Animation Phaser Sprite
                this.scene.tweens.add({
                    targets: target,
                    alpha: 0,
                    y: target.y + 50,
                    scaleX: 0.5,
                    scaleY: 0.5,
                    duration: 800,
                    ease: 'Power2',
                    onComplete: () => {
                        target.destroy();
                        if (shadow) shadow.destroy();
                        resolve();
                    }
                });
            } else {
                // Animation GIF DOM
                target.style.transition = 'all 800ms ease';
                target.style.opacity = '0';
                target.style.transform = 'translateY(50px) scale(0.5)';
                
                if (shadow) {
                    this.scene.tweens.add({
                        targets: shadow,
                        alpha: 0,
                        duration: 800
                    });
                }
                
                setTimeout(() => {
                    const SpriteLoader = require('../utils/spriteLoader').default;
                    SpriteLoader.removeAnimatedGif(target);
                    if (shadow) shadow.destroy();
                    resolve();
                }, 800);
            }
        });

        // Faire disparaître la box ET tous ses éléments texte
        if (container) {
            const targets = uiElements ? [container, ...uiElements] : [container];
            await new Promise(resolve => {
                this.scene.tweens.add({
                    targets: targets,
                    alpha: 0,
                    duration: 400,
                    onComplete: resolve
                });
            });
        }
    }

    /**
     * 🆕 Anime le gain d'XP avec barre progressive et gestion level-up
     * @param {number} xpGained - XP gagné
     * @param {number} oldXP - XP avant le gain (optionnel, sinon utilise player.experience)
     * @param {number} oldLevel - Niveau avant le gain (optionnel, sinon utilise player.level)
     */
    async animateXPGain(xpGained, oldXP = null, oldLevel = null) {
        console.log('[BattleAnimationManager] Gain XP:', xpGained);

        const player = this.scene.battleState.playerActive;
        const startXP = oldXP !== null ? oldXP : (player.experience || 0);
        const startLevel = oldLevel !== null ? oldLevel : (player.level || 1);
        const newXP = startXP + xpGained;
        const newLevel = this.scene.calculateLevelFromXP(newXP);

        console.log('[BattleAnimationManager] XP:', { startXP, newXP, startLevel, newLevel });

        // Pas de level-up : animation simple
        if (newLevel === startLevel) {
            await this.fillXPBar(startXP, newXP, startLevel);
            player.experience = newXP;
            player.level = newLevel;
            return false;
        }

        // Level-up : animation complexe
        let currentXP = startXP;
        let currentLevel = startLevel;

        while (currentLevel < newLevel) {
            const nextLevelXP = this.scene.calculateXPForLevel(currentLevel + 1);

            // 1. Remplir la barre jusqu'à 100%
            await this.fillXPBar(currentXP, nextLevelXP, currentLevel);
            await this.scene.wait(300);

            // 2. Flash de level-up
            await this.animateLevelUpFlash();

            // 3. Incrémenter le niveau et mettre à jour l'affichage IMMÉDIATEMENT
            currentLevel++;
            if (this.scene.playerLevelText) {
                this.scene.playerLevelText.setText(currentLevel);
            }

            // 4. Pause pour voir le changement de niveau
            await this.scene.wait(300);

            // 5. Message de level-up
            this.scene.menuManager.showDialog(`${player.name} passe niveau ${currentLevel} !`);
            await this.scene.wait(1500);

            // 6. Vider la barre (reset à 0%)
            currentXP = nextLevelXP;
            await this.fillXPBar(currentXP, currentXP, currentLevel);
            await this.scene.wait(200);
        }

        // 7. Remplir avec le surplus d'XP du nouveau niveau
        if (newXP > currentXP) {
            await this.fillXPBar(currentXP, newXP, currentLevel);
        }

        // Mettre à jour le Pokémon
        player.experience = newXP;
        player.level = newLevel;

        return true;
    }

    /**
     * Remplit la barre XP de fromXP à toXP pour un niveau donné
     */
    async fillXPBar(fromXP, toXP, level) {
        const currentLevelXP = this.scene.calculateXPForLevel(level);
        const nextLevelXP = this.scene.calculateXPForLevel(level + 1);
        const xpNeededForLevel = nextLevelXP - currentLevelXP;

        const startXPInLevel = fromXP - currentLevelXP;
        const endXPInLevel = toXP - currentLevelXP;

        const startPercent = Math.max(0, Math.min(100, (startXPInLevel / xpNeededForLevel) * 100));
        const endPercent = Math.max(0, Math.min(100, (endXPInLevel / xpNeededForLevel) * 100));

        await new Promise(resolve => {
            const props = this.scene.playerXPBarProps;
            const duration = 800;
            const startTime = Date.now();

            const updateXP = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const currentPercent = startPercent + (endPercent - startPercent) * progress;

                this.scene.playerXPBar.clear();
                this.scene.playerXPBar.fillGradientStyle(0x3498DB, 0x3498DB, 0x2980B9, 0x2980B9, 1, 1, 1, 1);
                this.scene.playerXPBar.fillRoundedRect(
                    props.x + 1,
                    props.y - props.height/2 + 1,
                    (props.width - 2) * currentPercent / 100,
                    props.height - 2,
                    3
                );
                this.scene.playerXPBar.setDepth(3); // 🔧 FIXE: Réappliquer depth après clear()

                if (progress < 1) {
                    requestAnimationFrame(updateXP);
                } else {
                    resolve();
                }
            };

            updateXP();
        });
    }

    /**
     * Animation de flash pour le level-up (blanc, doré, blanc)
     */
    async animateLevelUpFlash() {
        const flashColors = [
            { color: 0xFFFFFF, duration: 150 }, // Blanc
            { color: 0xFFD700, duration: 150 }, // Doré
            { color: 0xFFFFFF, duration: 150 }  // Blanc
        ];

        for (const flash of flashColors) {
            // Flash sur la barre XP
            this.scene.playerXPBar.clear();
            this.scene.playerXPBar.fillStyle(flash.color, 1);
            this.scene.playerXPBar.fillRoundedRect(
                this.scene.playerXPBarProps.x + 1,
                this.scene.playerXPBarProps.y - this.scene.playerXPBarProps.height/2 + 1,
                this.scene.playerXPBarProps.width - 2,
                this.scene.playerXPBarProps.height - 2,
                3
            );
            this.scene.playerXPBar.setDepth(3); // 🔧 FIXE: Réappliquer depth après clear()
            
            await this.scene.wait(flash.duration);
        }
    }
}
