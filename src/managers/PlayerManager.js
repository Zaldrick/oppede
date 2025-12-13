import Phaser from "phaser";
import PlayerService from '../services/PlayerService.js';

const CONFIG = {
  maxSpeed: 350,
  // Configuration pour spritesheet "Marin.png" (2688x1920)
  // Grille : 56 colonnes x 20 lignes (Tiles 48x96)
  // Ligne 2 visuelle (Index 56 à 111) = Idle
  // Ligne 3 visuelle (Index 112 à 167) = Marche (Walk)
  animations: [
    // Idle (Ligne 2)
    { key: "idle-right", start: 56, end: 61, frameRate: 5 },
    { key: "idle-up", start: 62, end: 67, frameRate: 5 },
    { key: "idle-left", start: 68, end: 73, frameRate: 5 },
    { key: "idle-down", start: 74, end: 79, frameRate: 5 },
    // Walk (Ligne 3)
    { key: "walk-right", start: 112, end: 117, frameRate: 10 },
    { key: "walk-up", start: 118, end: 123, frameRate: 10 },
    { key: "walk-left", start: 124, end: 129, frameRate: 10 },
    { key: "walk-down", start: 130, end: 135, frameRate: 10 },
  ],
};

export class PlayerManager {
  constructor(scene) {
    this.scene = scene;
    this.player = null;
    this.isSpeedBoosted = false;
    this.currentAnim = "";
    this.lastDirection = "down"; // Default direction
    this.lastMoveSent = 0;
    this.playerPosition = null;
  }

  async createPlayer(playerData, textureKey, position) {
    if (!playerData) {
      console.error("Player data is not defined!");
      return;
    }

    const useTextureKey = textureKey || "playerAppearance";
    const { x, y } = position || this.playerPosition || { x: 0, y: 0 };
    
    this.player = this.scene.physics.add.sprite(x, y, useTextureKey);
    this.player.setDepth(1); // Ensure player is above floor/walls (depth 0)
    this.player.setCollideWorldBounds(true);
    this.player.body.setMaxVelocity(CONFIG.maxSpeed, CONFIG.maxSpeed);
    this.player.setImmovable(true);
    this.player.body.setSize(36, 36); // Hitbox plus petite pour les pieds
    this.player.body.setOffset(8, 60); // Décalage vers le bas (96 - 32 - 4) pour coller aux pieds

    this.createAnimations(useTextureKey);
    return this.player;
  }

  createAnimations(textureKey) {
    CONFIG.animations.forEach(anim => {
      const animationKey = anim.key;

      if (this.scene.anims.exists(animationKey)) {
        console.warn(`AnimationManager key already exists: ${animationKey}`);
        return;
      }

      this.scene.anims.create({
        key: animationKey,
        frames: this.scene.anims.generateFrameNumbers(textureKey, { start: anim.start, end: anim.end }),
        frameRate: 8,
        repeat: -1,
      });
    });

    if (!this.scene.anims.exists('chest-open')) {
      this.scene.anims.create({
        key: 'chest-open',
        frames: this.scene.anims.generateFrameNumbers('!Chest', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: 0
      });
    }
  }

  handleMovement(cursors, joystick, socket, myId) {
    if (!this.player || !this.player.body || !cursors) return;

    // Block movement if dialogue is active
    if (this.scene.uiManager && this.scene.uiManager.isDialogueActive) {
        this.player.setVelocity(0);
        this.player.anims.stop();
        return;
    }

    // const gridSize = 8; // unused — removed to avoid lint warning
    let newAnim = "";
    let keyboardActive = false;
    const speed = this.isSpeedBoosted ? 300 : 180;

    // Gestion clavier
    if (cursors.left?.isDown) {
      keyboardActive = true;
      newAnim = "walk-left";
      this.lastDirection = "left";
      this.player.setVelocity(-speed, 0);
    } else if (cursors.right?.isDown) {
      keyboardActive = true;
      newAnim = "walk-right";
      this.lastDirection = "right";
      this.player.setVelocity(speed, 0);
    } else if (cursors.up?.isDown) {
      keyboardActive = true;
      newAnim = "walk-up";
      this.lastDirection = "up";
      this.player.setVelocity(0, -speed);
    } else if (cursors.down?.isDown) {
      keyboardActive = true;
      newAnim = "walk-down";
      this.lastDirection = "down";
      this.player.setVelocity(0, speed);
    }

    // Gestion joystick
    if (!keyboardActive && joystick && joystick.force > 0) {
      const angle = joystick.angle;
      if (angle > -45 && angle <= 45) {
        newAnim = "walk-right";
        this.lastDirection = "right";
      } else if (angle > 45 && angle <= 135) {
        newAnim = "walk-down";
        this.lastDirection = "down";
      } else if (angle > 135 || angle <= -135) {
        newAnim = "walk-left";
        this.lastDirection = "left";
      } else if (angle > -135 && angle <= -45) {
        newAnim = "walk-up";
        this.lastDirection = "up";
      }
      const forceCoeff = this.isSpeedBoosted ? 2.5 : 1.5;
      this.player.setVelocityX(Math.cos(Phaser.Math.DegToRad(angle)) * joystick.force * forceCoeff);
      this.player.setVelocityY(Math.sin(Phaser.Math.DegToRad(angle)) * joystick.force * forceCoeff);
    }

    // Animation
    if (newAnim === "") {
      this.player.setVelocity(0);
      const idleAnim = `idle-${this.lastDirection}`;
      if (this.currentAnim !== idleAnim) {
        this.player.anims.play(idleAnim, true);
        this.currentAnim = idleAnim;
      }
      this.currentAnim = "";
    } else if (newAnim !== this.currentAnim) {
      this.player.anims.play(newAnim, true);
      this.currentAnim = newAnim;
    }

    // Envoi position socket
    if (socket && myId) {
      const currentMapId = PlayerService.getPlayerData()?.mapId;
      socket.emit('playerMove', {
        x: this.player.x,
        y: this.player.y,
        anim: this.currentAnim,
        mapId: currentMapId,
      });
    }
  }

  sendMovementUpdate(socket, myId) {
    const now = Date.now();
    if (socket && myId && now - this.lastMoveSent > 50) {
      const currentMapId = PlayerService.getPlayerData()?.mapId;
      socket.emit('playerMove', {
        x: this.player.x,
        y: this.player.y,
        anim: this.currentAnim,
        mapId: currentMapId,
      });
      this.lastMoveSent = now;
    }
  }

  async updatePositionInDB() {
    if (!this.player || !this.scene.registry.get("playerData")) {
      console.warn("Player or player data is not initialized. Skipping position update.");
      return;
    }

    const playerData = this.scene.registry.get("playerData");
    const playerPseudo = playerData.pseudo;
    const posX = this.player.x;
    const posY = this.player.y;
    const mapId = playerData.mapId;

    console.log(`[PlayerManager] Saving position to DB: x=${Math.round(posX)}, y=${Math.round(posY)}, mapId=${mapId}`);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/players/update-position`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: playerPseudo, posX, posY, mapId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update player position. HTTP status: ${response.status}, Response: ${errorText}`);
      }
    } catch (error) {
      console.error("Error updating player position:", error);
    }
  }

  setSpeedBoost(boosted) {
    this.isSpeedBoosted = boosted;
  }

  setPlayerPosition(position) {
    this.playerPosition = position;
  }

  getPlayer() {
    return this.player;
  }

  getCurrentAnim() {
    return this.currentAnim;
  }

  destroy() {
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
  }
}