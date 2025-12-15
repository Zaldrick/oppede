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
            await this.preloadPromise;
            this.initializeManagers();
            await this.setupGame();
        } catch (error) {
            console.error("Error during preload. Aborting game initialization.");
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
        const playerData = this.registry.get("playerData");
        if (!playerData) {
            console.error("Player data is not defined in the registry! Aborting game initialization.");
            return;
        }

        // Charger les quêtes du joueur pour synchroniser l'état local
        try {
            const apiUrl = process.env.REACT_APP_API_URL;
            if (!apiUrl) {
                console.warn("[GameScene] REACT_APP_API_URL non défini; synchronisation des quêtes ignorée.");
                return;
            }

            const questsRes = await fetch(`${apiUrl}/api/quests/${playerData._id}`);
            if (questsRes.ok) {
                const questsData = await questsRes.json();
                // Convertir en format { "QuestId": stepIndex } pour MapEventManager
                playerData.quests = {};
                questsData.forEach(q => {
                    playerData.quests[q.questId] = q.stepIndex;
                    // Si la quête est terminée, on peut stocker un index élevé ou un flag
                    if (q.status === 'completed') {
                        // MapEventManager attend souvent un index élevé pour "fini" (ex: 4)
                        // On garde stepIndex, mais on pourrait ajouter une logique si besoin.
                        // Pour Etoile du Soir, step 4 = fini.
                    }
                });
                this.registry.set("playerData", playerData);
                console.log("[GameScene] Quêtes synchronisées :", playerData.quests);
            }
        } catch (e) {
            console.warn("[GameScene] Impossible de charger les quêtes :", e);
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
            this.load.spritesheet(`Interiors_48x48_part_${i}`, `/assets/maps/Interiors_48x48_part_${i}.png`, {
                frameWidth: 48,
                frameHeight: 48
            });
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
        const padding = 20;
        
        // Dimensions responsives
        const isLandscape = width > height;
        const boxWidth = isLandscape ? Math.min(width * 0.6, 800) : width - (padding * 2);
        const boxHeight = 150;
        
        // Positionnement
        const boxX = (width - boxWidth) / 2;
        let boxY;

        if (isLandscape) {
            // PC / Paysage : En bas (au-dessus du chat input)
            // On laisse une marge pour le chat input (~60px) + un peu d'espace
            boxY = height - boxHeight - 80;
        } else {
            // Mobile / Portrait : En haut (pour éviter le joystick en bas)
            boxY = padding * 2;
        }

        // Conteneur principal
        const container = this.add.container(0, 0).setScrollFactor(0).setDepth(Number.MAX_SAFE_INTEGER);
        this.currentDialogueBox = container;

        // Fond de la boîte
        const bg = this.add.graphics();
        bg.fillStyle(0x504a45, 0.95); 
        bg.fillRoundedRect(boxX, boxY, boxWidth, boxHeight, 10);
        
        // Bordure
        bg.lineStyle(3, 0xc0b0a0, 1);
        bg.strokeRoundedRect(boxX, boxY, boxWidth, boxHeight, 10);
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
                font: "bold 18px Arial",
                fill: "#FFD700" // Or
            });
            
            const nameWidth = nameTextObj.width + (namePadding * 2);
            const nameHeight = 28;
            
            nameBg.fillRoundedRect(nameX, nameY, nameWidth, nameHeight, 5);
            nameBg.lineStyle(2, 0xc0b0a0, 1);
            nameBg.strokeRoundedRect(nameX, nameY, nameWidth, nameHeight, 5);
            
            container.add(nameBg);
            container.add(nameTextObj);
        }

        // Texte
        const textStyle = {
            font: "22px Arial",
            fill: "#ffffff",
            wordWrap: { width: boxWidth - (padding * 2) },
            align: "left"
        };

        const messageText = this.add.text(boxX + padding, boxY + padding + (speakerName ? 10 : 0), "", textStyle);
        container.add(messageText);

        // Indicateur de suite (flèche clignotante)
        const nextIcon = this.add.text(boxX + boxWidth - 30, boxY + boxHeight - 30, "▼", {
            font: "20px Arial", fill: "#ffffff"
        }).setOrigin(0.5).setVisible(false);
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
                    y: boxY + boxHeight - 25,
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

                // Anti-spam: évite de relancer une interaction juste après fermeture
                // (ex: même pression de touche qui ferme puis ré-interagit)
                if (this.uiManager?.setInteractionCooldown) {
                    this.uiManager.setInteractionCooldown(300);
                }
                
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
            const closeZone = this.add.zone(0, 0, width, height).setOrigin(0).setInteractive();
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
        const normalizedItem = {
            ...item,
            quantite: Number(item?.quantite ?? item?.['quantité'] ?? item?.quantity ?? 1) || 1
        };

        PlayerService.addItemToInventory(normalizedItem);
        const updatedInventory = PlayerService.getInventory();
        this.inventory = Array.isArray(updatedInventory) ? [...updatedInventory] : [];
        this.game.events.emit('inventory:cacheUpdated', this.inventory);
        console.log("Updated inventory:", this.inventory);

        // Persistance serveur si possible (sans hardcoder d'URL)
        try {
            const playerId = this.registry.get('playerData')?._id;
            const apiUrl = process.env.REACT_APP_API_URL;
            if (apiUrl && playerId && normalizedItem?.nom) {
                fetch(`${apiUrl}/api/inventory/add-by-name`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ playerId, itemName: normalizedItem.nom, quantity: normalizedItem.quantite })
                }).then(async (res) => {
                    if (!res.ok) return;
                    // Refresh cache depuis le serveur pour refléter l'item_id/_id, etc.
                    try {
                        const fresh = await PlayerService.fetchInventory(playerId);
                        this.inventory = Array.isArray(fresh) ? [...fresh] : [];
                        this.game.events.emit('inventory:cacheUpdated', this.inventory);
                    } catch (e) { /* ignore */ }
                });
            }
        } catch (e) { /* ignore */ }

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