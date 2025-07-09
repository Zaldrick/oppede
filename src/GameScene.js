import Phaser from "phaser";
import io from 'socket.io-client';
import PlayerService from './services/PlayerService';
import MusicManager from './MusicManager';

// Import des managers
import { PlayerManager } from './managers/PlayerManager';
import { RemotePlayerManager } from './managers/RemotePlayerManager';
import { MapManager } from './managers/MapManager';
import { SocketManager } from './managers/SocketManager';
import { UIManager } from './managers/UIManager';

export class GameScene extends Phaser.Scene {
    constructor() {
        super("GameScene");
        this.inventory = [];

        // Initialisation des managers
        this.playerManager = null;
        this.remotePlayerManager = null;
        this.mapManager = null;
        this.socketManager = null;
        this.uiManager = null;

        // Variables d'état conservées de l'original
        this.cursors = null;
        this.myId = null;
        this.positionUpdateInterval = null;
        this.currentPseudo = null;
        this.playerPosition = null;
        this.preloadPromise = null;
    }

    async preload() {
        this.loadAssets();
        this.cursors = this.input.keyboard.createCursorKeys();

        const playerPseudo = this.registry.get("playerPseudo");
        if (playerPseudo) {
            const appearancePath = `/assets/apparences/${playerPseudo}.png`;
            this.load.spritesheet("playerAppearance", appearancePath, {
                frameWidth: 48,
                frameHeight: 48,
            });
        } else {
            console.error("Player pseudo is not defined in the registry!");
        }

        this.preloadPromise = new Promise(async (resolve, reject) => {
            try {
                const playerData = await PlayerService.fetchPlayerData(playerPseudo);
                this.registry.set("playerData", playerData);

                this.playerPosition = { x: playerData.posX || 0, y: playerData.posY || 0 };

                const inventory = await PlayerService.fetchInventory(playerData._id);
                this.inventory = inventory;

                const appearancePath = `/assets/apparences/${playerPseudo}.png`;
                this.load.spritesheet("playerAppearance", appearancePath, {
                    frameWidth: 48,
                    frameHeight: 48,
                });

                this.load.once('complete', resolve);
                this.load.start();
            } catch (error) {
                console.error("Error fetching player or inventory data:", error);
                reject(error);
            }
        });
    }

    resume() {
        if (!MusicManager.isPlaying('gameMusic')) {
            MusicManager.play(this, 'gameMusic', { loop: true, volume: 0.5 });
        }
    }

    async create() {
        this.game.events.emit("scene-switch", "GameScene");
        this.cameras.main.fadeIn(1000, 0, 0, 0);

        const chatElement = document.getElementById("chat");
        const inputElement = document.getElementById("input");
        if (chatElement) chatElement.style.display = "block";
        if (inputElement) chatElement.style.display = "block";

        try {
            await this.preloadPromise;
            this.initializeManagers();
            await this.setupGame();
        } catch (error) {
            console.error("Error during preload. Aborting game initialization.");
            return;
        }

        // Gestion du clic pour récupérer les coordonnées de la tuile
        this.input.on('pointerdown', function (pointer) {
            let worldPoint = pointer.positionToCamera(this.cameras.main);
            let tileX = Math.floor(worldPoint.x / 48);
            let tileY = Math.floor(worldPoint.y / 48);
            let centerX = (tileX * 48) + 24;
            let centerY = (tileY * 48) + 24;
            console.log(`Tuile cliquée : x=${tileX}, y=${tileY}`);
            console.log(`Centre de la tuile : x=${centerX}, y=${centerY}`);
        }, this);
    }

    initializeManagers() {
        this.playerManager = new PlayerManager(this);
        this.remotePlayerManager = new RemotePlayerManager(this);
        this.mapManager = new MapManager(this);
        this.socketManager = new SocketManager(this);
        this.uiManager = new UIManager(this);
    }

    async setupGame() {
        const playerData = this.registry.get("playerData");
        if (!playerData) {
            console.error("Player data is not defined in the registry! Aborting game initialization.");
            return;
        }

        // Diagnostic des cartes
        this.mapManager.compareTilemaps();

        // Configuration du joueur
        this.playerManager.setPlayerPosition(this.playerPosition);
        await this.playerManager.createPlayer(playerData, "playerAppearance", this.playerPosition);

        // Configuration du monde
        this.mapManager.setupWorld(playerData);

        // Configuration des joueurs distants
        this.remotePlayerManager.initialize(this.playerManager);

        // Configuration de l'interface
        this.uiManager.setupCamera();
        this.uiManager.setupControls();
        this.uiManager.createUI();

        // Configuration du socket
        this.socketManager.initialize();
        this.myId = this.socketManager.getMyId();

        // Chargement des joueurs
        await this.loadPlayers();

        // Mise à jour périodique de la position
        this.positionUpdateInterval = setInterval(() => this.updatePlayer(), 2000);
    }

    update() {
        if (!this.playerManager?.getPlayer() || !this.cursors) {
            return;
        }

        // Gestion du mouvement du joueur
        this.playerManager.handleMovement(
            this.cursors,
            this.uiManager?.getJoystick(),
            this.socketManager?.getSocket(),
            this.myId
        );

        // Mise à jour des joueurs distants
        this.remotePlayerManager.updateRemotePlayers();

        // Envoi de la position
        this.playerManager.sendMovementUpdate(this.socketManager?.getSocket(), this.myId);
    }

    loadAssets() {
        this.load.audio("teleportSound", "/assets/sounds/tp.mp3");
        this.load.audio("music1", "/assets/musics/music1.mp3");
        this.load.image("background", "/assets/interieur.png");
        this.load.image("backgroundext", "/assets/maps/exterieur.png");
        this.load.image("backgroundoppede", "/assets/maps/oppede.png");
        this.load.spritesheet("player", "/assets/apparences/Mehdi.png", {
            frameWidth: 48,
            frameHeight: 48,
        });
        this.load.spritesheet('!Chest', '/assets/maps/!Chest.png', { frameWidth: 48, frameHeight: 48 });
        this.load.tilemapTiledJSON("map", "/assets/maps/map.tmj");
        this.load.tilemapTiledJSON("map2", "/assets/maps/exterieur.tmj");
        this.load.tilemapTiledJSON("map3", "/assets/maps/oppede.tmj");

        // Événements de diagnostic
        this.load.on('filecomplete-tilemapJSON-map3', (key, type, data) => {
            console.log('=== DIAGNOSTIC OPPEDE.TMJ ===');
            console.log('Fichier chargé:', key);
            console.log('Structure complète:', data);

            console.log('Tilesets:', data.tilesets);
            console.log('Layers:', data.layers);

            if (data.tilesets) {
                data.tilesets.forEach((tileset, index) => {
                    console.log(`Tileset ${index}:`, tileset);
                    console.log(`- Source: ${tileset.source || 'embedded'}`);
                    console.log(`- Name: ${tileset.name}`);
                    console.log(`- Tiles: ${tileset.tiles ? tileset.tiles.length : 'none'}`);
                });
            }

            if (data.layers) {
                data.layers.forEach((layer, index) => {
                    console.log(`Layer ${index}:`, layer.name, layer.type);
                    if (layer.data) {
                        console.log(`- Data length: ${layer.data.length}`);
                        console.log(`- First few tiles: ${layer.data.slice(0, 10)}`);
                    }
                });
            }
        });

        this.load.on('loaderror', (file) => {
            if (file.key === 'map3') {
                console.error('=== ERREUR CHARGEMENT MAP ===');
                console.error('Fichier:', file);
                console.error('URL:', file.url);
            }
        });

        this.load.image("Inside_B", "/assets/maps/Inside_B.png");
        this.load.plugin('rexvirtualjoystickplugin', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js', true);
    }

    async loadPlayers() {
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/players`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const players = await response.json();

            players.forEach(player => {
                const option = document.createElement('option');
                option.value = player.pseudo;
                option.textContent = player.pseudo;
            });
        } catch (error) {
            console.error('Error loading players:', error);
        }
    }

    displayMessage(text) {
        const gameWidth = this.scale.width;
        const gameHeight = this.scale.height;

        const style = {
            font: `${gameWidth * 0.05}px Arial`,
            fill: "#ffffff",
            backgroundColor: "#000000",
            padding: { x: 20, y: 10 },
            align: "center"
        };

        const messageText = this.add.text(gameWidth * 0.5, gameHeight * 0.1, text, style)
            .setOrigin(0.5)
            .setScrollFactor(0);

        this.time.delayedCall(3000, () => {
            messageText.destroy();
        });
    }

    selectPlayer() {
        const selectedPlayer = document.getElementById('player-dropdown').value;
        console.log('Joueur sélectionné :', selectedPlayer);
    }

    async updatePlayer() {
        await this.playerManager?.updatePositionInDB();
    }

    shutdown() {
        if (this.positionUpdateInterval) {
            clearInterval(this.positionUpdateInterval);
        }
    }

    addItemToInventory(item) {
        PlayerService.addItemToInventory(item);
        console.log("Updated inventory:", PlayerService.getInventory());
    }

    removeItemFromInventory(itemName, quantity) {
        PlayerService.removeItemFromInventory(itemName, quantity);
        console.log("Updated inventory:", PlayerService.getInventory());
    }

    resetApplication() {
        // Détruit le joueur local
        this.playerManager?.destroy();

        // Détruit les joueurs distants
        this.remotePlayerManager?.destroy();

        // Arrête la musique en cours
        if (this.currentMusic) {
            this.currentMusic.stop();
        }

        // Détruit les managers
        this.mapManager?.destroy();
        this.socketManager?.destroy();
        this.uiManager?.destroy();

        // Réinitialise les autres états
        this.myId = null;
    }

    returnToLobby() {
        // Nettoie les événements socket
        this.socketManager?.destroy();

        // Arrête la musique
        MusicManager.stop();

        // Retourne au lobby de quiz
        this.scene.start("QuizLobbyScene", {
            playerId: this.playerId,
            playerName: this.playerName
        });
    }

    generateGameId() {
        return `quiz-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }
}