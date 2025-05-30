import Phaser from "phaser";
import { loadCardImages } from "./utils/loadCardImages.js";
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
        const boosterImg = this.add.image(this.cameras.main.centerX, this.cameras.main.centerY, 'boosterPack');
        const tex = this.textures.get('boosterPack').getSourceImage();
        if (tex) {
            const scaleX = maxWidth / tex.width;
            const scaleY = maxHeight / tex.height;
            const scale = Math.min(scaleX, scaleY, 1);
            boosterImg.setScale(scale);
        }

        console.log("Cartes possibles en create:", this.booster.possibleCards);
        this.cards = this.generateBoosterCards(this.booster);
        console.log("Cartes tirées pour le booster:", this.cards);

        // Glisser de gauche à droite pour ouvrir, avec feedback visuel
        let dragStartX = null;
        let dragDelta = 0;
        let dragActive = false;
        let boosterOpened = false; // Ajout d'un flag pour bloquer le drag après ouverture
        // Seuil dynamique : la moitié de la largeur de l'image
        const openThreshold = boosterImg.displayWidth / 2;

        const instructionText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY + 180,
            "Glisse vers la droite pour ouvrir !",
            { font:  "28px 'Press Start 2P', monospace", fill: "#fff" }
        ).setOrigin(0.5);

        // Découpe le booster en deux moitiés (haut et bas)
        const boosterTop = this.add.image(this.cameras.main.centerX, this.cameras.main.centerY - boosterImg.height / 4, 'boosterPack')
            .setCrop(0, 0, boosterImg.width, boosterImg.height / 2)
            .setOrigin(0.5, 1)
            .setVisible(false);
        const boosterBottom = this.add.image(this.cameras.main.centerX, this.cameras.main.centerY + boosterImg.height / 4, 'boosterPack')
            .setCrop(0, boosterImg.height / 2, boosterImg.width, boosterImg.height / 2)
            .setOrigin(0.5, 0)
            .setVisible(false);

        // Scale les moitiés comme l'image principale
        if (tex) {
            const scaleX = maxWidth / tex.width;
            const scaleY = maxHeight / tex.height;
            const scale = Math.min(scaleX, scaleY, 1);
            boosterTop.setScale(scale);
            boosterBottom.setScale(scale);
        }

        // Traînée lumineuse
        let trailGraphics = this.add.graphics();
        let lastTrailX = null;

        boosterImg.setInteractive({ draggable: true });

        // Correction : pointermove/pointerup doivent être sur this.input, pas boosterImg
        // Sinon, si le curseur sort de l'image, tu ne reçois plus les events !
        this.input.on('pointerdown', (pointer) => {
            if (boosterOpened) return; // Empêche tout drag après ouverture
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
            // Traînée lumineuse
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

        this.input.on('pointerup', () => {
            if (!dragActive || boosterOpened) return;
            dragActive = false;
            lastTrailX = null;
            // Fade out la traînée lumineuse
            this.tweens.add({
                targets: trailGraphics,
                alpha: 0,
                duration: 200,
                onComplete: () => trailGraphics.clear() && trailGraphics.setAlpha(1)
            });
            if (dragDelta > openThreshold) {
                boosterOpened = true; // Bloque tout drag futur
                // Animation de flash/disparition du booster
                this.sound.play('booster_opening');
                // Flash blanc rapide
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
            } else {
                // Rien à faire, le booster reste en place
            }
        });

        // ...ne PAS appeler startReveal() ici...
    }

    generateBoosterCards(booster) {
        // Si booster.possibleCards ne contient que des noms ou des IDs, il faut faire une requête pour récupérer les objets complets AVANT d'appeler cette scène !
        // Ici, on suppose que possibleCards contient déjà les objets complets { nom, image, rarity, ... }
        const cards = [];
        for (let i = 0; i < booster.cardCount; i++) {

            let rarity = 1;
            if (booster.rarityChances) {
                // On construit un tableau de raretés et de chances cumulées
                const rarityMap = [];
                let sum = 0;
                for (const key in booster.rarityChances) {
                    // Supporte les deux formats : "oneStar", "twoStars", "fourStar", "fivesStars", etc.
                    let rNum = 1;
                    if (/^one/i.test(key)) rNum = 1;
                    else if (/^two/i.test(key)) rNum = 2;
                    else if (/^three/i.test(key)) rNum = 3;
                    else if (/^four/i.test(key)) rNum = 4;
                    else if (/^five/i.test(key)) rNum = 5;
                    else if (/^\d/.test(key)) rNum = parseInt(key, 10);
                    else continue;
                    sum += booster.rarityChances[key];
                    rarityMap.push({ rarity: rNum, chance: sum });
                }
                // Normalise si la somme > 1
                if (sum > 1) {
                    rarityMap.forEach(r => r.chance /= sum);
                }
                const rand = Math.random();
                rarity = rarityMap.find(r => rand < r.chance)?.rarity || rarityMap[0]?.rarity || 1;
            }

            // Filtre les cartes possibles par rareté
            const pool = booster.possibleCards.filter(c => c.rarity === rarity);
            if (!pool.length) {
                // Si aucune carte pour cette rareté, fallback sur toutes les cartes du booster
                console.warn(`Aucune carte de rareté ${rarity} dans le booster, fallback sur toutes les cartes`);
                cards.push(booster.possibleCards[Math.floor(Math.random() * booster.possibleCards.length)]);
            } else {
                cards.push(pool[Math.floor(Math.random() * pool.length)]);
            }
        }
        return cards;
    }

    startReveal() {
        this.state = "revealing";
        this.revealIdx = 0;
        this.revealStack = [];
        this.revealCard();
    }

    revealCard() {
        // Nettoie la pile précédente
        this.revealStack.forEach(obj => obj.destroy && obj.destroy());
        this.revealStack = [];

        if (this.revealIdx >= this.cards.length) {
            this.showRecap();
            return;
        }

        // Sécurise la récupération de la carte
        const cardCheck = this.cards[this.revealIdx];
        if (!cardCheck || !cardCheck.image) {
            console.error("Carte invalide ou sans image :", cardCheck, "à l'index", this.revealIdx);
            this.showRecap();
            return;
        }

        
        const card = this.cards[this.revealIdx];
        const texture = this.textures.get(`item_${card.image}`);
        let realWidth = 100, realHeight = 150; // fallback
        if (texture && texture.getSourceImage()) {
            realWidth = texture.getSourceImage().width;
            realHeight = texture.getSourceImage().height;
        }


        // ...dans revealCard(), après avoir récupéré realWidth et realHeight...
        // Calcule la taille max selon l'écran (par exemple 30% largeur, 45% hauteur)
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
            .setScale(scale * stackScale) // <-- utilise le scale dynamique
            .setAlpha(1);
            this.revealStack.push(stackImg);
        }
        // Image de la carte responsive
        const mainImg = this.add.image(this.cameras.main.centerX, this.cameras.main.centerY, `item_${card.image}`)
            .setScale(scale)
            .setAlpha(0);
        this.revealStack.push(mainImg);


        // Affiche les valeurs autour de la carte (style TripleTriad)
        const thumbWidth = 230; // <--- taille augmentée
        const thumbHeight = thumbWidth * 1.5;
        const x = this.cameras.main.centerX;
        const y = this.cameras.main.centerY;
        const valueFont = `50px Press Start 2P`; // taille de police augmentée
        // Haut
        const valUp = this.add.text(x*1.38, y*1.25 - thumbHeight / 10+26 , card.powerUp, {
            font: valueFont, fill: "#ccc", stroke: "#000", strokeThickness: 5
        }).setOrigin(0.5, 1).setAlpha(0);
        // Bas
        const valDown = this.add.text(x*1.38, y*1.25 + thumbHeight / 10-26 , card.powerDown, {
            font: valueFont, fill: "#ccc", stroke: "#000", strokeThickness: 5
        }).setOrigin(0.5, 0).setAlpha(0);
        // Gauche
        const valLeft = this.add.text(x*1.38 - thumbWidth / 10+10, y*1.25, card.powerLeft, {
            font: valueFont, fill: "#ccc", stroke: "#000", strokeThickness: 5
        }).setOrigin(1, 0.5).setAlpha(0);
        // Droite
        const valRight = this.add.text(x*1.38 + thumbWidth / 10-10, y*1.25, card.powerRight, {
            font: valueFont, fill: "#ccc", stroke: "#000", strokeThickness: 5
        }).setOrigin(0, 0.5).setAlpha(0);

        this.revealStack.push(valUp, valDown, valLeft, valRight);

        // Affiche le nom de la carte
        const nameText = this.add.text(
            this.cameras.main.centerX,
            y*1.7,
            card.nom || "???",
            { font: "60px 'Press Start 2P', monospace", fill: "#fff", stroke: "#000", strokeThickness: 20, padding: { x: 10, y: 5 } }
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
                this.sound.play('carte_captured');
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

        // Swipe/click pour passer à la suivante avec animation de sortie
        this.input.once('pointerup', () => {
            // Animation de disparition
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
        // Affiche un récapitulatif des cartes obtenues
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

        // Affiche les images et noms des cartes obtenues
        const startY = this.cameras.main.centerY - 60;


        // ...dans showRecap(), juste avant la boucle this.cards.forEach...
        const recapWidth = 420;
        const recapHeight = 340;
        const margin = 24;
        const cardsPerRow = 5;
        const rows = Math.ceil(this.cards.length / cardsPerRow);

        // Calcule la taille max possible pour chaque carte selon l'espace du recap
        const availableWidth = recapWidth - margin * 2;
        const availableHeight = recapHeight - 120 - margin; // 120 pour le titre et le bouton
        const cardSpacing = availableWidth / cardsPerRow;
        const rowSpacing = availableHeight / rows;
        const maxCardWidth = Math.min(cardSpacing * 0.85, 80);  // 80px max pour éviter trop gros
        const maxCardHeight = Math.min(rowSpacing * 0.7, 120);  // 120px max pour éviter trop gros

        this.cards.forEach((card, i) => {
            const row = Math.floor(i / cardsPerRow);
            const col = i % cardsPerRow;
            const x = this.cameras.main.centerX - (availableWidth / 2) + cardSpacing / 2 + col * cardSpacing;
            const y = startY + row * rowSpacing;

            // Calcule le scale pour ne pas dépasser la taille max
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
            this.add.text(x, y + maxCardHeight / 2 + 10, card.nom, {
                font: "13px Arial", fill: "#fff"
            }).setOrigin(0.5);
        });

        const continueBtn = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY + 140,
            "Appuie pour continuer",
            { font: "24px Arial", fill: "#fff", backgroundColor: "#333", padding: { x: 10, y: 5 } }
        ).setOrigin(0.5).setInteractive();

        continueBtn.on('pointerup', async () => {
            // Ajoute les cartes à l'inventaire de InventoryScene si elle existe
            const inventoryScene = this.scene.get("InventoryScene");
            if (inventoryScene && typeof inventoryScene.addCardsToInventory === "function") {
                await inventoryScene.addCardsToInventory(this.cards);
                // Recharge l'inventaire pour forcer l'affichage à jour
                await inventoryScene.reloadInventory();
                await inventoryScene.ensureInventoryImagesLoaded();
                inventoryScene.drawInventory();
            }
            
            this.scene.stop();
            // Ferme proprement la scène et reprend la précédente
            if (this.scene.isPaused("InventoryScene")) {
                this.scene.resume("InventoryScene");
            } else {
                this.scene.resume("GameScene");
            }
        });
    }
}

export default BoosterOpeningScene;