import MusicManager from '../MusicManager.js';
import PlayerService from '../services/PlayerService.js';
import Phaser from "phaser";

export class MapManager {
  constructor(scene) {
    this.scene = scene;
    this.map = null;
    this.collisionLayer = null;
    this.layers = [];
    this.objectSprites = [];
    this.currentBackgroundImage = null;
    this.currentMusicKey = null;
    this.activeEvents = [];

    // Configuration des cartes
    this.mapIds = {
      map: 0,
      map2: 1,
      map3: 2,
      qwest: 3,
      lille: 4,
      metro: 5,
      metroInterieur: 6
    };

    this.backgroundImages = {
      0: "background",
      1: "backgroundext",
      2: "backgroundoppede",
      3: "qwest",
      4: "qwest", // Placeholder
      5: "qwest", // Placeholder
      6: "qwest", // Placeholder
    };

    this.mapMusic = {
      map: "music1",
      map2: "music1",
      map3: "music1",
      qwest: "qwest",
      lille: "qwest",
      metro: "qwest",
      metroInterieur: "qwest",
    };

    this.teleportPoints = {
      map: [
        //{ x: 18*48 + 24, y: 43*48+24, targetMap: "map2", targetX: 7 * 48 + 24, targetY: 8 * 48 + 24 },
        { x:  18*48 + 24, y: 43*48+24, targetMap: "map3", targetX: 42 * 48 + 24, targetY: 8 * 48 + 2 }
      ],
      map2: [
        { x: 7 * 48 + 24, y: 7 * 48 + 24, targetMap: "map", targetX: 18*48 + 24, targetY: 42*48+24 },
      ],
      map3: [
        { x: 42 * 48 + 24, y: 5 * 48 + 24, targetMap: "qwest", targetX: 3 * 48 + 24, targetY: 4 * 48 + 24 },
        { x: 38 * 48 + 24, y: 5 * 48 + 24, targetMap: "map", targetX: 18*48 + 24, targetY: 42*48+24  }
      ],
      qwest: [
        { x: 13 * 48 + 24, y: 13 * 48 + 24, targetMap: "map3", targetX: 42 * 48 + 24, targetY: 6 * 48 + 24 },
        { x: 15 * 48 + 24, y: 26 * 48 + 24, targetMap: "lille", targetX: 61 * 48 + 24, targetY: 62 * 48 + 24 }
      ],
      lille: [
        { x: 19 * 48 + 24, y:22 * 48 + 24, targetMap: "metro", targetX: 26 * 48 + 24, targetY: 29 * 48 + 24 },
        { x: 61 * 48 + 24, y: 61 * 48 + 24, targetMap: "qwest", targetX: 15 * 48 + 24, targetY: 24 * 48 + 24 }
      ],
      metro: [
        { x: 26 * 48 + 24, y: 31* 48 + 24, targetMap: "lille", targetX: 19 * 48 + 24, targetY: 23 * 48 + 24 },
        { x: 27 * 48 + 24, y: 31* 48 + 24, targetMap: "lille", targetX: 19 * 48 + 24, targetY: 23 * 48 + 24 },
        { x: 26* 48+21, y: 15 * 48-10, targetMap: "lille",  targetX: 19 * 48 + 24, targetY: 23 * 48 + 24 },
      ]
    };
  }

  setupWorld(playerData) {
    if (!playerData) {
      console.error("Player data is not defined in the registry! Aborting world setup.");
      return;
    }

    const mapKey = Object.keys(this.mapIds).find(key => this.mapIds[key] === playerData.mapId);
    if (!mapKey) {
      console.error(`Aucune carte trouvée pour mapId: ${playerData.mapId}`);
      return;
    }

    this.changeMap(mapKey, playerData.posX || 0, playerData.posY || 0);
  }

  async changeMap(mapKey, spawnX, spawnY) {
    console.log(`[MapManager] changeMap called with key: ${mapKey}`);
    
    // Ensure backgroundImages is defined
    if (!this.backgroundImages) {
        console.warn("[MapManager] backgroundImages was undefined. Re-initializing default values.");
        this.backgroundImages = {
            0: "background",
            1: "backgroundext",
            2: "backgroundoppede",
            3: "qwest",
            4: "qwest", // Placeholder for lille
            5: "qwest"  // Placeholder for metro
        };
    }

    if (!this.scene.cache.tilemap.has(mapKey)) {
      console.error(`[MapManager] Tilemap key "${mapKey}" not found in cache.`);
      return;
    }

    // Nettoyage complet de la map précédente
    if (this.collisionLayer) {
      this.scene.physics.world.colliders.destroy();
      this.collisionLayer.destroy();
      this.collisionLayer = null;
    }

    if (this.layers) {
        this.layers.forEach(layer => layer.destroy());
        this.layers = [];
    }

    if (this.objectSprites) {
        this.objectSprites.forEach(sprite => sprite.destroy());
        this.objectSprites = [];
    }

    if (this.activeEvents) {
        this.activeEvents.forEach(event => {
            if (event.bubble) event.bubble.destroy();
            event.destroy();
        });
        this.activeEvents = [];
    }

    if (this.map) {
        this.map.destroy();
        this.map = null;
    }

    // DIAGNOSTIC AVANT CRÉATION
    const mapData = this.scene.cache.tilemap.get(mapKey);
    if (mapData && mapData.data) {
        const rawData = mapData.data;
        // Vérification des tilesets externes
        if (rawData.tilesets) {
            const externalTilesets = rawData.tilesets.filter(t => t.source);
            if (externalTilesets.length > 0) {
                console.error(`[MapManager] 🛑 ERREUR CRITIQUE: La map "${mapKey}" utilise des tilesets externes (.tsx).`);
                console.error(`[MapManager] Phaser ne supporte pas bien les tilesets externes. Dans Tiled, cliquez sur le bouton "Embed Tilesets" (ou "Incorporer les jeux de tuiles") pour chaque tileset avant d'exporter en JSON.`);
                console.error(`[MapManager] Tilesets problématiques:`, externalTilesets.map(t => t.source));
            }
        }
    }

    // Charge la nouvelle carte
    console.log(`[MapManager] Tentative de création de la tilemap: "${mapKey}"`);
    try {
        this.map = this.scene.make.tilemap({ key: mapKey });
    } catch (err) {
        console.error(`[MapManager] 💥 CRASH lors de make.tilemap("${mapKey}")`);
        console.error(`[MapManager] Cause probable: Tileset externe non incorporé ou format JSON invalide.`);
        console.error(`[MapManager] Détail de l'erreur:`, err);
        return;
    }

    this.map.key = mapKey;
    if (!this.map) {
      console.error(`La carte "${mapKey}" n'a pas pu être chargée.`);
      return;
    }

    // Charge les tilesets dynamiquement
    const tilesets = [];
    this.map.tilesets.forEach(tilesetData => {
        let tilesetName = tilesetData.name;
        
        // Fallback pour les tilesets externes sans nom explicite dans le JSON
        if (!tilesetName && tilesetData.source) {
            // Extrait le nom du fichier sans l'extension
            // ex: "Interiors_48x48.tsx" -> "Interiors_48x48"
            const parts = tilesetData.source.split('/');
            const filename = parts[parts.length - 1];
            tilesetName = filename.replace(/\.[^/.]+$/, "");
        }

        if (!tilesetName) {
             console.warn("Tileset sans nom ni source valide:", tilesetData);
             return;
        }

        let tileset = this.map.addTilesetImage(tilesetName, tilesetName);
        
        // Fallback si le tileset n'a pas pu être chargé (image manquante)
        if (!tileset) {
            console.warn(`[MapManager] Le tileset "${tilesetName}" n'a pas pu être chargé. Utilisation du fallback "Room_Builder_48x48".`);
            // On essaie de charger avec une image qui existe sûr (Room_Builder_48x48)
            // Cela permet d'éviter que Phaser ne plante si un layer fait référence à ce tileset
            tileset = this.map.addTilesetImage(tilesetName, "Room_Builder_48x48");
        }

        if (tileset) {
            tilesets.push(tileset);
        } else {
            console.warn(`[MapManager] ECHEC TOTAL chargement tileset "${tilesetName}".`);
        }
    });

    // Affiche l'image de fond correspondant au mapId
    const mapId = this.mapIds[mapKey];
    this.scene.registry.set("currentMapId", mapId);

    // Update playerData in registry and PlayerService to ensure correct mapId is saved
    const playerData = this.scene.registry.get("playerData");
    if (playerData) {
        playerData.mapId = mapId;
        this.scene.registry.set("playerData", playerData);
        PlayerService.setPlayerData(playerData);
    }
    
    // Sécurité : on s'assure que backgroundImages est défini pour éviter l'erreur "reading '2'"
    if (!this.backgroundImages) {
        console.warn("[MapManager] backgroundImages was undefined. Re-initializing default values.");
        this.backgroundImages = {
            0: "background",
            1: "backgroundext",
            2: "backgroundoppede",
            3: "qwest",
            4: "qwest",
            5: "qwest"
        };
    }

    const backgroundImageKey = this.backgroundImages[mapId];
    if (backgroundImageKey) {
      if (this.currentBackgroundImage) {
        this.currentBackgroundImage.destroy();
      }
      // Profondeur très basse pour le fond (-100) pour laisser de la place aux couches négatives (-1, -2...)
      this.currentBackgroundImage = this.scene.add.image(0, 0, backgroundImageKey).setOrigin(0).setDepth(-100);
    } else {
      console.warn(`Aucune image de fond trouvée pour mapId: ${mapId}`);
    }

    // Configure les couches
    this.map.layers.forEach(layerData => {
        const layer = this.map.createLayer(layerData.name, tilesets, 0, 0);
        this.layers.push(layer);
        
        // Gestion de la profondeur via le nom de la couche (ex: "2", "-1")
        const depth = parseInt(layerData.name, 10);
        if (!isNaN(depth)) {
            layer.setDepth(depth);
        }

        // Cas spécifique pour la collision (nom "Collision" ou "collision")
        if (layerData.name.toLowerCase() === "collision") {
            this.collisionLayer = layer;
            this.collisionLayer.setCollisionByProperty({ collision: true });
            // On force la profondeur à 0 et on cache la couche
            layer.setDepth(-999); 
            layer.setVisible(false);
        }
    });

    if (!this.collisionLayer) {
      console.error("La couche de collision n'a pas pu être créée.");
      return;
    }

    // Debug tile check (optional, kept from original)
    var tile = this.collisionLayer.getTileAt(7, 8);
    if (!tile) {
      // console.warn("Aucune tuile trouvée aux coordonnées (7, 8) dans la couche Collision.");
    }

    // Met à jour les limites du monde
    this.scene.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.scene.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

    // Téléporte le joueur aux nouvelles coordonnées
    const player = this.scene.playerManager?.getPlayer();
    if (player) {
      player.setPosition(spawnX, spawnY);
      player.setVisible(true);
    } else {
      console.error("Player is not initialized! Cannot set position.");
    }

    // Ajoute des collisions pour la nouvelle carte
    if (player) {
      this.scene.physics.add.collider(player, this.collisionLayer);
    }

    // Gestion des couches d'objets (visuels)
    this.createObjectLayers();

    await this.loadWorldEvents();
    
    // Vérification de sécurité : si la scène a été détruite ou n'est plus active
    if (!this.scene || !this.scene.sys || !this.scene.sys.isActive()) {
        console.warn("Scene destroyed or inactive during map load, aborting.");
        return;
    }

    // Vérification des caméras
    if (!this.scene.cameras || !this.scene.cameras.main) {
        console.warn("Cameras not available, aborting.");
        return;
    }

    this.createTeleportZones();
    
    try {
        this.scene.cameras.main.fadeIn(500, 0, 0, 0);
        if (player) {
            this.scene.cameras.main.startFollow(player, true, 0.1, 0.1);
        }
    } catch (err) {
        console.warn("Error updating camera:", err);
    }

    // Envoi de la position par socket
    if (this.scene.socket && this.scene.myId) {
      const currentMapId = PlayerService.getPlayerData()?.mapId;
      this.scene.socket.emit('playerMove', {
        x: player.x,
        y: player.y,
        anim: this.scene.playerManager?.getCurrentAnim() || "",
        mapId: currentMapId,
      });
    }

    // Force save position to DB to persist map change immediately
    if (this.scene.playerManager) {
        this.scene.playerManager.updatePositionInDB().catch(err => console.warn("Failed to save position after map change:", err));
    }

    this.playMusicForMap(mapKey);
    }

    createObjectLayers() {
        if (!this.map.objects) return;

        this.map.objects.forEach(layerData => {
            // Ignore la couche "events" qui est gérée séparément
            if (layerData.name === "events") return;

            const depth = parseInt(layerData.name, 10) || 10; // Default depth if not a number
            
            layerData.objects.forEach(obj => {
                if (obj.gid) {
                    // Clean GID (remove flip flags)
                    // Flags: 0x80000000 (H), 0x40000000 (V), 0x20000000 (D)
                    const rawGid = obj.gid;
                    const gid = rawGid & ~(0x80000000 | 0x40000000 | 0x20000000);
                    
                    // Find tileset for this GID
                    const tileset = this.map.tilesets.find(t => gid >= t.firstgid && gid < (t.firstgid + t.total));
                    
                    if (tileset) {
                        const frame = gid - tileset.firstgid;
                        
                        // Check for collision property on the tile
                        const tileProps = tileset.getTileProperties(frame);
                        const isCollision = tileProps && tileProps.collision;

                        const sprite = this.scene.add.sprite(obj.x, obj.y, tileset.name, frame);
                        
                        // Tiled objects are bottom-left origin
                        sprite.setOrigin(0, 1);
                        
                        // Apply dimensions
                        if (obj.width && obj.height) {
                            sprite.setDisplaySize(obj.width, obj.height);
                        }
                        
                        // Apply rotation
                        if (obj.rotation) {
                            sprite.setRotation(Phaser.Math.DegToRad(obj.rotation));
                        }
                        
                        // Apply flips
                        const flippedH = (rawGid & 0x80000000) !== 0;
                        const flippedV = (rawGid & 0x40000000) !== 0;
                        if (flippedH) sprite.setFlipX(true);
                        if (flippedV) sprite.setFlipY(true);
                        
                        sprite.setDepth(depth);
                        
                        // Hide if it's a collision tile, otherwise use object visibility
                        if (isCollision) {
                            sprite.setVisible(false);
                        } else {
                            sprite.setVisible(obj.visible);
                        }
                        
                        this.objectSprites.push(sprite);
                    }
                }
            });
        });
    }

    async loadWorldEvents() {
        if (!this.map) return;

        const eventsLayer = this.map.getObjectLayer("events");
        if (!eventsLayer) {
            console.warn("Pas de couche 'events' dans la map !");
        }

        const mapKey = this.map.key;
        let worldEvents = [];
        try {
            const res = await fetch(`${process.env.REACT_APP_API_URL}/api/world-events?mapKey=${mapKey}`);
            worldEvents = await res.json();
        } catch (e) {
            console.error("Erreur lors du chargement des worldEvents :", e);
        }

        // Vérification de sécurité après l'appel asynchrone
        // Si la map a été détruite pendant le fetch (changement de scène), on arrête tout
        if (!this.map) return;

        this.activeEvents = [];

        // Traitement des événements existants depuis la base de données
        if (eventsLayer) {
            eventsLayer.objects.forEach(obj => {
                const eventId = obj.properties?.find(p => p.name === "eventId")?.value;
                const type = obj.type || obj.properties?.find(p => p.name === "type")?.value;
                const x = obj.x, y = obj.y;

                let dynamicEvent = null;
                if (eventId) {
                    dynamicEvent = worldEvents.find(e => e.properties?.chestId === eventId || e.properties?.doorId === eventId);
                } else {
                    dynamicEvent = worldEvents.find(e => e.x === x && e.y === y && e.type === type);
                }
                if (!dynamicEvent) return;

                if (type === "chest") {
                    const chest = this.scene.physics.add.sprite(x + obj.width / 2, y - obj.height / 2, "!Chest", 0);
                    chest.setImmovable(true);
                    chest.eventData = dynamicEvent;
                    chest.setInteractive();
                    this.activeEvents.push(chest);

                    this.addCollisionIfNeeded(obj, chest);

                    if (dynamicEvent.state.opened) {
                        chest.setFrame(3);
                    }
                } else if (type === "npc") {
                    this.createNPC(dynamicEvent, x, y);
                }
            });
        }

        // ✅ CHANGEMENT - Placer le marchand sur map3 (Oppède) au lieu de map
        if (mapKey === "map3") {
            this.createBoosterVendor();
            this.createRalofNPC();
        }

        if (mapKey === "metro") {
            this.createSubwayDoor();
        }
    }

    createSubwayDoor() {
        if (!this.map) return;

        // Coordonnées: entre 21:15 et 22:15.
        // Sprite 96x96. Centré sur X=22*48 (entre 21 et 22) et Y=15*48 (bas aligné avec tile 15)
       // const doorX = 21* 48+20; // 1032 (milieu case 21) + 24 = 1056 (bord droit case 21 / bord gauche case 22)
        //const doorY = 15*48+6;
        // Wait, 21.5 * 48 = 1032. 22 * 48 = 1056.
        // Case 21: 1008-1056. Center 1032.
        // Case 22: 1056-1104. Center 1080.
        // Midpoint: 1056.
        
        // Correction positionnement pour sprite 96x96 centré sur la jonction des cases 21 et 22
        const finalX = 26 * 48+21; 
        const finalY = 15 * 48-10;

        const door = this.scene.physics.add.sprite(finalX, finalY, "subway_door", 0);
        door.setImmovable(true);
        door.setDepth(-1); // Au-dessus du sol

        // Animations
        if (!this.scene.anims.exists('subway_door_open')) {
            this.scene.anims.create({
                key: 'subway_door_open',
                frames: this.scene.anims.generateFrameNumbers('subway_door', { start: 0, end: 7 }),
                frameRate: 10,
                repeat: 0
            });
        }
        if (!this.scene.anims.exists('subway_door_close')) {
            this.scene.anims.create({
                key: 'subway_door_close',
                frames: this.scene.anims.generateFrameNumbers('subway_door', { start: 7, end: 0 }),
                frameRate: 10,
                repeat: 0
            });
        }

        // Zone de détection pour l'ouverture
        const detectionZone = this.scene.add.zone(finalX, finalY, 100, 180); // Zone plus large
        this.scene.physics.world.enable(detectionZone);
        
        // Gestion de l'ouverture/fermeture
        door.isOpen = false;
        
        this.scene.physics.add.overlap(this.scene.playerManager.getPlayer(), detectionZone, () => {
            if (!door.active) return; // Safety check
            
            if (!door.isOpen) {
                try {
                    door.play('subway_door_open');
                    this.scene.sound.play('metro_open', { volume: 0.5 });
                    door.isOpen = true;
                } catch (e) {
                    console.warn("Failed to play door open animation/sound", e);
                }
            }
            door.lastOverlapTime = this.scene.time.now;
        });

        // Update loop pour fermer la porte
        const updateListener = () => {
            if (!door.active) {
                // Clean up listener if door is destroyed
                this.scene.events.off('update', updateListener);
                return;
            }

            if (door.isOpen && this.scene.time.now - door.lastOverlapTime > 200) {
                try {
                    door.play('subway_door_close');
                    this.scene.sound.play('metro_close', { volume: 0.5 });
                    door.isOpen = false;
                } catch (e) {
                    console.warn("Failed to play door close animation/sound", e);
                }
            }
        };
        
        this.scene.events.on('update', updateListener);

        this.activeEvents.push(door);
        //console.log(`Porte de métro créée à (${doorX}, ${doorY})`);
    }


    createBoosterVendor() {
        if (!this.map) return;

        // Position du PNJ vendeur sur la carte map3 (Oppède) - ajustez selon votre carte
        const vendorX = 50 * 48 + 24;  // Ajustez la colonne selon votre carte
        const vendorY = 7 * 48 + 24;   // Ajustez la ligne selon votre carte

        // ✅ CHANGEMENT - Utiliser le sprite "marchand" au lieu de "player"
        const vendor = this.scene.physics.add.sprite(vendorX, vendorY, "marchand", 0);
        vendor.setImmovable(true);
        vendor.setInteractive();
        vendor.npcType = "booster_vendor";

        // Animation d'idle pour le marchand avec frames spécifiques
        this.scene.anims.create({
            key: 'marchand_idle',
            frames: this.scene.anims.generateFrameNumbers('marchand', { start: 0, end: 3 }),
            frameRate: 2,
            repeat: -1
        });

        vendor.play('marchand_idle');

        // Ajouter collision avec le joueur
        const player = this.scene.playerManager?.getPlayer();
        if (player) {
            this.scene.physics.add.collider(player, vendor);
        }

        // Ajouter à la liste des événements actifs
        this.activeEvents.push(vendor);

        // ✅ AMÉLIORATION - Indicateur visuel plus approprié pour un marchand
        const bubble = this.scene.add.text(vendorX, vendorY - 35, "🛒", {
            font: "24px Arial",
            fill: "#fff",
            stroke: "#000",
            strokeThickness: 2
        }).setOrigin(0.5);

        // Animation de la bulle plus dynamique
        this.scene.tweens.add({
            targets: bubble,
            y: vendorY - 45,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Effet de pulsation pour attirer l'attention
        this.scene.tweens.add({
            targets: bubble,
            scale: { from: 1, to: 1.3 },
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Power2'
        });

        vendor.bubble = bubble;

        console.log(`🛒 Marchand de boosters créé à la position (${vendorX}, ${vendorY}) sur ${this.map?.key || 'unknown'}`);
    }

    createRalofNPC() {
        if (!this.map) return;

        // Position de Ralof sur la gauche de la map3
        const ralofX = 6 * 48 + 24; 
        const ralofY = 10 * 48 + 24;

        // Ajustement de la position Y pour le sprite de 96px de haut (centré par défaut)
        // On le remonte de 24px pour que les pieds soient alignés avec la tuile
        const ralof = this.scene.physics.add.sprite(ralofX, ralofY - 24, "ralof", 0);
        
        ralof.setImmovable(true);
        ralof.setInteractive();
        ralof.npcType = "ralof";

        // Animation d'idle pour Ralof
        this.scene.anims.create({
            key: 'ralof_idle',
            frames: this.scene.anims.generateFrameNumbers('ralof', { start: 3, end: 3 }),
            frameRate: 4,
            repeat: -1,
            yoyo: true
        });

        ralof.play('ralof_idle');

        // Ajouter collision avec le joueur
        const player = this.scene.playerManager?.getPlayer();
        if (player) {
            this.scene.physics.add.collider(player, ralof);
        }

        this.activeEvents.push(ralof);

        // Indicateur visuel
        const bubble = this.scene.add.text(ralofX, ralofY - 35, "?", {
            font: "24px Arial",
            fill: "#fff",
            stroke: "#000",
            strokeThickness: 2
        }).setOrigin(0.5);

        this.scene.tweens.add({
            targets: bubble,
            y: ralofY - 45,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        ralof.bubble = bubble;
        console.log(`Ralof créé à la position (${ralofX}, ${ralofY}) sur ${this.map?.key || 'unknown'}`);
    }


    createNPC(eventData, x, y) {
        const npc = this.scene.physics.add.sprite(x + 24, y + 24, "player", 0);
        npc.setImmovable(true);
        npc.eventData = eventData;
        npc.setInteractive();
        npc.npcType = "dialogue";
        this.activeEvents.push(npc);

        this.addCollisionIfNeeded({ properties: [{ name: "Collision", value: true }] }, npc);
    }

    handleNPCInteraction(npc) {
        if (npc.npcType === "ralof") {
            const answer = window.prompt("What's my Name ?");
            if (answer && answer.toLowerCase() === "ralof") {
                this.changeMap("qwest", 13 * 48 + 24, 5 * 48 + 24);
            }
        } else if (npc.npcType === "booster_vendor") {
            // ✅ AMÉLIORATION - Dialogue plus immersif
            this.scene.displayMessage("Salut l'ami ! Tu veux des boosters de cartes ?\n J'ai ce qu'il te faut !");

            // Son d'interaction (optionnel)
            if (this.scene.sound) {
                // Vous pouvez ajouter un son spécifique pour le marchand
                // this.scene.sound.play("merchant_greeting", { volume: 0.3 });
            }

            // Ouvrir la boutique après un court délai
            setTimeout(() => {
                if (this.scene.shopManager) {
                    this.scene.shopManager.openShop();
                }
            }, 1500);
        } else if (npc.npcType === "dialogue" && npc.eventData) {
            const dialogue = npc.eventData.properties?.dialogue || "Bonjour !";
            this.scene.displayMessage(dialogue);

            if (!npc.eventData.state.hasSpoken) {
                // Marquer comme ayant parlé
                fetch(`${process.env.REACT_APP_API_URL}/api/world-events/${npc.eventData._id}/state`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ hasSpoken: true })
                });
                npc.eventData.state.hasSpoken = true;
            }
        }
    }

  addCollisionIfNeeded(obj, sprite) {
    const hasCollision = obj.properties?.find(p => p.name === "Collision" && p.value === true);
    const player = this.scene.playerManager?.getPlayer();
    if (hasCollision && player) {
      this.scene.physics.add.collider(player, sprite);
    }
  }

  createTeleportZones() {
    const player = this.scene.playerManager?.getPlayer();
    if (!player) {
      console.error("Player is not initialized. Cannot create teleport zones.");
      return;
    }

    if (!this.map || !this.map.key) {
      console.error("Map is not initialized. Cannot create teleport zones.");
      return;
    }

    const teleportPoints = this.teleportPoints[this.map.key];
    if (!teleportPoints || teleportPoints.length === 0) {
      console.warn(`Aucun point de téléportation défini pour la carte : ${this.map.key}`);
      return;
    }

    teleportPoints.forEach(point => {
      const teleportZone = this.scene.add.zone(point.x, point.y, 48, 48)
        .setOrigin(0.5)
        .setInteractive();

      if (!teleportZone) {
        console.error(`La zone de téléportation à (${point.x}, ${point.y}) n'a pas pu être créée.`);
        return;
      }

      this.scene.physics.world.enable(teleportZone);
      this.scene.physics.add.overlap(player, teleportZone, () => {
        try { 
            this.scene.sound.play("teleportSound", { volume: 0.3 }); 
        } catch (e) { 
            console.warn("Failed to play teleportSound:", e);
        }
        this.changeMap(point.targetMap, point.targetX, point.targetY);
      });
    });
  }

  playMusicForMap(mapKey) {
    const musicKey = this.mapMusic[mapKey];

    if (!musicKey) {
      console.warn(`Aucune musique définie pour la carte : ${mapKey}`);
      return;
    }

    if (this.currentMusicKey === musicKey) {
      return;
    }

    MusicManager.stop();
    MusicManager.play(this.scene, musicKey, { loop: true, volume: 0.5 });
    this.currentMusicKey = musicKey;
  }

    getNearbyEventObject(playerX, playerY) {
        if (!this.activeEvents) return null;
        const threshold = 48;
        return this.activeEvents.find(obj =>
            Phaser.Math.Distance.Between(playerX, playerY, obj.x, obj.y) < threshold
        );
    }

  handleChestInteraction(chest) {
    const { eventData } = chest;
    if (eventData.state.opened) {
      this.scene.displayMessage("Ce coffre est déjà ouvert !");
      return;
    }

    chest.anims.play('chest-open');
    chest.once('animationcomplete', () => {
      chest.setFrame(4);
    });

    this.scene.displayMessage(`Vous trouvez : ${eventData.properties.loot}`);

    fetch(`${process.env.REACT_APP_API_URL}/api/world-events/${eventData._id}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opened: true })
    });

    this.scene.addItemToInventory({ nom: eventData.properties.loot, quantite: 1 });
    eventData.state.opened = true;
    // Play SFX for item obtained
    try {
      if (this.scene && this.scene.sound) {
        this.scene.sound.play('item_get', { volume: 0.85 });
      }
    } catch (e) { /* ignore */ }
  }

  compareTilemaps() {
    console.log('=== COMPARAISON DES CARTES ===');
    
    const maps = ['map', 'map2', 'map3'];
    maps.forEach(mapKey => {
      if (this.scene.cache.tilemap.has(mapKey)) {
        const mapData = this.scene.cache.tilemap.get(mapKey).data;
        console.log(`\n--- ${mapKey.toUpperCase()} ---`);
        console.log('Width:', mapData.width);
        console.log('Height:', mapData.height);
        console.log('Tile Width:', mapData.tilewidth);
        console.log('Tile Height:', mapData.tileheight);
        console.log('Tilesets count:', mapData.tilesets ? mapData.tilesets.length : 0);
        console.log('Layers count:', mapData.layers ? mapData.layers.length : 0);
        
        if (mapData.tilesets) {
          mapData.tilesets.forEach((tileset, i) => {
            console.log(`  Tileset ${i}: ${tileset.name} (firstgid: ${tileset.firstgid})`);
          });
        }
        
        if (mapData.layers) {
          mapData.layers.forEach((layer, i) => {
            console.log(`  Layer ${i}: ${layer.name} (type: ${layer.type})`);
          });
        }
      } else {
        console.log(`${mapKey} - NON TROUVÉ DANS LE CACHE`);
      }
    });
  }

  getMap() {
    return this.map;
  }

  getActiveEvents() {
    return this.activeEvents;
  }

  destroy() {
    if (this.collisionLayer) {
      this.collisionLayer.destroy();
      this.collisionLayer = null;
    }
    
    if (this.currentBackgroundImage) {
      this.currentBackgroundImage.destroy();
      this.currentBackgroundImage = null;
    }
    
    this.activeEvents = [];
    this.map = null;
  }
}