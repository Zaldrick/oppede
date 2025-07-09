import Phaser from "phaser";
import ConfigManager from "./managers/ConfigManager.js";

export class InventoryScene extends Phaser.Scene {
    constructor() {
        super("InventoryScene");
    }

    init(data) {
        this.inventory = data.inventory || [];
        this.playerId = data.playerId; 
        this.selectedItem = null;
        
        // Récupère la configuration pour cette scène
        this.config = ConfigManager.getSceneConfig('Inventory', this.scale.width, this.scale.height);
    }

    preload() {
        this.load.audio("poubelle", ConfigManager.ASSETS.PATHS.SOUNDS + "poubelle.mp3");
    }

    async create() {
        await this.reloadInventory();
        await this.ensureInventoryImagesLoaded();
        this.drawInventory();
    }

    drawInventory() {
        // Efface tout
        this.children.removeAll();

        const { width, height } = this.config;

        // Background avec tailles du ConfigManager
        this.add.rectangle(
            width / 2, 
            height / 2, 
            width * ConfigManager.LAYOUT.SCREEN.INVENTORY_WIDTH_RATIO, 
            height * ConfigManager.LAYOUT.SCREEN.INVENTORY_HEIGHT_RATIO, 
            ConfigManager.UI.COLORS.BACKGROUND, 
            ConfigManager.UI.COLORS.BACKGROUND_ALPHA
        );

        // Title avec style du ConfigManager
        const titleStyle = ConfigManager.getTextStyle('title', width);
        this.add.text(width / 2, height * 0.13, "Inventaire", titleStyle).setOrigin(0.5);

        // Grid settings depuis ConfigManager
        const { cellSize, gridCols, gridRows } = this.config;
        const gridWidth = gridCols * cellSize;
        const gridHeight = gridRows * cellSize;
        const startX = ConfigManager.getCenteredGridPosition(width, gridCols, cellSize);
        const startY = height * 0.22;

        // Container for item details
        const detailsContainer = this.add.container(width / 2, height * 0.75);

        // Placeholder for large item image - utilise les vraies positions !
        const fixedLargeImageWidth = width * ConfigManager.LAYOUT.IMAGES.LARGE_IMAGE_RATIO;
        const largeItemImage = this.add.image(width * 0.32, height * 0.64, null)
            .setOrigin(0.5)
            .setVisible(false);

        const filteredInventory = this.inventory.filter(item => item.type !== "card");

        // Populate grid
        for (let row = 0; row < gridRows; row++) {
            for (let col = 0; col < gridCols; col++) {
                const x = startX + col * cellSize;
                const y = startY + row * cellSize;
                
                // Cell background avec tailles du ConfigManager
                const cellBackground = this.add.rectangle(
                    x, y, 
                    cellSize * ConfigManager.LAYOUT.GRID.CELL_CONTENT_LARGE_RATIO, 
                    cellSize * ConfigManager.LAYOUT.GRID.CELL_CONTENT_LARGE_RATIO, 
                    0x333333, 
                    ConfigManager.UI.COLORS.BACKGROUND_ALPHA
                ).setOrigin(0.5);

                const index = row * gridCols + col;
                const item = filteredInventory[index];

                if (item) {
                    const iconKey = `item_${item.image}`;
                    const icon = this.add.image(x, y, iconKey)
                        .setOrigin(0.5)
                        .setDisplaySize(
                            cellSize * ConfigManager.LAYOUT.GRID.CELL_CONTENT_RATIO, 
                            cellSize * ConfigManager.LAYOUT.GRID.CELL_CONTENT_RATIO
                        );

                    icon.setInteractive().on("pointerdown", () => {
                        this.handleItemSelection(item, cellBackground, detailsContainer, largeItemImage, fixedLargeImageWidth);
                    });

                    const quantityStyle = ConfigManager.getTextStyle('message', width, {
                        stroke: "#000000",
                        strokeThickness: 3,
                    });
                    this.add.text(
                        x + cellSize * ConfigManager.LAYOUT.GRID.QUANTITY_OFFSET, 
                        y + cellSize * ConfigManager.LAYOUT.GRID.QUANTITY_OFFSET, 
                        item.quantite || 1, 
                        quantityStyle
                    ).setOrigin(0.5);
                }
            }
        }

        // Return button avec style du ConfigManager
        const buttonStyle = ConfigManager.getTextStyle('button', width);
        const returnButton = this.add.text(
            width / 2, 
            height * ConfigManager.UI.INVENTORY.RETURN_POSITION.y, 
            "Retour", 
            buttonStyle
        ).setOrigin(0.5).setInteractive();

        returnButton.on("pointerdown", () => {
            this.scene.stop();
            this.scene.resume("GameScene");
        });
    }

    handleItemSelection(item, cellBackground, detailsContainer, largeItemImage, fixedLargeImageWidth) {
        detailsContainer.removeAll(true);
        this.selectedItem = item;
        this.highlightSelectedCell(cellBackground);

        // Large image
        const iconKey = `item_${item.image}`;
        largeItemImage.setTexture(iconKey).setVisible(true);
        const tex = this.textures.get(iconKey).getSourceImage();
        if (tex) {
            const ratio = tex.height / tex.width;
            largeItemImage.setDisplaySize(fixedLargeImageWidth, fixedLargeImageWidth * ratio);
        }

        const { width, height } = this.config;
        const detailText = this.add.text(
            +width * 0.16,    
            -height * 0.1,    
            `Nom: ${item.nom}\nQuantité: ${item.quantite || 1}\nPrix: ${item.prix}`,
            {
                font: `${width * 0.04}px Arial`,
                fill: "#ffffff",
                align: "left",
            }
        ).setOrigin(0.5);
        detailsContainer.add(detailText);

        // Action buttons avec positions du ConfigManager
        this.createActionButtons(item, detailsContainer, width, height);
    }

    createActionButtons(item, detailsContainer, width, height) {
        const buttonStyle = {
            font: `${width * 0.04}px Arial`,
            fill: "#ffffff",
            align: "center",
        };
        
        if (item.actions && item.actions.length > 0) {
            this.createUseButton(item, detailsContainer, width, height, buttonStyle);
        } else if (item.type === "booster") {
            this.createBoosterButton(item, detailsContainer, width, height, buttonStyle);
        } else if (item.utiliser && item.utiliser.scene) {
            this.createUtiliserButton(item, detailsContainer, width, height, buttonStyle);
        } else {
            this.displayMessage("Aucune action disponible pour cet objet.");
        }

        // Bouton Jeter avec vraies positions relatives de l'original !
        this.createThrowButton(item, detailsContainer, width, height, buttonStyle);
    }

    createUseButton(item, detailsContainer, width, height, buttonStyle) {
        const action = item.actions[0];
        const useButton = this.add.rectangle(
            -width * 0.22,   
            height * 0.03,   
            width * 0.3,
            height * 0.04,
            0x666666,
            0.8
        ).setOrigin(0.5).setInteractive();

        const useText = this.add.text(
            -width * 0.22,
            height * 0.03,
            action.action_name,
            buttonStyle
        ).setOrigin(0.5);

        useButton.on("pointerdown", () => {
            this.executeAction(action);
        });

        detailsContainer.add(useButton);
        detailsContainer.add(useText);
    }

    createBoosterButton(item, detailsContainer, width, height, buttonStyle) {
        const openButton = this.add.rectangle(
            -width * 0.22,   
            height * 0.03,   
            width * 0.3,
            height * 0.04,
            0x229922,        
            0.8
        ).setOrigin(0.5).setInteractive();

        const openText = this.add.text(
            -width * 0.22,
            height * 0.03,
            "Ouvrir",
            buttonStyle
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
                    this.scene.pause();
                    this.scene.launch("BoosterOpeningScene", { booster: item });
                }
            } catch (err) {
                this.displayMessage("Erreur ouverture booster : " + err.message);
            }
        });

        detailsContainer.add(openButton);
        detailsContainer.add(openText);
    }

    createUtiliserButton(item, detailsContainer, width, height, buttonStyle) {
        const useButton = this.add.rectangle(
            -width * 0.22,   
            height * 0.03,   
            width * 0.3,
            height * 0.04,
            0x229922,        
            0.8
        ).setOrigin(0.5).setInteractive();

        const useText = this.add.text(
            -width * 0.22,
            height * 0.03,
            "Utiliser",
            buttonStyle
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
    }

    createThrowButton(item, detailsContainer, width, height, buttonStyle) {
        const jeterButton = this.add.rectangle(
            +width * 0.22,   
            height * 0.03,   
            width * 0.3,
            height * 0.04,
            0x666666,        
            0.8
        ).setOrigin(0.5).setInteractive();

        const jeterText = this.add.text(
            +width * 0.22,
            height * 0.03,
            "Jeter",
            buttonStyle
        ).setOrigin(0.5);

        jeterButton.on("pointerdown", () => {
            this.removeItemFromInventory(item);
        });
        
        detailsContainer.add(jeterButton);
        detailsContainer.add(jeterText);
    }

    // === MÉTHODES UTILITAIRES ===
    
    highlightSelectedCell(cellBackground) {
        this.children.list.forEach(child => {
            if (child instanceof Phaser.GameObjects.Rectangle && child.fillColor === 0xff0000) {
                child.setFillStyle(0x333333, 0.8);
            }
        });

        cellBackground.setFillStyle(0xff0000, 0.8);
    }

    displayMessage(text) {
        const { width, height } = this.config;
        
        const style = {
            font: `${width * 0.04}px Arial`,
            fill: "#ffffff",
            backgroundColor: "#000000",
            padding: { x: 10, y: 5 },
            align: "center",
        };

        const messageText = this.add.text(width / 2, height * 0.05, text, style)
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

    applyHeal(amount) {
        this.displayMessage(`Vous avez récupéré ${amount} points de vie.`);
    }
    
    equipItem(slot) {
        this.displayMessage(`Vous avez équipé ${this.selectedItem.nom}.`);
    }
    
    unlockDoor(doorId) {
        this.displayMessage(`Vous avez déverrouillé la porte ${doorId}.`);
    }

    // === MÉTHODES ASYNC (CHARGEMENT ET RÉSEAU) ===

    async ensureInventoryImagesLoaded() {
        if (this._loadingImages) {
            await this._loadingImages;
            return;
        }
        let needsLoading = false;
        this.inventory.forEach(item => {
            if (!item.image) return;
            const iconKey = `item_${item.image}`;
            const iconPath = ConfigManager.ASSETS.PATHS.ITEMS + item.image;
            if (!this.textures.exists(iconKey)) {
                this.load.image(iconKey, iconPath);
                needsLoading = true;
            }
        });
        if (needsLoading) {
            this._loadingImages = new Promise(resolve => this.load.once('complete', resolve));
            this.load.start();
            await this._loadingImages;
            this._loadingImages = null;
        }
    }

    async reloadInventory() {
        try {
            const playerId = this.playerId || window.playerId;
            if (!playerId) {
                this.displayMessage("Impossible de recharger l'inventaire : joueur inconnu.");
                return;
            }
            const res = await fetch(`${ConfigManager.NETWORK.API.BASE_URL}${ConfigManager.NETWORK.ENDPOINTS.INVENTORY}/${playerId}`);
            const data = await res.json();
            this.inventory = data.inventory || data || [];
        } catch (err) {
            this.displayMessage("Erreur lors du rechargement de l'inventaire !");
            console.error(err);
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

        cards.forEach(card => {
            const existing = this.inventory.find(c => c._id === card._id);
            if (existing) {
                console.log("Carte déjà présente localement:", card._id);
            } else {
                this.inventory.push({ ...card, quantite: 1 }); 
                console.log("Carte ajoutée localement:", card._id);
            }
        });

        try {
            const res = await fetch(`${ConfigManager.NETWORK.API.BASE_URL}${ConfigManager.NETWORK.ENDPOINTS.INVENTORY}/add-cards`, {
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
        const itemId = item.item_id || item._id;
        if (!playerId || !itemId) {
            this.displayMessage("Impossible de jeter cet objet.");
            return;
        }

        console.log("Suppression d'item - playerId:", playerId, "itemId:", itemId, "item:", item);

        if (this.sound) this.sound.play("poubelle");

        const idx = this.inventory.findIndex(c => (c.item_id || c._id) === itemId);
        if (idx !== -1) {
            if (this.inventory[idx].quantite > 1) {
                this.inventory[idx].quantite -= 1;
            } else {
                this.inventory.splice(idx, 1);
            }
        }

        try {
            const res = await fetch(`${ConfigManager.NETWORK.API.BASE_URL}${ConfigManager.NETWORK.ENDPOINTS.INVENTORY}/remove-item`, {
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
}