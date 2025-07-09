import Phaser from 'phaser';
import MusicManager from './MusicManager.js';

export class QuizLobbyScene extends Phaser.Scene {
    constructor() {
        super("QuizLobbyScene");
        this.currentView = 'main'; // 'main', 'waiting', 'categories'
        this.availableGames = [];
        this.currentGame = null;
        this.isHost = false;
        this.selectedCategories = [];
        this.selectedDifficulty = "moyen";
    }

    init(data) {
        this.playerId = data.playerId;
        this.playerName = data.playerName || "Joueur";
        this.socket = this.registry.get("socket");
        this.currentView = 'main';
        this.currentGame = null;
        this.isHost = false;
    }

    create() {
        // Jouer la musique
        MusicManager.play(this, 'music1', { loop: true, volume: 0.4 });
        
        this.setupSocketEvents();
        this.showMainMenu();
        
        // Demander la liste des quiz disponibles
        this.socket.emit('quiz:requestGamesList');
    }

    showMainMenu() {
        this.children.removeAll();
        this.currentView = 'main';
        
        const { width, height } = this.sys.game.canvas;
        
        // Calculs adaptatifs pour mobile
        const baseSize = Math.min(width, height);
        const titleSize = Math.min(baseSize * 0.08, 42);
        const buttonTextSize = Math.min(baseSize * 0.05, 28);
        const subtitleSize = Math.min(baseSize * 0.04, 22);
        const buttonWidth = Math.min(width * 0.8, 400);
        const buttonHeight = Math.max(height * 0.08, 60);
        
        // Fond avec dégradé
        const bgGradient = this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e, 0.95);
        const bgOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x667eea, 0.1);

        // Particules d'arrière-plan pour effet moderne
        for (let i = 0; i < 20; i++) {
            const particle = this.add.circle(
                Phaser.Math.Between(0, width),
                Phaser.Math.Between(0, height),
                Phaser.Math.Between(2, 8),
                0x667eea,
                0.3
            );
            
            this.tweens.add({
                targets: particle,
                y: particle.y - height,
                duration: Phaser.Math.Between(8000, 15000),
                repeat: -1,
                ease: 'Linear'
            });
        }

        // Titre principal avec effet de brillance
        const mainTitle = this.add.text(width / 2, height * 0.18, "QUIZ", {
            font: `bold ${titleSize}px Arial`,
            fill: "#ffffff",
            stroke: "#667eea",
            strokeThickness: 4,
            align: "center"
        }).setOrigin(0.5);

        const subtitle = this.add.text(width / 2, height * 0.25, "Culture Générale", {
            font: `${subtitleSize}px Arial`,
            fill: "#a78bfa",
            align: "center"
        }).setOrigin(0.5);

        // Animation pulsante pour le titre
        this.tweens.add({
            targets: [mainTitle, subtitle],
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Créer les éléments du bouton Organiser avec sélection de catégorie
        const organizeButton = this.createButton(
            width / 2,
            height * 0.42,
            buttonWidth,
            buttonHeight,
            0x10b981,
            0x34d399,
            "🎯",
            "ORGANISER UN QUIZ",
            buttonTextSize,
            () => {
                this.showCategorySelection(); // Nouvelle fonction pour sélectionner les catégories
            }
        );

        // Section quiz disponibles avec design amélioré
        const sectionBg = this.add.rectangle(width / 2, height * 0.7, width * 0.9, height * 0.35, 0x2d3748, 0.8)
            .setOrigin(0.5);
        
        const sectionBorder = this.add.rectangle(width / 2, height * 0.7, width * 0.9 + 4, height * 0.35 + 4, 0x4a5568, 0.6)
            .setOrigin(0.5);

        const sectionTitle = this.add.text(width / 2, height * 0.57, "🏆 Quiz en attente", {
            font: `bold ${subtitleSize}px Arial`,
            fill: "#f7fafc",
            align: "center"
        }).setOrigin(0.5);

        // Afficher les quiz disponibles
        this.displayAvailableGames();

        // Bouton retour avec icône croix
        const backButtonSize = Math.min(baseSize * 0.08, 50);
        const backButton = this.add.circle(
            width * 0.92, 
            height * 0.08, 
            backButtonSize * 0.6, 
            0xff4444, 
            0.9
        ).setInteractive({ useHandCursor: true });

        const backX = this.add.text(width * 0.92, height * 0.08, "✕", {
            font: `bold ${backButtonSize}px Arial`,
            fill: "#ffffff",
            align: "center"
        }).setOrigin(0.5);

        // Effet hover pour le bouton retour
        backButton.on('pointerover', () => {
            backButton.setScale(1.1);
            backX.setScale(1.1);
        });
        
        backButton.on('pointerout', () => {
            backButton.setScale(1);
            backX.setScale(1);
        });

        backButton.on('pointerdown', () => {
            this.tweens.add({
                targets: [backButton, backX],
                scaleX: 0.8,
                scaleY: 0.8,
                duration: 100,
                yoyo: true,
                ease: 'Power2',
                onComplete: () => {
                    this.scene.stop();
                    this.scene.resume("GameScene");
                }
            });
        });
    }

    showCategorySelection() {
        this.children.removeAll();
        this.currentView = 'categories';
        
        const { width, height } = this.sys.game.canvas;
        const baseSize = Math.min(width, height);
        const titleSize = Math.min(baseSize * 0.07, 36);
        const buttonTextSize = Math.min(baseSize * 0.04, 24);
        
        // Fond avec dégradé
        this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e, 0.95);
        this.add.rectangle(width / 2, height / 2, width, height, 0x667eea, 0.1);

        // Titre style Trivial Pursuit
        const title = this.add.text(width / 2, height * 0.12, "🧠 QUIZ TRIVIAL PURSUIT", {
            font: `bold ${titleSize}px Arial`,
            fill: "#ffffff",
            stroke: "#667eea",
            strokeThickness: 3,
            align: "center"
        }).setOrigin(0.5);

        const subtitle = this.add.text(width / 2, height * 0.18, "Choisissez vos catégories et difficulté", {
            font: `${buttonTextSize * 1.2}px Arial`,
            fill: "#a78bfa",
            align: "center"
        }).setOrigin(0.5);

        // Catégories Trivial Pursuit avec couleurs
        const categories = [
            { name: "Histoire", icon: "🏛️", color: 0xF79646, description: "Événements, personnages historiques" },
            { name: "Géographie", icon: "🌍", color: 0x4F81BD, description: "Pays, capitales, géographie" },
            { name: "Art & Littérature", icon: "🎨", color: 0x9BBB59, description: "Peinture, littérature, culture" },
            { name: "Science et Nature", icon: "🔬", color: 0x8064A2, description: "Sciences, biologie, nature" },
            { name: "Sport", icon: "⚽", color: 0x4BACC6, description: "Sports, compétitions" },
            { name: "Jeux vidéo", icon: "🎮", color: 0xF1975A, description: "Gaming, consoles, personnages" }
        ];

        this.selectedCategories = [...categories.map(c => c.name)]; // Toutes sélectionnées par défaut
        this.selectedDifficulty = "moyen"; // Difficulté par défaut

        // Grid des catégories
        const cols = 2;
        const cardWidth = width * 0.42;
        const cardHeight = height * 0.11;
        const spacing = 20;
        const startX = width / 2 - (cols * cardWidth + (cols - 1) * spacing) / 2 + cardWidth / 2;
        const startY = height * 0.28;

        this.categoryButtons = [];

        categories.forEach((category, index) => {
            const row = Math.floor(index / cols);
            const col = index % cols;
            const x = startX + col * (cardWidth + spacing);
            const y = startY + row * (cardHeight + spacing);

            // Container pour la catégorie
            const categoryContainer = this.add.container(x, y);

            // Fond de la carte
            const cardBg = this.add.rectangle(0, 0, cardWidth, cardHeight, category.color, 0.9)
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });

            const cardBorder = this.add.rectangle(0, 0, cardWidth + 4, cardHeight + 4, 0xffffff, 0.3)
                .setOrigin(0.5);

            // Icône de la catégorie
            const categoryIcon = this.add.text(-cardWidth * 0.35, 0, category.icon, {
                font: `${buttonTextSize * 1.5}px Arial`,
                align: "center"
            }).setOrigin(0.5);

            // Nom de la catégorie
            const categoryName = this.add.text(-cardWidth * 0.1, -cardHeight * 0.15, category.name, {
                font: `bold ${buttonTextSize}px Arial`,
                fill: "#ffffff",
                align: "left",
                stroke: "#000000",
                strokeThickness: 1
            }).setOrigin(0, 0.5);

            // Description
            const categoryDesc = this.add.text(-cardWidth * 0.1, cardHeight * 0.15, category.description, {
                font: `${buttonTextSize * 0.7}px Arial`,
                fill: "#f0f0f0",
                align: "left",
                wordWrap: { width: cardWidth * 0.6 }
            }).setOrigin(0, 0.5);

            // Checkmark pour sélection
            const checkmark = this.add.text(cardWidth * 0.35, 0, "✓", {
                font: `bold ${buttonTextSize * 1.5}px Arial`,
                fill: "#00ff00",
                align: "center"
            }).setOrigin(0.5);

            categoryContainer.add([cardBorder, cardBg, categoryIcon, categoryName, categoryDesc, checkmark]);

            // Interaction
            cardBg.on('pointerover', () => {
                categoryContainer.setScale(1.05);
            });

            cardBg.on('pointerout', () => {
                categoryContainer.setScale(1);
            });

            cardBg.on('pointerdown', () => {
                const isSelected = this.selectedCategories.includes(category.name);
                if (isSelected && this.selectedCategories.length > 1) {
                    // Désélectionner (minimum 1 catégorie)
                    this.selectedCategories = this.selectedCategories.filter(c => c !== category.name);
                    checkmark.setVisible(false);
                    cardBg.setAlpha(0.5);
                } else if (!isSelected) {
                    // Sélectionner
                    this.selectedCategories.push(category.name);
                    checkmark.setVisible(true);
                    cardBg.setAlpha(0.9);
                }
            });

            this.categoryButtons.push({ container: categoryContainer, category, checkmark, cardBg });
        });

        // Sélection de la difficulté
        const difficultyY = height * 0.68;
        const difficultyTitle = this.add.text(width / 2, difficultyY, "🎯 Difficulté", {
            font: `bold ${buttonTextSize * 1.2}px Arial`,
            fill: "#ffffff",
            align: "center"
        }).setOrigin(0.5);

        const difficulties = [
            { name: "facile", color: 0x10b981, label: "FACILE" },
            { name: "moyen", color: 0xf59e0b, label: "MOYEN" },
            { name: "difficile", color: 0xef4444, label: "DIFFICILE" }
        ];

        this.difficultyButtons = [];
        const diffButtonWidth = width * 0.25;
        const diffButtonHeight = height * 0.06;
        const diffStartX = width / 2 - (difficulties.length * diffButtonWidth + (difficulties.length - 1) * 10) / 2 + diffButtonWidth / 2;

        difficulties.forEach((diff, index) => {
            const x = diffStartX + index * (diffButtonWidth + 10);
            const y = difficultyY + height * 0.06;

            const isSelected = this.selectedDifficulty === diff.name;
            
            const diffContainer = this.add.container(x, y);
            const diffBg = this.add.rectangle(0, 0, diffButtonWidth, diffButtonHeight, diff.color, isSelected ? 0.9 : 0.5)
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });

            const diffBorder = this.add.rectangle(0, 0, diffButtonWidth + 4, diffButtonHeight + 4, 
                isSelected ? 0xffffff : 0x666666, isSelected ? 0.8 : 0.3)
                .setOrigin(0.5);

            const diffText = this.add.text(0, 0, diff.label, {
                font: `bold ${buttonTextSize * 0.9}px Arial`,
                fill: "#ffffff",
                align: "center"
            }).setOrigin(0.5);

            diffContainer.add([diffBorder, diffBg, diffText]);

            diffBg.on('pointerdown', () => {
                this.selectedDifficulty = diff.name;
                this.updateDifficultyButtons();
            });

            this.difficultyButtons.push({ container: diffContainer, difficulty: diff, bg: diffBg, border: diffBorder });
        });

        // Boutons de navigation
        const buttonY = height * 0.88;
        
        // Bouton Retour
        const backButton = this.createButton(
            width * 0.25,
            buttonY,
            width * 0.3,
            height * 0.06,
            0x6b7280,
            0x9ca3af,
            "⬅️",
            "RETOUR",
            buttonTextSize,
            () => this.showMainMenu()
        );

        // Bouton Créer
        const createButton = this.createButton(
            width * 0.75,
            buttonY,
            width * 0.3,
            height * 0.06,
            0x10b981,
            0x34d399,
            "🚀",
            "CRÉER QUIZ",
            buttonTextSize,
            () => this.createGameWithOptions()
        );
    }

    updateDifficultyButtons() {
        this.difficultyButtons.forEach(({ difficulty, bg, border }) => {
            const isSelected = this.selectedDifficulty === difficulty.name;
            bg.setAlpha(isSelected ? 0.9 : 0.5);
            border.setAlpha(isSelected ? 0.8 : 0.3);
            border.setStrokeStyle(4, isSelected ? 0xffffff : 0x666666);
        });
    }

    createGameWithOptions() {
        if (this.selectedCategories.length === 0) {
            console.warn("Aucune catégorie sélectionnée");
            return;
        }

        const gameId = `quiz-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

        this.currentGame = {
            gameId,
            hostId: this.socket.id, // ← Utilise socket.id
            hostName: this.playerName,
            maxPlayers: 999,
            players: [{ id: this.socket.id, name: this.playerName, socketId: this.socket.id }], // ← Cohérence avec socket.id
            status: 'waiting',
            // Nouvelles options Trivial Pursuit
            gameMode: 'trivial-pursuit',
            categories: this.selectedCategories,
            difficulty: this.selectedDifficulty,
            totalQuestions: 10
        };
        this.isHost = true;

        console.log('[QuizLobby] Création quiz avec hostId:', this.socket.id);
        console.log('[QuizLobby] playerId utilisé pour la partie:', this.socket.id);

        this.socket.emit('quiz:createGame', {
            gameId,
            hostId: this.socket.id, // ← Utilise socket.id
            hostName: this.playerName,
            maxPlayers: 999,
            gameMode: 'trivial-pursuit',
            categories: this.selectedCategories,
            difficulty: this.selectedDifficulty,
            totalQuestions: 10
        });

        this.showWaitingRoom();
    }

    createButton(x, y, width, height, bgColor, borderColor, icon, text, textSize, onClick) {
        const buttonBg = this.add.rectangle(0, 0, width, height, bgColor, 0.9)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });
        
        const buttonBorder = this.add.rectangle(0, 0, width + 6, height + 6, borderColor, 0.5)
            .setOrigin(0.5);

        const buttonIcon = this.add.text(-width * 0.25, 0, icon, {
            font: `${textSize * 1.2}px Arial`,
            align: "center"
        }).setOrigin(0.5);

        const buttonText = this.add.text(width * 0.05, 0, text, {
            font: `bold ${textSize}px Arial`,
            fill: "#ffffff",
            align: "center",
            stroke: "#000000",
            strokeThickness: 1
        }).setOrigin(0.5);

        const buttonContainer = this.add.container(x, y);
        buttonContainer.add([buttonBorder, buttonBg, buttonIcon, buttonText]);

        buttonBg.on('pointerover', () => {
            buttonContainer.setScale(1.05);
        });
        
        buttonBg.on('pointerout', () => {
            buttonContainer.setScale(1);
        });

        buttonBg.on('pointerdown', () => {
            this.tweens.add({
                targets: buttonContainer,
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 100,
                yoyo: true,
                ease: 'Power2',
                onComplete: onClick
            });
        });

        return buttonContainer;
    }

    showWaitingRoom() {
        this.children.removeAll();
        this.currentView = 'waiting';
        
        const { width, height } = this.sys.game.canvas;
        const baseSize = Math.min(width, height);
        const titleSize = Math.min(baseSize * 0.07, 36);
        const playerNameSize = Math.min(baseSize * 0.045, 24);
        const buttonTextSize = Math.min(baseSize * 0.05, 28);

        // Fond avec dégradé
        this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e, 0.95);
        this.add.rectangle(width / 2, height / 2, width, height, 0x667eea, 0.1);

        // Titre avec icône
        const title = this.add.text(width / 2, height * 0.12, "⏳ Salle d'attente", {
            font: `bold ${titleSize}px Arial`,
            fill: "#ffffff",
            stroke: "#667eea",
            strokeThickness: 3,
            align: "center"
        }).setOrigin(0.5);

        // Compteur de joueurs avec design moderne
        const playerCount = this.currentGame ? this.currentGame.players.length : 0;
        const maxPlayers = this.currentGame ? this.currentGame.maxPlayers : 0;
        const displayMax = maxPlayers === 999 ? '∞' : maxPlayers;
        
        const counterContainer = this.add.container(width / 2, height * 0.22);
        const counterBg = this.add.rectangle(0, 0, width * 0.5, height * 0.08, 0x4f46e5, 0.8)
            .setOrigin(0.5);
        const counterBorder = this.add.rectangle(0, 0, width * 0.5 + 4, height * 0.08 + 4, 0x8b5cf6, 0.5)
            .setOrigin(0.5);
        
        const counterText = this.add.text(0, 0, `👥 ${playerCount}/${displayMax}`, {
            font: `bold ${titleSize * 0.8}px Arial`,
            fill: "#ffffff",
            align: "center"
        }).setOrigin(0.5);

        counterContainer.add([counterBorder, counterBg, counterText]);

        // Animation du compteur
        this.tweens.add({
            targets: counterContainer,
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Zone des joueurs avec scroll virtuel
        const playersZone = this.add.container(width / 2, height * 0.5);
        const playersZoneBg = this.add.rectangle(0, 0, width * 0.9, height * 0.4, 0x2d3748, 0.8)
            .setOrigin(0.5);
        const playersZoneBorder = this.add.rectangle(0, 0, width * 0.9 + 4, height * 0.4 + 4, 0x4a5568, 0.6)
            .setOrigin(0.5);
        
        playersZone.add([playersZoneBorder, playersZoneBg]);

        // Liste des joueurs avec style moderne
        if (this.currentGame && this.currentGame.players) {
            const maxVisiblePlayers = Math.floor(height * 0.35 / (playerNameSize * 2));
            const startY = -(Math.min(this.currentGame.players.length, maxVisiblePlayers) - 1) * (playerNameSize * 2) / 2;

            this.currentGame.players.forEach((player, index) => {
                if (index < maxVisiblePlayers) {
                    const y = startY + index * (playerNameSize * 2);
                    const isHost = player.id === this.currentGame.hostId;
                    
                    // Container pour chaque joueur
                    const playerContainer = this.add.container(0, y);
                    
                    // Fond du joueur
                    const playerBg = this.add.rectangle(0, 0, width * 0.8, playerNameSize * 1.8, 
                        isHost ? 0x10b981 : 0x6366f1, 0.7)
                        .setOrigin(0.5);
                    
                    // Icône du joueur
                    const playerIcon = this.add.text(-width * 0.35, 0, isHost ? "👑" : "👤", {
                        font: `${playerNameSize}px Arial`,
                        align: "center"
                    }).setOrigin(0.5);

                    // Nom du joueur
                    const playerText = this.add.text(-width * 0.25, 0, player.name, {
                        font: `bold ${playerNameSize}px Arial`, 
                        fill: "#ffffff",
                        align: "left"
                    }).setOrigin(0, 0.5);

                    // Statut
                    const statusText = this.add.text(width * 0.35, 0, 
                        isHost ? "Organisateur" : "Participant", {
                        font: `${playerNameSize * 0.8}px Arial`,
                        fill: isHost ? "#34d399" : "#a78bfa",
                        align: "right"
                    }).setOrigin(1, 0.5);

                    playerContainer.add([playerBg, playerIcon, playerText, statusText]);
                    playersZone.add(playerContainer);

                    // Animation d'apparition
                    playerContainer.setAlpha(0);
                    this.tweens.add({
                        targets: playerContainer,
                        alpha: 1,
                        delay: index * 100,
                        duration: 300,
                        ease: 'Power2'
                    });
                }
            });
        }

        // Zone des boutons
        const buttonY = height * 0.85;
        const buttonWidth = Math.min(width * 0.7, 300);
        const buttonHeight = Math.max(height * 0.08, 50);

        if (this.isHost) {
            // Bouton Lancer le quiz (organisateur)
            const canStart = this.currentGame && this.currentGame.players.length >= 2;
            const startContainer = this.add.container(width / 2, buttonY);
            
            const startBg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 
                canStart ? 0xff6b35 : 0x6b7280, canStart ? 0.9 : 0.5)
                .setOrigin(0.5);
            
            if (canStart) {
                startBg.setInteractive({ useHandCursor: true });
            }

            const startBorder = this.add.rectangle(0, 0, buttonWidth + 4, buttonHeight + 4, 
                canStart ? 0xff8c42 : 0x9ca3af, 0.5)
                .setOrigin(0.5);

            const startIcon = this.add.text(-buttonWidth * 0.25, 0, "🚀", {
                font: `${buttonTextSize}px Arial`,
                align: "center"
            }).setOrigin(0.5);

            const startText = this.add.text(buttonWidth * 0.05, 0, "LANCER LE QUIZ", {
                font: `bold ${buttonTextSize}px Arial`,
                fill: canStart ? "#ffffff" : "#9ca3af",
                align: "center"
            }).setOrigin(0.5);

            // Effets d'interaction AVANT d'ajouter au container (SANS setTint)
            if (canStart) {
                startBg.on('pointerover', () => {
                    startContainer.setScale(1.05);
                });
                
                startBg.on('pointerout', () => {
                    startContainer.setScale(1);
                });

                // Dans le clic du bouton "LANCER LE QUIZ" :
                startBg.on('pointerdown', () => {
                    console.log('[Quiz Lobby] Tentative de lancement du quiz', this.currentGame.gameId);
                    console.log('[Quiz Lobby] Nombre de joueurs:', this.currentGame.players.length);

                    this.tweens.add({
                        targets: startContainer,
                        scaleX: 0.95,
                        scaleY: 0.95,
                        duration: 100,
                        yoyo: true,
                        ease: 'Power2',
                        onComplete: () => {
                            console.log('[Quiz Lobby] Émission quiz:startGame');
                            this.socket.emit('quiz:startGame', { gameId: this.currentGame.gameId });
                        }
                    });
                });
            }

            // Ajouter au container APRÈS avoir défini les interactions
            startContainer.add([startBorder, startBg, startIcon, startText]);

            // Bouton Annuler pour l'organisateur
            const cancelButton = this.add.circle(
                width * 0.92, 
                height * 0.08, 
                Math.min(baseSize * 0.06, 40), 
                0xff4444, 
                0.9
            ).setInteractive({ useHandCursor: true });

            const cancelX = this.add.text(width * 0.92, height * 0.08, "✕", {
                font: `bold ${Math.min(baseSize * 0.08, 40)}px Arial`,
                fill: "#ffffff",
                align: "center"
            }).setOrigin(0.5);

            cancelButton.on('pointerdown', () => {
                this.socket.emit('quiz:cancelGame', { gameId: this.currentGame.gameId });
                this.currentGame = null;
                this.isHost = false;
                this.showMainMenu();
            });

        } else {
            // Bouton Quitter pour les joueurs
            const leaveContainer = this.add.container(width / 2, buttonY);
            
            const leaveBg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0xef4444, 0.9)
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });

            const leaveBorder = this.add.rectangle(0, 0, buttonWidth + 4, buttonHeight + 4, 0xf87171, 0.5)
                .setOrigin(0.5);

            const leaveIcon = this.add.text(-buttonWidth * 0.25, 0, "🚪", {
                font: `${buttonTextSize}px Arial`,
                align: "center"
            }).setOrigin(0.5);

            const leaveText = this.add.text(buttonWidth * 0.05, 0, "QUITTER LE QUIZ", {
                font: `bold ${buttonTextSize}px Arial`,
                fill: "#ffffff",
                align: "center"
            }).setOrigin(0.5);

            // Effets d'interaction AVANT d'ajouter au container (SANS setTint)
            leaveBg.on('pointerover', () => {
                leaveContainer.setScale(1.05);
            });
            
            leaveBg.on('pointerout', () => {
                leaveContainer.setScale(1);
            });

            leaveBg.on('pointerdown', () => {
                this.tweens.add({
                    targets: leaveContainer,
                    scaleX: 0.95,
                    scaleY: 0.95,
                    duration: 100,
                    yoyo: true,
                    ease: 'Power2',
                    onComplete: () => {
                        this.socket.emit('quiz:leaveGame', { gameId: this.currentGame.gameId });
                        this.currentGame = null;
                        this.isHost = false;
                        this.showMainMenu();
                    }
                });
            });

            // Ajouter au container APRÈS avoir défini les interactions
            leaveContainer.add([leaveBorder, leaveBg, leaveIcon, leaveText]);
        }
    }

    displayAvailableGames() {
        const { width, height } = this.sys.game.canvas;
        const baseSize = Math.min(width, height);
        const gameTextSize = Math.min(baseSize * 0.04, 20);
        
        if (!this.availableGames || this.availableGames.length === 0) {
            const emptyMessage = this.add.text(width / 2, height * 0.68, "🔍 Aucun quiz en attente", {
                font: `${gameTextSize * 1.2}px Arial`,
                fill: "#9ca3af",
                align: "center"
            }).setOrigin(0.5);

            // Animation subtile pour le message vide
            this.tweens.add({
                targets: emptyMessage,
                alpha: 0.5,
                duration: 2000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            return;
        }

        // Container pour les quiz disponibles
        const gamesContainer = this.add.container(width / 2, height * 0.72);

        // Afficher les quiz disponibles (max 4 pour éviter le débordement)
        const maxGames = Math.min(4, Math.floor((height * 0.2) / 60));
        const displayGames = this.availableGames.slice(0, maxGames);
        
        const gameHeight = Math.max(50, height * 0.06);
        const gameWidth = width * 0.85;
        const totalHeight = displayGames.length * (gameHeight + 8);
        const startY = -(totalHeight - gameHeight) / 2;

        displayGames.forEach((game, index) => {
            const y = startY + index * (gameHeight + 8);
            
            // Container pour chaque jeu
            const gameContainer = this.add.container(0, y);
            
            // Fond avec dégradé
            const gameBg = this.add.rectangle(0, 0, gameWidth, gameHeight, 0x4f46e5, 0.8)
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });
            
            const gameBorder = this.add.rectangle(0, 0, gameWidth + 4, gameHeight + 4, 0x8b5cf6, 0.4)
                .setOrigin(0.5);

            // Icône du quiz
            const gameIcon = this.add.text(-gameWidth * 0.4, 0, "🧠", {
                font: `${gameTextSize * 1.3}px Arial`,
                align: "center"
            }).setOrigin(0.5);

            // Nom de l'organisateur
            const hostText = this.add.text(-gameWidth * 0.25, -gameHeight * 0.2, game.hostName, {
                font: `bold ${gameTextSize}px Arial`,
                fill: "#ffffff",
                align: "left"
            }).setOrigin(0, 0.5);

            // Compteur de joueurs
            const playersText = this.add.text(-gameWidth * 0.25, gameHeight * 0.2, 
                `👥 ${game.players.length}/${game.maxPlayers === 999 ? '∞' : game.maxPlayers}`, {
                font: `${gameTextSize * 0.9}px Arial`,
                fill: "#a78bfa",
                align: "left"
            }).setOrigin(0, 0.5);

            // Statut
            const statusText = this.add.text(gameWidth * 0.35, 0, "REJOINDRE", {
                font: `bold ${gameTextSize * 0.9}px Arial`,
                fill: "#34d399",
                align: "center"
            }).setOrigin(0.5);

            // Effets d'interaction AVANT d'ajouter au container (SANS setTint)
            gameBg.on('pointerover', () => {
                gameContainer.setScale(1.02);
            });

            gameBg.on('pointerout', () => {
                gameContainer.setScale(1);
            });

            gameBg.on('pointerdown', () => {
                this.tweens.add({
                    targets: gameContainer,
                    scaleX: 0.98,
                    scaleY: 0.98,
                    duration: 100,
                    yoyo: true,
                    ease: 'Power2',
                    onComplete: () => {
                        this.joinGame(game.gameId);
                    }
                });
            });

            // Ajouter au container APRÈS avoir défini les interactions (UNE SEULE FOIS)
            gameContainer.add([gameBorder, gameBg, gameIcon, hostText, playersText, statusText]);
            gamesContainer.add(gameContainer);

            // Animation d'apparition
            gameContainer.setAlpha(0);
            gameContainer.setScale(0.8);
            this.tweens.add({
                targets: gameContainer,
                alpha: 1,
                scaleX: 1,
                scaleY: 1,
                delay: index * 150,
                duration: 300,
                ease: 'Back.easeOut'
            });
        });

        // Indicateur de scroll si plus de jeux disponibles
        if (this.availableGames.length > maxGames) {
            const moreIndicator = this.add.text(width / 2, height * 0.88, 
                `+${this.availableGames.length - maxGames} autres quiz...`, {
                font: `${gameTextSize * 0.8}px Arial`,
                fill: "#6b7280",
                align: "center"
            }).setOrigin(0.5);

            this.tweens.add({
                targets: moreIndicator,
                alpha: 0.5,
                duration: 1500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }

    joinGame(gameId) {
        this.socket.emit('quiz:joinGame', {
            gameId,
            playerId: this.playerId,
            playerName: this.playerName
        });
    }

    setupSocketEvents() {
        // Liste des quiz disponibles
        this.socket.on('quiz:gamesList', (games) => {
            this.availableGames = games;
            if (this.currentView === 'main') {
                this.showMainMenu();
            }
        });

        // Dans setupSocketEvents(), ajouter ces logs :
        this.socket.on('quiz:gameCreated', (gameData) => {
            console.log('[Quiz Lobby] Quiz créé:', gameData);
            console.log('[Quiz Lobby] Mon socket.id:', this.socket.id);
            console.log('[Quiz Lobby] Host ID du quiz:', gameData.hostId);
            this.currentGame = gameData;
            this.isHost = true;
            this.showWaitingRoom();
        });

        // Rejoindre un quiz avec succès
        this.socket.on('quiz:gameJoined', (gameData) => {
            this.currentGame = gameData;
            this.isHost = false;
            this.showWaitingRoom();
        });

        // Mise à jour de la salle d'attente
        this.socket.on('quiz:gameUpdated', (gameData) => {
            this.currentGame = gameData;
            if (this.currentView === 'waiting') {
                this.showWaitingRoom();
            }
        });

        // Erreur de connexion au quiz
        this.socket.on('quiz:joinError', (error) => {
            console.error('Erreur join quiz:', error);
            // Afficher un message d'erreur
            const { width, height } = this.sys.game.canvas;
            const errorText = this.add.text(width / 2, height * 0.9, error.message || "Erreur", {
                font: "16px Arial", fill: "#ff0000"
            }).setOrigin(0.5);
            
            // Supprimer le message après 3 secondes
            this.time.delayedCall(3000, () => {
                if (errorText) errorText.destroy();
            });
        });

        // Le quiz commence
        this.socket.on('quiz:gameStarted', (gameData) => {
            console.log('=== DEBUG QUIZ START ===');
            console.log('gameData reçu:', gameData);
            console.log('gameData.gameData:', gameData.gameData);
            console.log('gameData.gameMode:', gameData.gameMode);
            console.log('========================');
            
            MusicManager.stop();
            this.scene.start("QuizGameScene", {
                gameId: gameData.gameId,
                playerId: this.isHost ? this.socket.id : this.playerId, // ← CORRECTION : utiliser socket.id pour l'organisateur
                playerName: this.playerName,
                isHost: this.isHost,
                gameData: gameData.gameData || gameData // Passer les bonnes données
            });
        });

        // Erreur lors du lancement du quiz
        this.socket.on('quiz:startError', (error) => {
            console.error('Erreur lancement quiz:', error);
            const { width, height } = this.sys.game.canvas;
            const errorText = this.add.text(width / 2, height * 0.9, error.message || "Erreur de lancement", {
                font: "16px Arial", fill: "#ff0000", backgroundColor: "#000000", padding: { x: 10, y: 5 }
            }).setOrigin(0.5);

            this.time.delayedCall(3000, () => {
                if (errorText) errorText.destroy();
            });
        });

        // Le quiz a été annulé
        this.socket.on('quiz:gameCancelled', () => {
            this.currentGame = null;
            this.isHost = false;
            this.showMainMenu();
        });
    }

    // Nettoyage lors de la destruction de la scène
    destroy() {
        // Retirer les event listeners
        if (this.socket) {
            this.socket.off('quiz:gamesList');
            this.socket.off('quiz:gameCreated');
            this.socket.off('quiz:gameJoined');
            this.socket.off('quiz:gameUpdated');
            this.socket.off('quiz:joinError');
            this.socket.off('quiz:gameStarted');
            this.socket.off('quiz:gameCancelled');
        }
        super.destroy();
    }
}