import Phaser from "phaser";
import PlayerService from '../services/PlayerService.js';

const CONFIG = {
  maxSpeed: 350,
  animations: [
    { key: "walk-down", start: 0, end: 2 },
    { key: "walk-left", start: 3, end: 5 },
    { key: "walk-right", start: 6, end: 8 },
    { key: "walk-up", start: 9, end: 11 },
  ],
};

export class PlayerManager {
  constructor(scene) {
    this.scene = scene;
    this.player = null;
    this.isSpeedBoosted = false;
    this.currentAnim = "";
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
    this.player.setCollideWorldBounds(true);
    this.player.body.setMaxVelocity(CONFIG.maxSpeed, CONFIG.maxSpeed);
    this.player.setImmovable(true);
    this.player.body.setSize(36, 36);
    this.player.body.setOffset(6, 6);

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

    // const gridSize = 8; // unused — removed to avoid lint warning
    let newAnim = "";
    let keyboardActive = false;
    const speed = this.isSpeedBoosted ? 300 : 180;

    // Gestion clavier
    if (cursors.left?.isDown) {
      keyboardActive = true;
      newAnim = "walk-left";
      this.player.setVelocity(-speed, 0);
    } else if (cursors.right?.isDown) {
      keyboardActive = true;
      newAnim = "walk-right";
      this.player.setVelocity(speed, 0);
    } else if (cursors.up?.isDown) {
      keyboardActive = true;
      newAnim = "walk-up";
      this.player.setVelocity(0, -speed);
    } else if (cursors.down?.isDown) {
      keyboardActive = true;
      newAnim = "walk-down";
      this.player.setVelocity(0, speed);
    }

    // Gestion joystick
    if (!keyboardActive && joystick && joystick.force > 0) {
      const angle = joystick.angle;
      if (angle > -45 && angle <= 45) {
        newAnim = "walk-right";
      } else if (angle > 45 && angle <= 135) {
        newAnim = "walk-down";
      } else if (angle > 135 || angle <= -135) {
        newAnim = "walk-left";
      } else if (angle > -135 && angle <= -45) {
        newAnim = "walk-up";
      }
      const forceCoeff = this.isSpeedBoosted ? 2.5 : 1.5;
      this.player.setVelocityX(Math.cos(Phaser.Math.DegToRad(angle)) * joystick.force * forceCoeff);
      this.player.setVelocityY(Math.sin(Phaser.Math.DegToRad(angle)) * joystick.force * forceCoeff);
    }

    // Animation
    if (newAnim === "") {
      this.player.setVelocity(0);
      if (this.player.anims.isPlaying) {
        this.player.anims.stop();
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