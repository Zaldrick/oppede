import Phaser from "phaser";
import ResponsiveManager from "./managers/ResponsiveManager.js";
import { loadCardImages } from "./utils/loadCardImages.js";

async function getPlayerCards(playerId) {
    const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:5000";
    const res = await fetch(`${apiUrl}/api/cards/${playerId}`);
    if (!res.ok) throw new Error('Erreur API');
    return await res.json();
}

function setCookie(name, value, days = 365) {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    window.localStorage.setItem(name, value);
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export class TripleTriadSelectScene extends Phaser.Scene {
    constructor() {
        super("TripleTriadSelectScene");
        this.playerId = null;
        this.selected = [];
        this.cards = [];
        this.focusedCardIdx = 0;
        this.cardsPerPage = 8;
        this.carouselPage = 0;
        this.responsive = null;
        this.aiDifficulty = 'medium'; // Default AI difficulty
    }

    init(data) {
        this.playerId = data.playerId;
        this.mode = data.mode || "ai";
        this.opponentId = data.opponentId || null;
        this.aiDifficulty = data.aiDifficulty || 'medium'; // Difficulté par défaut
        this.customRules = data.rules || null; // Règles personnalisées

        const previousSelection = this.registry.get("tripleTriadSelection");
        this.selected = Array.isArray(previousSelection) ? [...previousSelection] : [];
        this.cards = [];
        this.focusedCardIdx = 0;
        this.carouselPage = 0;
    }

    async create() {
        // 🎯 INITIALISATION RESPONSIVE (pour les tailles seulement)
        this.responsive = ResponsiveManager.initialize(this);

        const { width, height } = this.sys.game.canvas;
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.95);

        try {
            this.cards = await getPlayerCards(this.playerId);
            this.cards.sort((a, b) => {
                if (b.rarity !== a.rarity) {
                    return a.rarity - b.rarity;
                }
                return a.nom.localeCompare(b.nom);
            });
        } catch (e) {
            this.cards = [];
        }

        if (!this.cards || this.cards.length === 0) {
            this.scene.stop();
            this.scene.start("MainMenuScene");
            return;
        }

        this.focusedCardIdx = 0;
        this.carouselPage = 0;

        loadCardImages(this, this.cards);
        this.load.once('complete', () => {
            if (!this.selected.length && this.cards.length >= 5) {
                this.selected = this.cards.slice(0, 5).map(c => c._id.toString());
            }
            this.drawUI();
        });
        this.load.start();
    }
    drawUI() {
        const { width, height } = this.sys.game.canvas;

        if (this.container) {
            this.container.destroy();
        }
        this.container = this.add.container(0, 0);


        // --- CARROUSEL ORIGINAL TAILLES ---
        const cardsPerRow = 4;
        const rows = 2;
        const cardsPerPage = cardsPerRow * rows;
        const totalPages = Math.ceil(this.cards.length / cardsPerPage);

        if (this.carouselPage >= totalPages) this.carouselPage = totalPages - 1;
        if (this.carouselPage < 0) this.carouselPage = 0;

        const thumbWidth = Math.min(50, (width - 120) / 5);
        const thumbHeight = thumbWidth * 1.5;

        const totalCardsWidth = width * 0.75;
        const margin = (totalCardsWidth - (thumbWidth * cardsPerRow)) / cardsPerRow;
        const cardSpan = thumbWidth + margin;
        const startX = width / 2 - totalCardsWidth / 2;
        const carouselY = 60;
        const rowSpacing = thumbHeight + 24;

        const cardsRowWidth = thumbWidth * cardsPerRow + margin * (cardsPerRow - 1);
        const remainingSpace = totalCardsWidth - cardsRowWidth;
        const leftPadding = remainingSpace / 2;

        // Fond du carrousel
        const carouselBg = this.add.rectangle(
            startX + totalCardsWidth / 2,
            carouselY + rowSpacing / 2,
            totalCardsWidth,
            rowSpacing * rows + 16,
            0x222244,
            0.92
        ).setOrigin(0.5).setStrokeStyle(2, 0xffffff);
        this.container.add(carouselBg);

        // Flèches
        const arrowFont = `${Math.round(thumbHeight * 0.8)}px Arial`;
        const arrowLeft = this.add.text(startX - 28, carouselY + rowSpacing / 2, "◀", {
            font: arrowFont,
            fill: this.carouselPage === 0 ? "#555" : "#fff"
        })
            .setOrigin(0.5)
            .setAlpha(this.carouselPage === 0 ? 0.4 : 1)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                if (this.carouselPage > 0) {
                    this.carouselPage--;
                    this.drawUI();
                }
            });
        this.container.add(arrowLeft);

        const arrowRight = this.add.text(startX + totalCardsWidth + 28, carouselY + rowSpacing / 2, "▶", {
            font: arrowFont,
            fill: this.carouselPage === totalPages - 1 ? "#555" : "#fff"
        })
            .setOrigin(0.5)
            .setAlpha(this.carouselPage === totalPages - 1 ? 0.4 : 1)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                if (this.carouselPage < totalPages - 1) {
                    this.carouselPage++;
                    this.drawUI();
                }
            });
        this.container.add(arrowRight);

        // Cartes du carrousel
        const startIdx = this.carouselPage * cardsPerPage;
        const endIdx = Math.min(startIdx + cardsPerPage, this.cards.length);

        for (let idx = startIdx; idx < endIdx; idx++) {
            const card = this.cards[idx];
            const i = idx - startIdx;
            const row = Math.floor(i / cardsPerRow);
            const col = i % cardsPerRow;
            const x = startX + leftPadding + col * cardSpan + thumbWidth / 2;
            const y = carouselY + row * rowSpacing;

            const thumb = this.add.image(x, y, `item_${card.image}`)
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

            this.container.add(thumb);

            // Valeurs autour de la carte (FORMULE ORIGINALE)
            const valueFont = `${Math.round(thumbWidth * 0.38)}px Arial`;
            this.container.add(this.add.text(x, y - thumbHeight / 2 + 20, card.powerUp, {
                font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 4
            }).setOrigin(0.5, 1));

            this.container.add(this.add.text(x, y + thumbHeight / 2 - 20, card.powerDown, {
                font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 4
            }).setOrigin(0.5, 0));

            this.container.add(this.add.text(x - thumbWidth / 2 + 18, y, card.powerLeft, {
                font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 4
            }).setOrigin(1, 0.5));

            this.container.add(this.add.text(x + thumbWidth / 2 - 18, y, card.powerRight, {
                font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 4
            }).setOrigin(0, 0.5));
        }

        // --- ZONE DÉTAIL (EXACTEMENT comme l'original) ---
        const detailZoneTop = carouselY + thumbHeight * 2 + 20;
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

            // Carte zoomée
            const cardImg = this.add.image(detailImgX, detailImgY, `item_${card.image}`)
                .setDisplaySize(detailImgW, detailImgH)
                .setOrigin(0.5)
                .setAlpha(isSelected ? 0.5 : 1)
                .setInteractive()
                .on('pointerdown', () => this.toggleCard(card._id.toString()));
            this.container.add(cardImg);

            // Valeurs sur la carte zoomée (POSITION ORIGINALE)
            const statsBoxW = detailImgW * 0.5;
            const statsBoxH = detailImgH / 3;
            const statsBoxX = detailImgX + detailImgW / 1.230 - statsBoxW / 2 - 8;
            const statsBoxY = detailImgY + detailImgH / 1.40 - statsBoxH / 2 - 8;

            const statFont = `${Math.round(statsBoxH * 0.38)}px Arial`;
            const centerX = statsBoxX - statsBoxW / 2;
            const centerY = statsBoxY - statsBoxH / 2;

            this.container.add(this.add.text(centerX, centerY - statsBoxH / 2 + 2, card.powerUp, {
                font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 3
            }).setOrigin(0.5, 0));

            this.container.add(this.add.text(centerX, centerY + statsBoxH / 2 - 2, card.powerDown, {
                font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 3
            }).setOrigin(0.5, 1));

            this.container.add(this.add.text(centerX - statsBoxW / 3 + 10, centerY, card.powerLeft, {
                font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 3
            }).setOrigin(1, 0.5));

            this.container.add(this.add.text(centerX + statsBoxW / 3 - 10, centerY, card.powerRight, {
                font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 3
            }).setOrigin(0, 0.5));

            // Informations (POLICE ADAPTATIVE)
            const maxNameWidth = width * 0.45; // Largeur max pour le nom
            const baseFontSize = Math.round(width * 0.1);
            const optimalFontSize = this.getOptimalFontSize(card.nom, maxNameWidth, baseFontSize, Math.round(width * 0.06));

            this.container.add(this.add.text(descX, detailZoneTop, card.nom, {
                font: `${optimalFontSize}px Arial`,
                fill: "#fff",
                wordWrap: { width: maxNameWidth, useAdvancedWrap: true }
            }).setOrigin(0, 0));

            const maxStars = 5;
            const filledStar = "★";
            const emptyStar = "☆";
            const rarity = Math.max(1, Math.min(card.rarity, maxStars));
            const stars = filledStar.repeat(rarity) + emptyStar.repeat(maxStars - rarity);

            this.container.add(this.add.text(descX, detailZoneTop + 36, stars, {
                font: `${Math.round(width * 0.08)}px Arial`,
                fill: "#ffd700",
                stroke: "#000",
                strokeThickness: 4
            }).setOrigin(0, 0));

            this.container.add(this.add.text(descX, detailZoneTop + 36 + Math.round(width * 0.07) + 8, card.description || "", {
                font: `${Math.round(width * 0.035)}px Arial`,
                fill: "#fff",
                wordWrap: { width: width * 0.5 }
            }).setOrigin(0, 0));

            const selectBtn = this.add.text(descX, detailZoneTop + 150,
                isSelected ? "Retirer de la sélection" : "Ajouter à la sélection", {
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

        // --- ZONE SÉLECTION (EXACTEMENT comme l'original) ---
        const selY = height - 180;
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

            const x = selStartX + i * (selThumbW + 20);
            const thumb = this.add.image(x, selY, `item_${card.image}`)
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
            this.container.add(this.add.text(x, selY - selThumbH / 2 + 12, card.powerUp, {
                font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 5
            }).setOrigin(0.5, 1));
            this.container.add(this.add.text(x, selY + selThumbH / 2 - 12, card.powerDown, {
                font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 5
            }).setOrigin(0.5, 0));
            this.container.add(this.add.text(x - selThumbW / 2 + 10, selY, card.powerLeft, {
                font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 5
            }).setOrigin(1, 0.5));
            this.container.add(this.add.text(x + selThumbW / 2 - 10, selY, card.powerRight, {
                font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 5
            }).setOrigin(0, 0.5));
        });

        // --- BOUTONS (EXACTEMENT comme l'original) ---
        const btnY = height - 90;
        const btnSpacing = 40; // ✅ Plus d'espace pour le titre au centre
        const btnWidth = 100; // ✅ Boutons un peu plus petits

        const retourBtn = this.add.text(width / 2 - btnWidth - btnSpacing, btnY, "Retour", {
            font: `${Math.round(width * 0.04)}px Arial`, // ✅ Un peu plus petit
            fill: "#fff",
            backgroundColor: "#444"
        })
            .setOrigin(0.5)
            .setPadding(16, 8, 16, 8) // ✅ Padding réduit
            .setInteractive()
            .on('pointerdown', () => this.close());
        this.container.add(retourBtn);


        // Titre au centre
        const titleText = this.add.text(width / 2, btnY*.98, "Choisis tes 5 cartes", {
            font: `${Math.round(width * 0.045)}px Arial`,
            fill: "#fff",
            fontStyle: "bold"
        }).setOrigin(0.5);
        this.container.add(titleText);
        
        // === AFFICHAGE DES RÈGLES CONFIGURÉES ===
        if (this.customRules) {
            const activeRules = Object.entries(this.customRules).filter(([key, value]) => value);
            if (activeRules.length > 0) {
                const ruleLabels = {
                    same: "Identique",
                    plus: "Plus", 
                    murale: "Murale",
                    mortSubite: "Mort Subite"
                };
                
                const ruleNames = activeRules.map(([key]) => ruleLabels[key]).join(" • ");
                
                this.container.add(this.add.text(width / 2, btnY*1.01, `${ruleNames}`, {
                    font: `${Math.round(width * 0.027)}px Arial`,
                    fill: "#0f0",
                    fontStyle: "bold"
                }).setOrigin(0.5));
            }
        }

        const canValidate = this.selected.length === 5;
        this.validateBtn = this.add.text(width / 2 + btnWidth + btnSpacing, btnY, "Valider", {
            font: `${Math.round(width * 0.045)}px Arial`,
            fill: "#fff",
            backgroundColor: canValidate ? "#0f0" : "#555"
        })
            .setOrigin(0.5)
            .setPadding(16, 8, 16, 8) // ✅ Padding réduit
            .setInteractive()
            .on('pointerdown', () => this.validate())
            .setAlpha(canValidate ? 1 : 0.5);
        this.container.add(this.validateBtn);
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
            window.localStorage.setItem("tripleTriadSelection", JSON.stringify(this.selected));
            setCookie("tripleTriadSelection", JSON.stringify(this.selected));

            const selectedCards = this.cards.filter(c => this.selected.includes(c._id.toString()));

            // Si on vient du menu IA, on lance directement le jeu
            if (this.mode === "ai" && this.customRules) {
                // Partie contre l'IA - avec règles pré-configurées
                this.scene.stop();
                this.scene.launch("TripleTriadGameScene", {
                    mode: "ai",
                    playerId: this.playerId,
                    playerCards: selectedCards,
                    aiDifficulty: this.aiDifficulty || 'medium',
                    rules: this.customRules
                });
                return;
            }

            // Si on vient du menu PvP, on lance directement le jeu
            if (this.mode === "pvp") {
                const matchId = this.registry.get('ttMatchId');
                this.scene.stop();
                this.scene.launch("TripleTriadGameScene", {
                    mode: "pvp",
                    matchId,
                    playerId: this.playerId,
                    opponentId: this.opponentId,
                    playerCards: selectedCards,
                    rules: this.customRules || {
                        same: true,
                        plus: true,
                        murale: true,
                        mortSubite: false
                    }
                });
                return;
            }

            // Si mode IA sans règles (accès direct menu), lance config IA
            if (this.mode === "ai") {
                this.scene.stop();
                this.scene.resume("GameScene");
                this.scene.scene.launch("TripleTriadAIConfigScene", {
                    playerId: this.playerId,
                    preSelectedCards: selectedCards
                });
                return;
            }

            // Fallback : Si aucun mode défini, lance config IA par défaut
            this.scene.stop();
            this.scene.resume("GameScene");
            this.scene.scene.launch("TripleTriadAIConfigScene", {
                playerId: this.playerId,
                preSelectedCards: selectedCards
            });
        }
    }
    
    /**
     * ✅ NOUVELLE MÉTHODE : Affiche le menu de sélection du mode Triple Triad
     */
    showModeSelectionMenu(selectedCards) {
        const { width, height } = this.scale;
        
        // Crée un menu de sélection de mode par-dessus la scène actuelle
        this.modeSelectionMenu = this.add.container(width / 2, height / 2);
        
        // Fond semi-transparent
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8)
            .setInteractive()
            .setScrollFactor(0);
        this.modeSelectionMenu.add(overlay);
        
        // Titre
        const title = this.add.text(0, -height * 0.2, "Triple Triad", {
            font: `${Math.round(width * 0.06)}px Arial`,
            fill: "#fff",
            fontStyle: "bold"
        }).setOrigin(0.5).setScrollFactor(0);
        this.modeSelectionMenu.add(title);
        
        const subtitle = this.add.text(0, -height * 0.15, "Choisissez votre mode de jeu", {
            font: `${Math.round(width * 0.035)}px Arial`,
            fill: "#ccc"
        }).setOrigin(0.5).setScrollFactor(0);
        this.modeSelectionMenu.add(subtitle);
        
        // Bouton IA
        const aiBtn = this.add.text(0, -height * 0.05, "🤖 Jouer contre l'IA", {
            font: `${Math.round(width * 0.045)}px Arial`,
            fill: "#fff",
            backgroundColor: "#4a4a4a"
        })
            .setOrigin(0.5)
            .setPadding(20, 12, 20, 12)
            .setInteractive()
            .setScrollFactor(0)
            .on('pointerdown', () => {
                this.modeSelectionMenu.destroy();
                // Lance le menu de config IA avec les cartes déjà sélectionnées
                this.scene.stop();
                this.scene.resume("GameScene");
                this.scene.scene.launch("TripleTriadAIConfigScene", {
                    playerId: this.playerId,
                    preSelectedCards: selectedCards
                });
            })
            .on('pointerover', () => aiBtn.setStyle({ backgroundColor: "#666" }))
            .on('pointerout', () => aiBtn.setStyle({ backgroundColor: "#4a4a4a" }));
        this.modeSelectionMenu.add(aiBtn);
        
        // Description IA
        const aiDesc = this.add.text(0, height * 0.01, "Affrontez une IA avec difficulté configurable", {
            font: `${Math.round(width * 0.025)}px Arial`,
            fill: "#aaa"
        }).setOrigin(0.5).setScrollFactor(0);
        this.modeSelectionMenu.add(aiDesc);
        
        // Bouton PvP
        const pvpBtn = this.add.text(0, height * 0.08, "⚔️ Défier un Joueur", {
            font: `${Math.round(width * 0.045)}px Arial`,
            fill: "#fff",
            backgroundColor: "#cc6600"
        })
            .setOrigin(0.5)
            .setPadding(20, 12, 20, 12)
            .setInteractive()
            .setScrollFactor(0)
            .on('pointerdown', () => {
                this.modeSelectionMenu.destroy();
                this.scene.stop();
                this.scene.resume("GameScene");
                // Affiche le sélecteur d'adversaire depuis GameScene
                this.scene.scene.get("GameScene").showOpponentSelector();
            })
            .on('pointerover', () => pvpBtn.setStyle({ backgroundColor: "#dd7711" }))
            .on('pointerout', () => pvpBtn.setStyle({ backgroundColor: "#cc6600" }));
        this.modeSelectionMenu.add(pvpBtn);
        
        // Description PvP
        const pvpDesc = this.add.text(0, height * 0.14, "Défiez un autre joueur en ligne avec règles personnalisées", {
            font: `${Math.round(width * 0.025)}px Arial`,
            fill: "#aaa"
        }).setOrigin(0.5).setScrollFactor(0);
        this.modeSelectionMenu.add(pvpDesc);
        
        // Bouton Retour
        const backBtn = this.add.text(0, height * 0.25, "Retour", {
            font: `${Math.round(width * 0.04)}px Arial`,
            fill: "#fff",
            backgroundColor: "#666"
        })
            .setOrigin(0.5)
            .setPadding(16, 8, 16, 8)
            .setInteractive()
            .setScrollFactor(0)
            .on('pointerdown', () => {
                this.modeSelectionMenu.destroy();
                // Retourne à la sélection de cartes
            });
        this.modeSelectionMenu.add(backBtn);
        
        // Définit la profondeur pour être au-dessus de tout
        this.modeSelectionMenu.setScrollFactor(0).setDepth(1000);
    }

    close() {    
        this.scene.stop();
        this.scene.resume("GameScene");
    }
    getOptimalFontSize(text, maxWidth, baseFontSize = 60, minFontSize = 25) {
        const charWidth = baseFontSize * 0.6; // Approximation largeur caractère
        const estimatedWidth = text.length * charWidth;

        if (estimatedWidth <= maxWidth) {
            return baseFontSize;
        }

        const ratio = maxWidth / estimatedWidth;
        return Math.max(Math.floor(baseFontSize * ratio), minFontSize);
    }
}