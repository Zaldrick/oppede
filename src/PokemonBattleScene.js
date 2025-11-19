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

// Battle Managers (refactoring modulaire)
import BattleUIManager from './battle/BattleUIManager';
import BattleMenuManager from './battle/BattleMenuManager';
import BattleAnimationManager from './battle/BattleAnimationManager';
import BattleSpriteManager from './battle/BattleSpriteManager';
import BattleTurnManager from './battle/BattleTurnManager';

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
        this.turnInProgress = false;
        
        // Cache traductions FR (moves)
        this.translationsCache = {};
        
        // ✅ Battle Managers (refactoring modulaire)
        this.uiManager = null;
        this.menuManager = null;
        this.animManager = null;
        this.spriteManager = null;
        this.turnManager = null;
    }

    init(data) {
        console.log('[BattleScene] Init avec data:', data);
        this.playerId = data.playerId;
        this.battleType = data.battleType || 'wild';
        this.opponentId = data.opponentId || null;
        this.returnScene = data.returnScene || 'PokemonTeamScene';
        this.restoreBattleState = data.restoreBattleState || null; // 🆕 État à restaurer
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

        // ✅ Initialiser les managers modulaires (refactoring)
        // 🆕 Option pour sprites animés (GIF) ou statiques (PNG)
        // Charger depuis localStorage (défaut: true si non défini)
        this.useAnimatedSprites = localStorage.getItem('useAnimatedSprites') !== 'false';
        this.gifContainers = []; // Référence pour cleanup DOM
        console.log(`[BattleScene] Mode sprites: ${this.useAnimatedSprites ? 'GIF animés' : 'PNG statiques'}`);
        
        // 🆕 Écouter l'événement resume pour réafficher les GIFs et menu après fermeture des menus
        this.events.on('resume', () => {
            console.log('[BattleScene] Scene resumed - réaffichage des GIFs et menu principal');
            const SpriteLoader = require('./utils/spriteLoader').default;
            SpriteLoader.showAllGifs(this);
            
            // Réafficher le menu principal si on revient d'un sous-menu
            if (this.mainMenuBg) this.mainMenuBg.setVisible(true);
            if (this.mainMenuButtons) {
                this.mainMenuButtons.forEach(btn => btn.setVisible(true));
            }
        });
        
        this.uiManager = new BattleUIManager(this);
        this.menuManager = new BattleMenuManager(this);
        this.animManager = new BattleAnimationManager(this);
        this.spriteManager = new BattleSpriteManager(this);
        this.turnManager = new BattleTurnManager(this);
        console.log('[BattleScene] Managers initialisés:', {
            uiManager: !!this.uiManager,
            menuManager: !!this.menuManager,
            animManager: !!this.animManager,
            spriteManager: !!this.spriteManager,
            turnManager: !!this.turnManager,
            useAnimatedSprites: this.useAnimatedSprites
        });

        try {
            // 🆕 Restaurer l'état du combat ou démarrer nouveau combat
            if (this.restoreBattleState) {
                console.log('[BattleScene] Restauration état combat existant');
                this.battleState = this.restoreBattleState;
                this.battleId = this.battleState._id || this.battleState.battleId;
            } else {
                // Démarrer le combat (pendant le spiral)
                const battleData = await this.battleManager.startBattle(
                    this.playerId,
                    this.opponentId,
                    this.battleType
                );

                this.battleId = battleData.battleId;
                this.battleState = {
                    _id: battleData.battleId,
                    battleId: battleData.battleId,
                    battleType: this.battleType,
                    opponentId: this.opponentId,
                    playerTeam: battleData.playerTeam,
                    opponentTeam: battleData.opponentTeam,
                    playerActive: battleData.playerTeam[0],
                    opponentActive: battleData.opponentTeam[0],
                    battleLog: battleData.battleLog || []
                };
            }
            
            // Debug: vérifier les données du Pokémon actif
            console.log('[BattleScene] Pokémon actif:', {
                name: this.battleState.playerActive.name,
                level: this.battleState.playerActive.level,
                experience: this.battleState.playerActive.experience,
                currentHP: this.battleState.playerActive.currentHP,
                maxHP: this.battleState.playerActive.maxHP
            });

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

            await this.wait(200);
            // Créer l'UI avec animations progressives
            await this.createBattleUI(width, height);

        } catch (error) {
            console.error('[BattleScene] Erreur démarrage combat:', error);
            
            // Afficher un message d'erreur clair à l'utilisateur
            const errorMessage = error.message || 'Erreur inconnue';
            
            // Créer un overlay sombre
            const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8).setOrigin(0);
            
            // Message d'erreur stylé
            const errorBox = this.add.rectangle(width * 0.5, height * 0.5, width * 0.8, height * 0.4, 0x2C3E50);
            errorBox.setStrokeStyle(4, 0xE74C3C);
            
            const errorTitle = this.add.text(width * 0.5, height * 0.38, '⚠️ Impossible de lancer le combat', {
                fontSize: `${Math.min(width, height) * 0.05}px`,
                fill: '#E74C3C',
                fontWeight: 'bold',
                fontFamily: 'Arial'
            }).setOrigin(0.5);
            
            const errorText = this.add.text(width * 0.5, height * 0.5, errorMessage, {
                fontSize: `${Math.min(width, height) * 0.04}px`,
                fill: '#FFFFFF',
                fontFamily: 'Arial',
                align: 'center',
                wordWrap: { width: width * 0.7 }
            }).setOrigin(0.5);
            
            const hintText = this.add.text(width * 0.5, height * 0.6, '💡 Astuce: Utilisez les boutons debug pour créer des Pokémon', {
                fontSize: `${Math.min(width, height) * 0.032}px`,
                fill: '#95A5A6',
                fontFamily: 'Arial',
                align: 'center',
                wordWrap: { width: width * 0.7 }
            }).setOrigin(0.5);
            
            // Retour automatique après 3 secondes
            setTimeout(() => this.returnToScene(), 3000);
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
        console.log('[BattleScene] Création UI (via managers)');

        // Zone adversaire (haut gauche) - sera glissée depuis la gauche
        await this.uiManager.createOpponentUI(width, height);
        
        // 🆕 Créer sprite adversaire
        await this.spriteManager.createOpponentSprite(width, height);

        // Zone joueur (bas droite) - sera glissée depuis la droite
        await this.uiManager.createPlayerUI(width, height);
        
        // 🆕 Créer sprite joueur
        await this.spriteManager.createPlayerSprite(width, height);

        // Menu principal (bas) - apparition en fondu
        this.uiManager.createMainMenu(width, height);
        
        // Cacher le menu au début
        this.mainMenuBg.setAlpha(0);
        this.mainMenuButtons.forEach(btn => btn.setAlpha(0));

        // Animation de glissement + apparitions progressives
        await this.animManager.playUIEntryAnimations(width, height);
    }


    /**
     * Crée l'UI du joueur (BAS DROITE) avec design moderne
     */
    async createPlayerUI(width, height) {
        const boxX = width * 0.50;
        const boxY = height * 0.44;
        const boxWidth = width * 0.47;
        const boxHeight = height * 0.12;

        // Container avec ombre portée et dégradé
        const container = this.add.graphics();
        container.setDepth(2);
        container.setName('playerContainer');
        container.setAlpha(0); // Caché au début
        //container.setDepth(8); // Devant le sprite joueur (depth: 10) pour que la box cache les gros sprites
        
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
        
        // Calculer le level depuis l'XP si manquant ou incorrect
        if (!player.level || player.level === 1) {
            const calculatedLevel = this.calculateLevelFromXP(player.experience || 0);
            if (calculatedLevel !== player.level) {
                console.warn(`[BattleScene] Level incorrect (${player.level}), recalculé: ${calculatedLevel}`);
                player.level = calculatedLevel;
            }
        }
        
        console.log('[BattleScene] Player data:', {
            name: player.name,
            level: player.level,
            experience: player.experience
        });
        
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
        }).setOrigin(0.5).setAlpha(0).setDepth(3); // Caché au début
        
        // Texte niveau - police agrandie (avec fallback si level manquant)
        const displayLevel = player.level || 1;
        const levelText = this.add.text(levelBadgeX, levelBadgeY, displayLevel, {
            fontSize: `${Math.min(width, height) * 0.038}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold',
            fontFamily: 'Arial'
        }).setOrigin(0.5).setAlpha(0).setDepth(3); // Caché au début

        // Nom du Pokémon avec ombre
        const nameText = this.add.text(boxX + boxWidth * 0.06, boxY + boxHeight * 0.25, player.name.toUpperCase(), {
            fontSize: `${Math.min(width, height) * 0.028}px`,
            fill: '#2C3E50',
            fontStyle: 'bold',
            fontFamily: 'Arial',
            stroke: '#FFFFFF',
            strokeThickness: 1
        }).setOrigin(0, 0.5).setAlpha(0).setDepth(3); // Caché au début

        // Label "PS:" avec icône cœur - agrandi
        const psLabel = this.add.text(boxX + boxWidth * 0.06, boxY + boxHeight * 0.60, '♥', {
            fontSize: `${Math.min(width, height) * 0.038}px`,
            fill: '#E74C3C',
            fontStyle: 'bold',
            fontFamily: 'Arial'
        }).setOrigin(0, 0.5).setAlpha(0).setDepth(3); // Caché au début

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
        hpBarFill.setAlpha(0).setDepth(3); // Caché au début
        
        this.playerHPBar = hpBarFill;
        this.playerHPBarProps = { x: hpBarX, y: hpBarY, width: hpBarWidth, height: hpBarHeight, maxHP: player.maxHP };

        // Texte HP numérique avec style - agrandi
        this.playerHPText = this.add.text(boxX + boxWidth * 0.74, boxY + boxHeight * 0.60, `${player.currentHP}/${player.maxHP}`, {
            fontSize: `${Math.min(width, height) * 0.026}px`,
            fill: '#2C3E50',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5).setAlpha(0).setDepth(3); // Caché au début

        // ========== BARRE D'XP (sous la barre HP) ==========
        const xpBarX = boxX + boxWidth * 0.06;
        const xpBarY = boxY + boxHeight * 0.82;
        const xpBarWidth = boxWidth * 0.88;
        const xpBarHeight = height * 0.008;

        // Label "XP" à gauche
        const xpLabel = this.add.text(xpBarX, xpBarY, 'XP', {
            fontSize: `${Math.min(width, height) * 0.022}px`,
            fill: '#7F8C8D',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5).setAlpha(0).setDepth(3); // Caché au début

        // Fond de la barre XP (gris clair)
        container.fillStyle(0xBDC3C7, 1);
        container.fillRoundedRect(xpBarX + boxWidth * 0.10, xpBarY - xpBarHeight/2, xpBarWidth * 0.85, xpBarHeight, 4);
        
        container.lineStyle(1, 0x95A5A6, 1);
        container.strokeRoundedRect(xpBarX + boxWidth * 0.10, xpBarY - xpBarHeight/2, xpBarWidth * 0.85, xpBarHeight, 4);

        // Calculer l'XP pour le niveau actuel
        const currentLevelXP = this.calculateXPForLevel(player.level || 1);
        const nextLevelXP = this.calculateXPForLevel((player.level || 1) + 1);
        const xpInLevel = (player.experience || 0) - currentLevelXP;
        const xpNeededForLevel = nextLevelXP - currentLevelXP;
        const xpPercent = Math.max(0, Math.min(100, (xpInLevel / xpNeededForLevel) * 100));
        
        // Debug XP
        console.log('[BattleScene] XP Bar calculation:', {
            level: player.level,
            experience: player.experience,
            currentLevelXP,
            nextLevelXP,
            xpInLevel,
            xpNeededForLevel,
            xpPercent: xpPercent.toFixed(2) + '%'
        });

        // Barre XP (bleu cyan avec dégradé)
        const xpBarFill = this.add.graphics();
        xpBarFill.fillGradientStyle(0x3498DB, 0x3498DB, 0x2980B9, 0x2980B9, 1, 1, 1, 1);
        xpBarFill.fillRoundedRect(
            xpBarX + boxWidth * 0.10 + 1,
            xpBarY - xpBarHeight/2 + 1,
            (xpBarWidth * 0.85 - 2) * xpPercent / 100,
            xpBarHeight - 2,
            3
        );
        xpBarFill.setAlpha(0).setDepth(3); // Caché au début

        this.playerXPBar = xpBarFill;
        this.playerXPBarProps = {
            x: xpBarX + boxWidth * 0.10,
            y: xpBarY,
            width: xpBarWidth * 0.85,
            height: xpBarHeight,
            currentLevelXP: currentLevelXP,
            nextLevelXP: nextLevelXP
        };
        
        // Stocker tous les éléments pour l'animation
        this.playerUIElements = [nivText, levelText, nameText, psLabel, hpBarFill, this.playerHPText, xpLabel, xpBarFill];
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
        this.dialogBox.setDepth(10000); // Au-dessus de tout
        
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
        this.dialogText.setDepth(10001); // Au-dessus de la dialogBox
        this.dialogText.setVisible(false);

        // Boutons du menu (grille 2x2) avec style moderne
        const buttonWidth = menuWidth * 0.44;
        const buttonHeight = menuHeight * 0.40;
        const buttonSpacing = menuWidth * 0.04;

        const buttons = [
            { label: 'COMBATTRE', x: 0, y: 0, color: 0xE74C3C, action: () => this.menuManager.showMoveSelector() },
            { label: 'SAC', x: 1, y: 0, color: 0x3498DB, action: () => this.showInventory() },
            { label: 'POKÉMON', x: 0, y: 1, color: 0x2ECC71, action: () => this.menuManager.showPokemonMenu() },
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
    async showMoveSelector() {
        // Cacher le menu principal
        this.mainMenuBg.setVisible(false);
        this.mainMenuButtons.forEach(btn => btn.setVisible(false));

        // ✅ Recréer le sélecteur si Pokemon a changé (nouvelles attaques)
        if (this.moveButtons && this.moveButtons.length > 0) {
            this.moveButtons.forEach(btn => {
                if (btn && btn.destroy) btn.destroy();
            });
            this.moveButtons = [];
        }
        if (this.backButton) {
            this.backButton.destroy();
            this.backButton = null;
        }
        
        // Recréer avec le moveset actuel
        await this.uiManager.createMoveSelector();
        
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
    async createMoveSelector() {
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

            const moveButton = await this.createMoveButton(move, btnX, btnY, btnWidth, btnHeight); // 🆕 await
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
                onComplete: () => this.menuManager.hideMoveSelector()
            });
        });

        this.backButton = backContainer;
        this.backButton.setVisible(false);
    }

    /**
     * Crée un bouton de capacité avec design moderne
     */
    async createMoveButton(move, x, y, width, height) {
        if (!move || !move.name) {
            console.warn('[BattleScene] Move invalide:', move);
            return this.add.container(x, y);
        }

        // 🆕 Traduire nom du move en FR
        const moveNameFR = await this.getMoveName(move.name);

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

        // Nom de la capacité avec ombre (🆕 Utiliser nom traduit FR)
        const moveName = this.add.text(width * 0.08, height * 0.20, moveNameFR, {
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
            // 🆕 Vérifier si joueur K.O. avant d'autoriser action
            const playerKO = this.battleState?.playerActive?.currentHP <= 0;
            if (playerKO) {
                console.warn('[BattleScene] Joueur K.O., action bloquée');
                this.menuManager.showDialog('Vous devez changer de Pokémon !');
                return;
            }
            
            if (!this.turnInProgress && (move.pp || 0) > 0) {
                this.tweens.add({
                    targets: container,
                    alpha: 0.7,
                    duration: 50,
                    yoyo: true,
                    onComplete: () => this.turnManager.selectMove(move.name)
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
    /**
     * Masque le menu principal de combat
     */
    hideMainMenu() {
        // Masquer le dialogue et les boutons du menu principal
        if (this.dialogBox) this.dialogBox.setVisible(false);
        if (this.dialogText) this.dialogText.setVisible(false);
        
        // Masquer les boutons d'action si présents
        if (this.actionButtons) {
            this.actionButtons.forEach(btn => {
                if (btn.button) btn.button.setVisible(false);
                if (btn.text) btn.text.setVisible(false);
            });
        }
    }

    showInventory() {
        if (this.turnInProgress) return;

        console.log('[BattleScene] Ouverture inventaire');
        this.menuManager.hideMainMenu();
        this.scene.pause('PokemonBattleScene');
        
        this.scene.launch('InventoryScene', {
            playerId: this.playerId,
            returnScene: 'PokemonBattleScene',
            inBattle: true,
            battleState: this.battleState
        });
        this.scene.bringToTop('InventoryScene');
    }

    /**
     * Utiliser un item en combat
     */
    async useItemInBattle(item) {
        console.log('[BattleScene] Usage item:', item.itemData.name_fr);
        
        // Si c'est une Poké Ball, lancer CaptureScene
        if (item.itemData.type === 'pokeball') {
            this.hideBattleUI();
            
            // Lancer CaptureScene avec animation
            this.scene.launch('CaptureScene', {
                battleScene: this,
                ballType: item.item_id,
                wildPokemon: this.opponentPokemon,
                callback: async (result) => {
                    this.scene.stop('CaptureScene');
                    
                    if (result.captured) {
                        // Capture réussie ! Terminer le combat
                        this.menuManager.showDialog(`${this.opponentPokemon.species_name} a été capturé !`);
                        await this.wait(2000);
                        
                        // Retourner à l'overworld
                        this.cleanupBattle();
                        this.scene.stop();
                        this.scene.resume('GameScene');
                    } else {
                        // Échec : continuer le combat
                        this.menuManager.showDialog(`Oh non ! ${this.opponentPokemon.species_name} s'est échappé !`);
                        await this.wait(2000);
                        this.menuManager.hideDialog();
                        
                        // L'adversaire attaque
                        await this.turnManager.opponentTurn();
                        
                        // Revenir au menu
                        this.menuManager.hideDialog();
                    }
                }
            });
            this.scene.pause();
            
        } else {
            // Autres items (soins, status heal)
            // TODO: Sélection Pokémon cible si nécessaire
            // TODO: Appel API pour utiliser l'item
            // TODO: Animation + effets
            
            this.menuManager.showDialog(`${item.itemData.name_fr} utilisé ! (en développement)`);
            await this.wait(2000);
            this.menuManager.hideDialog();
        }
    }

    /**
     * Affiche le menu des Pokémon (TODO: implémenter)
     */
    /**
     * Affiche le menu de changement de Pokémon
     */
    showPokemonMenu() {
        if (this.turnInProgress) return;

        // 🆕 Ouvrir TeamScene avec flag inBattle - utiliser bringToTop pour z-index
        this.scene.pause('PokemonBattleScene');
        this.scene.launch('PokemonTeamScene', {
            playerId: this.playerId,
            returnScene: 'PokemonBattleScene',
            inBattle: true, // 🆕 FLAG pour afficher bouton changement
            battleState: this.battleState // Passer le state pour changement
        });
        
        // 🆕 Forcer TeamScene au premier plan
        this.scene.bringToTop('PokemonTeamScene');
    }

    /**
     * Change le Pokémon actif
     */
    async switchPokemon(newIndex) {
        this.turnInProgress = true;
        
        const newPokemon = this.battleState.playerTeam[newIndex];
        const oldPokemon = this.battleState.playerActive;
        
        console.log('[BattleScene] Switch Pokemon:', { 
            newIndex, 
            newPokemon: newPokemon?.name, 
            newPokemonId: newPokemon?._id,
            oldPokemon: oldPokemon?.name,
            playerTeamLength: this.battleState.playerTeam.length,
            playerTeam: this.battleState.playerTeam.map((p, i) => ({ index: i, name: p.name, id: p._id }))
        });
        
        // Vérifier que les Pokémon existent
        if (!newPokemon) {
            console.error('[BattleScene] Nouveau Pokémon introuvable à l\'index:', newIndex);
            this.turnInProgress = false;
            return;
        }
        
        // Obtenir les noms avec fallback
        const oldName = oldPokemon?.nickname || oldPokemon?.name || oldPokemon?.speciesData?.name_fr || 'Pokémon';
        const newName = newPokemon?.nickname || newPokemon?.name || newPokemon?.speciesData?.name_fr || 'Pokémon';
        
        this.menuManager.showDialog(`Reviens, ${oldName} !`);
        await this.wait(1000);
        
        // Animation de retrait (fade out)
        if (this.playerSprite) {
            await new Promise(resolve => {
                this.tweens.add({
                    targets: this.playerSprite,
                    alpha: 0,
                    scaleX: 3.0,
                    scaleY: 3.0,
                    duration: 500,
                    onComplete: () => {
                        if (this.playerSprite) this.playerSprite.destroy();
                        if (this.playerShadow) this.playerShadow.destroy();
                        resolve();
                    }
                });
            });
        }
        
        // ✅ Notifier le serveur du switch (met à jour player_active_index en BDD)
        try {
            // Utiliser REACT_APP_API_URL comme tous les autres fetch du projet
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
            
            const response = await fetch(`${apiUrl}/api/battle/switch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    battleId: this.battleId,
                    newIndex: newIndex
                })
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('[BattleScene] Erreur switch serveur:', error);
                this.menuManager.showDialog('Erreur lors du changement de Pokémon');
                this.turnInProgress = false;
                return;
            }

            const switchResult = await response.json();
            console.log('[BattleScene] Switch confirmé par serveur:', switchResult);

        } catch (error) {
            console.error('[BattleScene] Erreur appel /switch:', error);
            this.menuManager.showDialog('Erreur de connexion');
            this.turnInProgress = false;
            return;
        }
        
        // Mettre à jour l'état du combat
        this.battleState.playerActive = newPokemon;
        
        // ✅ Sync HP de l'ancien Pokémon
        const oldIndex = this.battleState.playerTeam.findIndex(p => p._id === oldPokemon._id);
        if (oldIndex !== -1) {
            this.battleState.playerTeam[oldIndex].currentHP = oldPokemon.currentHP;
        }
        
        // ✅ DEBUG : Vérifier que les types sont bien là
        console.log('[BattleScene] Switch - Nouveau Pokémon actif:', {
            name: newPokemon.name,
            types: newPokemon.types,
            stats: newPokemon.stats,
            currentHP: newPokemon.currentHP,
            maxHP: newPokemon.maxHP,
            index: newIndex
        });
        
        this.menuManager.showDialog(`Go, ${newName} !`);
        await this.wait(800);
        
        // Recréer sprite ET UI avec animation
        await this.recreatePlayerSpriteAndUI(newPokemon);
        
        // L'adversaire attaque
        await this.turnManager.opponentTurn();
        
        this.turnInProgress = false;
        this.menuManager.hideDialog();
    }
    
    /**
     * 🆕 Recrée le sprite et l'UI du joueur (FACTORIZED - utilise les managers)
     * Utilisé pour switch Pokémon
     */
    async recreatePlayerSpriteAndUI(pokemon) {
        // ✅ Utiliser le manager de sprites (avec animation)
        await this.spriteManager.createOrUpdatePlayerSprite(pokemon, true);
        
        // ✅ Utiliser le manager d'UI (recrée toute la box)
        await this.uiManager.updateCompletePlayerUI(pokemon);
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
     * Sélectionne et exécute un move
     */
    async selectMove(moveName) {
        if (this.turnInProgress) return;

        this.turnInProgress = true;
        console.log('[BattleScene] Move sélectionné:', moveName);

        // Cacher le sélecteur de moves
        this.menuManager.hideMoveSelector();

        try {
            // 🆕 Traduire nom du move pour le message
            const moveNameFR = await this.getMoveName(moveName);
            
            // Message d'action
            this.menuManager.showDialog(`${this.battleState.playerActive.name} utilise ${moveNameFR} !`);

            // Petite pause pour lire le message
            await this.wait(800);

            // Exécuter le tour
            const result = await this.battleManager.takeTurn(
                this.battleId,
                moveName
            );

            console.log('[BattleScene] Résultat tour COMPLET:', JSON.stringify(result, null, 2));
            console.log('[BattleScene] isOver:', result.isOver, 'winner:', result.winner);
            console.log('[BattleScene] xpGains:', result.xpGains);

            // Animer le tour
            await this.animateTurn(result);

            // Mettre à jour l'UI
            await this.updateBattleState(result);

            // Vérifier fin de combat
            if (result.isOver) {
                console.log('[BattleScene] ✅ Combat terminé! Winner:', result.winner);
                // Si victoire et XP à distribuer, afficher AVANT la fin
                if (result.winner === 'player' && result.xpGains && result.xpGains.length > 0) {
                    console.log('[BattleScene] ✅ Affichage XP:', result.xpGains.length, 'gains');
                    // Afficher gains XP
                    for (const gain of result.xpGains) {
                        const pokemon = this.battleState.playerTeam.find(p => p._id === gain.pokemonId);
                        if (pokemon) {
                            this.menuManager.showDialog(`${pokemon.name} gagne ${gain.xpGained} points d'expérience !`);
                            await this.wait(1500);
                            
                            // Animer barre XP si c'est le Pokémon actif
                            if (pokemon._id === this.battleState.playerActive._id) {
                                // Utiliser l'XP d'AVANT le gain (currentXP dans gain)
                                const oldXP = gain.currentXP || 0;
                                const oldLevel = gain.currentLevel || pokemon.level;
                                
                                const leveledUp = await this.animManager.animateXPGain(gain.xpGained, oldXP, oldLevel);
                                
                                // Si level up et nouveaux moves disponibles
                                if (leveledUp && gain.newMovesAvailable && gain.newMovesAvailable.length > 0) {
                                    this.menuManager.showDialog(`${pokemon.name} peut apprendre de nouvelles capacités !`);
                                    await this.wait(1500);
                                    // TODO: Ouvrir menu d'apprentissage de moves
                                }
                            }
                        }
                    }
                    await this.displayXPGains(result.xpGains);
                    
                    // 🆕 SAUVEGARDER l'XP en base de données
                    await this.applyXPGainsToDB(result.xpGains);
                }
                
                // Transition de retour sans message "VICTOIRE"
                await this.returnToSceneWithTransition();
            } else {
                // ✅ Vérifier si le joueur est K.O. après le tour
                if (this.battleState.playerActive.currentHP <= 0) {
                    console.log('[BattleScene] Joueur K.O. détecté, ouverture menu changement');
                    
                    // Vérifier si d'autres Pokémon disponibles
                    const alivePokemon = this.battleState.playerTeam.filter(p => p.currentHP > 0);
                    
                    if (alivePokemon.length === 0) {
                        // Défaite totale
                        this.menuManager.showDialog('Vous n\'avez plus de Pokémon ! Vous avez perdu...');
                        await this.wait(2000);
                        await this.returnToSceneWithTransition();
                    } else {
                        // ✅ Débloquer PUIS ouvrir menu
                        this.turnInProgress = false;
                        this.menuManager.showDialog('Choisissez un autre Pokémon !');
                        await this.wait(1000);
                        this.showPokemonMenu();
                    }
                    return; // ✅ Stopper l'exécution, ne pas réafficher menu principal
                }
                
                // Réafficher le menu principal seulement si le joueur est vivant
                this.menuManager.hideDialog();
                setTimeout(() => {
                    this.menuManager.showDialog(`Que va faire ${this.battleState.playerActive.name} ?`);
                }, 500);
                this.turnInProgress = false;
            }

        } catch (error) {
            console.error('[BattleScene] Erreur tour:', error);
            this.menuManager.showDialog('Une erreur est survenue !');
            setTimeout(() => {
                this.menuManager.hideDialog();
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
     * 🆕 Récupérer nom FR d'un move (avec cache)
     */
    async getMoveName(moveNameEN) {
        if (!moveNameEN) return moveNameEN;
        
        // Vérifier cache
        if (this.translationsCache[moveNameEN]) {
            return this.translationsCache[moveNameEN];
        }
        
        try {
            const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
            const response = await fetch(`${backendUrl}/api/translations/move/${moveNameEN}`);
            
            if (response.ok) {
                const data = await response.json();
                const nameFR = data.name_fr || moveNameEN;
                this.translationsCache[moveNameEN] = nameFR;
                return nameFR;
            }
        } catch (error) {
            console.error('[BattleScene] Erreur traduction move:', error);
        }
        
        return moveNameEN; // Fallback
    }

    /**
     * Anime un tour de combat avec messages
     */
    async animateTurn(result) {
        // Animation du joueur
        if (result.playerAction) {
            if (result.playerAction.missed) {
                // Attaque ratée
                const player = this.battleState.playerActive;
                const opponent = this.battleState.opponentActive;
                this.menuManager.showDialog(`${player.name} utilise ${result.playerAction.move}!`);
                await this.wait(800);
                this.menuManager.showDialog(`${player.name} rate ${opponent.name}!`);
                await this.wait(1000);
            } else {
                // Attaque réussie
                await this.animManager.animateAttack(this.playerSprite, this.opponentSprite, result.playerAction);
                if (result.playerAction.damage > 0) {
                    await this.animManager.animateHPDrain(this.opponentHPBar, this.opponentHPText, result.opponentHP, this.battleState.opponentActive.maxHP);
                    
                    // Message de dégâts
                    const effectiveness = result.playerAction.effectiveness;
                    if (effectiveness > 1) {
                        this.menuManager.showDialog("C'est super efficace !");
                        await this.wait(1000);
                    } else if (effectiveness < 1 && effectiveness > 0) {
                        this.menuManager.showDialog("Ce n'est pas très efficace...");
                        await this.wait(1000);
                    } else if (effectiveness === 0) {
                        this.menuManager.showDialog("Ça n'a aucun effet...");
                        await this.wait(1000);
                    }

                    if (result.playerAction.critical) {
                        this.menuManager.showDialog("Coup critique !");
                        await this.wait(800);
                    }
                    
                    // Vérifier KO adversaire
                    if (result.opponentHP <= 0) {
                        const opponentName = this.battleState.opponentActive.name || 'Le Pokémon adverse';
                        this.menuManager.showDialog(`${opponentName} sauvage est K.O. !`);
                        await this.wait(1200);
                        await this.animManager.animateKO(this.opponentSprite, 'opponentContainer', true);
                    }
                }
            }
        }

        // Animation de l'adversaire
        if (result.opponentAction) {
            if (result.opponentAction.missed) {
                // Attaque ratée
                const opponent = this.battleState.opponentActive;
                const player = this.battleState.playerActive;
                this.menuManager.showDialog(`${opponent.name} utilise ${result.opponentAction.move}!`);
                await this.wait(800);
                this.menuManager.showDialog(`${opponent.name} rate ${player.name}!`);
                await this.wait(1000);
            } else {
                // Attaque réussie
                const opponent = this.battleState.opponentActive;
                this.menuManager.showDialog(`${opponent.name} utilise ${result.opponentAction.move || 'une attaque'} !`);
                await this.wait(800);

                await this.animManager.animateAttack(this.opponentSprite, this.playerSprite, result.opponentAction);
                if (result.opponentAction.damage > 0) {
                    await this.animManager.animateHPDrain(this.playerHPBar, this.playerHPText, result.playerHP, this.battleState.playerActive.maxHP);
                    
                    // Message de dégâts
                    const effectiveness = result.opponentAction.effectiveness;
                    if (effectiveness > 1) {
                        this.menuManager.showDialog("C'est super efficace !");
                        await this.wait(1000);
                    } else if (effectiveness < 1 && effectiveness > 0) {
                        this.menuManager.showDialog("Ce n'est pas très efficace...");
                        await this.wait(1000);
                    }

                    if (result.opponentAction.critical) {
                        this.menuManager.showDialog("Coup critique !");
                        await this.wait(800);
                    }
                    
                    // Vérifier KO joueur
                    if (result.playerHP <= 0) {
                        await this.animManager.animateKO(this.playerSprite, 'playerContainer', false);
                    }
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
     * Animation KO stylée : le Pokémon s'enfonce dans le sol
     */
    async animateKO(sprite, containerName, isOpponent) {
        if (!sprite) return;

        const pokemonName = isOpponent ? this.battleState.opponentActive.name : this.battleState.playerActive.name;
        
        // Message KO
        this.menuManager.showDialog(`${pokemonName} est K.O. !`);
        await this.wait(800);

        // Récupérer le container et l'ombre (utiliser références stockées)
        const container = this.children.getByName(containerName);
        const shadow = isOpponent ? this.opponentShadow : this.playerShadow;

        return new Promise((resolve) => {
            // 1. Shake du sprite
            this.tweens.add({
                targets: sprite,
                x: sprite.x + 5,
                duration: 50,
                yoyo: true,
                repeat: 5,
                onComplete: () => {
                    // 2. S'enfonce dans le sol avec fade out
                    this.tweens.add({
                        targets: sprite,
                        y: sprite.y + sprite.displayHeight * 0.8,
                        alpha: 0,
                        scaleY: 0.3,
                        duration: 800,
                        ease: 'Power2.easeIn',
                        onComplete: () => {
                            if (sprite) sprite.destroy();
                            resolve();
                        }
                    });

                    // 3. Faire disparaître l'ombre en même temps (simple fade)
                    if (shadow) {
                        this.tweens.add({
                            targets: shadow,
                            alpha: 0,
                            duration: 800,
                            ease: 'Power2.easeIn',
                            onComplete: () => {
                                if (shadow) shadow.destroy();
                            }
                        });
                    }

                    // 4. Faire disparaître la box UI
                    if (container) {
                        const uiElements = isOpponent ? this.opponentUIElements : this.playerUIElements;
                        this.tweens.add({
                            targets: [container, ...(uiElements || [])],
                            alpha: 0,
                            duration: 400,
                            ease: 'Power2',
                            onComplete: () => {
                                if (container) container.destroy();
                            }
                        });
                    }
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
    /**
     * Fin du combat avec affichage XP
     */
    /**
     * Transition de retour après la fin du combat
     */
    /**
     * Calcule l'XP minimum requis pour un niveau (formule medium-slow)
     */
    calculateXPForLevel(level) {
        if (level <= 1) return 0;
        return Math.floor(1.2 * Math.pow(level, 3) - 15 * Math.pow(level, 2) + 100 * level - 140);
    }
    
    /**
     * Calcule le niveau depuis l'XP (formule medium-slow)
     * MÊME LOGIQUE que PokemonDetailScene et DatabaseManager
     */
    calculateLevelFromXP(experience) {
        if (!experience || experience < 0) return 1;
        
        for (let level = 1; level <= 100; level++) {
            const xpNeeded = this.calculateXPForLevel(level);
            if (experience < xpNeeded) {
                return level - 1;
            }
        }
        return 100;
    }

    /**
     * Anime le gain d'XP sur la barre d'XP
     */
    async animateXPGain(xp) {
        return new Promise((resolve) => {
            const barProps = this.playerXPBarProps;
            if (!barProps) {
                console.error('[BattleScene] XP bar props not found');
                resolve();
                return;
            }

            // XP actuel (AVANT le gain) et nouveau XP (APRÈS le gain)
            const oldXP = xp.currentXP; // L'XP qu'il avait AVANT le combat
            const newXP = xp.currentXP + xp.xpGained; // L'XP qu'il a MAINTENANT
            const currentLevel = xp.currentLevel;

            // Calculer les seuils d'XP pour le niveau actuel
            const currentLevelXP = this.calculateXPForLevel(currentLevel);
            const nextLevelXP = this.calculateXPForLevel(currentLevel + 1);
            const xpNeededForLevel = nextLevelXP - currentLevelXP;

            // Position de départ et d'arrivée dans la barre (relatif au niveau actuel)
            const oldXPInLevel = oldXP - currentLevelXP;
            const newXPInLevel = newXP - currentLevelXP;

            // Pourcentages
            const oldPercent = Math.max(0, Math.min(100, (oldXPInLevel / xpNeededForLevel) * 100));
            const newPercent = Math.max(0, Math.min(100, (newXPInLevel / xpNeededForLevel) * 100));

            const maxBarWidth = barProps.width - 2;
            const startWidth = maxBarWidth * oldPercent / 100; // Partir de l'XP actuel
            const targetWidth = maxBarWidth * newPercent / 100;

            console.log(`[XP Animation] ${oldXP} -> ${newXP} XP | Niveau ${currentLevel}: ${oldXPInLevel}/${xpNeededForLevel} -> ${newXPInLevel}/${xpNeededForLevel} | Barre: ${oldPercent.toFixed(1)}% -> ${newPercent.toFixed(1)}%`);

            // S'assurer que la barre est visible avant l'animation
            this.playerXPBar.setAlpha(1);

            // Animer la progression
            this.tweens.addCounter({
                from: startWidth,
                to: targetWidth,
                duration: 1500,
                ease: 'Linear',
                onUpdate: (tween) => {
                    const currentWidth = tween.getValue();
                    
                    // Redessiner la barre
                    this.playerXPBar.clear();
                    
                    if (currentWidth > 0) {
                        this.playerXPBar.fillGradientStyle(0x3498DB, 0x3498DB, 0x2980B9, 0x2980B9, 1, 1, 1, 1);
                        this.playerXPBar.fillRoundedRect(
                            barProps.x + 1,
                            barProps.y - barProps.height/2 + 1,
                            currentWidth,
                            barProps.height - 2,
                            3
                        );
                    }
                },
                onComplete: () => {
                    // Mise à jour finale
                    this.playerXPBar.clear();
                    if (targetWidth > 0) {
                        this.playerXPBar.fillGradientStyle(0x3498DB, 0x3498DB, 0x2980B9, 0x2980B9, 1, 1, 1, 1);
                        this.playerXPBar.fillRoundedRect(
                            barProps.x + 1,
                            barProps.y - barProps.height/2 + 1,
                            targetWidth,
                            barProps.height - 2,
                            3
                        );
                    }
                    resolve();
                }
            });
        });
    }

    /**
     * Affiche les gains XP avec animations
     */
    async displayXPGains(xpGains) {
        const { width, height } = this.scale;

        for (const xp of xpGains) {
            // Vérifier si c'est le Pokémon actif (pour animer sa barre XP)
            const isActivePokemon = this.battleState.playerActive._id.toString() === xp.pokemonId.toString();

            // Message de base
            let message = `${xp.pokemonName} gagne ${xp.xpGained} points d'XP !`;
            
            // Bonus affichés
            const bonuses = [];
            if (xp.isTraded) bonuses.push('Échangé ×1.5');
            if (xp.hasLuckyEgg) bonuses.push('Lucky Egg ×1.5');
            if (bonuses.length > 0) {
                message += `\n(${bonuses.join(', ')})`;
            }

            this.menuManager.showDialog(message);

            // Animer la barre XP si c'est le Pokémon actif
            if (isActivePokemon && this.playerXPBar) {
                await this.animManager.animateXPGain(xp);
            } else {
                await this.wait(1500);
            }

            // Si level up
            if (xp.leveledUp) {
                this.menuManager.showDialog(`${xp.pokemonName} monte au niveau ${xp.newLevel} !`);
                
                // Son/effet montée niveau (optionnel)
                this.tweens.add({
                    targets: this.playerSprite,
                    scaleX: 3.2,
                    scaleY: 3.2,
                    duration: 200,
                    yoyo: true,
                    repeat: 2
                });

                await this.wait(2000);

                // 📚 Si nouveaux moves disponibles, lancer scène d'apprentissage
                if (xp.newMovesAvailable && xp.newMovesAvailable.length > 0) {
                    for (const newMove of xp.newMovesAvailable) {
                        await this.promptLearnMove(xp, newMove);
                    }
                }
            }
        }

        this.menuManager.hideDialog();
        await this.wait(500);
    }

    /**
     * Lancer la scène d'apprentissage d'un move
     */
    async promptLearnMove(pokemonXP, newMove) {
        return new Promise((resolve) => {
            // Récupérer le Pokémon complet depuis battleState
            const pokemon = this.battleState.playerTeam.find(p => 
                p._id && p._id.toString() === pokemonXP.pokemonId.toString()
            );

            if (!pokemon) {
                console.error('[MoveLearn] Pokémon introuvable dans battleState');
                resolve();
                return;
            }

            console.log(`[MoveLearn] Lancement apprentissage: ${newMove.name} pour ${pokemon.nickname || pokemon.species_name}`);

            this.scene.launch('MoveLearnScene', {
                pokemon: pokemon,
                newMove: newMove,
                onComplete: (learned, moveName) => {
                    if (learned) {
                        this.menuManager.showDialog(`${pokemon.nickname || pokemon.species_name} a appris ${moveName} !`);
                    } else {
                        this.menuManager.showDialog(`${pokemon.nickname || pokemon.species_name} n'a pas appris ${newMove.name}.`);
                    }
                    setTimeout(() => {
                        this.menuManager.hideDialog();
                        resolve();
                    }, 1500);
                }
            });
        });
    }

    /**
     * Fuit le combat
     */
    async flee() {
        if (this.battleType !== 'wild') {
            this.menuManager.showDialog("Impossible de fuir un combat de dresseur !");
            setTimeout(() => this.menuManager.hideDialog(), 2000);
            return;
        }

        console.log('[BattleScene] Fuite du combat (PAS de sauvegarde HP)');
        this.menuManager.showDialog("Vous avez pris la fuite !");
        
        await this.wait(1500);
        
        // 🔧 FIXE: NE PAS sauvegarder les changements (garde HP actuels)
        // Retourner directement sans appeler saveBattleChanges()
        this.returnToScene();
    }

    /**
     * Retourne à la scène précédente
     */
    /**
     * Transition de retour après la fin du combat
     */
    async returnToSceneWithTransition() {
        const { width, height } = this.scale;
        
        // ✅ IMPORTANT: Sauvegarder les changements de HP/XP avant de quitter
        await this.saveBattleChanges();
        
        // Petite pause
        await this.wait(1000);
        
        // Fade out progressif
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0).setOrigin(0);
        overlay.setDepth(1000);
        
        await new Promise(resolve => {
            this.tweens.add({
                targets: overlay,
                alpha: 1,
                duration: 800,
                ease: 'Power2',
                onComplete: () => {
                    // Nettoyer les ressources avant de changer de scène
                    this.cleanupBattle();
                    resolve();
                }
            });
        });
        
        // Retourner à la scène précédente
        this.returnToScene();
    }

    /**
     * 🆕 Sauvegarde les changements HP/XP/status du combat
     */
    /**
     * 🆕 Applique les gains d'XP au battleState avant sauvegarde
     */
    async applyXPGainsToDB(xpGains) {
        console.log('[BattleScene] Application des gains XP:', xpGains);
        
        for (const gain of xpGains) {
            const pokemon = this.battleState.playerTeam.find(
                p => p._id.toString() === gain.pokemonId.toString()
            );
            
            if (pokemon) {
                console.log(`[BattleScene] Update ${pokemon.name}: Level ${pokemon.level} → ${gain.newLevel}, XP ${pokemon.experience} → ${gain.currentXP + gain.xpGained}`);
                
                // Mettre à jour les valeurs dans battleState
                pokemon.experience = (gain.currentXP || 0) + gain.xpGained;
                pokemon.level = gain.newLevel || pokemon.level;
                
                // Si level up, mettre à jour les stats (optionnel, le serveur le fait déjà)
                if (gain.leveledUp) {
                    console.log(`[BattleScene] ${pokemon.name} a monté de niveau ! Nouveau niveau: ${pokemon.level}`);
                }
            } else {
                console.warn(`[BattleScene] Pokémon ${gain.pokemonId} non trouvé dans playerTeam`);
            }
        }
    }

    async saveBattleChanges() {
        if (!this.battleState || !this.battleState.playerTeam) {
            console.warn('[BattleScene] Pas de battleState à sauvegarder');
            return;
        }

        try {
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
            
            // Préparer les données du team avec les changements
            const teamUpdates = this.battleState.playerTeam.map(pokemon => ({
                _id: pokemon._id,
                currentHP: Math.max(0, pokemon.currentHP || 0),
                experience: pokemon.experience || 0,
                level: pokemon.level || 1
            }));

            const response = await fetch(`${apiUrl}/api/battle/save-changes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    playerId: this.playerId,
                    battleId: this.battleId,
                    teamUpdates: teamUpdates
                })
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('[BattleScene] Erreur sauvegarde:', error);
                return;
            }

            console.log('[BattleScene] Changements sauvegardés avec succès');
        } catch (error) {
            console.error('[BattleScene] Erreur appel /save-changes:', error);
        }
    }

    /**
     * Nettoie les ressources du combat
     */
    cleanupBattle() {
        console.log('[BattleScene] Nettoyage des ressources');
        
        // Arrêter tous les tweens
        this.tweens.killAll();
        
        // Réinitialiser les états
        this.turnInProgress = false;
        
        // Nettoyer les boutons de compétences (évite bug deuxième combat)
        if (this.moveButtons && this.moveButtons.length > 0) {
            this.moveButtons.forEach(btn => {
                if (btn) btn.destroy(); // Container destruction
            });
        }
        
        // Nettoyer les boutons d'action
        if (this.actionButtons && this.actionButtons.length > 0) {
            this.actionButtons.forEach(btn => {
                if (btn) btn.destroy(); // Container destruction
            });
        }
        
        // Nettoyer le bouton retour
        if (this.backButton) {
            this.backButton.destroy();
            this.backButton = null;
        }
        
        // Nettoyer les références
        this.playerSprite = null;
        this.opponentSprite = null;
        this.playerHPBar = null;
        this.opponentHPBar = null;
        this.playerXPBar = null;
        this.moveButtons = [];
        this.actionButtons = [];
        this.battleLogTexts = [];
        this.moveSelectorCreated = false; // 🆕 Reset flag pour recréer buttons
        this.battleState = null; // ⚠️ Crucial pour éviter XP aux mauvais Pokemon
        this.battleId = null;
        
        // 🆕 CLEANUP GIF: Retirer tous les containers DOM GIF
        if (this.gifContainers?.length > 0) {
            console.log(`[BattleScene] Nettoyage de ${this.gifContainers.length} GIF containers`);
            const SpriteLoader = require('./utils/spriteLoader').default;
            this.gifContainers.forEach(container => {
                try {
                    SpriteLoader.removeAnimatedGif(container);
                } catch (error) {
                    console.error('[BattleScene] Erreur suppression GIF container:', error);
                }
            });
            this.gifContainers = [];
        }
        
        // 🔧 FIXE: Nettoyer les pourcentages HP pour le prochain combat
        this.currentPlayerHPPercent = undefined;
        this.currentOpponentHPPercent = undefined;
        
        console.log('[BattleScene] ✅ Ressources nettoyées (HP percentages + GIF containers réinitialisés)');
    }

    returnToScene() {
        console.log('[BattleScene] Retour à:', this.returnScene);
        // 🆕 Nettoyer les ressources (GIFs, tweens, etc.)
        this.cleanupBattle();
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
