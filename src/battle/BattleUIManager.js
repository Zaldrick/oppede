/**
 * BattleUIManager.js
 * Gère la création et mise à jour de tous les éléments UI du combat
 * 
 * Code extrait de PokemonBattleScene.js pour respecter l'architecture modulaire
 */

import Phaser from 'phaser';
import getPokemonDisplayName from '../utils/getDisplayName';

export default class BattleUIManager {
    constructor(scene) {
        this.scene = scene;
    }

    isCanvasRenderer() {
        try {
            return this.scene?.game?.renderer?.type === Phaser.CANVAS;
        } catch (e) {
            return false;
        }
    }

    /**
     * Crée l'UI de l'adversaire (HAUT GAUCHE) - COPIÉ EXACTEMENT depuis PokemonBattleScene.js
     */
    async createOpponentUI(width, height) {
        const UI_BASE_DEPTH = 20;
        const boxX = width * 0.08;
        const boxY = height * 0.08;
        const boxWidth = width * 0.38;
        const boxHeight = height * 0.10;

        // Container avec ombre portée et dégradé
        const container = this.scene.add.graphics();
        container.setName('opponentContainer');
        container.setDepth(UI_BASE_DEPTH);
        container.setAlpha(0);
        
        // Ombre portée (décalée)
        container.fillStyle(0x000000, 0.15);
        container.fillRoundedRect(boxX + 4, boxY + 4, boxWidth, boxHeight, 12);
        
        // Fond avec dégradé subtil (fallback CANVAS: fillStyle)
        if (this.isCanvasRenderer()) {
            container.fillStyle(0xFFFFFF, 1);
        } else {
            container.fillGradientStyle(0xFFFFFF, 0xFFFFFF, 0xF5F5F5, 0xF5F5F5, 1, 1, 1, 1);
        }
        container.fillRoundedRect(boxX, boxY, boxWidth, boxHeight, 12);
        
        // Bordure extérieure épaisse
        container.lineStyle(4, 0x2C3E50, 1);
        container.strokeRoundedRect(boxX, boxY, boxWidth, boxHeight, 12);
        
        // Bordure intérieure dorée
        container.lineStyle(2, 0xFFD700, 0.8);
        container.strokeRoundedRect(boxX + 3, boxY + 3, boxWidth - 6, boxHeight - 6, 10);

        const opponent = this.scene.battleState.opponentActive;

        // Badge de niveau
        const levelBadgeX = boxX + boxWidth * 0.87;
        const levelBadgeY = boxY + boxHeight * 0.35;
        const badgeRadius = Math.min(width, height) * 0.024;
        
        container.fillStyle(0x3498DB, 1);
        container.fillCircle(levelBadgeX, levelBadgeY, badgeRadius);
        container.lineStyle(3, 0xFFFFFF, 1);
        container.strokeCircle(levelBadgeX, levelBadgeY, badgeRadius);
        
        // Texte "Niv" au-dessus du badge
        const nivText = this.scene.add.text(levelBadgeX, levelBadgeY - badgeRadius - Math.min(width, height) * 0.018, 'Niv', {
            fontSize: `${Math.min(width, height) * 0.035}px`,
            fill: '#2C3E50',
            fontStyle: 'bold',
            fontFamily: 'Arial'
        }).setOrigin(0.5).setAlpha(0).setDepth(UI_BASE_DEPTH + 1);
        
        // Texte niveau
        const levelText = this.scene.add.text(levelBadgeX, levelBadgeY, opponent.level, {
            fontSize: `${Math.min(width, height) * 0.038}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold',
            fontFamily: 'Arial'
        }).setOrigin(0.5).setAlpha(0).setDepth(UI_BASE_DEPTH + 1);

        // Nom du Pokémon
        const nameText = this.scene.add.text(boxX + boxWidth * 0.08, boxY + boxHeight * 0.25, getPokemonDisplayName(opponent).toUpperCase(), {
            fontSize: `${Math.min(width, height) * 0.028}px`,
            fill: '#2C3E50',
            fontStyle: 'bold',
            fontFamily: 'Arial',
            stroke: '#FFFFFF',
            strokeThickness: 1
        }).setOrigin(0, 0.5).setAlpha(0).setDepth(UI_BASE_DEPTH + 1);

        // Label PS avec icône cœur
        const psLabel = this.scene.add.text(boxX + boxWidth * 0.08, boxY + boxHeight * 0.65, '♥', {
            fontSize: `${Math.min(width, height) * 0.038}px`,
            fill: '#E74C3C',
            fontStyle: 'bold',
            fontFamily: 'Arial'
        }).setOrigin(0, 0.5).setAlpha(0).setDepth(UI_BASE_DEPTH + 1);

        // Barre HP
        const hpBarX = boxX + boxWidth * 0.18;
        const hpBarY = boxY + boxHeight * 0.65;
        const hpBarWidth = boxWidth * 0.70;
        const hpBarHeight = height * 0.012;

        // Ombre de la barre
        container.fillStyle(0x000000, 0.2);
        container.fillRoundedRect(hpBarX + 2, hpBarY - hpBarHeight/2 + 2, hpBarWidth, hpBarHeight, 6);
        
        // Fond de la barre
        container.fillStyle(0x34495E, 1);
        container.fillRoundedRect(hpBarX, hpBarY - hpBarHeight/2, hpBarWidth, hpBarHeight, 6);
        
        // Bordure intérieure
        container.lineStyle(1, 0x2C3E50, 1);
        container.strokeRoundedRect(hpBarX, hpBarY - hpBarHeight/2, hpBarWidth, hpBarHeight, 6);

        // Barre HP (couleur avec dégradé)
        const hpPercent = (opponent.currentHP / opponent.maxHP) * 100;
        let hpColor1, hpColor2;
        
        if (hpPercent > 50) {
            hpColor1 = 0x2ECC71; hpColor2 = 0x27AE60;
        } else if (hpPercent > 25) {
            hpColor1 = 0xF39C12; hpColor2 = 0xE67E22;
        } else {
            hpColor1 = 0xE74C3C; hpColor2 = 0xC0392B;
        }
        
        const hpBarFill = this.scene.add.graphics();
        if (this.isCanvasRenderer()) {
            hpBarFill.fillStyle(hpColor1, 1);
        } else {
            hpBarFill.fillGradientStyle(hpColor1, hpColor1, hpColor2, hpColor2, 1, 1, 1, 1);
        }
        hpBarFill.fillRoundedRect(
            hpBarX + 2,
            hpBarY - hpBarHeight/2 + 2,
            (hpBarWidth - 4) * hpPercent / 100,
            hpBarHeight - 4,
            4
        );
        hpBarFill.setAlpha(0).setDepth(UI_BASE_DEPTH + 1);
        
        this.scene.opponentHPBar = hpBarFill;
        this.scene.opponentHPBarProps = { x: hpBarX, y: hpBarY, width: hpBarWidth, height: hpBarHeight, maxHP: opponent.maxHP };
        
        // Stocker tous les éléments pour l'animation
        this.scene.opponentUIElements = [nivText, levelText, nameText, psLabel, hpBarFill];
    }

    /**
     * Crée l'UI du joueur (BAS DROITE) - COPIÉ EXACTEMENT depuis PokemonBattleScene.js
     */
    async createPlayerUI(width, height) {
        const UI_BASE_DEPTH = 20;
        const boxX = width * 0.50;
        const boxY = height * 0.44;
        const boxWidth = width * 0.47;
        const boxHeight = height * 0.12;

        // Container avec ombre portée et dégradé
        const container = this.scene.add.graphics();
        container.setDepth(UI_BASE_DEPTH);
        container.setName('playerContainer');
        container.setAlpha(0);
        
        // Ombre portée
        container.fillStyle(0x000000, 0.15);
        container.fillRoundedRect(boxX + 4, boxY + 4, boxWidth, boxHeight, 12);
        
        // Fond avec dégradé (fallback CANVAS: fillStyle)
        if (this.isCanvasRenderer()) {
            container.fillStyle(0xFFFFFF, 1);
        } else {
            container.fillGradientStyle(0xFFFFFF, 0xFFFFFF, 0xEBF5FB, 0xEBF5FB, 1, 1, 1, 1);
        }
        container.fillRoundedRect(boxX, boxY, boxWidth, boxHeight, 12);
        
        // Bordure extérieure épaisse
        container.lineStyle(4, 0x2C3E50, 1);
        container.strokeRoundedRect(boxX, boxY, boxWidth, boxHeight, 12);
        
        // Bordure intérieure bleu brillant
        container.lineStyle(2, 0x3498DB, 0.8);
        container.strokeRoundedRect(boxX + 3, boxY + 3, boxWidth - 6, boxHeight - 6, 10);

        const player = this.scene.battleState.playerActive;

        // Badge de niveau
        const levelBadgeX = boxX + boxWidth * 0.88;
        const levelBadgeY = boxY + boxHeight * 0.30;
        const badgeRadius = Math.min(width, height) * 0.030;
        
        // Calculer le level depuis l'XP si manquant ou incorrect
        if (!player.level || player.level === 1) {
            const calculatedLevel = this.scene.calculateLevelFromXP(player.experience || 0);
            if (calculatedLevel !== player.level) {
                console.warn(`[BattleUIManager] Level incorrect (${player.level}), recalculé: ${calculatedLevel}`);
                player.level = calculatedLevel;
            }
        }
        
        console.log('[BattleUIManager] Player data:', {
            name: getPokemonDisplayName(player),
            level: player.level,
            experience: player.experience
        });
        
        container.fillStyle(0x27AE60, 1);
        container.fillCircle(levelBadgeX, levelBadgeY, badgeRadius);
        container.lineStyle(3, 0xFFFFFF, 1);
        container.strokeCircle(levelBadgeX, levelBadgeY, badgeRadius);
        
        // Texte "Niv" au-dessus du badge
        const nivText = this.scene.add.text(levelBadgeX, levelBadgeY - badgeRadius - Math.min(width, height) * 0.018, 'Niv', {
            fontSize: `${Math.min(width, height) * 0.035}px`,
            fill: '#2C3E50',
            fontStyle: 'bold',
            fontFamily: 'Arial'
        }).setOrigin(0.5).setAlpha(0).setDepth(UI_BASE_DEPTH + 1);
        
        // Texte niveau (avec fallback)
        const displayLevel = player.level || 1;
        const levelText = this.scene.add.text(levelBadgeX, levelBadgeY, displayLevel, {
            fontSize: `${Math.min(width, height) * 0.038}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold',
            fontFamily: 'Arial'
        }).setOrigin(0.5).setAlpha(0).setDepth(UI_BASE_DEPTH + 1);

        // Nom du Pokémon
        const nameText = this.scene.add.text(boxX + boxWidth * 0.06, boxY + boxHeight * 0.25, getPokemonDisplayName(player).toUpperCase(), {
            fontSize: `${Math.min(width, height) * 0.028}px`,
            fill: '#2C3E50',
            fontStyle: 'bold',
            fontFamily: 'Arial',
            stroke: '#FFFFFF',
            strokeThickness: 1
        }).setOrigin(0, 0.5).setAlpha(0).setDepth(UI_BASE_DEPTH + 1);

        // Label PS
        const psLabel = this.scene.add.text(boxX + boxWidth * 0.06, boxY + boxHeight * 0.60, '♥', {
            fontSize: `${Math.min(width, height) * 0.038}px`,
            fill: '#E74C3C',
            fontStyle: 'bold',
            fontFamily: 'Arial'
        }).setOrigin(0, 0.5).setAlpha(0).setDepth(UI_BASE_DEPTH + 1);

        // Barre HP
        const hpBarX = boxX + boxWidth * 0.14;
        const hpBarY = boxY + boxHeight * 0.60;
        const hpBarWidth = boxWidth * 0.56;
        const hpBarHeight = height * 0.012;

        // Ombre de la barre
        container.fillStyle(0x000000, 0.2);
        container.fillRoundedRect(hpBarX + 2, hpBarY - hpBarHeight/2 + 2, hpBarWidth, hpBarHeight, 6);
        
        // Fond de la barre
        container.fillStyle(0x34495E, 1);
        container.fillRoundedRect(hpBarX, hpBarY - hpBarHeight/2, hpBarWidth, hpBarHeight, 6);
        
        container.lineStyle(1, 0x2C3E50, 1);
        container.strokeRoundedRect(hpBarX, hpBarY - hpBarHeight/2, hpBarWidth, hpBarHeight, 6);

        // Barre HP (couleur avec dégradé)
        const hpPercent = (player.currentHP / player.maxHP) * 100;
        let hpColor1, hpColor2;
        
        if (hpPercent > 50) {
            hpColor1 = 0x2ECC71; hpColor2 = 0x27AE60;
        } else if (hpPercent > 25) {
            hpColor1 = 0xF39C12; hpColor2 = 0xE67E22;
        } else {
            hpColor1 = 0xE74C3C; hpColor2 = 0xC0392B;
        }
        
        const hpBarFill = this.scene.add.graphics();
        if (this.isCanvasRenderer()) {
            hpBarFill.fillStyle(hpColor1, 1);
        } else {
            hpBarFill.fillGradientStyle(hpColor1, hpColor1, hpColor2, hpColor2, 1, 1, 1, 1);
        }
        hpBarFill.fillRoundedRect(
            hpBarX + 2,
            hpBarY - hpBarHeight/2 + 2,
            (hpBarWidth - 4) * hpPercent / 100,
            hpBarHeight - 4,
            4
        );
        hpBarFill.setAlpha(0).setDepth(UI_BASE_DEPTH + 1);
        
        this.scene.playerHPBar = hpBarFill;
        this.scene.playerHPBarProps = { x: hpBarX, y: hpBarY, width: hpBarWidth, height: hpBarHeight, maxHP: player.maxHP };

        // Texte HP numérique
        this.scene.playerHPText = this.scene.add.text(boxX + boxWidth * 0.74, boxY + boxHeight * 0.60, `${player.currentHP}/${player.maxHP}`, {
            fontSize: `${Math.min(width, height) * 0.026}px`,
            fill: '#2C3E50',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5).setAlpha(0).setDepth(UI_BASE_DEPTH + 1);

        // ========== BARRE D'XP ==========
        const xpBarX = boxX + boxWidth * 0.06;
        const xpBarY = boxY + boxHeight * 0.82;
        const xpBarWidth = boxWidth * 0.88;
        const xpBarHeight = height * 0.008;

        // Label "XP"
        const xpLabel = this.scene.add.text(xpBarX, xpBarY, 'XP', {
            fontSize: `${Math.min(width, height) * 0.022}px`,
            fill: '#7F8C8D',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5).setAlpha(0).setDepth(UI_BASE_DEPTH + 1);

        // Fond de la barre XP
        container.fillStyle(0xBDC3C7, 1);
        container.fillRoundedRect(xpBarX + boxWidth * 0.10, xpBarY - xpBarHeight/2, xpBarWidth * 0.85, xpBarHeight, 4);
        
        container.lineStyle(1, 0x95A5A6, 1);
        container.strokeRoundedRect(xpBarX + boxWidth * 0.10, xpBarY - xpBarHeight/2, xpBarWidth * 0.85, xpBarHeight, 4);

        // Calculer l'XP
        const currentLevelXP = this.scene.calculateXPForLevel(player.level || 1);
        const nextLevelXP = this.scene.calculateXPForLevel((player.level || 1) + 1);
        const xpInLevel = (player.experience || 0) - currentLevelXP;
        const xpNeededForLevel = nextLevelXP - currentLevelXP;
        const xpPercent = Math.max(0, Math.min(100, (xpInLevel / xpNeededForLevel) * 100));
        
        console.log('[BattleUIManager] XP Bar calculation:', {
            level: player.level,
            experience: player.experience,
            currentLevelXP,
            nextLevelXP,
            xpInLevel,
            xpNeededForLevel,
            xpPercent: xpPercent.toFixed(2) + '%'
        });

        // Barre XP
        const xpBarFill = this.scene.add.graphics();
        if (this.isCanvasRenderer()) {
            xpBarFill.fillStyle(0x3498DB, 1);
        } else {
            xpBarFill.fillGradientStyle(0x3498DB, 0x3498DB, 0x2980B9, 0x2980B9, 1, 1, 1, 1);
        }
        xpBarFill.fillRoundedRect(
            xpBarX + boxWidth * 0.10 + 1,
            xpBarY - xpBarHeight/2 + 1,
            (xpBarWidth * 0.85 - 2) * xpPercent / 100,
            xpBarHeight - 2,
            3
        );
        xpBarFill.setAlpha(0).setDepth(UI_BASE_DEPTH + 1);

        this.scene.playerXPBar = xpBarFill;
        this.scene.playerXPBarProps = {
            x: xpBarX + boxWidth * 0.10,
            y: xpBarY,
            width: xpBarWidth * 0.85,
            height: xpBarHeight,
            currentLevelXP: currentLevelXP,
            nextLevelXP: nextLevelXP
        };
        
        // 🆕 Stocker référence au texte de niveau pour animation level-up
        this.scene.playerLevelText = levelText;
        
        // Stocker tous les éléments pour l'animation
        this.scene.playerUIElements = [nivText, levelText, nameText, psLabel, hpBarFill, this.scene.playerHPText, xpLabel, xpBarFill];
    }

    /**
     * Crée le menu principal de combat moderne (BAS avec FIGHT, SAC, FUIR, POKÉMON)
     */
    createMainMenu(width, height) {
        const UI_BASE_DEPTH = 20;
        const menuX = width * 0.02;
        const menuY = height * 0.69;
        const menuWidth = width * 0.96;
        const menuHeight = height * 0.25;

        // Fond du menu avec ombre et dégradé
        this.scene.mainMenuBg = this.scene.add.graphics();
        this.scene.mainMenuBg.setDepth(UI_BASE_DEPTH);
        
        // Ombre portée
        this.scene.mainMenuBg.fillStyle(0x000000, 0.2);
        this.scene.mainMenuBg.fillRoundedRect(menuX + 5, menuY + 5, menuWidth, menuHeight, 15);
        
        // Fond avec dégradé (fallback CANVAS: fillStyle)
        if (this.isCanvasRenderer()) {
            this.scene.mainMenuBg.fillStyle(0xFFFFFF, 1);
        } else {
            this.scene.mainMenuBg.fillGradientStyle(0xFFFFFF, 0xFFFFFF, 0xECF0F1, 0xECF0F1, 1, 1, 1, 1);
        }
        this.scene.mainMenuBg.fillRoundedRect(menuX, menuY, menuWidth, menuHeight, 15);
        
        // Bordure extérieure épaisse
        this.scene.mainMenuBg.lineStyle(4, 0x2C3E50, 1);
        this.scene.mainMenuBg.strokeRoundedRect(menuX, menuY, menuWidth, menuHeight, 15);
        
        // Bordure intérieure dorée
        this.scene.mainMenuBg.lineStyle(2, 0xF39C12, 0.6);
        this.scene.mainMenuBg.strokeRoundedRect(menuX + 4, menuY + 4, menuWidth - 8, menuHeight - 8, 12);

        // Zone de texte de dialogue/action (au-dessus du menu)
        const dialogX = width * 0.02;
        const dialogY = height * 0.57;
        const dialogWidth = width * 0.96;
        const dialogHeight = height * 0.10;

        this.scene.dialogBox = this.scene.add.graphics();
        this.scene.dialogBox.setDepth(300000);
        
        // Ombre du dialogue
        this.scene.dialogBox.fillStyle(0x000000, 0.2);
        this.scene.dialogBox.fillRoundedRect(dialogX + 5, dialogY + 5, dialogWidth, dialogHeight, 12);
        
        // Fond blanc éclatant
        this.scene.dialogBox.fillStyle(0xFFFFFF, 1);
        this.scene.dialogBox.fillRoundedRect(dialogX, dialogY, dialogWidth, dialogHeight, 12);
        
        // Bordure bleue
        this.scene.dialogBox.lineStyle(4, 0x3498DB, 1);
        this.scene.dialogBox.strokeRoundedRect(dialogX, dialogY, dialogWidth, dialogHeight, 12);
        
        // Bordure intérieure subtile
        this.scene.dialogBox.lineStyle(1, 0xBDC3C7, 0.5);
        this.scene.dialogBox.strokeRoundedRect(dialogX + 3, dialogY + 3, dialogWidth - 6, dialogHeight - 6, 10);
        
        this.scene.dialogBox.setVisible(false);

        // Texte de dialogue
        this.scene.dialogText = this.scene.add.text(dialogX + dialogWidth * 0.04, dialogY + dialogHeight * 0.30, '', {
            fontSize: `${Math.min(width, height) * 0.04}px`,
            fill: '#2C3E50',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            wordWrap: { width: dialogWidth * 0.92 }
        }).setOrigin(0, 0);
        this.scene.dialogText.setDepth(300001);
        this.scene.dialogText.setVisible(false);

        // Boutons du menu (grille 2x2) avec style moderne
        // ✅ FIXE: Ajuster la taille pour rester dans le cadre
        const buttonWidth = menuWidth * 0.44;
        const buttonHeight = menuHeight * 0.35; // Réduit de 0.40 à 0.35
        const buttonSpacing = menuWidth * 0.04;
        const verticalSpacing = menuHeight * 0.10; // Espacement vertical explicite

        const buttons = [
            { label: 'COMBATTRE', x: 0, y: 0, color: 0xE74C3C, action: () => this.scene.menuManager.showMoveSelector() },
            { label: 'SAC', x: 1, y: 0, color: 0x3498DB, action: () => this.scene.menuManager.showBagMenu() },
            { label: 'ÉQUIPE', x: 0, y: 1, color: 0x2ECC71, action: () => this.scene.menuManager.showPokemonMenu() },
            { label: 'FUIR', x: 1, y: 1, color: 0x95A5A6, action: () => this.scene.flee() }
        ];

        this.scene.mainMenuButtons = [];

        buttons.forEach(btn => {
            const btnX = menuX + buttonSpacing + btn.x * (buttonWidth + buttonSpacing);
            // ✅ FIXE: Calcul Y plus précis pour centrer verticalement
            const startY = menuY + (menuHeight - (2 * buttonHeight + verticalSpacing)) / 2;
            const btnY = startY + btn.y * (buttonHeight + verticalSpacing);

            const btnContainer = this.scene.add.container(btnX, btnY);
            btnContainer.setDepth(UI_BASE_DEPTH + 1);
            
            // Ombre du bouton
            const shadow = this.scene.add.graphics();
            shadow.fillStyle(0x000000, 0.2);
            shadow.fillRoundedRect(3, 3, buttonWidth, buttonHeight, 10);
            btnContainer.add(shadow);
            
            // Fond du bouton avec dégradé
            const buttonBg = this.scene.add.graphics();
            const darkColor = this.darkenColor(btn.color, 0.8);
            if (this.isCanvasRenderer()) {
                buttonBg.fillStyle(btn.color, 1);
            } else {
                buttonBg.fillGradientStyle(btn.color, btn.color, darkColor, darkColor, 1, 1, 1, 1);
            }
            buttonBg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, 10);
            
            // Bordure du bouton
            buttonBg.lineStyle(3, 0xFFFFFF, 0.8);
            buttonBg.strokeRoundedRect(0, 0, buttonWidth, buttonHeight, 10);
            
            btnContainer.add(buttonBg);
            buttonBg.setInteractive(new Phaser.Geom.Rectangle(0, 0, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);

            // Texte du bouton avec ombre
            // Default text position (centered). For some buttons we'll place an icon and shift text.
            let textX = buttonWidth / 2;
            const buttonText = this.scene.add.text(textX, buttonHeight / 2, btn.label, {
                fontSize: `${Math.min(width, height) * 0.05}px`,
                fill: '#FFFFFF',
                fontStyle: 'bold',
                fontFamily: 'Arial',
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5);

            btnContainer.add(buttonText);

            // Interactions avec effets
            buttonBg.on('pointerover', () => {
                this.scene.tweens.add({
                    targets: btnContainer,
                    scaleX: 1.05,
                    scaleY: 1.05,
                    duration: 100,
                    ease: 'Power2'
                });
            });

            buttonBg.on('pointerout', () => {
                this.scene.tweens.add({
                    targets: btnContainer,
                    scaleX: 1.0,
                    scaleY: 1.0,
                    duration: 100,
                    ease: 'Power2'
                });
            });

            buttonBg.on('pointerdown', () => {
                if (!this.scene.turnInProgress) {
                    // Flash effet
                    this.scene.tweens.add({
                        targets: btnContainer,
                        alpha: 0.7,
                        duration: 50,
                        yoyo: true,
                        onComplete: () => btn.action()
                    });
                }
            });

            this.scene.mainMenuButtons.push(btnContainer);
        });
    }

    /**
     * Crée le sélecteur de moves avec design moderne - pleine largeur
     */
    async createMoveSelector() {
        const UI_BASE_DEPTH = 20;
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;

        const menuX = width * 0.02;
        const menuY = height * 0.68;
        const menuWidth = width * 0.96;
        const menuHeight = height * 0.25;

        const player = this.scene.battleState.playerActive;
        const moveset = player.moveset || [];

        // Ajouter des moves par défaut pour compléter
        const defaultMoves = [
            { name: 'tackle', type: 'normal', category: 'physical', power: 40, pp: 35, maxPP: 35 },
            { name: 'leer', type: 'normal', category: 'status', power: 0, pp: 30, maxPP: 30 },
            { name: 'quick-attack', type: 'normal', category: 'physical', power: 40, pp: 30, maxPP: 30 },
            { name: 'wing-attack', type: 'flying', category: 'physical', power: 60, pp: 35, maxPP: 35 }
        ];
        
        while (moveset.length < 4) {
            const nextMove = defaultMoves[moveset.length];
            if (nextMove) moveset.push(nextMove);
            else break;
        }

        this.scene.moveButtons = [];

        // Afficher seulement les moves disponibles (toujours 4)
        const numMoves = Math.min(moveset.length, 4);
        
        const btnWidth = menuWidth * 0.46;
        const btnHeight = menuHeight * 0.38;
        const spacing = menuWidth * 0.015;
        
        for (let i = 0; i < numMoves; i++) {
            const move = moveset[i];
            if (!move || !move.name) continue;

            const row = Math.floor(i / 2);
            const col = i % 2;

            const btnX = menuX + spacing + col * (btnWidth + spacing);
            const btnY = menuY + spacing + row * (btnHeight + spacing);

            const moveButton = await this.createMoveButton(move, btnX, btnY, btnWidth, btnHeight);
            moveButton.setDepth(UI_BASE_DEPTH + 1);
            moveButton.setVisible(false);
            this.scene.moveButtons.push(moveButton);
        }

        // Bouton RETOUR petit en bas à droite
        const backBtnWidth = menuWidth * 0.25;
        const backBtnHeight = menuHeight * 0.15;
        const backBtnX = menuX + menuWidth - backBtnWidth;
        const backBtnY = menuY + menuHeight - backBtnHeight + spacing;

        const backContainer = this.scene.add.container(backBtnX, backBtnY);
        backContainer.setDepth(UI_BASE_DEPTH + 1);
        
        // Ombre
        const shadow = this.scene.add.graphics();
        shadow.fillStyle(0x000000, 0.2);
        shadow.fillRoundedRect(4, 4, backBtnWidth, backBtnHeight, 10);
        backContainer.add(shadow);
        
        // Fond gris avec dégradé
        const buttonBg = this.scene.add.graphics();
        if (this.isCanvasRenderer()) {
            buttonBg.fillStyle(0xBDC3C7, 1);
        } else {
            buttonBg.fillGradientStyle(0xBDC3C7, 0xBDC3C7, 0x7F8C8D, 0x7F8C8D, 1, 1, 1, 1);
        }
        buttonBg.fillRoundedRect(0, 0, backBtnWidth, backBtnHeight, 10);
        buttonBg.lineStyle(3, 0xFFFFFF, 0.9);
        buttonBg.strokeRoundedRect(0, 0, backBtnWidth, backBtnHeight, 10);
        backContainer.add(buttonBg);
        
        buttonBg.setInteractive(new Phaser.Geom.Rectangle(0, 0, backBtnWidth, backBtnHeight), Phaser.Geom.Rectangle.Contains);

        const backText = this.scene.add.text(backBtnWidth / 2, backBtnHeight / 2, 'RETOUR', {
            fontSize: `${Math.min(width, height) * 0.030}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold',
            fontFamily: 'Arial',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);
        backContainer.add(backText);

        buttonBg.on('pointerover', () => {
            this.scene.tweens.add({ targets: backContainer, scaleX: 1.05, scaleY: 1.05, duration: 100 });
        });

        buttonBg.on('pointerout', () => {
            this.scene.tweens.add({ targets: backContainer, scaleX: 1.0, scaleY: 1.0, duration: 100 });
        });

        buttonBg.on('pointerdown', () => {
            this.scene.tweens.add({
                targets: backContainer,
                alpha: 0.7,
                duration: 50,
                yoyo: true,
                onComplete: () => this.scene.menuManager.hideMoveSelector()
            });
        });

        this.scene.backButton = backContainer;
        this.scene.backButton.setVisible(false);
    }

    /**
     * Crée un bouton de capacité avec design moderne
     */
    async createMoveButton(move, x, y, width, height) {
        if (!move || !move.name) {
            console.warn('[BattleUIManager] Move invalide:', move);
            return this.scene.add.container(x, y);
        }

        await this.ensureMoveCategoryIconsLoaded();

        // Traduire nom du move en FR
        const moveNameFR = await this.scene.getMoveName(move.name);

        const minDim = Math.min(this.scene.cameras.main.width, this.scene.cameras.main.height);
        const container = this.scene.add.container(x, y);
        container.setDepth(21);
        
        // Ombre du bouton
        const shadow = this.scene.add.graphics();
        shadow.fillStyle(0x000000, 0.25);
        shadow.fillRoundedRect(4, 4, width, height, 10);
        container.add(shadow);

        // Couleur de type avec dégradé
        const typeColor = this.getTypeColor(move.type);
        const darkTypeColor = this.darkenColor(typeColor, 0.7);
        
        const buttonBg = this.scene.add.graphics();
        if (this.isCanvasRenderer()) {
            buttonBg.fillStyle(typeColor, 1);
        } else {
            buttonBg.fillGradientStyle(typeColor, typeColor, darkTypeColor, darkTypeColor, 1, 1, 1, 1);
        }
        buttonBg.fillRoundedRect(0, 0, width, height, 10);
        
        // Bordure blanche brillante
        buttonBg.lineStyle(3, 0xFFFFFF, 0.9);
        buttonBg.strokeRoundedRect(0, 0, width, height, 10);
        
        // Bordure intérieure subtile
        buttonBg.lineStyle(1, 0x000000, 0.3);
        buttonBg.strokeRoundedRect(3, 3, width - 6, height - 6, 8);
        
        container.add(buttonBg);
        buttonBg.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);

        // Nom de la capacité avec ombre (Utiliser nom traduit FR)
        const moveName = this.scene.add.text(width * 0.08, height * 0.20, moveNameFR, {
            fontSize: `${minDim * 0.036}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold',
            fontFamily: 'Arial',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0);
        container.add(moveName);

        // PP (aligné à droite du nom)
        const ppValue = `${move.pp || 0}/${move.maxPP || move.pp || 0}`;
        const ppText = this.scene.add.text(width * 0.92, height * 0.20, `PP ${ppValue}`, {
            fontSize: `${minDim * 0.026}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold',
            fontFamily: 'Arial',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(1, 0);
        container.add(ppText);

        // Anti-overflow: adapter le nom pour qu'il ne chevauche pas les PP
        this.fitTextToWidth(moveName, (ppText.x - moveName.x) - width * 0.03, minDim * 0.020);

        // Badge de type avec ombre et bordure
        // ✅ FIXE: Limiter la taille du badge de type
        const typeWidth = Math.min(width * 0.4, 120);
        const typeHeight = Math.min(height * 0.30, 40);
        const typeX = width * 0.08;
        const typeY = height * 0.60;
        
        const typeBadge = this.scene.add.graphics();
        
        // Ombre du badge
        typeBadge.fillStyle(0x000000, 0.3);
        typeBadge.fillRoundedRect(typeX + 2, typeY + 2, typeWidth, typeHeight, 5);
        
        // Fond du badge (légèrement plus clair)
        const lightTypeColor = this.lightenColor(typeColor, 1.2);
        typeBadge.fillStyle(lightTypeColor, 1);
        typeBadge.fillRoundedRect(typeX, typeY, typeWidth, typeHeight, 5);
        
        // Bordure du badge
        typeBadge.lineStyle(2, 0xFFFFFF, 0.8);
        typeBadge.strokeRoundedRect(typeX, typeY, typeWidth, typeHeight, 5);
        
        container.add(typeBadge);

        // Texte du type (FR)
        const { getPokemonTypeLabelFR } = await import('../utils/typeLabelsFR');
        const typeText = this.scene.add.text(typeX + typeWidth / 2, typeY + typeHeight / 2, getPokemonTypeLabelFR(move.type), {
            fontSize: `${minDim * 0.030}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold',
            fontFamily: 'Arial',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        container.add(typeText);

        // Puissance (sans "PUI") en bas à droite + icône category transparente derrière
        const powerValue = (typeof move.power === 'number' && move.power > 0) ? move.power : '—';

        const category = (move.category || '').toString().toLowerCase();
        const iconKey = category === 'physical'
            ? 'move-category-physical'
            : (category === 'special' ? 'move-category-special' : null);

        const powerX = width * 0.92;
        const powerY = height * 0.72;

        if (iconKey && this.scene.textures.exists(iconKey)) {
            const icon = this.scene.add.image(width * 0.84, powerY, iconKey);
            icon.setOrigin(0.5);
            icon.setAlpha(0.22);
            icon.setDisplaySize(height * 0.55, height * 0.55);
            container.add(icon);
        }

        const powerText = this.scene.add.text(powerX, powerY, `${powerValue}`, {
            fontSize: `${minDim * 0.040}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold',
            fontFamily: 'Arial',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(1, 0.5);
        container.add(powerText);

        // Interactions avec animations
        buttonBg.on('pointerover', () => {
            this.scene.tweens.add({
                targets: container,
                scaleX: 1.05,
                scaleY: 1.05,
                duration: 100,
                ease: 'Power2'
            });
        });

        buttonBg.on('pointerout', () => {
            this.scene.tweens.add({
                targets: container,
                scaleX: 1.0,
                scaleY: 1.0,
                duration: 100,
                ease: 'Power2'
            });
        });

        buttonBg.on('pointerdown', () => {
            // Vérifier si joueur K.O. avant d'autoriser action
            const playerKO = this.scene.battleState?.playerActive?.currentHP <= 0;
            if (playerKO) {
                console.warn('[BattleUIManager] Joueur K.O., action bloquée');
                this.scene.showDialog('Vous devez changer de Pokémon !');
                return;
            }
            
            if (!this.scene.turnInProgress && (move.pp || 0) > 0) {
                this.scene.tweens.add({
                    targets: container,
                    alpha: 0.7,
                    duration: 50,
                    yoyo: true,
                    onComplete: () => this.scene.turnManager.selectMove(move.name)
                });
            }
        });

        return container;
    }

    fitTextToWidth(textObject, maxWidth, minFontSizePx) {
        if (!textObject || typeof textObject.setFontSize !== 'function') return;
        if (!maxWidth || maxWidth <= 0) return;

        const parsePx = (value) => {
            const n = typeof value === 'string' ? parseFloat(value) : Number(value);
            return Number.isFinite(n) ? n : 0;
        };

        let fontSize = parsePx(textObject.style?.fontSize);
        const minSize = Math.max(8, parsePx(minFontSizePx));

        while (textObject.width > maxWidth && fontSize > minSize) {
            fontSize = Math.max(minSize, fontSize - 1);
            textObject.setFontSize(fontSize);
        }

        if (textObject.width > maxWidth) {
            const original = String(textObject.text || '');
            let truncated = original;
            const ellipsis = '…';

            while (truncated.length > 1 && textObject.width > maxWidth) {
                truncated = truncated.slice(0, -2);
                textObject.setText(truncated + ellipsis);
            }
        }
    }

    async ensureMoveCategoryIconsLoaded() {
        if (this._moveCategoryIconsLoaded) return;

        const physicalKey = 'move-category-physical';
        const specialKey = 'move-category-special';

        if (this.scene.textures.exists(physicalKey) && this.scene.textures.exists(specialKey)) {
            this._moveCategoryIconsLoaded = true;
            return;
        }

        if (!this.scene.textures.exists(physicalKey)) {
            this.scene.load.image(physicalKey, 'assets/sprites/physical.png');
        }
        if (!this.scene.textures.exists(specialKey)) {
            this.scene.load.image(specialKey, 'assets/sprites/special.png');
        }

        await new Promise((resolve) => {
            this.scene.load.once('complete', resolve);
            this.scene.load.start();
        });

        this._moveCategoryIconsLoaded = true;
    }

    /**
     * Assombrit une couleur (helper pour dégradés)
     */
    darkenColor(color, factor) {
        const r = Math.floor(((color >> 16) & 0xFF) * factor);
        const g = Math.floor(((color >> 8) & 0xFF) * factor);
        const b = Math.floor((color & 0xFF) * factor);
        return (r << 16) | (g << 8) | b;
    }

    /**
     * Éclaircit une couleur (helper pour badges)
     */
    lightenColor(color, factor) {
        const r = Math.min(255, Math.floor(((color >> 16) & 0xFF) * factor));
        const g = Math.min(255, Math.floor(((color >> 8) & 0xFF) * factor));
        const b = Math.min(255, Math.floor((color & 0xFF) * factor));
        return (r << 16) | (g << 8) | b;
    }

    /**
     * 🆕 Met à jour complètement l'UI du joueur après un switch
     * @param {Object} pokemon - Nouveau Pokémon actif
     */
    async updateCompletePlayerUI(pokemon) {
        const { width, height } = this.scene.scale;
        
        // 🔧 FIXE: Réinitialiser le pourcentage HP pour le nouveau Pokémon
        this.scene.currentPlayerHPPercent = undefined;
        
        // Détruire anciens éléments UI
        if (this.scene.playerUIElements) {
            this.scene.playerUIElements.forEach(el => {
                if (el && el.destroy) el.destroy();
            });
        }
        
        // Recréer l'UI complète
        await this.createPlayerUI(width, height);
        
        // Animer l'apparition
        const container = this.scene.children.getByName('playerContainer');
        if (container) {
            container.setAlpha(0);
            this.scene.tweens.add({
                targets: container,
                alpha: 1,
                duration: 500
            });
        }
        
        if (this.scene.playerUIElements) {
            this.scene.playerUIElements.forEach(el => {
                if (el) {
                    el.setAlpha(0);
                    this.scene.tweens.add({
                        targets: el,
                        alpha: 1,
                        duration: 500
                    });
                }
            });
        }
    }

    /**
     * 🆕 Met à jour complètement l'UI de l'adversaire (utile en combat dresseur quand le serveur envoie le Pokémon suivant)
     * @param {Object} pokemon - Nouveau Pokémon actif adverse
     */
    async updateCompleteOpponentUI(pokemon) {
        const { width, height } = this.scene.scale;

        // 🔧 FIXE: Réinitialiser le pourcentage HP pour le nouvel adversaire
        this.scene.currentOpponentHPPercent = undefined;

        // Détruire anciens éléments UI
        const oldContainer = this.scene.children.getByName('opponentContainer');
        if (oldContainer && oldContainer.destroy) {
            oldContainer.destroy();
        }

        if (this.scene.opponentUIElements) {
            this.scene.opponentUIElements.forEach(el => {
                if (el && el.destroy) el.destroy();
            });
        }

        // Recréer l'UI complète
        await this.createOpponentUI(width, height);

        // Animer l'apparition
        const container = this.scene.children.getByName('opponentContainer');
        if (container) {
            container.setAlpha(0);
            this.scene.tweens.add({ targets: container, alpha: 1, duration: 500 });
        }

        if (this.scene.opponentUIElements) {
            this.scene.opponentUIElements.forEach(el => {
                if (el) {
                    el.setAlpha(0);
                    this.scene.tweens.add({ targets: el, alpha: 1, duration: 500 });
                }
            });
        }
    }

    /**
     * Retourne la couleur associée à un type Pokémon
     */
    getTypeColor(type) {
        const typeColors = {
            normal: 0xA8A878,
            fire: 0xF08030,
            water: 0x6890F0,
            electric: 0xF8D030,
            grass: 0x78C850,
            ice: 0x98D8D8,
            fighting: 0xC03028,
            poison: 0xA040A0,
            ground: 0xE0C068,
            flying: 0xA890F0,
            psychic: 0xF85888,
            bug: 0xA8B820,
            rock: 0xB8A038,
            ghost: 0x705898,
            dragon: 0x7038F8,
            dark: 0x705848,
            steel: 0xB8B8D0,
            fairy: 0xEE99AC
        };
        return typeColors[type?.toLowerCase()] || typeColors.normal;
    }
}
