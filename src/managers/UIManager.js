const CONFIG = {
  joystick: {
    baseColor: 0x888888,
    thumbColor: 0xffffff,
    radiusFactor: 0.1,
    thumbRadiusFactor: 0.5,
  },
};

export class UIManager {
  constructor(scene) {
    this.scene = scene;
    this.joystick = null;
    this.buttonA = null;
    this.buttonB = null;
    this.startButton = null;
    this.interactionMenu = null;
    this.startMenu = null;
    this.profileMenu = null;
    this.zoomFactor = 1;

    // Dialogue System
    this.dialogueGroup = null;
    this.isDialogueActive = false;
    this.dialogueData = [];
    this.currentDialogueIndex = 0;
    this.dialogueText = null;
    this.dialogueName = null;
    this.dialogueAvatar = null;
    this.dialogueNextIcon = null;
    this.lastDialogueAdvance = 0;
  }

  createUI() {
    const gameWidth = this.scene.scale.width;
    const gameHeight = this.scene.scale.height;

    // Si la largeur est supérieure à la hauteur (mode paysage/desktop), on n'affiche pas les contrôles tactiles
    if (gameWidth > gameHeight) {
        return;
    }

    const joystickPlugin = this.scene.plugins.get('rexvirtualjoystickplugin');
    if (!joystickPlugin) {
      console.error("rexVirtualJoystick plugin is not available in GameScene.");
      return;
    }

    // Joystick
    const joystickRadius = gameWidth * 0.12 / this.zoomFactor;
    this.joystick = joystickPlugin.add(this.scene, {
      x: gameWidth * 0.2,
      y: gameHeight * 0.82,
      radius: joystickRadius,
      base: this.scene.add.circle(0, 0, joystickRadius, CONFIG.joystick.baseColor).setDepth(9999),
      thumb: this.scene.add.circle(0, 0, joystickRadius * CONFIG.joystick.thumbRadiusFactor, CONFIG.joystick.thumbColor).setDepth(9999),
    });
    this.joystick.setScrollFactor(0);

    // Bouton A
    const buttonARadius = gameWidth * 0.07 / this.zoomFactor;
    this.buttonA = this.scene.add.circle(gameWidth * 0.87, gameHeight * 0.8, buttonARadius, 0x808080)
      .setInteractive()
      .setDepth(9999)
      .on('pointerdown', () => this.handleButtonA());
    this.buttonAText = this.scene.add.text(gameWidth * 0.87, gameHeight * 0.8, "A", {
      font: `${gameWidth * 0.06 / this.zoomFactor}px Arial`,
      fill: "#ffffff",
      align: "center"
    }).setOrigin(0.5).setDepth(9999);
    this.buttonA.setScrollFactor(0);
    this.buttonAText.setScrollFactor(0);

    // Bouton B
    const buttonBRadius = gameWidth * 0.07 / this.zoomFactor;
    this.buttonB = this.scene.add.circle(gameWidth * 0.74, gameHeight * 0.85, buttonBRadius, 0x808080)
      .setInteractive()
      .setDepth(9999)
      .on('pointerdown', () => { 
          if (this.isDialogueActive) {
              this.advanceDialogue();
          } else {
              this.scene.playerManager?.setSpeedBoost(true); 
          }
      })
      .on('pointerup', () => { this.scene.playerManager?.setSpeedBoost(false); })
      .on('pointerout', () => { this.scene.playerManager?.setSpeedBoost(false); });
    this.buttonBText = this.scene.add.text(gameWidth * 0.74, gameHeight * 0.85, "B", {
      font: `${gameWidth * 0.06 / this.zoomFactor}px Arial`,
      fill: "#ffffff",
      align: "center"
    }).setOrigin(0.5).setDepth(9999);
    this.buttonB.setScrollFactor(0);
    this.buttonBText.setScrollFactor(0);

    // Bouton Start
    const startButtonWidth = gameWidth * 0.20 / this.zoomFactor;
    const startButtonHeight = gameHeight * 0.04 / this.zoomFactor;
    this.startButton = this.scene.add.rectangle(gameWidth * 0.5, gameHeight * 0.88, startButtonWidth, startButtonHeight, 0x808080)
      .setInteractive()
      .setDepth(9999)
      .on('pointerdown', () => this.handleStartButton());
    this.startButtonText = this.scene.add.text(gameWidth * 0.5, gameHeight * 0.88, "Start", {
      font: `${gameWidth * 0.05 / this.zoomFactor}px Arial`,
      fill: "#ffffff",
      align: "center"
    }).setOrigin(0.5).setDepth(9999);
    this.startButton.setScrollFactor(0);
    this.startButtonText.setScrollFactor(0);
  }

  handleButtonA() {
    if (this.isDialogueActive) {
        this.advanceDialogue();
        return;
    }

    const player = this.scene.playerManager?.getPlayer();
    if (!player) return;

    // ✅ CORRECTION - Vérifie s'il y a un event interactif proche (incluant NPCs)
    const obj = this.scene.mapManager?.getNearbyEventObject(player.x, player.y);
    if (obj) {
        console.log("🎯 Objet détecté:", obj.npcType || obj.eventData?.type || "inconnu");
        
        // Gestion des NPCs (AJOUTÉ)
        if (obj.npcType) {
            this.scene.mapManager.handleNPCInteraction(obj);
            return;
        }
        
        // Gestion des coffres (existant)
        if (obj.eventData && obj.eventData.type === "chest") {
            this.scene.mapManager.handleChestInteraction(obj);
            return;
        }
    }

    // ✅ AMÉLIORATION - Interaction joueur classique seulement si aucun objet interactif
    let targetId = this.scene.remotePlayerManager?.getNearestRemotePlayer(player.x, player.y);
    if (targetId) {
        this.showInteractionMenu(targetId);
    } else {
        this.scene.displayMessage("Aucun joueur à proximité\n pour l'interaction");
    }
  }

  handleInteraction() {
    const player = this.scene.playerManager?.getPlayer();
    if (!player) return;

    const eventObject = this.scene.mapManager?.getNearbyEventObject(player.x, player.y);
    if (!eventObject) return;

    if (eventObject.eventData && eventObject.eventData.type === "chest") {
      this.scene.mapManager.handleChestInteraction(eventObject);
    } else if (eventObject.npcType) {
      this.scene.mapManager.handleNPCInteraction(eventObject);
    }
  }

  showInteractionMenu(targetId) {
    if (this.interactionMenu) {
      this.interactionMenu.destroy();
      this.interactionMenu = null;
    }

    const player = this.scene.playerManager?.getPlayer();
    if (!player) return;

    const menuX = player.x + 100;
    const menuY = player.y - 100;

    this.interactionMenu = this.scene.add.container(menuX, menuY).setDepth(9999);

    const background = this.scene.add.rectangle(0, 0, 160, 125, 0x000000, 0.8).setOrigin(0.5);
    this.interactionMenu.add(background);

    const title = this.scene.add.text(0, -80, `Joueur: ${targetId}`, {
      font: "20px Arial",
      fill: "#ffffff",
    }).setOrigin(0.5);
    this.interactionMenu.add(title);

    const option1 = this.scene.add.text(0, -35, "Défier", {
      font: "18px Arial",
      fill: "#ffffff",
      backgroundColor: "#333333",
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setInteractive();

    const option2 = this.scene.add.text(0, 5, "Faire signe", {
      font: "18px Arial",
      fill: "#ffffff",
      backgroundColor: "#333333",
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setInteractive();

    const option3 = this.scene.add.text(0, 45, "Retour", {
      font: "18px Arial",
      fill: "#ffffff",
      backgroundColor: "#333333",
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setInteractive();

    const option4 = this.scene.add.text(menuX, menuY + 120, "🧠 Quiz", {
      font: "18px Arial",
      fill: "#fff",
      backgroundColor: "#9C27B0",
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setInteractive();

    this.interactionMenu.add([option1, option2, option3, option4]);

    option1.on("pointerdown", () => {
      // ✅ CORRIGÉ : Récupère le playerId (database ID) et le pseudo depuis les données des joueurs
      const latestPlayersData = this.scene.remotePlayerManager?.getLatestPlayersData();
      const targetPlayerData = latestPlayersData?.[targetId];
      
      if (targetPlayerData && targetPlayerData.playerId) {
        // Lance le menu de configuration PvP avec le database player ID
        this.interactionMenu.destroy();
        this.interactionMenu = null;
        
        this.scene.startTripleTriadPvP(targetPlayerData.playerId, targetPlayerData.pseudo || targetId);
      } else {
        console.error(`[UIManager] Impossible de trouver les données du joueur pour ${targetId}`);
        this.scene.displayMessage(`Impossible de défier ce joueur.\nDonnées manquantes.`);
        this.interactionMenu.destroy();
        this.interactionMenu = null;
      }
    });

    option2.on("pointerdown", () => {
      this.scene.displayMessage(`Vous avez fait signe \nau joueur ${targetId}`);
      this.scene.socketManager?.sendInteraction(targetId, "faireSigne");
      this.interactionMenu.destroy();
      this.interactionMenu = null;
    });

    option3.on("pointerdown", () => {
      this.interactionMenu.destroy();
      this.interactionMenu = null;
    });

    option4.on("pointerdown", () => {
      this.scene.displayMessage(`Vous avez invité ${targetId} à un quiz`);
      this.scene.socketManager?.sendQuizInvite(targetId);
      this.interactionMenu.destroy();
      this.interactionMenu = null;
    });
  }

    handleStartButton() {
        console.log(`Handle start button HYBRIDE v2`);
        if (this.interactionMenu) {
            this.interactionMenu.destroy();
            this.interactionMenu = null;
        }

        if (this.startMenu) {
            this.startMenu.destroy();
            this.startMenu = null;
            return;
        }

        const gameWidth = this.scene.scale.width;
        const gameHeight = this.scene.scale.height;

        // Positionner le menu au centre de l'écran (HUD)
        this.startMenu = this.scene.add.container(gameWidth / 2, gameHeight / 2).setDepth(9999);
        this.startMenu.setScrollFactor(0);

        const background = this.scene.add.rectangle(0, 0, gameWidth * 0.95, gameHeight * 0.85, 0x000000, 0.85).setOrigin(0.5);
        background.setScrollFactor(0);
        this.startMenu.add(background);

        // ❌ Bouton de fermeture (Croix en haut à droite)
        const closeBtnSize = 40;
        // Position relative au centre du conteneur (0,0)
        // background.width est gameWidth * 0.95
        const bgWidth = gameWidth * 0.95;
        const bgHeight = gameHeight * 0.85;
        
        const closeBtnX = bgWidth / 2 - 30;
        const closeBtnY = -bgHeight / 2 + 30;
        
        const closeBtn = this.scene.add.text(closeBtnX, closeBtnY, '✕', {
            font: 'bold 30px Arial',
            fill: '#ffffff'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        
        closeBtn.on('pointerdown', () => this.closeMenu());
        this.startMenu.add(closeBtn);

        const menuOptions = [
            {
                label: "Inventaire",
                icon: "🎒",
                color: 0x4CAF50,
                action: () => this.openInventory(),
                description: "Gérer vos objets"
            },
            {
                label: "Triple Triad",
                icon: "🃏",
                color: 0x2196F3,
                action: () => this.openTripleTriad(),
                description: "Jeux de cartes"
            },
            {
                label: "Quiz",
                icon: "🧠",
                color: 0x9C27B0,
                action: () => this.openQuizGame(),
                description: "Défis multijoueur"
            },
            {
                label: "Photos",
                icon: "📸",
                color: 0xFF9800,
                action: () => this.openPhotoGallery(),
                description: "Galerie d'images"
            },
            {
                label: "Équipe",
                icon: "⚾",
                color: 0xFF6B6B,
                action: () => this.openPokemonTeam(),
                description: "Votre équipe"
            },
            {
                label: "Journal",
                icon: "📜",
                color: 0x8E44AD,
                action: () => this.openQuestJournal(),
                description: "Vos quêtes"
            }
        ];

        const isLandscape = gameWidth > gameHeight;
        const cols = isLandscape ? 3 : 2;
        const rows = Math.ceil(menuOptions.length / cols);

        const cardSize = Math.min(gameWidth * 0.35, gameHeight * 0.22, 250);
        const spacing = cardSize * 0.15;

        const totalWidth = cols * cardSize + (cols - 1) * spacing;
        const totalHeight = rows * cardSize + (rows - 1) * spacing;

        const startX = -totalWidth / 2 + cardSize / 2;
        const startY = -totalHeight / 2 + cardSize / 2;

        menuOptions.forEach((option, index) => {
            const row = Math.floor(index / cols);
            const col = index % cols;
            const x = startX + col * (cardSize + spacing);
            const y = startY + row * (cardSize + spacing);

            const cardBorder = this.scene.add.rectangle(x, y, cardSize + 8, cardSize + 8, 0xffffff, 0.4)
                .setOrigin(0.5).setScrollFactor(0);

            const cardBg = this.scene.add.rectangle(x, y, cardSize, cardSize, option.color, 0.9)
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true })
                .setScrollFactor(0);

            const iconText = this.scene.add.text(x, y - cardSize * 0.15, option.icon, {
                font: `${Math.round(cardSize * 0.4)}px Arial`,
                align: "center"
            }).setOrigin(0.5).setScrollFactor(0);

            const labelText = this.scene.add.text(x, y + cardSize * 0.15, option.label, {
                font: `bold ${Math.round(cardSize * 0.16)}px Arial`,
                fill: "#ffffff",
                align: "center"
            }).setOrigin(0.5).setScrollFactor(0);

            const descText = this.scene.add.text(x, y + cardSize * 0.3, option.description, {
                font: `${Math.round(cardSize * 0.11)}px Arial`,
                fill: "#e0e0e0",
                align: "center"
            }).setOrigin(0.5).setScrollFactor(0);

            cardBg.on('pointerdown', () => {
                console.log(`🎯 Clic sur: ${option.label}`);
                option.action();
            });

            this.startMenu.add([cardBorder, cardBg, iconText, labelText, descText]);
        });

        this.startMenu.setScrollFactor(0);

    }

  closeMenu() {
    console.log("❌ FERMETURE MENU");
    if (this.startMenu) {
      this.startMenu.destroy();
      this.startMenu = null;
    }
  }

  openQuestJournal() {
    console.log("📜 OUVERTURE JOURNAL QUÊTES");
    this.closeMenu();
    const playerData = this.scene.registry.get("playerData");
    const playerId = playerData && playerData._id ? playerData._id : null;

    if (!playerId) {
      this.scene.displayMessage("Impossible de trouver l'identifiant du joueur.");
      return;
    }

    this.scene.scene.launch("QuestScene", { playerId });
    this.scene.scene.pause();
  }

  openInventory() {
    console.log("📦 OUVERTURE INVENTAIRE");
    this.closeMenu();
    const playerData = this.scene.registry.get("playerData");
    const playerId = playerData && playerData._id ? playerData._id : null;

    if (!playerId) {
      this.scene.displayMessage("Impossible de trouver l'identifiant du joueur.");
      return;
    }

    this.scene.scene.launch("InventoryScene", { playerId });
    this.scene.scene.pause();
  }

  openProfile() {
    if (this.startMenu) {
      this.startMenu.destroy();
      this.startMenu = null;
    }

    if (this.profileMenu) {
      this.profileMenu.destroy();
    }

    const gameWidth = this.scene.scale.width;
    const gameHeight = this.scene.scale.height;

    this.profileMenu = this.scene.add.container(gameWidth / 2, gameHeight / 2).setDepth(9999);

    const background = this.scene.add.rectangle(0, 0, gameWidth * 0.8, gameHeight * 0.6, 0x000000, 0.8).setOrigin(0.5);
    this.profileMenu.add(background);

    const currentPseudoText = this.scene.add.text(0, -gameHeight * 0.3, `Current Pseudo: ${this.scene.currentPseudo || "Player"}`, {
      font: "18px Arial",
      fill: "#ffffff",
    }).setOrigin(0.5);
    this.profileMenu.add(currentPseudoText);

    const pseudoButton = this.scene.add.text(0, -gameHeight * 0.1, "Change Pseudo", {
      font: "18px Arial",
      fill: "#ffffff",
      backgroundColor: "#333333",
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setInteractive();

    pseudoButton.on("pointerdown", () => {
      const inputElement = document.getElementById("pseudo-input");
      const newPseudo = inputElement ? inputElement.value.trim() : null;
      if (newPseudo && this.scene.socketManager?.getSocket()) {
        this.scene.socketManager.getSocket().emit("updatePseudo", { id: this.scene.socketManager.getMyId(), pseudo: newPseudo });
        this.scene.currentPseudo = newPseudo;
        currentPseudoText.setText(`Current Pseudo: ${newPseudo}`);
        this.scene.displayMessage(`Pseudo updated to: ${newPseudo}`);
      }
    });
    this.profileMenu.add(pseudoButton);

    const returnButton = this.scene.add.text(0, gameHeight * 0.2, "Return", {
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

  openPhotoGallery() {
    console.log("📸 OUVERTURE GALERIE PHOTOS");
    this.closeMenu();
    this.scene.scene.launch("PhotoGalleryScene");
    this.scene.scene.pause();
  }

  openTripleTriad() {
    console.log("🃏 OUVERTURE TRIPLE TRIAD");
    this.closeMenu();
    const playerData = this.scene.registry.get("playerData");
    const playerId = playerData && playerData._id ? playerData._id : null;

    if (!playerId) {
      this.scene.displayMessage("Impossible de trouver l'identifiant du joueur.");
      return;
    }

    // 🛡️ VÉRIFICATION AVEC L'INVENTAIRE DÉJÀ CHARGÉ
    const inventory = this.scene.inventory || [];
    const playerCards = inventory.filter(item => item.type === 'card' || item.nom.includes('Carte'));

    console.log('[UIManager] Cartes dans l\'inventaire:', playerCards);

    if (playerCards.length < 5) {
      this.scene.displayMessage("Vous devez posséder au moins\n5 cartes pour jouer au Triple Triad !\n\nOuvrez des coffres pour en obtenir.");
      return;
    }

    // ✅ NOUVEAU : Lance directement le menu de config IA
    this.scene.startTripleTriadAI();
  }

  openQuizGame() {
    console.log("🧠 OUVERTURE QUIZ");
    this.closeMenu();
    const playerData = this.scene.registry.get("playerData");
    const playerId = playerData && playerData._id ? playerData._id : null;
    const playerName = this.scene.registry.get("playerPseudo") || "Joueur";

    if (!playerId) {
      this.scene.displayMessage("Impossible de trouver l'identifiant du joueur.");
      return;
    }

    this.scene.scene.launch("QuizLobbyScene", { 
      playerId, 
      playerName 
    });
    this.scene.scene.pause();
  }

  setupCamera() {
    this.zoomFactor = Math.min(this.scene.scale.width / 768, this.scene.scale.height / 1080) * 1.75;
    this.scene.cameras.main.setZoom(this.zoomFactor);
    const player = this.scene.playerManager?.getPlayer();
    if (player) {
      this.scene.cameras.main.startFollow(player, true, 0.1, 0.1);
    }
  }

  setupControls() {
    this.scene.scale.on("resize", this.handleResize, this);

    this.scene.input.keyboard.on('keydown-SHIFT', () => {
      this.scene.playerManager?.setSpeedBoost(true);
    });
    this.scene.input.keyboard.on('keyup-SHIFT', () => {
      this.scene.playerManager?.setSpeedBoost(false);
    });

    // Entrée pour interagir (A)
    this.scene.input.keyboard.on('keydown-ENTER', () => {
        this.handleButtonA();
    });

    // Echap pour le menu (Start)
    this.scene.input.keyboard.on('keydown-ESC', () => {
        this.handleStartButton();
    });

    // Global click for dialogue
    this.scene.input.on('pointerdown', (pointer) => {
        if (this.isDialogueActive) {
            this.advanceDialogue();
        }
    });
  }

  handleResize(gameSize) {
    const newJoystickX = gameSize.width * 0.2;
    const newJoystickY = gameSize.height * 0.82;
    if (this.joystick) {
      this.joystick.setPosition(newJoystickX, newJoystickY);
    }
  }

  getJoystick() {
    return this.joystick;
  }

  openPokemonTeam() {
    console.log("🔴 OUVERTURE ÉQUIPE POKÉMON");
    this.closeMenu();
    const playerData = this.scene.registry.get("playerData");
    const playerId = playerData && playerData._id ? playerData._id : null;

    if (!playerId) {
      this.scene.displayMessage("Impossible de trouver l'identifiant du joueur.");
      return;
    }

    // Lance la scène Pokémon Team en mode pause de GameScene
    this.scene.scene.launch("PokemonTeamScene", {
      playerId: playerId,
      returnScene: "GameScene"
    });
    this.scene.scene.pause();
  }

  // --- DIALOGUE SYSTEM ---

  showDialogue(dialogues) {
    if (!dialogues) return;
    
    // Normalize to array
    this.dialogueData = Array.isArray(dialogues) ? dialogues : [dialogues];
    this.currentDialogueIndex = 0;
    this.isDialogueActive = true;

    // Stop player movement
    if (this.scene.playerManager && this.scene.playerManager.player) {
        this.scene.playerManager.player.setVelocity(0);
        this.scene.playerManager.player.anims.stop();
    }

    this.createDialogueUI();
    this.updateDialogueContent();
  }

  createDialogueUI() {
    if (this.dialogueGroup) {
        this.dialogueGroup.setVisible(true);
        return;
    }

    const gameWidth = this.scene.scale.width;
    const gameHeight = this.scene.scale.height;
    
    // Container for all dialogue elements
    this.dialogueGroup = this.scene.add.container(0, 0).setDepth(10000).setScrollFactor(0);

    // Dimensions
    const margin = 20;
    const boxHeight = gameHeight * 0.25; // 25% of screen height
    const boxWidth = gameWidth - (margin * 2);
    const boxX = margin;
    const boxY = margin; // Top of screen

    // Background (Retro style: Black with white border)
    const bg = this.scene.add.rectangle(boxX + boxWidth/2, boxY + boxHeight/2, boxWidth, boxHeight, 0x000000, 0.9);
    bg.setStrokeStyle(4, 0xffffff);
    this.dialogueGroup.add(bg);

    // Avatar Area (Left 15%)
    const avatarWidth = boxWidth * 0.15;
    const avatarSize = Math.min(avatarWidth, boxHeight * 0.6);
    const avatarX = boxX + (avatarWidth / 2) + 10;
    const avatarY = boxY + (boxHeight / 2) - 10;

    this.dialogueAvatar = this.scene.add.sprite(avatarX, avatarY, 'playerAppearance'); // Placeholder texture
    this.dialogueGroup.add(this.dialogueAvatar);

    // Name Text (Below Avatar)
    this.dialogueName = this.scene.add.text(avatarX, avatarY + (avatarSize/2) + 15, "Name", {
        font: "bold 16px Arial",
        fill: "#ffff00", // Yellow for name
        align: "center",
        wordWrap: { width: avatarWidth }
    }).setOrigin(0.5);
    this.dialogueGroup.add(this.dialogueName);

    // Dialogue Text (Right side)
    const textX = boxX + avatarWidth + 30;
    const textY = boxY + 20;
    const textWidth = boxWidth - avatarWidth - 50;

    this.dialogueText = this.scene.add.text(textX, textY, "", {
        font: "20px Arial",
        fill: "#ffffff",
        align: "left",
        wordWrap: { width: textWidth }
    });
    this.dialogueGroup.add(this.dialogueText);

    // Next Indicator (Blinking arrow at bottom right)
    this.dialogueNextIcon = this.scene.add.text(boxX + boxWidth - 30, boxY + boxHeight - 30, "▼", {
        font: "20px Arial",
        fill: "#ffffff"
    }).setOrigin(0.5);
    
    this.scene.tweens.add({
        targets: this.dialogueNextIcon,
        y: boxY + boxHeight - 25,
        duration: 500,
        yoyo: true,
        repeat: -1
    });
    this.dialogueGroup.add(this.dialogueNextIcon);
  }

  updateDialogueContent() {
    if (!this.dialogueData || this.dialogueData.length === 0) return;

    const data = this.dialogueData[this.currentDialogueIndex];

    // Update Text
    this.dialogueText.setText(data.text || "...");

    // Update Name
    if (data.name) {
        this.dialogueName.setText(data.name);
        this.dialogueName.setVisible(true);
    } else {
        this.dialogueName.setVisible(false);
    }

    // Update Avatar
    if (data.avatar) {
        if (this.scene.textures.exists(data.avatar)) {
            this.dialogueAvatar.setTexture(data.avatar);
            this.dialogueAvatar.setVisible(true);
            
            // Scale to fit
            const gameHeight = this.scene.scale.height;
            const boxHeight = gameHeight * 0.25;
            const avatarWidth = (this.scene.scale.width - 40) * 0.15;
            const maxSize = Math.min(avatarWidth, boxHeight * 0.6);
            
            this.dialogueAvatar.setScale(1);
            const scale = maxSize / Math.max(this.dialogueAvatar.width, this.dialogueAvatar.height);
            this.dialogueAvatar.setScale(scale);
        } else {
            this.dialogueAvatar.setVisible(false);
        }
    } else {
        this.dialogueAvatar.setVisible(false);
    }
  }

  advanceDialogue() {
    const now = Date.now();
    if (this.lastDialogueAdvance && now - this.lastDialogueAdvance < 300) {
        return;
    }
    this.lastDialogueAdvance = now;

    this.currentDialogueIndex++;
    if (this.currentDialogueIndex < this.dialogueData.length) {
        this.updateDialogueContent();
    } else {
        this.closeDialogue();
    }
  }

  closeDialogue() {
    this.isDialogueActive = false;
    if (this.dialogueGroup) {
        this.dialogueGroup.setVisible(false);
    }
  }

  destroy() {
    if (this.interactionMenu) {
      this.interactionMenu.destroy();
      this.interactionMenu = null;
    }
    
    if (this.startMenu) {
      this.startMenu.destroy();
      this.startMenu = null;
    }
    
    if (this.profileMenu) {
      this.profileMenu.destroy();
      this.profileMenu = null;
    }

    if (this.dialogueGroup) {
      this.dialogueGroup.destroy();
      this.dialogueGroup = null;
    }
  }
}