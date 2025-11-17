/**
 * PokemonBattleScene.js
 * Scène de combat Pokémon avec UI responsive et animations
 * 
 * Features:
 * - Sprites animés (front/back Gen V)
 * - Barres HP avec animation de dégâts
 * - Sélecteur de moves avec types
 * - Battle log scrollable
 * - Transitions fluides entre tours
 * - Effets de particules
 */

import Phaser from 'phaser';
import PokemonBattleManager from './managers/PokemonBattleManager';
import SpriteLoader from './utils/spriteLoader';
import { getTypeEffectiveness, getEffectivenessMessage } from './utils/typeEffectiveness';

export class PokemonBattleScene extends Phaser.Scene {
    constructor() {
        super('PokemonBattleScene');
        this.battleManager = null;
        this.battleId = null;
        this.battleState = null;
        
        // Références UI
        this.playerSprite = null;
        this.opponentSprite = null;
        this.playerHPBar = null;
        this.opponentHPBar = null;
        this.moveButtons = [];
        this.battleLogTexts = [];
        
        // Animation state
        this.isAnimating = false;
        this.turnInProgress = false;
    }

    init(data) {
        console.log('[BattleScene] Init avec data:', data);
        this.playerId = data.playerId;
        this.battleType = data.battleType || 'wild';
        this.opponentId = data.opponentId || null;
        this.returnScene = data.returnScene || 'PokemonTeamScene';
    }

    async create() {
        console.log('[BattleScene] Création scène de combat');

        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // ARRÊTER TOUTES LES AUTRES SCÈNES EN PREMIER (avant toute animation)
        this.scene.manager.scenes.forEach(scene => {
            if (scene.scene.key !== 'PokemonBattleScene' && scene.scene.isActive()) {
                this.scene.stop(scene.scene.key);
            }
        });

        // Démarrer la transition d'entrée spectaculaire
        await this.playEntryTransition(width, height);

        // Initialiser Battle Manager
        if (!this.battleManager) {
            this.battleManager = new PokemonBattleManager();
        }

        try {
            // Démarrer le combat (pendant le spiral)
            const battleData = await this.battleManager.startBattle(
                this.playerId,
                this.opponentId,
                this.battleType
            );

            this.battleId = battleData.battleId;
            this.battleState = {
                playerTeam: battleData.playerTeam,
                opponentTeam: battleData.opponentTeam,
                playerActive: battleData.playerTeam[0],
                opponentActive: battleData.opponentTeam[0],
                battleLog: battleData.battleLog || []
            };

            // Récupérer le spiral créé dans playEntryTransition
            const spiral = this.children.getByName('spiral');

            // CRÉER LE FOND MAINTENANT (il sera sous le spiral)
            this.createBackground(width, height);

            // Faire disparaître le spiral progressivement pour révéler le fond
            if (spiral) {
                await new Promise(resolve => {
                    this.tweens.add({
                        targets: spiral,
                        alpha: 0,
                        duration: 400,
                        ease: 'Power2',
                        onComplete: () => {
                            spiral.destroy();
                            resolve();
                        }
                    });
                });
            }

            await this.wait(200);            // Créer l'UI avec animations progressives
            await this.createBattleUI(width, height);

        } catch (error) {
            console.error('[BattleScene] Erreur démarrage combat:', error);
            setTimeout(() => this.returnToScene(), 2000);
        }
    }

    /**
     * Transition d'entrée ultra cool avec double flash et spiral
     */
    async playEntryTransition(width, height) {
        // 1. Premier flash blanc rapide
        const flash1 = this.add.rectangle(0, 0, width, height, 0xFFFFFF, 1).setOrigin(0);
        flash1.setDepth(10000);
        await new Promise(resolve => {
            this.tweens.add({
                targets: flash1,
                alpha: 0,
                duration: 150,
                ease: 'Power2',
                onComplete: resolve
            });
        });
        
        await this.wait(100);
        
        // 2. Deuxième flash blanc plus long
        const flash2 = this.add.rectangle(0, 0, width, height, 0xFFFFFF, 1).setOrigin(0);
        flash2.setDepth(10000);
        await new Promise(resolve => {
            this.tweens.add({
                targets: flash2,
                alpha: 0,
                duration: 200,
                ease: 'Power2',
                onComplete: resolve
            });
        });
        
        // 3. Fondu en spiral noir concentrique
        const spiral = this.add.graphics();
        spiral.setDepth(10000); // AU-DESSUS DE TOUT
        const centerX = width * 0.5;
        const centerY = height * 0.5;
        const maxRadius = Math.sqrt(width * width + height * height);
        
        await new Promise(resolve => {
            this.tweens.addCounter({
                from: 0,
                to: maxRadius,
                duration: 600,
                ease: 'Power2',
                onUpdate: (tween) => {
                    const currentRadius = tween.getValue();
                    spiral.clear();
                    
                    // Dessiner 8 cercles concentriques qui s'agrandissent
                    for (let i = 0; i < 8; i++) {
                        const radius = currentRadius - (i * maxRadius / 8);
                        if (radius > 0) {
                            const alpha = 1 - (i / 8);
                            spiral.fillStyle(0x000000, alpha);
                            spiral.fillCircle(centerX, centerY, radius);
                        }
                    }
                    
                    // Remplir complètement l'écran quand on approche de la fin
                    if (currentRadius >= maxRadius * 0.8) {
                        spiral.fillStyle(0x000000, 1);
                        spiral.fillRect(0, 0, width, height);
                    }
                },
                onComplete: resolve
            });
        });
        
        // Nettoyer les flash
        flash1.destroy();
        flash2.destroy();
        
        await this.wait(200);
        
        // Nommer le spiral pour le retrouver plus tard
        spiral.setName('spiral');
        
        return spiral;
    }

    /**
     * Crée le fond animé style Pokémon moderne
     */
    createBackground(width, height) {
        // Dégradé de fond principal (bleu ciel vers beige sable)
        const graphics = this.add.graphics();
        
        // Ciel avec plusieurs nuances
        graphics.fillGradientStyle(0x87CEEB, 0x87CEEB, 0xB0E0E6, 0xB0E0E6, 1, 1, 1, 1);
        graphics.fillRect(0, 0, width, height * 0.45);
        
        // Transition horizon
        graphics.fillGradientStyle(0xB0E0E6, 0xB0E0E6, 0xF5DEB3, 0xF5DEB3, 1, 1, 1, 1);
        graphics.fillRect(0, height * 0.45, width, height * 0.08);
        
        // Sol (beige/sable avec dégradé)
        graphics.fillGradientStyle(0xF5DEB3, 0xF5DEB3, 0xDAA520, 0xDAA520, 1, 1, 1, 1);
        graphics.fillRect(0, height * 0.53, width, height * 0.47);
        
        // Ligne d'horizon brillante
        graphics.lineStyle(2, 0xFFFFFF, 0.4);
        graphics.lineBetween(0, height * 0.50, width, height * 0.50);
    }

    /**
     * Crée l'interface de combat style Pokémon authentique
     */
    async createBattleUI(width, height) {
        console.log('[BattleScene] Création UI');

        // Zone adversaire (haut gauche) - sera glissée depuis la gauche
        await this.createOpponentUI(width, height);

        // Zone joueur (bas droite) - sera glissée depuis la droite
        await this.createPlayerUI(width, height);

        // Menu principal (bas) - apparition en fondu
        this.createMainMenu(width, height);
        
        // Cacher le menu au début
        this.mainMenuBg.setAlpha(0);
        this.mainMenuButtons.forEach(btn => btn.setAlpha(0));

        // Animation de glissement + apparitions progressives
        await this.playUIEntryAnimations(width, height);
    }

    /**
     * Crée l'UI de l'adversaire (HAUT GAUCHE) avec design moderne
     */
    async createOpponentUI(width, height) {
        const boxX = width * 0.08;
        const boxY = height * 0.08;
        const boxWidth = width * 0.38;
        const boxHeight = height * 0.10;

        // Container avec ombre portée et dégradé
        const container = this.add.graphics();
        container.setName('opponentContainer');
        container.setAlpha(0); // Caché au début
        
        // Ombre portée (décalée)
        container.fillStyle(0x000000, 0.15);
        container.fillRoundedRect(boxX + 4, boxY + 4, boxWidth, boxHeight, 12);
        
        // Fond avec dégradé subtil (blanc vers gris très clair)
        container.fillGradientStyle(0xFFFFFF, 0xFFFFFF, 0xF5F5F5, 0xF5F5F5, 1, 1, 1, 1);
        container.fillRoundedRect(boxX, boxY, boxWidth, boxHeight, 12);
        
        // Bordure extérieure épaisse
        container.lineStyle(4, 0x2C3E50, 1);
        container.strokeRoundedRect(boxX, boxY, boxWidth, boxHeight, 12);
        
        // Bordure intérieure dorée
        container.lineStyle(2, 0xFFD700, 0.8);
        container.strokeRoundedRect(boxX + 3, boxY + 3, boxWidth - 6, boxHeight - 6, 10);

        const opponent = this.battleState.opponentActive;

        // Badge de niveau (cercle stylé en haut à droite) - agrandi et responsive
        const levelBadgeX = boxX + boxWidth * 0.87;
        const levelBadgeY = boxY + boxHeight * 0.35;
        const badgeRadius = Math.min(width, height) * 0.035; // Plus grand
        
        container.fillStyle(0x3498DB, 1);
        container.fillCircle(levelBadgeX, levelBadgeY, badgeRadius);
        container.lineStyle(3, 0xFFFFFF, 1);
        container.strokeCircle(levelBadgeX, levelBadgeY, badgeRadius);
        
        // Texte "Niv" au-dessus du badge - agrandi
        const nivText = this.add.text(levelBadgeX, levelBadgeY - badgeRadius - Math.min(width, height) * 0.018, 'Niv', {
            fontSize: `${Math.min(width, height) * 0.035}px`,
            fill: '#2C3E50',
            fontStyle: 'bold',
            fontFamily: 'Arial'
        }).setOrigin(0.5).setAlpha(0); // Caché au début
        
        // Texte niveau - police agrandie
        const levelText = this.add.text(levelBadgeX, levelBadgeY, opponent.level, {
            fontSize: `${Math.min(width, height) * 0.038}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold',
            fontFamily: 'Arial'
        }).setOrigin(0.5).setAlpha(0); // Caché au début

        // Nom du Pokémon avec ombre
        const nameText = this.add.text(boxX + boxWidth * 0.08, boxY + boxHeight * 0.25, opponent.name.toUpperCase(), {
            fontSize: `${Math.min(width, height) * 0.028}px`,
            fill: '#2C3E50',
            fontStyle: 'bold',
            fontFamily: 'Arial',
            stroke: '#FFFFFF',
            strokeThickness: 1
        }).setOrigin(0, 0.5).setAlpha(0); // Caché au début

        // Label "PS:" avec icône cœur - agrandi
        const psLabel = this.add.text(boxX + boxWidth * 0.08, boxY + boxHeight * 0.65, '♥', {
            fontSize: `${Math.min(width, height) * 0.038}px`,
            fill: '#E74C3C',
            fontStyle: 'bold',
            fontFamily: 'Arial'
        }).setOrigin(0, 0.5).setAlpha(0); // Caché au début

        // Barre HP (avec fond 3D et brillance)
        const hpBarX = boxX + boxWidth * 0.18;
        const hpBarY = boxY + boxHeight * 0.65;
        const hpBarWidth = boxWidth * 0.70;
        const hpBarHeight = height * 0.012;

        // Ombre de la barre
        container.fillStyle(0x000000, 0.2);
        container.fillRoundedRect(hpBarX + 2, hpBarY - hpBarHeight/2 + 2, hpBarWidth, hpBarHeight, 6);
        
        // Fond de la barre (gris avec bordure)
        container.fillStyle(0x34495E, 1);
        container.fillRoundedRect(hpBarX, hpBarY - hpBarHeight/2, hpBarWidth, hpBarHeight, 6);
        
        // Bordure intérieure
        container.lineStyle(1, 0x2C3E50, 1);
        container.strokeRoundedRect(hpBarX, hpBarY - hpBarHeight/2, hpBarWidth, hpBarHeight, 6);

        // Barre HP (couleur avec dégradé)
        const hpPercent = (opponent.currentHP / opponent.maxHP) * 100;
        let hpColor1, hpColor2;
        
        if (hpPercent > 50) {
            hpColor1 = 0x2ECC71; hpColor2 = 0x27AE60; // Vert
        } else if (hpPercent > 25) {
            hpColor1 = 0xF39C12; hpColor2 = 0xE67E22; // Orange
        } else {
            hpColor1 = 0xE74C3C; hpColor2 = 0xC0392B; // Rouge
        }
        
        const hpBarFill = this.add.graphics();
        hpBarFill.fillGradientStyle(hpColor1, hpColor1, hpColor2, hpColor2, 1, 1, 1, 1);
        hpBarFill.fillRoundedRect(
            hpBarX + 2,
            hpBarY - hpBarHeight/2 + 2,
            (hpBarWidth - 4) * hpPercent / 100,
            hpBarHeight - 4,
            4
        );
        hpBarFill.setAlpha(0); // Caché au début
        
        this.opponentHPBar = hpBarFill;
        this.opponentHPBarProps = { x: hpBarX, y: hpBarY, width: hpBarWidth, height: hpBarHeight, maxHP: opponent.maxHP };
        
        // Stocker tous les éléments pour l'animation
        this.opponentUIElements = [nivText, levelText, nameText, psLabel, hpBarFill];

        // Sprite adversaire avec animation d'entrée
        const opponentSpriteX = width * 0.68;
        const opponentSpriteY = height * 0.26;
        
        if (opponent.sprites && opponent.sprites.frontCombat) {
            try {
                const spriteUrl = opponent.sprites.frontCombat;
                const sprite = await SpriteLoader.displaySprite(
                    this,
                    opponentSpriteX,
                    opponentSpriteY,
                    spriteUrl,
                    opponent.name.substring(0, 2),
                    3.5
                );
                
                if (sprite) {
                    this.opponentSprite = sprite;
                    sprite.setAlpha(0);
                    sprite.setDepth(10);
                    
                    // Ombre SOUS le sprite (créée après pour avoir la bonne position)
                    const shadow = this.add.graphics();
                    shadow.fillStyle(0x000000, 0.6);
                    // Position de l'ombre : sous les pieds du sprite
                    const shadowOffsetY = sprite.displayHeight * 0.45;
                    shadow.fillEllipse(opponentSpriteX, opponentSpriteY + shadowOffsetY, sprite.displayWidth * 0.8, sprite.displayHeight * 0.15);
                    shadow.setDepth(0);
                }
            } catch (error) {
                console.error('[BattleScene] Erreur chargement sprite adversaire:', error);
            }
        }
    }

    /**
     * Crée l'UI du joueur (BAS DROITE) avec design moderne
     */
    async createPlayerUI(width, height) {
        const boxX = width * 0.50;
        const boxY = height * 0.42;
        const boxWidth = width * 0.47;
        const boxHeight = height * 0.12;

        // Container avec ombre portée et dégradé
        const container = this.add.graphics();
        container.setName('playerContainer');
        container.setAlpha(0); // Caché au début
        
        // Ombre portée
        container.fillStyle(0x000000, 0.15);
        container.fillRoundedRect(boxX + 4, boxY + 4, boxWidth, boxHeight, 12);
        
        // Fond avec dégradé (blanc vers bleu très clair)
        container.fillGradientStyle(0xFFFFFF, 0xFFFFFF, 0xEBF5FB, 0xEBF5FB, 1, 1, 1, 1);
        container.fillRoundedRect(boxX, boxY, boxWidth, boxHeight, 12);
        
        // Bordure extérieure épaisse
        container.lineStyle(4, 0x2C3E50, 1);
        container.strokeRoundedRect(boxX, boxY, boxWidth, boxHeight, 12);
        
        // Bordure intérieure bleu brillant
        container.lineStyle(2, 0x3498DB, 0.8);
        container.strokeRoundedRect(boxX + 3, boxY + 3, boxWidth - 6, boxHeight - 6, 10);

        const player = this.battleState.playerActive;

        // Badge de niveau (cercle stylé) - agrandi et responsive
        const levelBadgeX = boxX + boxWidth * 0.88;
        const levelBadgeY = boxY + boxHeight * 0.30;
        const badgeRadius = Math.min(width, height) * 0.035; // Plus grand
        
        container.fillStyle(0x27AE60, 1);
        container.fillCircle(levelBadgeX, levelBadgeY, badgeRadius);
        container.lineStyle(3, 0xFFFFFF, 1);
        container.strokeCircle(levelBadgeX, levelBadgeY, badgeRadius);
        
        // Texte "Niv" au-dessus du badge - agrandi
        const nivText = this.add.text(levelBadgeX, levelBadgeY - badgeRadius - Math.min(width, height) * 0.018, 'Niv', {
            fontSize: `${Math.min(width, height) * 0.035}px`,
            fill: '#2C3E50',
            fontStyle: 'bold',
            fontFamily: 'Arial'
        }).setOrigin(0.5).setAlpha(0); // Caché au début
        
        // Texte niveau - police agrandie
        const levelText = this.add.text(levelBadgeX, levelBadgeY, player.level, {
            fontSize: `${Math.min(width, height) * 0.038}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold',
            fontFamily: 'Arial'
        }).setOrigin(0.5).setAlpha(0); // Caché au début

        // Nom du Pokémon avec ombre
        const nameText = this.add.text(boxX + boxWidth * 0.06, boxY + boxHeight * 0.25, player.name.toUpperCase(), {
            fontSize: `${Math.min(width, height) * 0.028}px`,
            fill: '#2C3E50',
            fontStyle: 'bold',
            fontFamily: 'Arial',
            stroke: '#FFFFFF',
            strokeThickness: 1
        }).setOrigin(0, 0.5).setAlpha(0); // Caché au début

        // Label "PS:" avec icône cœur - agrandi
        const psLabel = this.add.text(boxX + boxWidth * 0.06, boxY + boxHeight * 0.60, '♥', {
            fontSize: `${Math.min(width, height) * 0.038}px`,
            fill: '#E74C3C',
            fontStyle: 'bold',
            fontFamily: 'Arial'
        }).setOrigin(0, 0.5).setAlpha(0); // Caché au début

        // Barre HP (avec fond 3D et brillance)
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
        
        const hpBarFill = this.add.graphics();
        hpBarFill.fillGradientStyle(hpColor1, hpColor1, hpColor2, hpColor2, 1, 1, 1, 1);
        hpBarFill.fillRoundedRect(
            hpBarX + 2,
            hpBarY - hpBarHeight/2 + 2,
            (hpBarWidth - 4) * hpPercent / 100,
            hpBarHeight - 4,
            4
        );
        hpBarFill.setAlpha(0); // Caché au début
        
        this.playerHPBar = hpBarFill;
        this.playerHPBarProps = { x: hpBarX, y: hpBarY, width: hpBarWidth, height: hpBarHeight, maxHP: player.maxHP };

        // Texte HP numérique avec style - agrandi
        this.playerHPText = this.add.text(boxX + boxWidth * 0.74, boxY + boxHeight * 0.60, `${player.currentHP}/${player.maxHP}`, {
            fontSize: `${Math.min(width, height) * 0.026}px`,
            fill: '#2C3E50',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5).setAlpha(0); // Caché au début
        
        // Stocker tous les éléments pour l'animation
        this.playerUIElements = [nivText, levelText, nameText, psLabel, hpBarFill, this.playerHPText];

        // Sprite joueur (DOS)
        const playerSpriteX = width * 0.22;
        const playerSpriteY = height * 0.45;
        
        if (player.sprites && player.sprites.backCombat) {
            try {
                const spriteUrl = player.sprites.backCombat;
                const sprite = await SpriteLoader.displaySprite(
                    this,
                    playerSpriteX,
                    playerSpriteY,
                    spriteUrl,
                    player.name.substring(0, 2),
                    3.8
                );
                
                if (sprite) {
                    this.playerSprite = sprite;
                    sprite.setAlpha(0);
                    sprite.setDepth(10);
                    
                    // Ombre SOUS le sprite (créée après pour avoir la bonne position)
                    const shadow = this.add.graphics();
                    shadow.fillStyle(0x000000, 0.6);
                    // Position de l'ombre : sous les pieds du sprite
                    const shadowOffsetY = sprite.displayHeight * 0.45;
                    shadow.fillEllipse(playerSpriteX, playerSpriteY + shadowOffsetY, sprite.displayWidth * 0.85, sprite.displayHeight * 0.15);
                    shadow.setDepth(0);
                }
            } catch (error) {
                console.error('[BattleScene] Erreur chargement sprite joueur:', error);
            }
        }
    }

    /**
     * Crée le menu principal de combat moderne (BAS avec FIGHT, SAC, FUIR, POKÉMON)
     */
    createMainMenu(width, height) {
        const menuX = width * 0.02; // Plus près du bord
        const menuY = height * 0.69;
        const menuWidth = width * 0.96; // Presque toute la largeur
        const menuHeight = height * 0.25; // Plus haut

        // Fond du menu avec ombre et dégradé
        this.mainMenuBg = this.add.graphics();
        
        // Ombre portée
        this.mainMenuBg.fillStyle(0x000000, 0.2);
        this.mainMenuBg.fillRoundedRect(menuX + 5, menuY + 5, menuWidth, menuHeight, 15);
        
        // Fond avec dégradé (blanc vers gris clair)
        this.mainMenuBg.fillGradientStyle(0xFFFFFF, 0xFFFFFF, 0xECF0F1, 0xECF0F1, 1, 1, 1, 1);
        this.mainMenuBg.fillRoundedRect(menuX, menuY, menuWidth, menuHeight, 15);
        
        // Bordure extérieure épaisse
        this.mainMenuBg.lineStyle(4, 0x2C3E50, 1);
        this.mainMenuBg.strokeRoundedRect(menuX, menuY, menuWidth, menuHeight, 15);
        
        // Bordure intérieure dorée
        this.mainMenuBg.lineStyle(2, 0xF39C12, 0.6);
        this.mainMenuBg.strokeRoundedRect(menuX + 4, menuY + 4, menuWidth - 8, menuHeight - 8, 12);

        // Zone de texte de dialogue/action (au-dessus du menu)
        const dialogX = width * 0.02;
        const dialogY = height * 0.57;
        const dialogWidth = width * 0.96; // Même largeur que le menu
        const dialogHeight = height * 0.10;

        this.dialogBox = this.add.graphics();
        
        // Ombre du dialogue
        this.dialogBox.fillStyle(0x000000, 0.2);
        this.dialogBox.fillRoundedRect(dialogX + 5, dialogY + 5, dialogWidth, dialogHeight, 12);
        
        // Fond blanc éclatant
        this.dialogBox.fillStyle(0xFFFFFF, 1);
        this.dialogBox.fillRoundedRect(dialogX, dialogY, dialogWidth, dialogHeight, 12);
        
        // Bordure bleue
        this.dialogBox.lineStyle(4, 0x3498DB, 1);
        this.dialogBox.strokeRoundedRect(dialogX, dialogY, dialogWidth, dialogHeight, 12);
        
        // Bordure intérieure subtile
        this.dialogBox.lineStyle(1, 0xBDC3C7, 0.5);
        this.dialogBox.strokeRoundedRect(dialogX + 3, dialogY + 3, dialogWidth - 6, dialogHeight - 6, 10);
        
        this.dialogBox.setVisible(false);

        // Texte de dialogue
        this.dialogText = this.add.text(dialogX + dialogWidth * 0.04, dialogY + dialogHeight * 0.30, '', {
            fontSize: `${Math.min(width, height) * 0.04}px`,
            fill: '#2C3E50',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            wordWrap: { width: dialogWidth * 0.92 }
        }).setOrigin(0, 0);
        this.dialogText.setVisible(false);

        // Boutons du menu (grille 2x2) avec style moderne
        const buttonWidth = menuWidth * 0.44;
        const buttonHeight = menuHeight * 0.40;
        const buttonSpacing = menuWidth * 0.04;

        const buttons = [
            { label: 'COMBATTRE', x: 0, y: 0, color: 0xE74C3C, action: () => this.showMoveSelector() },
            { label: 'SAC', x: 1, y: 0, color: 0x3498DB, action: () => this.showBagMenu() },
            { label: 'POKÉMON', x: 0, y: 1, color: 0x2ECC71, action: () => this.showPokemonMenu() },
            { label: 'FUIR', x: 1, y: 1, color: 0x95A5A6, action: () => this.flee() }
        ];

        this.mainMenuButtons = [];

        buttons.forEach(btn => {
            const btnX = menuX + buttonSpacing + btn.x * (buttonWidth + buttonSpacing);
            const btnY = menuY + buttonSpacing + btn.y * (buttonHeight + buttonSpacing);

            const btnContainer = this.add.container(btnX, btnY);
            
            // Ombre du bouton
            const shadow = this.add.graphics();
            shadow.fillStyle(0x000000, 0.2);
            shadow.fillRoundedRect(3, 3, buttonWidth, buttonHeight, 10);
            btnContainer.add(shadow);
            
            // Fond du bouton avec dégradé
            const buttonBg = this.add.graphics();
            const darkColor = this.darkenColor(btn.color, 0.8);
            buttonBg.fillGradientStyle(btn.color, btn.color, darkColor, darkColor, 1, 1, 1, 1);
            buttonBg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, 10);
            
            // Bordure du bouton
            buttonBg.lineStyle(3, 0xFFFFFF, 0.8);
            buttonBg.strokeRoundedRect(0, 0, buttonWidth, buttonHeight, 10);
            
            btnContainer.add(buttonBg);
            buttonBg.setInteractive(new Phaser.Geom.Rectangle(0, 0, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);

            // Texte du bouton avec ombre
            const buttonText = this.add.text(buttonWidth / 2, buttonHeight / 2, btn.label, {
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
                this.tweens.add({
                    targets: btnContainer,
                    scaleX: 1.05,
                    scaleY: 1.05,
                    duration: 100,
                    ease: 'Power2'
                });
            });

            buttonBg.on('pointerout', () => {
                this.tweens.add({
                    targets: btnContainer,
                    scaleX: 1.0,
                    scaleY: 1.0,
                    duration: 100,
                    ease: 'Power2'
                });
            });

            buttonBg.on('pointerdown', () => {
                if (!this.turnInProgress) {
                    // Flash effet
                    this.tweens.add({
                        targets: btnContainer,
                        alpha: 0.7,
                        duration: 50,
                        yoyo: true,
                        onComplete: () => btn.action()
                    });
                }
            });

            this.mainMenuButtons.push(btnContainer);
        });
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
     * Affiche le sélecteur de moves (remplace le menu principal)
     */
    showMoveSelector() {
        // Cacher le menu principal
        this.mainMenuBg.setVisible(false);
        this.mainMenuButtons.forEach(btn => btn.setVisible(false));

        // Créer le sélecteur de moves si pas déjà fait
        if (!this.moveSelectorCreated) {
            this.createMoveSelector();
            this.moveSelectorCreated = true;
        }

        // Afficher les moves
        this.moveButtons.forEach(btn => btn.setVisible(true));
        if (this.backButton) this.backButton.setVisible(true);
    }

    /**
     * Cache le sélecteur de moves et réaffiche le menu principal
     */
    hideMoveSelector() {
        // Afficher le menu principal
        this.mainMenuBg.setVisible(true);
        this.mainMenuButtons.forEach(btn => btn.setVisible(true));

        // Cacher les moves
        if (this.moveButtons) {
            this.moveButtons.forEach(btn => btn.setVisible(false));
        }
        if (this.backButton) this.backButton.setVisible(false);
    }

    /**
     * Crée le sélecteur de moves avec design moderne - pleine largeur
     */
    createMoveSelector() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const menuX = width * 0.02;
        const menuY = height * 0.68;
        const menuWidth = width * 0.96;
        const menuHeight = height * 0.25;

        const player = this.battleState.playerActive;
        const moveset = player.moveset || [];

        // Ajouter des moves par défaut pour compléter
        const defaultMoves = [
            { name: 'Charge', type: 'normal', category: 'physical', power: 40, pp: 35, maxPP: 35 },
            { name: 'Groz\'Yeux', type: 'normal', category: 'status', power: 0, pp: 30, maxPP: 30 },
            { name: 'Vive-Attaque', type: 'normal', category: 'physical', power: 40, pp: 30, maxPP: 30 },
            { name: 'Cru-Aile', type: 'flying', category: 'physical', power: 60, pp: 35, maxPP: 35 }
        ];
        
        while (moveset.length < 4) {
            const nextMove = defaultMoves[moveset.length];
            if (nextMove) moveset.push(nextMove);
            else break;
        }

        this.moveButtons = [];

        // Afficher seulement les moves disponibles (toujours 4)
        const numMoves = Math.min(moveset.length, 4);
        
        const btnWidth = menuWidth * 0.46; // Plus large
        const btnHeight = menuHeight * 0.38; // Légèrement plus petit pour faire de la place
        const spacing = menuWidth * 0.015; // Petit espacement
        
        for (let i = 0; i < numMoves; i++) {
            const move = moveset[i];
            if (!move || !move.name) continue;

            const row = Math.floor(i / 2);
            const col = i % 2;

            const btnX = menuX + spacing + col * (btnWidth + spacing);
            const btnY = menuY + spacing + row * (btnHeight + spacing);

            const moveButton = this.createMoveButton(move, btnX, btnY, btnWidth, btnHeight);
            moveButton.setVisible(false);
            this.moveButtons.push(moveButton);
        }

        // Bouton RETOUR petit en bas à droite
        const backBtnWidth = menuWidth * 0.25; // Petit bouton
        const backBtnHeight = menuHeight * 0.15; // Compact
        const backBtnX = menuX + menuWidth - backBtnWidth;
        const backBtnY = menuY + menuHeight - backBtnHeight + spacing;

        const backContainer = this.add.container(backBtnX, backBtnY);
        
        // Ombre
        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.2);
        shadow.fillRoundedRect(4, 4, backBtnWidth, backBtnHeight, 10);
        backContainer.add(shadow);
        
        // Fond gris avec dégradé
        const buttonBg = this.add.graphics();
        buttonBg.fillGradientStyle(0xBDC3C7, 0xBDC3C7, 0x7F8C8D, 0x7F8C8D, 1, 1, 1, 1);
        buttonBg.fillRoundedRect(0, 0, backBtnWidth, backBtnHeight, 10);
        buttonBg.lineStyle(3, 0xFFFFFF, 0.9);
        buttonBg.strokeRoundedRect(0, 0, backBtnWidth, backBtnHeight, 10);
        backContainer.add(buttonBg);
        
        buttonBg.setInteractive(new Phaser.Geom.Rectangle(0, 0, backBtnWidth, backBtnHeight), Phaser.Geom.Rectangle.Contains);

        const backText = this.add.text(backBtnWidth / 2, backBtnHeight / 2, 'RETOUR', {
            fontSize: `${Math.min(width, height) * 0.030}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold',
            fontFamily: 'Arial',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);
        backContainer.add(backText);

        buttonBg.on('pointerover', () => {
            this.tweens.add({ targets: backContainer, scaleX: 1.05, scaleY: 1.05, duration: 100 });
        });

        buttonBg.on('pointerout', () => {
            this.tweens.add({ targets: backContainer, scaleX: 1.0, scaleY: 1.0, duration: 100 });
        });

        buttonBg.on('pointerdown', () => {
            this.tweens.add({
                targets: backContainer,
                alpha: 0.7,
                duration: 50,
                yoyo: true,
                onComplete: () => this.hideMoveSelector()
            });
        });

        this.backButton = backContainer;
        this.backButton.setVisible(false);
    }

    /**
     * Crée un bouton de capacité avec design moderne
     */
    createMoveButton(move, x, y, width, height) {
        if (!move || !move.name) {
            console.warn('[BattleScene] Move invalide:', move);
            return this.add.container(x, y);
        }

        const minDim = Math.min(this.cameras.main.width, this.cameras.main.height);
        const container = this.add.container(x, y);
        
        // Ombre du bouton
        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.25);
        shadow.fillRoundedRect(4, 4, width, height, 10);
        container.add(shadow);

        // Couleur de type avec dégradé
        const typeColor = this.getTypeColor(move.type);
        const darkTypeColor = this.darkenColor(typeColor, 0.7);
        
        const buttonBg = this.add.graphics();
        buttonBg.fillGradientStyle(typeColor, typeColor, darkTypeColor, darkTypeColor, 1, 1, 1, 1);
        buttonBg.fillRoundedRect(0, 0, width, height, 10);
        
        // Bordure blanche brillante
        buttonBg.lineStyle(3, 0xFFFFFF, 0.9);
        buttonBg.strokeRoundedRect(0, 0, width, height, 10);
        
        // Bordure intérieure subtile
        buttonBg.lineStyle(1, 0x000000, 0.3);
        buttonBg.strokeRoundedRect(3, 3, width - 6, height - 6, 8);
        
        container.add(buttonBg);
        buttonBg.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);

        // Nom de la capacité avec ombre
        const moveName = this.add.text(width * 0.08, height * 0.20, move.name, {
            fontSize: `${minDim * 0.04}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold',
            fontFamily: 'Arial',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0);
        container.add(moveName);

        // Badge de type avec ombre et bordure
        const typeWidth = width * 0.4;
        const typeHeight = height * 0.30;
        const typeX = width * 0.08;
        const typeY = height * 0.60;
        
        const typeBadge = this.add.graphics();
        
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

        // Texte du type
        const typeText = this.add.text(typeX + typeWidth / 2, typeY + typeHeight / 2, move.type.toUpperCase(), {
            fontSize: `${minDim * 0.035}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold',
            fontFamily: 'Arial',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        container.add(typeText);

        // PP avec cercle élégant
        const ppX = width * 0.70;
        const ppY = height * 0.70;
        
        // Cercle pour PP
        const ppCircle = this.add.graphics();
        ppCircle.fillStyle(0x000000, 0.4);
        ppCircle.fillCircle(ppX, ppY, height * 0.18);
        ppCircle.lineStyle(2, 0xFFFFFF, 0.9);
        ppCircle.strokeCircle(ppX, ppY, height * 0.18);
        container.add(ppCircle);
        
        const ppText = this.add.text(ppX, ppY, `${move.pp || 0}`, {
            fontSize: `${minDim * 0.04}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold',
            fontFamily: 'Arial'
        }).setOrigin(0.5);
        container.add(ppText);

        // Interactions avec animations
        buttonBg.on('pointerover', () => {
            this.tweens.add({
                targets: container,
                scaleX: 1.05,
                scaleY: 1.05,
                duration: 100,
                ease: 'Power2'
            });
        });

        buttonBg.on('pointerout', () => {
            this.tweens.add({
                targets: container,
                scaleX: 1.0,
                scaleY: 1.0,
                duration: 100,
                ease: 'Power2'
            });
        });

        buttonBg.on('pointerdown', () => {
            if (!this.turnInProgress && (move.pp || 0) > 0) {
                this.tweens.add({
                    targets: container,
                    alpha: 0.7,
                    duration: 50,
                    yoyo: true,
                    onComplete: () => this.selectMove(move.name)
                });
            }
        });

        return container;
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
     * Affiche le menu du sac (TODO: implémenter)
     */
    showBagMenu() {
        this.showDialog("Le sac n'est pas encore disponible !");
        setTimeout(() => this.hideDialog(), 2000);
    }

    /**
     * Affiche le menu des Pokémon (TODO: implémenter)
     */
    showPokemonMenu() {
        this.showDialog("Changement de Pokémon pas encore disponible !");
        setTimeout(() => this.hideDialog(), 2000);
    }

    /**
     * Affiche un message dans la boîte de dialogue
     */
    showDialog(message) {
        if (this.dialogBox) {
            this.dialogBox.setVisible(true);
            this.dialogText.setText(message);
            this.dialogText.setVisible(true);
        }
    }

    /**
     * Cache la boîte de dialogue
     */
    hideDialog() {
        if (this.dialogBox) {
            this.dialogBox.setVisible(false);
            this.dialogText.setVisible(false);
        }
    }

    /**
     * Animations de glissement des éléments UI
     */
    async playUIEntryAnimations(width, height) {
        // Récupérer les conteneurs Graphics
        const opponentContainer = this.children.getByName('opponentContainer');
        const playerContainer = this.children.getByName('playerContainer');
        
        // Cacher les box au début (on va les faire apparaître en fondu)
        if (opponentContainer) opponentContainer.setAlpha(0);
        if (playerContainer) playerContainer.setAlpha(0);
        
        // 1. Faire apparaître la box adversaire en fondu d'abord
        if (opponentContainer) {
            await new Promise(resolve => {
                this.tweens.add({
                    targets: [opponentContainer, ...this.opponentUIElements],
                    alpha: 1,
                    duration: 300,
                    ease: 'Power2',
                    onComplete: resolve
                });
            });
        }
        
        await this.wait(100);
        
        // 2. Glissement sprite adversaire depuis la gauche
        if (this.opponentSprite) {
            const originalX = this.opponentSprite.x;
            this.opponentSprite.x = -width * 0.3; // Hors écran à gauche
            this.opponentSprite.setAlpha(1);
            
            await new Promise(resolve => {
                this.tweens.add({
                    targets: this.opponentSprite,
                    x: originalX,
                    duration: 600,
                    ease: 'Back.easeOut',
                    onComplete: resolve
                });
            });
        }
        
        await this.wait(200);
        
        // 3. Faire apparaître la box joueur en fondu
        if (playerContainer) {
            await new Promise(resolve => {
                this.tweens.add({
                    targets: [playerContainer, ...this.playerUIElements],
                    alpha: 1,
                    duration: 300,
                    ease: 'Power2',
                    onComplete: resolve
                });
            });
        }
        
        await this.wait(100);
        
        // 4. Glissement sprite joueur depuis la droite
        if (this.playerSprite) {
            const originalX = this.playerSprite.x;
            this.playerSprite.x = width * 1.3; // Hors écran à droite
            this.playerSprite.setAlpha(1);
            
            await new Promise(resolve => {
                this.tweens.add({
                    targets: this.playerSprite,
                    x: originalX,
                    duration: 600,
                    ease: 'Back.easeOut',
                    onComplete: resolve
                });
            });
        }
        
        await this.wait(300);
        
        // 5. Apparition du menu en fondu
        await new Promise(resolve => {
            this.tweens.add({
                targets: [this.mainMenuBg, ...this.mainMenuButtons],
                alpha: 1,
                duration: 400,
                ease: 'Power2',
                onComplete: resolve
            });
        });
        
        await this.wait(200);
        
        // 6. Message d'apparition + affichage dialogue
        const opponent = this.battleState.opponentActive;
        this.showDialog(`Un ${opponent.name} sauvage apparaît !`);
        
        await this.wait(1500);
        
        // 7. Message d'action
        this.showDialog(`Que va faire ${this.battleState.playerActive.name} ?`);
    }
    playIntroAnimation() {
        // Cette fonction n'est plus utilisée
        // Les animations sont maintenant gérées par playUIEntryAnimations
    }

    /**
     * Sélectionne et exécute un move
     */
    async selectMove(move) {
        if (this.turnInProgress) return;

        this.turnInProgress = true;
        console.log('[BattleScene] Move sélectionné:', move.name);

        // Cacher le sélecteur de moves
        this.hideMoveSelector();

        try {
            // Message d'action
            this.showDialog(`${this.battleState.playerActive.name} utilise ${move.name} !`);

            // Petite pause pour lire le message
            await this.wait(800);

            // Exécuter le tour
            const result = await this.battleManager.takeTurn(
                this.battleId,
                move.name
            );

            console.log('[BattleScene] Résultat tour:', result);

            // Animer le tour
            await this.animateTurn(result);

            // Mettre à jour l'UI
            await this.updateBattleState(result);

            // Vérifier fin de combat
            if (result.isOver) {
                this.endBattle(result.winner);
            } else {
                // Réafficher le menu principal
                this.hideDialog();
                setTimeout(() => {
                    this.showDialog(`Que va faire ${this.battleState.playerActive.name} ?`);
                }, 500);
                this.turnInProgress = false;
            }

        } catch (error) {
            console.error('[BattleScene] Erreur tour:', error);
            this.showDialog('Une erreur est survenue !');
            setTimeout(() => {
                this.hideDialog();
                this.turnInProgress = false;
            }, 2000);
        }
    }

    /**
     * Utilitaire: Attendre un délai
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Anime un tour de combat avec messages
     */
    async animateTurn(result) {
        // Animation du joueur
        if (result.playerAction && !result.playerAction.missed) {
            await this.animateAttack(this.playerSprite, this.opponentSprite, result.playerAction);
            if (result.playerAction.damage > 0) {
                await this.animateHPDrain(this.opponentHPBar, this.opponentHPText, result.opponentHP, this.battleState.opponentActive.maxHP);
                
                // Message de dégâts
                const effectiveness = result.playerAction.effectiveness;
                if (effectiveness > 1) {
                    this.showDialog("C'est super efficace !");
                    await this.wait(1000);
                } else if (effectiveness < 1 && effectiveness > 0) {
                    this.showDialog("Ce n'est pas très efficace...");
                    await this.wait(1000);
                } else if (effectiveness === 0) {
                    this.showDialog("Ça n'a aucun effet...");
                    await this.wait(1000);
                }

                if (result.playerAction.critical) {
                    this.showDialog("Coup critique !");
                    await this.wait(800);
                }
            }
        }

        // Animation de l'adversaire
        if (result.opponentAction && !result.opponentAction.missed) {
            const opponent = this.battleState.opponentActive;
            this.showDialog(`${opponent.name} utilise ${result.opponentAction.move || 'une attaque'} !`);
            await this.wait(800);

            await this.animateAttack(this.opponentSprite, this.playerSprite, result.opponentAction);
            if (result.opponentAction.damage > 0) {
                await this.animateHPDrain(this.playerHPBar, this.playerHPText, result.playerHP, this.battleState.playerActive.maxHP);
                
                // Message de dégâts
                const effectiveness = result.opponentAction.effectiveness;
                if (effectiveness > 1) {
                    this.showDialog("C'est super efficace !");
                    await this.wait(1000);
                } else if (effectiveness < 1 && effectiveness > 0) {
                    this.showDialog("Ce n'est pas très efficace...");
                    await this.wait(1000);
                }

                if (result.opponentAction.critical) {
                    this.showDialog("Coup critique !");
                    await this.wait(800);
                }
            }
        }
    }

    /**
     * Anime une attaque
     */
    async animateAttack(attackerSprite, defenderSprite, actionData) {
        return new Promise((resolve) => {
            if (!attackerSprite || !defenderSprite) {
                resolve();
                return;
            }

            // Shake de l'attaquant
            this.tweens.add({
                targets: attackerSprite,
                x: attackerSprite.x + 10,
                duration: 50,
                yoyo: true,
                repeat: 3,
                onComplete: () => {
                    // Flash du défenseur
                    this.tweens.add({
                        targets: defenderSprite,
                        alpha: 0.3,
                        duration: 100,
                        yoyo: true,
                        repeat: 2,
                        onComplete: () => {
                            // Shake caméra si coup critique
                            if (actionData.critical) {
                                this.cameras.main.shake(200, 0.01);
                            }
                            resolve();
                        }
                    });
                }
            });
        });
    }

    /**
     * Anime la perte de HP
     */
    /**
     * Animation des barres de HP (compatible avec Graphics)
     */
    async animateHPDrain(hpBar, hpText, newHP, maxHP) {
        return new Promise((resolve) => {
            // Calculer le nouveau pourcentage et la nouvelle couleur
            const newPercent = Math.max(0, (newHP / maxHP) * 100);
            
            // Déterminer les couleurs de dégradé en fonction du %
            let hpColor1, hpColor2;
            if (newPercent > 50) {
                hpColor1 = 0x2ECC71; // Vert
                hpColor2 = 0x27AE60;
            } else if (newPercent > 20) {
                hpColor1 = 0xF39C12; // Orange
                hpColor2 = 0xE67E22;
            } else {
                hpColor1 = 0xE74C3C; // Rouge
                hpColor2 = 0xC0392B;
            }

            // Récupérer les propriétés de la barre depuis l'objet stocké
            const barProps = hpBar === this.opponentHPBar ? this.opponentHPBarProps : this.playerHPBarProps;
            if (!barProps) {
                console.error('[BattleScene] HP bar props not found');
                resolve();
                return;
            }

            // Calculer la largeur actuelle et la nouvelle largeur
            const maxBarWidth = barProps.width - 4; // -4 pour le padding intérieur
            const currentWidth = maxBarWidth * (this.battleState[hpBar === this.opponentHPBar ? 'opponentActive' : 'playerActive'].currentHP / maxHP);
            const targetWidth = maxBarWidth * (newHP / maxHP);

            // Animer avec un compteur pour redessiner la barre progressivement
            this.tweens.addCounter({
                from: currentWidth,
                to: targetWidth,
                duration: 500,
                ease: 'Power2',
                onUpdate: (tween) => {
                    const currentAnimWidth = tween.getValue();
                    
                    // Effacer et redessiner la barre
                    hpBar.clear();
                    
                    // Ombre de la barre
                    hpBar.fillStyle(0x000000, 0.2);
                    hpBar.fillRoundedRect(
                        barProps.x + 4,
                        barProps.y - barProps.height / 2 + 2,
                        maxBarWidth,
                        barProps.height - 4,
                        4
                    );
                    
                    // Fond sombre de la barre
                    hpBar.fillStyle(0x34495E, 1);
                    hpBar.fillRoundedRect(
                        barProps.x + 2,
                        barProps.y - barProps.height / 2,
                        maxBarWidth,
                        barProps.height - 4,
                        4
                    );
                    
                    // Remplissage avec dégradé (animé)
                    if (currentAnimWidth > 0) {
                        hpBar.fillGradientStyle(hpColor1, hpColor1, hpColor2, hpColor2, 1, 1, 1, 1);
                        hpBar.fillRoundedRect(
                            barProps.x + 2,
                            barProps.y - barProps.height / 2,
                            currentAnimWidth,
                            barProps.height - 4,
                            4
                        );
                    }
                    
                    // Mettre à jour le texte HP si présent (seulement pour le joueur)
                    if (hpText) {
                        hpText.setText(`${Math.max(0, Math.floor(newHP))}/${maxHP}`);
                    }
                },
                onComplete: () => {
                    // Mise à jour finale pour s'assurer que la barre est correcte
                    hpBar.clear();
                    
                    hpBar.fillStyle(0x000000, 0.2);
                    hpBar.fillRoundedRect(
                        barProps.x + 4,
                        barProps.y - barProps.height / 2 + 2,
                        maxBarWidth,
                        barProps.height - 4,
                        4
                    );
                    
                    hpBar.fillStyle(0x34495E, 1);
                    hpBar.fillRoundedRect(
                        barProps.x + 2,
                        barProps.y - barProps.height / 2,
                        maxBarWidth,
                        barProps.height - 4,
                        4
                    );
                    
                    if (targetWidth > 0) {
                        hpBar.fillGradientStyle(hpColor1, hpColor1, hpColor2, hpColor2, 1, 1, 1, 1);
                        hpBar.fillRoundedRect(
                            barProps.x + 2,
                            barProps.y - barProps.height / 2,
                            targetWidth,
                            barProps.height - 4,
                            4
                        );
                    }
                    
                    resolve();
                }
            });
        });
    }

    /**
     * Met à jour l'état du combat
     */
    async updateBattleState(result) {
        this.battleState.playerActive.currentHP = result.playerHP;
        this.battleState.opponentActive.currentHP = result.opponentHP;
    }

    /**
     * Termine le combat
     */
    endBattle(winner) {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Overlay
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0);
        
        // Message de victoire/défaite
        const message = winner === 'player' ? 'VICTOIRE !' : 'DÉFAITE...';
        const color = winner === 'player' ? '#00FF00' : '#FF0000';

        const text = this.add.text(width * 0.5, height * 0.5, message, {
            fontSize: `${Math.min(width, height) * 0.1}px`,
            fill: color,
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setAlpha(0);

        // Animation
        this.tweens.add({
            targets: text,
            alpha: 1,
            scale: 1.2,
            duration: 500,
            ease: 'Back.easeOut',
            onComplete: () => {
                setTimeout(() => this.returnToScene(), 2000);
            }
        });
    }

    /**
     * Fuit le combat
     */
    async flee() {
        if (this.battleType !== 'wild') {
            this.showDialog("Impossible de fuir un combat de dresseur !");
            setTimeout(() => this.hideDialog(), 2000);
            return;
        }

        console.log('[BattleScene] Fuite du combat');
        this.showDialog("Vous avez pris la fuite !");
        
        await this.wait(1500);
        this.returnToScene();
    }

    /**
     * Retourne à la scène précédente
     */
    returnToScene() {
        console.log('[BattleScene] Retour à:', this.returnScene);
        this.scene.start(this.returnScene, { playerId: this.playerId });
    }

    /**
     * Retourne la couleur d'un type
     */
    getTypeColor(type) {
        const typeColors = {
            normal: 0xA8A878, fire: 0xF08030, water: 0x6890F0, electric: 0xF8D030,
            grass: 0x78C850, ice: 0x98D8D8, fighting: 0xC03028, poison: 0xA040A0,
            ground: 0xE0C068, flying: 0xA890F0, psychic: 0xF85888, bug: 0xA8B820,
            rock: 0xB8A038, ghost: 0x705898, dragon: 0x7038F8, dark: 0x705848,
            steel: 0xB8B8D0, fairy: 0xEE99AC
        };
        return typeColors[type?.toLowerCase()] || typeColors.normal;
    }
}
