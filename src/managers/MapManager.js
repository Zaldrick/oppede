import MusicManager from '../MusicManager.js';
import PlayerService from '../services/PlayerService.js';
import Phaser from "phaser";
import { MapEventManager } from './MapEventManager.js';
import { MapPhysicsManager } from './MapPhysicsManager.js';
import { WildEncounterManager } from './WildEncounterManager.js';

export class MapManager {
  constructor(scene) {
    this.scene = scene;
    this.map = null;
    this.collisionLayer = null;
    this.layers = [];
    this.objectSprites = [];
    this.currentBackgroundImage = null;
    this.currentMusicKey = null;
    this.shakeTimer = null;
    this.teleportZones = [];
    this.isTeleporting = false;

    // Sub-managers
    this.eventManager = new MapEventManager(scene, this);
    this.physicsManager = new MapPhysicsManager(scene, this);
    this.wildEncounterManager = new WildEncounterManager(scene, this);

    // Configuration des cartes
    this.mapIds = {
      map: 0,
      map2: 1,
      map3: 2,
      qwest: 3,
      lille: 4,
      metro: 5,
      metroInterieur: 6,
      douai: 7,
      marin: 8
    };

    this.backgroundImages = {
      0: "background",
      1: "backgroundext",
      2: "backgroundoppede",
      3: "qwest",
      4: "defaut", // Placeholder for lille
      5: "metrobg",  // Placeholder for metro
      6: "defaut",
      7: "defaut",
      8: "marinbg"
    };

    this.mapMusic = {
      map: "music1",
      map2: "music1",
      map3: "music1",
      qwest: "qwest",
      lille: "lille",
      metro: "metro",
      metroInterieur: "metroInterieur",
      douai: "douai",
      marin:"marin"
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
        { x: 38 * 48 + 24, y: 5 * 48 + 24, targetMap: "map", targetX: 18*48 + 24, targetY: 42*48+24  }
      ],
      qwest: [
       // { x: 13 * 48 + 24, y: 13 * 48 + 24, targetMap: "map3", targetX: 42 * 48 + 24, targetY: 6 * 48 + 24 },
        { x: 13 * 48 + 24, y: 21 * 48 + 24, targetMap: "douai", targetX: 40 * 48 + 24, targetY: 73 * 48, requiredItemName: "Clés de voiture" },
        { x: 15 * 48 + 24, y: 27 * 48, targetMap: "lille", targetX: 61 * 48 + 24, targetY: 61 * 48 + 24 }
      ],
      lille: [
        { x: 19 * 48 + 24, y:22 * 48 + 24, targetMap: "metro", targetX: 26 * 48 + 24, targetY: 25 * 48 },
        { x: 61 * 48 + 24, y: 60 * 48 + 24, targetMap: "qwest", targetX: 15 * 48 + 24, targetY: 25 * 48  }
      ],
      metro: [
        { x: 26 * 48 + 24, y: 26* 48 + 24, targetMap: "lille", targetX: 19 * 48 + 24, targetY: 23 * 48 },
        { x: 27 * 48 + 24, y: 26* 48 + 24, targetMap: "lille", targetX: 19 * 48 + 24, targetY: 23 * 48 },
        { x: 26* 48+21, y: 10 * 48-10, targetMap: "metroInterieur",  targetX: 10 * 48 + 24, targetY: 7 * 48 + 24 }
      ],
      metroInterieur: [
        { x: 10 * 48 + 24, y:9 * 48 + 24 , targetMap: "metro", targetX: 26* 48+21, targetY:11 * 48-10 },
         { x: 40 * 48 + 24, y:9 * 48 + 24 , targetMap: "douai", targetX: 114* 48+21, targetY:21 * 48-10 }
      ],
      douai: [
        { x: 114 * 48 + 24, y:20 * 48 + 24 , targetMap: "metroInterieur", targetX: 40* 48+21, targetY:7* 48+24 },
        { x: 37* 48 + 24, y:73 * 48 + 24 , targetMap: "marin", targetX: 38* 48+21, targetY:4* 48 +4}
      ],
      marin: [
        { x: 39 * 48 + 24, y:4 * 48 + 24 , targetMap: "douai", targetX: 38* 48+21, targetY:73* 48+24 }
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

    // Prevent dialogue UI from persisting across teleports/map loads
    try {
      if (typeof this.scene?.forceCloseDialogue === 'function') {
        this.scene.forceCloseDialogue({ clearQueue: true });
      }
    } catch (e) {
      // ignore
    }

    const debugEnabled = (() => {
      try { return new URLSearchParams(window.location.search).get('debug') === '1'; } catch (e) { return false; }
    })();

    const setStatus = (msg) => {
      if (!debugEnabled) return;
      try {
        if (typeof this.scene?.__setStatus === 'function') this.scene.__setStatus(msg);
      } catch (e) {}
    };

    const statusLines = (lines) => {
      if (!debugEnabled) return;
      try {
        (Array.isArray(lines) ? lines : [lines]).forEach((l) => setStatus(String(l)));
      } catch (e) {}
    };
    
    try {
      statusLines([`MapManager: changeMap(${mapKey})…`]);

      // Avoid the visible "map unload" flash: fade to black BEFORE destroying old layers.
      // Only do this when there is an existing map to transition away from.
      try {
        const cam = this.scene?.cameras?.main;
        const hasExistingWorld = Boolean(this.map || (this.layers && this.layers.length) || this.collisionLayer);

        if (cam && hasExistingWorld) {
          // Ensure the renderer clears to black while we load the next tilemap.
          try { cam.setBackgroundColor('#000000'); } catch (e) {}

          // If already mid-fade, don't stack effects.
          const isFading = Boolean(cam.fadeEffect && cam.fadeEffect.isRunning);
          if (!isFading) {
            cam.fadeOut(180, 0, 0, 0);

            await new Promise((resolve) => {
              let done = false;
              const finish = () => {
                if (done) return;
                done = true;
                resolve();
              };

              try { cam.once('camerafadeoutcomplete', finish); } catch (e) {}

              // Fallback: never block map loading if the event doesn't fire.
              try {
                if (this.scene?.time?.delayedCall) {
                  this.scene.time.delayedCall(250, finish);
                } else {
                  setTimeout(finish, 250);
                }
              } catch (e) {
                finish();
              }
            });
          }
        }
      } catch (e) {
        // ignore transition errors
      }

        // Stop any existing shake effect
        if (this.shakeTimer) {
        this.shakeTimer.remove();
        this.shakeTimer = null;
        this.scene.cameras.main.resetFX();
    }

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
      setStatus(`Erreur: tilemap "${mapKey}" absente (cache)`);
      return;
    }

    // Nettoyage complet de la map précédente
    if (this.collisionLayer) {
      this.scene.physics.world.colliders.destroy();
      this.collisionLayer.destroy();
      this.collisionLayer = null;
    }

    this.physicsManager.clear();
    this.eventManager.clearEvents();
    this.wildEncounterManager.clear();

    if (this.layers) {
        this.layers.forEach(layer => layer.destroy());
        this.layers = [];
    }

    if (this.objectSprites) {
        this.objectSprites.forEach(sprite => sprite.destroy());
        this.objectSprites = [];
    }

    if (this.teleportZones) {
        this.teleportZones.forEach(zone => zone.destroy());
        this.teleportZones = [];
    }

    if (this.map) {
        this.map.destroy();
        this.map = null;
    }

    // DIAGNOSTIC AVANT CRÉATION
    const mapData = this.scene.cache.tilemap.get(mapKey);
    if (mapData && mapData.data) {
        const rawData = mapData.data;

      // Basic renderer info (helps identify Android WebGL limits causing black tile layers).
      try {
        if (debugEnabled) {
          const renderer = this.scene?.game?.renderer;
          const type = renderer?.type === Phaser.WEBGL ? 'WEBGL' : (renderer?.type === Phaser.CANVAS ? 'CANVAS' : String(renderer?.type));
          let maxTex = null;
          try {
            const gl = renderer?.gl;
            if (gl && typeof gl.getParameter === 'function') {
              maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
            }
          } catch (e) {}
          statusLines([`Renderer: ${type}${maxTex ? ` maxTex=${maxTex}` : ''}`]);
        }
      } catch (e) {}

      // Ensure tileset images referenced by this TMJ are actually loaded.
      // On some Android devices, missing/failed tileset textures result in black (no tile layers), while sprites still render.
      try {
        const requiredTilesetImages = Array.isArray(rawData.tilesets)
          ? rawData.tilesets.filter(ts => ts && ts.name && ts.image)
          : [];

        if (debugEnabled) {
          statusLines([`Map ${mapKey}: tilesets=${requiredTilesetImages.length}`]);
        }

        // Some tilesets are preloaded elsewhere with the same key, but may be too large for Android
        // or may not match the TMJ's expected sliced dimensions. In those cases we force-reload.
        const renderer = this.scene?.game?.renderer;
        const isWebgl = renderer?.type === Phaser.WEBGL;

        const tilesetsToLoad = requiredTilesetImages.filter((ts) => {
          try {
            const name = ts.name;
            const expectedW = Number(ts.imagewidth) || null;
            const expectedH = Number(ts.imageheight) || null;

            if (!this.scene.textures.exists(name)) return true;

            const tex = this.scene.textures.get(name);
            const source = tex?.source?.[0];
            const img = source?.image;
            const w = img?.width;
            const h = img?.height;

            // If TMJ says 1536x4080 but we have 1536x10752 (old atlas), reload to the sliced file.
            if (expectedW && typeof w === 'number' && w !== expectedW) return true;
            if (expectedH && typeof h === 'number' && h !== expectedH) return true;

            // In WebGL, a texture can exist but fail to upload (glTexture null) -> tiles render black.
            if (isWebgl && !source?.glTexture) return true;

            return false;
          } catch (e) {
            return true;
          }
        });

        if (tilesetsToLoad.length > 0) {
          statusLines([`Map ${mapKey}: chargement tilesets manquants (${tilesetsToLoad.length})…`]);

          // Remove stale textures so the loader can re-add them with the same key.
          tilesetsToLoad.forEach((ts) => {
            try {
              if (this.scene.textures.exists(ts.name)) {
                this.scene.textures.remove(ts.name);
              }
            } catch (e) {}
          });

          await new Promise((resolve) => {
            const loader = this.scene.load;
            const wasLoading = typeof loader.isLoading === 'function' ? loader.isLoading() : false;

            const onError = (file) => {
              try {
                const key = file?.key || '';
                const url = file?.src || file?.url || '';
                console.warn('[MapManager] Tileset image load error:', key, url);
                if (debugEnabled) setStatus(`Tileset load error: ${key}`);
              } catch (e) {}
            };

            const onComplete = () => {
              try {
                loader.off('loaderror', onError);
              } catch (e) {}

              const stillMissing = tilesetsToLoad.filter(ts => !this.scene.textures.exists(ts.name)).map(ts => ts.name);
              if (stillMissing.length > 0) {
                setStatus(`Tilesets toujours manquants: ${stillMissing.slice(0, 6).join(', ')}${stillMissing.length > 6 ? '…' : ''}`);
              } else {
                setStatus(`Tilesets manquants: OK (chargés)`);
              }
              resolve();
            };

            loader.once('complete', onComplete);
            loader.on('loaderror', onError);

            tilesetsToLoad.forEach((ts) => {
              const img = String(ts.image || '');
              // TMJ image paths are typically relative to /assets/maps/
              const cleaned = img.replace(/^\.\//, '');
              const url = img.startsWith('/') ? img : `/assets/maps/${cleaned}`;
              loader.image(ts.name, url);
            });

            if (!wasLoading) {
              loader.start();
            }
          });
        }

        // After load attempt: detect problematic tilesets (too large for device, or not uploaded to GPU).
        if (debugEnabled && requiredTilesetImages.length > 0) {
          const renderer = this.scene?.game?.renderer;
          const isWebgl = renderer?.type === Phaser.WEBGL;
          let maxTex = null;
          if (isWebgl) {
            try {
              const gl = renderer?.gl;
              if (gl && typeof gl.getParameter === 'function') maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
            } catch (e) {}
          }

          const oversized = [];
          const notUploaded = [];

          requiredTilesetImages.forEach((ts) => {
            try {
              const name = ts.name;
              const tex = this.scene.textures.get(name);
              const source = tex?.source?.[0];
              const img = source?.image;
              const w = img?.width;
              const h = img?.height;
              if (typeof w === 'number' && typeof h === 'number' && maxTex && (w > maxTex || h > maxTex)) {
                oversized.push(`${name} ${w}x${h}`);
              }
              if (isWebgl) {
                const glTex = source?.glTexture;
                if (!glTex) {
                  // On some devices, texture exists but upload fails -> tiles render black.
                  if (typeof w === 'number' && typeof h === 'number') notUploaded.push(`${name} ${w}x${h}`);
                  else notUploaded.push(name);
                }
              }
            } catch (e) {}
          });

          if (oversized.length > 0) {
            setStatus(`Tilesets trop grands (>${maxTex}): ${oversized.slice(0, 4).join(' | ')}${oversized.length > 4 ? '…' : ''}`);
          }
          if (isWebgl && notUploaded.length > 0) {
            setStatus(`Tilesets non-uploadés GPU: ${notUploaded.slice(0, 4).join(' | ')}${notUploaded.length > 4 ? '…' : ''}`);
          }
        }
      } catch (e) {
        console.warn('[MapManager] ensure tileset textures failed', e);
      }

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
      // Profondeur très basse pour le fond (-100000) pour laisser de la place aux couches négatives (-10000, -20000...)
      this.currentBackgroundImage = this.scene.add.image(0, 0, backgroundImageKey).setOrigin(0).setDepth(-100000);
    } else {
      console.warn(`Aucune image de fond trouvée pour mapId: ${mapId}`);
    }

    // Configure les couches
    this.map.layers.forEach(layerData => {
        const layer = this.map.createLayer(layerData.name, tilesets, 0, 0);
        this.layers.push(layer);
        
        // Gestion de la profondeur via le nom de la couche (ex: "2", "-1")
        // On multiplie par 10000 pour s'assurer que :
        // - Les couches positives (toits) sont au-dessus du joueur (Y ~ 0-5000)
        // - Les couches négatives (sol) sont en-dessous du joueur
        const depth = parseInt(layerData.name, 10);
        if (!isNaN(depth)) {
            layer.setDepth(depth * 10000);
        }

        // Cas spécifique pour la collision (nom "Collision" ou "collision")
        if (layerData.name.toLowerCase() === "collision") {
            this.collisionLayer = layer;
            this.collisionLayer.setCollisionByProperty({ collision: true });
            // On force la profondeur très basse et on cache la couche
            layer.setDepth(-99999); 
            layer.setVisible(false);
        }
    });

    if (!this.collisionLayer) {
      console.warn("[MapManager] Attention: Aucune couche de tuiles 'Collision' trouvée. Vérifiez si vous utilisez uniquement des collisions d'objets.");
    }

    // Debug tile check (optional, kept from original)
    if (this.collisionLayer) {
        var tile = this.collisionLayer.getTileAt(7, 8);
        if (!tile) {
          // console.warn("Aucune tuile trouvée aux coordonnées (7, 8) dans la couche Collision.");
        }
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

    // Gestion des collisions personnalisées (Rectangles Tiled)
    this.physicsManager.createCustomCollisions();

    // Ajoute des collisions pour la nouvelle carte
    if (player) {
      if (this.collisionLayer) {
          this.scene.physics.add.collider(player, this.collisionLayer);
      }
      const customColliders = this.physicsManager.getColliders();
      if (customColliders && customColliders.getLength() > 0) {
          console.log(`[MapManager] Adding collider for ${customColliders.getLength()} custom zones`);
          this.scene.physics.add.collider(player, customColliders);
      }
    }

    // Gestion des couches d'objets (visuels)
    this.createObjectLayers();

    // Zones de rencontre sauvage (rectangles Tiled avec encounterTableId/encounterRate)
    this.wildEncounterManager.loadZonesFromCurrentMap();

    await this.eventManager.loadWorldEvents();
    
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

    // Effet de tremblement pour le métro
    if (mapKey === "metroInterieur") {
        this.startMetroShake();
    }
    } finally {
        this.isTeleporting = false;
    }
  }

    createObjectLayers() {
        if (!this.map.objects) return;

      // Perf: object layers can be very expensive on mobile (lots of sprites / texture switches).
      // Disable rendering by default; opt-in with ?showObjectLayers=1.
      const showObjectLayers = (() => {
        try {
          return new URLSearchParams(window.location.search).get('showObjectLayers') === '1';
        } catch (e) {
          return false;
        }
      })();

        this.map.objects.forEach(layerData => {
            // Ignore la couche "events" qui est gérée séparément
            if (layerData.name === "events") return;

            // Keep depth rules consistent with tile layers (which use depth * 10000).
            // Object layers in Tiled are often named like "2" or "-1".
            const depth = parseInt(layerData.name, 10);
            const effectiveDepth = Number.isFinite(depth) ? depth * 10000 : 10 * 10000;
            
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

                        // If object layers are disabled, only keep collision objects (converted to static rects)
                        // and skip rendering all other tile objects.
                        if (!showObjectLayers) {
                          if (isCollision && obj.width && obj.height) {
                            // Tile objects use bottom-left origin; convert to center coords.
                            const centerX = obj.x + (obj.width / 2);
                            const centerY = obj.y - (obj.height / 2);
                            const rect = this.scene.add.rectangle(centerX, centerY, obj.width, obj.height);
                            rect.setVisible(false);
                            this.scene.physics.add.existing(rect, true);

                            // Ensure custom collider group exists and add.
                            if (!this.physicsManager.customColliders) {
                              this.physicsManager.customColliders = this.scene.physics.add.staticGroup();
                            }
                            this.physicsManager.customColliders.add(rect);
                          }
                          return;
                        }

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

                        sprite.setDepth(effectiveDepth);

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
      this.teleportZones.push(teleportZone);
      
      this.scene.physics.add.overlap(player, teleportZone, () => {
        if (this.isTeleporting) return;

        // Optional gating: require an item in inventory to allow teleport
        if (point.requiredItemName) {
          const inventory = PlayerService.getInventory();
          const hasRequiredItem = Array.isArray(inventory) && inventory.some(i => {
            if (!i) return false;
            if (i.nom !== point.requiredItemName) return false;
            const qty = Number(i.quantite ?? i['quantité'] ?? i.quantity ?? 0) || 0;
            return qty > 0;
          });
          if (!hasRequiredItem) {
            return;
          }
        }

        this.isTeleporting = true;

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

  startMetroShake() {
      // Délai aléatoire entre 2 et 5 secondes
      const delay = Phaser.Math.Between(1000, 3000);
      
      this.shakeTimer = this.scene.time.delayedCall(delay, () => {
          // Vérifie si on est toujours sur la bonne map
          if (this.map && this.map.key === "metroInterieur") {
              // Durée entre 100ms et 200ms
              const duration = Phaser.Math.Between(100, 200);
              // Intensité très faible, uniquement verticale (y)
              // x = 0, y = 0.0005 à 0.0015
              const intensityY = 0.0005 + Math.random() * 0.001;
              
              this.scene.cameras.main.shake(duration, new Phaser.Math.Vector2(0, intensityY));
              
              // Relance le prochain tremblement
              this.startMetroShake();
          }
      });
  }

  handleNPCInteraction(npc) {
      this.eventManager.handleNPCInteraction(npc);
  }

  handleChestInteraction(chest) {
      this.eventManager.handleChestInteraction(chest);
  }

  getNearbyEventObject(playerX, playerY) {
      return this.eventManager.getNearbyEventObject(playerX, playerY);
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
    return this.eventManager.activeEvents;
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
    
    this.eventManager.clearEvents();
    this.physicsManager.clear();
    this.wildEncounterManager.clear();
    this.map = null;
  }
}
