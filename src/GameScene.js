import Phaser from "phaser";
import io from 'socket.io-client';
import PlayerService from './services/PlayerService';

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
    this.inventory = []; // Initialise un inventaire vide pour le joueur
  }

  async preload() {
    this.loadAssets();

    // Initialize cursors early to avoid "Cursors are not initialized!" error
    this.cursors = this.input.keyboard.createCursorKeys();

    // Charger dynamiquement l'apparence du joueur
    const playerPseudo = this.registry.get("playerPseudo");
    if (playerPseudo) {
        const appearancePath = `/assets/apparences/${playerPseudo}.png`;
        this.load.spritesheet("playerAppearance", appearancePath, {
            frameWidth: 48,
            frameHeight: 48,
        });
    } else {
        console.error("Player pseudo is not defined in the registry!");
    }


    // Use a Promise to handle asynchronous operations
    this.preloadPromise = new Promise(async (resolve, reject) => {
      try {
        // Fetch player data from MongoDB
        const playerData = await PlayerService.fetchPlayerData(playerPseudo);
        this.registry.set("playerData", playerData);

        // Set the player's initial position
        this.playerPosition = { x: playerData.posX || 0, y: playerData.posY || 0 };

        // Fetch inventory data for the player
        const inventory = await PlayerService.fetchInventory(playerData._id);
        console.log(`Inventory data for player ${playerPseudo}:`, inventory);

        // Store inventory data in the scene
        this.inventory = inventory;

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
        console.error("Error fetching player or inventory data:", error);
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
    this.load.spritesheet("player", "/assets/apparences/Mehdi.png", {
      frameWidth: 48,
      frameHeight: 48,
    }); // Preload default player spritesheet
    this.load.tilemapTiledJSON("map", "/assets/maps/map.tmj");
    this.load.image("Inside_B", "/assets/maps/Inside_B.png");
  }

  setupWorld() {
    const worldWidth = 1536; // Match the new image size
    const worldHeight = 2164; // Match the new image size
    this.add.image(worldWidth / 2, worldHeight / 2, "background");
    
  
    // Charger la carte et le tileset
    this.map = this.make.tilemap({ key: "map" }); // Stocker la carte dans this.map
    const tileset = this.map.addTilesetImage("Inside_B", "Inside_B");

    // Créer les couches
    const collisionLayer = this.map.createLayer("Collision", tileset, 0, 0);

    // Activer les collisions pour les tiles ayant la propriété "collision" à true
    collisionLayer.setCollisionByProperty({ collision: true });

    // Débogage (optionnel) : afficher les zones de collision
    const debugGraphics = this.add.graphics();
    /*collisionLayer.renderDebug(debugGraphics, {
        tileColor: null, // Pas de couleur pour les tiles sans collision
        collidingTileColor: new Phaser.Display.Color(243, 134, 48, 170), // Couleur pour les tiles avec collision
        faceColor: new Phaser.Display.Color(40, 39, 37, 200) // Couleur des faces
    });*/

    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    // Stocker la couche de collision pour une utilisation ultérieure
    this.collisionLayer = collisionLayer;
  }

  createPlayer() {
    const playerData = PlayerService.getPlayerData();
    if (!playerData) {
        console.error("Player data is not defined!");
        return;
    }

    const textureKey = "playerAppearance"; // Use the dynamically loaded appearance

    // Use the player's position fetched from MongoDB
    const { x, y } = this.playerPosition || { x: 0, y: 0 };
    this.player = this.physics.add.sprite(x, y, textureKey);

    this.player.setCollideWorldBounds(true);
    this.player.body.setMaxVelocity(CONFIG.maxSpeed, CONFIG.maxSpeed);
    this.player.setImmovable(true); // Empêche le joueur local d'être poussé

    this.player.body.setSize(36, 36); // Ajustez les dimensions selon vos besoins
    this.player.body.setOffset(6, 6); // Centrez la hitbox si nécessaire

      // Ajouter une collision entre le joueur et la couche de collision
      if (this.collisionLayer) {
        this.physics.add.collider(this.player, this.collisionLayer);
    } else {
        console.error("Collision layer is not defined!");
    }

    // Ajoutez une gestion des collisions
    this.physics.add.collider(this.player, this.remotePlayersGroup);

    this.createAnimations(textureKey); // Pass the texture key to create animations
}

createAnimations(textureKey) {
  CONFIG.animations.forEach(anim => {
    const animationKey = anim.key;

    // Vérifiez si l'animation existe déjà
    if (this.anims.exists(animationKey)) {
        console.warn(`AnimationManager key already exists: ${animationKey}`);
        return; // Ne recréez pas l'animation si elle existe déjà
    }

    // Créez l'animation si elle n'existe pas
    this.anims.create({
        key: animationKey,
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
    console.log("pseudo : ", this.registry.get("playerPseudo")) 
    this.socket.on('connect', () => {
        if (this.socket && this.socket.id) {
            this.myId = this.socket.id;
            this.socket.emit('newPlayer', {
                x: this.player.x,
                y: this.player.y,
                character: 'default',
                pseudo: this.registry.get("playerPseudo") || "Player" // Utilise le pseudo du joueur
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

    this.socket.on('chatMessage', (data) => {
      console.log(`Message reçu de ${data.pseudo}: ${data.message}`);
  });
}

  createUI() {
    const gameWidth = this.scale.width;
    const gameHeight = this.scale.height;

    // Joystick (bottom-left corner)
    const joystickRadius = gameWidth * 0.12 / this.zoomFactor; // Adjust for zoom
    this.joystick = this.plugins.get("rexVirtualJoystick").add(this, {
        x: gameWidth * 0.2,
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
    const startButtonWidth = gameWidth * 0.20 / this.zoomFactor;
    const startButtonHeight = gameHeight * 0.04 / this.zoomFactor;
    this.startButton = this.add.rectangle(gameWidth * 0.5, gameHeight * 0.93, startButtonWidth, startButtonHeight, 0x808080)
        .setInteractive()
        .on('pointerdown', () => this.handleStartButton());
    this.startButtonText = this.add.text(gameWidth * 0.5, gameHeight * 0.93, "Start", {
        font: `${gameWidth * 0.05 / this.zoomFactor}px Arial`,
        fill: "#ffffff",
        align: "center"
    }).setOrigin(0.5);
    this.startButton.setScrollFactor(0);
    this.startButtonText.setScrollFactor(0);
}

  handlePlayerMovement() {
    const gridSize = 8; // Taille de la grille (demi-tuile)

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
    // Aligner le joueur sur la grille après le déplacement
    if (!keyboardActive && (!this.joystick || this.joystick.force === 0)) {
      // Arrêter le joueur et aligner sur la grille uniquement lorsqu'il s'arrête
      this.player.setVelocity(0);
      this.player.x = Math.round(this.player.x / gridSize) * gridSize;
      this.player.y = Math.round(this.player.y / gridSize) * gridSize;

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
            const textureKey = `appearance-${data.pseudo}`;

            if (!this.otherPlayers[id]) {
                if (!this.textures.exists(textureKey)) {
                    this.load.spritesheet(textureKey, `/assets/apparences/${data.pseudo}.png`, {
                        frameWidth: 48, // Assurez-vous que cela correspond à la taille des frames
                        frameHeight: 48,
                    });
                    this.load.once('complete', () => {
                        this.createRemotePlayer(id, data, textureKey);
                    });
                    this.load.start();
                } else {
                    this.createRemotePlayer(id, data, textureKey);
                }
            } else {
                this.updateRemotePlayerPosition(id, data, textureKey);
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

createRemotePlayer(id, data, textureKey) {
    // Supprimez tout sprite existant pour éviter les résidus
    if (this.otherPlayers[id]) {
        this.otherPlayers[id].destroy();
        delete this.otherPlayers[id];
    }

    const newSprite = this.physics.add.sprite(data.x, data.y, textureKey);
    newSprite.setCollideWorldBounds(true);
    newSprite.setImmovable(true); // Empêche le joueur distant d'être poussé
    newSprite.currentAnim = data.anim || "";
    newSprite.setInteractive();
    this.remotePlayersGroup.add(newSprite);
    this.otherPlayers[id] = newSprite;

    // Configure animations pour ce joueur
    CONFIG.animations.forEach((anim) => {
        if (!this.anims.exists(`${textureKey}-${anim.key}`)) {
            this.anims.create({
                key: `${textureKey}-${anim.key}`,
                frames: this.anims.generateFrameNumbers(textureKey, { start: anim.start, end: anim.end }),
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
    const newX = Phaser.Math.Linear(this.otherPlayers[id].x, targetX, lerpFactor);
    const newY = Phaser.Math.Linear(this.otherPlayers[id].y, targetY, lerpFactor);
    this.otherPlayers[id].x = Math.abs(newX - targetX) < 1 ? targetX : newX;
    this.otherPlayers[id].y = Math.abs(newY - targetY) < 1 ? targetY : newY;

    if (data.anim && this.otherPlayers[id].currentAnim !== data.anim) {
        this.otherPlayers[id].anims.play(`${textureKey}-${data.anim}`, true);
        this.otherPlayers[id].currentAnim = data.anim;
    } else if (!data.anim && this.otherPlayers[id].currentAnim) {
        // Stop animation if no animation is provided
        this.otherPlayers[id].anims.stop();
        this.otherPlayers[id].currentAnim = null;
    }
}

  handleCollision(localPlayer, remotePlayer) {
    // Empêchez les vibrations en désactivant les forces de résolution automatiques
    const overlapX = localPlayer.x - remotePlayer.x;
    const overlapY = localPlayer.y - remotePlayer.y;

    // Ajustez la position du joueur local pour éviter les vibrations
    if (Math.abs(overlapX) > Math.abs(overlapY)) {
        localPlayer.x += overlapX > 0 ? 1 : -1;
    } else {
        localPlayer.y += overlapY > 0 ? 1 : -1;
    }

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
    const newJoystickX = gameSize.width * 0.2;
    const newJoystickY = gameSize.height * 0.82;
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
            console.log(`Interaction émise : from=${this.myId}, to=${targetId}, action=faireSigne`);
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
    // Close the current menu before switching scenes
    this.closeMenu();

    // Launch the InventoryScene and pass the inventory data
    this.scene.launch("InventoryScene", { inventory: this.inventory });
    this.scene.pause(); // Pause GameScene
};

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



// Helper function to attach click events to inventory items
attachItemClickEvent(icon, item, detailsContainer, iconPath, gameWidth, gameHeight) {
  icon.setInteractive().on("pointerdown", () => {
      detailsContainer.removeAll(true); // Clear previous details

      // Display item image
      const detailImage = this.add.image(-gameWidth * 0.25, -gameHeight * 0.06, iconPath)
          .setOrigin(0.5)
          .setDisplaySize(gameWidth * 0.22, gameWidth * 0.22);
      detailsContainer.add(detailImage);

      // Display item details (name, quantity, price, exchangeability)
      const detailText = this.add.text(
          -gameWidth * 0.1,
          -gameHeight * 0.1,
          `Nom: ${item.nom}\nQuantité: ${item.quantité}\nPrix: ${item.prix}`,
          {
              font: `${gameWidth * 0.04}px Arial`,
              fill: "#ffffff",
              align: "left",
          }
      ).setOrigin(0, 0);
      detailsContainer.add(detailText);

        // Add an interactive button for "Echanger avec ..."
        const exchangeButton = this.add.rectangle(
          -gameWidth * 0.1, // Position X
          -gameHeight * 0.03, // Position Y
          gameWidth * 0.4, // Button width
          gameHeight * 0.03, // Button height
          0x666666, // Background color
          0.8 // Opacity
      ).setOrigin(0, 0).setInteractive();

      // Add the text "Echanger avec ..." on the button
      const exchangeText = this.add.text(
          -gameWidth * 0.1,
          -gameHeight * 0.03,
          "Echanger avec ...",
          {
              font: `${gameWidth * 0.05}px Arial`,
              fill: "#ffffff", // Text color
              align: "center",
          }
      ).setOrigin(0, 0);

      // Add an event to handle button clicks
      exchangeButton.on("pointerdown", () => {
          if (item.is_echangeable) {
              this.displayMessage(`Vous avez choisi d'échanger l'objet : ${item.nom}`);
              // Add logic here to handle the exchange
          } else {
              this.displayMessage("Cet objet ne peut pas être échangé.");
          }
      });

      // Add the button and text to the details container
      detailsContainer.add(exchangeButton);
      detailsContainer.add(exchangeText);
  });
}

openMessages = () => {    
  this.displayMessage("Messages ...");
  // Add logic to open the profile
  this.closeMenu();
}


  getNearestRemotePlayer() {
    let nearestId = null;
    let minDistance = Number.MAX_VALUE;
    console.log("Recherche de joueurs"); // Debug log
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

          const response = await fetch(`${process.env.REACT_APP_API_URL}/api/players`);
          if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
          }
          const players = await response.json();

          // Log the retrieved players to the console
          console.log('Players retrieved from /api/players:', players);

          players.forEach(player => {
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

  addItemToInventory(item) {
    PlayerService.addItemToInventory(item);
    console.log("Updated inventory:", PlayerService.getInventory());
  }

  removeItemFromInventory(itemName, quantity) {
    PlayerService.removeItemFromInventory(itemName, quantity);
    console.log("Updated inventory:", PlayerService.getInventory());
  }



  
}
