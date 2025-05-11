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
        const titleText = this.add.text(gameWidth / 2, gameHeight * 0.77, "Ton prénom", {
            font: `${gameWidth * 0.06}px Arial`,
            fill: "#ffffff",
        }).setOrigin(0.5).setVisible(false);

        const pseudoInput = this.add.dom(gameWidth / 2, gameHeight * 0.8, "input", {
            type: "text",
            placeholder: "Ton prénom",
            value: "Mehdi", // Set default value
            style: `
                width: 300px; /* Increase width */
                height: 60px; /* Increase height */
                padding: 15px; /* Adjust padding */
                font-size: 24px; /* Increase font size */
                border: 2px solid #ccc; /* Adjust border size */
                border-radius: 10px; /* Adjust border radius */
                text-align: center;
                background-color: #ffffff;
                color: #000000;
            `,
        }).setOrigin(0.5).setScrollFactor(0).setVisible(false);

        const errorText = this.add.text(gameWidth / 2, gameHeight * 0.68, "", {
            font: `${gameWidth * 0.05}px Arial`,
            fill: "#ff0000",
            padding: { x: 10, y: 5 },
        }).setOrigin(0.5).setBackgroundColor(null).setVisible(false);

        const submitButton = this.add.text(gameWidth / 2, gameHeight * 0.9, "Connexion", {
            font: `${gameWidth * 0.08}px Arial`,
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
                    titleText.setVisible(true); // Show connection UI
                    pseudoInput.setVisible(true);
                    errorText.setVisible(true);
                    submitButton.setVisible(true);
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

                        this.scene.start("GameScene"); // Transition to GameScene
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
