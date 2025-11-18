/**
 * PokemonDetailScene.js
 * Scène pour afficher les détails complets d'un Pokémon
 * - Stats complètes (HP, Att, Déf, etc.)
 * - IV et EV
 * - 4 mouvements avec détails
 * - Nature et objet tenu
 * - Statuts (poison, paralysie, etc.)
 */

import Phaser from 'phaser';
import PokemonManager from './managers/PokemonManager';
import SpriteLoader from './utils/spriteLoader';
import MoveDetailModal from './MoveDetailModal';

export class PokemonDetailScene extends Phaser.Scene {
    constructor() {
        super('PokemonDetailScene');
        this.pokemonManager = null;
        this.pokemon = null;
        this.species = null;
        this.stats = null;
        this.moveModal = null;
    }

    init(data) {
        console.log('[PokemonDetail] Initialisation:', data);
        this.pokemon = data?.pokemon || null; // 🆕 Pokémon direct
        this.pokemonId = data?.pokemonId; // Fallback ancien système
        this.returnScene = data?.returnScene || 'PokemonTeamScene';
        this.inBattle = data?.inBattle || false; // 🆕 FLAG combat
        this.battleState = data?.battleState || null; // 🆕 State combat
    }

    async create() {
        console.log('[PokemonDetail] Création scène');

        // Initialiser manager
        if (!this.pokemonManager) {
            this.pokemonManager = new PokemonManager(null);
        }

        // Initialiser le modal des moves
        this.moveModal = new MoveDetailModal(this);

        // Fond
        this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            this.cameras.main.width,
            this.cameras.main.height,
            0x1a1a2e
        ).setOrigin(0.5);

        // 🆕 Si Pokémon passé directement, calculer species et stats
        if (this.pokemon) {
            console.log('[PokemonDetail] Pokémon fourni directement:', this.pokemon);
            
            // Pokémon déjà fourni, calculer species et stats
            if (!this.species) {
                // Cas 1: speciesData déjà présent (depuis TeamScene)
                if (this.pokemon.speciesData) {
                    this.species = this.pokemon.speciesData;
                    console.log('[PokemonDetail] Species depuis speciesData');
                } 
                // Cas 2: species_id présent (depuis BattleScene)
                else if (this.pokemon.species_id) {
                    this.species = await this.pokemonManager.getSpecies(this.pokemon.species_id);
                    console.log('[PokemonDetail] Species chargée depuis species_id');
                }
            }
            
            // Calculer les stats si on a species
            if (!this.stats && this.species) {
                console.log('[PokemonDetail] Calcul des stats avec nature:', this.pokemon.nature || 'hardy');
                this.stats = this.pokemonManager.calculateStats(
                    this.pokemon, 
                    this.species, 
                    this.pokemon.nature || 'hardy' // 🆕 Nature par défaut
                );
                console.log('[PokemonDetail] Stats calculées:', this.stats);
            } else if (!this.species) {
                console.error('[PokemonDetail] Impossible de calculer stats: pas de species');
            }
        } else if (this.pokemonId) {
            // Charger les données depuis DB (ancien système)
            console.log('[PokemonDetail] Chargement depuis pokemonId:', this.pokemonId);
            await this.loadPokemonData();
        }

        if (!this.pokemon) {
            this.add.text(
                this.cameras.main.centerX,
                this.cameras.main.centerY,
                'Erreur: Pokémon non trouvé',
                { fontSize: '20px', fill: '#FF0000' }
            ).setOrigin(0.5);
            return;
        }

        // Créer l'interface
        await this.createInterface();
    }

    /**
     * Charge les données du Pokémon
     */
    async loadPokemonData() {
        try {
            this.pokemon = await this.pokemonManager.getPokemonDetail(this.pokemonId);
            
            if (this.pokemon) {
                this.species = await this.pokemonManager.getSpecies(this.pokemon.species_id);
                if (this.species) {
                    this.stats = this.pokemonManager.calculateStats(this.pokemon, this.species, this.pokemon.nature);
                }
            }

            console.log('[PokemonDetail] Données chargées:', this.pokemon);
        } catch (error) {
            console.error('[PokemonDetail] Erreur chargement:', error);
        }
    }

    /**
     * Crée l'interface complète
     * Layout: Titre (nickname) en haut, sprite gros, 2 colonnes (stats | infos), moves en bas
     */
    async createInterface() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const centerX = width * 0.5;
        const centerY = height * 0.5;

        // Titre: juste le nickname (5% du haut)
        this.add.text(
            centerX,
            height * 0.05,
            this.pokemon.nickname,
            {
                fontSize: `${Math.min(width, height) * 0.08}px`,
                fill: '#FFD700',
                fontStyle: 'bold',
                fontFamily: 'Arial'
            }
        ).setOrigin(0.5);

        // Bouton retour en bas à gauche
        this.createBackButton();

        // Sprite en haut (15% du haut)
        await this.createSprite(centerX, height * 0.18);

        // Deux colonnes en dessous du sprite (30% du haut)
        const colStartY = height * 0.30;
        const leftColX = width * 0.25;
        const rightColX = width * 0.75;

        // Colonne gauche: Stats
        this.createStatsColumn(leftColX, colStartY, width, height);

        // Colonne droite: Infos (Niveau, XP, HP, Nature)
        this.createInfoColumn(rightColX, colStartY, width, height);

        // Moves en bas (75% du haut) - 🆕 await pour traduction
        await this.createMovesSection(centerX, height * 0.60, width, height);
        
        // 🆕 Si en combat, ajouter bouton "Envoyer au combat"
        if (this.inBattle) {
            this.createSendToBattleButton();
        }
    }

    /**
     * Crée le bouton retour en bas à gauche
     */
    createBackButton() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        const buttonWidth = width * 0.25;
        const buttonHeight = height * 0.05;
        const buttonX = width * 0.15;
        const buttonY = height * 0.90;
        
        const button = this.add.rectangle(buttonX, buttonY, buttonWidth, buttonHeight, 0x4CAF50);
        button.setInteractive({ useHandCursor: true });

        this.add.text(buttonX, buttonY, '← Retour', {
            fontSize: `${Math.min(width, height) * 0.035}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        button.on('pointerdown', () => {
            console.log('[PokemonDetail] Retour à', this.returnScene, 'inBattle:', this.inBattle);
            
            // Cas combat: retour à TeamScene avec contexte combat
            if (this.inBattle && this.returnScene === 'PokemonTeamScene') {
                this.scene.start(this.returnScene, {
                    playerId: this.scene.settings.data?.playerId,
                    returnScene: 'PokemonBattleScene',
                    inBattle: true,
                    battleState: this.battleState
                });
            }
            // Cas normal: simple retour
            else {
                const playerId = this.scene.settings.data?.playerId;
                this.scene.start(this.returnScene, { playerId: playerId });
            }
        });
        button.on('pointerover', () => button.setFillStyle(0x45a049));
        button.on('pointerout', () => button.setFillStyle(0x4CAF50));
    }

    /**
     * Affiche le sprite du Pokémon en gros (front combat)
     */
    async createSprite(x, y) {
        // Utiliser le sprite du Pokémon (pas du species)
        let spriteUrl = null;
        
        // Priorité 1: sprites du pokemon.speciesData (depuis BattleScene ou TeamScene)
        if (this.pokemon.speciesData?.sprites?.frontCombat) {
            spriteUrl = this.pokemon.speciesData.sprites.frontCombat;
        } else if (this.pokemon.speciesData?.sprites?.front) {
            spriteUrl = this.pokemon.speciesData.sprites.front;
        }
        // Priorité 2: sprites du pokemon directement (ancien système)
        else if (this.pokemon.sprites?.frontCombat) {
            spriteUrl = this.pokemon.sprites.frontCombat;
        } else if (this.pokemon.sprites?.front) {
            spriteUrl = this.pokemon.sprites.front;
        }
        // Priorité 3: sprites du species (fallback)
        else if (this.species?.sprites?.frontCombat) {
            spriteUrl = this.species.sprites.frontCombat;
        } else if (this.species?.sprites?.front) {
            spriteUrl = this.species.sprites.front;
        }
        
        console.log('[PokemonDetail] Sprite URL:', spriteUrl, 'pour Pokemon:', this.pokemon.nickname || this.pokemon.name);
        
        if (spriteUrl) {
            try {
                await SpriteLoader.displaySprite(
                    this,
                    x,
                    y,
                    spriteUrl,
                    this.pokemon.nickname?.substring(0, 2) || '?',
                    3.0
                );
            } catch (e) {
                console.error('[PokemonDetail] Erreur chargement sprite:', e);
            }
        } else {
            console.warn('[PokemonDetail] Aucun sprite disponible pour:', this.pokemon);
        }
    }

    /**
     * Colonne gauche: Stats du Pokémon
     */
    createStatsColumn(x, y, screenWidth, screenHeight) {
        const boxWidth = screenWidth * 0.40;
        const boxHeight = screenHeight * 0.25;
        
        this.add.rectangle(x, y + boxHeight / 2, boxWidth, boxHeight, 0x2a2a4e, 0.9)
            .setStrokeStyle(2, 0xFFD700);

        // Titre
        this.add.text(x, y + boxHeight * 0.08, 'STATS', {
            fontSize: `${Math.min(screenWidth, screenHeight) * 0.05}px`,
            fill: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // 🆕 Vérification de sécurité
        if (!this.stats) {
            console.warn('[PokemonDetail] Stats non calculées, utilisation valeurs par défaut');
            this.add.text(x, y + boxHeight * 0.5, 'Stats indisponibles', {
                fontSize: `${Math.min(screenWidth, screenHeight) * 0.04}px`,
                fill: '#FF0000'
            }).setOrigin(0.5);
            return;
        }

        // Afficher les stats
        const statsList = [
            { name: 'HP', value: this.stats.hp },
            { name: 'ATT', value: this.stats.attack },
            { name: 'DÉF', value: this.stats.defense },
            { name: 'SPATT', value: this.stats.sp_attack },
            { name: 'SPDEF', value: this.stats.sp_defense },
            { name: 'VIT', value: this.stats.speed }
        ];

        statsList.forEach((stat, index) => {
            const statY = y + boxHeight * 0.25 + (index * boxHeight * 0.12);
            
            // Nom stat
            this.add.text(x - boxWidth * 0.35, statY, stat.name, {
                fontSize: `${Math.min(screenWidth, screenHeight) * 0.05}px`,
                fill: '#FFFFFF',
                fontStyle: 'bold'
            });

            // Valeur stat
            this.add.text(x + boxWidth * 0.3, statY, stat.value.toString(), {
                fontSize: `${Math.min(screenWidth, screenHeight) * 0.05}px`,
                fill: '#00FF00'
            }).setOrigin(1, 0);
        });
    }

    /**
     * Colonne droite: Infos (Niveau, XP, HP, Nature)
     */
    createInfoColumn(x, y, screenWidth, screenHeight) {
        const boxWidth = screenWidth * 0.40;
        const boxHeight = screenHeight * 0.25;
        
        this.add.rectangle(x, y + boxHeight / 2, boxWidth, boxHeight, 0x2a2a4e, 0.9)
            .setStrokeStyle(2, 0xFFD700);

        // Titre
        this.add.text(x, y + boxHeight * 0.08, 'INFOS', {
            fontSize: `${Math.min(screenWidth, screenHeight) * 0.045}px`,
            fill: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        let infoY = y + boxHeight * 0.25;

        // Niveau
        this.add.text(x, infoY, `Niveau: ${this.pokemon.level || 1}`, {
            fontSize: `${Math.min(screenWidth, screenHeight) * 0.035}px`,
            fill: '#FFFFFF'
        }).setOrigin(0.5);
        infoY += boxHeight * 0.10;

        // Barre de progression XP (formule Medium-Slow comme dans BattleScene)
        const level = this.pokemon.level || 1;
        const experience = this.pokemon.experience || 0;
        const currentLevelXP = this.calculateXPForLevel(level);
        const nextLevelXP = this.calculateXPForLevel(level + 1);
        const xpInLevel = experience - currentLevelXP;
        const xpNeededForLevel = nextLevelXP - currentLevelXP;
        const xpPercent = Math.max(0, Math.min(100, (xpInLevel / xpNeededForLevel) * 100));
        
        console.log('[DetailScene] XP Bar:', {
            level,
            experience,
            currentLevelXP,
            nextLevelXP,
            xpInLevel,
            xpNeededForLevel,
            xpPercent: xpPercent.toFixed(2) + '%'
        });
        
        const barWidth = boxWidth * 0.70;
        const barHeight = screenHeight * 0.015;
        
        // Fond barre XP (toujours la même taille)
        this.add.rectangle(x, infoY, barWidth, barHeight, 0x333333).setOrigin(0.5);
        // Barre remplie (proportionnelle au % d'XP dans le niveau actuel)
        const filledWidth = (barWidth * xpPercent / 100);
        if (filledWidth > 0) {
            this.add.rectangle(x - barWidth / 2, infoY, filledWidth, barHeight, 0x00BFFF).setOrigin(0, 0.5);
        }
        infoY += boxHeight * 0.18;

        // HP
        const currentHP = this.pokemon.currentHP || 0;
        const maxHP = this.pokemon.maxHP || 1;
        const hpPercent = (currentHP / maxHP) * 100;
        const hpColor = hpPercent > 50 ? '#00FF00' : (hpPercent > 25 ? '#FFFF00' : '#FF0000');
        
        this.add.text(x, infoY, `HP: ${currentHP}/${maxHP}`, {
            fontSize: `${Math.min(screenWidth, screenHeight) * 0.05}px`,
            fill: hpColor
        }).setOrigin(0.5);
        infoY += boxHeight * 0.12;

        // Barre HP
        const hpBarWidth = boxWidth * 0.75;
        const hpBarHeight = screenHeight * 0.017;
        this.add.rectangle(x, infoY, hpBarWidth, hpBarHeight, 0x333333).setOrigin(0.5);
        this.add.rectangle(x - hpBarWidth / 2, infoY, (hpBarWidth * hpPercent / 100), hpBarHeight, parseInt(hpColor.replace('#', '0x'))).setOrigin(0, 0.5);
        infoY += boxHeight * 0.15;

        // Nature
        this.add.text(x, infoY, `Nature:`, {
            fontSize: `${Math.min(screenWidth, screenHeight) * 0.035}px`,
            fill: '#CCCCCC'
        }).setOrigin(0.5);
        infoY += boxHeight * 0.12;
        
        this.add.text(x, infoY, this.pokemon.nature || 'Inconnue', {
            fontSize: `${Math.min(screenWidth, screenHeight) * 0.04}px`,
            fill: '#FF69B4'
        }).setOrigin(0.5);

        // Statut
        if (this.pokemon.status) {
            infoY += boxHeight * 0.12;
            this.add.text(x, infoY, `Statut: ${this.pokemon.status}`, {
                fontSize: `${Math.min(screenWidth, screenHeight) * 0.03}px`,
                fill: '#FF0000'
            }).setOrigin(0.5);
        }
    }

    /**
     * Section Moves: Affiche les 4 moves en 2 lignes (2 par ligne)
     */
    async createMovesSection(x, y, screenWidth, screenHeight) {
        const movesTitle = this.add.text(x, y, 'CAPACITÉS', {
            fontSize: `${Math.min(screenWidth, screenHeight) * 0.06}px`,
            fill: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const moveset = this.pokemon.moveset || [];
        const moveWidth = screenWidth * 0.35;
        const moveHeight = screenHeight * 0.06;
        const spacing = screenWidth * 0.02;

        for (let i = 0; i < 4; i++) {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const moveX = x - moveWidth / 2 - spacing / 2 + col * (moveWidth + spacing);
            const moveY = y + screenHeight * 0.05 + row * (moveHeight + spacing);

            const moveData = moveset[i];
            const moveNameEN = moveData?.name || `Move ${i + 1}`;
            const moveType = moveData?.type || 'normal';
            
            // 🆕 Traduire nom du move en FR
            let moveName = moveNameEN;
            if (moveData?.name) {
                try {
                    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
                    const response = await fetch(`${backendUrl}/api/translations/move/${moveData.name}`);
                    if (response.ok) {
                        const data = await response.json();
                        moveName = data.name_fr || moveNameEN;
                    }
                } catch (error) {
                    console.error('[PokemonDetail] Erreur traduction move:', error);
                }
            }
            
            const moveBox = this.add.rectangle(moveX, moveY, moveWidth, moveHeight, this.getTypeColor(moveType), 0.8);
            moveBox.setStrokeStyle(2, 0xFFFFFF);
            moveBox.setInteractive();

            const moveText = this.add.text(moveX, moveY, moveName, {
                fontSize: `${Math.min(screenWidth, screenHeight) * 0.03}px`,
                fill: '#FFFFFF',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            moveBox.on('pointerover', () => {
                moveBox.setFillStyle(this.getTypeColor(moveType), 1);
            });

            moveBox.on('pointerout', () => {
                moveBox.setFillStyle(this.getTypeColor(moveType), 0.8);
            });

            moveBox.on('pointerdown', () => {
                console.log('[PokemonDetail] Move clicked:', moveName);
                this.showMoveDetails(moveData?.name || moveName);
            });
        }
    }

    /**
     * Récupère et affiche les détails d'un move
     */
    async showMoveDetails(moveName) {
        if (!moveName || moveName.startsWith('Move ')) {
            console.warn('[PokemonDetail] Pas de move valide à afficher');
            return;
        }

        try {
            const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
            const response = await fetch(`${backendUrl}/api/pokemon/move/${moveName}`);

            if (!response.ok) {
                console.error('[PokemonDetail] Move non trouvé:', moveName);
                return;
            }

            const moveData = await response.json();
            console.log('[PokemonDetail] Données move récupérées:', moveData);

            // Afficher le modal
            this.moveModal.show(moveData);

        } catch (error) {
            console.error('[PokemonDetail] Erreur récupération move:', error);
        }
    }

    /**
     * Crée des détails IV/EV (optionnel, panneau supplémentaire)
     */
    createIVEVPanel() {
        // Afficher IV et EV détaillés
        const x = 20;
        const y = this.cameras.main.height - 100;

        this.add.text(x, y, 'IV (Individuel):', {
            fontSize: '10px',
            fill: '#FFFF00'
        });

        const ivStats = ['HP', 'ATT', 'DÉF', 'SPATT', 'SPDEF', 'VIT'];
        ivStats.forEach((stat, idx) => {
            const value = this.pokemon.ivs[stat.toLowerCase()] || 0;
            this.add.text(x + (idx % 3) * 100, y + 15 + Math.floor(idx / 3) * 15, `${stat}: ${value}/31`, {
                fontSize: '9px',
                fill: '#CCCCCC'
            });
        });
    }

    /**
     * Calcule l'XP minimum requis pour un niveau (formule medium-slow)
     * MÊME FORMULE que dans PokemonBattleScene
     */
    calculateXPForLevel(level) {
        if (level <= 1) return 0;
        return Math.floor(1.2 * Math.pow(level, 3) - 15 * Math.pow(level, 2) + 100 * level - 140);
    }

    /**
     * Retourne la couleur pour un type
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
        return typeColors[type.toLowerCase()] || 0x888888;
    }

    /**
     * 🆕 Bouton "Envoyer au combat" si en combat
     */
    createSendToBattleButton() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Vérifier si Pokémon est K.O. ou déjà actif
        const isKO = this.pokemon.currentHP <= 0;
        const isActive = this.battleState?.playerActive?._id?.toString() === this.pokemon._id?.toString();
        
        if (isKO || isActive) {
            // Ne pas afficher le bouton si K.O. ou déjà actif
            return;
        }
        
        const buttonWidth = width * 0.35;
        const buttonHeight = height * 0.06;
        const buttonX = width * 0.85;
        const buttonY = height * 0.90;
        
        const button = this.add.rectangle(buttonX, buttonY, buttonWidth, buttonHeight, 0x3498DB);
        button.setInteractive({ useHandCursor: true });

        this.add.text(buttonX, buttonY, '⚔️ Envoyer au combat', {
            fontSize: `${Math.min(width, height) * 0.035}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        button.on('pointerdown', () => {
            console.log('[PokemonDetail] Envoi au combat:', this.pokemon.nickname);
            
            // Retourner à TeamScene qui gère le switch
            this.scene.stop('PokemonDetailScene');
            this.scene.stop('PokemonTeamScene');
            
            // Reprendre BattleScene et faire le switch
            const battleScene = this.scene.get('PokemonBattleScene');
            this.scene.resume('PokemonBattleScene');
            
            // 🆕 Forcer BattleScene au premier plan
            this.scene.bringToTop('PokemonBattleScene');
            
            // Trouver l'index du Pokémon dans l'équipe
            const teamIndex = this.battleState.playerTeam.findIndex(
                p => p._id.toString() === this.pokemon._id.toString()
            );
            
            console.log('[PokemonDetail] Switch - Pokemon ID:', this.pokemon._id, 'Index trouvé:', teamIndex);
            console.log('[PokemonDetail] PlayerTeam:', this.battleState.playerTeam.map((p, i) => ({ index: i, name: p.name, id: p._id })));
            
            if (teamIndex !== -1 && battleScene.switchPokemon) {
                battleScene.switchPokemon(teamIndex);
            } else {
                console.error('[PokemonDetail] Pokémon non trouvé dans playerTeam');
            }
        });
        
        // Ajouter feedback visuel hover
        button.on('pointerover', () => {
            button.setFillStyle(0x2980B9);
            this.tweens.add({
                targets: button,
                scaleX: 1.05,
                scaleY: 1.05,
                duration: 100,
                ease: 'Power2'
            });
        });
        
        button.on('pointerout', () => {
            button.setFillStyle(0x3498DB);
            this.tweens.add({
                targets: button,
                scaleX: 1.0,
                scaleY: 1.0,
                duration: 100,
                ease: 'Power2'
            });
        });
    }
}

