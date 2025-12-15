import { getTypeEffectiveness, getEffectivenessMessage } from '../utils/typeEffectiveness';
import getPokemonDisplayName from '../utils/getDisplayName';
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
        flash1.setDepth(300000);
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
        flash2.setDepth(300000);
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
        spiral.setDepth(300000);
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
                
                // Play opponent cry BEFORE the animation
                try {
                    if (this.scene && this.scene.soundManager && this.scene.battleState && this.scene.battleState.opponentActive) {
                        const speciesId = this.scene.battleState.opponentActive.species_id;
                        console.debug(`[BattleAnimationManager] Playing opponent entrance cry for ${speciesId}`);
                        try { await this.scene.soundManager.playPokemonCry(speciesId); } catch (e) { console.warn('[BattleAnimationManager] Error playing opponent cry', e); }
                    }
                } catch (e) { /* ignore */ }

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
                
                // Play opponent cry BEFORE the animation (GIF)
                try {
                    if (this.scene && this.scene.soundManager && this.scene.battleState && this.scene.battleState.opponentActive) {
                        const speciesId = this.scene.battleState.opponentActive.species_id;
                        console.debug(`[BattleAnimationManager] Playing opponent entrance cry for ${speciesId} (GIF)`);
                        try { await this.scene.soundManager.playPokemonCry(speciesId); } catch (e) { console.warn('[BattleAnimationManager] Error playing opponent cry (GIF)', e); }
                    }
                } catch (e) { /* ignore */ }

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
                
                // Play player cry BEFORE the animation
                try {
                    if (this.scene && this.scene.soundManager && this.scene.battleState && this.scene.battleState.playerActive) {
                        const speciesId = this.scene.battleState.playerActive.species_id;
                        console.debug(`[BattleAnimationManager] Playing player entrance cry for ${speciesId}`);
                        try { await this.scene.soundManager.playPokemonCry(speciesId); } catch (e) { console.warn('[BattleAnimationManager] Error playing player cry', e); }
                    }
                } catch (e) { /* ignore */ }

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
                
                // Play player cry BEFORE the animation (GIF)
                try {
                    if (this.scene && this.scene.soundManager && this.scene.battleState && this.scene.battleState.playerActive) {
                        const speciesId = this.scene.battleState.playerActive.species_id;
                        console.debug(`[BattleAnimationManager] Playing player entrance cry for ${speciesId} (GIF)`);
                        try { await this.scene.soundManager.playPokemonCry(speciesId); } catch (e) { console.warn('[BattleAnimationManager] Error playing player cry (GIF)', e); }
                    }
                } catch (e) { /* ignore */ }

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
        this.scene.menuManager.showDialog(`Un ${getPokemonDisplayName(opponent)} sauvage apparaît !`);
        await this.scene.wait(1500);
        this.scene.menuManager.showDialog(`Que va faire ${getPokemonDisplayName(this.scene.battleState.playerActive)} ?`);
    }

    /**
     * Animation d'attaque
     */
    async animateAttack(attackerSprite, defenderSprite, actionData) {
        // 1. Identifier les objets (Sprite ou GIF Container)
        // 🔧 FIXE: S'assurer que les références aux containers sont à jour
        const playerObj = this.scene.playerSprite || { 
            x: this.scene.scale.width * 0.22, 
            y: this.scene.scale.height * 0.45, 
            isGif: true, 
            container: this.scene.playerGifContainer 
        };
        
        const opponentObj = this.scene.opponentSprite || { 
            x: this.scene.scale.width * 0.68, 
            y: this.scene.scale.height * 0.26, 
            isGif: true, 
            container: this.scene.opponentGifContainer 
        };

        // 2. Déterminer qui attaque
        let realAttacker, realDefender;

        if (actionData && actionData.isPlayer !== undefined) {
            // Si l'info est explicite (ajoutée par PokemonBattleScene)
            realAttacker = actionData.isPlayer ? playerObj : opponentObj;
            realDefender = actionData.isPlayer ? opponentObj : playerObj;
        } else {
            // Fallback (si pas d'info, on devine via les sprites passés)
            if (attackerSprite === this.scene.playerSprite && this.scene.playerSprite) {
                realAttacker = playerObj;
                realDefender = opponentObj;
            } else if (attackerSprite === this.scene.opponentSprite && this.scene.opponentSprite) {
                realAttacker = opponentObj;
                realDefender = playerObj;
            } else {
                // Cas GIF sans info explicite : on ne peut pas deviner de manière fiable
                console.warn('[BattleAnimationManager] Impossible de déterminer l\'attaquant (GIF mode + missing isPlayer flag)');
                
                // TENTATIVE DE SAUVETAGE ROBUSTE :
                // Si l'attaquant est null (GIF) et qu'on a un container joueur, on compare les positions X
                // Le joueur est généralement à gauche (x < width/2) ou à droite selon le jeu, mais ici :
                // Player: width * 0.22 (Gauche)
                // Opponent: width * 0.68 (Droite)
                
                // Si on n'a pas de sprite, on ne peut pas comparer les références.
                // Mais on peut essayer de voir si l'action contient des indices ou assumer par défaut.
                
                // Si attackerSprite est null, c'est un GIF.
                // Si on a passé null comme premier argument à animateAttack, c'est que l'appelant savait que c'était un GIF.
                // On va assumer que si l'appelant a passé (playerSprite, opponentSprite), l'ordre est respecté.
                
                // Si attackerSprite est undefined/null, on vérifie si c'est le tour du joueur via d'autres moyens ?
                // Non, on va utiliser une heuristique simple :
                // Si on a un container joueur et que attackerSprite est null, on assume que c'est le joueur SI l'autre argument est le sprite adverse.
                
                if (!attackerSprite && defenderSprite === this.scene.opponentSprite) {
                     realAttacker = playerObj;
                     realDefender = opponentObj;
                } else if (!attackerSprite && defenderSprite === this.scene.playerSprite) {
                     realAttacker = opponentObj;
                     realDefender = playerObj;
                } else {
                    // Dernier recours : on regarde si on a des containers
                    if (this.scene.playerGifContainer && !this.scene.opponentGifContainer) {
                        realAttacker = playerObj;
                        realDefender = opponentObj;
                    } else {
                        // Vraiment impossible
                        console.error('[BattleAnimationManager] ECHEC TOTAL identification attaquant. Skip animation.');
                        return;
                    }
                }
            }
        }

        if (!realAttacker || !realDefender) {
            console.warn('[BattleAnimationManager] Attaquant ou défenseur introuvable');
            return;
        }

        // Position cible (intermédiaire)
        // 🆕 Animation "Tackle" (charge) : on avance vers l'ennemi puis on revient
        const targetX = realDefender.x * 0.3 + realAttacker.x * 0.7; // On avance de 30% vers l'ennemi
        const targetY = realDefender.y * 0.3 + realAttacker.y * 0.7;
        const startX = realAttacker.x;
        const startY = realAttacker.y;

        // Play move sound (try to lazy-load if needed)
        if (this.scene && this.scene.soundManager && actionData && actionData.move) {
            try { this.scene.soundManager.playMoveSound(actionData.move, { volume: 0.6 }); } catch (e) { /* ignore */ }
        } else if (this.scene && this.scene.soundManager && actionData && actionData.critical) {
            try { this.scene.soundManager.playMoveSound('critical', { volume: 0.8 }); } catch (e) { /* ignore */ }
        }

        await new Promise(resolve => {
            // Animation pour Sprite Phaser
            if (!realAttacker.isGif && realAttacker.x !== undefined) {
                this.scene.tweens.add({
                    targets: realAttacker,
                    x: targetX,
                    y: targetY,
                    duration: 100, // Plus rapide (charge)
                    yoyo: true,
                    ease: 'Quad.easeOut', // Mouvement plus percutant
                    onComplete: () => this.triggerImpact(realDefender, actionData, resolve)
                });
            } 
            // Animation pour GIF DOM
            else if (realAttacker.container || realAttacker.isGif) { // 🔧 FIXE: Accepter isGif même si container est temporairement inaccessible (pour éviter blocage)
                const container = realAttacker.container;
                if (!container) {
                    console.warn('[BattleAnimationManager] Container GIF manquant pour animation, skip visuel');
                    this.triggerImpact(realDefender, actionData, resolve);
                    return;
                }

                const SpriteLoader = require('../utils/spriteLoader').default;
                const proxy = { x: startX, y: startY };
                
                this.scene.tweens.add({
                    targets: proxy,
                    x: targetX,
                    y: targetY,
                    duration: 100,
                    yoyo: true,
                    ease: 'Quad.easeOut',
                    onUpdate: () => {
                        // Récupérer dimensions actuelles pour centrage correct
                        const img = container.querySelector('img');
                        const width = img ? parseFloat(img.style.width) : 96;
                        const height = img ? parseFloat(img.style.height) : 96;
                        SpriteLoader.updateGifPosition(this.scene, container, proxy.x, proxy.y, width, height);
                    },
                    onComplete: () => this.triggerImpact(realDefender, actionData, resolve)
                });
            } else {
                // Cas impossible théoriquement mais pour sécurité
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
                ).setOrigin(0).setDepth(300000);
                
                this.scene.tweens.add({
                    targets: flash,
                    alpha: 0,
                    duration: 200,
                    onComplete: () => flash.destroy()
                });
            }

            // Play an impact sound if available (try move impact variant, fallback to generic)
            if (this.scene && this.scene.soundManager) {
                const impactName = actionData && actionData.move ? `${actionData.move}-impact` : 'hit';
                try { this.scene.soundManager.playMoveSound(impactName, { volume: 0.5 }); } catch (e) { /* ignore */ }
            }
            // Play critical sound if it was a critical hit
            if (actionData && actionData.critical && this.scene && this.scene.soundManager) {
                try { this.scene.soundManager.playMoveSound('critical', { volume: 0.8 }); } catch (e) { /* ignore */ }
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
            // Play faint sound BEFORE starting the KO animation so audio cues precede the visual
            const faintName = (isOpponent ? this.scene.battleState.opponentActive?.nickname : this.scene.battleState.playerActive?.nickname) || 'pokemon';
            console.debug(`[BattleAnimationManager] Playing KO (faint) sound for ${faintName} before animation`);
            if (this.scene && this.scene.soundManager) {
                try { this.scene.soundManager.playMoveSound('faint', { volume: 0.9 }); } catch (e) { /* ignore */ }
            } else {
                try { if (this.scene && this.scene.sound) this.scene.sound.play('faint', { volume: 0.9 }); } catch (e) { /* ignore */ }
            }

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
        // console.log('[BattleAnimationManager] Gain XP:', xpGained);

        const player = this.scene.battleState.playerActive;
        const startXP = oldXP !== null ? oldXP : (player.experience || 0);
        const startLevel = oldLevel !== null ? oldLevel : (player.level || 1);
        const newXP = startXP + xpGained;
        const newLevel = this.scene.calculateLevelFromXP(newXP);

        // console.log('[BattleAnimationManager] XP:', { startXP, newXP, startLevel, newLevel });

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
            this.scene.menuManager.showDialog(`${getPokemonDisplayName(player)} passe niveau ${currentLevel} !`);
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

        // Play LevelUp sound
        if (this.scene && this.scene.soundManager) {
            try { this.scene.soundManager.playMoveSound('levelUp', { volume: 0.9 }); } catch (e) { /* ignore */ }
        }
    }
}
