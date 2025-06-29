import Phaser from "phaser";
import io from 'socket.io-client';
import PlayerService from './services/PlayerService';
import MusicManager from './MusicManager';

const CONFIG = {
  maxSpeed: 350,
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
    super("GameScene"); // Removed plugin registration
    this.inventory = []; // Initialize an empty inventory for the player
    this.isSpeedBoosted = false; // Ajout de l'état pour le boost de vitesse

    // Associez les cartes à leurs identifiants
    this.mapIds = {
      map: 0,   // Carte de base
      map2: 1,  // Deuxième carte
    };
        // Associez chaque mapId à une image de fond
    this.backgroundImages = {
        0: "background",       // Image de fond pour la carte "map"
        1: "backgroundext",    // Image de fond pour la carte "map2"
    };

    this.mapMusic = {
        map: "music1",   // Musique pour la carte "map"
        map2: "music1",  // Musique pour la carte "map2"
    };

    this.teleportPoints = {
        map: [
            { x: 18*48 + 24, y: 43*48+24, targetMap: "map2", targetX: 7 * 48 + 24, targetY: 8 * 48 + 24 },
        ],
        map2: [
            { x: 7 * 48 + 24, y: 7 * 48 + 24, targetMap: "map", targetX: 18*48 + 24, targetY: 42*48+24 },
        ],
    };
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

    resume() {
        if (!MusicManager.isPlaying('gameMusic')) {
            MusicManager.play(this, 'gameMusic', { loop: true, volume: 0.5 });
        }
    }

  async create() {
    // Notify app about the active scene
    this.game.events.emit("scene-switch", "GameScene");

    // Add fade-in effect
    this.cameras.main.fadeIn(1000, 0, 0, 0); // 1-second fade from black

    // Show chat and input elements
    const chatElement = document.getElementById("chat");
    const inputElement = document.getElementById("input");
    if (chatElement) chatElement.style.display = "block";
    if (inputElement) inputElement.style.display = "block";

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

    this.createPlayer();
    this.setupWorld();
    this.loadPlayers();
    this.setupCamera();
    this.setupControls();
    this.setupSocket();
    this.createUI();
    // Periodically update the player's position in the database
    this.positionUpdateInterval = setInterval(() => this.updatePlayer(), 2000);


        // Gestion du clic pour récupérer les coordonnées de la tuile
    this.input.on('pointerdown', function (pointer) {
        let worldPoint = pointer.positionToCamera(this.cameras.main);

        // Calcul des coordonnées de la tuile
        let tileX = Math.floor(worldPoint.x / 48);
        let tileY = Math.floor(worldPoint.y / 48);

        // Calcul du centre de la tuile
        let centerX = (tileX * 48) + 24;
        let centerY = (tileY * 48) + 24;

        console.log(`Tuile cliquée : x=${tileX}, y=${tileY}`);
        console.log(`Centre de la tuile : x=${centerX}, y=${centerY}`);
    }, this);
}

  update() {
    // Ensure player and cursors are initialized before handling movement
    if (!this.player || !this.cursors) {
        return;
    }
    
    const now = Date.now(); // Ajoute cette ligne

    this.handlePlayerMovement();
    this.updateRemotePlayers();
        // Envoi de la position à chaque frame (20-60 fois/seconde selon le framerate)
    if (this.socket && this.myId && now - this.lastMoveSent > 50) {
        const currentMapId = PlayerService.getPlayerData()?.mapId;
        this.socket.emit('playerMove', {
            x: this.player.x,
            y: this.player.y,
            anim: this.currentAnim,
            mapId: currentMapId,
        });
        this.lastMoveSent = now;
    }
  }

  loadAssets() {
    this.load.audio("teleportSound", "/assets/sounds/tp.mp3"); // Son de téléportation
    this.load.audio("music1", "/assets/musics/music1.mp3");
    this.load.image("background", "/assets/interieur.png"); // Preload background image
    this.load.image("backgroundext", "/assets/maps/exterieur.png"); // Preload background image
    this.load.spritesheet("player", "/assets/apparences/Mehdi.png", {
      frameWidth: 48,
      frameHeight: 48,
    }); // Preload default player spritesheet
    this.load.spritesheet('!Chest', '/assets/maps/!Chest.png', {frameWidth: 48,frameHeight: 48});
    this.load.tilemapTiledJSON("map", "/assets/maps/map.tmj");
    this.load.tilemapTiledJSON("map2", "/assets/maps/exterieur.tmj"); // Nouvelle carte
    this.load.image("Inside_B", "/assets/maps/Inside_B.png");
    this.load.plugin('rexvirtualjoystickplugin', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexvirtualjoystickplugin.min.js', true);
  }

  setupWorld() {
    // Récupérez les données du joueur depuis le registre
    const playerData = this.registry.get("playerData");
    if (!playerData) {
        console.error("Player data is not defined in the registry! Aborting world setup.");
        return;
    }

    // Déterminez la carte à charger en fonction de mapId
    const mapKey = Object.keys(this.mapIds).find(key => this.mapIds[key] === playerData.mapId);
    if (!mapKey) {
        console.error(`Aucune carte trouvée pour mapId: ${playerData.mapId}`);
        return;
    }

    this.changeMap(mapKey, playerData.posX || 0, playerData.posY || 0);
}

  

async loadWorldEvents() {
    // 1. Récupère les objets de la couche "events" de Tiled
    const eventsLayer = this.map.getObjectLayer("events");
    if (!eventsLayer) {
        console.warn("Pas de couche 'events' dans la map !");
        return;
    }

    // 2. Récupère l'état dynamique depuis la BDD via une API REST
    const mapKey = this.map.key;
    let worldEvents = [];
    try {
        const res = await fetch(`${process.env.REACT_APP_API_URL}/api/world-events?mapKey=${mapKey}`);
        worldEvents = await res.json();
    } catch (e) {
        console.error("Erreur lors du chargement des worldEvents :", e);
    }

    // 3. Fusionne les deux sources par eventId ou (x, y)
    this.activeEvents = [];
    eventsLayer.objects.forEach(obj => {
        // Cherche l'event dynamique correspondant
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

        // Instancie le sprite selon le type et l'état dynamique
        if (type === "chest") {
            const chest = this.physics.add.sprite(x + obj.width/2, y - obj.height/2, "!Chest", 0);
            chest.setImmovable(true);
            chest.eventData = dynamicEvent;
            chest.setInteractive();
            this.activeEvents.push(chest);

            this.addCollisionIfNeeded(obj, chest);

            if (dynamicEvent.state.opened) {
                chest.setFrame(3); // Affiche directement la frame ouverte
            }
        }
        // Ajoute d'autres types ici (porte, npc, etc.)
    });

    // 4. Gère les interactions avec le joueur


}

handleChestInteraction(chest) {
    const { eventData } = chest;
    if (eventData.state.opened) {
        this.displayMessage("Ce coffre est déjà ouvert !");
        return;
    }

    // Joue l'animation d'ouverture
    chest.anims.play('chest-open');
    chest.once('animationcomplete', () => {
        chest.setFrame(4); // Reste sur la dernière frame (ouvert)
    });

    this.displayMessage(`Vous trouvez : ${eventData.properties.loot}`);

    // Mets à jour l'état en BDD
    fetch(`${process.env.REACT_APP_API_URL}/api/world-events/${eventData._id}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opened: true })
    });

    // Ajoute l'objet à l'inventaire du joueur (à adapter selon ta logique)
    this.addItemToInventory({ nom: eventData.properties.loot, quantité: 1 });
    // Mets à jour localement
    eventData.state.opened = true;
}

  async loadPlayers() {
    try {

        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/players`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const players = await response.json();

        players.forEach(player => {
            const option = document.createElement('option');
            option.value = player.pseudo;
            option.textContent = player.pseudo;
        });
    } catch (error) {
        console.error('Error loading players:', error);
    }
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
    // Initialize the remote players group
    this.remotePlayersGroup = this.physics.add.group({
      immovable: true, // Prevent remote players from being pushed
    });
    this.physics.add.collider(this.player, this.remotePlayersGroup, (localPlayer, remotePlayer) => {
    this.handleCollision(localPlayer, remotePlayer);
  });
    this.player.body.setSize(36, 36); // Ajustez les dimensions selon vos besoins
    this.player.body.setOffset(6, 6); // Centrez la hitbox si nécessaire

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
    if (!this.anims.exists('chest-open')) {
        this.anims.create({
            key: 'chest-open',
            frames: this.anims.generateFrameNumbers('!Chest', { start: 0, end: 3 }), // Ajuste end selon ta ligne
            frameRate: 10,
            repeat: 0
        });
    }
});
}

  setupCamera() {
    this.zoomFactor = Math.min(this.scale.width / 768, this.scale.height / 1080) * 1.75; // Adjust zoom factor
    this.cameras.main.setZoom(this.zoomFactor); // Apply zoom
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
  }

  setupControls() {
    this.scale.on("resize", this.handleResize, this);

        // Ajout gestion touche Shift
    this.input.keyboard.on('keydown-SHIFT', () => {
        this.isSpeedBoosted = true;
    });
    this.input.keyboard.on('keyup-SHIFT', () => {
        this.isSpeedBoosted = false;
    });
    //this.input.once("pointerup", this.handlePointerUp, this);
    //window.addEventListener("orientationchange", this.handleOrientationChange);
  }

  setupSocket() {
    this.socket = this.registry.get("socket"); // Récupère la même instance !
    this.otherPlayers = {};
    this.latestPlayersData = {};

    
    // Ajoute ce bloc :
    if (this.socket.connected) {
        // Si déjà connecté, envoie newPlayer tout de suite
        const currentMapId = PlayerService.getPlayerData().mapId;
        this.myId = this.socket.id;
        this.socket.emit('newPlayer', {
            x: this.player.x,
            y: this.player.y,
            character: '/assets/apparences/' + this.registry.get("playerPseudo") + '.png',
            pseudo: this.registry.get("playerPseudo") || "Player",
            mapId: currentMapId,
        });
    } else {
        // Sinon, attends l'event 'connect'
        this.socket.on('connect', () => {
            this.myId = this.socket.id;
            const currentMapId = PlayerService.getPlayerData().mapId;
            this.socket.emit('newPlayer', {
                x: this.player.x,
                y: this.player.y,
                character: '/assets/apparences/' + this.registry.get("playerPseudo") + '.png',
                pseudo: this.registry.get("playerPseudo") || "Player",
                mapId: currentMapId,
            });
        });
    }

    // Écouter l'événement disconnectMessage
    this.socket.on('disconnectMessage', (data) => {
        console.warn(data.message); // Affiche le message dans la console
        this.registry.set('disconnectMessage', data.message);

        // Réinitialiser l'application
        this.resetApplication();
        this.scene.stop(); // Arrête la scène actuelle
        this.scene.start('MainMenuScene'); // Redirige vers une autre scène, comme le menu principal
    });

    this.socket.on('playersUpdate', (players) => {

    const currentMapId = PlayerService.getPlayerData().mapId;

    Object.keys(this.otherPlayers).forEach((id) => {
        if (!players[id] || players[id].mapId !== currentMapId) {
            if (this.otherPlayers[id].sprite) this.otherPlayers[id].sprite.destroy();
            if (this.otherPlayers[id].pseudoText) this.otherPlayers[id].pseudoText.destroy();
            delete this.otherPlayers[id];
        }
    });

    Object.keys(players).forEach((id) => {
        if (id !== this.myId && players[id].mapId === currentMapId) {
            const characterKey = players[id].character; // ex: "/assets/apparences/Arthur.png"
            // Charge dynamiquement la texture si besoin
            if (!this.textures.exists(characterKey)) {
                this.load.spritesheet(characterKey, characterKey, {
                    frameWidth: 48,
                    frameHeight: 48,
                });
                this.load.once('complete', () => {
                    this.createRemotePlayer(id, players[id], characterKey);
                });
                this.load.start();
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
        } else if (this.otherPlayers[data.id] && this.otherPlayers[data.id].sprite) {
             this.otherPlayers[data.id].sprite.setTexture(data.character);
        }
    });


    this.socket.on('playerLeftMap', (data) => {
        if (this.otherPlayers[data.id]) {
            if (this.otherPlayers[data.id].sprite) this.otherPlayers[data.id].sprite.destroy();
            if (this.otherPlayers[data.id].pseudoText) this.otherPlayers[data.id].pseudoText.destroy();
            delete this.otherPlayers[data.id];
        }
    });

    this.socket.on('playerDisconnected', (data) => {
        if (this.otherPlayers[data.id]) {
            if (this.otherPlayers[data.id].sprite) this.otherPlayers[data.id].sprite.destroy();
            if (this.otherPlayers[data.id].pseudoText) this.otherPlayers[data.id].pseudoText.destroy();
            delete this.otherPlayers[data.id];
        }
    });


this.socket.on('challenge:received', ({ challengerId, matchId }) => {
    this.registry.set('ttMatchId', matchId); 
    this.displayChallengePopup(challengerId);
});

this.socket.on('challenge:accepted', ({ opponentId, opponentPlayerId, matchId }) => {
    const playerData = this.registry.get("playerData");
    const playerId = playerData && playerData._id ? playerData._id : null;
    this.registry.set('ttMatchId', matchId);
    console.log("Match ID reçu :", matchId);
    this.scene.launch("TripleTriadSelectScene", {
        playerId,
        mode: "pvp",
        opponentId: opponentPlayerId // Utilise le vrai playerId de l'adversaire
    });
    this.scene.pause();
});

this.socket.on('challenge:cancelled', ({ challengerId, challengedId }) => {
    this.displayMessage("Le défi a été annulé.");
    if (this.challengePopup) {
        this.challengePopup.destroy();
        this.challengePopup = null;
    }
});

}



  createUI() {
    const gameWidth = this.scale.width;
    const gameHeight = this.scale.height;

    // Ensure the rexVirtualJoystick plugin is available
    
    const joystickPlugin = this.plugins.get('rexvirtualjoystickplugin');
    if (!joystickPlugin) {
        console.error("rexVirtualJoystick plugin is not available in GameScene.");
        return; // Prevent further execution if the plugin is not available
    }

    // Joystick (bottom-left corner)
    const joystickRadius = gameWidth * 0.12 / this.zoomFactor; // Adjust for zoom
    this.joystick = joystickPlugin.add(this, {
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
        .on('pointerdown', () => { this.isSpeedBoosted = true; }) // Active le boost à l'appui
        .on('pointerup', () => { this.isSpeedBoosted = false; })   // Désactive le boost au relâchement
        .on('pointerout', () => { this.isSpeedBoosted = false; }); // Désactive si le curseur sort du bouton
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

    const speed = this.isSpeedBoosted ? 300 : 180;

    if (this.cursors.left?.isDown) {
        keyboardActive = true;
        newAnim = "walk-left";
        this.player.setVelocity(-speed, 0); // Utilise speed ici
    } else if (this.cursors.right?.isDown) {
        keyboardActive = true;
        newAnim = "walk-right";
        this.player.setVelocity(speed, 0);
    } else if (this.cursors.up?.isDown) {
        keyboardActive = true;
        newAnim = "walk-up";
        this.player.setVelocity(0, -speed);
    } else if (this.cursors.down?.isDown) {
        keyboardActive = true;
        newAnim = "walk-down";
        this.player.setVelocity(0, speed);
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
        const forceCoeff = this.isSpeedBoosted ? 2.5 : 1.5;
        this.player.setVelocityX(Math.cos(Phaser.Math.DegToRad(angle)) * this.joystick.force * forceCoeff);
        this.player.setVelocityY(Math.sin(Phaser.Math.DegToRad(angle)) * this.joystick.force * forceCoeff);
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
    /*if (!keyboardActive && (!this.joystick || this.joystick.force === 0)) {
        this.player.setVelocity(0);
        this.player.x = Math.round(this.player.x / gridSize) * gridSize;
        this.player.y = Math.round(this.player.y / gridSize) * gridSize;

        if (this.player.anims.isPlaying) {
            this.player.anims.stop();
        }
        this.currentAnim = "";
    }*/

    if (this.socket && this.myId) {
        const currentMapId = PlayerService.getPlayerData()?.mapId; // Récupérer le mapId actuel
        this.socket.emit('playerMove', {
            x: this.player.x,
            y: this.player.y,
            anim: this.currentAnim,
            mapId: currentMapId, // Inclure mapId dans les données envoyées
        });
    }
  }
updateRemotePlayers() {
    if (!this.latestPlayersData) return;

    const currentMapId = PlayerService.getPlayerData()?.mapId;
    if (currentMapId === undefined) return;

    // Liste des joueurs à créer après chargement
    const toCreate = [];

    Object.keys(this.latestPlayersData).forEach((id) => {
        if (id === this.myId) return;
        const data = this.latestPlayersData[id];
        const textureKey = `appearance-${data.pseudo}`;

        if (data.mapId === currentMapId && !this.otherPlayers[id]) {
            if (!this.textures.exists(textureKey)) {
                // Charge la texture si pas déjà en cours de chargement
                if (!this.load.isLoading()) {
                    this.load.spritesheet(textureKey, `/assets/apparences/${data.pseudo}.png`, {
                        frameWidth: 48,
                        frameHeight: 48,
                    });
                    toCreate.push({ id, data, textureKey });
                    this.load.once('complete', () => {
                        toCreate.forEach(({ id, data, textureKey }) => {
                            this.createRemotePlayer(id, data, textureKey);
                        });
                    });
                    this.load.start();
                }
                // Sinon, on attend le prochain updateRemotePlayers
            } else {
                this.createRemotePlayer(id, data, textureKey);
            }
        } else if (data.mapId === currentMapId) {
            this.updateRemotePlayerPosition(id, data, textureKey);
        }
    });

    // Supprime les joueurs qui ne sont plus sur la même carte ou absents
// --- Correction dans updateRemotePlayers (suppression) ---
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

    // Met à jour la position du pseudoText
    if (remoteObj.pseudoText) {
        remoteObj.pseudoText.setPosition(remote.x, remote.y - 29);
    }

    if (data.anim && remote.currentAnim !== data.anim) {
        const animationKey = `${textureKey}-${data.anim}`;
        if (this.anims.exists(animationKey)) {
            remote.anims.play(animationKey, true);
            remote.currentAnim = data.anim;
        }
    } else if (!data.anim && remote.currentAnim) {
        remote.anims.stop();
        remote.currentAnim = null;
    }
}

createRemotePlayer(id, data, textureKey) {
    // Supprime tout sprite existant pour éviter les résidus
    if (this.otherPlayers[id]) {
        if (this.otherPlayers[id].pseudoText) {
            this.otherPlayers[id].pseudoText.destroy();
        }
        if (this.otherPlayers[id].sprite) {
            this.otherPlayers[id].sprite.destroy();
        }
        delete this.otherPlayers[id];
    }

    // Vérifie que la texture est bien chargée
    if (!this.textures.exists(textureKey)) {
        console.warn(`Texture "${textureKey}" not loaded for player ${data.pseudo}, skipping sprite creation.`);
        return;
    }

    const newSprite = this.physics.add.sprite(data.x, data.y, textureKey);
    newSprite.setCollideWorldBounds(true);
    newSprite.setImmovable(true);
    newSprite.currentAnim = data.anim || "";
    newSprite.setInteractive();

    newSprite.id = id;
    newSprite.pseudo = data.pseudo;
    this.remotePlayersGroup.add(newSprite);


    // Ajoute le pseudo au-dessus du sprite
    const pseudoText = this.add.text(data.x, data.y - 29, data.pseudo, {
        font: "18px Arial",
        fill: "#ffffff",
        align: "center",
    }).setOrigin(0.5);


    // Stocke un objet {sprite, pseudoText}
    this.otherPlayers[id] = { sprite: newSprite, pseudoText };

    // Crée dynamiquement les animations pour ce joueur
    CONFIG.animations.forEach((anim) => {
        const animationKey = `${textureKey}-${anim.key}`;
        if (!this.anims.exists(animationKey)) {
            this.anims.create({
                key: animationKey,
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
    this.socket.emit('newPlayer', {
      x: this.player.x,
      y: this.player.y,
      character: '/assets/apparences/'+this.registry.get("playerPseudo")+'.png'
    });
  }

  handlePlayersUpdate(players) {
    this.latestPlayersData = players;
  }

  handleInteractionFeedback(data) {

    if (data.from === this.myId || data.to === this.myId) {
        const message = (data.action === "defier")
            ? `Le joueur ${data.from}\n vous a défié !`
            : `Le joueur ${data.from}\n vous fait signe !`;

        this.displayMessage(message);
    }
}

  handleButtonA = () => {
    // Vérifie s'il y a un event interactif proche (coffre, porte, etc.)
    const obj = this.getNearbyEventObject();
    if (obj && obj.eventData && obj.eventData.type === "chest") {
        this.handleChestInteraction(obj);
        return;
    }
    // Sinon, interaction joueur classique
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
        const myPlayerId = this.registry.get("playerData")?._id;
        const targetPlayerId = this.latestPlayersData[targetId]?.playerId;
        // Génère le matchId ici
        const matchId = `tt-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        // Stocke-le dans le registry pour le challenger
        this.registry.set('ttMatchId', matchId);
        this.socket.emit("challenge:send", {
            challengerId: this.myId,
            challengedId: targetId,
            challengerPlayerId: myPlayerId,
            challengedPlayerId: targetPlayerId,
            matchId // <-- ENVOIE le matchId au serveur
        });
    }
    this.interactionMenu.destroy();
    this.interactionMenu = null;
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
        { label: "Photo", action: () => this.openPhotoGallery() }, // <-- Ajout du bouton Photo
        { label: "Triple Triad", action: () => this.openTripleTriad() },
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
openPhotoGallery = () => {
    this.closeMenu();
    this.scene.launch("PhotoGalleryScene");
    this.scene.pause();
};
openInventory = () => {
    this.closeMenu();

    // Récupère le vrai playerId depuis playerData
    const playerData = this.registry.get("playerData");
    const playerId = playerData && playerData._id ? playerData._id : null;

    if (!playerId) {
        this.displayMessage("Impossible de trouver l'identifiant du joueur.");
        return;
    }

    this.scene.launch("InventoryScene", { playerId });
    this.scene.pause();
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

openTripleTriad = () => {    
  this.closeMenu();

  // Récupère l'id du joueur depuis le registre (adapte selon ta logique)
  const playerData = this.registry.get("playerData");
  const playerId = playerData && playerData._id ? playerData._id : null;

  if (!playerId) {
    this.displayMessage("Impossible de trouver l'identifiant du joueur.");
    return;
  }

  this.scene.launch("TripleTriadSelectScene", { playerId });
  this.scene.pause();
}


  getNearestRemotePlayer() {
    let nearestId = null;
    let minDistance = Number.MAX_VALUE;
    Object.keys(this.otherPlayers).forEach((id) => {
        let remote = this.otherPlayers[id].sprite;
        let distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, remote.x, remote.y);
        if (distance < minDistance) {
            minDistance = distance;
            nearestId = id;
        }
    });
    return (minDistance < 100) ? nearestId : null;
  }

    getNearbyEventObject() {
        if (!this.activeEvents) return null;
        const threshold = 48; // Distance max pour interagir
        return this.activeEvents.find(obj =>
            Phaser.Math.Distance.Between(this.player.x, this.player.y, obj.x, obj.y) < threshold
        );
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
    const mapId = this.mapIds[this.map.key];  // Ajoutez l'identifiant de la carte

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

async changeMap(mapKey, spawnX, spawnY) {
    if (!this.cache.tilemap.has(mapKey)) {
        return;
    }

    // Supprimez les colliders existants
    if (this.collisionLayer) {
        this.physics.world.colliders.destroy(); // Supprime tous les colliders existants
        this.collisionLayer.destroy();
    }

    // Chargez la nouvelle carte
    this.map = this.make.tilemap({ key: mapKey });
    this.map.key = mapKey; // Définir explicitement la clé
    if (!this.map) {
      console.error(`La carte "${mapKey}" n'a pas pu être chargée.`);
      return;
    }

    const tileset = this.map.addTilesetImage("Inside_B", "Inside_B");
    if (!tileset) {
        console.error(`Le tileset "Inside_B" n'a pas pu être chargé.`);
        return;
    }

    // Affichez l'image de fond correspondant au mapId
    const mapId = this.mapIds[mapKey];
    this.registry.set("currentMapId", mapId); // Stockez le mapId dans le registre
    const backgroundImageKey = this.backgroundImages[mapId];
    if (backgroundImageKey) {
        if (this.currentBackgroundImage) {
            this.currentBackgroundImage.destroy(); // Supprimez l'image précédente
        }
        this.currentBackgroundImage = this.add.image(0, 0, backgroundImageKey).setOrigin(0).setDepth(-1);
    } else {
        console.warn(`Aucune image de fond trouvée pour mapId: ${mapId}`);
    }

    // Configurez les couches
    this.collisionLayer = this.map.createLayer("Collision", tileset, 0, 0);
    if (!this.collisionLayer) {
      console.error("La couche de collision n'a pas pu être créée.");
      return;
    }
    this.collisionLayer.setCollisionByProperty({ collision: true });

    var tile = this.collisionLayer.getTileAt(7, 8); // Coordonnées de la tuile
    if (!tile) {
        console.warn("Aucune tuile trouvée aux coordonnées (7, 8) dans la couche Collision.");
    } 
    
    // Ajoutez des collisions pour la nouvelle carte
    if (this.player) {
        this.physics.add.collider(this.player, this.collisionLayer);
    }

    // Mettez à jour les limites du monde
    this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

    // Téléportez le joueur aux nouvelles coordonnées
    if (this.player) {
        this.player.setPosition(spawnX, spawnY);
        this.player.setVisible(true);
    } else {
        console.error("Player is not initialized! Cannot set position.");
    }
    PlayerService.updatePlayerData({ mapId }); // Ajoutez cette ligne si PlayerService est utilisé
    tile = this.collisionLayer.getTileAtWorldXY(this.player.x, this.player.y);
    if (!tile) {
        console.warn(`Le joueur est positionné sur une tuile invalide : (${this.player.x}, ${this.player.y})`);
    } 

    await this.loadWorldEvents();
    this.createTeleportZones();
    this.cameras.main.fadeIn(500, 0, 0, 0); // 500ms de fondu depuis le noir
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    if (this.socket && this.myId) {
      const currentMapId = PlayerService.getPlayerData()?.mapId; // Récupérer le mapId actuel
      this.socket.emit('playerMove', {
          x: this.player.x,
          y: this.player.y,
          anim: this.currentAnim,
          mapId: currentMapId, // Inclure mapId dans les données envoyées
      });
      console.log(`playerMove envoyé : x=${this.player.x}, y=${this.player.y}, anim=${this.currentAnim}, mapId=${currentMapId}`);
    }
  
    // Jouez la musique associée à la carte
    this.playMusicForMap(mapKey);

}

  createTeleportZones() {
      if (!this.player) {
          console.error("Player is not initialized. Cannot create teleport zones.");
          return;
      }

      if (!this.map || !this.map.key) {
          console.error("Map is not initialized. Cannot create teleport zones.");
          return;
      }

      // Récupérez les points de téléportation pour la carte actuelle
      const teleportPoints = this.teleportPoints[this.map.key];
      if (!teleportPoints || teleportPoints.length === 0) {
          console.warn(`Aucun point de téléportation défini pour la carte : ${this.map.key}`);
          return;
      }

      // Créez les zones de téléportation
      teleportPoints.forEach(point => {
          const teleportZone = this.add.zone(point.x, point.y, 48, 48)
              .setOrigin(0.5)
              .setInteractive();

          if (!teleportZone) {
              console.error(`La zone de téléportation à (${point.x}, ${point.y}) n'a pas pu être créée.`);
              return;
          }

          this.physics.world.enable(teleportZone);
          this.physics.add.overlap(this.player, teleportZone, () => {
              this.sound.play("teleportSound", { volume: 0.3});
              this.changeMap(point.targetMap, point.targetX, point.targetY);
          });
      });
  }

  addCollisionIfNeeded(obj, sprite) {
    // Vérifie si l'objet Tiled a une propriété Collision à true
    const hasCollision = obj.properties?.find(p => p.name === "Collision" && p.value === true);
    if (hasCollision) {
        this.physics.add.collider(this.player, sprite);
    }
}

playMusicForMap(mapKey) {
    const musicKey = this.mapMusic[mapKey];

    if (!musicKey) {
        console.warn(`Aucune musique définie pour la carte : ${mapKey}`);
        return;
    }

    // Si la musique actuelle est déjà celle de la carte, ne rien faire
    if (this.currentMusicKey === musicKey) {
        return;
    }

    MusicManager.stop(); // Arrêtez la musique précédente si elle est en cours
    MusicManager.play(this, musicKey, { loop: true, volume: 0.5 });
    this.currentMusicKey = musicKey;
}

  resetApplication() {
    // Détruire le joueur local
    if (this.player) {
        this.player.destroy();
        this.player = null;
    }

    // Détruire les joueurs distants
    if (this.remotePlayersGroup) {
        this.remotePlayersGroup.clear(true, true);
    }
    this.otherPlayers = {};

    // Arrêter la musique en cours
    if (this.currentMusic) {
        this.currentMusic.stop();
    }

    // Supprimer les colliders
    if (this.collisionLayer) {
        this.collisionLayer.destroy();
        this.collisionLayer = null;
    }

    // Réinitialiser le socket
    if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
    }

    // Réinitialiser les autres états
    this.latestPlayersData = {};
    this.myId = null;
 }
displayChallengePopup(challengerId) {
    if (this.challengePopup) {
        this.challengePopup.destroy();
    }

    let popupX = this.scale.width / 2;
    let popupY = this.scale.height / 2;
    let challengerPseudo = challengerId;

    if (this.latestPlayersData && this.latestPlayersData[challengerId]) {
        challengerPseudo = this.latestPlayersData[challengerId].pseudo || challengerId;
        const challengerData = this.latestPlayersData[challengerId];
        popupX = challengerData.x;
        popupY = challengerData.y - 60; // Décale au-dessus du joueur
        console.log("[displayChallengePopup] Monde: popupX=", popupX, "popupY=", popupY);
    } else {
        console.warn("[displayChallengePopup] challengerId", challengerId, "not found in latestPlayersData");
    }

    this.challengePopup = this.add.container(popupX, popupY);

    const bg = this.add.rectangle(0, 0, 340, 180, 0x222244, 0.95).setOrigin(0.5).setDepth(1003);
    const txt = this.add.text(0, -40, `Défi reçu de ${challengerPseudo}\nAccepter le duel ?`, {
        font: "22px Arial",
        fill: "#fff",
        align: "center"
    }).setOrigin(0.5).setDepth(1004);

    const btnAccept = this.add.text(-60, 40, "Accepter", {
        font: "20px Arial",
        fill: "#00ff00",
        backgroundColor: "#333",
        padding: { x: 12, y: 8 }
    }).setOrigin(0.5).setInteractive().setDepth(1004);

    const btnRefuse = this.add.text(60, 40, "Refuser", {
        font: "20px Arial",
        fill: "#ff3333",
        backgroundColor: "#333",
        padding: { x: 12, y: 8 }
    }).setOrigin(0.5).setInteractive().setDepth(1004);

    btnAccept.on("pointerdown", () => {
        const myPlayerId = this.registry.get("playerData")?._id;
        const challengerPlayerId = this.latestPlayersData[challengerId]?.playerId;
        const matchId = this.registry.get('ttMatchId'); // <-- récupère le matchId du registry
        this.socket.emit('challenge:accept', { 
            challengerId, 
            challengedId: this.myId,
            challengerPlayerId,
            challengedPlayerId: myPlayerId,
            matchId 
        });
        this.challengePopup.destroy();
        this.challengePopup = null;
    });
    btnRefuse.on("pointerdown", () => {
        this.socket.emit('challenge:cancel', { challengerId, challengedId: this.myId });
        this.challengePopup.destroy();
        this.challengePopup = null;
    });

    this.challengePopup.add([bg, txt, btnAccept, btnRefuse]);
    this.challengePopup.setDepth(1005);

    // Synchronise la popup avec la caméra (comme le pseudo)
    this.challengePopup.setScrollFactor(1);
}
 
}
