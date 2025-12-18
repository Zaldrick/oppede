/**
 * MoveDetailModal.js
 * Modal réutilisable pour afficher les détails d'un move Pokémon
 */

import { getPokemonTypeLabelFR } from './utils/typeLabelsFR';

export default class MoveDetailModal {
    constructor(scene) {
        this.scene = scene;
        this.container = null;
        this.visible = false;
    }

    /**
     * Affiche le modal avec les détails du move
     * @param {Object} moveData - Données du move (name, type, category, power, accuracy, pp, effect)
     */
    show(moveData) {
        if (this.container) {
            this.hide();
        }

        const { width, height } = this.scene.cameras.main;
        const modalWidth = width * 0.85;
        const modalHeight = height * 0.65;
        const modalX = width * 0.5;
        const modalY = height * 0.5;

        // Container principal
        this.container = this.scene.add.container(0, 0);
        this.container.setDepth(1000);

        // Overlay semi-transparent
        const overlay = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.7);
        overlay.setOrigin(0);
        overlay.setInteractive();
        this.container.add(overlay);

        // Fond du modal
        const modalBg = this.scene.add.rectangle(modalX, modalY, modalWidth, modalHeight, 0x2C3E50, 1);
        modalBg.setStrokeStyle(4, 0xFFD700);
        this.container.add(modalBg);

        const fontSize = Math.min(width, height) * 0.04;
        const smallFontSize = Math.min(width, height) * 0.032;
        const startY = modalY - modalHeight * 0.38;

        // Titre (nom du move)
        const titleText = this.scene.add.text(modalX, startY, moveData.name || 'Unknown Move', {
            fontSize: `${fontSize * 1.3}px`,
            fill: '#FFD700',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.container.add(titleText);

        let currentY = startY + fontSize * 2.5;

        // Type et Catégorie
        const typeColor = this.getTypeColor(moveData.type);
        const typeBox = this.scene.add.rectangle(
            modalX - modalWidth * 0.2,
            currentY,
            modalWidth * 0.35,
            height * 0.06,
            typeColor,
            0.9
        );
        typeBox.setStrokeStyle(2, 0xFFFFFF);
        this.container.add(typeBox);

        const typeText = this.scene.add.text(modalX - modalWidth * 0.2, currentY, `TYPE: ${getPokemonTypeLabelFR(moveData.type)}`, {
            fontSize: `${smallFontSize}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.container.add(typeText);

        // Catégorie (Physical/Special/Status)
        const categoryBox = this.scene.add.rectangle(
            modalX + modalWidth * 0.2,
            currentY,
            modalWidth * 0.35,
            height * 0.06,
            this.getCategoryColor(moveData.category),
            0.9
        );
        categoryBox.setStrokeStyle(2, 0xFFFFFF);
        this.container.add(categoryBox);

        const categoryText = this.scene.add.text(
            modalX + modalWidth * 0.2,
            currentY,
            `${this.getCategoryLabel(moveData.category)}`,
            {
                fontSize: `${smallFontSize}px`,
                fill: '#FFFFFF',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);
        this.container.add(categoryText);

        currentY += height * 0.09;

        // Stats: Puissance, Précision, PP
        const stats = [
            { label: 'PUISSANCE', value: moveData.power || '-' },
            { label: 'PRÉCISION', value: moveData.accuracy ? `${moveData.accuracy}%` : '-' },
            { label: 'PP', value: moveData.pp || '-' }
        ];

        const statWidth = modalWidth * 0.25;
        const statStartX = modalX - statWidth - modalWidth * 0.05;

        stats.forEach((stat, index) => {
            const statX = statStartX + index * (statWidth + modalWidth * 0.05);
            
            const statBg = this.scene.add.rectangle(statX, currentY, statWidth, height * 0.055, 0x34495E, 0.8);
            statBg.setStrokeStyle(2, 0x7F8C8D);
            this.container.add(statBg);

            const labelText = this.scene.add.text(statX, currentY - height * 0.015, stat.label, {
                fontSize: `${smallFontSize * 0.8}px`,
                fill: '#BDC3C7',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            this.container.add(labelText);

            const valueText = this.scene.add.text(statX, currentY + height * 0.015, String(stat.value), {
                fontSize: `${fontSize}px`,
                fill: '#FFFFFF',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            this.container.add(valueText);
        });

        currentY += height * 0.15;

        // Effet du move
        if (moveData.effect) {
            const effectBg = this.scene.add.rectangle(
                modalX,
                currentY,
                modalWidth * 0.9,
                height * 0.22,
                0x1C2833,
                0.9
            );
            effectBg.setStrokeStyle(2, 0x5DADE2);
            this.container.add(effectBg);

            const effectTitle = this.scene.add.text(modalX, currentY - height * 0.09, 'EFFET:', {
                fontSize: `${smallFontSize}px`,
                fill: '#5DADE2',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            this.container.add(effectTitle);

            const effectText = this.scene.add.text(
                modalX,
                currentY + height * 0.01,
                this.wrapText(moveData.effect, modalWidth * 0.85, smallFontSize),
                {
                    fontSize: `${smallFontSize * 0.9}px`,
                    fill: '#ECF0F1',
                    align: 'center',
                    wordWrap: { width: modalWidth * 0.85 }
                }
            ).setOrigin(0.5, 0);
            this.container.add(effectText);
        }

        // Bouton Fermer
        const closeY = modalY + modalHeight * 0.42;
        const closeButton = this.scene.add.rectangle(modalX, closeY, modalWidth * 0.4, height * 0.06, 0xE74C3C, 1);
        closeButton.setStrokeStyle(2, 0xFFFFFF);
        closeButton.setInteractive();
        this.container.add(closeButton);

        const closeText = this.scene.add.text(modalX, closeY, 'FERMER', {
            fontSize: `${fontSize}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.container.add(closeText);

        closeButton.on('pointerdown', () => this.hide());
        closeButton.on('pointerover', () => closeButton.setFillStyle(0xC0392B, 1));
        closeButton.on('pointerout', () => closeButton.setFillStyle(0xE74C3C, 1));

        // Clic sur overlay pour fermer
        overlay.on('pointerdown', () => this.hide());

        this.visible = true;
    }

    /**
     * Cache et détruit le modal
     */
    hide() {
        if (this.container) {
            this.container.destroy();
            this.container = null;
        }
        this.visible = false;
    }

    /**
     * Wrapper pour texte long
     */
    wrapText(text, maxWidth, fontSize) {
        return text; // Phaser gère le wordWrap automatiquement
    }

    /**
     * Retourne la couleur pour un type
     */
    getTypeColor(type) {
        const typeColors = {
            normal: 0xA8A878,
            fire: 0xF08030,
            water: 0x6890F0,
            electric: 0xF8D030,
            grass: 0x78C850,
            ice: 0x98D8D8,
            fighting: 0xC03028,
            poison: 0xA040A0,
            ground: 0xE0C068,
            flying: 0xA890F0,
            psychic: 0xF85888,
            bug: 0xA8B820,
            rock: 0xB8A038,
            ghost: 0x705898,
            dragon: 0x7038F8,
            dark: 0x705848,
            steel: 0xB8B8D0,
            fairy: 0xEE99AC
        };
        return typeColors[type?.toLowerCase()] || typeColors.normal;
    }

    /**
     * Retourne la couleur pour une catégorie de move
     */
    getCategoryColor(category) {
        const categoryColors = {
            physical: 0xC0392B,
            special: 0x5499C7,
            status: 0x95A5A6
        };
        return categoryColors[category?.toLowerCase()] || categoryColors.status;
    }

    /**
     * Retourne le label traduit pour une catégorie
     */
    getCategoryLabel(category) {
        const labels = {
            physical: 'PHYSIQUE',
            special: 'SPÉCIAL',
            status: 'STATUT'
        };
        return labels[category?.toLowerCase()] || 'STATUT';
    }
}
