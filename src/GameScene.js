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

  async preload() {
    this.loadAssets();

    // Initialize cursors early to avoid "Cursors are not initialized!" error
    this.cursors = this.input.keyboard.createCursorKeys();

    // Fetch player pseudo from the registry
    const playerPseudo = this.registry.get("playerPseudo");

    if (!playerPseudo) {
        console.error("Player pseudo is not defined in the registry!");
        return; // Exit preload if pseudo is undefined
    }

    console.log("Preloading player pseudo:", playerPseudo);

    // Use a Promise to handle asynchronous operations
    this.preloadPromise = new Promise(async (resolve, reject) => {
        try {
            // Fetch player data from MongoDB
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/players/${playerPseudo}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log(`Player data for ${playerPseudo} fetched from MongoDB:`, data);

            // Store player data in the registry
            this.registry.set("playerData", data);

            // Set the player's initial position
            this.playerPosition = { x: data.posX || 0, y: data.posY || 0 };

            // Dynamically load the player's appearance from the public/apparences/ directory
            const appearancePath = `/assets/apparences/${playerPseudo}.png`;
            this.load.spritesheet("playerAppearance", appearancePath, {
                frameWidth: 48, // Ensure this matches the frame size of the spritesheet
                frameHeight: 48,
            });

            // Wait for assets to finish loading
            this.load.once('complete', resolve);
            this.load.start();
        } catch (error) {
            console.error("Error fetching player data:", error);
            reject(error);
        }
    });
}

  async create() {
    // Wait for the preloadPromise to resolve before proceeding
    try {
        await this.preloadPromise;
    } catch (error) {
        console.error("Error during preload. Aborting game initialization.");
        return; // Exit if preload failed
    }

    const playerData = this.registry.get("playerData");
    if (!playerData) {
        console.error("Player data is not defined in the registry! Aborting game initialization.");
        return; // Exit if player data is missing
    }

    // Initialize the game world and player only after all data is ready
    this.setupWorld();
    this.loadPlayers();
    this.createPlayer();
    this.createAnimations();
    this.setupCamera();
    this.setupControls();
    this.setupSocket();
    this.createUI();

    // Periodically update the player's position in the database
    this.positionUpdateInterval = setInterval(() => this.updatePlayer(), 5000);
}

  update() {
    // Ensure player and cursors are initialized before handling movement
    if (!this.player || !this.cursors) {
        return;
    }

    this.handlePlayerMovement();
    this.updateRemotePlayers();
  }

  loadAssets() {
    this.load.image("background", "/assets/interieur.png"); // Preload background image
    this.load.spritesheet("player", "/assets/apparences/mehdi.png", {
      frameWidth: 48,
      frameHeight: 48,
    }); // Preload default player spritesheet
  }

  setupWorld() {
    const worldWidth = 1536; // Match the new image size
    const worldHeight = 2160; // Match the new image size
    this.add.image(worldWidth / 2, worldHeight / 2, "background");
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
  }

  createPlayer() {
    const playerData = this.registry.get("playerData");
    if (!playerData) {
        console.error("Player data is not defined in the registry!");
        return;
    }

    const textureKey = "playerAppearance"; // Use the dynamically loaded appearance

    // Use the player's position fetched from MongoDB
    const { x, y } = this.playerPosition || { x: 0, y: 0 };
    this.player = this.physics.add.sprite(x, y, textureKey);

    console.log("Creating player at position:", { x, y });
    console.log("Creating player with appearance:", textureKey);

    this.player.setCollideWorldBounds(true);
    this.player.body.setMaxVelocity(CONFIG.maxSpeed, CONFIG.maxSpeed);
    this.remotePlayersGroup = this.physics.add.group();
    this.physics.add.collider(this.player, this.remotePlayersGroup, this.handleCollision, null, this);

    this.createAnimations(textureKey); // Pass the texture key to create animations
  }

  createAnimations(textureKey) {
    CONFIG.animations.forEach(anim => {
      this.anims.create({
        key: anim.key,
        frames: this.anims.generateFrameNumbers(textureKey, { start: anim.start, end: anim.end }),
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
    this.scale.on("resize", this.handleResize, this);
    //this.input.once("pointerup", this.handlePointerUp, this);
    //window.addEventListener("orientationchange", this.handleOrientationChange);
  }

  setupSocket() {
    this.socket = io(process.env.REACT_APP_SOCKET_URL);
    this.otherPlayers = {};
    this.latestPlayersData = {};

    this.socket.on('connect', () => {
        if (this.socket && this.socket.id) {
            this.myId = this.socket.id;
            this.socket.emit('newPlayer', {
                x: this.player.x,
                y: this.player.y,
                character: 'default',
                pseudo: 'Player' // Default pseudo
            });
        }
    });

    this.socket.on('playersUpdate', (players) => {
        this.latestPlayersData = players;
    });

    this.socket.on("interaction", (data) => {
        if (data.to === this.myId) {
            const message = (data.action === "defier")
                ? `Le joueur ${data.from}\n vous a défié !`
                : `Le joueur ${data.from}\n vous fait signe !`;
            this.displayMessage(message);
        }
    });

    this.socket.on("appearanceUpdate", (data) => {
        if (data.id === this.myId) {
            this.player.setTexture(data.character);
        } else if (this.otherPlayers[data.id]) {
            this.otherPlayers[data.id].setTexture(data.character);
        }
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

    if (this.cursors.left?.isDown) {
      keyboardActive = true;
      newAnim = "walk-left";
      this.player.setVelocity(-200, 0);
    } else if (this.cursors.right?.isDown) {
      keyboardActive = true;
      newAnim = "walk-right";
      this.player.setVelocity(200, 0);
    } else if (this.cursors.up?.isDown) {
      keyboardActive = true;
      newAnim = "walk-up";
      this.player.setVelocity(0, -200);
    } else if (this.cursors.down?.isDown) {
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
        if (this.socket) {
            this.socket.emit("interaction", { from: this.myId, to: targetId, action: "defier" });
        }
        this.interactionMenu.destroy();
        this.interactionMenu = null; // Ensure proper cleanup
    });

    option2.on("pointerdown", () => {
        this.displayMessage(`Vous avez fait signe \nau joueur ${targetId}`);
        if (this.socket) {
            this.socket.emit("interaction", { from: this.myId, to: targetId, action: "faireSigne" });
        }
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
    // Ensure the main menu is closed when opening the profile menu
    if (this.startMenu) {
        this.startMenu.destroy();
        this.startMenu = null;
    }

    if (this.profileMenu) {
        this.profileMenu.destroy();
    }

    const gameWidth = this.scale.width;
    const gameHeight = this.scale.height;

    this.profileMenu = this.add.container(gameWidth / 2, gameHeight / 2);

    // Background
    const background = this.add.rectangle(0, 0, gameWidth * 0.8, gameHeight * 0.6, 0x000000, 0.8).setOrigin(0.5);
    this.profileMenu.add(background);

    // Display current pseudo
    const currentPseudoText = this.add.text(0, -gameHeight * 0.3, `Current Pseudo: ${this.currentPseudo || "Player"}`, {
        font: "18px Arial",
        fill: "#ffffff",
    }).setOrigin(0.5);
    this.profileMenu.add(currentPseudoText);

    // Input for pseudo with placeholder "Nouveau Pseudo"
    const pseudoInput = this.add.dom(gameWidth / 2, gameHeight / 2 - 50).createFromHTML(`
        <input type="text" id="pseudo-input" placeholder="Nouveau Pseudo" style="width: 200px; padding: 5px;" />
    `);
    pseudoInput.setOrigin(0.5); // Center the input field
    pseudoInput.setScrollFactor(0); // Ensure it stays in place
    this.add.existing(pseudoInput); // Add to the scene

    const pseudoButton = this.add.text(0, -gameHeight * 0.1, "Change Pseudo", {
        font: "18px Arial",
        fill: "#ffffff",
        backgroundColor: "#333333",
        padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setInteractive();

    pseudoButton.on("pointerdown", () => {
        const inputElement = document.getElementById("pseudo-input");
        const newPseudo = inputElement ? inputElement.value.trim() : null;
        if (newPseudo && this.socket) {
            this.socket.emit("updatePseudo", { id: this.myId, pseudo: newPseudo });
            this.currentPseudo = newPseudo; // Update locally
            currentPseudoText.setText(`Current Pseudo: ${newPseudo}`); // Update displayed pseudo
            this.displayMessage(`Pseudo updated to: ${newPseudo}`);
        }
    });
    this.profileMenu.add(pseudoButton);

    // Appearance options
    let currentAppearanceIndex = 0;
    let appearances = [];
    const appearanceImage = this.add.image(0, 50, "player").setOrigin(0.5).setScale(1.5);
    this.profileMenu.add(appearanceImage);

    const loadAppearance = (index) => {
        if (appearances.length > 0) {
            const appearance = appearances[index];
            console.log(`Loading appearance: ${appearance}`); // Log the appearance being loaded
            appearanceImage.setTexture(appearance);
            this.socket.emit("updateAppearance", { id: this.myId, character: appearance });
        }
    };

    const leftArrow = this.add.text(-gameWidth * 0.3, 50, "<", {
        font: "24px Arial",
        fill: "#ffffff",
    }).setOrigin(0.5).setInteractive();

    const rightArrow = this.add.text(gameWidth * 0.3, 50, ">", {
        font: "24px Arial",
        fill: "#ffffff",
    }).setOrigin(0.5).setInteractive();

    leftArrow.on("pointerdown", () => {
        if (appearances.length > 0) {
            currentAppearanceIndex = (currentAppearanceIndex - 1 + appearances.length) % appearances.length;
            console.log(`Left arrow clicked. New index: ${currentAppearanceIndex}`); // Log the index
            loadAppearance(currentAppearanceIndex);
        }
    });

    rightArrow.on("pointerdown", () => {
        if (appearances.length > 0) {
            currentAppearanceIndex = (currentAppearanceIndex + 1) % appearances.length;
            console.log(`Right arrow clicked. New index: ${currentAppearanceIndex}`); // Log the index
            loadAppearance(currentAppearanceIndex);
        }
    });

    this.profileMenu.add(leftArrow);
    this.profileMenu.add(rightArrow);

    // Return button
    const returnButton = this.add.text(0, gameHeight * 0.2, "Return", {
        font: "18px Arial",
        fill: "#ffffff",
        backgroundColor: "#333333",
        padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setInteractive();

    returnButton.on("pointerdown", () => {
        this.profileMenu.destroy();
        this.profileMenu = null;
    });
    this.profileMenu.add(returnButton);
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
        this.displayMessage(`Vous: ${message}`);
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
  
  async loadPlayers() {
      try {
          const response = await fetch('/api/players');
          if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
          }
          const players = await response.json();

          // Log the retrieved players to the console
          console.log('Players retrieved from /api/players:', players);

          players.forEach(player => {
              console.log(`Player pseudo: ${player.pseudo}`); // Log each player's pseudo
              const option = document.createElement('option');
              option.value = player.pseudo;
              option.textContent = player.pseudo;
          });
      } catch (error) {
          console.error('Error loading players:', error);
      }
  }

  selectPlayer() {
    const selectedPlayer = document.getElementById('player-dropdown').value;
    console.log('Joueur sélectionné :', selectedPlayer);

    // Envoyer le pseudo sélectionné au backend ou effectuer une action
  }

  async updatePlayer() {
    if (!this.player || !this.registry.get("playerData")) {
        console.warn("Player or player data is not initialized. Skipping position update.");
        return;
    }

    const playerPseudo = this.registry.get("playerData").pseudo;
    const posX = this.player.x;
    const posY = this.player.y;

    // Log the request body for debugging
    console.log("Sending position update:", { pseudo: playerPseudo, posX, posY });

    try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/players/update-position`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pseudo: playerPseudo, posX, posY }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to update player position. HTTP status: ${response.status}, Response: ${errorText}`);
        }

        console.log(`Player position updated in the database: { pseudo: ${playerPseudo}, posX: ${posX}, posY: ${posY} }`);
    } catch (error) {
        console.error("Error updating player position:", error);
    }
  }

  shutdown() {
    // Clear the interval when the scene is shut down to avoid memory leaks
    if (this.positionUpdateInterval) {
        clearInterval(this.positionUpdateInterval);
    }
  }

}
