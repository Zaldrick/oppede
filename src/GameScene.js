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
    this.load.image("background", "/assets/interieur.png"); // Update background image
    this.load.spritesheet("player", "/assets/joueur.png", {
      frameWidth: 48,
      frameHeight: 48,
    });
  }

  setupWorld() {
    const worldWidth = 1536; // Match the new image size
    const worldHeight = 2160; // Match the new image size
    this.add.image(worldWidth / 2, worldHeight / 2, "background");
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
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
    this.zoomFactor = Math.min(this.scale.width / 768, this.scale.height / 1080) * 1.75; // Adjust zoom factor
    this.cameras.main.setZoom(this.zoomFactor); // Apply zoom
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
  }

  setupControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.scale.on("resize", this.handleResize, this);
    //this.input.once("pointerup", this.handlePointerUp, this);
    //window.addEventListener("orientationchange", this.handleOrientationChange);
  }

  setupSocket() {
    this.socket = io('https://a1ff-89-82-23-250.ngrok-free.app'); // Updated ngrok URL
    this.otherPlayers = {};
    this.latestPlayersData = {};

    this.socket.on('connect', () => {
        if (this.socket && this.socket.id) {
            this.myId = this.socket.id;
            this.socket.emit('newPlayer', {
                x: this.player.x,
                y: this.player.y,
                character: 'default'
            });
        }
    });

    this.socket.on('playersUpdate', (players) => {
        this.latestPlayersData = players;
    });
}

  createUI() {
    const gameWidth = this.scale.width;
    const gameHeight = this.scale.height;

    // Joystick (bottom-left corner)
    const joystickRadius = gameWidth * 0.12 / this.zoomFactor; // Adjust for zoom
    this.joystick = this.plugins.get("rexVirtualJoystick").add(this, {
        x: gameWidth * 0.13,
        y: gameHeight * 0.82,
        radius: joystickRadius,
        base: this.add.circle(0, 0, joystickRadius, CONFIG.joystick.baseColor),
        thumb: this.add.circle(0, 0, joystickRadius * CONFIG.joystick.thumbRadiusFactor, CONFIG.joystick.thumbColor),
    });
    this.joystick.setScrollFactor(0);

    // Bouton A (bottom-right corner, slightly above B)
    const buttonARadius = gameWidth * 0.07 / this.zoomFactor;
    this.buttonA = this.add.circle(gameWidth * 0.92, gameHeight * 0.79, buttonARadius, 0x808080)
        .setInteractive()
        .on('pointerdown', () => this.handleButtonA());
    this.buttonAText = this.add.text(gameWidth * 0.92, gameHeight * 0.79, "A", {
        font: `${gameWidth * 0.06 / this.zoomFactor}px Arial`,
        fill: "#ffffff",
        align: "center"
    }).setOrigin(0.5);
    this.buttonA.setScrollFactor(0);
    this.buttonAText.setScrollFactor(0);

    // Bouton B (bottom-right corner, below A)
    const buttonBRadius = gameWidth * 0.07 / this.zoomFactor;
    this.buttonB = this.add.circle(gameWidth * 0.75, gameHeight * 0.85, buttonBRadius, 0x808080)
        .setInteractive()
        .on('pointerdown', () => this.handleButtonB());
    this.buttonBText = this.add.text(gameWidth * 0.75, gameHeight * 0.85, "B", {
        font: `${gameWidth * 0.06 / this.zoomFactor}px Arial`,
        fill: "#ffffff",
        align: "center"
    }).setOrigin(0.5);
    this.buttonB.setScrollFactor(0);
    this.buttonBText.setScrollFactor(0);

    // Bouton Start (center-bottom, slightly above the bottom edge)
    const startButtonWidth = gameWidth * 0.23 / this.zoomFactor;
    const startButtonHeight = gameHeight * 0.05 / this.zoomFactor;
    this.startButton = this.add.rectangle(gameWidth * 0.5, gameHeight * 0.90, startButtonWidth, startButtonHeight, 0x808080)
        .setInteractive()
        .on('pointerdown', () => this.handleStartButton());
    this.startButtonText = this.add.text(gameWidth * 0.5, gameHeight * 0.90, "Start", {
        font: `${gameWidth * 0.06 / this.zoomFactor}px Arial`,
        fill: "#ffffff",
        align: "center"
    }).setOrigin(0.5);
    this.startButton.setScrollFactor(0);
    this.startButtonText.setScrollFactor(0);
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
                    this.showInteractionMenu(id, newSprite);
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
    console.log("handleInteractionFeedback called with data:", data); // Debug log

    if (data.from === this.myId || data.to === this.myId) {
        const message = (data.action === "defier")
            ? `Le joueur ${data.from}\n vous a défié !`
            : `Le joueur ${data.from}\n vous fait signe !`;

        this.displayMessage(message);
    }
}

  handleButtonA = () => {
    let targetId = this.getNearestRemotePlayer();
    if (targetId) {
        this.showInteractionMenu(targetId);
    } else {
        this.displayMessage("Aucun joueur à proximité\n pour l'interaction");
    }
}

showInteractionMenu = (targetId) => {
    // Destroy an existing interaction menu if it is already open
    if (this.interactionMenu) {
        this.interactionMenu.destroy();
        this.interactionMenu = null;
    }

    // Create a container for the interaction menu
    const menuX = this.player.x + 100; // Position relative to the player
    const menuY = this.player.y - 100;

    this.interactionMenu = this.add.container(menuX, menuY);

    // Add a background rectangle
    const background = this.add.rectangle(0, 0, 160, 125, 0x000000, 0.8).setOrigin(0.5);
    this.interactionMenu.add(background);

    // Display the target player's ID
    const title = this.add.text(0, -80, `Joueur: ${targetId}`, {
        font: "20px Arial",
        fill: "#ffffff",
    }).setOrigin(0.5);
    this.interactionMenu.add(title);

    // Create menu options
    const option1 = this.add.text(0, -35, "Défier", {
        font: "18px Arial",
        fill: "#ffffff",
        backgroundColor: "#333333",
        padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setInteractive();
    const option2 = this.add.text(0, 5, "Faire signe", {
        font: "18px Arial",
        fill: "#ffffff",
        backgroundColor: "#333333",
        padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setInteractive();
    const option3 = this.add.text(0, 45, "Retour", {
        font: "18px Arial",
        fill: "#ffffff",
        backgroundColor: "#333333",
        padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setInteractive();

    // Add options to the container
    this.interactionMenu.add(option1);
    this.interactionMenu.add(option2);
    this.interactionMenu.add(option3);

    // Add events for each option
    option1.on("pointerdown", () => {
        this.displayMessage(`Vous avez défié \nle joueur ${targetId}`);
        this.interactionMenu.destroy();
        this.interactionMenu = null; // Ensure proper cleanup
    });

    option2.on("pointerdown", () => {
        this.displayMessage(`Vous avez fait signe \nau joueur ${targetId}`);
        this.interactionMenu.destroy();
        this.interactionMenu = null; // Ensure proper cleanup
    });

    option3.on("pointerdown", () => {
        this.interactionMenu.destroy();
        this.interactionMenu = null; // Ensure proper cleanup
    });
}

  handleButtonB() {
    if (this.interactionMenu) {
      this.interactionMenu.destroy();
      this.interactionMenu = null;
    } else if (this.startMenu) {
      this.startMenu.destroy();
      this.startMenu = null;
    }
  }

  handleStartButton() {
    // Ensure any open interaction menu is properly destroyed
    if (this.interactionMenu) {
        this.interactionMenu.destroy();
        this.interactionMenu = null;
    }

    // Destroy an existing start menu before creating a new one
    if (this.startMenu) {
        this.startMenu.destroy();
    }

    const playerX = this.player.x; // Player's current X position
    const playerY = this.player.y; // Player's current Y position
    const gameWidth = this.scale.width;
    const gameHeight = this.scale.height;

    // Create the start menu container relative to the player's position, slightly lower
    this.startMenu = this.add.container(playerX, playerY - gameHeight * 0.15);

    // Background rectangle
    const background = this.add.rectangle(0, 0, gameWidth * 0.8, gameHeight * 0.6, 0x000000, 0.8).setOrigin(0.5);
    this.startMenu.add(background);

    // Menu options
    const options = [
        { label: "Inventaire", action: () => this.openInventory() },
        { label: "Profil", action: () => this.openProfile() },
        { label: "Message", action: () => this.openMessages() },
        { label: "Retour", action: () => this.closeMenu() }
    ];

    options.forEach((option, index) => {
        const optionY = -gameHeight * 0.2 + index * (gameHeight * 0.14);

        // Create a clickable background rectangle for each option
        const optionBackground = this.add.rectangle(0, optionY, gameWidth * 0.7, gameHeight * 0.1, 0x333333, 0.8)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        optionBackground.on('pointerdown', () => {
            console.log(`Menu option clicked: ${option.label}`); // Log when an option is clicked
            option.action(); // Trigger the associated action
        });

        // Add the text on top of the rectangle
        const optionText = this.add.text(0, optionY, option.label, {
            font: `${gameWidth * 0.08}px Arial`,
            fill: "#ffffff",
            align: "center"
        }).setOrigin(0.5);

        this.startMenu.add(optionBackground);
        this.startMenu.add(optionText);
    });

    // Ensure the menu moves with the camera
    this.startMenu.setScrollFactor(1);
}

closeMenu = () => {
    if (this.startMenu) {
        this.startMenu.destroy();
        this.startMenu = null;
    }
}

openInventory = () => {
    this.displayMessage("Ouverture de l'inventaire...");
    // Add logic to open the inventory
    this.closeMenu();
}

openProfile = () => {
    this.displayMessage("Ouverture du profil...");
    // Add logic to open the profile
    this.closeMenu();
}

openMessages = () => {    
  this.displayMessage("Messages ...");
  // Add logic to open the profile
  this.closeMenu();
}

sendMessage = (message) => {
    if (this.socket) {
        // Emit the message to the server
        this.socket.emit("chatMessage", { sender: this.myId, message });

        // Display your own message locally
        this.displayMessage(`You: ${message}`);
    }
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
    return (minDistance < 100) ? nearestId : null;
  }

  displayMessage(text) {
    const gameWidth = this.scale.width;
    const gameHeight = this.scale.height;

    // Style for the message
    const style = {
        font: `${gameWidth * 0.05}px Arial`,
        fill: "#ffffff",
        backgroundColor: "#000000",
        padding: { x: 20, y: 10 },
        align: "center"
    };

    // Create the message text
    const messageText = this.add.text(gameWidth * 0.5, gameHeight * 0.1, text, style)
        .setOrigin(0.5)
        .setScrollFactor(0);

    // Automatically destroy the message after 3 seconds
    this.time.delayedCall(3000, () => {
        messageText.destroy();
    });
  }
}
