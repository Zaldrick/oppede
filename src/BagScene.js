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
    }

    async create() {
        const { width, height } = this.scale;

        // Background
        this.add.rectangle(0, 0, width, height, 0x2C3E50, 0.95).setOrigin(0);

        // Titre
        this.add.text(width * 0.5, height * 0.08, 'SAC', {
            fontSize: `${Math.min(width, height) * 0.06}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Charger inventaire
        await this.loadInventory();

        // Bouton Retour
        this.createBackButton();
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
        const { width, height } = this.scale;

        if (inventory.length === 0) {
            this.add.text(width * 0.5, height * 0.5, 'Sac vide', {
                fontSize: `${Math.min(width, height) * 0.05}px`,
                fill: '#95A5A6'
            }).setOrigin(0.5);
            return;
        }

        // Filtrer selon contexte (en combat: soins + balls uniquement)
        let filtered = inventory;
        if (this.inBattle) {
            filtered = inventory.filter(item => 
                ['healing', 'status-heal', 'pokeball'].includes(item.itemData.type)
            );
        }

        // Grille d'items
        const cardWidth = width * 0.85;
        const cardHeight = height * 0.10;
        const startY = height * 0.18;
        const spacing = height * 0.015;

        filtered.forEach((item, index) => {
            const yPos = startY + index * (cardHeight + spacing);
            this.createItemCard(item, cardWidth, cardHeight, width * 0.075, yPos);
        });
    }

    createItemCard(item, cardWidth, cardHeight, x, y) {
        const container = this.add.container(x, y);

        // Fond
        const card = this.add.graphics();
        card.fillStyle(0x34495E, 0.9);
        card.fillRoundedRect(0, 0, cardWidth, cardHeight, 10);
        card.lineStyle(3, 0xFFFFFF, 0.8);
        card.strokeRoundedRect(0, 0, cardWidth, cardHeight, 10);
        container.add(card);

        // Nom
        const nameText = this.add.text(cardWidth * 0.05, cardHeight * 0.3, 
            item.itemData.name_fr, {
            fontSize: `${Math.min(this.scale.width, this.scale.height) * 0.042}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        container.add(nameText);

        // Quantité
        const qtyText = this.add.text(cardWidth * 0.75, cardHeight * 0.5, 
            `x${item.quantity}`, {
            fontSize: `${Math.min(this.scale.width, this.scale.height) * 0.045}px`,
            fill: '#3498DB',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        container.add(qtyText);

        // Type badge
        const typeColor = this.getTypeColor(item.itemData.type);
        const typeBg = this.add.graphics();
        typeBg.fillStyle(typeColor, 1);
        typeBg.fillRoundedRect(cardWidth * 0.05, cardHeight * 0.65, cardWidth * 0.25, cardHeight * 0.25, 5);
        container.add(typeBg);

        const typeLabel = this.getTypeLabel(item.itemData.type);
        const typeText = this.add.text(cardWidth * 0.175, cardHeight * 0.775, typeLabel, {
            fontSize: `${Math.min(this.scale.width, this.scale.height) * 0.028}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        container.add(typeText);

        // Interaction
        card.setInteractive(new Phaser.Geom.Rectangle(0, 0, cardWidth, cardHeight), Phaser.Geom.Rectangle.Contains);

        card.on('pointerover', () => {
            card.clear();
            card.fillStyle(0x1ABC9C, 0.9);
            card.fillRoundedRect(0, 0, cardWidth, cardHeight, 10);
            card.lineStyle(4, 0xFFFFFF, 1);
            card.strokeRoundedRect(0, 0, cardWidth, cardHeight, 10);
        });

        card.on('pointerout', () => {
            card.clear();
            card.fillStyle(0x34495E, 0.9);
            card.fillRoundedRect(0, 0, cardWidth, cardHeight, 10);
            card.lineStyle(3, 0xFFFFFF, 0.8);
            card.strokeRoundedRect(0, 0, cardWidth, cardHeight, 10);
        });

        card.on('pointerdown', () => {
            this.useItem(item);
        });
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
            // Si c'est une Poké Ball, on utilise directement (pas de sélection de Pokémon)
            if (item.itemData.type === 'pokeball') {
                if (this.onItemUsed) {
                    this.onItemUsed(item);
                }
                this.scene.stop();
            } else {
                // Autres items: retourner l'item au contexte de combat
                if (this.onItemUsed) {
                    this.onItemUsed(item);
                }
                this.scene.stop();
            }
        } else {
            // Hors combat: appeler API directement
            // TODO: Sélectionner Pokémon cible si nécessaire
            this.showMessage('Fonctionnalité hors combat en développement');
        }
    }

    createBackButton() {
        const { width, height } = this.scale;
        const btnWidth = width * 0.3;
        const btnHeight = height * 0.06;
        const x = width * 0.5;
        const y = height * 0.92;

        const button = this.add.rectangle(x, y, btnWidth, btnHeight, 0xE74C3C);
        button.setInteractive();

        const text = this.add.text(x, y, 'RETOUR', {
            fontSize: `${Math.min(width, height) * 0.04}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        button.on('pointerover', () => button.setFillStyle(0xC0392B));
        button.on('pointerout', () => button.setFillStyle(0xE74C3C));
        button.on('pointerdown', () => {
            if (this.onItemUsed) this.onItemUsed(null); // Annuler
            this.scene.stop();
        });
    }

    displayError(message) {
        const { width, height } = this.scale;
        this.add.text(width * 0.5, height * 0.5, message, {
            fontSize: `${Math.min(width, height) * 0.05}px`,
            fill: '#E74C3C',
            fontStyle: 'bold'
        }).setOrigin(0.5);
    }

    showMessage(message) {
        const { width, height } = this.scale;
        const msgBox = this.add.rectangle(width * 0.5, height * 0.5, width * 0.8, height * 0.15, 0x34495E, 0.95);
        const msgText = this.add.text(width * 0.5, height * 0.5, message, {
            fontSize: `${Math.min(width, height) * 0.04}px`,
            fill: '#FFFFFF',
            align: 'center',
            wordWrap: { width: width * 0.7 }
        }).setOrigin(0.5);

        this.time.delayedCall(2000, () => {
            msgBox.destroy();
            msgText.destroy();
        });
    }
}

export default BagScene;
