import { TRIPLE_TRIAD_CONSTANTS } from './TripleTriadConstants.js';
import { TripleTriadUtils } from './TripleTriadUtils.js';
import Phaser from "phaser";
/**
 * Gestionnaire d'animations pour Triple Triad
 * Centralise toutes les animations du jeu
 */
export class TripleTriadAnimationManager {
    
    constructor(scene) {
        this.scene = scene;
        this.activeAnimations = new Set();
    }
    
    /**
     * Animation de la flèche de début de partie
     */
    showStartingArrow(startingPlayer, onComplete) {
        const { width, height } = this.scene.sys.game.canvas;
        
        // Crée la flèche (triangle épais avec dégradé)
        const arrowLength = Math.min(width, height) * 0.17;
        const baseWidth = arrowLength * 0.83;
        const graphics = this.scene.add.graphics({ x: width / 2, y: height / 2 });
        
        // Dégradé simulé : plusieurs triangles du plus clair au plus foncé
        const steps = TRIPLE_TRIAD_CONSTANTS.CARDS.GLOW_STEPS;
        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1);
            const color = Phaser.Display.Color.Interpolate.ColorWithColor(
                new Phaser.Display.Color(255, 255, 180),
                new Phaser.Display.Color(240, 210, 60),
                steps - 1,
                i
            );
            const hex = Phaser.Display.Color.GetColor(color.r, color.g, color.b);
            graphics.fillStyle(hex, 1);
            
            const l = arrowLength * (1 - t * 0.18);
            const w = baseWidth * (1 - t * 0.18);
            
            graphics.beginPath();
            graphics.moveTo(0, -l / 2);
            graphics.lineTo(w / 2, l / 2);
            graphics.lineTo(-w / 2, l / 2);
            graphics.closePath();
            graphics.fillPath();
        }
        
        // Bordure
        graphics.lineStyle(5, 0x222222, 1);
        graphics.beginPath();
        graphics.moveTo(0, -arrowLength / 2);
        graphics.lineTo(baseWidth / 2, arrowLength / 2);
        graphics.lineTo(-baseWidth / 2, arrowLength / 2);
        graphics.closePath();
        graphics.strokePath();
        
        graphics.setDepth(9999);
        
        // Détermine l'angle cible
        const targetAngle = startingPlayer === TRIPLE_TRIAD_CONSTANTS.PLAYERS.PLAYER ? 180 : 0;
        const spins = TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.ARROW.SPINS_MIN + 
                     Math.floor(Math.random() * (TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.ARROW.SPINS_MAX - TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.ARROW.SPINS_MIN));
        const totalAngle = 360 * spins + targetAngle;
        
        // Son de rotation
        if (this.scene.sound) {
            this.scene.sound.play(TRIPLE_TRIAD_CONSTANTS.AUDIO.ARROW, { 
                volume: TRIPLE_TRIAD_CONSTANTS.AUDIO.VOLUME.EFFECTS 
            });
        }
        
        const animationId = `arrow_${Date.now()}`;
        this.activeAnimations.add(animationId);
        
        this.scene.tweens.add({
            targets: graphics,
            angle: totalAngle,
            duration: TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.ARROW.DURATION,
            ease: TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.ARROW.EASE,
            onComplete: () => {
                this.scene.tweens.add({
                    targets: graphics,
                    scale: { from: 1.3, to: 1 },
                    duration: TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.ARROW.SCALE_DURATION,
                    yoyo: true,
                    onComplete: () => {
                        this.scene.time.delayedCall(TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.ARROW.DELAY_AFTER, () => {
                            graphics.destroy();
                            this.activeAnimations.delete(animationId);
                            if (onComplete) onComplete();
                        });
                    }
                });
            }
        });
        
        return animationId;
    }
    
    /**
     * Animation de placement d'une carte
     */
    animateCardPlacement(card, fromX, fromY, toX, toY, onComplete) {
        const { width } = this.scene.sys.game.canvas;
        const boardDimensions = TripleTriadUtils.calculateBoardDimensions(width, this.scene.sys.game.canvas.height);
        const { cellWidth, cellHeight } = boardDimensions;
        
        const img = this.scene.add.image(fromX, fromY, `item_${card.image}`)
            .setDisplaySize(cellWidth * TRIPLE_TRIAD_CONSTANTS.VISUAL_BOARD.CARD_SCALE, 
                          cellHeight * TRIPLE_TRIAD_CONSTANTS.VISUAL_BOARD.CARD_SCALE)
            .setOrigin(0.5)
            .setDepth(1000);
        
        // Son de placement
        if (this.scene.sound) {
            this.scene.sound.play(TRIPLE_TRIAD_CONSTANTS.AUDIO.CARD_PLACE, { 
                volume: TRIPLE_TRIAD_CONSTANTS.AUDIO.VOLUME.EFFECTS 
            });
        }
        
        const animationId = `placement_${Date.now()}`;
        this.activeAnimations.add(animationId);
        
        this.scene.tweens.add({
            targets: img,
            x: toX,
            y: toY,
            displayWidth: cellWidth * 0.99,
            displayHeight: cellHeight * 0.99,
            duration: TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.CARD_PLACEMENT.DURATION,
            ease: TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.CARD_PLACEMENT.EASE,
            onComplete: () => {
                this.scene.tweens.add({
                    targets: img,
                    displayWidth: cellWidth * TRIPLE_TRIAD_CONSTANTS.VISUAL_BOARD.CARD_SCALE,
                    displayHeight: cellHeight * TRIPLE_TRIAD_CONSTANTS.VISUAL_BOARD.CARD_SCALE,
                    duration: TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.CARD_PLACEMENT.BOUNCE_DURATION,
                    ease: TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.CARD_PLACEMENT.BOUNCE_EASE,
                    onComplete: () => {
                        img.destroy();
                        this.activeAnimations.delete(animationId);
                        if (onComplete) onComplete();
                    }
                });
            }
        });
        
        return animationId;
    }
    
    /**
     * Animation de capture d'une carte
     */
    animateCardCapture(row, col, newOwner, cardImage, boardContainer, onComplete) {
        const { width, height } = this.scene.sys.game.canvas;
        const boardDimensions = TripleTriadUtils.calculateBoardDimensions(width, height);
        const position = TripleTriadUtils.getBoardCellPosition(row, col, boardDimensions);
        const { cellWidth, cellHeight } = boardDimensions;
        
        // Trouve les objets de la carte à capturer
        let cardImg = null, cellRect = null;
        boardContainer.iterate(child => {
            if (child.texture && child.x === position.x && child.y === position.y &&
                Math.abs(child.displayWidth - cellWidth * TRIPLE_TRIAD_CONSTANTS.VISUAL_BOARD.CARD_SCALE) < 2) {
                cardImg = child;
            }
            if (child.width === cellWidth - TRIPLE_TRIAD_CONSTANTS.VISUAL_BOARD.CELL_PADDING &&
                child.height === cellHeight - TRIPLE_TRIAD_CONSTANTS.VISUAL_BOARD.CELL_PADDING &&
                child.x === position.x && child.y === position.y) {
                cellRect = child;
            }
        });
        
        if (!cardImg) {
            if (onComplete) onComplete();
            return null;
        }
        
        // ✅ CORRECTION : Sauvegarde les dimensions originales
        const originalDisplayWidth = cellWidth * TRIPLE_TRIAD_CONSTANTS.VISUAL_BOARD.CARD_SCALE;
        const originalDisplayHeight = cellHeight * TRIPLE_TRIAD_CONSTANTS.VISUAL_BOARD.CARD_SCALE;
        
        const animationId = `capture_${Date.now()}`;
        this.activeAnimations.add(animationId);
        
        // Phase 1: Fermer la carte (scaleX vers 0)
        this.scene.tweens.add({
            targets: cardImg,
            scaleX: 0,
            duration: TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.CARD_CAPTURE.CLOSE_DURATION,
            ease: TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.CARD_CAPTURE.CLOSE_EASE,
            onUpdate: () => {
                // ✅ CORRECTION : Maintient les dimensions pendant l'animation
                cardImg.setDisplaySize(originalDisplayWidth * cardImg.scaleX, originalDisplayHeight);
                if (cellRect) cellRect.setAlpha(0.5);
            },
            onComplete: () => {
                // Phase 2: Changer la texture et la bordure
                cardImg.setTexture(`item_${cardImage}`);
                // ✅ CORRECTION : Remet les bonnes dimensions
                cardImg.setDisplaySize(originalDisplayWidth, originalDisplayHeight);
                cardImg.setOrigin(0.5, 0.5);
                
                if (cellRect) {
                    const borderColor = TripleTriadUtils.getOwnerBorderColor(newOwner);
                    cellRect.setStrokeStyle(TRIPLE_TRIAD_CONSTANTS.VISUAL_BOARD.BORDER_WIDTH, borderColor);
                    cellRect.setAlpha(1);
                }
                
                // Son de capture
                if (this.scene.sound) {
                    this.scene.sound.play(TRIPLE_TRIAD_CONSTANTS.AUDIO.CARD_CAPTURE, { 
                        volume: TRIPLE_TRIAD_CONSTANTS.AUDIO.VOLUME.EFFECTS 
                    });
                }
                
                // Effet flash
                const flashColor = newOwner === "player" ? 
                    TRIPLE_TRIAD_CONSTANTS.COLORS.PLAYER_BORDER : 
                    TRIPLE_TRIAD_CONSTANTS.COLORS.OPPONENT_BORDER;
                
                const flash = this.scene.add.rectangle(
                    position.x, position.y, 
                    originalDisplayWidth, 
                    originalDisplayHeight, 
                    flashColor, 1
                ).setOrigin(0.5).setDepth(cardImg.depth + 1);
                
                boardContainer.add(flash);
                
                this.scene.tweens.add({
                    targets: flash,
                    alpha: 0,
                    duration: TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.CARD_CAPTURE.FLASH_DURATION,
                    ease: TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.CARD_CAPTURE.OPEN_EASE,
                    onComplete: () => flash.destroy()
                });
                
                // Phase 3: Réouvrir la carte (scaleX 0 → 1.08 → 1)
                this.scene.tweens.add({
                    targets: cardImg,
                    scaleX: 1.08,
                    duration: TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.CARD_CAPTURE.OPEN_DURATION,
                    ease: TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.CARD_CAPTURE.OPEN_EASE,
                    onUpdate: () => {
                        // ✅ CORRECTION : Maintient les dimensions pendant l'animation
                        cardImg.setDisplaySize(originalDisplayWidth * cardImg.scaleX, originalDisplayHeight);
                    },
                    onComplete: () => {
                        this.scene.tweens.add({
                            targets: cardImg,
                            scaleX: 1,
                            duration: TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.CARD_CAPTURE.FINAL_DURATION,
                            ease: TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.CARD_CAPTURE.OPEN_EASE,
                            onUpdate: () => {
                                // ✅ CORRECTION : Maintient les dimensions pendant l'animation
                                cardImg.setDisplaySize(originalDisplayWidth * cardImg.scaleX, originalDisplayHeight);
                            },
                            onComplete: () => {
                                // ✅ CORRECTION : Remet la taille finale proprement
                                cardImg.scaleX = 1;
                                cardImg.scaleY = 1;
                                cardImg.setDisplaySize(originalDisplayWidth, originalDisplayHeight);
                                cardImg.setOrigin(0.5, 0.5);
                                this.activeAnimations.delete(animationId);
                                if (onComplete) onComplete();
                            }
                        });
                    }
                });
            }
        });
        
        return animationId;
    }
    
    /**
     * Animation de fin de partie
     */
    animateEndGame(resultText, color, onComplete) {
        const { width, height } = this.scene.sys.game.canvas;
        
        const endText = this.scene.add.text(width / 2, height / 2, resultText, {
            font: `bold ${Math.round(width * 0.13)}px Arial`,
            fill: color,
            stroke: "#000",
            strokeThickness: 8
        }).setOrigin(0.5).setAlpha(0).setScale(0.7);
        
        const animationId = `endgame_${Date.now()}`;
        this.activeAnimations.add(animationId);
        
        this.scene.tweens.add({
            targets: endText,
            alpha: 1,
            scale: 1,
            duration: TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.END_GAME.APPEAR_DURATION,
            ease: TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.END_GAME.EASE,
            onComplete: () => {
                this.scene.time.delayedCall(TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.END_GAME.FADE_DELAY, () => {
                    const fadeRect = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0)
                        .setOrigin(0.5)
                        .setDepth(9999);
                    
                    this.scene.tweens.add({
                        targets: fadeRect,
                        alpha: 1,
                        duration: TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.END_GAME.FADE_DURATION,
                        onComplete: () => {
                            this.activeAnimations.delete(animationId);
                            if (onComplete) onComplete();
                        }
                    });
                });
            }
        });
        
        return { endText, animationId };
    }
    
    /**
     * Effet de lueur sur une carte
     */
    applyGlowEffect(targetObject, x, y, cardWidth, cardHeight, color, alpha, scale) {
        const glowWidth = cardWidth * scale;
        const glowHeight = cardHeight * scale;
        const steps = TRIPLE_TRIAD_CONSTANTS.CARDS.GLOW_STEPS;
        
        const renderTexture = this.scene.add.renderTexture(x, y, glowWidth, glowHeight).setOrigin(0.5, 0.5);
        
        for (let i = steps; i > 0; i--) {
            const t = i / steps;
            const ellipseW = glowWidth * t;
            const ellipseH = glowHeight * t;
            const stepAlpha = alpha * t * t;
            
            const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
            graphics.fillStyle(color, stepAlpha);
            graphics.fillEllipse(glowWidth / 2, glowHeight / 2, ellipseW, ellipseH);
            renderTexture.draw(graphics, 0, 0);
            graphics.destroy();
        }
        
        renderTexture.setDepth(targetObject.depth ? targetObject.depth - 1 : -100);
        
        // Animation de pulsation
        const glowAnimation = this.scene.tweens.add({
            targets: renderTexture,
            alpha: { from: 0.7, to: 1 },
            duration: TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.GLOW.DURATION,
            yoyo: true,
            repeat: -1,
            ease: TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.GLOW.EASE
        });
        
        return { renderTexture, animation: glowAnimation };
    }
    
    /**
     * Affiche un message de règle déclenchée
     */
    showRuleMessage(ruleName, duration = 1500) {
        const { width, height } = this.scene.sys.game.canvas;
        
        const message = this.scene.add.text(width / 2, height / 2, ruleName, {
            font: 'bold 48px Arial',
            fill: '#fff',
            stroke: '#000',
            strokeThickness: 8
        }).setOrigin(0.5).setDepth(1000);
        
        const animationId = `rule_${Date.now()}`;
        this.activeAnimations.add(animationId);
        
        this.scene.time.delayedCall(duration, () => {
            message.destroy();
            this.activeAnimations.delete(animationId);
        });
        
        return animationId;
    }
    
    /**
     * Arrête toutes les animations actives
     */
    stopAllAnimations() {
        this.scene.tweens.killAll();
        this.activeAnimations.clear();
    }
    
    /**
     * Vérifie si des animations sont en cours
     */
    hasActiveAnimations() {
        return this.activeAnimations.size > 0;
    }
    
    /**
     * Arrête une animation spécifique
     */
    stopAnimation(animationId) {
        this.activeAnimations.delete(animationId);
    }
}