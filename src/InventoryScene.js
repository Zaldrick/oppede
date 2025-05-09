import Phaser from "phaser";

export class InventoryScene extends Phaser.Scene {
    constructor() {
        super("InventoryScene");
    }

    init(data) {
        this.inventory = data.inventory || []; // Retrieve inventory data passed from GameScene
        this.selectedItem = null; // Track the currently selected item
    }

    preload() {
        // Preload all item images to ensure they display correctly
        this.inventory.forEach(item => {
            const iconPath = `/assets/items/${item.image}`;
            if (!this.textures.exists(iconPath)) {
                this.load.image(iconPath, iconPath);
            }
        });
        this.load.start();
    }

    create() {
        const gameWidth = this.scale.width;
        const gameHeight = this.scale.height;

        // Background
        this.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth * 0.9, gameHeight * 0.8, 0x000000, 0.8);

        // Title
        this.add.text(gameWidth / 2, gameHeight * 0.15, "Inventaire", {
            font: `${gameWidth * 0.1}px Arial`,
            fill: "#ffffff",
        }).setOrigin(0.5);

        // Grid settings
        const gridCols = 4; // Number of columns
        const gridRows = 4; // Number of rows
        const cellSize = gameWidth * 0.17; // Size of each cell
        const gridWidth = gridCols * cellSize;
        const gridHeight = gridRows * cellSize;
        const startX = (gameWidth - gridWidth) / 2 + cellSize / 2; // Center the grid horizontally
        const startY = gameHeight * 0.22; // Adjusted starting Y position

        // Create a container for item details
        const detailsContainer = this.add.container(gameWidth / 2, gameHeight * 0.75);

        // Create a placeholder for the large item image
        const largeItemImage = this.add.image(gameWidth / 2, gameHeight * 0.57, null)
            .setOrigin(0.5)
            .setDisplaySize(gameWidth * 0.18, gameWidth * 0.18)
            .setVisible(false); // Initially hidden

        // Populate the grid with inventory items
        for (let row = 0; row < gridRows; row++) {
            for (let col = 0; col < gridCols; col++) {
                const x = startX + col * cellSize;
                const y = startY + row * cellSize;

                // Add a background for each cell
                const cellBackground = this.add.rectangle(x, y, cellSize * 0.9, cellSize * 0.9, 0x333333, 0.8)
                    .setOrigin(0.5);

                // Calculate the index of the item in the inventory
                const index = row * gridCols + col;
                const item = this.inventory[index];

                if (item) {
                    const iconPath = `/assets/items/${item.image}`;
                    const icon = this.add.image(x, y, iconPath)
                        .setOrigin(0.5)
                        .setDisplaySize(cellSize * 0.8, cellSize * 0.8);

                    // Add click event to display item details and highlight selection
                    icon.setInteractive().on("pointerdown", () => {
                        detailsContainer.removeAll(true); // Clear previous details
                        this.selectedItem = item; // Update the selected item

                        // Highlight the selected cell
                        this.highlightSelectedCell(cellBackground);

                        // Display the large item image
                        largeItemImage.setTexture(iconPath).setVisible(true);

                        // Display item details
                        const detailText = this.add.text(
                            0,
                            -gameHeight * 0.05,
                            `Nom: ${item.nom}\nQuantité: ${item.quantité}\nPrix: ${item.prix}`,
                            {
                                font: `${gameWidth * 0.04}px Arial`,
                                fill: "#ffffff",
                                align: "center",
                            }
                        ).setOrigin(0.5);
                        detailsContainer.add(detailText);

                        // Add an interactive button for "Echanger avec ..."
                        const exchangeButton = this.add.rectangle(
                            0,
                            gameHeight * 0.03,
                            gameWidth * 0.4,
                            gameHeight * 0.04,
                            0x666666,
                            0.8
                        ).setOrigin(0.5).setInteractive();

                        const exchangeText = this.add.text(
                            0,
                            gameHeight * 0.03,
                            "Echanger avec ...",
                            {
                                font: `${gameWidth * 0.04}px Arial`,
                                fill: "#ffffff",
                                align: "center",
                            }
                        ).setOrigin(0.5);

                        exchangeButton.on("pointerdown", () => {
                            if (item.is_echangeable) {
                                this.displayMessage(`Vous avez choisi d'échanger l'objet : ${item.nom}`);
                                // Add logic here to handle the exchange
                            } else {
                                this.displayMessage("Cet objet ne peut pas être échangé.");
                            }
                        });

                        detailsContainer.add(exchangeButton);
                        detailsContainer.add(exchangeText);
                    });

                    // Quantity text
                    this.add.text(x + cellSize * 0.3, y + cellSize * 0.3, item.quantité || 1, {
                        font: `${gameWidth * 0.03}px Arial`,
                        fill: "#ffffff",
                    }).setOrigin(0.5);
                }
            }
        }

        // Return button
        const returnButton = this.add.text(gameWidth / 2, gameHeight * 0.85, "Retour", {
            font: `${gameWidth * 0.07}px Arial`,
            fill: "#ffffff",
            backgroundColor: "#333333",
            padding: { x: 10, y: 5 },
        }).setOrigin(0.5).setInteractive();

        returnButton.on("pointerdown", () => {
            this.scene.stop(); // Stop InventoryScene
            this.scene.resume("GameScene"); // Resume GameScene
        });
    }

    highlightSelectedCell(cellBackground) {
        // Reset all cell backgrounds to default color
        this.children.list.forEach(child => {
            if (child instanceof Phaser.GameObjects.Rectangle && child.fillColor === 0xff0000) {
                child.setFillStyle(0x333333, 0.8);
            }
        });

        // Highlight the selected cell
        cellBackground.setFillStyle(0xff0000, 0.8);
    }

    displayMessage(text) {
        const gameWidth = this.scale.width;
        const gameHeight = this.scale.height;

        const style = {
            font: `${gameWidth * 0.04}px Arial`,
            fill: "#ffffff",
            backgroundColor: "#000000",
            padding: { x: 10, y: 5 },
            align: "center",
        };

        const messageText = this.add.text(gameWidth / 2, gameHeight * 0.05, text, style)
            .setOrigin(0.5)
            .setScrollFactor(0);

        this.time.delayedCall(3000, () => {
            messageText.destroy();
        });
    }
}
