import Phaser from "phaser";
import { openBooster } from "./openBooster"; // Assure-toi que le chemin est correct

export class InventoryScene extends Phaser.Scene {
    constructor() {
        super("InventoryScene");
    }

    init(data) {
        this.inventory = data.inventory || []; // Retrieve inventory data passed from GameScene
        this.playerId = data.playerId; 
        this.selectedItem = null; // Track the currently selected item
    }

    preload() {
        this.load.audio("poubelle", "/assets/sounds/poubelle.mp3");
    }

    async create() {
        await this.reloadInventory();
        await this.ensureInventoryImagesLoaded();
        this.drawInventory();
    }

drawInventory() {
    // Efface tout sauf le background et le titre si besoin
    this.children.removeAll();

    const gameWidth = this.scale.width;
    const gameHeight = this.scale.height;

    // Background
    this.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth * 0.9, gameHeight * 0.85, 0x000000, 0.8);

    // Title
    this.add.text(gameWidth / 2, gameHeight * 0.13, "Inventaire", {
        font: `${gameWidth * 0.1}px Arial`,
        fill: "#ffffff",
    }).setOrigin(0.5);

    // Grid settings
    const gridCols = 4;
    const gridRows = 4;
    const cellSize = gameWidth * 0.165;
    const gridWidth = gridCols * cellSize;
    const gridHeight = gridRows * cellSize;
    const startX = (gameWidth - gridWidth) / 2 + cellSize / 2;
    const startY = gameHeight * 0.22;

    // Container for item details
    const detailsContainer = this.add.container(gameWidth / 2, gameHeight * 0.75);

    // Placeholder for large item image
    const fixedLargeImageWidth = gameWidth * 0.28;
    const largeItemImage = this.add.image(gameWidth * 0.32, gameHeight * 0.64, null)
        .setOrigin(0.5)
        .setVisible(false);

    // Populate grid
    for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
            const x = startX + col * cellSize;
            const y = startY + row * cellSize;
            const cellBackground = this.add.rectangle(x, y, cellSize * 0.9, cellSize * 0.9, 0x333333, 0.8)
                .setOrigin(0.5);

            const index = row * gridCols + col;
            const item = this.inventory[index];

            if (item) {
                const iconKey = `item_${item.image}`;
                const icon = this.add.image(x, y, iconKey)
                    .setOrigin(0.5)
                    .setDisplaySize(cellSize * 0.8, cellSize * 0.8);

                icon.setInteractive().on("pointerdown", () => {
                    detailsContainer.removeAll(true);
                    this.selectedItem = item;
                    this.highlightSelectedCell(cellBackground);

                    // Large image
                    largeItemImage.setTexture(iconKey).setVisible(true);
                    const tex = this.textures.get(iconKey).getSourceImage();
                    if (tex) {
                        const ratio = tex.height / tex.width;
                        largeItemImage.setDisplaySize(fixedLargeImageWidth, fixedLargeImageWidth * ratio);
                    }

                    // Details
                    const detailText = this.add.text(
                        +gameWidth * 0.16,
                        -gameHeight * 0.1,
                        `Nom: ${item.nom}\nQuantité: ${item.quantité}\nPrix: ${item.prix}`,
                        {
                            font: `${gameWidth * 0.04}px Arial`,
                            fill: "#ffffff",
                            align: "left",
                        }
                    ).setOrigin(0.5);
                    detailsContainer.add(detailText);

                    // Action button(s)
                    if (item.actions && item.actions.length > 0) {
                        const action = item.actions[0];
                        const useButton = this.add.rectangle(
                            -gameWidth * 0.22,
                            gameHeight * 0.03,
                            gameWidth * 0.3,
                            gameHeight * 0.04,
                            0x666666,
                            0.8
                        ).setOrigin(0.5).setInteractive();

                        const useText = this.add.text(
                            -gameWidth * 0.22,
                            gameHeight * 0.03,
                            action.action_name,
                            {
                                font: `${gameWidth * 0.04}px Arial`,
                                fill: "#ffffff",
                                align: "center",
                            }
                        ).setOrigin(0.5);

                        useButton.on("pointerdown", () => {
                            this.executeAction(action);
                        });

                        detailsContainer.add(useButton);
                        detailsContainer.add(useText);
                    } else if (item.type === "booster") {
                        const openButton = this.add.rectangle(
                            -gameWidth * 0.22,
                            gameHeight * 0.03,
                            gameWidth * 0.3,
                            gameHeight * 0.04,
                            0x229922,
                            0.8
                        ).setOrigin(0.5).setInteractive();

                        const openText = this.add.text(
                            -gameWidth * 0.22,
                            gameHeight * 0.03,
                            "Ouvrir",
                            {
                                font: `${gameWidth * 0.04}px Arial`,
                                fill: "#ffffff",
                                align: "center",
                            }
                        ).setOrigin(0.5);

                        openButton.on("pointerdown", async () => {
                            try {
                                let action = null;
                                if (item.actions && item.actions.length > 0) {
                                    action = item.actions.find(a => a.action_type === "open_scene");
                                }
                                if (!action && item.type === "booster" && this.actions) {
                                    action = this.actions.find(a =>
                                        (!a.item_id || a.item_id === null) &&
                                        a.action_type === "open_scene"
                                    );
                                }
                                if (!action && this.actions) {
                                    action = this.actions.find(a =>
                                        a.item_id && item._id &&
                                        a.item_id.toString() === item._id.toString() &&
                                        a.action_type === "open_scene"
                                    );
                                }
                                if (action && action.action_type === "open_scene") {
                                    this.scene.pause();
                                    this.scene.launch(
                                        action.parameters.scene,
                                        { booster: item }
                                    );
                                } else {
                                    this.displayMessage("Action inconnue.");
                                }
                            } catch (err) {
                                this.displayMessage("Erreur ouverture booster : " + err.message);
                            }
                        });

                        detailsContainer.add(openButton);
                        detailsContainer.add(openText);
                    } else if (item.utiliser && item.utiliser.scene) {
                        const useButton = this.add.rectangle(
                            -gameWidth * 0.22,
                            gameHeight * 0.03,
                            gameWidth * 0.3,
                            gameHeight * 0.04,
                            0x229922,
                            0.8
                        ).setOrigin(0.5).setInteractive();

                        const useText = this.add.text(
                            -gameWidth * 0.22,
                            gameHeight * 0.03,
                            "Utiliser",
                            {
                                font: `${gameWidth * 0.04}px Arial`,
                                fill: "#ffffff",
                                align: "center",
                            }
                        ).setOrigin(0.5);

                        useButton.on("pointerdown", async () => {
                            try {
                                this.scene.pause();
                                this.scene.launch(item.utiliser.scene, { [item.type]: item });
                            } catch (err) {
                                this.displayMessage("Erreur lors de l'utilisation : " + err.message);
                            }
                        });

                        detailsContainer.add(useButton);
                        detailsContainer.add(useText);
                    } else {
                        this.displayMessage("Aucune action disponible pour cet objet.");
                    }

                    // Jeter button
                    const jeterButton = this.add.rectangle(
                        +gameWidth * 0.22,
                        gameHeight * 0.03,
                        gameWidth * 0.3,
                        gameHeight * 0.04,
                        0x666666,
                        0.8
                    ).setOrigin(0.5).setInteractive();

                    const jeterText = this.add.text(
                        +gameWidth * 0.22,
                        gameHeight * 0.03,
                        "Jeter",
                        {
                            font: `${gameWidth * 0.04}px Arial`,
                            fill: "#ffffff",
                            align: "center",
                        }
                    ).setOrigin(0.5);

                    jeterButton.on("pointerdown", () => {
                        this.removeItemFromInventory(item);
                    });
                    detailsContainer.add(jeterButton);
                    detailsContainer.add(jeterText);
                });

                // Quantity text
                this.add.text(x + cellSize * 0.3, y + cellSize * 0.3, item.quantité || 1, {
                    font: `${gameWidth * 0.04}px Arial`,
                    fill: "#ffffff",
                }).setOrigin(0.5);
            }
        }
    }

    // Return button
    const returnButton = this.add.text(gameWidth / 2, gameHeight * 0.88, "Retour", {
        font: `${gameWidth * 0.07}px Arial`,
        fill: "#ffffff",
        backgroundColor: "#333333",
        padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setInteractive();

    returnButton.on("pointerdown", () => {
        this.scene.stop();
        this.scene.resume("GameScene");
    });
}

async ensureInventoryImagesLoaded() {
    // Empêche le double chargement
    if (this._loadingImages) {
        // Attend la fin du chargement en cours
        await this._loadingImages;
        return;
    }
    let needsLoading = false;
    this.inventory.forEach(item => {
        if (!item.image) return;
        const iconKey = `item_${item.image}`;
        const iconPath = `/assets/items/${item.image}`;
        if (!this.textures.exists(iconKey)) {
            this.load.image(iconKey, iconPath);
            needsLoading = true;
        }
    });
    if (needsLoading) {
        // Stocke la promesse pour empêcher un double start
        this._loadingImages = new Promise(resolve => this.load.once('complete', resolve));
        this.load.start();
        await this._loadingImages;
        this._loadingImages = null;
    }
}

async reloadInventory() {
    try {
        const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:5000";
        const playerId = this.playerId || window.playerId;
        if (!playerId) {
            this.displayMessage("Impossible de recharger l'inventaire : joueur inconnu.");
            return;
        }
        const res = await fetch(`${apiUrl}/api/inventory/${playerId}`);
        const data = await res.json();
        this.inventory = data.inventory || data || [];
    } catch (err) {
        this.displayMessage("Erreur lors du rechargement de l'inventaire !");
        console.error(err);
    }
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

    executeAction(action) {
        switch (action.action_type) {
            case "heal":
                this.applyHeal(action.parameters.amount);
                break;
            case "equip":
                this.equipItem(action.parameters.slot);
                break;
            case "unlock":
                this.unlockDoor(action.parameters.door_id);
                break;
            case "read":
                this.displayMessage(action.parameters.lore);
                break;
            case "pet":
                this.displayMessage(action.parameters.lore);
                break;
            case "open_scene":
                // Ajoute ce cas pour gérer l'ouverture de booster ou autre scène spéciale
                this.scene.pause();
                this.scene.launch(
                    action.parameters.scene,
                    { booster: this.selectedItem }
                );
            break;
            default:
                this.displayMessage("Action inconnue.");
        }
    }

async addCardsToInventory(cards) {
    if (!Array.isArray(cards) || !cards.length) return;
    const playerId = this.playerId || (this.data && this.data.playerId) || window.playerId;
    console.log("addCardsToInventory - playerId:", playerId, "cards:", cards);
    if (!playerId) {
        this.displayMessage("Impossible d'ajouter les cartes : joueur inconnu.");
        return;
    }

    // Ajout local
    cards.forEach(card => {
        const existing = this.inventory.find(c => c._id === card._id);
        if (existing) {
            // existing.quantité = (existing.quantité || 1) + 1;
            console.log("Carte déjà présente localement:", card._id);
        } else {
            this.inventory.push({ ...card, quantité: 1 });
            console.log("Carte ajoutée localement:", card._id);
        }
    });

    // Ajout en BDD
    try {
        const res = await fetch(`${process.env.REACT_APP_API_URL}/api/inventory/add-cards`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId, cards })
        });
        const result = await res.json();
        console.log("Résultat serveur:", result);
        if (!res.ok) throw new Error("Erreur serveur");
        this.displayMessage("Cartes ajoutées à l'inventaire !");
        await this.reloadInventory();
    } catch (err) {
        this.displayMessage("Erreur lors de la sauvegarde des cartes !");
        console.error(err);
    }
}

async removeItemFromInventory(item) {
    const playerId = this.playerId || (this.data && this.data.playerId) || window.playerId;
    // Utilise item.item_id pour la suppression (et fallback sur _id si jamais)
    const itemId = item.item_id || item._id;
    if (!playerId || !itemId) {
        this.displayMessage("Impossible de jeter cet objet.");
        return;
    }

    // Log pour debug
    console.log("Suppression d'item - playerId:", playerId, "itemId:", itemId, "item:", item);

    // Joue le son de poubelle
    if (this.sound) this.sound.play("poubelle");

    // Mise à jour locale de la quantité
    const idx = this.inventory.findIndex(c => (c.item_id || c._id) === itemId);
    if (idx !== -1) {
        if (this.inventory[idx].quantité > 1) {
            this.inventory[idx].quantité -= 1;
        } else {
            this.inventory.splice(idx, 1);
        }
    }

    // Mise à jour en BDD (décrémente ou supprime)
    try {
        const res = await fetch(`${process.env.REACT_APP_API_URL}/api/inventory/remove-item`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId, itemId })
        });
        const result = await res.json();
        if (!res.ok || !result.success) throw new Error("Erreur serveur");
        this.displayMessage("Objet jeté !");
        await this.reloadInventory();
        await this.ensureInventoryImagesLoaded();
        this.drawInventory();
    } catch (err) {
        this.displayMessage("Erreur lors de la suppression !");
        console.error(err);
    }
}

    applyHeal(amount) {
        // Exemple : Ajouter des points de vie au joueur
        //this.player.health = Math.min(this.player.maxHealth, this.player.health + amount);
        this.displayMessage(`Vous avez récupéré ${amount} points de vie.`);
    }
    
    equipItem(slot) {
        // Exemple : Équiper un objet dans un slot spécifique
        //this.player.equip(slot, this.selectedItem);
        this.displayMessage(`Vous avez équipé ${this.selectedItem.nom}.`);
    }
    
    unlockDoor(doorId) {
        // Exemple : Déverrouiller une porte
        this.displayMessage(`Vous avez déverrouillé la porte ${doorId}.`);
    }

}