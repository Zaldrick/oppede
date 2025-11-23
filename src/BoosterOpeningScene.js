import Phaser from "phaser";
import { loadCardImages } from "./utils/loadCardImages.js"
import { openBooster } from "./openBooster.js";
import SoundManager from './utils/SoundManager';
export class BoosterOpeningScene extends Phaser.Scene {
    constructor() {
        super("BoosterOpeningScene");
    }

    init(data) {
        this.booster = data.booster;
        this.cards = [];
        this.state = "sealed";
    }

    async preload() {
        this.load.image('boosterPack', 'assets/items/boosterPack.png');
        this.load.image('boosterArgent', 'assets/items/boosterArgent.png');
        this.load.image('boosterOr', 'assets/items/boosterOr.png');
        this.load.image('boosterP', 'assets/items/boosterP.png');
        this.load.audio('carte_captured', '/assets/sounds/cardCaptured.mp3');
        this.load.audio('booster_opening', '/assets/sounds/boosterOpenning.mp3');

        console.log("Booster reçu en preload:", this.booster);

        // Ajoute ce log pour voir la structure complète du booster
        console.log("Booster complet:", this.booster);

        // Ajoute un fallback si possibleCards n'existe pas
        if (!this.booster || !this.booster.possibleCards) {
            console.error("ERREUR: booster.possibleCards est manquant ou undefined !");
            this.booster.possibleCards = [];
            // Optionnel: tu peux fetch ici toutes les cartes si tu veux un fallback global
            // return;
        }

        if (typeof this.booster.possibleCards[0] !== "object") {
            const idsOrNames = this.booster.possibleCards;
            console.log("possibleCards à fetch:", idsOrNames);
            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/cards?names=${idsOrNames.join(",")}`);
            const cardsData = await response.json();
            console.log("Cartes fetch depuis l'API:", cardsData);
            this.booster.possibleCards = cardsData;
        }
        loadCardImages(this, this.cards);
    }

    create() {
        // Fond noir transparent pour masquer l'ancienne scène
        this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            this.cameras.main.width,
            this.cameras.main.height,
            0x000000,
            0.55 // opacité à ajuster selon ton goût
        ).setDepth(-10);

        // Limite la taille d'affichage du boosterPack
        const maxWidth = this.cameras.main.width * 0.35;
        const maxHeight = this.cameras.main.height * 0.5;
        let boosterImageKey = 'boosterPack'; // valeur par défaut

        if (this.booster && this.booster.image) {
            const imageMapping = {
                'boosterPack.png': 'boosterPack',
                'boosterArgent.png': 'boosterArgent',
                'boosterOr.png': 'boosterOr',
                'boosterP.png': 'boosterP'
            };

            boosterImageKey = imageMapping[this.booster.image] || 'boosterPack';
        }

        const boosterImg = this.add.image(this.cameras.main.centerX, this.cameras.main.centerY, boosterImageKey);
        const tex = this.textures.get(boosterImageKey).getSourceImage();
        if (tex) {
            const scaleX = maxWidth / tex.width;
            const scaleY = maxHeight / tex.height;
            const scale = Math.min(scaleX, scaleY, 1);
            boosterImg.setScale(scale);
        }

        // Glisser de gauche à droite pour ouvrir, avec feedback visuel
        let dragStartX = null;
        let dragDelta = 0;
        let dragActive = false;
        let boosterOpened = false; // Ajout d'un flag pour bloquer le drag après ouverture
        const openThreshold = boosterImg.displayWidth / 2;

        const instructionText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY + 180,
            "Glisse vers la droite pour ouvrir !",
            { font: "28px 'Press Start 2P', monospace", fill: "#fff" }
        ).setOrigin(0.5);

        const boosterTop = this.add.image(this.cameras.main.centerX, this.cameras.main.centerY - boosterImg.height / 4, 'boosterPack')
            .setCrop(0, 0, boosterImg.width, boosterImg.height / 2)
            .setOrigin(0.5, 1)
            .setVisible(false);
        const boosterBottom = this.add.image(this.cameras.main.centerX, this.cameras.main.centerY + boosterImg.height / 4, 'boosterPack')
            .setCrop(0, boosterImg.height / 2, boosterImg.width, boosterImg.height / 2)
            .setOrigin(0.5, 0)
            .setVisible(false);

        if (tex) {
            const scaleX = maxWidth / tex.width;
            const scaleY = maxHeight / tex.height;
            const scale = Math.min(scaleX, scaleY, 1);
            boosterTop.setScale(scale);
            boosterBottom.setScale(scale);
        }

        let trailGraphics = this.add.graphics();
        let lastTrailX = null;

        boosterImg.setInteractive({ draggable: true });

        this.input.on('pointerdown', (pointer) => {
            if (boosterOpened) return;
            if (!boosterImg.getBounds().contains(pointer.x, pointer.y)) return;
            dragStartX = pointer.x;
            dragDelta = 0;
            dragActive = true;
            trailGraphics.clear();
            lastTrailX = pointer.x;
        });

        this.input.on('pointermove', (pointer) => {
            if (!dragActive || boosterOpened) return;
            dragDelta = pointer.x - dragStartX;
            if (lastTrailX !== null) {
                trailGraphics.lineStyle(10, 0xffff88, 0.7);
                trailGraphics.beginPath();
                trailGraphics.moveTo(lastTrailX, pointer.y);
                trailGraphics.lineTo(pointer.x, pointer.y);
                trailGraphics.strokePath();
                trailGraphics.closePath();
            }
            lastTrailX = pointer.x;
        });

        try { this.soundManager = new SoundManager(this); } catch (e) { this.soundManager = null; }
        this.input.on('pointerup', () => {
            if (!dragActive || boosterOpened) return;
            dragActive = false;
            lastTrailX = null;
            this.tweens.add({
                targets: trailGraphics,
                alpha: 0,
                duration: 200,
                onComplete: () => trailGraphics.clear() && trailGraphics.setAlpha(1)
            });
            if (dragDelta > openThreshold) {
                boosterOpened = true;
                try { if (this.soundManager) this.soundManager.playMoveSound('booster_opening', { volume: 0.9 }); else this.sound.play('booster_opening'); } catch (e) { /* ignore */ }
                const flash = this.add.rectangle(
                    this.cameras.main.centerX,
                    this.cameras.main.centerY,
                    this.cameras.main.width,
                    this.cameras.main.height,
                    0xffffff,
                    1
                ).setAlpha(0);
                this.tweens.add({
                    targets: flash,
                    alpha: 0.8,
                    duration: 80,
                    yoyo: true,
                    hold: 40,
                    onYoyo: () => {
                        boosterImg.setVisible(false);
                        boosterTop.destroy();
                        boosterBottom.destroy();
                        instructionText.destroy();
                        trailGraphics.destroy();
                    },
                    onComplete: () => {
                        flash.destroy();
                        this.startReveal();
                    }
                });
            }
        });
    }

    getOptimalFontSize(text, maxWidth, baseFontSize = 60, minFontSize = 25) {
        const charWidth = baseFontSize * 0.6;
        const estimatedWidth = text.length * charWidth;

        if (estimatedWidth <= maxWidth) {
            return baseFontSize;
        }

        const ratio = maxWidth / estimatedWidth;
        return Math.max(Math.floor(baseFontSize * ratio), minFontSize);
    }

    async startReveal() {
        this.state = "revealing";

        try {
            const playerPseudo = this.registry.get("playerPseudo");
            if (!playerPseudo) {
                console.error("Impossible de trouver le pseudo du joueur dans le registry");
                this.displayError("Erreur: Pseudo du joueur manquant");
                return;
            }

            console.log("🎯 Pseudo du joueur:", playerPseudo);

            const playerResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/players/${playerPseudo}`);
            if (!playerResponse.ok) {
                console.error("Erreur lors de la récupération des données du joueur");
                this.displayError("Erreur: Impossible de récupérer les données du joueur");
                return;
            }

            const playerData = await playerResponse.json();
            console.log("🎯 Données du joueur récupérées:", playerData);

            if (!this.booster || !this.booster.item_id) {
                console.error("Impossible de trouver l'item_id du booster");
                console.log("🎯 Booster actuel:", this.booster);
                this.displayError("Erreur: Données du booster manquantes");
                return;
            }

            const playerId = playerData._id;
            const boosterItemId = this.booster.item_id;

            console.log("🎯 Données à envoyer à l'API:");
            console.log("  - playerId:", playerId, "type:", typeof playerId);
            console.log("  - boosterItemId:", boosterItemId, "type:", typeof boosterItemId);

            const serverCards = await openBooster(playerId, boosterItemId);

            console.log("🎯 Cartes reçues du serveur:", serverCards);

            this.cards = serverCards;

            this.notifyCardsReceived();

        } catch (error) {
            console.error("❌ Erreur lors de l'ouverture du booster:", error);
            this.displayError("Erreur lors de l'ouverture du booster: " + error.message);
            return;
        }

        this.revealIdx = 0;
        this.revealStack = [];
        this.revealCard();
    }

    notifyCardsReceived() {
        console.log('[BoosterOpeningScene] Notification des cartes reçues:', this.cards);

        this.events.emit('booster:cardsReceived', {
            cards: this.cards
        });

        this.game.events.emit('cards:added', this.cards);
        this.game.events.emit('inventory:update');

        console.log('[BoosterOpeningScene] Événements de cartes émis pour', this.cards.length, 'cartes');
    }

    displayError(message) {
        const errorText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            message,
            { font: "24px Arial", fill: "#ff0000", align: "center" }
        ).setOrigin(0.5);

        const returnBtn = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY + 100,
            "Retour",
            { font: "18px Arial", fill: "#fff", backgroundColor: "#333", padding: { x: 10, y: 5 } }
        ).setOrigin(0.5).setInteractive();

        returnBtn.on('pointerup', () => {
            this.scene.stop();
            if (this.scene.isPaused("InventoryScene")) {
                this.scene.resume("InventoryScene");
            } else {
                this.scene.resume("GameScene");
            }
        });
    }

    revealCard() {
        this.revealStack.forEach(obj => obj.destroy && obj.destroy());
        this.revealStack = [];

        if (this.revealIdx >= this.cards.length) {
            this.showRecap();
            return;
        }

        const cardCheck = this.cards[this.revealIdx];
        if (!cardCheck || !cardCheck.image) {
            console.error("Carte invalide ou sans image :", cardCheck, "à l'index", this.revealIdx);
            this.showRecap();
            return;
        }

        const card = this.cards[this.revealIdx];
        const texture = this.textures.get(`item_${card.image}`);
        let realWidth = 100, realHeight = 150;
        if (texture && texture.getSourceImage()) {
            realWidth = texture.getSourceImage().width;
            realHeight = texture.getSourceImage().height;
        }

        const maxCardWidth = this.cameras.main.width * 0.6;
        const maxCardHeight = this.cameras.main.height * 0.7;
        let scale = 1;
        if (realWidth && realHeight) {
            const scaleW = maxCardWidth / realWidth;
            const scaleH = maxCardHeight / realHeight;
            scale = Math.min(scaleW, scaleH, 1);
        }

        const stackOffset = 40;
        const stackScale = 0.8;
        for (let i = this.cards.length - 1; i > this.revealIdx; i--) {
            const stackImg = this.add.image(
                this.cameras.main.centerX + (i - this.revealIdx),
                this.cameras.main.centerY - (i - this.revealIdx) * stackOffset,
                `item_${this.cards[i].image}`
            )
                .setScale(scale * stackScale)
                .setAlpha(1);
            this.revealStack.push(stackImg);
        }

        const mainImg = this.add.image(this.cameras.main.centerX, this.cameras.main.centerY, `item_${card.image}`)
            .setScale(scale)
            .setAlpha(0);
        this.revealStack.push(mainImg);

        const thumbWidth = 230;
        const thumbHeight = thumbWidth * 1.5;
        const x = this.cameras.main.centerX;
        const y = this.cameras.main.centerY;
        const valueFont = `50px Press Start 2P`;
        const valUp = this.add.text(x * 1.38, y * 1.25 - thumbHeight / 10 + 26, card.powerUp, {
            font: valueFont, fill: "#ccc", stroke: "#000", strokeThickness: 5
        }).setOrigin(0.5, 1).setAlpha(0);
        const valDown = this.add.text(x * 1.38, y * 1.25 + thumbHeight / 10 - 26, card.powerDown, {
            font: valueFont, fill: "#ccc", stroke: "#000", strokeThickness: 5
        }).setOrigin(0.5, 0).setAlpha(0);
        const valLeft = this.add.text(x * 1.38 - thumbWidth / 10 + 10, y * 1.25, card.powerLeft, {
            font: valueFont, fill: "#ccc", stroke: "#000", strokeThickness: 5
        }).setOrigin(1, 0.5).setAlpha(0);
        const valRight = this.add.text(x * 1.38 + thumbWidth / 10 - 10, y * 1.25, card.powerRight, {
            font: valueFont, fill: "#ccc", stroke: "#000", strokeThickness: 5
        }).setOrigin(0, 0.5).setAlpha(0);

        this.revealStack.push(valUp, valDown, valLeft, valRight);

        const cardName = card.nom || "???";
        const maxNameWidth = this.cameras.main.width * 0.9;
        const fontSize = this.getOptimalFontSize(cardName, maxNameWidth);

        const nameText = this.add.text(
            this.cameras.main.centerX,
            y * 1.7,
            cardName,
            {
                font: `${fontSize}px 'Press Start 2P', monospace`,
                fill: "#fff",
                stroke: "#000",
                strokeThickness: Math.max(fontSize * 0.3, 8),
                padding: { x: 10, y: 5 },
                wordWrap: { width: maxNameWidth, useAdvancedWrap: true }
            }
        ).setOrigin(0.5);
        nameText.setAlpha(0);
        this.revealStack.push(nameText);

        this.tweens.add({
            targets: mainImg,
            alpha: 1,
            scale: scale * 1.1,
            duration: 350,
            ease: 'Back.Out',
                    onStart: () => {
                        try { if (this.soundManager) this.soundManager.playMoveSound('carte_captured', { volume: 0.95 }); else this.sound.play('carte_captured'); } catch (e) { /* ignore */ }
                    }
        });
        this.tweens.add({
            targets: [valUp, valDown, valLeft, valRight],
            alpha: 1,
            duration: 350,
            delay: 150,
            ease: 'Cubic.easeOut'
        });
        this.tweens.add({
            targets: nameText,
            alpha: 1,
            duration: 350,
            delay: 200,
            ease: 'Cubic.easeOut'
        });

        this.input.once('pointerup', () => {
            this.tweens.add({
                targets: [mainImg, nameText, valUp, valDown, valLeft, valRight],
                alpha: 0,
                scale: 0.7,
                duration: 250,
                ease: 'Cubic.easeIn',
                onComplete: () => {
                    this.revealIdx++;
                    this.revealCard();
                }
            });
        }, this);
    }

    showRecap() {
        this.state = "recap";
        this.revealStack.forEach(obj => obj.destroy && obj.destroy());
        this.revealStack = [];

        const recapBg = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            420, 340, 0x222222, 0.95
        );
        const recapText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY - 120,
            "Cartes obtenues :",
            { font: "28px Arial", fill: "#fff" }
        ).setOrigin(0.5);

        const startY = this.cameras.main.centerY - 60;

        const recapWidth = 420;
        const recapHeight = 340;
        const margin = 24;
        const cardsPerRow = 5;
        const rows = Math.ceil(this.cards.length / cardsPerRow);

        const availableWidth = recapWidth - margin * 2;
        const availableHeight = recapHeight - 120 - margin;
        const cardSpacing = availableWidth / cardsPerRow;
        const rowSpacing = availableHeight / rows;
        const maxCardWidth = Math.min(cardSpacing * 0.85, 80);
        const maxCardHeight = Math.min(rowSpacing * 0.7, 120);

        this.cards.forEach((card, i) => {
            const row = Math.floor(i / cardsPerRow);
            const col = i % cardsPerRow;
            const x = this.cameras.main.centerX - (availableWidth / 2) + cardSpacing / 2 + col * cardSpacing;
            const y = startY + row * rowSpacing;

            let scale = 1;
            const texture = this.textures.get(`item_${card.image}`);
            if (texture && texture.getSourceImage()) {
                const w = texture.getSourceImage().width;
                const h = texture.getSourceImage().height;
                const scaleW = maxCardWidth / w;
                const scaleH = maxCardHeight / h;
                scale = Math.min(scaleW, scaleH, 1);
            }

            this.add.image(x, y, `item_${card.image}`).setScale(scale);
            const cardName = card.nom || "???";
            const maxNameWidth = cardSpacing * 0.9;
            const recapFontSize = this.getOptimalFontSize(cardName, maxNameWidth, 15, 12);

            this.add.text(x, y + maxCardHeight / 2 + 10, cardName, {
                font: `${recapFontSize}px Arial`,
                fill: "#fff",
                wordWrap: { width: maxNameWidth, useAdvancedWrap: true }
            }).setOrigin(0.5);
        });

        const continueBtn = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY + 140,
            "Appuie pour continuer",
            { font: "24px Arial", fill: "#fff", backgroundColor: "#333", padding: { x: 10, y: 5 } }
        ).setOrigin(0.5).setInteractive();

        continueBtn.on('pointerup', async () => {
            this.game.events.emit('inventory:update');

            const inventoryScene = this.scene.get("InventoryScene");
            if (inventoryScene && typeof inventoryScene.reloadInventory === "function") {
                await inventoryScene.reloadInventory();
                // await inventoryScene.ensureInventoryImagesLoaded(); // Removed: DOM-based inventory handles images automatically
                inventoryScene.drawInventory();
            }

            this.scene.stop();
            if (this.scene.isPaused("InventoryScene")) {
                this.scene.resume("InventoryScene");
            } else {
                this.scene.resume("GameScene");
            }
        });
    }

    addCardsToInventory() {
        // ... logique existante d'ajout de cartes ...
        
        // ✅ NOUVEAU : Émettre l'événement pour notifier les autres scènes
        this.events.emit('booster:cardsReceived', { 
            cards: this.receivedCards // ou la variable contenant les cartes reçues
        });
        
        // ✅ NOUVEAU : Émettre un événement global
        this.game.events.emit('cards:added', this.receivedCards);
        this.game.events.emit('inventory:update');
        
        console.log('[BoosterOpeningScene] Événements de cartes émis');
    }

    shutdown() {
        // ✅ NOUVEAU : S'assurer que l'inventaire est mis à jour
        this.game.events.emit('inventory:update');
        
        // Logique de fermeture existante...
    }
}

export default BoosterOpeningScene;