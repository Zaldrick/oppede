import MusicManager from '../MusicManager.js';
import PlayerService from '../services/PlayerService.js';
import Phaser from "phaser";

export class MapManager {
  constructor(scene) {
    this.scene = scene;
    this.map = null;
    this.collisionLayer = null;
    this.currentBackgroundImage = null;
    this.currentMusicKey = null;
    this.activeEvents = [];

    // Configuration des cartes
    this.mapIds = {
      map: 0,
      map2: 1,
      map3: 2
    };

    this.backgroundImages = {
      0: "background",
      1: "backgroundext",
      2: "backgroundoppede",
    };

    this.mapMusic = {
      map: "music1",
      map2: "music1",
      map3: "music1",
    };

    this.teleportPoints = {
      map: [
        { x: 18*48 + 24, y: 43*48+24, targetMap: "map2", targetX: 7 * 48 + 24, targetY: 8 * 48 + 24 },
      ],
      map2: [
        { x: 7 * 48 + 24, y: 7 * 48 + 24, targetMap: "map", targetX: 18*48 + 24, targetY: 42*48+24 },
      ],
      map3: [],
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
    if (!this.scene.cache.tilemap.has(mapKey)) {
      return;
    }

    // Supprime les colliders existants
    if (this.collisionLayer) {
      this.scene.physics.world.colliders.destroy();
      this.collisionLayer.destroy();
    }

    // Charge la nouvelle carte
    this.map = this.scene.make.tilemap({ key: mapKey });
    this.map.key = mapKey;
    if (!this.map) {
      console.error(`La carte "${mapKey}" n'a pas pu être chargée.`);
      return;
    }

    const tileset = this.map.addTilesetImage("Inside_B", "Inside_B");
    if (!tileset) {
      console.error(`Le tileset "Inside_B" n'a pas pu être chargé.`);
      return;
    }

    // Affiche l'image de fond correspondant au mapId
    const mapId = this.mapIds[mapKey];
    this.scene.registry.set("currentMapId", mapId);
    const backgroundImageKey = this.backgroundImages[mapId];
    if (backgroundImageKey) {
      if (this.currentBackgroundImage) {
        this.currentBackgroundImage.destroy();
      }
      this.currentBackgroundImage = this.scene.add.image(0, 0, backgroundImageKey).setOrigin(0).setDepth(-1);
    } else {
      console.warn(`Aucune image de fond trouvée pour mapId: ${mapId}`);
    }

    // Configure les couches
    this.collisionLayer = this.map.createLayer("Collision", tileset, 0, 0);
    if (!this.collisionLayer) {
      console.error("La couche de collision n'a pas pu être créée.");
      return;
    }
    this.collisionLayer.setCollisionByProperty({ collision: true });

    var tile = this.collisionLayer.getTileAt(7, 8);
    if (!tile) {
      console.warn("Aucune tuile trouvée aux coordonnées (7, 8) dans la couche Collision.");
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

    PlayerService.updatePlayerData({ mapId });

    await this.loadWorldEvents();
    this.createTeleportZones();
    this.scene.cameras.main.fadeIn(500, 0, 0, 0);
    this.scene.cameras.main.startFollow(player, true, 0.1, 0.1);

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

    this.playMusicForMap(mapKey);
    }

    async loadWorldEvents() {
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
        }
    }


    createBoosterVendor() {
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

        console.log(`🛒 Marchand de boosters créé à la position (${vendorX}, ${vendorY}) sur ${this.map.key}`);
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
        if (npc.npcType === "booster_vendor") {
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
        this.scene.sound.play("teleportSound", { volume: 0.3});
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