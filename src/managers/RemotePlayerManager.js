import Phaser from "phaser";

const CONFIG = {
  animations: [
    { key: "walk-down", start: 0, end: 2 },
    { key: "walk-left", start: 3, end: 5 },
    { key: "walk-right", start: 6, end: 8 },
    { key: "walk-up", start: 9, end: 11 },
  ],
};

export class RemotePlayerManager {
  constructor(scene) {
    this.scene = scene;
    this.otherPlayers = {};
    this.latestPlayersData = {};
    this.remotePlayersGroup = null;
  }

  initialize(playerManager) {
    this.remotePlayersGroup = this.scene.physics.add.group({
      immovable: true,
    });
    
    // Collision avec le joueur local
    this.scene.physics.add.collider(playerManager.getPlayer(), this.remotePlayersGroup, 
      (localPlayer, remotePlayer) => {
        this.handleCollision(localPlayer, remotePlayer);
      });
  }

  handlePlayersUpdate(players, currentMapId, myId) {
    // Supprime les joueurs qui ne sont plus sur la m�me carte ou absents
    Object.keys(this.otherPlayers).forEach((id) => {
      if (!players[id] || players[id].mapId !== currentMapId) {
        if (this.otherPlayers[id].sprite) this.otherPlayers[id].sprite.destroy();
        if (this.otherPlayers[id].pseudoText) this.otherPlayers[id].pseudoText.destroy();
        delete this.otherPlayers[id];
      }
    });

    // Cr�e ou met � jour les joueurs distants
    Object.keys(players).forEach((id) => {
      if (id !== myId && players[id].mapId === currentMapId) {
        const characterKey = players[id].character;
        
        if (!this.scene.textures.exists(characterKey)) {
          this.scene.load.spritesheet(characterKey, characterKey, {
            frameWidth: 48,
            frameHeight: 48,
          });
          this.scene.load.once('complete', () => {
            this.createRemotePlayer(id, players[id], characterKey);
          });
          this.scene.load.start();
        } else {
          if (!this.otherPlayers[id]) {
            this.createRemotePlayer(id, players[id], characterKey);
          } else {
            this.updateRemotePlayerPosition(id, players[id], characterKey);
          }
        }
      }
    });

    this.latestPlayersData = players;
  }

  updateRemotePlayers() {
    if (!this.latestPlayersData) return;

    const currentMapId = this.scene.registry.get("playerData")?.mapId;
    if (currentMapId === undefined) return;

    const toCreate = [];

    Object.keys(this.latestPlayersData).forEach((id) => {
      if (id === this.scene.myId) return;
      const data = this.latestPlayersData[id];
      const textureKey = `appearance-${data.pseudo}`;

      if (data.mapId === currentMapId && !this.otherPlayers[id]) {
        if (!this.scene.textures.exists(textureKey)) {
          if (!this.scene.load.isLoading()) {
            this.scene.load.spritesheet(textureKey, `/assets/apparences/${data.pseudo}.png`, {
              frameWidth: 48,
              frameHeight: 48,
            });
            toCreate.push({ id, data, textureKey });
            this.scene.load.once('complete', () => {
              toCreate.forEach(({ id, data, textureKey }) => {
                this.createRemotePlayer(id, data, textureKey);
              });
            });
            this.scene.load.start();
          }
        } else {
          this.createRemotePlayer(id, data, textureKey);
        }
      } else if (data.mapId === currentMapId) {
        this.updateRemotePlayerPosition(id, data, textureKey);
      }
    });

    // Supprime les joueurs qui ne sont plus sur la m�me carte ou absents
    Object.keys(this.otherPlayers).forEach((id) => {
      if (!this.latestPlayersData[id] || this.latestPlayersData[id].mapId !== currentMapId) {
        if (this.otherPlayers[id].pseudoText) {
          this.otherPlayers[id].pseudoText.destroy();
        }
        if (this.otherPlayers[id].sprite) {
          this.otherPlayers[id].sprite.destroy();
        }
        delete this.otherPlayers[id];
      }
    });
  }

  createRemotePlayer(id, data, textureKey) {
    // Supprime tout sprite existant pour �viter les r�sidus
    if (this.otherPlayers[id]) {
      if (this.otherPlayers[id].pseudoText) {
        this.otherPlayers[id].pseudoText.destroy();
      }
      if (this.otherPlayers[id].sprite) {
        this.otherPlayers[id].sprite.destroy();
      }
      delete this.otherPlayers[id];
    }

    // V�rifie que la texture est bien charg�e
    if (!this.scene.textures.exists(textureKey)) {
      console.warn(`Texture "${textureKey}" not loaded for player ${data.pseudo}, skipping sprite creation.`);
      return;
    }

    const newSprite = this.scene.physics.add.sprite(data.x, data.y, textureKey);
    newSprite.setDepth(1); // Ensure remote players are visible
    newSprite.setCollideWorldBounds(true);
    newSprite.setImmovable(true);
    newSprite.currentAnim = data.anim || "";
    newSprite.setInteractive();

    newSprite.id = id;
    newSprite.pseudo = data.pseudo;
    this.remotePlayersGroup.add(newSprite);

    // Ajoute le pseudo au-dessus du sprite
    const pseudoText = this.scene.add.text(data.x, data.y - 29, data.pseudo, {
      font: "18px Arial",
      fill: "#ffffff",
      align: "center",
    }).setOrigin(0.5).setDepth(100);

    // Stocke un objet {sprite, pseudoText}
    this.otherPlayers[id] = { sprite: newSprite, pseudoText };

    // Cr�e dynamiquement les animations pour ce joueur
    CONFIG.animations.forEach((anim) => {
      const animationKey = `${textureKey}-${anim.key}`;
      if (!this.scene.anims.exists(animationKey)) {
        this.scene.anims.create({
          key: animationKey,
          frames: this.scene.anims.generateFrameNumbers(textureKey, { start: anim.start, end: anim.end }),
          frameRate: 8,
          repeat: -1,
        });
      }
    });

    if (data.anim) {
      newSprite.anims.play(`${textureKey}-${data.anim}`, true);
    }
  }

  updateRemotePlayerPosition(id, data, textureKey) {
    const lerpFactor = 0.2;
    const targetX = data.x;
    const targetY = data.y;
    const remoteObj = this.otherPlayers[id];
    if (!remoteObj) return;
    
    const remote = remoteObj.sprite;
    const newX = Phaser.Math.Linear(remote.x, targetX, lerpFactor);
    const newY = Phaser.Math.Linear(remote.y, targetY, lerpFactor);
    remote.x = Math.abs(newX - targetX) < 1 ? targetX : newX;
    remote.y = Math.abs(newY - targetY) < 1 ? targetY : newY;

    // Met � jour la position du pseudoText
    if (remoteObj.pseudoText) {
      remoteObj.pseudoText.setPosition(remote.x, remote.y - 29);
    }

    if (data.anim && remote.currentAnim !== data.anim) {
      const animationKey = `${textureKey}-${data.anim}`;
      if (this.scene.anims.exists(animationKey)) {
        remote.anims.play(animationKey, true);
        remote.currentAnim = data.anim;
      }
    } else if (!data.anim && remote.currentAnim) {
      remote.anims.stop();
      remote.currentAnim = null;
    }
  }

  handleCollision(localPlayer, remotePlayer) {
    // Emp�che les vibrations en d�sactivant les forces de r�solution automatiques
    const overlapX = localPlayer.x - remotePlayer.x;
    const overlapY = localPlayer.y - remotePlayer.y;

    // Ajuste la position du joueur local pour �viter les vibrations
    if (Math.abs(overlapX) > Math.abs(overlapY)) {
      localPlayer.x += overlapX > 0 ? 1 : -1;
    } else {
      localPlayer.y += overlapY > 0 ? 1 : -1;
    }
  }

  getNearestRemotePlayer(playerX, playerY) {
    let nearestId = null;
    let minDistance = Number.MAX_VALUE;
    
    Object.keys(this.otherPlayers).forEach((id) => {
      let remote = this.otherPlayers[id].sprite;
      let distance = Phaser.Math.Distance.Between(playerX, playerY, remote.x, remote.y);
      if (distance < minDistance) {
        minDistance = distance;
        nearestId = id;
      }
    });
    
    return (minDistance < 100) ? nearestId : null;
  }

  setLatestPlayersData(data) {
    this.latestPlayersData = data;
  }

  getLatestPlayersData() {
    return this.latestPlayersData;
  }

  getOtherPlayers() {
    return this.otherPlayers;
  }

  destroy() {
    Object.keys(this.otherPlayers).forEach((id) => {
      if (this.otherPlayers[id].sprite) this.otherPlayers[id].sprite.destroy();
      if (this.otherPlayers[id].pseudoText) this.otherPlayers[id].pseudoText.destroy();
    });
    this.otherPlayers = {};
    
    if (this.remotePlayersGroup) {
      this.remotePlayersGroup.clear(true, true);
    }
  }
}