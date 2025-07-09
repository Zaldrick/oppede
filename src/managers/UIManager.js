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
  }

  createUI() {
    const gameWidth = this.scene.scale.width;
    const gameHeight = this.scene.scale.height;

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
      base: this.scene.add.circle(0, 0, joystickRadius, CONFIG.joystick.baseColor),
      thumb: this.scene.add.circle(0, 0, joystickRadius * CONFIG.joystick.thumbRadiusFactor, CONFIG.joystick.thumbColor),
    });
    this.joystick.setScrollFactor(0);

    // Bouton A
    const buttonARadius = gameWidth * 0.07 / this.zoomFactor;
    this.buttonA = this.scene.add.circle(gameWidth * 0.92, gameHeight * 0.79, buttonARadius, 0x808080)
      .setInteractive()
      .on('pointerdown', () => this.handleButtonA());
    this.buttonAText = this.scene.add.text(gameWidth * 0.92, gameHeight * 0.79, "A", {
      font: `${gameWidth * 0.06 / this.zoomFactor}px Arial`,
      fill: "#ffffff",
      align: "center"
    }).setOrigin(0.5);
    this.buttonA.setScrollFactor(0);
    this.buttonAText.setScrollFactor(0);

    // Bouton B
    const buttonBRadius = gameWidth * 0.07 / this.zoomFactor;
    this.buttonB = this.scene.add.circle(gameWidth * 0.75, gameHeight * 0.85, buttonBRadius, 0x808080)
      .setInteractive()
      .on('pointerdown', () => { this.scene.playerManager?.setSpeedBoost(true); })
      .on('pointerup', () => { this.scene.playerManager?.setSpeedBoost(false); })
      .on('pointerout', () => { this.scene.playerManager?.setSpeedBoost(false); });
    this.buttonBText = this.scene.add.text(gameWidth * 0.75, gameHeight * 0.85, "B", {
      font: `${gameWidth * 0.06 / this.zoomFactor}px Arial`,
      fill: "#ffffff",
      align: "center"
    }).setOrigin(0.5);
    this.buttonB.setScrollFactor(0);
    this.buttonBText.setScrollFactor(0);

    // Bouton Start
    const startButtonWidth = gameWidth * 0.20 / this.zoomFactor;
    const startButtonHeight = gameHeight * 0.04 / this.zoomFactor;
    this.startButton = this.scene.add.rectangle(gameWidth * 0.5, gameHeight * 0.93, startButtonWidth, startButtonHeight, 0x808080)
      .setInteractive()
      .on('pointerdown', () => this.handleStartButton());
    this.startButtonText = this.scene.add.text(gameWidth * 0.5, gameHeight * 0.93, "Start", {
      font: `${gameWidth * 0.05 / this.zoomFactor}px Arial`,
      fill: "#ffffff",
      align: "center"
    }).setOrigin(0.5);
    this.startButton.setScrollFactor(0);
    this.startButtonText.setScrollFactor(0);
  }

  handleButtonA() {
    const player = this.scene.playerManager?.getPlayer();
    if (!player) return;

    // Vérifie s'il y a un event interactif proche
    const obj = this.scene.mapManager?.getNearbyEventObject(player.x, player.y);
    if (obj && obj.eventData && obj.eventData.type === "chest") {
      this.scene.mapManager.handleChestInteraction(obj);
      return;
    }

    // Interaction joueur classique
    let targetId = this.scene.remotePlayerManager?.getNearestRemotePlayer(player.x, player.y);
    if (targetId) {
      this.showInteractionMenu(targetId);
    } else {
      this.scene.displayMessage("Aucun joueur à proximité\n pour l'interaction");
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

    this.interactionMenu = this.scene.add.container(menuX, menuY);

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

    const option4 = this.scene.add.text(menuX, menuY + 120, "?? Quiz", {
      font: "18px Arial",
      fill: "#fff",
      backgroundColor: "#9C27B0",
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setInteractive();

    this.interactionMenu.add([option1, option2, option3, option4]);

    option1.on("pointerdown", () => {
      this.scene.displayMessage(`Vous avez défié \nle joueur ${targetId}`);
      this.scene.socketManager?.sendChallenge(targetId);
      this.interactionMenu.destroy();
      this.interactionMenu = null;
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
    if (this.interactionMenu) {
      this.interactionMenu.destroy();
      this.interactionMenu = null;
    }

    if (this.startMenu) {
      this.startMenu.destroy();
    }

    const player = this.scene.playerManager?.getPlayer();
    if (!player) return;

    const playerX = player.x;
    const playerY = player.y;
    const gameWidth = this.scene.scale.width;
    const gameHeight = this.scene.scale.height;

    this.startMenu = this.scene.add.container(playerX, playerY - gameHeight * 0.15);

    const background = this.scene.add.rectangle(0, 0, gameWidth * 0.8, gameHeight * 0.6, 0x000000, 0.8).setOrigin(0.5);
    this.startMenu.add(background);

    const options = [
      { label: "Inventaire", action: () => this.openInventory() },
      { label: "Profil", action: () => this.openProfile() },
      { label: "Photo", action: () => this.openPhotoGallery() },
      { label: "Triple Triad", action: () => this.openTripleTriad() },
      { label: "Quiz", action: () => this.openQuizGame() },
      { label: "Retour", action: () => this.closeMenu() }
    ];

    options.forEach((option, index) => {
      const optionY = -gameHeight * 0.2 + index * (gameHeight * 0.14);

      const optionBackground = this.scene.add.rectangle(0, optionY, gameWidth * 0.7, gameHeight * 0.1, 0x333333, 0.8)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      optionBackground.on('pointerdown', () => {
        option.action();
      });

      const optionText = this.scene.add.text(0, optionY, option.label, {
        font: `${gameWidth * 0.08}px Arial`,
        fill: "#ffffff",
        align: "center"
      }).setOrigin(0.5);

      this.startMenu.add([optionBackground, optionText]);
    });

    this.startMenu.setScrollFactor(1);
  }

  closeMenu() {
    if (this.startMenu) {
      this.startMenu.destroy();
      this.startMenu = null;
    }
  }

  openInventory() {
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

    this.profileMenu = this.scene.add.container(gameWidth / 2, gameHeight / 2);

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
    this.closeMenu();
    this.scene.scene.launch("PhotoGalleryScene");
    this.scene.scene.pause();
  }

  openTripleTriad() {
    this.closeMenu();
    const playerData = this.scene.registry.get("playerData");
    const playerId = playerData && playerData._id ? playerData._id : null;

    if (!playerId) {
      this.scene.displayMessage("Impossible de trouver l'identifiant du joueur.");
      return;
    }

    this.scene.scene.launch("TripleTriadSelectScene", { playerId });
    this.scene.scene.pause();
  }

  openQuizGame() {
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
  }
}