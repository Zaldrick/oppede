import Phaser from "phaser";
import io from 'socket.io-client';

const CONFIG = {
  maxSpeed: 200,
  worldBounds: { width: 860, height: 430 },
  joystick: {
    baseColor: 0x888888,
    thumbColor: 0xffffff,
    radiusFactor: 0.1,
    thumbRadiusFactor: 0.5,
  },
  animations: [
    { key: "walk-down", start: 0, end: 2 },
    { key: "walk-left", start: 3, end: 5 },
    { key: "walk-right", start: 6, end: 8 },
    { key: "walk-up", start: 9, end: 11 },
  ],
};

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  preload() {
    this.loadAssets();
  }

  create() {
    this.setupWorld();
    this.createPlayer();
    this.createAnimations();
    this.setupCamera();
    this.setupControls();
    this.setupSocket();
    this.createUI();
  }

  update() {
    this.handlePlayerMovement();
    this.updateRemotePlayers();
  }

  loadAssets() {
    this.load.image("background", "/assets/fond.jpg");
    this.load.spritesheet("player", "/assets/joueur.png", {
      frameWidth: 48,
      frameHeight: 48,
    });
  }

  setupWorld() {
    this.add.image(CONFIG.worldBounds.width / 2, CONFIG.worldBounds.height / 2, "background");
    this.physics.world.setBounds(0, 0, CONFIG.worldBounds.width, CONFIG.worldBounds.height);
    this.cameras.main.setBounds(0, 0, CONFIG.worldBounds.width, CONFIG.worldBounds.height);
  }

  createPlayer() {
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;
    this.player = this.physics.add.sprite(centerX, centerY, "player");
    this.player.setCollideWorldBounds(true);
    this.player.body.setMaxVelocity(CONFIG.maxSpeed, CONFIG.maxSpeed);
    this.remotePlayersGroup = this.physics.add.group();
    this.physics.add.collider(this.player, this.remotePlayersGroup, this.handleCollision, null, this);
  }

  createAnimations() {
    CONFIG.animations.forEach(anim => {
      this.anims.create({
        key: anim.key,
        frames: this.anims.generateFrameNumbers("player", { start: anim.start, end: anim.end }),
        frameRate: 8,
        repeat: -1,
      });
    });
  }

  setupCamera() {
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
  }

  setupControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    const joystickX = this.scale.width * 0.15;
    const joystickY = this.scale.height * 0.85;
    const joystickRadius = Math.min(this.scale.width, this.scale.height) * CONFIG.joystick.radiusFactor;
    const thumbRadius = joystickRadius * CONFIG.joystick.thumbRadiusFactor;
    this.joystick = this.plugins.get("rexVirtualJoystick").add(this, {
      x: joystickX,
      y: joystickY,
      radius: joystickRadius,
      base: this.add.circle(0, 0, joystickRadius, CONFIG.joystick.baseColor),
      thumb: this.add.circle(0, 0, thumbRadius, CONFIG.joystick.thumbColor),
    });
    this.joystick.on("update", this.handleJoystickUpdate, this);
    this.scale.on("resize", this.handleResize, this);
    this.input.once("pointerup", this.handlePointerUp, this);
    window.addEventListener("orientationchange", this.handleOrientationChange);
  }

  setupSocket() {
    this.socket = io('http://localhost:5000');
    this.otherPlayers = {};
    this.latestPlayersData = {};
  
    // Événements socket existants
    this.socket.on('connect', this.handleSocketConnect, this);
    this.socket.on('playersUpdate', this.handlePlayersUpdate, this);
  
    this.socket.on('interactionFeedback', (data) => {
      if (data.type === 'emitter') {
        this.displayMessage(`Vous avez fait signe au joueur ${data.to}`);
      } else if (data.type === 'receiver') {
        this.displayMessage(`Le joueur ${data.from} vous fait signe !`);
      }
    });
  }

  createUI() {
    const gameWidth = this.cameras.main.width;
    const gameHeight = this.cameras.main.height;
    this.interactButton = this.add.circle(gameWidth - 400, gameHeight - 400, 100, 0x808080)
      .setInteractive()
      .on('pointerdown', this.handleInteractButton, this);
    this.interactButton.setScrollFactor(0);
    this.interactButtonText = this.add.text(gameWidth - 400, gameHeight - 400, "A", {
      font: "60px Arial",
      fill: "#ffffff",
      align: "center"
    }).setOrigin(0.5);
    this.interactButtonText.setScrollFactor(0);
  }

  handlePlayerMovement() {
    let newAnim = "";
    let keyboardActive = false;
    if (this.cursors.left.isDown) {
      keyboardActive = true;
      newAnim = "walk-left";
      this.player.setVelocity(-200, 0);
    } else if (this.cursors.right.isDown) {
      keyboardActive = true;
      newAnim = "walk-right";
      this.player.setVelocity(200, 0);
    } else if (this.cursors.up.isDown) {
      keyboardActive = true;
      newAnim = "walk-up";
      this.player.setVelocity(0, -200);
    } else if (this.cursors.down.isDown) {
      keyboardActive = true;
      newAnim = "walk-down";
      this.player.setVelocity(0, 200);
    }
    if (!keyboardActive && this.joystick && this.joystick.force > 0) {
      const angle = this.joystick.angle;
      if (angle > -45 && angle <= 45) {
        newAnim = "walk-right";
      } else if (angle > 45 && angle <= 135) {
        newAnim = "walk-down";
      } else if (angle > 135 || angle <= -135) {
        newAnim = "walk-left";
      } else if (angle > -135 && angle <= -45) {
        newAnim = "walk-up";
      }
      this.player.setVelocityX(Math.cos(Phaser.Math.DegToRad(angle)) * this.joystick.force * 2);
      this.player.setVelocityY(Math.sin(Phaser.Math.DegToRad(angle)) * this.joystick.force * 2);
    }
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
    if (this.socket && this.myId) {
      this.socket.emit('playerMove', { x: this.player.x, y: this.player.y, anim: this.currentAnim });
    }
  }

  updateRemotePlayers() {
    if (this.latestPlayersData) {
      Object.keys(this.latestPlayersData).forEach((id) => {
        if (id === this.myId) return;
        const data = this.latestPlayersData[id];
        if (!this.otherPlayers[id]) {
          let newSprite = this.physics.add.sprite(data.x, data.y, "player");
          newSprite.setCollideWorldBounds(true);
          newSprite.setImmovable(true);
          newSprite.currentAnim = data.anim || "";
          newSprite.setInteractive();
          this.remotePlayersGroup.add(newSprite);
          newSprite.on('pointerdown', () => {
            this.openInteractionMenu(id, newSprite);
          });
          this.otherPlayers[id] = newSprite;
          if (data.anim) {
            newSprite.anims.play(data.anim, true);
          }
        } else {
          const lerpFactor = 0.2;
          let targetX = data.x;
          let targetY = data.y;
          let newX = Phaser.Math.Linear(this.otherPlayers[id].x, targetX, lerpFactor);
          let newY = Phaser.Math.Linear(this.otherPlayers[id].y, targetY, lerpFactor);
          if (Math.abs(newX - targetX) < 1) {
            this.otherPlayers[id].x = targetX;
          } else {
            this.otherPlayers[id].x = newX;
          }
          if (Math.abs(newY - targetY) < 1) {
            this.otherPlayers[id].y = targetY;
          } else {
            this.otherPlayers[id].y = newY;
          }
          if (data.anim) {
            if (this.otherPlayers[id].currentAnim !== data.anim) {
              this.otherPlayers[id].anims.play(data.anim, true);
              this.otherPlayers[id].currentAnim = data.anim;
            }
          } else {
            if (this.otherPlayers[id].anims.isPlaying) {
              this.otherPlayers[id].anims.stop();
            }
            this.otherPlayers[id].currentAnim = "";
          }
        }
      });
      Object.keys(this.otherPlayers).forEach((id) => {
        if (!this.latestPlayersData[id]) {
          this.otherPlayers[id].destroy();
          delete this.otherPlayers[id];
        }
      });
    }
  }
  
  handleCollision(localPlayer, remotePlayer) {
    console.log("Collision détectée entre le joueur local et un joueur distant.");
  }

  handleJoystickUpdate() {
    const rawAngleRad = Phaser.Math.DegToRad(this.joystick.angle);
    const normalizedAngle = Phaser.Math.Angle.Wrap(rawAngleRad);
    const force = this.joystick.force * 2;
    this.player.setVelocityX(Math.cos(normalizedAngle) * force);
    this.player.setVelocityY(Math.sin(normalizedAngle) * force);
  }

  handleResize(gameSize) {
    const newJoystickX = gameSize.width * 0.15;
    const newJoystickY = gameSize.height * 0.85;
    this.joystick.setPosition(newJoystickX, newJoystickY);
  }

  handlePointerUp() {
    if (!this.scale.isFullscreen) {
      this.scale.startFullscreen();
    }
  }

  handleOrientationChange() {
    if (window.orientation === 90 || window.orientation === -90) {
      console.log("Mode paysage");
    } else {
      alert("Pour une meilleure expérience, veuillez tourner votre téléphone en mode paysage !");
    }
  }

  handleSocketConnect() {
    this.myId = this.socket.id;
    console.log("Connecté avec id:", this.myId);
    this.socket.emit('newPlayer', {
      x: this.player.x,
      y: this.player.y,
      character: 'default'
    });
  }

  handlePlayersUpdate(players) {
    this.latestPlayersData = players;
  }

  handleInteractionFeedback(data) {
    if (data.from === this.myId || data.to === this.myId) {
      const message = (data.action === "defier")
        ? `Le joueur ${data.from} vous a défié !`
        : `Le joueur ${data.from} vous fait signe !`;
  
      this.displayMessage(message);
    }
  }

  handleInteractButton() {
    let targetId = this.getNearestRemotePlayer();
    if (targetId) {
      this.showInteractionMenu(targetId);
    } else {
      this.displayMessage("Aucun joueur à proximité pour l'interaction");
    }
  }


  showInteractionMenu(targetId) {
    // Supprime un menu existant s'il est déjà ouvert
    if (this.interactionMenu) {
      this.interactionMenu.destroy();
    }

    // Crée un conteneur pour le mini-menu
    const menuX = this.player.x + 100; // Position par rapport au joueur
    const menuY = this.player.y - 100;

    this.interactionMenu = this.add.container(menuX, menuY);

    // Ajoute un rectangle de fond
    const background = this.add.rectangle(0, 0, 200, 150, 0x000000, 0.8)
      .setOrigin(0.5);
    this.interactionMenu.add(background);

    // Affiche l'ID du joueur cible
    const title = this.add.text(0, -50, `Joueur: ${targetId}`, {
      font: "18px Arial",
      fill: "#ffffff",
    }).setOrigin(0.5);
    this.interactionMenu.add(title);

    // Crée les options du menu
    const option1 = this.add.text(0, -10, "Défier", {
      font: "16px Arial",
      fill: "#ffffff",
      backgroundColor: "#333333",
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setInteractive();
    const option2 = this.add.text(0, 30, "Faire signe", {
      font: "16px Arial",
      fill: "#ffffff",
      backgroundColor: "#333333",
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setInteractive();
    const option3 = this.add.text(0, 70, "Retour", {
      font: "16px Arial",
      fill: "#ffffff",
      backgroundColor: "#333333",
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setInteractive();

    // Ajoute les options au conteneur
    this.interactionMenu.add(option1);
    this.interactionMenu.add(option2);
    this.interactionMenu.add(option3);

    // Ajoute les événements pour chaque option
    option1.on("pointerdown", () => {
      this.socket.emit('interaction', {
        from: this.myId,
        to: targetId,
        message: "Défier le joueur",
      });
      this.displayMessage(`Vous avez défié le joueur ${targetId}`);
      this.interactionMenu.destroy();
    });

    option2.on("pointerdown", () => {
      this.socket.emit('interaction', {
        from: this.myId,
        to: targetId,
        message: "Faire signe au joueur",
      });
      this.displayMessage(`Vous avez fait signe au joueur ${targetId}`);
      this.interactionMenu.destroy();
    });

    option3.on("pointerdown", () => {
      this.interactionMenu.destroy();
    });
  }


  getNearestRemotePlayer() {
    let nearestId = null;
    let minDistance = Number.MAX_VALUE;
    Object.keys(this.otherPlayers).forEach((id) => {
      let remote = this.otherPlayers[id];
      let distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, remote.x, remote.y);
      if (distance < minDistance) {
        minDistance = distance;
        nearestId = id;
      }
    });
    return (minDistance < 300) ? nearestId : null;
  }

  displayMessage(text) {
    let style = { font: "18px Arial", fill: "#ffffff", backgroundColor: "#000000", padding: { x: 10, y: 5 } };
    let messageText = this.add.text(430, 50, text, style).setOrigin(0.5);
    this.time.delayedCall(3000, () => {
      messageText.destroy();
    });
  }
}
