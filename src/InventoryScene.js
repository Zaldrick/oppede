import Phaser from "phaser";
import ConfigManager from "./managers/ConfigManager.js";
import SoundManager from './utils/SoundManager';
import ItemActionManager, { ITEM_CONTEXTS } from "./managers/ItemActionManager.js";

export class InventoryScene extends Phaser.Scene {
    constructor() {
        super("InventoryScene");
    }

    init(data) {
        this.inventory = Array.isArray(data.inventory) ? data.inventory : [];
        this.playerId = data.playerId;
        this.selectedItem = null;
        this.returnScene = data.returnScene || 'GameScene';
        this.inBattle = data.inBattle || false;
        this.battleState = data.battleState || null;

        this.actionManager = new ItemActionManager(this); // 🆕 Gestionnaire d'actions

        this.currentCategory = this.inBattle ? 'pokeballs' : 'general';
        this.currentPage = 0;
        this.itemsPerPage = 20; // Grille 5x4
        
        this.categories = {
            general: { name: 'Général', icon: '📦', color: '#8B8B8B' },
            pokeballs: { name: 'Pokéballs', icon: '⚾', color: '#E74C3C' },
            healing: { name: 'Soins', icon: '💊', color: '#2ECC71' },
            tm_hm: { name: 'CT/CS', icon: '💿', color: '#3498DB' },
            cards: { name: 'Cartes', icon: '🃏', color: '#9B59B6' },
            key_items: { name: 'Clés', icon: '🔑', color: '#F39C12' }
        };

        this.config = ConfigManager.getSceneConfig('Inventory', this.scale.width, this.scale.height);
    }

    preload() {
        this.load.audio("poubelle", ConfigManager.ASSETS.PATHS.SOUNDS + "poubelle.mp3");
        this.load.audio("item_get", "/assets/sounds/Item_Get.wav?v=1");
        this.load.audio("keyitem_get", "/assets/sounds/KeyItem_Get.wav?v=1");
    }

    async create() {
        // Nettoyage préventif
        this.destroyDom();
        
        // Création de l'interface DOM
        this.createDomOverlay();

        await this.reloadInventory();
        this.drawInventory();

        this.setupInventoryEventListeners();
        // Local SoundManager for SFX in inventory
        try { this.soundManager = new SoundManager(this); } catch (e) { this.soundManager = null; }
        
        // Gestion du nettoyage
        this.events.on('shutdown', () => this.destroyDom());
        this.events.on('destroy', () => this.destroyDom());
    }

    createDomOverlay() {
        // Conteneur principal
        this.domContainer = document.createElement('div');
        this.domContainer.className = 'inventory-overlay';
        
        // Inject CSS
        const style = document.createElement('style');
        style.textContent = `
            .inventory-overlay {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background-color: rgba(0, 0, 0, 0.8); z-index: 100;
                display: flex; flex-direction: column;
                font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
                color: white; box-sizing: border-box; pointer-events: auto; user-select: none;
            }
            .inventory-header {
                text-align: center; padding: 15px 0; flex: 0 0 auto;
                background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);
            }
            .inventory-header h2 {
                margin: 0; font-size: 2rem; text-shadow: 2px 2px 0 #000; color: #FFFFFF;
            }
            .inventory-content {
                display: flex; flex: 1; overflow: hidden; padding: 10px 20px; gap: 20px;
                /* Padding supprimé comme demandé */
            }
            
            /* Colonne Gauche : Liste */
            .inventory-left-panel {
                flex: 1.2; 
                background-color: rgba(255, 255, 255, 0.05);
                border-radius: 12px; 
                overflow-y: auto; 
                display: flex; flex-direction: column; gap: 8px; padding: 10px;
                border: 1px solid rgba(255,255,255,0.1);
                transition: flex 0.3s ease;
            }

            /* Colonne Droite : Onglets + Détails + Bouton */
            .inventory-right-panel {
                flex: 1; 
                display: flex; flex-direction: column; gap: 10px;
                min-width: 0;
                padding-bottom: 10px;
                transition: flex 0.3s ease;
            }

            .inventory-tabs {
                display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;
                flex: 0 0 auto;
                padding: 5px;
            }

            .inventory-details {
                flex: 1; 
                background-color: rgba(0, 0, 0, 0.8);
                border-radius: 12px; border: 1px solid #555; padding: 15px;
                display: flex; flex-direction: column; align-items: center; 
                overflow-y: auto;
                position: relative;
            }

            .inventory-back-btn {
                align-self: flex-end; /* Aligné à droite */
                padding: 12px 40px; font-size: 1.2rem; background-color: #E74C3C;
                color: white; border: none; border-radius: 8px; cursor: pointer;
                font-weight: bold; box-shadow: 0 4px 0 #C0392B; z-index: 102;
                transition: transform 0.1s;
                margin-top: 10px;
                margin-bottom: 60px; /* Marge de sécurité pour le chat */
            }
            .inventory-back-btn:active { transform: translateY(2px); box-shadow: 0 2px 0 #C0392B; }

            /* Scrollbars */
            ::-webkit-scrollbar { width: 8px; }
            ::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 4px; }
            ::-webkit-scrollbar-thumb { background: #7F8C8D; border-radius: 4px; }
            ::-webkit-scrollbar-thumb:hover { background: #95A5A6; }

            /* Responsive Mobile (Portrait) */
            @media (max-aspect-ratio: 1/1) {
                .inventory-content {
                    flex-direction: column;
                    padding: 10px;
                }
                .inventory-left-panel {
                    flex: 2; /* Liste plus grande */
                    max-height: none;
                }
                .inventory-right-panel {
                    flex: 1.2; /* Détails réduits */
                    overflow: visible;
                }
                .inventory-tabs {
                    overflow-x: auto;
                    flex-wrap: nowrap;
                    justify-content: flex-start;
                    padding-bottom: 5px;
                }
                .inventory-header h2 { font-size: 1.5rem; }
                
                /* Ajustement bouton sur mobile */
                .inventory-back-btn {
                    width: 100%; /* Pleine largeur sur mobile */
                    margin-bottom: 80px; /* Plus d'espace pour le chat mobile */
                }
            }
        `;
        this.domContainer.appendChild(style);

        // Header
        const header = document.createElement('div');
        header.className = 'inventory-header';
        const title = document.createElement('h2');
        title.textContent = 'INVENTAIRE';
        header.appendChild(title);
        this.domContainer.appendChild(header);

        // Content Wrapper
        const content = document.createElement('div');
        content.className = 'inventory-content';
        this.domContainer.appendChild(content);

        // Left Panel (List)
        this.leftPanel = document.createElement('div');
        this.leftPanel.className = 'inventory-left-panel';
        content.appendChild(this.leftPanel);

        // Right Panel (Tabs + Details + Button)
        this.rightPanel = document.createElement('div');
        this.rightPanel.className = 'inventory-right-panel';
        content.appendChild(this.rightPanel);

        // Tabs
        this.tabsContainer = document.createElement('div');
        this.tabsContainer.className = 'inventory-tabs';
        this.rightPanel.appendChild(this.tabsContainer);

        // Details
        this.detailsContainer = document.createElement('div');
        this.detailsContainer.className = 'inventory-details';
        this.rightPanel.appendChild(this.detailsContainer);

        // Back Button (Maintenant dans le panneau de droite)
        const backBtn = document.createElement('button');
        backBtn.className = 'inventory-back-btn';
        backBtn.textContent = 'RETOUR';
        backBtn.onclick = () => this.closeScene();
        this.rightPanel.appendChild(backBtn);

        // Ajouter au DOM du jeu
        this.game.canvas.parentElement.appendChild(this.domContainer);
    }

    destroyDom() {
        if (this.domContainer && this.domContainer.parentNode) {
            this.domContainer.parentNode.removeChild(this.domContainer);
        }
        this.domContainer = null;
    }

    closeScene() {
        this.destroyDom();
        this.scene.stop('InventoryScene');
        this.scene.resume(this.returnScene);
    }

    setupInventoryEventListeners() {
        this.scene.get('BoosterOpeningScene')?.events.on('booster:cardsReceived', this.handleCardsReceived, this);
        this.game.events.on('inventory:update', this.handleInventoryUpdate, this);
        this.game.events.on('cards:added', this.handleCardsAdded, this);
    }

    // ... (Event handlers restent identiques) ...
    async handleCardsReceived(data) {
        if (data && data.cards && Array.isArray(data.cards)) {
            await this.addCardsToInventory(data.cards);
            await this.reloadInventory();
            this.drawInventory();
            this.updateGlobalInventoryCache();
            this.displayMessage(`${data.cards.length} cartes ajoutées !`);
            // Play item get sound
            try { this.sound.play('item_get', { volume: 0.8 }); } catch (e) { /* ignore */ }
        }
    }

    async handleInventoryUpdate() {
        await this.reloadInventory();
        this.drawInventory();
        this.updateGlobalInventoryCache();
    }

    async handleCardsAdded(cards) {
        if (Array.isArray(cards)) {
            await this.addCardsToInventory(cards);
            this.updateGlobalInventoryCache();
            try { this.sound.play('item_get', { volume: 0.8 }); } catch (e) { /* ignore */ }
        }
    }

    updateGlobalInventoryCache() {
        const gameScene = this.scene.get('GameScene');
        if (gameScene) {
            gameScene.inventory = [...this.inventory];
        }
        this.registry.set('playerInventory', [...this.inventory]);
        this.game.events.emit('inventory:cacheUpdated', this.inventory);
    }

    categorizeItem(item) {
        if (!item) return 'general';
        const itemName = (item.nom || '').toLowerCase();
        const itemType = (item.type || '').toLowerCase();
        
        if (itemType === 'card' || itemName.includes('carte')) return 'cards';
        if (itemName.includes('ball') || itemName.includes('balle')) return 'pokeballs';
        if (itemName.includes('potion') || itemName.includes('rappel') || 
            itemName.includes('guérison') || itemName.includes('antidote') ||
            itemName.includes('soin')) return 'healing';
        if (itemName.includes('ct') || itemName.includes('cs')) return 'tm_hm';
        if (itemType === 'key' || item.isKeyItem) return 'key_items';
        return 'general';
    }

    getFilteredItems() {
        const allItems = Array.isArray(this.inventory) ? this.inventory : [];
        return allItems.filter(item => {
            // 1. Filtrer par catégorie
            if (this.categorizeItem(item) !== this.currentCategory) return false;
            
            // 2. Filtrer par contexte d'utilisation (Battle vs Menu)
            const currentContext = this.inBattle ? 'Battle' : 'Menu';
            
            // Si l'item a défini usage_context, on l'utilise
            if (item.usage_context && Array.isArray(item.usage_context)) {
                return item.usage_context.includes(currentContext);
            }
            
            // Fallback pour items legacy (sans usage_context)
            if (this.inBattle) {
                // En combat, par défaut seulement Pokéballs et Soins
                return ['pokeballs', 'healing'].includes(this.currentCategory);
            }
            
            // Hors combat, tout est visible par défaut sauf si spécifié autrement
            return true;
        });
    }

    getAvailableCategories() {
        if (this.inBattle) {
            return ['pokeballs', 'healing'];
        }
        return Object.keys(this.categories);
    }

    changeCategory(newCategory) {
        if (this.currentCategory === newCategory) return;
        this.currentCategory = newCategory;
        this.currentPage = 0;
        this.selectedItem = null;
        this.drawInventory();
    }

    drawInventory() {
        if (!this.domContainer) return;

        // 1. Dessiner les onglets
        this.drawCategoryTabs();

        // 2. Dessiner la liste (Gauche)
        this.leftPanel.innerHTML = '';
        const filteredItems = this.getFilteredItems();

        if (filteredItems.length === 0) {
            this.leftPanel.innerHTML = `<div style="text-align: center; color: #999; margin-top: 50px;">Aucun objet dans cette catégorie</div>`;
            this.selectedItem = null;
        } else {
            filteredItems.forEach(item => {
                const card = this.createItemDomCard(item);
                this.leftPanel.appendChild(card);
            });
        }

        // 3. Gestion de l'affichage dynamique
        if (!this.selectedItem) {
            // Mode "Liste Pleine" : On cache les détails pour laisser la place à la liste
            this.leftPanel.style.flex = '3';
            this.rightPanel.style.flex = '0.6'; // Juste assez pour les onglets
            this.detailsContainer.style.display = 'none'; 
        } else {
            // Mode "Détails Visibles" : On rééquilibre
            this.leftPanel.style.flex = '1.2';
            this.rightPanel.style.flex = '1';
            this.detailsContainer.style.display = 'flex'; 
            this.updateDetailsPanel(this.selectedItem);
        }
    }

    drawCategoryTabs() {
        this.tabsContainer.innerHTML = '';
        const availableCategories = this.getAvailableCategories();

        availableCategories.forEach(catKey => {
            const category = this.categories[catKey];
            const isActive = catKey === this.currentCategory;
            
            const tab = document.createElement('div');
            // Seulement l'icône, plus compact
            tab.innerHTML = `<span style="font-size: 1.4rem;">${category.icon}</span>`;
            tab.title = category.name; // Tooltip natif
            
            Object.assign(tab.style, {
                width: '50px',
                height: '50px',
                backgroundColor: isActive ? category.color : '#444',
                color: 'white',
                borderRadius: '50%',
                cursor: 'pointer',
                border: isActive ? '3px solid white' : '2px solid transparent',
                transition: 'all 0.2s',
                opacity: isActive ? '1' : '0.6',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                boxShadow: isActive ? '0 0 10px ' + category.color : 'none'
            });

            tab.onmouseover = () => { 
                if (!isActive) {
                    tab.style.opacity = '1'; 
                    tab.style.transform = 'scale(1.1)';
                }
            };
            tab.onmouseout = () => { 
                if (!isActive) {
                    tab.style.opacity = '0.6'; 
                    tab.style.transform = 'scale(1)';
                }
            };
            tab.onclick = () => this.changeCategory(catKey);

            this.tabsContainer.appendChild(tab);
        });
    }

    createItemDomCard(item) {
        const card = document.createElement('div');
        const isSelected = this.selectedItem === item;
        
        Object.assign(card.style, {
            backgroundColor: isSelected ? '#555' : 'rgba(0,0,0,0.3)',
            border: isSelected ? '2px solid #3498DB' : '1px solid #444',
            borderRadius: '8px',
            padding: '8px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            position: 'relative',
            minHeight: '60px',
            flexShrink: 0 /* Empêche le rétrécissement */
        });

        // Image
        const img = document.createElement('img');
        img.src = `/assets/items/${item.image}`;
        Object.assign(img.style, {
            width: '40px', height: '40px', objectFit: 'contain', marginRight: '10px', flexShrink: 0
        });
        img.onerror = () => { img.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjMzMzIi8+PHRleHQgeD0iMjQiIHk9IjI0IiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIj4/PC90ZXh0Pjwvc3ZnPg=='; };
        card.appendChild(img);

        // Nom
        const name = document.createElement('div');
        name.textContent = item.nom;
        Object.assign(name.style, {
            fontSize: '0.9rem', fontWeight: 'bold', flex: '1', textAlign: 'left',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
        });
        card.appendChild(name);

        // Quantité badge
        const qty = document.createElement('div');
        qty.textContent = `x${item.quantite || item['quantité'] || 1}`;
        Object.assign(qty.style, {
            backgroundColor: '#3498DB',
            color: 'white',
            borderRadius: '12px',
            padding: '2px 6px',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            marginLeft: '8px',
            flexShrink: 0,
            whiteSpace: 'nowrap'
        });
        card.appendChild(qty);

        card.onclick = () => this.handleItemSelection(item);
        card.onmouseover = () => { if (this.selectedItem !== item) card.style.backgroundColor = '#444'; };
        card.onmouseout = () => { if (this.selectedItem !== item) card.style.backgroundColor = 'rgba(0,0,0,0.3)'; };

        return card;
    }

    handleItemSelection(item) {
        this.selectedItem = item;
        this.drawInventory(); // Redessiner pour mettre à jour la sélection visuelle
        this.updateDetailsPanel(item);
    }

    updateDetailsPanel(item) {
        this.detailsContainer.innerHTML = '';

        // Conteneur Haut : Image (Gauche) + Infos (Droite)
        const topContainer = document.createElement('div');
        Object.assign(topContainer.style, {
            display: 'flex',
            width: '100%',
            gap: '20px',
            alignItems: 'flex-start',
            marginBottom: '15px',
            flex: '1', // Prend l'espace disponible
            minHeight: '0' // Permet le scroll interne si besoin, mais on vise sans scroll
        });

        // Grande Image
        const img = document.createElement('img');
        img.src = `/assets/items/${item.image}`;
        Object.assign(img.style, {
            width: '140px',
            height: '140px',
            objectFit: 'contain',
            backgroundColor: 'rgba(0,0,0,0.2)',
            borderRadius: '10px',
            padding: '10px',
            flexShrink: 0
        });
        topContainer.appendChild(img);

        // Infos
        const infoDiv = document.createElement('div');
        Object.assign(infoDiv.style, {
            flex: '1',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            textAlign: 'left',
            overflowY: 'auto' // Scroll seulement sur le texte si vraiment trop long
        });

        infoDiv.innerHTML = `
            <h3 style="margin: 0; font-size: 1.4rem; color: #3498DB; line-height: 1.2;">${item.nom}</h3>
            <div style="display: flex; flex-wrap: wrap; gap: 15px; font-size: 0.9rem; color: #AAA; padding-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <span>Qté: <b style="color: white;">${item.quantite || 1}</b></span>
                <span>Prix: <b style="color: #F1C40F;">${item.prix || 0} ₽</b></span>
            </div>
            <p style="margin: 0; font-style: italic; line-height: 1.4; font-size: 0.95rem; color: #DDD;">${item.description || "Aucune description."}</p>
        `;
        topContainer.appendChild(infoDiv);
        this.detailsContainer.appendChild(topContainer);

        // Actions (Bas - Ligne horizontale)
        const actionsDiv = document.createElement('div');
        Object.assign(actionsDiv.style, {
            display: 'flex',
            flexDirection: 'row',
            gap: '15px',
            width: '100%',
            marginTop: 'auto',
            paddingTop: '10px',
            borderTop: '1px solid rgba(255,255,255,0.1)'
        });

        // Bouton Utiliser / Ouvrir
        let useBtn = null;
        if (item.type === 'booster') {
            useBtn = this.createActionButton('OUVRIR', '#27AE60', () => this.openBooster(item));
        } else if (item.actions && item.actions.length > 0) {
            useBtn = this.createActionButton(item.actions[0].action_name || 'UTILISER', '#27AE60', () => this.executeAction(item.actions[0]));
        } else if (item.utiliser) {
            useBtn = this.createActionButton('UTILISER', '#27AE60', () => this.useItem(item));
        } else if (this.inBattle && ['healing', 'status-heal', 'pokeball'].includes(item.type)) {
             useBtn = this.createActionButton('UTILISER', '#27AE60', () => this.useItem(item));
        }

        if (useBtn) actionsDiv.appendChild(useBtn);

        // Bouton Jeter
        const dropBtn = this.createActionButton('JETER', '#7F8C8D', () => this.removeItemFromInventory(item));
        actionsDiv.appendChild(dropBtn);

        this.detailsContainer.appendChild(actionsDiv);
    }

    createActionButton(text, color, onClick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        Object.assign(btn.style, {
            padding: '12px',
            backgroundColor: color,
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '1rem',
            flex: '1', // Partage l'espace équitablement
            transition: 'filter 0.2s'
        });
        btn.onmouseover = () => btn.style.filter = 'brightness(1.1)';
        btn.onmouseout = () => btn.style.filter = 'brightness(1)';
        btn.onclick = onClick;
        return btn;
    }

    // === ACTIONS ===

    async useItem(item) {
        console.log('[InventoryScene] Tentative utilisation:', item.nom);
        
        const context = this.inBattle ? ITEM_CONTEXTS.BATTLE : ITEM_CONTEXTS.MENU;
        
        // 1. Vérifier si l'action est permise via le Manager
        const check = this.actionManager.canUseItem(item, context);
        if (!check.allowed) {
            this.displayMessage(check.reason);
            return;
        }

        // 2. Gestion spécifique Combat (car nécessite interaction avec BattleScene)
        if (this.inBattle) {
            if (this.returnScene === 'PokemonBattleScene') {
                const battleScene = this.scene.get('PokemonBattleScene');
                if (battleScene && battleScene.useItemInBattle) {
                    const battleItem = {
                        item_id: item.item_id || item._id,
                        itemData: {
                            name_fr: item.nom,
                            type: this.categorizeItem(item) === 'pokeballs' ? 'pokeball' : 'healing'
                        },
                        quantity: item.quantite
                    };
                    
                    this.closeScene();
                    battleScene.useItemInBattle(battleItem);
                }
            }
            return;
        }

        // 3. Exécution de l'action hors combat via le Manager
        await this.actionManager.executeAction(item, context, { playerId: this.playerId });
    }

    openBooster(item) {
        // Délégation au manager
        this.actionManager.executeAction(item, ITEM_CONTEXTS.MENU);
    }

    executeAction(action) {
        // Legacy support pour les items avec "actions" définies en JSON
        // On essaie de mapper vers le nouveau système si possible
        this.displayMessage("Action legacy exécutée");
    }

    async removeItemFromInventory(item) {
        // ... existing remove logic ...
        const playerId = this.playerId || window.playerId;
        const itemId = item.item_id || item._id;
        
        if (!playerId || !itemId) return;

        try { if (this.soundManager) this.soundManager.playMoveSound('poubelle', { volume: 0.8 }); else if (this.sound) this.sound.play("poubelle"); } catch (e) { /* ignore */ }

        // Optimiste update
        const idx = this.inventory.findIndex(c => (c.item_id || c._id) === itemId);
        if (idx !== -1) {
            if (this.inventory[idx].quantite > 1) {
                this.inventory[idx].quantite -= 1;
            } else {
                this.inventory.splice(idx, 1);
                this.selectedItem = null;
            }
        }
        this.drawInventory();

        try {
            const res = await fetch(`${ConfigManager.NETWORK.API.BASE_URL}${ConfigManager.NETWORK.ENDPOINTS.INVENTORY}/remove-item`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ playerId, itemId })
            });
            if (!res.ok) throw new Error("Erreur serveur");
            this.displayMessage("Objet jeté !");
            this.updateGlobalInventoryCache();
        } catch (err) {
            this.displayMessage("Erreur lors de la suppression !");
            await this.reloadInventory(); // Rollback
            this.drawInventory();
        }
    }

    // === UTILITAIRES ===

    async reloadInventory() {
        try {
            const playerId = this.playerId || window.playerId;
            if (!playerId) return;

            const res = await fetch(`${ConfigManager.NETWORK.API.BASE_URL}${ConfigManager.NETWORK.ENDPOINTS.INVENTORY}/${playerId}`);
            if (!res.ok) return;

            const data = await res.json();
            if (Array.isArray(data)) this.inventory = data;
            else if (data.inventory) this.inventory = data.inventory;
            else this.inventory = [];
            
        } catch (err) {
            console.error('[InventoryScene] Erreur reload:', err);
        }
    }

    async addCardsToInventory(cards) {
        // ... existing addCards logic ...
        if (!Array.isArray(cards)) return;
        this.inventory.push(...cards.map(c => ({...c, quantite: 1})));
        // Note: La sauvegarde serveur est gérée par l'appelant ou ici si besoin
    }

    displayMessage(text) {
        const toast = document.createElement('div');
        toast.textContent = text;
        Object.assign(toast.style, {
            position: 'absolute',
            bottom: '10%',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '5px',
            zIndex: '200',
            pointerEvents: 'none'
        });
        this.domContainer.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 3000);
    }

    destroy() {
        this.game.events.off('inventory:update', this.handleInventoryUpdate, this);
        this.game.events.off('cards:added', this.handleCardsAdded, this);
        const boosterScene = this.scene.get('BoosterOpeningScene');
        if (boosterScene) {
            boosterScene.events.off('booster:cardsReceived', this.handleCardsReceived, this);
        }
        super.destroy();
    }
}
