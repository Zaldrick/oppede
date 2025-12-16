import Phaser from "phaser";
import PlayerService from './services/PlayerService';
import MusicManager from './MusicManager';
import SoundManager from './utils/SoundManager';

// Import des managers
import { PlayerManager } from './managers/PlayerManager';
import { RemotePlayerManager } from './managers/RemotePlayerManager';
import { MapManager } from './managers/MapManager';
import { SocketManager } from './managers/SocketManager';
import { UIManager } from './managers/UIManager';
import { ShopManager } from './managers/ShopManager';
// ✅ NOUVEAUX IMPORTS - Menus Triple Triad
// Note: socket.io-client usage is handled by backend; avoid client import here to fix linter

export class GameScene extends Phaser.Scene {
    constructor() {
        super("GameScene");
        this.inventory = [];

        // Dialogue queue (évite d'écraser une boîte de dialogue par une autre)
        this.dialogueQueue = [];

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
                frameHeight: 96,
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
        MusicManager.resume();
    }

    async create() {
        this.game.events.emit("scene-switch", "GameScene");

        // Status overlay (useful on mobile prod where console is hard to access).
        // Keep it lightweight and always on top.
        const debugOverlayEnabled = (() => {
            try {
                return new URLSearchParams(window.location.search).get('debug') === '1';
            } catch (e) {
                return false;
            }
        })();

        const setStatus = (msg) => {
            try {
                if (!this.__statusText) {
                    this.__statusText = this.add.text(8, 8, '', {
                        fontFamily: 'Arial',
                        fontSize: '14px',
                        color: '#ffffff',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        padding: { x: 6, y: 4 },
                    }).setScrollFactor(0).setDepth(999999).setVisible(false);
                }
                this.__statusText.setText(String(msg || ''));
                if (debugOverlayEnabled) this.__statusText.setVisible(true);

                // Also surface status to the DOM (React overlay) for cases where the canvas is black.
                try {
                    if (typeof window !== 'undefined') {
                        window.__phaserStatus = String(msg || '');
                        window.dispatchEvent(new Event('phaser-status'));
                    }
                } catch (e) {}
            } catch (e) {
                // ignore
            }
        };

        // Allow other methods (setupGame, MapManager callbacks, etc.) to update status.
        this.__setStatus = setStatus;

        setStatus('GameScene: init…');

        // Catch async errors that would otherwise just produce a black canvas.
        try {
            if (!this.__unhandledRejectionHandler) {
                this.__unhandledRejectionHandler = (event) => {
                    const reason = event?.reason;
                    console.error('[GameScene] Unhandled promise rejection:', reason);
                    const stack = reason?.stack ? String(reason.stack) : '';
                    const details = stack ? `\n${stack}` : '';
                    setStatus(`Erreur (promise): ${reason?.message || String(reason)}${details}`);
                    try { this.__statusText?.setVisible(true); } catch (e) {}
                };
                window.addEventListener('unhandledrejection', this.__unhandledRejectionHandler);
            }

            if (!this.__windowErrorHandler) {
                this.__windowErrorHandler = (event) => {
                    const msg = event?.message || event?.error?.message || 'Erreur JS';
                    const file = event?.filename ? String(event.filename) : '';
                    const line = typeof event?.lineno === 'number' ? event.lineno : '';
                    const col = typeof event?.colno === 'number' ? event.colno : '';
                    const where = file ? `\n${file}${line ? `:${line}` : ''}${col ? `:${col}` : ''}` : '';
                    const stack = event?.error?.stack ? `\n${String(event.error.stack)}` : '';
                    setStatus(`Erreur (window): ${msg}${where}${stack}`);
                    try { this.__statusText?.setVisible(true); } catch (e) {}
                };
                window.addEventListener('error', this.__windowErrorHandler);
            }
        } catch (e) {}
        
        // DEBUG: Log click coordinates
        this.input.on('pointerdown', (pointer) => {
            const worldX = pointer.worldX;
            const worldY = pointer.worldY;
            const tileX = Math.floor(worldX / 48);
            const tileY = Math.floor(worldY / 48);
            console.log(`DEBUG CLICK - World: (${Math.round(worldX)}, ${Math.round(worldY)}) | Tile: ${tileX}:${tileY}`);
        });

        this.cameras.main.fadeIn(1000, 0, 0, 0);

        const chatElement = document.getElementById("chat");
        const inputElement = document.getElementById("input");
        if (chatElement) chatElement.style.display = "block";
        if (inputElement) chatElement.style.display = "block";

        try {
            setStatus('GameScene: chargement données…');
            await this.preloadPromise;
            setStatus('GameScene: init managers…');
            this.initializeManagers();
            setStatus('GameScene: setup jeu / map…');
            await this.setupGame();
            setStatus('GameScene: ok');

            // Hide overlay in normal mode.
            if (!debugOverlayEnabled) {
                try { this.__statusText?.setVisible(false); } catch (e) {}
            } else {
                // In debug mode, leave it briefly then hide.
                try {
                    this.time.delayedCall(1200, () => {
                        try { this.__statusText?.setVisible(false); } catch (e) {}
                    });
                } catch (e) {}
            }
        } catch (error) {
            console.error("Error during preload. Aborting game initialization.");
            setStatus(`Erreur init: ${error?.message || String(error)}`);
            try { this.__statusText?.setVisible(true); } catch (e) {}
            return;
        }
        this.game.events.on('inventory:cacheUpdated', (newInventory) => {
            this.inventory = [...newInventory];
            console.log('[GameScene] Cache inventaire mis à jour:', this.inventory.length, 'items');
        });

        // Local SFX manager
        try {
            this.soundManager = new SoundManager(this);
            // MusicManager.play(this, 'music1', { loop: true, volume: 0.5 });
        } catch (e) {
            this.soundManager = null;
        }
        try {
            if (typeof window !== 'undefined' && this.soundManager) {
                window.debugPlayCry = async (id) => {
                    try { console.log('[GameScene] debugPlayCry called', id); const res = await this.soundManager.playPokemonCry(id); console.log('[GameScene] debugPlayCry result', res); } catch (e) { console.warn('[GameScene] debugPlayCry error', e); }
                };
            }
        } catch (e) {}
        this.scorePollingInterval = setInterval(async () => {
            const playerPseudo = this.registry.get("playerPseudo");
            if (playerPseudo) {
                const previousPlayerData = this.registry.get("playerData");
                const refreshedPlayerData = await PlayerService.fetchPlayerData(playerPseudo);

                // IMPORTANT: ne pas écraser l'état de quêtes local (utilisé par MapEventManager)
                // fetchPlayerData ne renvoie pas toujours les quêtes, donc on conserve celles déjà synchronisées.
                const mergedPlayerData = { ...previousPlayerData, ...refreshedPlayerData };
                if (previousPlayerData?.quests && (!mergedPlayerData.quests || Object.keys(mergedPlayerData.quests).length === 0)) {
                    mergedPlayerData.quests = previousPlayerData.quests;
                }

                this.registry.set("playerData", mergedPlayerData);
                // Ici tu peux aussi rafraîchir l'affichage du score si besoin
            }
        }, 5000); // toutes les 5 secondes
        this.events.on('shutdown', () => {
            clearInterval(this.scorePollingInterval);
            try { if (typeof window !== 'undefined' && window.debugPlayCry) delete window.debugPlayCry; } catch (e) {}
            try {
                if (this.__unhandledRejectionHandler) {
                    window.removeEventListener('unhandledrejection', this.__unhandledRejectionHandler);
                    this.__unhandledRejectionHandler = null;
                }
                if (this.__windowErrorHandler) {
                    window.removeEventListener('error', this.__windowErrorHandler);
                    this.__windowErrorHandler = null;
                }
            } catch (e) {}
        });
    }

    initializeManagers() {
        this.playerManager = new PlayerManager(this);
        this.remotePlayerManager = new RemotePlayerManager(this);
        this.mapManager = new MapManager(this);
        this.socketManager = new SocketManager(this);
        this.uiManager = new UIManager(this);
        this.shopManager = new ShopManager(this); // ← AJOUT
    }

    async setupGame() {
        const setStatus = (msg) => {
            try {
                if (typeof this.__setStatus === 'function') this.__setStatus(msg);
            } catch (e) {}
        };

        const getApiBaseUrl = () => {
            const apiUrl = process.env.REACT_APP_API_URL;
            if (apiUrl && apiUrl !== 'undefined' && apiUrl !== 'null') return apiUrl;
            // Safe fallback: same-origin API (useful in prod deployments behind one domain).
            try {
                return window.location.origin;
            } catch (e) {
                return '';
            }
        };

        const fetchWithTimeout = async (url, options = {}, timeoutMs = 7000) => {
            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const id = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
            try {
                return await fetch(url, { ...options, signal: controller ? controller.signal : undefined });
            } finally {
                if (id) clearTimeout(id);
            }
        };

        const playerData = this.registry.get("playerData");
        if (!playerData) {
            console.error("Player data is not defined in the registry! Aborting game initialization.");
            return;
        }

        // Charger les quêtes du joueur pour synchroniser l'état local.
        // IMPORTANT: ne doit jamais bloquer l'initialisation du jeu (sinon écran noir sur mobile).
        const apiUrl = getApiBaseUrl();
        (async () => {
            try {
                setStatus('GameScene: sync quêtes…');
                const questsRes = await fetchWithTimeout(`${apiUrl}/api/quests/${playerData._id}`, {}, 2500);
                if (!questsRes.ok) return;
                const questsData = await questsRes.json();
                // Convertir en format { "QuestId": stepIndex } pour MapEventManager
                playerData.quests = {};
                questsData.forEach(q => {
                    playerData.quests[q.questId] = q.stepIndex;
                });
                this.registry.set("playerData", playerData);
                console.log("[GameScene] Quêtes synchronisées :", playerData.quests);
            } catch (e) {
                console.warn("[GameScene] Sync quêtes ignorée:", e);
            }
        })();

        // Diagnostic des cartes (opt-in uniquement). Sur Android, des logs volumineux peuvent freezer.
        try {
            const debugMaps = (() => {
                try {
                    return new URLSearchParams(window.location.search).get('debugMaps') === '1';
                } catch (e) {
                    return false;
                }
            })();

            if (debugMaps) {
                setStatus('GameScene: diagnostic maps…');
                // Run async to avoid blocking the render loop.
                setTimeout(() => {
                    try { this.mapManager.compareTilemaps(); } catch (e) {
                        console.warn('[GameScene] compareTilemaps failed:', e);
                    }
                }, 0);
            }
        } catch (e) {
            // ignore
        }

        // Configuration du joueur
        setStatus('GameScene: création joueur…');
        this.playerManager.setPlayerPosition(this.playerPosition);
        await this.playerManager.createPlayer(playerData, "playerAppearance", this.playerPosition);

        // Configuration du monde
        setStatus('GameScene: chargement map…');
        this.mapManager.setupWorld(playerData);

        // Configuration des joueurs distants
        setStatus('GameScene: joueurs distants…');
        this.remotePlayerManager.initialize(this.playerManager);

        // Configuration de l'interface
        setStatus('GameScene: UI…');
        this.uiManager.setupCamera();
        this.uiManager.setupControls();
        this.uiManager.createUI();

        // Configuration du socket
        setStatus('GameScene: socket…');
        this.socketManager.initialize();
        this.myId = this.socketManager.getMyId();

        // Chargement des joueurs (optionnel, non bloquant)
        setStatus('GameScene: chargement joueurs…');
        try { this.loadPlayers(); } catch (e) {}

        // Mise à jour périodique de la position
        setStatus('GameScene: fin init…');
        this.positionUpdateInterval = setInterval(() => this.updatePlayer(), 2000);
    }

    update() {
        if (!this.playerManager?.getPlayer()?.body || !this.cursors) {
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

        // --- GESTION DE LA PROFONDEUR (Z-INDEX) ---
        
        // 1. Le joueur local
        const player = this.playerManager.getPlayer();
        if (player) {
            player.setDepth(player.y);
        }

        // 2. Les joueurs distants (Sprite + Pseudo)
        if (this.remotePlayerManager?.otherPlayers) {
            Object.values(this.remotePlayerManager.otherPlayers).forEach(remoteObj => {
                if (remoteObj.sprite) {
                    remoteObj.sprite.setDepth(remoteObj.sprite.y);
                    // Le pseudo doit être au-dessus du sprite
                    if (remoteObj.pseudoText) {
                        remoteObj.pseudoText.setDepth(remoteObj.sprite.y + 1); 
                    }
                }
            });
        }

        // 3. Les PNJs et objets interactifs
        if (this.mapManager?.eventManager?.activeEvents) {
            this.mapManager.eventManager.activeEvents.forEach(entity => {
                if (entity && entity.active) {
                    entity.setDepth(entity.y);
                    // Si le PNJ a une bulle de dialogue ou un texte associé
                    if (entity.bubble) {
                        entity.bubble.setDepth(entity.y + 100); // Toujours bien visible
                    }
                }
            });
        }
        // Envoi de la position
        this.playerManager.sendMovementUpdate(this.socketManager?.getSocket(), this.myId);
    }

    loadAssets() {
        this.load.audio("teleportSound", "/assets/sounds/tp.ogg?v=2");
        this.load.audio("metro_open", "/assets/sounds/metro_open.mp3");
        this.load.audio("metro_close", "/assets/sounds/metro_close.mp3");
        this.load.audio("car_start", "/assets/sounds/car_start.mp3");
        this.load.audio("music1", "/assets/musics/music1.mp3");
        this.load.audio("qwest", "/assets/musics/qwest.mp3");
        // Preload battle music
        this.load.audio("battle-wild", "/assets/musics/pkm/battle-wild.mp3");
        this.load.audio("battle-trainer", "/assets/musics/pkm/battle-trainer.mp3");
        this.load.audio("victory-wild", "/assets/musics/pkm/victory-wild.mp3");
        // Preload item sounds
        this.load.audio("item_get", "/assets/sounds/Item_Get.wav?v=1");
        this.load.audio("keyitem_get", "/assets/sounds/KeyItem_Get.wav?v=1");
        this.load.image("qwest", "/assets/qwest.png");
        this.load.image("defaut", "/assets/defaut.png");
        this.load.image("defaut", "/assets/marin.png");
        this.load.image("backgroundext", "/assets/maps/exterieur.png");
        this.load.image("backgroundoppede", "/assets/maps/oppede.png");
        // Utilisation de Marin.png pour le nouveau système d'animation (48x96)
        this.load.spritesheet("player", "/assets/apparences/Marin.png", {
            frameWidth: 48,
            frameHeight: 96,
        });

        this.load.spritesheet("ralof", "/assets/apparences/Ralof.png", {
            frameWidth: 48,
            frameHeight: 96,
        });

        this.load.spritesheet("subway_door", "/assets/sprites/Subway_Train_1_Door_1_See_Through_48x48.png", {
            frameWidth: 96,
            frameHeight: 96,
        });

        this.load.spritesheet("marchand", "/assets/apparences/marchand.png", {
            frameWidth: 48,
            frameHeight: 48,
        });

        this.load.spritesheet("sparkles", "/assets/sprites/sparkles.png", {
            frameWidth: 48,
            frameHeight: 48,
        });

        this.load.spritesheet("coffre", "/assets/sprites/coffre.png", {
            frameWidth: 48,
            frameHeight: 48,
        });

        // Chargement des PNJs d'ambiance
        const npcSprites = [
            "Adam_idle_anim_48x48.png", "Alex_idle_anim_48x48.png", "Amelia_idle_anim_48x48.png", 
            "Ash_idle_anim_48x48.png", "Bob_idle_anim_48x48.png", "Bouncer_idle_anim_48x48.png", 
            "Bruce_idle_anim_48x48.png", "Dan_idle_anim_48x48.png", "Edward_idle_anim_48x48.png", 
            "Fishmonger_1_idle_anim_48x48.png", "Kid_Abby_idle_anim_48x48.png", "Kid_Karen_idle_anim_48x48.png", 
            "Kid_Mitty_idle_anim_48x48.png", "kid_Oscar_idle_anim_48x48.png", "Kid_Romeo_idle_anim_48x48.png", 
            "Kid_Tim_idle_anim_48x48.png", "Lucy_idle_anim_48x48.png", "Molly_idle_anim_48x48.png", 
            "Old_man_Josh_idle_anim_48x48.png", "Old_woman_Jenny_idle_anim_48x48.png", "Pier_idle_anim_48x48.png", 
            "Rob_idle_anim_48x48.png", "Roki_idle_anim_48x48.png", "Samuel_idle_anim_48x48.png"
        ];

        npcSprites.forEach(filename => {
            const key = filename.replace("_idle_anim_48x48.png", "").toLowerCase();
            this.load.spritesheet(`npc_${key}`, `/assets/sprites/${filename}`, {
                frameWidth: 48,
                frameHeight: 96
            });
        });

        this.load.spritesheet('!Chest', '/assets/maps/!Chest.png', { frameWidth: 48, frameHeight: 48 });
        this.load.tilemapTiledJSON("map", "/assets/maps/map.tmj");
        this.load.tilemapTiledJSON("map2", "/assets/maps/exterieur.tmj");
        this.load.tilemapTiledJSON("map3", "/assets/maps/oppede.tmj");
        this.load.tilemapTiledJSON("qwest", "/assets/maps/qwest.tmj");
        this.load.tilemapTiledJSON("lille", "/assets/maps/Lille.tmj");
        this.load.tilemapTiledJSON("metro", "/assets/maps/metro.tmj");
        this.load.tilemapTiledJSON("metroInterieur", "/assets/maps/metroInterieur.tmj");
        this.load.tilemapTiledJSON("douai", "/assets/maps/douai.tmj");
        this.load.tilemapTiledJSON("marin", "/assets/maps/marin.tmj");
        this.load.spritesheet("Room_Builder_48x48", "/assets/maps/Room_Builder_48x48.png", {
            frameWidth: 48,
            frameHeight: 48
        });

        // Load Modern Exteriors Tilesets
        this.load.image("1_Terrains_and_Fences_48x48", "/assets/maps/1_Terrains_and_Fences_48x48.png");
        this.load.image("2_City_Terrains_48x48", "/assets/maps/2_City_Terrains_48x48.png");
        this.load.image("3_City_Props_48x48", "/assets/maps/3_City_Props_48x48.png");
        this.load.image("4_Generic_Buildings_48x48", "/assets/maps/4_Generic_Buildings_48x48.png");
        this.load.image("5_Floor_Modular_Buildings_48x48", "/assets/maps/5_Floor_Modular_Buildings_48x48.png");
        this.load.image("6_Garage_Sales_48x48", "/assets/maps/6_Garage_Sales_48x48.png");
        this.load.image("8_Worksite_48x48", "/assets/maps/8_Worksite_48x48.png");
        this.load.image("9_Shopping_Center_and_Markets_48x48", "/assets/maps/9_Shopping_Center_and_Markets_48x48.png");
        this.load.image("10_Vehicles_48x48", "/assets/maps/10_Vehicles_48x48.png");
        this.load.image("13_School_48x48", "/assets/maps/13_School_48x48.png");
        this.load.image("1_Generic_48x48", "/assets/maps/1_Generic_48x48.png");
        this.load.image("2_LivingRoom_48x48", "/assets/maps/2_LivingRoom_48x48.png");
        this.load.image("3_Bathroom_48x48", "/assets/maps/3_Bathroom_48x48.png");
        this.load.image("4_Bedroom_48x48", "/assets/maps/4_Bedroom_48x48.png");
        this.load.image("5_Classroom_and_library_48x48", "/assets/maps/5_Classroom_and_library_48x48.png");
        this.load.image("6_Music_and_sport_48x48", "/assets/maps/6_Music_and_sport_48x48.png");
        this.load.image("7_Art_48x48", "/assets/maps/7_Art_48x48.png");
        this.load.image("12_Kitchen_48x48", "/assets/maps/12_Kitchen_48x48.png");
        this.load.image("14_Basement_48x48", "/assets/maps/14_Basement_48x48.png");
        this.load.image("15_Christmas_48x48", "/assets/maps/15_Christmas_48x48.png");
        this.load.image("17_Visibile_Upstairs_System_48x48", "/assets/maps/17_Visibile_Upstairs_System_48x48.png");
        this.load.image("21_Clothing_Store_48x48", "/assets/maps/21_Clothing_Store_48x48.png");
        this.load.image("23_Television_and_Film_Studio_48x48", "/assets/maps/23_Television_and_Film_Studio_48x48.png");
        this.load.image("5_Classroom_and_library_48x48", "/assets/maps/5_Classroom_and_library_48x48.png");
        this.load.image("19_Hospital_48x48", "/assets/maps/19_Hospital_48x48.png");
        this.load.image("18_Jail_48x48", "/assets/maps/18_Jail_48x48.png");
        this.load.image("20_Subway_and_Train_Station_48x48", "/assets/maps/20_Subway_and_Train_Station_48x48.png");
        this.load.image("collision", "/assets/maps/collision.png");
        
        // Load split tilesets for mobile compatibility
        for (let i = 0; i <= 10; i++) {
            // These are tileset images referenced by Tiled (.tmj). They must be loaded as images (not spritesheets).
            this.load.image(`Interiors_48x48_part_${i}`, `/assets/maps/Interiors_48x48_part_${i}.png`);
        }

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

    displayMessage(text, speakerName = null, onComplete = null) {
        // Si une boîte est déjà affichée, on enfile le message pour l'afficher ensuite
        if (this.currentDialogueBox) {
            this.dialogueQueue.push({ text, speakerName, onComplete });
            return;
        }

        // Nettoie l'ancienne boîte de dialogue si elle existe
        if (this.currentDialogueBox) {
            this.currentDialogueBox.destroy();
            this.currentDialogueBox = null;
        }

        // Bloque le joueur via UIManager
        if (this.uiManager) {
            this.uiManager.isDialogueActive = true;
        }
        // Stop le mouvement immédiatement
        if (this.playerManager && this.playerManager.player) {
            this.playerManager.player.setVelocity(0);
            this.playerManager.player.anims.stop();
        }

        const { width, height } = this.scale;
        const cameraZoom = (this.cameras && this.cameras.main && this.cameras.main.zoom) ? this.cameras.main.zoom : 1;
        const viewWidth = width ;
        const viewHeight = height / cameraZoom;
        const padding = 20 / cameraZoom;
        
        // Dimensions responsives
        const isLandscape = width > height;
        // All UI geometry is expressed in *world units* so it stays visible regardless of camera zoom.
        // (screen size = world size * zoom)
        const boxWidth = isLandscape ? Math.min(viewWidth * 0.6, 800 / cameraZoom) : viewWidth - (padding * 2);
        const boxHeight = 150 / cameraZoom;
        
        // Positionnement
        const boxX = (viewWidth - boxWidth) / 2;
        let boxY;

        const getBottomUiMarginPx = () => {
            // The chat UI is a DOM overlay (React). In landscape it can cover the canvas,
            // so we compute its real height and convert it to game units.
            try {
                const chatInputEl = document.getElementById('chat-input');
                if (!chatInputEl) return 80;

                const rect = chatInputEl.getBoundingClientRect();
                const cssPixels = (rect?.height || 0) + 30; // input height + safe padding
                const displayHeight = this.scale?.displaySize?.height || height;
                const ratio = displayHeight ? (height / displayHeight) : 1;
                return Math.max(80, cssPixels * ratio);
            } catch (e) {
                return 80;
            }
        };

        if (isLandscape) {
            // PC / Paysage : en bas mais au-dessus du chat DOM
            const bottomMarginWorld = getBottomUiMarginPx() / cameraZoom;
            boxY = viewHeight - boxHeight - bottomMarginWorld;
        } else {
            // Mobile / Portrait : en haut (pour éviter le joystick en bas)
            boxY = padding * 2;
        }

        // Clamp to keep the dialogue visible even on short heights / scaling differences
        boxY = Math.max(padding, Math.min(boxY, viewHeight - boxHeight - padding));

        // Conteneur principal
        // NOTE: avoid Number.MAX_SAFE_INTEGER; Phaser depth sorting can behave oddly with huge values.
        const DIALOGUE_DEPTH = 200000;
        const container = this.add.container(0, 0).setScrollFactor(0).setDepth(DIALOGUE_DEPTH);
        this.currentDialogueBox = container;

        // Fond de la boîte
        const bg = this.add.graphics();
        bg.fillStyle(0x504a45, 0.95); 
        bg.fillRoundedRect(boxX, boxY, boxWidth, boxHeight, 10);
        
        // Bordure
        bg.lineStyle(3, 0xc0b0a0, 1);
        bg.strokeRoundedRect(boxX, boxY, boxWidth, boxHeight, 10);
        bg.setScrollFactor(0);
        bg.setDepth(DIALOGUE_DEPTH);
        container.add(bg);

        // Nom de l'interlocuteur (si fourni)
        if (speakerName) {
            const nameBg = this.add.graphics();
            nameBg.fillStyle(0x333333, 1);
            // Petit badge pour le nom au-dessus de la boîte
            const nameX = boxX + 20;
            const nameY = boxY - 15;
            const namePadding = 10;
            
            const nameTextObj = this.add.text(nameX + namePadding, nameY + 2, speakerName, {
                font: `bold ${Math.max(10, Math.round(18 / cameraZoom))}px Arial`,
                fill: "#FFD700" // Or
            });
            
            const nameWidth = nameTextObj.width + (namePadding * 2);
            const nameHeight = 28;
            
            nameBg.fillRoundedRect(nameX, nameY, nameWidth, nameHeight, 5);
            nameBg.lineStyle(2, 0xc0b0a0, 1);
            nameBg.strokeRoundedRect(nameX, nameY, nameWidth, nameHeight, 5);

            nameBg.setScrollFactor(0);
            nameBg.setDepth(DIALOGUE_DEPTH);
            nameTextObj.setScrollFactor(0);
            nameTextObj.setDepth(DIALOGUE_DEPTH);
            
            container.add(nameBg);
            container.add(nameTextObj);
        }

        // Texte
        const textStyle = {
            font: `${Math.max(12, Math.round(22 / cameraZoom))}px Arial`,
            fill: "#ffffff",
            wordWrap: { width: boxWidth - (padding * 2) },
            align: "left"
        };

        const messageText = this.add.text(boxX + padding, boxY + padding + (speakerName ? 10 : 0), "", textStyle);
        messageText.setScrollFactor(0);
        messageText.setDepth(DIALOGUE_DEPTH);
        container.add(messageText);

        // Indicateur de suite (flèche clignotante)
        const nextIcon = this.add.text(boxX + boxWidth - (30 / cameraZoom), boxY + boxHeight - (30 / cameraZoom), "▼", {
            font: `${Math.max(10, Math.round(20 / cameraZoom))}px Arial`, fill: "#ffffff"
        }).setOrigin(0.5).setVisible(false);
        nextIcon.setScrollFactor(0);
        nextIcon.setDepth(DIALOGUE_DEPTH);
        container.add(nextIcon);

        // Effet de machine à écrire
        let charIndex = 0;
        const typeSpeed = 15; // Plus rapide (15ms vs 30ms)

        if (this.dialogueTimer) this.dialogueTimer.remove();

        const finishTyping = () => {
            if (this.dialogueTimer) this.dialogueTimer.remove();
            // Safety check: ensure container and text object still exist
            if (!this.currentDialogueBox || !this.currentDialogueBox.scene || !messageText || !messageText.scene) {
                return;
            }
            
            messageText.text = text;
            charIndex = text.length;
            
            if (nextIcon && nextIcon.scene) {
                nextIcon.setVisible(true);
                // Animation de la flèche
                this.tweens.add({
                    targets: nextIcon,
                    y: boxY + boxHeight - (40 / cameraZoom),
                    duration: 500,
                    yoyo: true,
                    repeat: -1
                });
            }
        };

        const closeDialogue = () => {
            if (this.currentDialogueBox === container) {
                if (this.dialogueTimer) {
                    this.dialogueTimer.remove();
                    this.dialogueTimer = null;
                }

                container.destroy();
                this.currentDialogueBox = null;
                
                // Nettoyage des écouteurs clavier temporaires
                this.input.keyboard.off('keydown-SPACE', handleInput);
                this.input.keyboard.off('keydown-ENTER', handleInput);
                
                // Priorité aux enchaînements via onComplete (PNJ en 2 boîtes, etc.)
                if (onComplete) onComplete();

                // Si onComplete a déclenché une nouvelle boîte, on laisse la queue pour plus tard
                if (this.currentDialogueBox) {
                    return;
                }

                // Sinon, on affiche le prochain message en attente
                if (this.dialogueQueue && this.dialogueQueue.length > 0) {
                    const next = this.dialogueQueue.shift();
                    this.time.delayedCall(0, () => {
                        this.displayMessage(next.text, next.speakerName, next.onComplete);
                    });
                    return;
                }

                // Fin de chaîne : on débloque le joueur
                if (this.uiManager) this.uiManager.isDialogueActive = false;
            }
        };

        const handleInput = () => {
            if (charIndex < text.length) {
                finishTyping();
            } else {
                closeDialogue();
            }
        };

        // Écouteurs clavier
        // Délai pour éviter que l'appui sur la touche d'interaction ne passe instantanément le dialogue
        this.time.delayedCall(200, () => {
            this.input.keyboard.on('keydown-SPACE', handleInput);
            this.input.keyboard.on('keydown-ENTER', handleInput);
            
            // Fermeture au clic (Zone plein écran)
            const closeZone = this.add.zone(0, 0, viewWidth, viewHeight).setOrigin(0).setInteractive();
            closeZone.setScrollFactor(0);
            closeZone.setDepth(DIALOGUE_DEPTH);
            closeZone.on('pointerdown', handleInput);
            container.add(closeZone);
            container.sendToBack(closeZone); // Derrière le texte mais capture les clics hors boutons
        });

        this.dialogueTimer = this.time.addEvent({
            delay: typeSpeed,
            callback: () => {
                messageText.text += text[charIndex];
                charIndex++;
                if (charIndex >= text.length) {
                    finishTyping();
                }
            },
            repeat: text.length - 1
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
        // Nettoyage des managers pour éviter les références fantômes au redémarrage
        this.playerManager = null;
        this.remotePlayerManager = null;
        this.mapManager = null;
        this.socketManager = null;
        this.uiManager = null;
        this.shopManager = null;
    }

    addItemToInventory(item) {
        // Update local cache immediately (UI/quests read from GameScene.inventory)
        PlayerService.addItemToInventory(item);
        this.inventory = Array.isArray(PlayerService.getInventory()) ? [...PlayerService.getInventory()] : [];
        try {
            this.game?.events?.emit('inventory:cacheUpdated', this.inventory);
        } catch (e) { /* ignore */ }

        console.log("Updated inventory:", this.inventory);

        // Persist to backend when possible (quests/rewards must survive reload)
        try {
            const apiUrl = process.env.REACT_APP_API_URL;
            const playerData = this.registry.get('playerData');
            const playerId = playerData ? playerData._id : null;

            const itemName = item && item.nom;
            const quantityToAdd = Number(item?.quantite ?? item?.['quantité'] ?? item?.quantity ?? 1) || 1;

            if (apiUrl && playerId && itemName) {
                fetch(`${apiUrl}/api/inventory/add-by-name`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ playerId, itemName, quantity: quantityToAdd })
                })
                    .then(async (res) => {
                        if (!res.ok) {
                            const body = await res.text().catch(() => '');
                            throw new Error(`HTTP ${res.status} ${body}`);
                        }

                        // Refresh from server to keep schema consistent and avoid desync.
                        try {
                            const refreshed = await PlayerService.fetchInventory(playerId);
                            this.inventory = Array.isArray(refreshed) ? refreshed : [];
                            this.game?.events?.emit('inventory:cacheUpdated', this.inventory);
                        } catch (e) {
                            // Keep optimistic local inventory if refresh fails.
                            console.warn('[GameScene] Inventory refresh failed after add-by-name', e);
                        }
                    })
                    .catch((e) => {
                        console.warn('[GameScene] Failed to persist inventory add-by-name', e);
                    });
            }
        } catch (e) {
            console.warn('[GameScene] addItemToInventory persistence error', e);
        }

        // Play item sound (key item or normal)
        try {
            const isKey = item && (item.isKeyItem || (item.type && item.type === 'key_item') || (item.nom && String(item.nom).toLowerCase().includes('clé')));
            const keyName = isKey ? 'keyitem_get' : 'item_get';
            this.sound.play(keyName, { volume: 0.65 });
        } catch (e) { /* ignore */ }
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
        this.shopManager?.destroy(); // ← AJOUT

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

    // ✅ NOUVELLES MÉTHODES - Triple Triad

    /**
     * Lance le menu de configuration pour jouer contre l'IA
     */
    startTripleTriadAI() {
        const playerData = this.registry.get("playerData");
        if (!playerData) {
            console.error("Données joueur non disponibles pour Triple Triad");
            return;
        }

        // Pause la scène courante et lance le menu de config IA
        this.scene.pause();
        this.scene.launch("TripleTriadAIConfigScene", {
            playerId: playerData._id
        });
    }

    /**
     * Lance le menu de configuration pour défier un joueur
     */
    startTripleTriadPvP(opponentId, opponentName) {
        const playerData = this.registry.get("playerData");
        if (!playerData) {
            console.error("Données joueur non disponibles pour Triple Triad");
            return;
        }

        if (!opponentId || !opponentName) {
            console.error("Adversaire non sélectionné pour le défi Triple Triad");
            this.displayMessage("Veuillez sélectionner un adversaire");
            return;
        }

        // Pause la scène courante et lance le menu de config PvP
        this.scene.pause();
        this.scene.launch("TripleTriadPvPConfigScene", {
            playerId: playerData._id,
            opponentId: opponentId,
            opponentName: opponentName
        });
    }

    /**
     * Obtient la liste des joueurs en ligne pour les défis
     */
    async getOnlinePlayers() {
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/players/online`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const players = await response.json();

            // Exclut le joueur actuel de la liste
            const playerData = this.registry.get("playerData");
            return players.filter(player => player._id !== playerData._id);

        } catch (error) {
            console.error('Erreur lors de la récupération des joueurs en ligne:', error);
            return [];
        }
    }

    /**
     * Affiche un menu de sélection d'adversaire pour Triple Triad
     */
    async showOpponentSelector() {
        const onlinePlayers = await this.getOnlinePlayers();

        if (onlinePlayers.length === 0) {
            this.displayMessage("Aucun joueur en ligne disponible pour un défi");
            return;
        }

        // Crée un menu de sélection simple (vous pouvez l'améliorer)
        const { width, height } = this.scale;

        // Fond semi-transparent
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
            .setInteractive()
            .setScrollFactor(0)
            .setDepth(200000);

        // Titre
        const title = this.add.text(width / 2, height * 0.2, "Choisir un adversaire", {
            font: `${Math.round(width * 0.05)}px Arial`,
            fill: "#fff",
            fontStyle: "bold"
        })
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(200001);

        // Liste des joueurs
        onlinePlayers.forEach((player, index) => {
            const btnY = height * 0.35 + index * 60;

            const playerBtn = this.add.text(width / 2, btnY, player.pseudo, {
                font: `${Math.round(width * 0.04)}px Arial`,
                fill: "#fff",
                backgroundColor: "#4a4a4a"
            })
                .setOrigin(0.5)
                .setPadding(20, 10, 20, 10)
                .setInteractive()
                .setScrollFactor(0)
                .setDepth(200001)
                .on('pointerdown', () => {
                    // Nettoie le menu
                    overlay.destroy();
                    title.destroy();
                    onlinePlayers.forEach((_, i) => {
                        // Détruit tous les boutons de joueurs
                        this.children.getChildren()
                            .filter(child => child.depth === 200001 && child.type === 'Text')
                            .forEach(btn => btn.destroy());
                    });

                    // Lance le défi
                    this.startTripleTriadPvP(player._id, player.pseudo);
                })
                .on('pointerover', () => playerBtn.setStyle({ backgroundColor: "#666" }))
                .on('pointerout', () => playerBtn.setStyle({ backgroundColor: "#4a4a4a" }));
        });

        // Bouton annuler
        const cancelBtn = this.add.text(width / 2, height * 0.8, "Annuler", {
            font: `${Math.round(width * 0.04)}px Arial`,
            fill: "#fff",
            backgroundColor: "#666"
        })
            .setOrigin(0.5)
            .setPadding(20, 10, 20, 10)
            .setInteractive()
            .setScrollFactor(0)
            .setDepth(200001)
            .on('pointerdown', () => {
                // Nettoie le menu
                overlay.destroy();
                title.destroy();
                cancelBtn.destroy();
                onlinePlayers.forEach((_, i) => {
                    this.children.getChildren()
                        .filter(child => child.depth === 200001 && child.type === 'Text')
                        .forEach(btn => btn.destroy());
                });
            });
    }
}