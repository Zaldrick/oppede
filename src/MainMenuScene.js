import Phaser from "phaser";
import io from "socket.io-client"; // Import io from socket.io-client

export class MainMenuScene extends Phaser.Scene {
    constructor() {
        super("MainMenuScene"); // Removed plugin registration
    }

    init() {
        this.pseudo = ""; // Track the player's pseudo
        this.pseudoError = ""; // Track validation errors
        this.socket = null; // WebSocket connection
        this.backgroundMusic = null; // Track background music
    }

    preload() {
        this.load.image("mainMenuBackground", "/assets/mainMenuBackground.png"); // Load the background image
        this.load.audio("silentSound", "/assets/music/silent.mp3");
        this.load.audio("mainMenuMusic", "/assets/music/mainMenuMusic.mp3"); // Load background music
        this.load.image("logo", "/assets/logo.png"); // Load the logo image
    }

    create() {
        const gameWidth = this.scale.width;
        const gameHeight = this.scale.height;

        // Define a maximum font size scale factor for PC and cap the sizes
        const maxScaleFactor = gameWidth > gameHeight ? gameHeight / gameWidth : 1;
        const maxFontSize = 20; // Maximum font size in pixels
        const maxInputWidth = 200; // Maximum input width in pixels
        const maxInputHeight = 40; // Maximum input height in pixels

        // Add background image and preserve its aspect ratio
        const background = this.add.image(0, 0, "mainMenuBackground").setOrigin(0.5, 0.5);
        const scaleX = gameWidth / background.width;
        const scaleY = gameHeight / background.height;
        const scale = Math.max(scaleX, scaleY); // Choose the larger scale to zoom while preserving aspect ratio
        background.setScale(scale).setPosition(gameWidth / 2, gameHeight / 2);

        // Notify app about the active scene
        this.game.events.emit("scene-switch", "MainMenuScene");

        // Hide chat and input elements
        const chatElement = document.getElementById("chat");
        const inputElement = document.getElementById("input");
        if (chatElement) chatElement.style.display = "none";
        if (inputElement) inputElement.style.display = "none";

        // "Appuyez pour Démarrer" text
        const startText = this.add.text(gameWidth / 2, gameHeight * 0.69, "Appuyez pour \nDémarrer", {
            font: `${gameWidth * 0.1}px Arial`,
            fill: "#ffffff",
            align: "center" // Center-align the text
        }).setOrigin(0.5);

        // Add an invisible interactive zone covering the entire screen
        const fullScreenZone = this.add.zone(0, 0, gameWidth, gameHeight)
            .setOrigin(0)
            .setInteractive();

        // Connection UI elements (initially hidden)
        const titleText = this.add.text(gameWidth / 2, gameHeight * 0.64, "Qui es-tu ?", {
            font: `${Math.min(gameWidth * 0.06 * maxScaleFactor, maxFontSize)}px Arial`,
            fill: "#ffffff",
        }).setOrigin(0.5).setVisible(false);

        const pseudoInput = this.add.dom(gameWidth / 2, gameHeight * 0.675, "input", {
            type: "text",
        }).setOrigin(0.5).setScrollFactor(0).setVisible(false);


        // Apply styles and attributes directly to the pseudoInput DOM node
        if (pseudoInput.node) {
            pseudoInput.node.style.width = `${Math.min(gameWidth * 0.4 * maxScaleFactor, maxInputWidth)}px`;
            pseudoInput.node.style.height = `${Math.min(gameWidth * 0.06 * maxScaleFactor, maxInputHeight)}px`;
            pseudoInput.node.style.fontSize = `${Math.min(gameWidth * 0.06 * maxScaleFactor, maxFontSize)}px`;
            pseudoInput.node.style.border = "2px solid #ccc"; // Adjust border size
            pseudoInput.node.style.textAlign = "center"; // Center-align text
            pseudoInput.node.style.backgroundColor = "#ffffff"; // Set background color
            pseudoInput.node.style.color = "#000000"; // Set text color
            pseudoInput.node.placeholder = "Ton prénom"; // Set placeholder

            // Add event listener for "Enter" key
            pseudoInput.node.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    submitButton.emit("pointerdown"); // Trigger the same behavior as clicking "Connexion"
                }
            });
        }

        const errorText = this.add.text(gameWidth / 2, gameHeight * 0.56, "", {
            font: `${Math.min(gameWidth * 0.05 * maxScaleFactor, maxFontSize)}px Arial`,
            fill: "#ff0000",
            padding: { x: 10, y: 5 },
        }).setOrigin(0.5).setBackgroundColor(null).setVisible(false);

        // Vérifiez si un message de déconnexion est présent dans le registry
        const disconnectMessage = this.registry.get('disconnectMessage');
        if (disconnectMessage) {
            // Affichez le message avec errorText
            errorText.setText(disconnectMessage);
            errorText.setBackgroundColor("#ff0000"); // Ajoutez un fond rouge pour attirer l'attention
            errorText.setColor("#ffffff"); // Changez la couleur du texte
            errorText.setVisible(true);

            // Optionnel : Ajoutez une animation pour attirer l'attention
            this.tweens.add({
                targets: errorText,
                alpha: { from: 0, to: 1 }, // Faites apparaître progressivement
                duration: 500,
                ease: "Power2",
            });

            // Supprimez le message du registry pour éviter qu'il ne s'affiche à nouveau
            this.registry.set('disconnectMessage', null);
        }

        const submitButton = this.add.text(gameWidth / 2, gameHeight * 0.77, "Connexion", {
            font: `${Math.min(gameWidth * 0.1 * maxScaleFactor, maxFontSize)}px Arial`,
            fill: "#ffffff",
            backgroundColor: "#333333",
            padding: { x: 10, y: 5 },
        }).setOrigin(0.5).setInteractive().setVisible(false);

        // Prepare background music
        this.backgroundMusic = this.sound.add("mainMenuMusic", { loop: true, volume: 0.5 });

        // Unlock AudioContext with a silent sound
        const silentSound = this.sound.add("silentSound", { volume: 0 });
        silentSound.play();
        silentSound.once("complete", () => {
            silentSound.destroy(); // Clean up the silent sound
            if (this.backgroundMusic && !this.backgroundMusic.isPlaying) {
                this.backgroundMusic.play();
            }
        });

        // Add the logo to the scene
        const logo = this.add.image(gameWidth / 2, gameHeight * 0.3, "logo")
            .setOrigin(0.5)
            .setScale(1 / 3); // Reduce the size of the logo by dividing its scale by 3

        // Create a waving effect using a tween
        this.tweens.add({
            targets: logo,
            y: gameHeight * 0.3 + 10, // Move 10 pixels up and down
            duration: 1000, // Duration of one wave (in milliseconds)
            ease: "Sine.easeInOut", // Smooth easing
            yoyo: true, // Reverse the tween
            repeat: -1, // Repeat indefinitely
        });

        // Show connection UI on click anywhere
        fullScreenZone.on("pointerdown", () => {
            // Animate "Appuyez pour Démarrer" text
            this.tweens.add({
                targets: startText,
                scale: 1.2, // Slightly enlarge the text
                alpha: 0, // Fade out the text
                duration: 500, // Animation duration in milliseconds
                ease: "Power2", // Smooth easing
                onComplete: () => {
                    startText.setVisible(false); // Hide "Appuyez pour Démarrer" after animation
                    fullScreenZone.disableInteractive(); // Disable further clicks

                    // Animate the appearance of the hidden fields
                    [titleText, pseudoInput, errorText, submitButton].forEach((element, index) => {
                        this.tweens.add({
                            targets: element,
                            alpha: { from: 0, to: 1 }, // Fade in
                            y: `+=20`, // Slide down slightly
                            duration: 500,
                            delay: index * 100, // Stagger animations
                            ease: "Power2",
                            onStart: () => element.setVisible(true), // Make the element visible
                        });
                    });
                },
            });
        });

        submitButton.on("pointerdown", async () => {
            // Start background music on user gesture
            if (this.backgroundMusic && !this.backgroundMusic.isPlaying) {
                this.backgroundMusic.play();
            }

            const inputElement = pseudoInput.node; // Access the DOM node
            this.pseudo = inputElement ? inputElement.value.trim() : "";

            if (this.pseudo) {
                try {
                    const response = await fetch(`${process.env.REACT_APP_API_URL}/api/players/${this.pseudo}`);
                    if (response.ok) {
                        const appearance = `/public/assets/apparences/${this.pseudo}.png`;
                        this.registry.set("playerPseudo", this.pseudo);
                        this.registry.set("playerAppearance", appearance);

                        // Initialize WebSocket connection
                        this.socket = io(process.env.REACT_APP_SOCKET_URL);
                        this.registry.set("socket", this.socket);

                        // Show chat and input elements when transitioning to GameScene
                        if (chatElement) chatElement.style.display = "block";
                        if (inputElement) inputElement.style.display = "block";

                        // Stop background music before transitioning to GameScene
                        if (this.backgroundMusic) {
                            this.backgroundMusic.stop();
                        }

                        // Add fade-out effect before transitioning to GameScene
                        this.cameras.main.fadeOut(1000, 0, 0, 0); // 1-second fade to black
                        this.cameras.main.once("camerafadeoutcomplete", () => {
                            this.scene.start("GameScene"); // Transition to GameScene
                        });

                        errorText.setText(""); // Clear error text
                        errorText.setBackgroundColor(null); // Hide background
                    } else {
                        this.pseudoError = "Cette personne n'est pas en vacances\nou alors tu sais pas écrire ton prénom";
                    }
                } catch (error) {
                    console.error("Error validating pseudo:", error);
                    this.pseudoError = "C'est full bugué dsl";
                }
            } else {
                this.pseudoError = "Ecrit un truc batard";
            }

            errorText.setText(this.pseudoError); // Update error message
            errorText.setBackgroundColor(this.pseudoError ? "#ffffff" : null); // Show or hide background
        });
    }
}
