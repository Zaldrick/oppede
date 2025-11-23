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
import getPokemonDisplayName from './utils/getDisplayName';
import SoundManager from './utils/SoundManager';

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
        
        // 🔧 FIXE: Reset des états d'animation HP pour éviter le glitch visuel
        this.currentPlayerHPPercent = undefined;
        this.currentOpponentHPPercent = undefined;
        
        // 🔧 FIXE: Reset du flag de tour pour éviter le blocage au combat suivant
        this.turnInProgress = false;
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
        // Préparer et jouer la musique de combat AVANT la transition pour qu'elle démarre au plus tôt
        try {
            this.soundManager = new SoundManager(this);
            // Ensure any legacy/directly-played background music tracks are stopped to avoid overlapping
            try {
                if (this.sound && Array.isArray(this.sound.sounds)) {
                    this.sound.sounds.forEach(s => {
                        try {
                            const key = s && s.key ? String(s.key) : '';
                            if (key.startsWith('music_') || ['mainMenuMusic', 'music1', 'gameMusic', 'mainMenuMusic'].includes(key)) {
                                try { s.stop(); s.destroy(); } catch (e) {}
                            }
                        } catch (e) {}
                    });
                }
            } catch (e) { /* ignore */ }
            try { MusicManager.pause(); } catch (e) { /* ignore */ }
            const musicTrack = this.battleType === 'trainer' ? 'battle-trainer' : 'battle-wild';
            // Kick off the music (no await) to avoid blocking the animation
            this.soundManager.playMusic(musicTrack, { volume: 0.3, loop: true }).catch(() => {});
        } catch (e) {
            // If SoundManager construction fails, ignore to avoid blocking the transition
            console.warn('[BattleScene] SoundManager not initialized before transition', e);
        }

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
            
            // S'assurer que les GIFs sont visibles (au cas où)
            const SpriteLoader = require('./utils/spriteLoader').default;
            SpriteLoader.showAllGifs(this);
            
            // Réafficher le menu principal si on revient d'un sous-menu
            if (this.mainMenuBg) this.mainMenuBg.setVisible(true);
            if (this.mainMenuButtons) {
                this.mainMenuButtons.forEach(btn => btn.setVisible(true));
            }
        });
        
        // 🆕 Écouter l'événement pause (ne plus masquer les GIFs pour les garder en background)
        this.events.on('pause', () => {
            console.log('[BattleScene] Scene paused - GIFs maintenus visibles');
            // const SpriteLoader = require('./utils/spriteLoader').default;
            // SpriteLoader.hideAllGifs(this);
        });

        // 🆕 Écouter l'événement shutdown pour nettoyer les GIFs
        this.events.on('shutdown', () => {
            console.log('[BattleScene] Scene shutdown - Nettoyage complet');
            this.cleanupBattle();
            try { if (typeof window !== 'undefined' && window.debugPlayCryBattle) delete window.debugPlayCryBattle; } catch (e) {}
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
                name: getPokemonDisplayName(this.battleState.playerActive),
                level: this.battleState.playerActive.level,
                experience: this.battleState.playerActive.experience,
                currentHP: this.battleState.playerActive.currentHP,
                maxHP: this.battleState.playerActive.maxHP
            });

            // Récupérer le spiral créé dans playEntryTransition
            const spiral = this.children.getByName('spiral');

            // Sound manager (lazy-loads audio assets for moves)
            // Note: already instantiated before the entry transition to start music early
            try { if (typeof window !== 'undefined' && this.soundManager) { window.debugPlayCryBattle = async (id) => { try { console.log('[BattleScene] debugPlayCryBattle', id); const r = await this.soundManager.playPokemonCry(id); console.log('[BattleScene] debugPlayCryBattle result', r); } catch (e) { console.warn('[BattleScene] debugPlayCryBattle error', e); } } } } catch (e) {}

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
        graphics.fillRect(0, 0, width, height * 0.25);
        
        // Transition horizon
        graphics.fillGradientStyle(0xB0E0E6, 0xB0E0E6, 0xF5DEB3, 0xF5DEB3, 1, 1, 1, 1);
        graphics.fillRect(0, height * 0.25, width, height * 0.08);
        
        // Sol (beige/sable avec dégradé)
        graphics.fillGradientStyle(0xF5DEB3, 0xF5DEB3, 0xDAA520, 0xDAA520, 1, 1, 1, 1);
        graphics.fillRect(0, height * 0.33, width, height * 0.67);
        
        // Ligne d'horizon brillante
        graphics.lineStyle(2, 0xFFFFFF, 0.4);
        graphics.lineBetween(0, height * 0.25, width, height * 0.25);
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
        
        // Calculer le level depuis l'XP si manquant ou en désaccord avec l'XP envoyé
        const calculatedLevel = this.calculateLevelFromXP(player.experience || 0);
        if (!player.level || player.level !== calculatedLevel) {
            console.warn(`[BattleScene] Level mismatch detected (sent: ${player.level}) → recalculé: ${calculatedLevel}`);
            player.level = calculatedLevel;
        }
        
        console.log('[BattleScene] Player data:', {
            name: getPokemonDisplayName(player),
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
            fontWeight: 'bold',
            fontFamily: 'Arial'
        }).setOrigin(0.5).setAlpha(0).setDepth(3); // Caché au début
        
        // Texte niveau - police agrandie (avec fallback si level manquant)
        const displayLevel = player.level || 1;
        const levelText = this.add.text(levelBadgeX, levelBadgeY, displayLevel, {
            fontSize: `${Math.min(width, height) * 0.038}px`,
            fill: '#FFFFFF',
            fontWeight: 'bold',
            fontFamily: 'Arial'
        }).setOrigin(0.5).setAlpha(0).setDepth(3); // Caché au début

        // Nom du Pokémon avec ombre
        const nameText = this.add.text(boxX + boxWidth * 0.06, boxY + boxHeight * 0.25, getPokemonDisplayName(player).toUpperCase(), {
            fontSize: `${Math.min(width, height) * 0.028}px`,
            fill: '#2C3E50',
            fontWeight: 'bold',
            fontFamily: 'Arial',
            stroke: '#FFFFFF',
            strokeThickness: 1
        }).setOrigin(0, 0.5).setAlpha(0).setDepth(3); // Caché au début

        // Label "PS:" avec icône cœur - agrandi
        const psLabel = this.add.text(boxX + boxWidth * 0.06, boxY + boxHeight * 0.60, '♥', {
            fontSize: `${Math.min(width, height) * 0.038}px`,
            fill: '#E74C3C',
            fontWeight: 'bold',
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

        // 🔧 FIXE: Sécuriser maxHP (utiliser stats calculées)
        const maxHP = player.stats ? player.stats.maxHP : 1;
        
        // Barre HP (couleur avec dégradé)
        const hpPercent = (player.currentHP / maxHP) * 100;
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
        this.playerHPBarProps = { x: hpBarX, y: hpBarY, width: hpBarWidth, height: hpBarHeight, maxHP: maxHP };

        // Texte HP numérique avec style - agrandi
        this.playerHPText = this.add.text(boxX + boxWidth * 0.74, boxY + boxHeight * 0.60, `${player.currentHP}/${maxHP}`, {
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
     * Crée un bouton de move stylé
     */
    async createMoveButton(move, x, y, width, height) {
        const container = this.add.container(x, y);
        
        // Type info
        const typeColor = this.getTypeColor(move.type);
        
        // Ombre
        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.2);
        shadow.fillRoundedRect(4, 4, width, height, 8);
        container.add(shadow);
        
        // Fond
        const bg = this.add.graphics();
        bg.fillStyle(0xFFFFFF, 1);
        bg.fillRoundedRect(0, 0, width, height, 8);
        bg.lineStyle(2, typeColor, 1);
        bg.strokeRoundedRect(0, 0, width, height, 8);
        container.add(bg);
        
        // Bande de couleur du type (gauche)
        const typeStrip = this.add.graphics();
        typeStrip.fillStyle(typeColor, 1);
        typeStrip.fillRoundedRect(0, 0, width * 0.15, height, { tl: 8, bl: 8, tr: 0, br: 0 });
        container.add(typeStrip);
        
        // Nom du move (traduit)
        const moveNameFR = await this.getMoveName(move.name);
        const nameText = this.add.text(width * 0.2, height * 0.2, moveNameFR.toUpperCase(), {
            fontSize: `${Math.min(this.cameras.main.width, this.cameras.main.height) * 0.025}px`,
            fill: '#2C3E50',
            fontStyle: 'bold',
            fontFamily: 'Arial'
        }).setOrigin(0, 0.5);
        container.add(nameText);
        
        // PP
        const ppText = this.add.text(width * 0.95, height * 0.8, `PP ${move.pp}/${move.maxPP}`, {
            fontSize: `${Math.min(this.cameras.main.width, this.cameras.main.height) * 0.020}px`,
            fill: '#7F8C8D',
            fontFamily: 'Arial'
        }).setOrigin(1, 0.5);
        container.add(ppText);
        
        // Type icône/texte
        const typeText = this.add.text(width * 0.075, height * 0.5, move.type.substring(0, 3).toUpperCase(), {
            fontSize: `${Math.min(this.cameras.main.width, this.cameras.main.height) * 0.018}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold',
            fontFamily: 'Arial'
        }).setOrigin(0.5).setRotation(-Math.PI / 2);
        container.add(typeText);
        
        // Interactivité
        bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        
        bg.on('pointerover', () => {
            this.tweens.add({ targets: container, scaleX: 1.02, scaleY: 1.02, duration: 100 });
        });
        
        bg.on('pointerout', () => {
            this.tweens.add({ targets: container, scaleX: 1.0, scaleY: 1.0, duration: 100 });
        });
        
        bg.on('pointerdown', () => {
            if (!this.turnInProgress) {
                this.tweens.add({
                    targets: container,
                    alpha: 0.7,
                    duration: 50,
                    yoyo: true,
                    onComplete: () => this.performMove(move)
                });
            }
        });
        
        return container;
    }

    /**
     * Retourne la couleur associée au type
     */
    getTypeColor(type) {
        const colors = {
            normal: 0xA8A77A,
            fire: 0xEE8130,
            water: 0x6390F0,
            electric: 0xF7D02C,
            grass: 0x7AC74C,
            ice: 0x96D9D6,
            fighting: 0xC22E28,
            poison: 0xA33EA1,
            ground: 0xE2BF65,
            flying: 0xA98FF3,
            psychic: 0xF95587,
            bug: 0xA6B91A,
            rock: 0xB6A136,
            ghost: 0x735797,
            dragon: 0x6F35FC,
            dark: 0x705746,
            steel: 0xB7B7CE,
            fairy: 0xD685AD
        };
        return colors[type.toLowerCase()] || 0x777777;
    }

    /**
     * Affiche le menu du sac
     */
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
     * Masque toute l'interface de combat
     */
    hideBattleUI() {
        console.log('[BattleScene] Masquage UI combat');
        
        // Masquer le menu principal
        if (this.menuManager) {
            this.menuManager.hideMainMenu();
        }

        // Masquer UI Joueur
        const playerContainer = this.children.getByName('playerContainer');
        if (playerContainer) playerContainer.setVisible(false);
        if (this.playerUIElements) {
            this.playerUIElements.forEach(el => {
                if (el) el.setVisible(false);
            });
        }

        // Masquer UI Adversaire
        const opponentContainer = this.children.getByName('opponentContainer');
        if (opponentContainer) opponentContainer.setVisible(false);
        if (this.opponentUIElements) {
            this.opponentUIElements.forEach(el => {
                if (el) el.setVisible(false);
            });
        }
    }

    /**
     * Tente de fuir le combat
     */
    async flee() {
        if (this.turnInProgress) return;
        
        if (this.battleType === 'trainer') {
            this.menuManager.showDialog("On ne peut pas fuir un combat de dresseur !");
            await this.wait(2000);
            this.menuManager.hideDialog();
            return;
        }

        this.menuManager.showDialog("Vous prenez la fuite !");
        
        // 🔧 FIXE: Sauvegarder l'état de fuite en BDD (HP perdus)
        try {
            await this.battleManager.flee(this.battleId, this.playerId);
        } catch (e) {
            console.error('[BattleScene] Erreur sauvegarde fuite:', e);
        }

        await this.wait(1000);
        
        // Animation de fuite (fondu)
        await this.returnToSceneWithTransition();
    }

    /**
     * Change de Pokémon (appelé depuis PokemonDetailScene)
     */
    switchPokemon(newIndex) {
        if (this.turnManager) {
            this.turnManager.switchPokemon(newIndex);
        } else {
            console.error('[BattleScene] TurnManager non initialisé');
        }
    }

    /**
     * Exécute un move choisi par le joueur
     */
    async performMove(move) {
        if (this.turnInProgress) return;
        
        // ✅ Utiliser le BattleTurnManager pour gérer le tour (incluant évolutions)
        if (this.turnManager) {
            await this.turnManager.selectMove(move.name);
        } else {
            console.error('[BattleScene] TurnManager non initialisé !');
            this.turnInProgress = false;
        }
    }

    /**
     * Gère la fin du combat
     */
    async handleBattleEnd(result) {
        if (result.winner === 'player') {
            this.menuManager.showDialog("Vous avez gagné !");
            await this.wait(2000);
            
            // Afficher gains XP
            if (result.xpGains && result.xpGains.length > 0) {
                await this.displayXPGains(result.xpGains);
            }
            
            // Sauvegarder XP (si pas fait par backend)
            // await this.applyXPGainsToDB(result.xpGains);
            
            // Play victory music if available
            try {
                await this.soundManager.playMusic('victory-wild', { volume: 0.4, loop: false });
            } catch (e) { /* ignore */ }

            this.cleanupBattle();
            this.returnToSceneWithTransition();
            
        } else {
            this.menuManager.showDialog("Vous avez perdu...");
            await this.wait(2000);
            this.menuManager.showDialog("Vous vous enfuyez vers le centre Pokémon...");
            await this.wait(2000);
            
            this.cleanupBattle();
            this.scene.stop('PokemonBattleScene');
            this.scene.start('GameScene', { respawn: true }); // Respawn au centre
        }
    }

    /**
     * Utiliser un item en combat
     */
    async useItemInBattle(item) {
        console.log('[BattleScene] Usage item:', item.itemData.name_fr);
        
        // Si c'est une Poké Ball, lancer CaptureScene
        if (item.itemData.type === 'pokeball') {
            this.hideBattleUI();
            
            // Masquer le sprite adverse pour éviter le doublon avec CaptureScene
            if (this.opponentSprite) this.opponentSprite.setVisible(false);
            // Masquer le GIF si présent
            const SpriteLoader = require('./utils/spriteLoader').default;
            if (this.opponentGifContainer) {
                this.opponentGifContainer.style.opacity = '0';
            }
            
            // Lancer CaptureScene avec animation
            this.scene.launch('CaptureScene', {
                battleScene: this,
                ballName: item.itemData.name_fr, // 🆕 Passer le nom exact pour mapper la texture
                wildPokemon: this.battleState.opponentActive,
                useAnimatedSprites: this.useAnimatedSprites, // 🆕 Passer la préférence
                // Passer les coordonnées exactes pour une transition fluide
                startPosition: {
                    x: this.opponentSprite ? this.opponentSprite.x : this.cameras.main.width * 0.68, // Match BattleSpriteManager
                    y: this.opponentSprite ? this.opponentSprite.y : this.cameras.main.height * 0.26 // Match BattleSpriteManager
                },
                callback: async (result) => {
                    this.scene.stop('CaptureScene');
                    this.scene.resume(); // ✅ Reprendre la scène de combat pour réactiver les tweens/animations
                    
                    if (result.captured) {
                        // Capture réussie ! Terminer le combat
                        this.menuManager.showDialog(`${getPokemonDisplayName(this.battleState.opponentActive)} a été capturé !`);
                        await this.wait(2000);
                        
                        // Retourner à l'overworld
                        this.cleanupBattle();
                        this.scene.stop();
                        this.scene.resume('GameScene');
                    } else {
                        // Échec : réafficher le sprite et l'UI
                        if (this.opponentSprite) this.opponentSprite.setVisible(true);
                        if (this.opponentGifContainer) {
                            this.opponentGifContainer.style.opacity = '1';
                        }
                        
                        // ✅ Utiliser this.showBattleUI() qui est une méthode de PokemonBattleScene
                        // (this réfère bien à l'instance car c'est une arrow function)
                        if (typeof this.showBattleUI === 'function') {
                            this.showBattleUI();
                        } else {
                            console.error('[BattleScene] showBattleUI manquant, tentative de restauration UI manuelle');
                            if (this.menuManager) this.menuManager.showMainMenu();
                        }
                        
                        this.menuManager.showDialog(`Oh non ! ${getPokemonDisplayName(this.battleState.opponentActive)} s'est échappé !`);
                        await this.wait(2000);
                        this.menuManager.hideDialog();
                        
                        // L'adversaire attaque
                        await this.turnManager.opponentTurn();
                        
                        // Revenir au menu
                        this.menuManager.hideDialog();
                        this.menuManager.showMainMenu();
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
     * Met à jour l'interface du joueur après une évolution
     * @param {Object} newPokemonData - Données mises à jour du Pokémon
     */
    async updatePlayerUI(newPokemonData) {
        console.log('[BattleScene] Mise à jour UI après évolution:', newPokemonData);
        
        if (!newPokemonData) return;

        // 1. Mettre à jour l'état du combat
        const player = this.battleState.playerActive;
        
        // Mettre à jour les propriétés clés
        player.species_id = newPokemonData.species_id;
        player.species_name = newPokemonData.species_name;
        player.name = newPokemonData.nickname || newPokemonData.species_name_fr || newPokemonData.species_name; // Surnom ou nom d'espèce (prefer FR)
        // 🔧 FIXE: Sécuriser maxHP (utiliser stats calculées)
        if (newPokemonData.stats) {
            if (!player.stats) player.stats = {};
            player.stats.maxHP = newPokemonData.stats.maxHP;
        }
        // currentHP est conservé ou mis à jour si fourni
        if (newPokemonData.currentHP) player.currentHP = newPokemonData.currentHP;
        
        // Si speciesData est présent, le mettre à jour (important pour les types)
        // Note: Idéalement on devrait refetch les speciesData complètes, mais pour l'instant on fait avec
            if (player.speciesData) {
            player.speciesData.name = newPokemonData.species_name;
            // Si le backend renvoie le nom FR, le conserver
            if (newPokemonData.species_name_fr) {
                player.speciesData.name_fr = newPokemonData.species_name_fr;
            }
            // TODO: Mettre à jour les types et stats de base si possible
        }

        // 2. Mettre à jour le sprite
        // Supprimer l'ancien sprite
        if (this.playerSprite) {
            this.playerSprite.destroy();
        }
        
        // Nettoyer le GIF si existant
        const SpriteLoader = require('./utils/spriteLoader').default;
        if (this.playerGifContainer) {
            this.playerGifContainer.remove();
            this.playerGifContainer = null;
        }
        
        // Créer le nouveau sprite
        await this.spriteManager.createPlayerSprite(this.cameras.main.width, this.cameras.main.height);
        
        // 3. Mettre à jour la boîte d'info
        // Le plus simple est de détruire et recréer les éléments textuels
        // Mais on peut aussi juste mettre à jour le texte
        
        // Mise à jour du nom
        const nameText = this.playerUIElements[2]; // Index 2 = nameText dans createPlayerUI
        if (nameText) {
            nameText.setText(getPokemonDisplayName(player).toUpperCase());
        }
        
        // Mise à jour HP
        const maxHP = player.stats ? player.stats.maxHP : 1;
        const hpText = this.playerHPText;
        if (hpText) {
            hpText.setText(`${player.currentHP}/${maxHP}`);
        }
        
        // Mise à jour barre HP (recalculer largeur)
        if (this.playerHPBarProps) {
            this.playerHPBarProps.maxHP = maxHP;
            // Redessiner la barre
            const hpPercent = (player.currentHP / maxHP) * 100;
            const { x, y, width, height } = this.playerHPBarProps;
            
            let hpColor1, hpColor2;
            if (hpPercent > 50) { hpColor1 = 0x2ECC71; hpColor2 = 0x27AE60; }
            else if (hpPercent > 25) { hpColor1 = 0xF39C12; hpColor2 = 0xE67E22; }
            else { hpColor1 = 0xE74C3C; hpColor2 = 0xC0392B; }
            
            this.playerHPBar.clear();
            this.playerHPBar.fillGradientStyle(hpColor1, hpColor1, hpColor2, hpColor2, 1, 1, 1, 1);
            this.playerHPBar.fillRoundedRect(
                x + 2,
                y - height/2 + 2,
                (width - 4) * hpPercent / 100,
                height - 4,
                4
            );
        }
        
        // 4. Mettre à jour les attaques (si nouvelles attaques apprises)
        // Pour l'instant on garde les mêmes, mais on pourrait recharger le moveset
        // this.showMoveSelector(); // Si le menu était ouvert
        
        console.log('[BattleScene] UI mise à jour avec succès');
    }
    
    /**
     * Retour à la scène précédente
     */
    returnToScene() {
        this.cleanupBattle();
        this.scene.stop('PokemonBattleScene');
        
        // 🆕 Vérifier si la scène de retour est active ou en pause
        const returnSceneKey = this.returnScene || 'GameScene';
        const returnScene = this.scene.get(returnSceneKey);
        
        if (returnScene) {
            // Si la scène est en pause (ce qui devrait être le cas), on la reprend
            if (returnScene.sys.settings.status === Phaser.Scenes.SLEEPING || 
                returnScene.sys.settings.status === Phaser.Scenes.PAUSED) {
                console.log(`[BattleScene] Reprise de la scène ${returnSceneKey}`);
                this.scene.resume(returnSceneKey);
            } else {
                // Sinon on la démarre
                console.log(`[BattleScene] Démarrage de la scène ${returnSceneKey}`);
                this.scene.start(returnSceneKey);
            }
        } else {
            console.warn(`[BattleScene] Scène de retour ${returnSceneKey} introuvable, retour GameScene`);
            this.scene.start('GameScene');
        }
    }

    /**
     * Transition de retour
     */
    async returnToSceneWithTransition() {
        // 🔧 FIXE: Vérification de sécurité pour éviter le crash "reading 'width'"
        if (!this.cameras || !this.cameras.main) {
            console.warn('[BattleScene] Caméra introuvable, retour immédiat');
            this.returnToScene();
            return;
        }

        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Fondu au noir
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0).setOrigin(0);
        overlay.setDepth(10000);
        
        await new Promise(resolve => {
            this.tweens.add({
                targets: overlay,
                alpha: 1,
                duration: 500,
                onComplete: resolve
            });
        });
        
        this.returnToScene();
    }

    /**
     * Calcule l'XP minimum requis pour un niveau (formule medium-slow)
     */
    calculateXPForLevel(level) {
        if (level <= 1) return 0;
        return Math.floor(1.2 * Math.pow(level, 3) - 15 * Math.pow(level, 2) + 100 * level - 140);
    }
    
    /**
     * Calcule le niveau depuis l'XP (formule medium-slow)
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
     * 🆕 Récupérer nom FR d'un move (avec cache)
     */
    async getMoveName(moveNameEN) {
        if (!moveNameEN) return moveNameEN;
        
        // Vérifier cache
        if (this.translationsCache[moveNameEN]) {
            return this.translationsCache[moveNameEN];
        }
        
        try {
            const backendUrl = process.env.REACT_APP_API_URL;
            if (!backendUrl) {
                // Silencieux ici car c'est juste pour la traduction
                return moveNameEN;
            }
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
                        this.menuManager.showDialog(`${getPokemonDisplayName(this.battleState.playerActive)} utilise ${result.playerAction.move}!`);
                await this.wait(800);
                this.menuManager.showDialog(`${getPokemonDisplayName(this.battleState.playerActive)} rate son attaque!`);
                await this.wait(1000);
            } else {
                await this.animManager.animateAttack(this.playerSprite, this.opponentSprite, result.playerAction);
                if (result.playerAction.damage > 0) {
                    // 🔧 FIXE: Sécuriser maxHP
                    const opponentMaxHP = this.battleState.opponentActive.stats ? this.battleState.opponentActive.stats.maxHP : 1;
                    await this.animManager.animateHPDrain(this.opponentHPBar, this.opponentHPText, result.opponentHP, opponentMaxHP);
                    
                    // Messages d'efficacité
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
                        const opponentName = getPokemonDisplayName(this.battleState.opponentActive) || 'Le Pokémon adverse';
                        this.menuManager.showDialog(`${opponentName} est K.O. !`);
                        await this.wait(1200);
                        await this.animManager.animateKO(this.opponentSprite, 'opponentContainer', true);
                    }
                }
            }
        }

        // Animation de l'adversaire
        if (result.opponentAction) {
            if (result.opponentAction.missed) {
                this.menuManager.showDialog(`${getPokemonDisplayName(this.battleState.opponentActive)} utilise ${result.opponentAction.move}!`);
                await this.wait(800);
                this.menuManager.showDialog(`${getPokemonDisplayName(this.battleState.opponentActive)} rate son attaque!`);
                await this.wait(1000);
            } else {
                this.menuManager.showDialog(`${getPokemonDisplayName(this.battleState.opponentActive)} utilise ${result.opponentAction.move || 'une attaque'} !`);
                await this.wait(800);

                await this.animManager.animateAttack(this.opponentSprite, this.playerSprite, result.opponentAction);
                if (result.opponentAction.damage > 0) {
                    // 🔧 FIXE: Sécuriser maxHP
                    const playerMaxHP = this.battleState.playerActive.stats ? this.battleState.playerActive.stats.maxHP : 1;
                    await this.animManager.animateHPDrain(this.playerHPBar, this.playerHPText, result.playerHP, playerMaxHP);
                    
                    // Messages d'efficacité
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
     * Affiche les gains XP avec animations
     */
    async displayXPGains(xpGains) {
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
        }
    }

    /**
     * Sauvegarde les gains XP en BDD (Stub pour éviter crash)
     */
    async applyXPGainsToDB(xpGains) {
        // Le backend gère déjà la sauvegarde, mais on peut ajouter une synchro locale si besoin
        console.log('[BattleScene] XP sauvegardé par le backend');
    }

    /**
     * Affiche toute l'interface de combat
     */
    showBattleUI() {
        console.log('[BattleScene] Affichage UI combat');
        
        // Afficher le menu principal
        if (this.menuManager) {
            this.menuManager.showMainMenu();
        }

        // Afficher UI Joueur
        const playerContainer = this.children.getByName('playerContainer');
        if (playerContainer) {
            playerContainer.setVisible(true);
            playerContainer.setAlpha(1);
        }
        if (this.playerUIElements) {
            this.playerUIElements.forEach(el => {
                if (el) {
                    el.setVisible(true);
                    el.setAlpha(1);
                }
            });
        }

        // Afficher UI Adversaire
        const opponentContainer = this.children.getByName('opponentContainer');
        if (opponentContainer) {
            opponentContainer.setVisible(true);
            opponentContainer.setAlpha(1);
        }
        if (this.opponentUIElements) {
            this.opponentUIElements.forEach(el => {
                if (el) {
                    el.setVisible(true);
                    el.setAlpha(1);
                }
            });
        }
    }

    /**
     * Utilitaire: Attendre un délai
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Nettoyage complet de la scène
     */
    cleanupBattle() {
        console.log('[BattleScene] Cleanup...');
        
        // Nettoyer les GIFs DOM
        const SpriteLoader = require('./utils/spriteLoader').default;
        if (this.playerGifContainer) {
            this.playerGifContainer.remove();
            this.playerGifContainer = null;
        }
        if (this.opponentGifContainer) {
            this.opponentGifContainer.remove();
            this.opponentGifContainer = null;
        }
        
        // Nettoyer les références
        this.playerSprite = null;
        this.opponentSprite = null;
        this.playerHPBar = null;
        this.opponentHPBar = null;
        this.moveButtons = [];
        this.battleLogTexts = [];
        
        // Nettoyer les managers
        this.uiManager = null;
        this.menuManager = null;
        this.animManager = null;
        this.spriteManager = null;
        this.turnManager = null;

        // Stop music if playing
        // Stop battle music if playing
        if (this.soundManager) {
            try { this.soundManager.stopMusic(); } catch (e) { /* ignore */ }
        }

        // Restore previous global music if any (MainMenu/Game music)
        try { MusicManager.restorePrevious(); } catch (e) { /* ignore */ }
    }
}