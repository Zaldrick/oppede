import Phaser from "phaser";

async function getPlayerCards(playerId) {
    const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:5000";
    const res = await fetch(`${apiUrl}/api/cards/${playerId}`);
    if (!res.ok) throw new Error('Erreur API');
    return await res.json();
}

export class TripleTriadSelectScene extends Phaser.Scene {
    constructor() {
        super("TripleTriadSelectScene");
        this.playerId = null;
        this.selected = [];
        this.cards = [];
        this.focusedCardIdx = 0;
        this.cardSprites = [];
        this.cardsPerPage = 3; 
    }

    init(data) {
        this.playerId = data.playerId;
        const previousSelection = this.registry.get("tripleTriadSelection");
        this.selected = Array.isArray(previousSelection) ? [...previousSelection] : [];
        this.cards = [];
        this.focusedCardIdx = 0;
    }

    async create() {
        const { width, height } = this.sys.game.canvas;
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85);

        this.cards = await getPlayerCards(this.playerId);
        this.focusedCardIdx = 0;
        this.drawUI();
    }

    drawUI() {
        const { width, height } = this.sys.game.canvas;
        this.container && this.container.destroy();
        this.container = this.add.container(0, 0);

        // Titre
        this.container.add(
            this.add.text(width / 2, 30, "Choisis tes 5 cartes", {
                font: `${Math.round(width * 0.045)}px Arial`,
                fill: "#fff"
            }).setOrigin(0.5)
        );

        // Carrousel horizontal (miniatures)
        this.carouselSprites = [];
        const thumbWidth = Math.min(70, (width - 40) / this.cardsPerPage);
        const thumbHeight = thumbWidth * 1.5;
        const margin = 12;
        const carouselY = 120;
        const startX = width / 2 - ((thumbWidth + margin) * Math.min(this.cards.length, 6) - margin) / 2;

        this.cards.forEach((card, idx) => {
            const x = startX + idx * (thumbWidth + margin);
            const y = carouselY;

            const thumb = this.add.image(x, y, card.image)
                .setDisplaySize(thumbWidth, thumbHeight)
                .setInteractive()
                .setAlpha(this.focusedCardIdx === idx ? 1 : 0.7)
                .on('pointerdown', () => this.focusCard(idx));

            // Ajoute un contour si sélectionné
            if (this.selected.includes(card._id.toString())) {
                const border = this.add.rectangle(x, y, thumbWidth + 8, thumbHeight + 8, 0x00ff00, 0.3)
                    .setStrokeStyle(3, 0x00ff00);
                this.container.add(border);
            }

            this.carouselSprites.push(thumb);
            this.container.add(thumb);
        });

        // Affichage de la carte zoomée en bas
        this.drawFocusedCard(width, height);

        // Affichage sélection
        this.selectedZone = this.add.text(width / 2, height - 120, `Main sélectionnée (${this.selected.length}/5)`, {
            font: `${Math.round(width * 0.035)}px Arial`,
            fill: "#fff"
        }).setOrigin(0.5);
        this.container.add(this.selectedZone);

        // Bouton Valider
        this.validateBtn = this.add.text(width / 2 + 100, height - 60, "Valider", {
            font: `${Math.round(width * 0.04)}px Arial`,
            fill: "#0f0",
            backgroundColor: "#222"
        })
            .setOrigin(0.5)
            .setPadding(10, 5, 10, 5)
            .setInteractive()
            .on('pointerdown', () => this.validate())
            .setAlpha(this.selected.length === 5 ? 1 : 0.5);
        this.container.add(this.validateBtn);

        // Bouton Annuler
        this.cancelBtn = this.add.text(width / 2 - 100, height - 60, "Annuler", {
            font: `${Math.round(width * 0.04)}px Arial`,
            fill: "#f00",
            backgroundColor: "#222"
        })
            .setOrigin(0.5)
            .setPadding(10, 5, 10, 5)
            .setInteractive()
            .on('pointerdown', () => this.close());
        this.container.add(this.cancelBtn);
    }

    drawFocusedCard(width, height) {
        // Nettoie l'ancienne carte zoomée
        if (this.focusedCardContainer) this.focusedCardContainer.destroy();
        this.focusedCardContainer = this.add.container(0, 0);
        this.container.add(this.focusedCardContainer);

        if (!this.cards.length) return;
        const card = this.cards[this.focusedCardIdx];
        const isSelected = this.selected.includes(card._id.toString());

        // Carte zoomée
        const zoomWidth = Math.min(180, width * 0.4);
        const zoomHeight = zoomWidth * 1.5;
        const zoomX = width / 2;
        const zoomY = height / 2 + 40;

        const cardImg = this.add.image(zoomX, zoomY, card.image)
            .setDisplaySize(zoomWidth, zoomHeight)
            .setInteractive()
            .setAlpha(isSelected ? 0.5 : 1)
            .on('pointerdown', () => this.toggleCard(card._id.toString(), cardImg));

        // Nom
        const nameText = this.add.text(zoomX, zoomY - zoomHeight / 2 - 30, card.nom, {
            font: `${Math.round(width * 0.045)}px Arial`,
            fill: "#fff"
        }).setOrigin(0.5);

        // Description
        const descText = this.add.text(zoomX, zoomY + zoomHeight / 2 + 10, card.description, {
            font: `${Math.round(width * 0.03)}px Arial`,
            fill: "#fff",
            wordWrap: { width: width * 0.7 }
        }).setOrigin(0.5, 0);

        // Rareté, stats, etc. (optionnel)
        const statsText = this.add.text(zoomX, zoomY + zoomHeight / 2 + 50,
            `Rareté: ${card.rarity} | Haut: ${card.powerUp} | Bas: ${card.powerDown} | Gauche: ${card.powerLeft} | Droite: ${card.powerRight}`,
            {
                font: `${Math.round(width * 0.025)}px Arial`,
                fill: "#aaa"
            }).setOrigin(0.5, 0);

        this.focusedCardContainer.add([cardImg, nameText, descText, statsText]);
    }

    focusCard(idx) {
        this.focusedCardIdx = idx;
        this.drawUI();
    }

    toggleCard(cardId, cardImg) {
        // Si la carte n'est pas focus, on la focus seulement
        const focusedCard = this.cards[this.focusedCardIdx];
        if (focusedCard._id.toString() !== cardId) {
            this.focusCard(this.cards.findIndex(c => c._id.toString() === cardId));
            return;
        }
        // Si déjà focus, on sélectionne/désélectionne
        if (this.selected.includes(cardId)) {
            this.selected = this.selected.filter(id => id !== cardId);
            cardImg.setAlpha(1);
        } else if (this.selected.length < 5) {
            this.selected.push(cardId);
            cardImg.setAlpha(0.5);
        }
        // Mets à jour l'affichage
        this.registry.set("tripleTriadSelection", this.selected);
        this.drawUI();
    }

    validate() {
        if (this.selected.length === 5) {
            this.registry.set("tripleTriadSelection", this.selected);
            this.scene.stop();
            this.scene.resume("GameScene");
        }
    }

    close() {
        this.scene.stop();
        this.scene.resume("GameScene");
    }
}