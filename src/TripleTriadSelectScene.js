import Phaser from "phaser";

async function getPlayerCards(playerId) {
    const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:5000";
    const res = await fetch(`${apiUrl}/api/cards/${playerId}`);
    if (!res.ok) throw new Error('Erreur API');
    return await res.json();
}

export class TripleTriadSelectScene extends Phaser.Scene {

    preload() {
        this.load.image('ifrit', 'assets/cards/ifrit.png');
        this.load.image('shiva', 'assets/cards/shiva.png');
        this.load.image('odin', 'assets/cards/odin.png');
        this.load.image('chocobo', 'assets/cards/chocobo.png');
        this.load.image('sephiroth', 'assets/cards/sephiroth.png');
        this.load.image('bahamut', 'assets/cards/bahamut.png');
        // Ajoute toutes tes cartes ici
    }

    constructor() {
        super("TripleTriadSelectScene");
        this.playerId = null;
        this.selected = [];
        this.cards = [];
        this.focusedCardIdx = 0;
        this.cardsPerPage = 3;
        this.dragStartX = null;
        this.dragOffset = 0;
    }

    init(data) {
        this.playerId = data.playerId;
        const previousSelection = this.registry.get("tripleTriadSelection");
        this.selected = Array.isArray(previousSelection) ? [...previousSelection] : [];
        this.cards = [];
        this.focusedCardIdx = 0;
        this.dragOffset = 0;
    }

    async create() {
        const { width, height } = this.sys.game.canvas;
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.95);

        this.cards = await getPlayerCards(this.playerId);
        this.focusedCardIdx = 0;
        this.dragOffset = 0;
        this.drawUI();
    }

drawUI() {
    const { width, height } = this.sys.game.canvas;
    this.container && this.container.destroy();
    this.container = this.add.container(0, 0);

    // --- Titre ---
    this.container.add(
        this.add.text(width / 2, 36, "Choisis tes 5 cartes", {
            font: `${Math.round(width * 0.045)}px Arial`,
            fill: "#fff",
            fontStyle: "bold"
        }).setOrigin(0.5)
    );

    // --- Carrousel ---
    const thumbWidth = Math.min(40, (width - 40) / 10);
    const thumbHeight = thumbWidth * 1.5;
    const margin = 12;
    const carouselY = 90;
    const cardSpan = thumbWidth + margin;
    const visibleCount = Math.min(10, this.cards.length);
    const startX = width / 2 - (cardSpan * visibleCount - margin) / 2;

    const carouselBg = this.add.rectangle(width / 2, carouselY, width - 40, thumbHeight + 24, 0x222244, 0.92)
        .setOrigin(0.5)
        .setStrokeStyle(2, 0xffffff);
    this.container.add(carouselBg);

    this.carouselSprites = [];
    this.cards.forEach((card, idx) => {
        const x = startX + idx * cardSpan;
        const y = carouselY;
        const thumb = this.add.image(x, y, card.image)
            .setDisplaySize(thumbWidth, thumbHeight)
            .setInteractive({ draggable: false })
            .setAlpha(this.focusedCardIdx === idx ? 1 : 0.7);



        thumb.on('pointerup', () => {
            this.focusedCardIdx = idx;
            this.drawUI();
        });

        if (this.selected.includes(card._id.toString())) {
            const border = this.add.rectangle(x, y, thumbWidth + 6, thumbHeight + 6, 0x00ff00, 0.18)
                .setStrokeStyle(2, 0x00ff00);
            this.container.add(border);
        }

        this.carouselSprites.push(thumb);
        this.container.add(thumb);
                // Affichage des valeurs sur la miniature
        const valueFont = `${Math.round(thumbWidth * 0.38)}px Arial`;
        // Haut
        this.container.add(this.add.text(x, y - thumbHeight / 2 + 12, card.powerUp, {
            font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 5
        }).setOrigin(0.5, 1));
        // Bas
        this.container.add(this.add.text(x, y + thumbHeight / 2 - 12, card.powerDown, {
            font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 5
        }).setOrigin(0.5, 0));
        // Gauche
        this.container.add(this.add.text(x - thumbWidth / 2 + 10, y, card.powerLeft, {
            font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 5
        }).setOrigin(1, 0.5));
        // Droite
        this.container.add(this.add.text(x + thumbWidth / 2 - 10, y, card.powerRight, {
            font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 5
        }).setOrigin(0, 0.5));
    });

    // --- Zone détail (row) ---
    const detailZoneTop = carouselY + thumbHeight * 1.5;
    const detailZoneHeight = Math.min(220, height * 0.35);
    const detailImgW = Math.min(120, width * 0.28);
    const detailImgH = detailImgW * 1.5;
    const detailImgX = width * 0.18;
    const detailImgY = detailZoneTop + detailZoneHeight / 2;

    const descX = width * 0.36;
    const descY = detailZoneTop;

    const card = this.cards[this.focusedCardIdx];
    if (card) {
        const isSelected = this.selected.includes(card._id.toString());
        // Carte zoomée à gauche
        const cardImg = this.add.image(detailImgX, detailImgY, card.image)
            .setDisplaySize(detailImgW, detailImgH)
            .setOrigin(0.5)
            .setAlpha(isSelected ? 0.5 : 1)
            .setInteractive()
            .on('pointerdown', () => this.toggleCard(card._id.toString()));
        this.container.add(cardImg);
        // ...carte zoomée...
        const statsBoxW = detailImgW * 0.5;
        const statsBoxH = detailImgH / 3;
        const statsBoxX = detailImgX + detailImgW / 1.230 - statsBoxW / 2 - 8;
        const statsBoxY = detailImgY + detailImgH / 1.40 - statsBoxH / 2 - 8;

        // Carré semi-transparent
        const statsBg = this.add.rectangle(
            statsBoxX, statsBoxY, statsBoxW, statsBoxH, 0x222244, 0.00
        ).setOrigin(1, 1);
        this.container.add(statsBg);

        const statFont = `${Math.round(statsBoxH * 0.38)}px Arial`;
        // Coordonnées du centre du carré
        const centerX = statsBoxX - statsBoxW / 2;
        const centerY = statsBoxY - statsBoxH / 2;
        // Haut
        // Placement des chiffres dans le carré (style Triple Triad)
        this.container.add(this.add.text(centerX, centerY - statsBoxH / 2 + 2, card.powerUp, {
            font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 3
        }).setOrigin(0.5, 0)); // Haut

        this.container.add(this.add.text(centerX, centerY + statsBoxH / 2 - 2, card.powerDown, {
            font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 3
        }).setOrigin(0.5, 1)); // Bas

        this.container.add(this.add.text(centerX - statsBoxW / 3 + 10, centerY, card.powerLeft, {
            font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 3
        }).setOrigin(1, 0.5)); // Gauche

        this.container.add(this.add.text(centerX + statsBoxW / 3 - 10, centerY, card.powerRight, {
            font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 3
        }).setOrigin(0, 0.5)); // Droite

        const maxStars = 5;
        const filledStar = "★";
        const emptyStar = "☆";
        const rarity = Math.max(1, Math.min(card.rarity, maxStars)); // clamp entre 1 et 5
        const stars = filledStar.repeat(rarity) + emptyStar.repeat(maxStars - rarity);

        // ...après le calcul de stars...
        // Affiche le nom
        this.container.add(this.add.text(descX, detailZoneTop, card.nom, {
            font: `${Math.round(width * 0.1)}px Arial`,
            fill: "#fff"
        }).setOrigin(0, 0));

        // Affiche les étoiles (plus grosses)
        this.container.add(this.add.text(descX, detailZoneTop + 36, stars, {
            font: `${Math.round(width * 0.08)}px Arial`, // Taille augmentée
            fill: "#ffd700",
            stroke: "#000",
            strokeThickness: 4
        }).setOrigin(0, 0));

        // Affiche la description en dessous
        this.container.add(this.add.text(descX, detailZoneTop + 36 + Math.round(width * 0.07) + 8, card.description || "", {
            font: `${Math.round(width * 0.035)}px Arial`,
            fill: "#fff",
            wordWrap: { width: width * 0.5 }
        }).setOrigin(0, 0));


        // Bouton sous la description, jamais hors écran
        const selectBtn = this.add.text(descX, detailZoneTop + 150,
            isSelected ? "Retirer de la sélection" : "Ajouter à la sélection",
            {
                font: `${Math.round(width * 0.045)}px Arial`,
                fill: isSelected ? "#f00" : "#0f0",
                backgroundColor: "#222"
            })
            .setOrigin(0, 0)
            .setPadding(14, 8, 14, 8)
            .setInteractive()
            .on('pointerdown', () => this.toggleCard(card._id.toString()));
        this.container.add(selectBtn);
    }

    // --- Zone sélection en bas ---
    const selY = height - 210;
    const selThumbW = Math.min(48, (width - 60) / 5);
    const selThumbH = selThumbW * 1.5;
    const selStartX = width / 2 - ((selThumbW + 10) * 5 - 10) / 2;

    const selBg = this.add.rectangle(width / 2, selY, width - 40, selThumbH + 32, 0x333333, 0.92)
        .setOrigin(0.5)
        .setStrokeStyle(2, 0xffffff);
    this.container.add(selBg);

    this.selected.forEach((cardId, i) => {
        const card = this.cards.find(c => c._id.toString() === cardId);
        if (!card) return;
        const x = selStartX + i * (selThumbW + 10);
        const y = selY;
        const thumb = this.add.image(x, y, card.image)
            .setDisplaySize(selThumbW, selThumbH)
            .setInteractive()
            .setAlpha(1)
            .on('pointerdown', () => {
                this.focusedCardIdx = this.cards.findIndex(c => c._id.toString() === cardId);
                this.drawUI();
            })
            .on('pointerup', () => {
                if (this.focusedCardIdx === this.cards.findIndex(c => c._id.toString() === cardId)) {
                    this.selected = this.selected.filter(id => id !== cardId);
                    this.registry.set("tripleTriadSelection", this.selected);
                    this.drawUI();
                }
            });
        this.container.add(thumb);
                const valueFont = `${Math.round(thumbWidth * 0.38)}px Arial`;
        // Haut
        this.container.add(this.add.text(x, y - thumbHeight / 2 + 12, card.powerUp, {
            font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 5
        }).setOrigin(0.5, 1));
        // Bas
        this.container.add(this.add.text(x, y + thumbHeight / 2 - 12, card.powerDown, {
            font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 5
        }).setOrigin(0.5, 0));
        // Gauche
        this.container.add(this.add.text(x - thumbWidth / 2 + 10, y, card.powerLeft, {
            font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 5
        }).setOrigin(1, 0.5));
        // Droite
        this.container.add(this.add.text(x + thumbWidth / 2 - 10, y, card.powerRight, {
            font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 5
        }).setOrigin(0, 0.5));
    });

    // --- Bouton Valider ---
    this.validateBtn = this.add.text(width / 2, height - 90, "Valider", {
        font: `${Math.round(width * 0.05)}px Arial`,
        fill: "#fff",
        backgroundColor: this.selected.length === 5 ? "#0f0" : "#555"
    })
        .setOrigin(0.5)
        .setPadding(18, 10, 18, 10)
        .setInteractive()
        .on('pointerdown', () => this.validate())
        .setAlpha(this.selected.length === 5 ? 1 : 0.5);
    this.container.add(this.validateBtn);
}

    updateCarouselSprites(startX, cardSpan, carouselY, thumbWidth, thumbHeight) {
        this.carouselSprites.forEach((thumb, idx) => {
            thumb.x = startX + idx * cardSpan + this.dragOffset;
            thumb.y = carouselY;
            thumb.setAlpha(this.focusedCardIdx === idx ? 1 : 0.7);
        });
    }
    toggleCard(cardId) {
        const focusedCard = this.cards[this.focusedCardIdx];
        if (focusedCard._id.toString() !== cardId) {
            this.focusedCardIdx = this.cards.findIndex(c => c._id.toString() === cardId);
            this.drawUI();
            return;
        }
        if (this.selected.includes(cardId)) {
            this.selected = this.selected.filter(id => id !== cardId);
        } else if (this.selected.length < 5) {
            this.selected.push(cardId);
        }
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