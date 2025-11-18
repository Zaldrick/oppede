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
        
        // Sprite adversaire
        if (this.scene.opponentSprite) {
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
        
        // Sprite joueur
        if (this.scene.playerSprite) {
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
        if (!attackerSprite || !defenderSprite) {
            console.warn('[BattleAnimationManager] Sprites manquants');
            return;
        }

        await new Promise(resolve => {
            this.scene.tweens.add({
                targets: attackerSprite,
                x: defenderSprite.x * 0.7 + attackerSprite.x * 0.3,
                y: defenderSprite.y * 0.7 + attackerSprite.y * 0.3,
                duration: 150,
                yoyo: true,
                onComplete: () => {
                    if (actionData.damage > 0) {
                        this.scene.tweens.add({
                            targets: defenderSprite,
                            x: defenderSprite.x + 10,
                            duration: 50,
                            yoyo: true,
                            repeat: 2
                        });
                        
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
            });
        });
    }

    /**
     * Animation drain HP
     */
    async animateHPDrain(hpBar, hpText, newHP, maxHP) {
        if (!hpBar) return;

        const hpPercent = Math.max(0, (newHP / maxHP) * 100);
        const props = hpBar === this.scene.playerHPBar ? this.scene.playerHPBarProps : this.scene.opponentHPBarProps;

        let hpColor1, hpColor2;
        if (hpPercent > 50) {
            hpColor1 = 0x2ECC71; hpColor2 = 0x27AE60;
        } else if (hpPercent > 25) {
            hpColor1 = 0xF39C12; hpColor2 = 0xE67E22;
        } else {
            hpColor1 = 0xE74C3C; hpColor2 = 0xC0392B;
        }

        await new Promise(resolve => {
            let startPercent = parseFloat(hpBar.width) / (props.width - 4) * 100;
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

                if (hpText) {
                    hpText.setText(`${Math.max(0, Math.floor(newHP))}/${maxHP}`);
                }

                if (progress < 1) {
                    requestAnimationFrame(updateHP);
                } else {
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
        if (!sprite) return;

        const container = this.scene.children.getByName(containerName);
        const shadow = isOpponent ? this.scene.opponentShadow : this.scene.playerShadow;
        const uiElements = isOpponent ? this.scene.opponentUIElements : this.scene.playerUIElements;

        await new Promise(resolve => {
            this.scene.tweens.add({
                targets: sprite,
                alpha: 0,
                y: sprite.y + 50,
                scaleX: 0.5,
                scaleY: 0.5,
                duration: 800,
                ease: 'Power2',
                onComplete: () => {
                    sprite.destroy();
                    if (shadow) shadow.destroy();
                    resolve();
                }
            });
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
     * Animation gain XP
     */
    async animateXPGain(xpGained) {
        console.log('[BattleAnimationManager] Gain XP:', xpGained);

        const player = this.scene.battleState.playerActive;
        const oldXP = player.experience || 0;
        const newXP = oldXP + xpGained;

        player.experience = newXP;

        const oldLevel = player.level || 1;
        const currentLevelXP = this.scene.calculateXPForLevel(oldLevel);
        const nextLevelXP = this.scene.calculateXPForLevel(oldLevel + 1);

        const xpInLevel = newXP - currentLevelXP;
        const xpNeededForLevel = nextLevelXP - currentLevelXP;
        const targetPercent = Math.min(100, (xpInLevel / xpNeededForLevel) * 100);

        await new Promise(resolve => {
            const props = this.scene.playerXPBarProps;
            let currentPercent = 0;
            const duration = 1000;
            const startTime = Date.now();

            const updateXP = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                currentPercent = targetPercent * progress;

                this.scene.playerXPBar.clear();
                this.scene.playerXPBar.fillGradientStyle(0x3498DB, 0x3498DB, 0x2980B9, 0x2980B9, 1, 1, 1, 1);
                this.scene.playerXPBar.fillRoundedRect(
                    props.x + 1,
                    props.y - props.height/2 + 1,
                    (props.width - 2) * currentPercent / 100,
                    props.height - 2,
                    3
                );

                if (progress < 1) {
                    requestAnimationFrame(updateXP);
                } else {
                    resolve();
                }
            };

            updateXP();
        });
    }
}
