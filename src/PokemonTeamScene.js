/**
 * PokemonTeamScene.js
 * Scène pour gérer l'équipe Pokémon du joueur (MAX 6 Pokémon avec position)
 * - Affichage des Pokémon avec position 1-6 uniquement
 * - Noms en français
 * - Sprites affichés
 * - Cartes optimisées (plus petites)
 * - Espace pour chat en bas
 */

import Phaser from 'phaser';
import PokemonManager from './managers/PokemonManager';
import { getTypeFrench } from './utils/pokemonNames';
import SpriteLoader from './utils/spriteLoader';

export class PokemonTeamScene extends Phaser.Scene {
    constructor() {
        super('PokemonTeamScene');
        this.pokemonManager = null;
        this.currentPlayer = null;
        this.teamDisplay = [];
        this.selectedPokemonIndex = null;
        this.isDragging = false;
        this.dragStart = null;
    }

    init(data) {
        console.log('[PokemonTeam] Initialisation avec data:', data);
        this.currentPlayer = data?.playerId;
        this.returnScene = data?.returnScene || 'GameScene';
    }

    preload() {
        // Charger des sons et images optionnels
        //this.load.audio('pokemonSelect', 'assets/sounds/pokemonSelect.mp3').catch(() => {});
    }

    create() {
        console.log('[PokemonTeam] Création scène');

        // Fermer menu d'options si on revient d'une autre scène
        if (this.optionsMenu) {
            this.optionsMenu.destroy();
            this.optionsMenu = null;
        }

        // Initialiser PokemonManager si pas déjà fait
        if (!this.pokemonManager) {
            this.pokemonManager = new PokemonManager(null);
        }

        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Fond
        this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            width,
            height,
            0x1a1a2e
        ).setOrigin(0.5);

        // Bouton retour EN HAUT À GAUCHE (ne chauffe pas le titre)
        this.createBackButton();

        // Titre centré en haut
        this.add.text(
            width * 0.5,
            height * 0.05,
            'Votre équipe',
            {
                fontSize: `${Math.min(width, height) * 0.06}px`,
                fill: '#FFD700',
                fontStyle: 'bold',
                fontFamily: 'Arial'
            }
        ).setOrigin(0.5);

        // Charger et afficher l'équipe
        this.loadAndDisplayTeam();

        // Bouton Combat Sauvage (en haut à droite)
        this.createBattleButton();

        // Instructions EN BAS (responsive)
        this.add.text(
            width * 0.5,
            height * 0.92,
            'Cliquez pour plus d\'info. Glisser pour réarranger',
            {
                fontSize: `${Math.min(width, height) * 0.028}px`,
                fill: '#CCCCCC',
                fontStyle: 'italic',
                align: 'center'
            }
        ).setOrigin(0.5);
    }

    /**
     * Crée le bouton Combat Sauvage
     */
    createBattleButton() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        const buttonWidth = width * 0.25;
        const buttonHeight = height * 0.055;
        const x = width * 0.85;
        const y = height * 0.05;

        // Fond bouton
        const button = this.add.rectangle(x, y, buttonWidth, buttonHeight, 0xE74C3C);
        button.setInteractive({ useHandCursor: true });

        // Texte bouton
        const text = this.add.text(x, y, '⚔️ Combat Sauvage', {
            fontSize: `${Math.min(width, height) * 0.032}px`,
            fill: '#FFFFFF',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        // Événements
        button.on('pointerdown', () => this.startWildBattle());
        button.on('pointerover', () => {
            button.setFillStyle(0xC0392B);
            this.tweens.add({
                targets: button,
                scaleX: 1.05,
                scaleY: 1.05,
                duration: 100,
                ease: 'Power2'
            });
        });
        button.on('pointerout', () => {
            button.setFillStyle(0xE74C3C);
            this.tweens.add({
                targets: button,
                scaleX: 1.0,
                scaleY: 1.0,
                duration: 100,
                ease: 'Power2'
            });
        });
    }

    /**
     * Lance un combat sauvage
     */
    startWildBattle() {
        console.log('[PokemonTeam] Lancement combat sauvage');
        
        // Pas de transition - la BattleScene gère son propre spiral
        this.scene.start('PokemonBattleScene', {
            playerId: this.currentPlayer,
            battleType: 'wild',
            returnScene: 'PokemonTeamScene'
        });
    }

    /**
     * Crée le bouton retour en haut à gauche
     */
    createBackButton() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        const buttonWidth = width * 0.22;
        const buttonHeight = height * 0.05;
        const x = width * 0.15;
        const y = height * 0.05;

        // Fond bouton
        const button = this.add.rectangle(x, y, buttonWidth, buttonHeight, 0x4CAF50);
        button.setInteractive({ useHandCursor: true });

        // Texte bouton
        this.add.text(x, y, '← Retour', {
            fontSize: `${Math.min(width, height) * 0.035}px`,
            fill: '#FFFFFF',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        // Événement
        button.on('pointerdown', () => this.returnToScene());
        button.on('pointerover', () => button.setFillStyle(0x45a049));
        button.on('pointerout', () => button.setFillStyle(0x4CAF50));
    }

    /**
     * Charge et affiche l'équipe du joueur (uniquement position 1-6)
     */
    async loadAndDisplayTeam(silent = false) {
        if (!this.currentPlayer) {
            console.warn('[PokemonTeam] Pas de joueur défini');
            this.add.text(
                this.cameras.main.centerX,
                this.cameras.main.centerY,
                'Erreur: Joueur non défini',
                { fontSize: '20px', fill: '#FF0000' }
            ).setOrigin(0.5);
            return;
        }

        try {
            let loadingText = null;
            
            // Afficher "Chargement..." seulement si pas en mode silencieux
            if (!silent) {
                loadingText = this.add.text(
                    this.cameras.main.centerX,
                    this.cameras.main.centerY,
                    'Chargement de l\'équipe...',
                    { fontSize: '20px', fill: '#FFFFFF' }
                ).setOrigin(0.5);
            }

            // Charger l'équipe
            const team = await this.pokemonManager.getTeam(this.currentPlayer);
            if (loadingText) loadingText.destroy();

            // FILTRER: Seulement les Pokémon avec position entre 1 et 6
            const activeTeam = team
                .filter(p => p.position >= 1 && p.position <= 6)
                .sort((a, b) => a.position - b.position);

            console.log(`[PokemonTeam] Équipe chargée: ${activeTeam.length}/6 Pokémon actifs`);

            if (activeTeam.length === 0) {
                this.add.text(
                    this.cameras.main.centerX,
                    this.cameras.main.centerY,
                    'Aucun Pokémon dans l\'équipe\nCaptez-en un pour commencer!',
                    {
                        fontSize: '18px',
                        fill: '#FFFFFF',
                        align: 'center'
                    }
                ).setOrigin(0.5);
                return;
            }

            // Enrichir avec données PokéAPI (lazy fetch)
            const enrichedTeam = await Promise.all(
                activeTeam.map(async (pokemon) => {
                    const speciesData = await this.pokemonManager.getSpecies(pokemon.species_id);
                    return {
                        ...pokemon,
                        speciesData
                    };
                })
            );

            // Afficher les Pokémon
            this.displayTeam(enrichedTeam);
        } catch (error) {
            console.error('[PokemonTeam] Erreur chargement équipe:', error);
            this.add.text(
                this.cameras.main.centerX,
                this.cameras.main.centerY,
                'Erreur lors du chargement',
                { fontSize: '20px', fill: '#FF0000' }
            ).setOrigin(0.5);
        }
    }

    /**
     * Affiche visuellement l'équipe (cartes optimisées, plus petites)
     */
    async displayTeam(team) {
        // Nettoyer les anciennes cartes et containers si ils existent
        if (this.teamCards) {
            this.teamCards.forEach(cardData => {
                if (cardData.container) {
                    cardData.container.destroy(true);
                }
            });
        }
        
        this.teamCards = [];
        
        const gameWidth = this.cameras.main.width;
        const gameHeight = this.cameras.main.height;
        
        // Layout responsive: 2 colonnes x 3 rangées
        const cardWidth = gameWidth * 0.38;
        const cardHeight = gameHeight * 0.18;
        const startX = gameWidth * 0.27;
        const startY = gameHeight * 0.20;
        const spacingX = gameWidth * 0.46;
        const spacingY = gameHeight * 0.22;
        const bottomMargin = gameHeight * 0.10; // Espace pour chat en bas

        this.teamDisplay = [];

        for (let index = 0; index < team.length; index++) {
            const pokemon = team[index];
            const col = index % 2;
            const row = Math.floor(index / 2);
            
            const x = startX + (col * spacingX);
            const y = startY + (row * spacingY);

            // Vérifier qu'on ne dépasse pas le chat en bas
            if (y + cardHeight > gameHeight - bottomMargin) {
                console.warn(`[PokemonTeam] Carte ${index} dépasserait le chat, skip`);
                break;
            }

            const pokemonCard = await this.createPokemonCard(pokemon, index, x, y, cardWidth, cardHeight);
            this.teamDisplay.push(pokemonCard);
            this.teamCards.push(pokemonCard);
        }
    }

    /**
     * Crée une carte Pokémon interactive (RESPONSIVE: dimensions en %)
     */
    async createPokemonCard(pokemon, index, x, y, width, height) {
        // Container pour grouper tous les éléments
        const container = this.add.container(x, y);
        
        const screenWidth = this.cameras.main.width;
        const screenHeight = this.cameras.main.height;
        const minDim = Math.min(screenWidth, screenHeight);
        
        // Fond carte
        const card = this.add.rectangle(0, 0, width, height, 0x1e1e3f);
        card.setStrokeStyle(2, 0x888888);
        card.setInteractive({ useHandCursor: true, draggable: true });
        container.add(card);

        // Afficher le sprite du Pokémon (MENU sprite: Gen VII)
        if (pokemon.speciesData?.sprites?.menu) {
            try {
                const sprite = await SpriteLoader.displaySprite(
                    this,
                    -width * 0.28,
                    0,
                    pokemon.speciesData.sprites.menu,
                    pokemon.speciesData?.name?.substring(0, 2) || '?',
                    width / 160 // Scale proportionnel
                );
                if (sprite) container.add(sprite);
            } catch (e) {
                console.error('[PokemonTeam] Erreur affichage sprite:', e);
            }
        }

        // Position badge (#1, #2, etc)
        const badge = this.add.text(width * 0.35, -height * 0.40, `#${pokemon.position}`, {
            fontSize: `${minDim * 0.028}px`,
            fill: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        container.add(badge);

        // Nom français (gros) - utiliser le nom de l'espèce
        const frenchName = pokemon.speciesData?.name || pokemon.nickname;
        const nameText = this.add.text(-width * 0.1, -height * 0.25, frenchName, {
            fontSize: `${minDim * 0.035}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        container.add(nameText);

        // Niveau (petit, à droite)
        const levelText = this.add.text(width * 0.31, -height * 0.10, `Nv ${pokemon.level}`, {
            fontSize: `${minDim * 0.032}px`,
            fill: '#90EE90',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        container.add(levelText);

        // HP actuel/Max
        const currentHP = pokemon.currentHP || 0;
        const maxHP = pokemon.maxHP || 20;
        const hpPercent = (currentHP / maxHP) * 100;
        const hpColor = hpPercent > 50 ? '#00FF00' : (hpPercent > 25 ? '#FFFF00' : '#FF0000');
        
        const hpText = this.add.text(width * 0.06, height * 0.05, `PV: ${currentHP}/${maxHP}`, {
            fontSize: `${minDim * 0.022}px`,
            fill: hpColor
        }).setOrigin(0, 0.5);
        container.add(hpText);

        // Barre de HP
        const hpBarWidth = width * 0.35;
        const hpBarHeight = height * 0.035;
        const hpBarX = width * 0.06;
        const hpBarY = height * 0.14;
        
        // Fond de la barre (gris)
        const hpBarBg = this.add.rectangle(hpBarX, hpBarY, hpBarWidth, hpBarHeight, 0x333333);
        hpBarBg.setOrigin(0, 0.5);
        container.add(hpBarBg);
        
        // Barre de HP colorée selon le pourcentage
        const hpBarFill = this.add.rectangle(
            hpBarX, 
            hpBarY, 
            (hpBarWidth * hpPercent / 100), 
            hpBarHeight, 
            parseInt(hpColor.replace('#', '0x'))
        );
        hpBarFill.setOrigin(0, 0.5);
        container.add(hpBarFill);

        // Types (petits badges)
        if (pokemon.speciesData?.types && pokemon.speciesData.types.length > 0) {
            pokemon.speciesData.types.slice(0, 2).forEach((type, typeIndex) => {
                const typeColor = this.getTypeColor(type);
                const typeX = width * 0.06 + (typeIndex * width * 0.22);
                const typeY = height * 0.30;
                
                const typeBg = this.add.rectangle(typeX, typeY, width * 0.18, height * 0.14, typeColor, 0.8);
                const typeText = this.add.text(typeX, typeY, getTypeFrench(type).substring(0, 3).toUpperCase(), {
                    fontSize: `${minDim * 0.019}px`,
                    fill: '#FFFFFF',
                    align: 'center'
                }).setOrigin(0.5);
                container.add([typeBg, typeText]);
            });
        }

        // Variables pour détecter le drag
        let startX = 0;
        let startY = 0;
        let hasMoved = false;
        
        // Interactions
        card.on('pointerover', () => card.setFillStyle(0x2a2a5e));
        card.on('pointerout', () => card.setFillStyle(0x1e1e3f));
        
        this.input.setDraggable(card);
        
        card.on('dragstart', (pointer) => {
            startX = pointer.x;
            startY = pointer.y;
            hasMoved = false;
            container.setAlpha(0.7);
            this.draggingPokemon = { pokemon, index, container, originalX: x, originalY: y };
        });
        
        card.on('drag', (pointer, dragX, dragY) => {
            // Détecter si on a vraiment bougé (plus de 5 pixels)
            const distance = Phaser.Math.Distance.Between(startX, startY, pointer.x, pointer.y);
            if (distance > 5) {
                hasMoved = true;
            }
            
            container.x = x + dragX;
            container.y = y + dragY;
        });
        
        card.on('dragend', () => {
            container.setAlpha(1);
            
            // Vérifier si on a vraiment dragé et si on swap
            if (hasMoved) {
                const swapped = this.checkPokemonSwap(container, pokemon, index, x, y);
                if (!swapped) {
                    // Pas de swap, reset position
                    container.x = x;
                    container.y = y;
                }
            } else {
                // Pas de mouvement = clic simple, ouvrir détail
                container.x = x;
                container.y = y;
                this.goToDetail(pokemon);
            }
            
            this.draggingPokemon = null;
        });

        return { card, container, pokemon, index, x, y };
    }

    /**
     * Vérifie si on doit échanger deux pokémon
     */
    checkPokemonSwap(draggedContainer, draggedPokemon, draggedIndex, originalX, originalY) {
        if (!this.teamCards) return false;
        
        // Trouver si on est au-dessus d'un autre pokemon
        for (let i = 0; i < this.teamCards.length; i++) {
            if (i === draggedIndex) continue;
            
            const targetContainer = this.teamCards[i].container;
            const distance = Phaser.Math.Distance.Between(
                draggedContainer.x, draggedContainer.y,
                targetContainer.x, targetContainer.y
            );
            
            // Si assez proche, échanger
            if (distance < 80) {
                console.log(`[PokemonTeam] Échange position ${draggedPokemon.position} <-> ${this.teamCards[i].pokemon.position}`);
                this.swapPokemonPositions(draggedPokemon, this.teamCards[i].pokemon);
                return true;
            }
        }
        return false;
    }

    /**
     * Échange les positions de deux pokémon
     */
    async swapPokemonPositions(pokemon1, pokemon2) {
        try {
            const backendUrl = process.env.REACT_APP_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:5000';
            const response = await fetch(`${backendUrl}/api/pokemon/swap-positions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pokemon1Id: pokemon1._id,
                    pokemon2Id: pokemon2._id
                })
            });
            
            if (response.ok) {
                console.log('[PokemonTeam] Positions échangées avec succès');
                // Recharger l'équipe en mode silencieux (pas de texte "Chargement...")
                await this.loadAndDisplayTeam(true);
            } else {
                console.error('[PokemonTeam] Erreur échange positions');
            }
        } catch (error) {
            console.error('[PokemonTeam] Erreur:', error);
        }
    }

    /**
     * Va à la scène de détails
     */
    goToDetail(pokemon) {
        console.log(`[PokemonTeam] Accès détails: ${pokemon.nickname}`);
        
        if (this.optionsMenu) {
            this.optionsMenu.destroy();
            this.optionsMenu = null;
        }

        this.scene.start('PokemonDetailScene', {
            pokemonId: pokemon._id,
            returnScene: 'PokemonTeamScene',
            playerId: this.currentPlayer
        });
    }

    /**
     * Entraîne un Pokémon (simulation)
     */
    async trainPokemon(pokemon) {
        console.log(`[PokemonTeam] Entraînement: ${pokemon.nickname}`);

        // Augmenter l'expérience et vérifier montée de niveau
        const newExperience = pokemon.experience + 100;
        const newLevel = pokemon.level + (Math.floor(newExperience / 1000) > Math.floor(pokemon.experience / 1000) ? 1 : 0);

        const updated = await this.pokemonManager.updatePokemon(pokemon._id, {
            experience: newExperience,
            level: newLevel
        });

        if (updated) {
            // Recharger l'équipe
            this.scene.restart({ playerId: this.currentPlayer });
        }

        if (this.optionsMenu) this.optionsMenu.destroy();
    }

    /**
     * Place le Pokémon en position 0 (avant)
     */
    async moveTofrontPosition(pokemon, currentIndex) {
        console.log(`[PokemonTeam] Déplacement en avant: ${pokemon.nickname}`);

        const team = await this.pokemonManager.getTeam(this.currentPlayer);
        
        // Créer nouveau tableau avec le Pokémon au début
        const reorderedIds = [pokemon._id, ...team.filter((p, i) => i !== currentIndex).map(p => p._id)];

        const success = await this.pokemonManager.reorderTeam(this.currentPlayer, reorderedIds);

        if (success) {
            // Recharger la scène
            this.scene.restart({ playerId: this.currentPlayer });
        }

        if (this.optionsMenu) this.optionsMenu.destroy();
    }

    /**
     * Retourne à la scène précédente
     */
    returnToScene() {
        console.log(`[PokemonTeam] Retour à ${this.returnScene}`);
        // Si la scène précédente est en pause, on la reprend et on arrête celle-ci
        if (this.scene.isPaused(this.returnScene)) {
            this.scene.resume(this.returnScene);
        }
        this.scene.stop();
    }

    /**
     * Retourne la couleur pour un type Pokémon
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

    update() {
        // Gestion événements chaque frame si nécessaire
    }
}
