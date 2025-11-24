/**
 * MoveLearnScene.js
 * Scène pour apprendre/remplacer une attaque après montée de niveau
 * 
 * Affiche:
 * - Le nouveau move disponible avec stats complètes
 * - Les 4 moves actuels (ou moins) avec comparaison
        console.log('[MoveLearn] Move ignoré (pas d\'appel API)');
 */

import Phaser from 'phaser';
import getPokemonDisplayName from './utils/getDisplayName';

class MoveLearnScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MoveLearnScene' });
    }

    init(data) {
        this.pokemon = data.pokemon; // Pokémon qui apprend
        this.newMove = data.newMove; // Nouveau move disponible
        this.onComplete = data.onComplete; // Callback après choix
        this.isProcessing = false;
        this.translationsCache = {};
    }

    async create() {
        const { width, height } = this.scale;

        // Background semi-transparent
        this.add.rectangle(0, 0, width, height, 0x000000, 0.95).setOrigin(0);

        // Titre
        this.add.text(width * 0.5, height * 0.08, 
            `${getPokemonDisplayName(this.pokemon) || this.pokemon.species_name} peut apprendre une nouvelle attaque !`, {
            fontSize: `${Math.min(width, height) * 0.045}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: width * 0.9 }
        }).setOrigin(0.5);

        // Nouvelle attaque (en haut, encadré vert)
        await this.createMoveCard(this.newMove, width * 0.5, height * 0.20, width * 0.9, height * 0.15, 0x2ECC71, true);

        // NOTE: Client-side marking of offered moves has been removed — server handles persistence.
        // We do not call /api/pokemon/mark-move-seen from the client anymore to prevent client writes.

        // Attaques actuelles
        const currentY = height * 0.40;
        const cardHeight = height * 0.12;
        const spacing = height * 0.02;

        this.add.text(width * 0.5, height * 0.32, 'Remplacer par :', {
            fontSize: `${Math.min(width, height) * 0.04}px`,
            fill: '#ECF0F1',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const moveset = this.pokemon.moveset || [];

        if (moveset.length < 4) {
            // Place disponible, apprentissage direct
            this.createLearnButton(width * 0.5, height * 0.85, () => this.learnMove(null));
        } else {
            // 4 moves déjà appris, afficher pour comparaison
            for (let index = 0; index < moveset.length; index++) {
                const move = moveset[index];
                const yPos = currentY + index * (cardHeight + spacing);
                await this.createMoveCard(move, width * 0.5, yPos, width * 0.88, cardHeight, 0x34495E, false, index);
            }
        }

        // Bouton Ignorer
        this.createIgnoreButton(width * 0.5, height * 0.91);
    }

    /**
     * Crée une carte d'attaque avec stats détaillées
     */
    async createMoveCard(move, x, y, cardWidth, cardHeight, color, isNew, moveIndex = null) {
        const { width, height } = this.scale;

        // Conteneur
        const container = this.add.container(x, y);

        // Fond
        const card = this.add.graphics();
        card.fillStyle(color, 1);
        card.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);
        card.lineStyle(3, 0xFFFFFF, 0.8);
        card.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);
        container.add(card);

        // Badge NEW si nouveau
        if (isNew) {
            const badge = this.add.graphics();
            badge.fillStyle(0xF39C12, 1);
            badge.fillRoundedRect(-cardWidth / 2 + 10, -cardHeight / 2 + 10, 60, 25, 5);
            container.add(badge);
            
            const badgeText = this.add.text(-cardWidth / 2 + 40, -cardHeight / 2 + 22, 'NOUVEAU', {
                fontSize: '14px',
                fill: '#FFFFFF',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            container.add(badgeText);
        }

        // Nom de l'attaque (gauche, en gras)
        const moveNameFR = await this.getMoveName(move.name);
        const nameText = this.add.text(-cardWidth / 2 + (isNew ? 80 : 20), -cardHeight / 2 + 20, 
            (moveNameFR || move.name).toUpperCase(), {
            fontSize: `${Math.min(width, height) * 0.04}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0, 0);
        container.add(nameText);

        // Type (badge coloré)
        const typeColor = this.getTypeColor(move.type);
        const typeBg = this.add.graphics();
        const typeWidth = 70;
        const typeX = cardWidth / 2 - typeWidth - 10;
        typeBg.fillStyle(typeColor, 1);
        typeBg.fillRoundedRect(typeX - typeWidth / 2, -cardHeight / 2 + 15, typeWidth, 25, 5);
        container.add(typeBg);

        const typeText = this.add.text(typeX, -cardHeight / 2 + 27, move.type.toUpperCase(), {
            fontSize: '12px',
            fill: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        container.add(typeText);

        // Catégorie (Physique/Spécial/Statut)
        const category = move.category || 'status';
        const categoryIcon = category === 'physical' ? '⚔️' : (category === 'special' ? '✨' : '🛡️');
        const categoryLabel = category === 'physical' ? 'Physique' : (category === 'special' ? 'Spécial' : 'Statut');
        
        const categoryText = this.add.text(-cardWidth / 2 + 20, -cardHeight / 2 + 50, 
            `${categoryIcon} ${categoryLabel}`, {
            fontSize: `${Math.min(width, height) * 0.032}px`,
            fill: '#ffffffff'
            , fontStyle: 'bold'
        }).setOrigin(0, 0);
        container.add(categoryText);

        // Stats (puissance, précision, PP)
        const statsY = -cardHeight / 2 + cardHeight*0.7;
        
        // Puissance
            const powerText = this.add.text(-cardWidth / 2 + 20, statsY, 
                `💪 ${move.power || '-'}`, {
            fontSize: `${Math.min(width, height) * 0.035}px`,
            fill: move.power > 0 ? '#E74C3C' : '#95A5A6',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        container.add(powerText);

        // Précision
            const accText = this.add.text(-cardWidth / 2 + cardWidth * 0.35, statsY, 
                `🎯 ${move.accuracy || 100}%`, {
            fontSize: `${Math.min(width, height) * 0.035}px`,
            fill: '#3498DB',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        container.add(accText);

        // PP
        const ppText = this.add.text(-cardWidth / 2 + cardWidth * 0.65, statsY, 
            `PP: ${move.pp || move.maxPP || 10}`, {
            fontSize: `${Math.min(width, height) * 0.035}px`,
            fill: '#2ECC71',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5);
        container.add(ppText);

        // Si c'est un move actuel (pas nouveau), ajouter bouton "Oublier"
        if (!isNew && moveIndex !== null) {
            card.setInteractive(
                new Phaser.Geom.Rectangle(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight), 
                Phaser.Geom.Rectangle.Contains
            );

            card.on('pointerover', () => {
                card.clear();
                card.fillStyle(0x1ABC9C, 1);
                card.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);
                card.lineStyle(4, 0xFFFFFF, 1);
                card.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);
            });

            card.on('pointerout', () => {
                card.clear();
                card.fillStyle(color, 1);
                card.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);
                card.lineStyle(3, 0xFFFFFF, 0.8);
                card.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);
            });

            card.on('pointerdown', () => {
                this.learnMove(moveIndex);
            });
        }
    }

    /**
     * Couleur selon type
     */
    getTypeColor(type) {
        const colors = {
            normal: 0xA8A878, fire: 0xF08030, water: 0x6890F0, electric: 0xF8D030,
            grass: 0x78C850, ice: 0x98D8D8, fighting: 0xC03028, poison: 0xA040A0,
            ground: 0xE0C068, flying: 0xA890F0, psychic: 0xF85888, bug: 0xA8B820,
            rock: 0xB8A038, ghost: 0x705898, dragon: 0x7038F8, dark: 0x705848,
            steel: 0xB8B8D0, fairy: 0xEE99AC
        };
        return colors[type.toLowerCase()] || 0x95A5A6;
    }

    /**
     * Bouton "Apprendre" (si moins de 4 moves)
     */
    createLearnButton(x, y, callback) {
        const { width, height } = this.scale;
        const btnWidth = width * 0.6;
        const btnHeight = height * 0.06;

        const button = this.add.rectangle(x, y, btnWidth, btnHeight, 0x2ECC71);
        button.setInteractive();

        this.add.text(x, y, '✓ APPRENDRE', {
            fontSize: `${Math.min(width, height) * 0.045}px`,
            fill: '#FFFFFF',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        button.on('pointerover', () => button.setFillStyle(0x27AE60));
        button.on('pointerout', () => button.setFillStyle(0x2ECC71));
        button.on('pointerdown', () => { if (!this.isProcessing) callback(); });
    }

    /**
     * Bouton "Ignorer"
     */
    createIgnoreButton(x, y) {
        const { width, height } = this.scale;
        const btnWidth = width * 0.4;
        const btnHeight = height * 0.05;

        const button = this.add.rectangle(x, y, btnWidth, btnHeight, 0x95A5A6);
        button.setInteractive();

        this.add.text(x, y, 'NE PAS APPRENDRE', {
            fontSize: `${Math.min(width, height) * 0.035}px`,
            fill: '#FFFFFF'
        }).setOrigin(0.5);

        button.on('pointerover', () => button.setFillStyle(0x7F8C8D));
        button.on('pointerout', () => button.setFillStyle(0x95A5A6));
        button.on('pointerdown', () => { if (!this.isProcessing) this.ignoreMove(); });
    }

    /**
     * Apprendre le move (remplacer si index fourni)
     */
    async learnMove(replaceIndex) {
        if (this.isProcessing) return;
        this.isProcessing = true;
        console.log('[MoveLearn] Apprentissage move:', this.newMove.name, 'remplace:', replaceIndex);

        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';

        const frName = await this.getMoveName(this.newMove.name);

        try {
            const response = await fetch(`${apiUrl}/api/pokemon/learn-move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pokemonId: this.pokemon._id,
                    newMove: this.newMove,
                    replaceIndex: replaceIndex
                })
            });

            const data = await response.json();

            if (data.success) {
                console.log('✅ Move appris avec succès');
                // Passer le moveset mis à jour dans le callback pour garder l'UI cohérente
                if (this.onComplete) this.onComplete(true, frName, data.moveset, data.move_learned);
                this.scene.stop();
            } else {
                console.error('❌ Erreur apprentissage:', data.error);
                if (this.onComplete) this.onComplete(false, frName);
                this.scene.stop();
            }
        } catch (error) {
            console.error('[MoveLearn] Erreur:', error);
            if (this.onComplete) this.onComplete(false, frName);
            this.scene.stop();
        }
        this.isProcessing = false;
    }

    /**
     * Ignorer le nouveau move
     */
    async ignoreMove() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        console.log('[MoveLearn] Move ignoré - marquage en DB');
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
        const frName = await this.getMoveName(this.newMove.name);

        try {
            const response = await fetch(`${apiUrl}/api/pokemon/mark-move-seen`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pokemonId: this.pokemon._id, move: { name: this.newMove.name } })
            });
            const data = await response.json();
            if (data && data.success && Array.isArray(data.move_learned)) {
                // Save locally to keep UI consistent
                this.pokemon.move_learned = data.move_learned;
                if (this.onComplete) this.onComplete(false, frName, null, data.move_learned);
            } else {
                // Fallback: preserve previous local state
                if (this.onComplete) this.onComplete(false, frName, null, this.pokemon.move_learned || []);
            }
        } catch (err) {
            console.warn('[MoveLearn] mark-move-seen failed:', err.message);
            if (this.onComplete) this.onComplete(false, frName, null, this.pokemon.move_learned || []);
        }
        this.isProcessing = false;
        this.scene.stop();
    }

    /**
     * Récupérer nom FR d'un move (avec cache local)
     */
    async getMoveName(moveNameEN) {
        if (!moveNameEN) return moveNameEN;
        if (this.translationsCache && this.translationsCache[moveNameEN]) return this.translationsCache[moveNameEN];
        try {
            const backendUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
            const response = await fetch(`${backendUrl}/api/translations/move/${moveNameEN}`);
            if (response.ok) {
                const data = await response.json();
                const nameFR = data.name_fr || moveNameEN;
                if (this.translationsCache) this.translationsCache[moveNameEN] = nameFR;
                return nameFR;
            }
        } catch (e) {
            console.warn('[MoveLearnScene] Erreur traduction move:', e.message);
        }
        return moveNameEN;
    }
}

export default MoveLearnScene;
