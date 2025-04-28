import Phaser from "phaser";
import io from 'socket.io-client';

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  preload() {
    // Chargement du fond et du sprite sheet du joueur.
    this.load.image("background", "/assets/fond.jpg");
    this.load.spritesheet("player", "/assets/joueur.png", {
      frameWidth: 48,  // Ajustez selon votre sprite sheet
      frameHeight: 48, // Ajustez selon votre sprite sheet
    });
  }

  create() {
    const maxSpeed = 200; // par exemple, 200 pixels par seconde
    const centerX = this.scale.width / 2;
    const centerY = this.scale.height / 2;


    // Positionnement du background au centre du monde.
    // Les dimensions du monde sont définies plus loin.
    this.add.image(860 / 2, 430 / 2, "background");

    // Définition des limites du monde (1600x1200)
    this.physics.world.setBounds(0, 0, 860, 430);
    this.cameras.main.setBounds(0, 0, 860, 430);

    // Création du joueur au centre de l'écran.
    this.player = this.physics.add.sprite(centerX, centerY, "player");
    this.player.setCollideWorldBounds(true);
    this.player.body.setMaxVelocity(maxSpeed, maxSpeed);

    // Création des animations pour les déplacements.
    // Ces plages d'indices (frames 0–3, 4–7, etc.) sont à adapter à votre sprite sheet.
    this.anims.create({
        key: "walk-down",
        frames: this.anims.generateFrameNumbers("player", { start: 0, end: 2 }),
        frameRate: 8,
        repeat: -1,
      });
      this.anims.create({
        key: "walk-left",
        frames: this.anims.generateFrameNumbers("player", { start: 3, end: 5 }),
        frameRate: 8,
        repeat: -1,
      });
      this.anims.create({
        key: "walk-right",
        frames: this.anims.generateFrameNumbers("player", { start: 6, end: 8 }),
        frameRate: 8,
        repeat: -1,
      });
      this.anims.create({
        key: "walk-up",
        frames: this.anims.generateFrameNumbers("player", { start: 9, end: 11 }),
        frameRate: 8,
        repeat: -1,
      });

    // La caméra suit le joueur.
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Création du clavier pour le contrôle.
    this.cursors = this.input.keyboard.createCursorKeys();

    // Calcul dynamique pour le joystick
    const joystickX = this.scale.width * 0.15;
    const joystickY = this.scale.height * 0.85;
    const joystickRadius = Math.min(this.scale.width, this.scale.height) * 0.1;
    const thumbRadius = joystickRadius * 0.5;

    // Création du joystick via le plugin Rex Virtual Joystick.
    this.joystick = this.plugins.get("rexVirtualJoystick").add(this, {
      x: joystickX,
      y: joystickY,
      radius: joystickRadius,
      base: this.add.circle(0, 0, joystickRadius, 0x888888),
      thumb: this.add.circle(0, 0, thumbRadius, 0xffffff)
    });

    // Callback du joystick pour appliquer un déplacement.
    // Le multiplicateur de force est ici réglé à 10 (ajustez-le selon vos besoins).
    this.joystick.on("update", () => {
        // Conversion en radians et normalisation de l'angle
        const rawAngleRad = Phaser.Math.DegToRad(this.joystick.angle);
        const normalizedAngle = Phaser.Math.Angle.Wrap(rawAngleRad);
        const force = this.joystick.force *2 ; // Ajustez le multiplicateur selon vos besoins
        // Appliquer la vélocité avec l'angle normalisé
        this.player.setVelocityX(Math.cos(normalizedAngle) * force);
        this.player.setVelocityY(Math.sin(normalizedAngle) * force);
      });

    // Ajuste dynamiquement la position du joystick lors du redimensionnement.
    this.scale.on("resize", (gameSize) => {
      const newJoystickX = gameSize.width * 0.15;
      const newJoystickY = gameSize.height * 0.85;
      this.joystick.setPosition(newJoystickX, newJoystickY);
    });

    // Lancement du mode plein écran dès que l'utilisateur touche l'écran.
    this.input.once("pointerup", () => {
      if (!this.scale.isFullscreen) {
        this.scale.startFullscreen();
      }
    });

    // Gestion de l'orientation pour l'expérience mobile.
    window.addEventListener("orientationchange", () => {
      if (window.orientation === 90 || window.orientation === -90) {
        console.log("Mode paysage");
      } else {
        alert("Pour une meilleure expérience, veuillez tourner votre téléphone en mode paysage !");
      }
    });


    // Configuration du socket et initialisation de variables
    this.socket = io('http://localhost:5000');
    this.otherPlayers = {};
    this.latestPlayersData = {};
    // Lors de la connexion, on enregistre notre id et on informe le serveur
    this.socket.on('connect', () => {
      this.myId = this.socket.id;
      console.log("Connecté avec id:", this.myId);
      this.socket.emit('newPlayer', {
        x: this.player.x,
        y: this.player.y,
        character:  'default'
      });
    });

    // Écouter la diffusion d'état de tous les joueurs
    this.socket.on('playersUpdate', (players) => {
      this.latestPlayersData = players;
    });
}

  update() {
    let newAnim = "";
    let keyboardActive = false;
  
    // Contrôle clavier (prioritaire)
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
  
    // Si aucune touche n'est pressée, on se base sur le joystick
    if (!keyboardActive && this.joystick && this.joystick.force > 0) {
      const angle = this.joystick.angle;
      // Déterminer l'animation en fonction de l'angle du joystick
      if (angle > -45 && angle <= 45) {
        newAnim = "walk-right";
      } else if (angle > 45 && angle <= 135) {
        newAnim = "walk-down";
      } else if (angle > 135 || angle <= -135) {
        newAnim = "walk-left";
      } else if (angle > -135 && angle <= -45) {
        newAnim = "walk-up";
      }
      // Note : la callback du joystick (définie dans create()) ajuste déjà la vélocité.
    }
  
    // Si aucun input n'est présent, on arrête le déplacement et l'animation
    if (newAnim === "") {
      this.player.setVelocity(0);
      if (this.player.anims.isPlaying) {
        this.player.anims.stop();
      }
      this.currentAnim = "";
    } else if (newAnim !== this.currentAnim) {
      // Change l'animation uniquement si elle change
      this.player.anims.play(newAnim, true);
      this.currentAnim = newAnim;
    }



    // Émettre la position actuelle du joueur vers le serveur
    if(this.socket && this.myId) {
      this.socket.emit('playerMove', { x: this.player.x, y: this.player.y,anim: this.currentAnim });
    }

// Mise à jour des autres joueurs à partir des dernières données reçues
if (this.latestPlayersData) {
  Object.keys(this.latestPlayersData).forEach((id) => {
    if (id === this.myId) return;  // Ignore notre propre joueur

    const data = this.latestPlayersData[id];

    // Si le sprite du joueur n'existe pas encore, on le crée
    if (!this.otherPlayers[id]) {
      let newSprite = this.physics.add.sprite(data.x, data.y, "player");
      newSprite.setCollideWorldBounds(true);
      newSprite.currentAnim = data.anim || ""; // Initialiser l'animation
      this.otherPlayers[id] = newSprite;
      
      // Démarrer l'animation si spécifiée
      if (data.anim) {
        newSprite.anims.play(data.anim, true);
      }
    } else {
      // Interpolation pour lisser le mouvement
      const lerpFactor = 0.2;
      let targetX = data.x;
      let targetY = data.y;
      
      let newX = Phaser.Math.Linear(this.otherPlayers[id].x, targetX, lerpFactor);
      let newY = Phaser.Math.Linear(this.otherPlayers[id].y, targetY, lerpFactor);
      
      // Si la différence est minime, on attribue directement la position cible
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
      
      // Gestion de l'animation pour le joueur distant
      if (data.anim) {
        // Si l'animation reçue est différente de celle qui est jouée, lancez-la
        if (this.otherPlayers[id].currentAnim !== data.anim) {
          this.otherPlayers[id].anims.play(data.anim, true);
          this.otherPlayers[id].currentAnim = data.anim;
        }
      } else {
        // S'il n'y a pas d'animation (joueur immobile), stoppez l'animation si elle est en cours
        if (this.otherPlayers[id].anims.isPlaying) {
          this.otherPlayers[id].anims.stop();
        }
        this.otherPlayers[id].currentAnim = "";
      }
    }
  });

      // Détruire les sprites des joueurs déconnectés
      Object.keys(this.otherPlayers).forEach((id) => {
        if (!this.latestPlayersData[id]) {
          this.otherPlayers[id].destroy();
          delete this.otherPlayers[id];
        }
      });
    }
  }
  
}
