import Phaser from "phaser";
import ConfigManager from "./managers/ConfigManager.js";

export class InventoryScene extends Phaser.Scene {
    constructor() {
        super("InventoryScene");
    }

    init(data) {
        // ✅ CORRECTION : S'assurer que l'inventaire est toujours un tableau
        this.inventory = Array.isArray(data.inventory) ? data.inventory : [];
        this.playerId = data.playerId;
        this.selectedItem = null;
        this.returnScene = data.returnScene || 'GameScene'; // 🆕 Scène de retour
        this.inBattle = data.inBattle || false; // 🆕 En combat
        this.battleState = data.battleState || null; // 🆕 État du combat

        // 🆕 REFONTE: Système de catégories et pagination
        this.currentCategory = 'general';
        this.currentPage = 0;
        this.itemsPerPage = 20; // Grille 5x4
        
        // Définition des catégories
        this.categories = {
            general: { name: 'Général', icon: '📦', color: 0x8B8B8B },
            pokeballs: { name: 'Pokéballs', icon: '⚾', color: 0xE74C3C },
            healing: { name: 'Soins', icon: '💊', color: 0x2ECC71 },
            tm_hm: { name: 'CT/CS', icon: '💿', color: 0x3498DB },
            cards: { name: 'Cartes', icon: '🃏', color: 0x9B59B6 },
            key_items: { name: 'Clés', icon: '🔑', color: 0xF39C12 }
        };

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

        // ✅ NOUVEAU : Écouter les événements de mise à jour d'inventaire
        this.setupInventoryEventListeners();
    }

    // ✅ NOUVELLE MÉTHODE : Configuration des écouteurs d'événements
    setupInventoryEventListeners() {
        // Écouter les événements de l'ouverture de booster
        this.scene.get('BoosterOpeningScene')?.events.on('booster:cardsReceived', this.handleCardsReceived, this);

        // Écouter les événements globaux du Jeux
        this.game.events.on('inventory:update', this.handleInventoryUpdate, this);
        this.game.events.on('cards:added', this.handleCardsAdded, this);

        console.log('[InventoryScene] Event listeners configurés');
    }

    // ✅ NOUVELLE MÉTHODE : Gestionnaire de réception de cartes
    async handleCardsReceived(data) {
        console.log('[InventoryScene] Cartes reçues depuis booster:', data);

        if (data && data.cards && Array.isArray(data.cards)) {
            // Ajouter les cartes à l'inventaire local immédiatement
            await this.addCardsToInventory(data.cards);

            // Recharger complètement l'inventaire pour être sûr
            await this.reloadInventory();
            await this.ensureInventoryImagesLoaded();
            this.drawInventory();

            // ✅ NOUVEAU : Mettre à jour le cache global de l'inventaire
            this.updateGlobalInventoryCache();

            this.displayMessage(`${data.cards.length} cartes ajoutées à votre inventaire !`);
        }
    }

    // ✅ NOUVELLE MÉTHODE : Gestionnaire de mise à jour d'inventaire
    async handleInventoryUpdate() {
        console.log('[InventoryScene] Mise à jour d\'inventaire demandée');
        await this.reloadInventory();
        await this.ensureInventoryImagesLoaded();
        this.drawInventory();
        this.updateGlobalInventoryCache();
    }

    // ✅ NOUVELLE MÉTHODE : Gestionnaire d'ajout de cartes
    async handleCardsAdded(cards) {
        console.log('[InventoryScene] Cartes ajoutées:', cards);
        if (Array.isArray(cards)) {
            await this.addCardsToInventory(cards);
            this.updateGlobalInventoryCache();
        }
    }

    // ✅ NOUVELLE MÉTHODE : Mise à jour du cache global
    updateGlobalInventoryCache() {
        // Mettre à jour le cache de l'inventaire dans GameScene
        const gameScene = this.scene.get('GameScene');
        if (gameScene) {
            gameScene.inventory = [...this.inventory]; // Copie profonde
            console.log('[InventoryScene] Cache GameScene mis à jour:', gameScene.inventory.length, 'items');
        }

        // Mettre à jour le cache global du registre
        this.registry.set('playerInventory', [...this.inventory]);

        // Émettre un événement global pour notifier les autres scènes
        this.game.events.emit('inventory:cacheUpdated', this.inventory);

        console.log('[InventoryScene] Cache global mis à jour:', this.inventory.length, 'items');
    }

    /**
     * 🆕 REFONTE: Catégorise un item selon son type
     */
    categorizeItem(item) {
        if (!item) return 'general';
        
        const itemName = (item.nom || '').toLowerCase();
        const itemType = (item.type || '').toLowerCase();
        
        // Cartes Triple Triad
        if (itemType === 'card' || itemName.includes('carte')) {
            return 'cards';
        }
        
        // Pokéballs
        if (itemName.includes('ball') || itemName.includes('balle')) {
            return 'pokeballs';
        }
        
        // Soins
        if (itemName.includes('potion') || itemName.includes('rappel') || 
            itemName.includes('guérison') || itemName.includes('antidote') ||
            itemName.includes('soin')) {
            return 'healing';
        }
        
        // CT/CS
        if (itemName.includes('ct') || itemName.includes('cs') || 
            itemName.includes('capsule technique')) {
            return 'tm_hm';
        }
        
        // Objets clés (à définir selon tes items)
        if (itemType === 'key' || item.isKeyItem) {
            return 'key_items';
        }
        
        // Par défaut: Général
        return 'general';
    }

    /**
     * 🆕 REFONTE: Récupère les items de la catégorie courante
     */
    getFilteredItems() {
        const allItems = Array.isArray(this.inventory) ? this.inventory : [];
        
        // Filtrer par catégorie
        const categoryItems = allItems.filter(item => {
            const category = this.categorizeItem(item);
            return category === this.currentCategory;
        });
        
        return categoryItems;
    }

    /**
     * 🆕 REFONTE: Récupère les catégories disponibles (filtrage combat)
     */
    getAvailableCategories() {
        if (this.inBattle) {
            // En combat: uniquement Pokéballs et Soins
            return ['pokeballs', 'healing'];
        }
        
        // Hors combat: toutes les catégories
        return Object.keys(this.categories);
    }

    /**
     * 🆕 REFONTE: Change de catégorie
     */
    changeCategory(newCategory) {
        if (this.currentCategory === newCategory) return;
        
        this.currentCategory = newCategory;
        this.currentPage = 0; // Reset page
        this.drawInventory();
    }

    /**
     * 🆕 REFONTE: Change de page
     */
    changePage(direction) {
        const filteredItems = this.getFilteredItems();
        const totalPages = Math.ceil(filteredItems.length / this.itemsPerPage);
        
        if (direction === 'next' && this.currentPage < totalPages - 1) {
            this.currentPage++;
            this.drawInventory();
        } else if (direction === 'prev' && this.currentPage > 0) {
            this.currentPage--;
            this.drawInventory();
        }
    }

    drawInventory() {
        // Efface tout
        this.children.removeAll();

        const { width, height } = this.config;

        // Background
        this.add.rectangle(
            width / 2,
            height / 2,
            width * ConfigManager.LAYOUT.SCREEN.INVENTORY_WIDTH_RATIO,
            height * ConfigManager.LAYOUT.SCREEN.INVENTORY_HEIGHT_RATIO,
            ConfigManager.UI.COLORS.BACKGROUND,
            ConfigManager.UI.COLORS.BACKGROUND_ALPHA
        );

        // Title
        const titleStyle = ConfigManager.getTextStyle('title', width);
        this.add.text(width / 2, height * 0.08, "Inventaire", titleStyle).setOrigin(0.5);

        // 🆕 ONGLETS DE CATÉGORIES
        this.drawCategoryTabs();

        // 🆕 Récupérer les items de la catégorie courante avec pagination
        const filteredInventory = this.getFilteredItems();
        const startIndex = this.currentPage * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageItems = filteredInventory.slice(startIndex, endIndex);

        // Message si vide
        if (filteredInventory.length === 0) {
            const emptyMessageStyle = ConfigManager.getTextStyle('message', width);
            this.add.text(
                width / 2,
                height * 0.5,
                `Aucun objet dans la catégorie ${this.categories[this.currentCategory].name}`,
                emptyMessageStyle
            ).setOrigin(0.5);
        }

        // Grid settings
        const { cellSize, gridCols, gridRows } = this.config;
        const startX = ConfigManager.getCenteredGridPosition(width, gridCols, cellSize);
        const startY = height * 0.28; // Plus bas pour laisser place aux onglets

        // Container for item details
        const detailsContainer = this.add.container(width / 2, height * 0.75);

        // Placeholder for large item image
        const fixedLargeImageWidth = width * ConfigManager.LAYOUT.IMAGES.LARGE_IMAGE_RATIO;
        const largeItemImage = this.add.image(width * 0.32, height * 0.64, null)
            .setOrigin(0.5)
            .setVisible(false);

        // 🆕 PAGINATION: Flèches si nécessaire
        const totalPages = Math.ceil(filteredInventory.length / this.itemsPerPage);
        if (totalPages > 1) {
            this.drawPaginationControls(totalPages);
        }

        // Populate grid avec items de la page courante
        for (let row = 0; row < gridRows; row++) {
            for (let col = 0; col < gridCols; col++) {
                const x = startX + col * cellSize;
                const y = startY + row * cellSize;

                // Cell background
                const cellBackground = this.add.rectangle(
                    x, y,
                    cellSize * ConfigManager.LAYOUT.GRID.CELL_CONTENT_LARGE_RATIO,
                    cellSize * ConfigManager.LAYOUT.GRID.CELL_CONTENT_LARGE_RATIO,
                    0x333333,
                    ConfigManager.UI.COLORS.BACKGROUND_ALPHA
                ).setOrigin(0.5);

                const index = row * gridCols + col;
                const item = pageItems[index]; // 🆕 Items de la page courante

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
                        item.quantite || item['quantité'] || 1,
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
            // 🆕 Retour vers combat : résumer la scène
            if (this.inBattle && this.returnScene === 'PokemonBattleScene') {
                this.scene.stop();
                this.scene.resume(this.returnScene);
            }
            // Cas normal : résumer GameScene
            else {
                this.scene.stop();
                this.scene.resume(this.returnScene);
            }
        });
    }

    /**
     * 🆕 REFONTE: Dessine les onglets de catégories
     */
    drawCategoryTabs() {
        const { width, height } = this.config;
        const availableCategories = this.getAvailableCategories();
        const tabWidth = width * 0.12;
        const tabHeight = height * 0.06;
        const startX = width * 0.15;
        const tabY = height * 0.18;

        availableCategories.forEach((categoryKey, index) => {
            const category = this.categories[categoryKey];
            const tabX = startX + (index * tabWidth * 1.05);
            
            const isActive = categoryKey === this.currentCategory;
            const bgColor = isActive ? category.color : 0x444444;
            const alpha = isActive ? 1 : 0.7;

            // Background onglet
            const tabBg = this.add.rectangle(tabX, tabY, tabWidth, tabHeight, bgColor, alpha)
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });

            // Bordure active
            if (isActive) {
                const border = this.add.rectangle(tabX, tabY, tabWidth, tabHeight)
                    .setStrokeStyle(3, 0xFFFFFF)
                    .setOrigin(0.5);
            }

            // Icône uniquement (grande et visible)
            const tabText = this.add.text(tabX, tabY, category.icon, {
                fontSize: `${width * 0.045}px`,
                align: 'center'
            }).setOrigin(0.5);

            // Interaction
            tabBg.on('pointerdown', () => {
                if (!isActive) {
                    this.changeCategory(categoryKey);
                }
            });

            // Hover effect
            tabBg.on('pointerover', () => {
                if (!isActive) {
                    tabBg.setAlpha(0.9);
                }
            });

            tabBg.on('pointerout', () => {
                if (!isActive) {
                    tabBg.setAlpha(0.7);
                }
            });
        });

        // 🆕 Indicateur combat si actif
        if (this.inBattle) {
            const warningText = this.add.text(width * 0.85, height * 0.18, '⚔️ Combat', {
                fontSize: `${width * 0.025}px`,
                fill: '#E74C3C',
                fontWeight: 'bold',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5);
        }
    }

    /**
     * 🆕 REFONTE: Dessine les contrôles de pagination
     */
    drawPaginationControls(totalPages) {
        const { width, height } = this.config;
        const arrowSize = width * 0.04;
        const arrowX = width * 0.85;
        const upY = height * 0.38;
        const downY = height * 0.58;

        // Flèche HAUT
        if (this.currentPage > 0) {
            const upArrow = this.add.triangle(
                arrowX, upY,
                0, arrowSize,
                arrowSize / 2, 0,
                arrowSize, arrowSize,
                0x3498DB
            ).setInteractive({ useHandCursor: true });

            upArrow.on('pointerdown', () => this.changePage('prev'));
            upArrow.on('pointerover', () => upArrow.setFillStyle(0x5DADE2));
            upArrow.on('pointerout', () => upArrow.setFillStyle(0x3498DB));
        } else {
            // Désactivée
            this.add.triangle(
                arrowX, upY,
                0, arrowSize,
                arrowSize / 2, 0,
                arrowSize, arrowSize,
                0x666666, 0.3
            );
        }

        // Indicateur page
        this.add.text(arrowX, height * 0.48, `${this.currentPage + 1}/${totalPages}`, {
            fontSize: `${width * 0.022}px`,
            fill: '#FFFFFF',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        // Flèche BAS
        if (this.currentPage < totalPages - 1) {
            const downArrow = this.add.triangle(
                arrowX, downY,
                0, 0,
                arrowSize / 2, arrowSize,
                arrowSize, 0,
                0x3498DB
            ).setInteractive({ useHandCursor: true });

            downArrow.on('pointerdown', () => this.changePage('next'));
            downArrow.on('pointerover', () => downArrow.setFillStyle(0x5DADE2));
            downArrow.on('pointerout', () => downArrow.setFillStyle(0x3498DB));
        } else {
            // Désactivée
            this.add.triangle(
                arrowX, downY,
                0, 0,
                arrowSize / 2, arrowSize,
                arrowSize, 0,
                0x666666, 0.3
            );
        }
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
            `Nom: ${item.nom}\nQuantité: ${item.quantite || item['quantité'] || 1}\nPrix: ${item.prix}`, {
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

                    // ✅ NOUVEAU : Écouter la fermeture de la scène BoosterOpening
                    const boosterScene = this.scene.launch("BoosterOpeningScene", { booster: item });

                    // Écouter quand la scène se ferme pour recharger l'inventaire
                    this.scene.get('BoosterOpeningScene').events.once('shutdown', async () => {
                        console.log('[InventoryScene] BoosterOpeningScene fermée, rechargement inventaire...');
                        await this.handleInventoryUpdate();
                    });
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

        // ✅ CORRECTION : Vérifier que l'inventaire est un tableau avant forEach
        if (!Array.isArray(this.inventory)) {
            console.warn('[InventoryScene] inventory n\'est pas un tableau:', this.inventory);
            this.inventory = [];
            return;
        }

        let needsLoading = false;
        this.inventory.forEach(item => {
            if (!item || !item.image) return;
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
                console.warn('[InventoryScene] Aucun playerId disponible');
                this.displayMessage("Impossible de recharger l'inventaire : joueur inconnu.");
                this.inventory = []; // ✅ CORRECTION : S'assurer qu'on a un tableau
                return;
            }

            console.log(`[InventoryScene] Chargement inventaire pour joueur: ${playerId}`);
            const res = await fetch(`${ConfigManager.NETWORK.API.BASE_URL}${ConfigManager.NETWORK.ENDPOINTS.INVENTORY}/${playerId}`);

            // ✅ CORRECTION : Gérer les erreurs 404 et autres codes d'erreur
            if (!res.ok) {
                if (res.status === 404) {
                    console.log(`[InventoryScene] Inventaire non trouvé pour le joueur ${playerId} - création d'un inventaire vide`);
                    this.inventory = [];
                    return;
                } else {
                    throw new Error(`Erreur HTTP: ${res.status} ${res.statusText}`);
                }
            }

            const data = await res.json();
            console.log('[InventoryScene] Données reçues:', data);

            // ✅ CORRECTION : S'assurer que le résultat est toujours un tableau
            if (Array.isArray(data)) {
                this.inventory = data;
            } else if (data && Array.isArray(data.inventory)) {
                this.inventory = data.inventory;
            } else if (data && typeof data === 'object') {
                // Si c'est un objet avec d'autres propriétés, on prend ce qu'on peut
                this.inventory = data.items || data.data || [];
            } else {
                console.warn('[InventoryScene] Format de données inattendu:', data);
                this.inventory = [];
            }

            console.log(`[InventoryScene] Inventaire chargé: ${this.inventory.length} items`);

        } catch (err) {
            console.error('[InventoryScene] Erreur lors du rechargement:', err);
            this.displayMessage("Erreur lors du rechargement de l'inventaire !");
            this.inventory = []; // ✅ CORRECTION : S'assurer qu'on a un tableau même en cas d'erreur
        }
    }

    async addCardsToInventory(cards) {
        if (!Array.isArray(cards) || !cards.length) return;

        // ✅ CORRECTION : S'assurer que l'inventaire est un tableau
        if (!Array.isArray(this.inventory)) {
            this.inventory = [];
        }

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

        // ✅ CORRECTION : S'assurer que l'inventaire est un tableau
        if (!Array.isArray(this.inventory)) {
            this.inventory = [];
            this.displayMessage("Erreur : inventaire invalide.");
            return;
        }
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

            // ✅ NOUVEAU : Mettre à jour le cache après suppression
            this.updateGlobalInventoryCache();
        } catch (err) {
            this.displayMessage("Erreur lors de la suppression !");
            console.error(err);
        }
    }

    // ✅ NOUVEAU : Nettoyage des événements à la destruction
    destroy() {
        // Nettoyer les event listeners
        this.game.events.off('inventory:update', this.handleInventoryUpdate, this);
        this.game.events.off('cards:added', this.handleCardsAdded, this);

        const boosterScene = this.scene.get('BoosterOpeningScene');
        if (boosterScene) {
            boosterScene.events.off('booster:cardsReceived', this.handleCardsReceived, this);
        }

        super.destroy();
    }
}