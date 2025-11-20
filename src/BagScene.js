/**
 * BagScene.js
 * Scène pour afficher et utiliser les objets (Potions, Antidotes, Poké Balls)
 * 
 * Utilisable en combat ou hors combat
 * Design responsive inspiré de Pokémon
 */

import Phaser from 'phaser';

class BagScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BagScene' });
    }

    init(data) {
        this.playerId = data.playerId;
        this.inBattle = data.inBattle || false; // En combat ou non
        this.battleContext = data.battleContext || null; // Contexte combat si applicable
        this.onItemUsed = data.onItemUsed || null; // Callback après usage
        this.returnScene = data.returnScene || 'PokemonBattleScene'; // 🆕 Scène de retour
        
        console.log('[BagScene] Init - returnScene:', this.returnScene, 'inBattle:', this.inBattle);
    }

    create() {
        // Nettoyage préventif
        this.destroyDom();

        // Création de l'interface DOM (pour être au-dessus des GIFs)
        this.createDomOverlay();

        // Charger inventaire
        this.loadInventory();

        // Gestion du nettoyage
        this.events.on('shutdown', () => this.destroyDom());
        this.events.on('destroy', () => this.destroyDom());
    }

    createDomOverlay() {
        // Conteneur principal
        this.domContainer = document.createElement('div');
        Object.assign(this.domContainer.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(44, 62, 80, 0.95)', // Fond semi-transparent
            zIndex: '100', // Au-dessus des GIFs (z-index 1-5)
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
            color: 'white',
            padding: '20px',
            boxSizing: 'border-box',
            pointerEvents: 'auto' // Capturer les clics
        });

        // Titre
        const title = document.createElement('h2');
        title.textContent = 'SAC';
        Object.assign(title.style, {
            margin: '0 0 20px 0',
            fontSize: '2rem',
            textShadow: '2px 2px 0 #000',
            flexShrink: '0'
        });
        this.domContainer.appendChild(title);

        // Conteneur liste (scrollable)
        this.listContainer = document.createElement('div');
        Object.assign(this.listContainer.style, {
            flex: '1',
            width: '100%',
            maxWidth: '600px',
            overflowY: 'auto',
            marginBottom: '20px',
            paddingRight: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
        });
        // Style scrollbar
        const style = document.createElement('style');
        style.textContent = `
            #bag-list::-webkit-scrollbar { width: 8px; }
            #bag-list::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 4px; }
            #bag-list::-webkit-scrollbar-thumb { background: #7F8C8D; border-radius: 4px; }
            #bag-list::-webkit-scrollbar-thumb:hover { background: #95A5A6; }
        `;
        this.listContainer.id = 'bag-list';
        this.domContainer.appendChild(style);
        this.domContainer.appendChild(this.listContainer);

        // Bouton Retour
        const backBtn = document.createElement('button');
        backBtn.textContent = 'RETOUR';
        Object.assign(backBtn.style, {
            padding: '15px 40px',
            fontSize: '1.2rem',
            backgroundColor: '#E74C3C',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontWeight: 'bold',
            boxShadow: '0 4px 0 #C0392B',
            flexShrink: '0',
            transition: 'transform 0.1s'
        });
        
        backBtn.onmousedown = () => backBtn.style.transform = 'translateY(2px)';
        backBtn.onmouseup = () => backBtn.style.transform = 'translateY(0)';
        backBtn.onmouseleave = () => backBtn.style.transform = 'translateY(0)';
        
        backBtn.onclick = () => {
            if (this.onItemUsed) this.onItemUsed(null);
            this.closeScene();
        };
        this.domContainer.appendChild(backBtn);

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
        this.scene.stop('BagScene');
        this.scene.resume(this.returnScene);
        // Pas besoin de bringToTop car le DOM est supprimé
    }

    async loadInventory() {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
        
        try {
            const response = await fetch(`${apiUrl}/api/inventory/${this.playerId}`);
            const data = await response.json();

            if (data.success) {
                this.displayInventory(data.inventory);
            } else {
                this.displayError('Impossible de charger l\'inventaire');
            }
        } catch (error) {
            console.error('[BagScene] Erreur:', error);
            this.displayError('Erreur réseau');
        }
    }

    displayInventory(inventory) {
        this.listContainer.innerHTML = ''; // Clear

        if (inventory.length === 0) {
            this.listContainer.innerHTML = '<div style="text-align:center; color: #95A5A6; margin-top: 50px; font-size: 1.2rem;">Sac vide</div>';
            return;
        }

        // Filtrer selon contexte (en combat: soins + balls uniquement)
        let filtered = inventory;
        if (this.inBattle) {
            filtered = inventory.filter(item => 
                ['healing', 'status-heal', 'pokeball'].includes(item.itemData.type)
            );
        }

        if (filtered.length === 0) {
            this.listContainer.innerHTML = '<div style="text-align:center; color: #95A5A6; margin-top: 50px; font-size: 1.2rem;">Aucun objet utilisable</div>';
            return;
        }

        filtered.forEach(item => {
            const card = this.createItemDomCard(item);
            this.listContainer.appendChild(card);
        });
    }

    createItemDomCard(item) {
        const card = document.createElement('div');
        Object.assign(card.style, {
            backgroundColor: 'rgba(52, 73, 94, 0.9)',
            border: '2px solid rgba(255, 255, 255, 0.8)',
            borderRadius: '10px',
            padding: '15px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            userSelect: 'none'
        });

        card.onmouseover = () => {
            card.style.backgroundColor = 'rgba(26, 188, 156, 0.9)';
            card.style.borderColor = 'white';
            card.style.transform = 'translateX(5px)';
        };
        card.onmouseout = () => {
            card.style.backgroundColor = 'rgba(52, 73, 94, 0.9)';
            card.style.borderColor = 'rgba(255, 255, 255, 0.8)';
            card.style.transform = 'translateX(0)';
        };
        card.onclick = () => this.useItem(item);

        // Gauche: Image + Nom + Type
        const leftDiv = document.createElement('div');
        leftDiv.style.display = 'flex';
        leftDiv.style.alignItems = 'center';
        leftDiv.style.gap = '15px';

        // Image de l'item
        const img = document.createElement('img');
        // Logique de chemin d'image (à adapter selon vos données)
        let imagePath = '/assets/items/pokeball1.png'; // Default
        if (item.itemData.image) {
            imagePath = `/assets/items/${item.itemData.image}`;
        } else if (item.itemData.type === 'pokeball') {
            // Mapping basique pour les balls
            if (item.itemData.id === 'great-ball' || item.itemData.name_fr.includes('Super')) imagePath = '/assets/items/pokeball2.png';
            else if (item.itemData.id === 'ultra-ball' || item.itemData.name_fr.includes('Hyper')) imagePath = '/assets/items/pokeball5.png';
            else imagePath = '/assets/items/pokeball1.png';
        }
        
        img.src = imagePath;
        img.style.width = '48px';
        img.style.height = '48px';
        img.style.objectFit = 'contain';
        img.onerror = () => { img.src = '/assets/items/pokeball1.png'; }; // Fallback
        leftDiv.appendChild(img);

        const textDiv = document.createElement('div');
        textDiv.style.display = 'flex';
        textDiv.style.flexDirection = 'column';
        textDiv.style.gap = '5px';

        const name = document.createElement('div');
        name.textContent = item.itemData.name_fr;
        name.style.fontWeight = 'bold';
        name.style.fontSize = '1.1rem';
        textDiv.appendChild(name);

        const typeLabel = document.createElement('span');
        typeLabel.textContent = this.getTypeLabel(item.itemData.type);
        Object.assign(typeLabel.style, {
            fontSize: '0.8rem',
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: '#' + this.getTypeColor(item.itemData.type).toString(16).padStart(6, '0'),
            width: 'fit-content',
            fontWeight: 'bold'
        });
        textDiv.appendChild(typeLabel);
        
        leftDiv.appendChild(textDiv);

        card.appendChild(leftDiv);

        // Droite: Quantité
        const qty = document.createElement('div');
        qty.textContent = `x${item.quantity}`;
        Object.assign(qty.style, {
            fontSize: '1.2rem',
            fontWeight: 'bold',
            color: '#3498DB'
        });
        card.appendChild(qty);

        return card;
    }

    getTypeColor(type) {
        const colors = {
            healing: 0x2ECC71,
            'status-heal': 0xF39C12,
            pokeball: 0xE74C3C,
            held: 0x9B59B6
        };
        return colors[type] || 0x95A5A6;
    }

    getTypeLabel(type) {
        const labels = {
            healing: 'SOIN',
            'status-heal': 'STATUT',
            pokeball: 'BALL',
            held: 'TENU'
        };
        return labels[type] || 'AUTRE';
    }

    async useItem(item) {
        console.log('[BagScene] Usage:', item.itemData.name_fr);

        if (this.inBattle) {
            if (this.onItemUsed) {
                this.onItemUsed(item);
            }
            this.closeScene();
        } else {
            this.displayError('Fonctionnalité hors combat en développement');
        }
    }

    displayError(message) {
        // Simple toast notification
        const toast = document.createElement('div');
        toast.textContent = message;
        Object.assign(toast.style, {
            position: 'absolute',
            bottom: '20%',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(231, 76, 60, 0.9)',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '5px',
            zIndex: '101',
            fontWeight: 'bold'
        });
        this.domContainer.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 2000);
    }
}

export default BagScene;
