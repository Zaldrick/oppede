import Phaser from "phaser";
import MusicManager from './MusicManager';
import { loadCardImages } from "./utils/loadCardImages.js";

export class TripleTriadGameScene extends Phaser.Scene {
    constructor() {
        super("TripleTriadGameScene");
        this.board = this.createEmptyBoard();
        this.playerCards = [];
        this.opponentCards = [];
        this.activePlayer = 0; // 0: joueur, 1: adversaire
        this.draggedCardIdx = null;
        this.boardCells = []; // Pour stocker les objets grille
    }

    preload() {
        // Charge toutes les images de cartes nécessaires
        loadCardImages(this, this.cards);
        
        this.load.audio('tripleTriadMusic', 'assets/musics/tripleTriadMusic.mp3');
        this.load.audio('tripleTriadArrow', 'assets/sounds/tripleTriadArrow.mp3');
        this.load.audio('card_place', 'assets/sounds/cardPlaced.mp3');
        this.load.audio('card_capture', 'assets/sounds/cardCaptured.mp3');
        this.load.audio('victoryMusic', 'assets/musics/victoryMusic.mp3');
        this.load.audio('defeatMusic', 'assets/musics/defeatMusic.mp3');
    }

    init(data) {
        this.isPvP = data.mode === "pvp";
        this.matchId = data.matchId || this.generateMatchId();;
        this.playerId = data.playerId;
        this.opponentId = data.opponentId;
        this.playerCards = data.playerCards || [];
        this.opponentCards = data.opponentCards || [];
        this.board = this.createEmptyBoard();
        this.activePlayer = 0;
        this.playerScore = 5;
        this.opponentScore = 5;
        this.rules = data.rules || {
            same: false,
            plus: false,
            sameWall: false,
            suddenDeath: false
        };
        this.socket = this.registry.get("socket");
        if (!this.socket) {
            // Fallback pour debug si jamais le registry n'est pas set
            this.socket = window.socket;
        }
            if (data.mode === "ai" && (!this.opponentCards || this.opponentCards.length === 0)) {
        // Prends 5 cartes aléatoires différentes parmi toutes les cartes possibles
        const allCards = [
            { nom: "Boguomile", image: "Bogomile.png", powerUp: 1, powerLeft: 5, powerDown: 4, powerRight: 1 },
            { nom: "Fungus", image: "Fungus.png", powerUp: 5, powerLeft: 3, powerDown: 1, powerRight: 1 },
            { nom: "Elmidea", image: "Elmidea.png", powerUp: 1, powerLeft: 5, powerDown: 3, powerRight: 3 },
            { nom: "Nocturnus", image: "Nocturnus.png", powerUp: 6, powerLeft: 2, powerDown: 1, powerRight: 1 },
            { nom: "Incube", image: "Incube.png", powerUp: 2, powerLeft: 5, powerDown: 1, powerRight: 3 },
            { nom: "Aphide", image: "Aphide.png", powerUp: 2, powerLeft: 4, powerDown: 4, powerRight: 1 },
            { nom: "Elastos", image: "Elastos.png", powerUp: 1, powerLeft: 1, powerDown: 4, powerRight: 5 },
            { nom: "Diodon", image: "Diodon.png", powerUp: 3, powerLeft: 1, powerDown: 2, powerRight: 5 },
            { nom: "Carnidea", image: "Carnidea.png", powerUp: 2, powerLeft: 1, powerDown: 6, powerRight: 1 },
            { nom: "Larva", image: "Larva.png", powerUp: 4, powerLeft: 3, powerDown: 4, powerRight: 2 },
            { nom: "Gallus", image: "Gallus.png", powerUp: 2, powerLeft: 6, powerDown: 2, powerRight: 1 }
        ];
        // Mélange et prend 5 cartes
        this.opponentCards = Phaser.Utils.Array.Shuffle(allCards).slice(0, 5).map(card => ({ ...card, played: false }));
    }
    }


showRuleMessage(ruleName) {
    const { width, height } = this.sys.game.canvas;
    const msg = this.add.text(width / 2, height / 2, `${ruleName}`, {
        font: 'bold 48px Arial',
        fill: '#fff',
        stroke: '#000',
        strokeThickness: 8
    }).setOrigin(0.5).setDepth(1000);

    // Disparition après 1.5s (ou la durée de l’animation)
    this.time.delayedCall(1500, () => {
        msg.destroy();
    });
}
create() {
    // On attend que le serveur nous dise que le match est prêt
    if (this.isPvP) {
        // Affiche un message d'attente
        this.waitText = this.add.text(
            this.sys.game.canvas.width / 2,
            this.sys.game.canvas.height * 0.4,
            "En attente de l'adversaire...",
            { font: "32px Arial", fill: "#fff" }
        ).setOrigin(0.5);


        this.socket.once('tt:matchReady', (data) => {
            // Retire le message d'attente
            if (this.waitText) this.waitText.destroy();

            // Affiche "C'est l'heure du duel !" animé
            const duelText = this.add.text(
                this.sys.game.canvas.width / 2,
                this.sys.game.canvas.height / 2,
                "C'est l'heure du duel !",
                { font: "bold 40px Arial", fill: "#ff0", stroke: "#000", strokeThickness: 6 }
            ).setOrigin(0.5).setAlpha(0);

            MusicManager.play(this, 'tripleTriadMusic', { loop: true, volume: 0.5 });
            this.tweens.add({
                targets: duelText,
                alpha: 1,
                scale: { from: 0.7, to: 1.1 },
                duration: 700,
                yoyo: true,
                hold: 700,
                onComplete: () => {
                    duelText.destroy();
                    // Initialise la partie avec les bonnes mains et l'état du plateau
                    this.playerCards = data.playerCards;
                    this.opponentCards = data.opponentCards;
                    this.board = data.state.board;
                    this.activePlayer = data.state.turn === this.playerId ? 0 : 1;
                    this.redrawAll();
                    this.showStartingArrow(this.activePlayer, () => {            });
                }
            });
        });
        
        this.socket.emit('tt:startMatch', {
            matchId: this.matchId,
            playerId: this.playerId,
            opponentId: this.opponentId,
            playerCards: this.playerCards
        });

    this.socket.on('tt:update', ({ state, appliedRules }) => {
    const previousBoard = JSON.parse(JSON.stringify(this.board));
    this.board = state.board;
    this.activePlayer = state.turn === this.playerId ? 0 : 1;
    this.lastState = state;
    this.playerScore = state.scores?.[this.playerId] ?? 0;
    this.opponentScore = state.scores?.[this.opponentId] ?? 0;
    if (appliedRules && appliedRules.length > 0) {
        this.showRuleMessage(appliedRules.join(', ')); // Affiche le nom de la règle
    }
    // Mets à jour les cartes jouées dans la main du joueur
    if (this.isPvP) {
        if (state.moves && Array.isArray(state.moves)) {
            state.moves.forEach(move => {
                if (move.playerId === this.playerId && this.playerCards[move.cardIdx]) {
                    this.playerCards[move.cardIdx].played = true;
                }
                if (move.playerId === this.opponentId && this.opponentCards[move.cardIdx]) {
                    this.opponentCards[move.cardIdx].played = true;
                }
            });
        }
    }

        let animsToDo = 0, poseToDo = 0, flipToDo = 0;
        const poses = [];
        const flips = [];

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const prev = previousBoard[row][col];
                const curr = this.board[row][col];
                if (!prev && curr) {
                    animsToDo++;
                    poseToDo++;
                    poses.push({ row, col, curr });
                } else if (prev && curr && prev.owner !== curr.owner) {
                    animsToDo++;
                    flipToDo++;
                    flips.push({ row, col, owner: curr.owner === this.playerId ? "player" : "opponent" });
                }
            }
        }

        let animsDone = 0, poseDone = 0;



        // 1. Anime d'abord toutes les poses
if (poseToDo > 0) {
    poses.forEach(({ row, col, curr }) => {
        const { width, height } = this.sys.game.canvas;
        const cardW = Math.min(60, width / 8);
        const cardH = cardW * 1.5;
        const cellW = (width * 0.80) / 3;
        const cellH = cellW * 1.5;
        const boardW = cellW * 3;
        const boardX = width / 2 - boardW / 2;
        const boardY = cardW * 1.5 * .72 + ((height - cardW * 1.5 * .72 - (cardW * 1.5 + 24)) - cellH * 3) / 2;
        const toX = boardX + col * cellW + cellW / 2;
        const toY = boardY + row * cellH + cellH / 2;

        if (curr.owner === this.playerId) {
            const cellRect = this.add.rectangle(toX, toY, cellW - 8, cellH - 8, 0x626262, 1)
                .setOrigin(0.5)
                .setStrokeStyle(7, 0x3399ff);
            this.container.add(cellRect);
            const img = this.add.image(toX, toY, `item_${curr.image}`)
                .setDisplaySize(cellW * 0.9, cellH * 0.9)
                .setOrigin(0.5);
            this.container.add(img);

            poseDone++;
            if (poseDone === poseToDo) {
                // Quand toutes les poses sont finies, lance les flips
                if (flipToDo > 0) {
                    let flipsDone = 0;
                    flips.forEach(({ row, col, owner }) => {
                        this.animateCapture(row, col, owner, () => {
                            flipsDone++;
                            if (flipsDone === flipToDo) {
                                this.redrawAll();
                                if (state.gameEnded) {
                                     this.handleEndGame(state);
                                }
                            }
                        });
                    });
                } else {
                    this.redrawAll();
                        if (state.gameEnded) {
                             this.handleEndGame(state);
                        }
                }
            }
        } else {
            const cellRect = this.add.rectangle(toX, toY, cellW - 8, cellH - 8, 0x626262, 1)
                .setOrigin(0.5)
                .setStrokeStyle(7, 0xff3333);
            this.container.add(cellRect);

            const img = this.add.image(toX, toY, `item_${curr.image}`)
                .setDisplaySize(cellW * 0.9, cellH * 0.9)
                .setOrigin(0.5);
            this.container.add(img);
            const fromX = width / 2 - ((cardW + 8) * 5 - 8) / 2 + (curr.cardIdx ?? 0) * (cardW + 8);
            const fromY = cardH / 2 + 10;

            this.animateCardPlacement(
                curr, fromX, fromY, toX, toY, 0xff9999,
                () => {
                    poseDone++;
                    if (poseDone === poseToDo) {
                        if (flipToDo > 0) {
                            let flipsDone = 0;
                            flips.forEach(({ row, col, owner }) => {
                                this.animateCapture(row, col, owner, () => {
                                    flipsDone++;
                                    if (flipsDone === flipToDo) {
                                        this.redrawAll();
                                        if (state.gameEnded) this.handleEndGame(state);
                                    }
                                });
                            });
                        } else {
                            this.redrawAll();
                            if (state.gameEnded) this.handleEndGame(state);
                        }
                    }
                }
            );
        }
    });
}

    // Si aucune animation, redraw tout de suite
    if (animsToDo === 0) {
        this.redrawAll();
    }

    MusicManager.play(this, 'tripleTriadMusic', { loop: true, volume: 0.5 });
    });

    } else {
        // Mode IA : pas d'attente
        this.activePlayer = Math.random() < 0.5 ? 0 : 1;
        this.resize();
        this.drawBackground();
        this.drawOpponentHand();
        this.drawBoard();
        this.drawPlayerHand();
        this.setupResizeListener();
        this.lastPlayedCard = null;
        this.endText = null;
        this.gameEnded = false;
        MusicManager.play(this, 'tripleTriadMusic', { loop: true, volume: 0.5 });
            // Ajoute ceci pour afficher la flèche avant le début de la partie
        this.showStartingArrow(this.activePlayer, () => {
            // Quand l'animation est terminée, lance le tour IA si besoin
            if (this.activePlayer === 1) {
                this.aiPlay();
            }
            // Sinon, le joueur peut jouer directement
        });
    }
}

    createEmptyBoard() {
        // 3x3 array, null = case vide
        return Array.from({ length: 3 }, () => Array(3).fill(null));
    }

    resize() {
        // S'adapte à la taille de l'écran mobile
        this.game.scale.resize(window.innerWidth, window.innerHeight);
    }

    setupResizeListener() {
        window.addEventListener("resize", () => {
            this.resize();
            this.redrawAll();
        });
    }

getActiveRules() {
    const ruleMethods = [];
    if (this.rules.identique) {
        console.log("[TripleTriad] Règle 'Identique' ACTIVE, ruleSame sera appelée.");
        ruleMethods.push(this.ruleSame.bind(this));
    }
    if (this.rules.plus) ruleMethods.push(this.rulePlus.bind(this));
    if (this.rules.sameWall) ruleMethods.push(this.ruleSameWall.bind(this));
    // ...etc.
    return ruleMethods;
}


handleEndGame(state) {
    // Sécurité : si pas de scores, force le calcul local (en dernier recours)
    let myScore = state.scores?.[this.playerId];
    let oppScore = state.scores?.[this.opponentId];
    if (myScore === undefined || oppScore === undefined) {
        myScore = this.countOwnedCards("player");
        oppScore = this.countOwnedCards("opponent");
        console.warn("[TripleTriad] Scores manquants, fallback local :", myScore, oppScore);
    }

    let resultText = "";
    let color = "#fff";
    let musicKey = null;
    if (myScore > oppScore) {
        resultText = "VICTOIRE";
        color = "#33ff33";
        musicKey = "victoryMusic";
    } else if (myScore < oppScore) {
        resultText = "DEFAITE";
        color = "#ff3333";
        musicKey = "defeatMusic";
    } else {
        resultText = "EGALITÉ";
        color = "#ffff33";
        musicKey = "defeatMusic";
    }
    const { width, height } = this.sys.game.canvas;
    this.endText = this.add.text(width / 2, height / 2, resultText, {
        font: `bold ${Math.round(width * 0.13)}px Arial`,
        fill: color,
        stroke: "#000",
        strokeThickness: 8
    }).setOrigin(0.5).setAlpha(0).setScale(0.7);

    this.redrawAll();
    this.container.add(this.endText);
    MusicManager.stop();
    MusicManager.play(this, musicKey, { loop: false, volume: 0.5 });

    this.tweens.add({
        targets: this.endText,
        alpha: 1,
        scale: 1,
        duration: 420,
        ease: 'Back.easeOut'
    });

    this.gameEnded = true;
    this.showEndAndFadeOut();
}

redrawAll() {
    if (this.gameEnded || !this.sys || !this.sys.game) return;
    if (this.container) {
        // Stoppe tous les tweens sur les enfants du container
        this.container.iterate(child => {
            if (child && child.active) {
                this.tweens.killTweensOf(child);
            }
        });
        this.container.destroy(true);
        this.container = null;
    }
    this.container = null;
    this.drawBackground();
    this.drawOpponentHand();
    this.drawBoard();
    this.drawPlayerHand();
}

    drawBackground() {
        const { width, height } = this.sys.game.canvas;
        this.container = this.add.container(0, 0);
        this.container.add(
            this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.98)
        );
    }

    drawOpponentHand() {
        const { width } = this.sys.game.canvas;
        const cardW = Math.min(60, width / 8);
        const cardH = cardW * 1.5;
        const startX = width / 2 - ((cardW + 8) * 5 - 8) / 2;
        const y = cardH / 2 + 10;

        this.opponentCards.forEach((card, i) => {
            const x = startX + i * (cardW + 8);


             const img = this.add.image(x, y, `item_${card.image}`)
                .setDisplaySize(cardW, cardH)
                .setOrigin(0.5)
                .setAlpha(card.played ? 0.3 : 1);

            if (this.activePlayer === 1 && !card.played && !this.gameEnded) {
                this.applyGlowEffect(img, x, y, cardW, cardH, 0xeacbcb, 0.5, 1.3);
             }

            this.container.add(img);

            // Affiche les valeurs autour de la carte si besoin
            this.drawCardValues(x, y, cardW, cardH, card);
        });
    }

    drawBoard() {
        const { width, height } = this.sys.game.canvas;
        const cardW = Math.min(60, width / 8);
        const cardH = cardW * 1.5;
        const topMargin = cardH*.72;
        const bottomMargin = cardH + 24;
        const availableHeight = height - topMargin - bottomMargin;
        // Plateau réduit : prend 80% de la largeur possible
        const cellW = (width * 0.80) / 3;
        const cellH = cellW * 1.5;
        const boardW = cellW * 3;
        const boardH = cellH * 3;
        const boardX = width / 2 - boardW / 2;
        const boardY = topMargin + (availableHeight - boardH) / 2;

        // Fond du plateau
        this.container.add(
            this.add.rectangle(width / 2, boardY + boardH / 2, boardW, boardH, 0xA6A6A6, 0.95)
                .setOrigin(0.5)
                .setStrokeStyle(4, 0xB0B0B0 )
        );

        // Grille 3x3 de rectangles
        this.boardCells = [];
        for (let row = 0; row < 3; row++) {
            this.boardCells[row] = [];
            for (let col = 0; col < 3; col++) {
                const x = boardX + col * cellW + cellW / 2;
                const y = boardY + row * cellH + cellH / 2;
                const card = this.board[row][col];
                // Couleur de fond selon propriétaire
                let cellColor = 0x626262;
                let cellAlpha = 1;

                let borderColor = 0xffffff;
                if (card) {
                    if (this.isPvP) {
                        if (card.owner === this.playerId) borderColor = 0x3399ff; // bleu joueur
                        else if (card.owner === this.opponentId) borderColor = 0xff3333; // rouge adversaire
                    } else {
                        if (card.owner === "player") borderColor = 0x3399ff;
                        else if (card.owner === "opponent") borderColor = 0xff3333;
                    }
                }
                const cell = this.add.rectangle(x, y, cellW - 8, cellH - 8, cellColor, cellAlpha)
                    .setOrigin(0.5)
                    .setStrokeStyle(7, borderColor) // <--- épaisseur et couleur de bordure
                    .setInteractive({ dropZone: true });
                this.container.add(cell);
                this.boardCells[row][col] = cell;

                // Affiche la carte posée si besoin
                if (card) {
                    const img = this.add.image(x, y, `item_${card.image}`)
                        .setDisplaySize(cellW * 0.9, cellH * 0.9)
                        .setOrigin(0.5)
                        .clearTint();
                        //if ((this.isPvP && card.owner === this.opponentId) || (!this.isPvP && card.owner === "opponent")) { img.setFlipX(true);} 

                    this.container.add(img);

                    // Affiche les valeurs en bas à droite de la carte posée, resserré et petit, sans cadre
                    const valueW = cellW * 0.26;
                    const valueH = cellH * 0.26;
                    const dx = x + cellW * 0.9 / 2 - valueW ;
                    const dy = y + cellH * 0.9 / 2 - valueH ;
                    const statFont = `${Math.round(valueH * 0.5)}px Arial`;

                    // Haut
                    this.container.add(this.add.text(dx + valueW / 2, dy - 6, card.powerUp, {
                        font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 6
                    }).setOrigin(0.5, 0));
                    // Bas
                    this.container.add(this.add.text(dx + valueW / 2, dy + valueH + 6, card.powerDown, {
                        font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 6
                    }).setOrigin(0.5, 1));
                    // Gauche
                    this.container.add(this.add.text(dx + 9, dy + valueH / 2, card.powerLeft, {
                        font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 6
                    }).setOrigin(1, 0.5));
                    // Droite
                    this.container.add(this.add.text(dx + valueW - 9, dy + valueH / 2, card.powerRight, {
                        font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 6
                    }).setOrigin(0, 0.5));
                }
            }
        }

        // Affiche les scores
        this.drawScores(width, height);
        // Affiche le texte de fin si besoin
        if (this.endText && this.endText.scene) {
            this.container.add(this.endText);
        }
    }

drawScores(width, height) {
    // Utilise toujours les scores locaux (nouvelle règle)
    const playerScore = this.playerScore;
    const opponentScore = this.opponentScore;
    const fontSize = Math.round(width * 0.1);

    // Score du joueur (en bas à droite)
    this.container.add(this.add.text(width * 0.96, height * 0.92, `${playerScore}`, {
        font: `${fontSize}px Arial`,
        fill: "#3399ff",
        fontStyle: "bold"
    }).setOrigin(1, 1));

    // Score de l'adversaire (en haut à droite)
    this.container.add(this.add.text(width * 0.96, height * 0.05, `${opponentScore}`, {
        font: `${fontSize}px Arial`,
        fill: "#ff3333",
        fontStyle: "bold"
    }).setOrigin(1, 0));
}

countOwnedCards(owner) {
    let count = 0;
    for (let row = 0; row < 3; row++)
        for (let col = 0; col < 3; col++)
            if (this.board[row][col]) {
                if (this.isPvP) {
                    if (owner === "player" && this.board[row][col].owner === this.playerId) count++;
                    else if (owner === "opponent" && this.board[row][col].owner === this.opponentId) count++;
                } else {
                    if (owner === "player" && this.board[row][col].owner === "player") count++;
                    else if (owner === "opponent" && this.board[row][col].owner === "opponent") count++;
                }
            }
    return count;
}

drawPlayerHand() {
    const { width, height } = this.sys.game.canvas;
    const cardW = Math.min(60, width / 8);
    const cardH = cardW * 1.5;
    const handY = height - cardH - 20;
    const startX = width / 2 - ((cardW + 8) * 5 - 8) / 2;

    this.playerCards.forEach((card, i) => {     
        const x = startX + i * (cardW + 8);
        const img = this.add.image(x, handY, `item_${card.image}`)
            .setDisplaySize(cardW, cardH)
            .setOrigin(0.5)
            .setAlpha(card.played ? 0.3 : 1)
            .setInteractive({ draggable: !card.played && this.activePlayer === 0 && !this.gameEnded });

        // --- Effet lumineux si c'est au joueur de jouer et la carte n'est pas jouée ---
        if (this.activePlayer === 0 && !card.played && !this.gameEnded) {
            this.applyGlowEffect(img, x, handY, cardW, cardH, 0xcbe2ea, 0.5, 1.3);
        }

        // Drag events
        img.on('dragstart', (pointer) => {
            if (!card.played && this.activePlayer === 0 && !this.gameEnded) {
                this.draggedCardIdx = i;
                img.setAlpha(0.7);
            }
        });
        img.on('drag', (pointer, dragX, dragY) => {
            if (!card.played && this.activePlayer === 0 && !this.gameEnded) {
                img.x = dragX;
                img.y = dragY;
            }
        });
        img.on('dragend', (pointer, dropX, dropY, dropped) => {
            if (!card.played && this.activePlayer === 0 && !this.gameEnded) {
                img.setAlpha(1);
                img.x = x;
                img.y = handY;
                if (!dropped) this.draggedCardIdx = null;
            }
        });

        this.input.setDraggable(img);

        this.container.add(img);

        // Affiche les valeurs autour de la carte
        this.drawCardValues(x, handY, cardW, cardH, card);
    });

    // Retire tout listener 'drop' précédent pour éviter les doublons
    this.input.off('drop');

    // Drop zones pour chaque case du plateau
    this.input.on('drop', (pointer, gameObject, dropZone) => {
        if (this.draggedCardIdx !== null && this.activePlayer === 0 && !this.gameEnded) {
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 3; col++) {
                    if (this.boardCells[row][col] === dropZone && !this.board[row][col]) {
                        if (this.isPvP) {
                            // En PvP, on envoie l'action au serveur, pas de modif locale
                            this.socket.emit('tt:playCard', {
                                matchId: this.matchId,
                                playerId: this.playerId,
                                cardIdx: this.draggedCardIdx,
                                row,
                                col
                            });
                            this.draggedCardIdx = null;
                            // On attend la mise à jour du serveur via 'tt:update'
                            return;
                        } else {
                            // Mode IA/local : logique locale
                            const card = { ...this.playerCards[this.draggedCardIdx], owner: "player" };
                            this.playerCards[this.draggedCardIdx].played = true;
                            this.lastPlayedCard = card;
                            this.board[row][col] = card;
                            if (this.sound) this.sound.play('card_place', { volume: 1 });
                            this.activePlayer = 1;
                            this.draggedCardIdx = null;

                            // --- Animation de pose PUIS flips ---
                            const cardW = Math.min(60, width / 8);
                            const cardH = cardW * 1.5;
                            const cellW = (width * 0.80) / 3;
                            const cellH = cellW * 1.5;
                            const boardW = cellW * 3;
                            const boardX = width / 2 - boardW / 2;
                            const boardY = cardW * 1.5 * .72 + ((height - cardW * 1.5 * .72 - (cardW * 1.5 + 24)) - cellH * 3) / 2;
                            const toX = boardX + col * cellW + cellW / 2;
                            const toY = boardY + row * cellH + cellH / 2;
                            const fromX = startX + this.draggedCardIdx * (cardW + 8);
                            const fromY = handY;

                            this.animateCardPlacement(card, fromX, fromY, toX, toY, 0x99ccff, () => {
                                // Ajoute la vraie carte sur le plateau AVANT les flips
                                const cellRect = this.add.rectangle(toX, toY, cellW - 8, cellH - 8, 0x626262, 1)
                                    .setOrigin(0.5)
                                    .setStrokeStyle(7, 0x3399ff);
                                this.container.add(cellRect);

                                const img = this.add.image(toX, toY, `item_${card.image}`)
                                    .setDisplaySize(cellW * 0.9, cellH * 0.9)
                                    .setOrigin(0.5);
                                this.container.add(img);

                                // Puis lance les flips
                                this.captureCards(row, col, card, true, () => {
                                    this.redrawAll();
                                    if (this.isBoardFull()) {
                                        this.endGame();
                                    } else {
                                        this.time.delayedCall(600, () => this.aiPlay(), [], this);
                                    }
                                });
                            });
                            return;
                        }
                    }
                }
            }
        }
    });
}

animateCardPlacement(card, fromX, fromY, toX, toY, tint, onComplete) {
    const { width, height } = this.sys.game.canvas;
    const cellW = (width * 0.80) / 3;
    const cellH = cellW * 1.5;

    const img = this.add.image(fromX, fromY, `item_${card.image}`)
        .setDisplaySize(cellW * 0.9, cellH * 0.9)
        .setOrigin(0.5)
        .setDepth(1000);
    if (this.sound) this.sound.play('card_place', { volume: 1 });

    this.tweens.add({
        targets: img,
        x: toX,
        y: toY,
        displayWidth: cellW * 0.99,
        displayHeight: cellH * 0.99,
        duration: 320,
        ease: 'Cubic.easeOut',
        onComplete: () => {
            this.tweens.add({
                targets: img,
                displayWidth: cellW * 0.9,
                displayHeight: cellH * 0.9,
                duration: 120,
                ease: 'Bounce.easeOut',
                onComplete: () => {
                    img.clearTint();
                    img.destroy();
                    if (onComplete) onComplete();
                }
            });
        }
    });
}


animateCapture(row, col, newOwner, onComplete) {
    const { width, height } = this.sys.game.canvas;
    const cardW = Math.min(60, width / 8);
    const cellW = (width * 0.80) / 3;
    const cellH = cellW * 1.5;
    const boardW = cellW * 3;
    const boardX = width / 2 - boardW / 2;
    const boardY = cardW * 1.5 * .72 + ((height - cardW * 1.5 * .72 - (cardW * 1.5 + 24)) - cellH * 3) / 2;
    const x = boardX + col * cellW + cellW / 2;
    const y = boardY + row * cellH + cellH / 2;
    let cardImg = null, cellRect = null;
    this.container.iterate(child => {
        if (
            child.texture &&
            child.x === x &&
            child.y === y &&
            Math.abs(child.displayWidth - cellW * 0.9) < 2
        ) cardImg = child;
        if (
            child.width === cellW - 8 &&
            child.height === cellH - 8 &&
            child.x === x &&
            child.y === y
        ) cellRect = child;
    });
    if (!cardImg) return;

    cardImg.setDisplaySize(cellW * 0.9, cellH * 0.9);
    cardImg.setOrigin(0.5, 0.5);

    // 1. Réduit scaleX à 0 (ferme la carte)
    this.tweens.add({
        targets: cardImg,
        scaleX: 0,
        duration: 220,
        ease: 'Cubic.easeIn',
        onUpdate: () => {
            if (cellRect) cellRect.setAlpha(0.5);
        },
onComplete: () => {
    // 2. Change texture et bordure
    cardImg.setTexture(`item_${this.board[row][col].image}`);
    cardImg.setDisplaySize(cellW * 0.9, cellH * 0.9);
    cardImg.setOrigin(0.5, 0.5);
    if (cellRect) {
        let borderColor = 0xffffff;
        if (newOwner === "player" || newOwner === this.playerId) borderColor = 0x3399ff;
        else if (newOwner === "opponent" || newOwner === this.opponentId) borderColor = 0xff3333;
        cellRect.setStrokeStyle(7, borderColor);
        cellRect.setAlpha(1);
    }
    if (this.sound) this.sound.play('card_capture', { volume: 1 });

    // --- Effet flash ---
    const flashColor = (newOwner === "player" || newOwner === this.playerId) ? 0x3399ff : 0xff3333;
    const flash = this.add.rectangle(x, y, cellW * 0.9, cellH * 0.9, flashColor, 1)
        .setOrigin(0.5)
        .setDepth(cardImg.depth + 1);
    this.container.add(flash);
    this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 180,
        ease: 'Cubic.easeOut',
        onComplete: () => flash.destroy()
    });

    // 3. Réouvre la carte (scaleX 0 → 1.08 → 1)
    this.tweens.add({
        targets: cardImg,
        scaleX: 1.08,
        duration: 200,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
            cardImg.setDisplaySize(cellW * 0.9, cellH * 0.9);
        },
        onComplete: () => {
            this.tweens.add({
                targets: cardImg,
                scaleX: 1,
                duration: 100,
                ease: 'Cubic.easeOut',
                onUpdate: () => {
                    cardImg.setDisplaySize(cellW * 0.9, cellH * 0.9);
                },
                onComplete: () => {
                    cardImg.scaleX = 1;
                    cardImg.setDisplaySize(cellW * 0.9, cellH * 0.9);
                    cardImg.setOrigin(0.5, 0.5);
                    if (onComplete) onComplete();
                }
            });
        }
    });
}
    });
}

applyGlowEffect(img, x, y, cardW, cardH, color = 0xffff00, alpha = 0.22, scale = 1.4) {
    const glowW = cardW * scale;
    const glowH = cardH * scale;
    const steps = 22;

    // Crée le RenderTexture centré sur (x, y)
    const rt = this.add.renderTexture(x, y, glowW, glowH).setOrigin(0.5, 0.5);

    for (let i = steps; i > 0; i--) {
        const t = i / steps;
        const ellipseW = glowW * t;
        const ellipseH = glowH * t;
        const stepAlpha = alpha * t * t;
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(color, stepAlpha);
        g.fillEllipse(glowW / 2, glowH / 2, ellipseW, ellipseH);
        rt.draw(g, 0, 0);
        g.destroy();
    }
    rt.setDepth(img.depth ? img.depth - 1 : -100);
    this.container.add(rt);

    // Effet de pulsation doux
    this.tweens.add({
        targets: rt,
        alpha: { from: 0.7, to: 1 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
    });
}

    // Capture logique avec animation
captureCards(row, col, card, animate = false, onAllFlipsDone) {
    const dirs = [
        { dr: -1, dc: 0, self: "powerUp", opp: "powerDown" },
        { dr: 1, dc: 0, self: "powerDown", opp: "powerUp" },
        { dr: 0, dc: -1, self: "powerLeft", opp: "powerRight" },
        { dr: 0, dc: 1, self: "powerRight", opp: "powerLeft" }
    ];

    const ruleMethods = this.getActiveRules();
    let specialFlips = [];
    for (const rule of ruleMethods) {
        console.log(`[TripleTriad] Appel de la méthode de règle : ${rule.name}`);
        const flips = rule(row, col, card);
        if (flips && flips.length) specialFlips.push(...flips);
    }

    let flipsToDo = 0, flipsDone = 0;
    const flips = [];
    for (const { dr, dc, self, opp } of dirs) {
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
            const neighbor = this.board[nr][nc];
            if (neighbor && neighbor.owner !== card.owner) {
                if (parseInt(card[self]) > parseInt(neighbor[opp])) {
                    const previousOwner = neighbor.owner;
                    neighbor.owner = card.owner;
                    if (animate) {
                        flipsToDo++;
                        flips.push({ nr, nc, owner: card.owner });
                    }
                    // MAJ SCORE SELON LA NOUVELLE RÈGLE
                    if (card.owner === "player" || card.owner === this.playerId) {
                        this.playerScore++;
                        this.opponentScore--;
                    } else {
                        this.opponentScore++;
                        this.playerScore--;
                    }
                }
            }
        }
    }
    if (animate && flipsToDo > 0) {
        flips.forEach(flip => {
            this.animateCapture(flip.nr, flip.nc, flip.owner, () => {
                flipsDone++;
                if (flipsDone === flipsToDo && onAllFlipsDone) onAllFlipsDone();
            });
        });
    } else if (onAllFlipsDone) {
        onAllFlipsDone();
    }
}
showStartingArrow(startingPlayer, onComplete) {
    const { width, height } = this.sys.game.canvas;
    // Crée la flèche (triangle épais)
    const arrowLength = Math.min(width, height) * 0.17;
    const baseWidth = arrowLength * 0.83; // Largeur de la base (plus large que haut)
    const graphics = this.add.graphics({ x: width / 2, y: height / 2 });

    // Dégradé simulé : plusieurs triangles du plus clair au plus foncé
    const steps = 18;
    for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        // Interpolation de couleur du jaune clair au jaune foncé
        const color = Phaser.Display.Color.Interpolate.ColorWithColor(
            new Phaser.Display.Color(255, 255, 180),   // jaune très clair
            new Phaser.Display.Color(240, 210, 60),    // jaune clair
            steps - 1,
            i
        );
        const hex = Phaser.Display.Color.GetColor(color.r, color.g, color.b);
        graphics.fillStyle(hex, 1);

        // Triangle légèrement plus petit à chaque itération
        const l = arrowLength * (1 - t * 0.18);
        const w = baseWidth * (1 - t * 0.18);

        graphics.beginPath();
        graphics.moveTo(0, -l / 2);
        graphics.lineTo(w / 2, l / 2);
        graphics.lineTo(-w / 2, l / 2);
        graphics.closePath();
        graphics.fillPath();
    }

    graphics.lineStyle(5, 0x222222, 1);
    graphics.beginPath();
    graphics.moveTo(0, -arrowLength / 2);
    graphics.lineTo(baseWidth / 2, arrowLength / 2);
    graphics.lineTo(-baseWidth / 2, arrowLength / 2);
    graphics.closePath();
    graphics.strokePath();

    graphics.setDepth(9999);

    // Détermine l'angle cible (0 = haut, 180 = bas)
    const targetAngle = startingPlayer === 0 ? 180 : 0;
    const spins = 5 + Math.floor(Math.random() * 2); // 3 ou 4 tours complets
    const totalAngle = 360 * spins + targetAngle;
       // --- Joue le son pendant la rotation ---
    if (this.sound) this.sound.play('tripleTriadArrow', { volume: 1 });
    this.tweens.add({
        targets: graphics,
        angle: totalAngle,
        duration: 1400,
        ease: 'Cubic.easeOut',
        onComplete: () => {
            // Petit effet de scale pour l'arrêt
            this.tweens.add({
                targets: graphics,
                scale: { from: 1.3, to: 1 },
                duration: 220,
                yoyo: true,
                onComplete: () => {
                    this.time.delayedCall(700, () => {
                        graphics.destroy();
                        if (onComplete) onComplete();
                    });
                }
            });
        }
    });
}

aiPlay() {
    if (this.activePlayer !== 1 || this.gameEnded) return;
    // IA joue une carte au hasard sur une case libre
    const available = [];
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
            if (!this.board[row][col]) available.push({ row, col });
        }
    }
    const cardIdx = this.opponentCards.findIndex(c => !c.played);
    if (available.length && cardIdx !== -1) {
        const pos = available[Math.floor(Math.random() * available.length)];
        const card = { ...this.opponentCards[cardIdx], owner: "opponent" };
        this.opponentCards[cardIdx].played = true;
        this.lastPlayedCard = card;
        this.board[pos.row][pos.col] = card;

        // --- Animation de pose PUIS flips ---
        let poseDone = false;
        let flipsDone = false;

        const finish = () => {
            if (poseDone && flipsDone && this.activePlayer === 1) {
                this.activePlayer = 0;
                this.redrawAll();
                if (this.isBoardFull()) this.endGame();
                else this.time.delayedCall(600, () => this.aiPlay(), [], this);
            }
        };

        const { width, height } = this.sys.game.canvas;
        const cardW = Math.min(60, width / 8);
        const cardH = cardW * 1.5;
        const cellW = (width * 0.80) / 3;
        const cellH = cellW * 1.5;
        const boardW = cellW * 3;
        const boardX = width / 2 - boardW / 2;
        const boardY = cardW * 1.5 * .72 + ((height - cardW * 1.5 * .72 - (cardW * 1.5 + 24)) - cellH * 3) / 2;
        const toX = boardX + pos.col * cellW + cellW / 2;
        const toY = boardY + pos.row * cellH + cellH / 2;

        // 1. Animation de pose
        this.animateCardPlacement(card, toX, -cardH, toX, toY, 0xff9999, () => {
            poseDone = true;
            finish();
        });

        // 2. Flips/captures (lancés en même temps, mais finish n'appelle redrawAll que quand les deux sont faits)
        this.captureCards(pos.row, pos.col, card, true, () => {
            flipsDone = true;
            finish();
        });
    }
}

endGame() {
        this.gameEnded = true;
        const playerScore = this.playerScore;
        const opponentScore = this.opponentScore;
        let resultText = "";
        let color = "#fff";
        let musicKey = null;
        console.log(`Fin de partie : Joueur ${playerScore} - Adversaire ${opponentScore}`);
        if (playerScore > opponentScore) {
            resultText = "VICTOIRE";
            color = "#33ff33";
            musicKey = "victoryMusic";
        } else if (playerScore < opponentScore) {
            resultText = "DEFAITE";
            color = "#ff3333";
            musicKey = "defeatMusic";
        } else {
            resultText = "EGALITÉ";
            color = "#ffff33";
            musicKey = "defeatMusic";
        }
        const { width, height } = this.sys.game.canvas;
        this.endText = this.add.text(width / 2, height / 2, resultText, {
            font: `bold ${Math.round(width * 0.13)}px Arial`,
            fill: color,
            stroke: "#000",
            strokeThickness: 8
        }).setOrigin(0.5).setAlpha(0).setScale(0.7);

        this.container.add(this.endText);
        MusicManager.stop();
        MusicManager.play(this, musicKey, { loop: false, volume: 0.7 });

        // Animation d'apparition du texte de fin
        this.tweens.add({
            targets: this.endText,
            alpha: 1,
            scale: 1,
            duration: 420,
            ease: 'Back.easeOut'
        });
    this.showEndAndFadeOut();
    }


showEndAndFadeOut() {
const { width, height } = this.sys.game.canvas;
this.time.delayedCall(4300, () => {
    const fadeRect = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0)
        .setOrigin(0.5)
        .setDepth(9999);
    this.tweens.add({
        targets: fadeRect,
        alpha: 1,
        duration: 700,
        onComplete: () => {
            this.cleanUp();
            this.scene.stop();
            MusicManager.stop();
            this.scene.resume("GameScene");
        }
    });
});
}

cleanUp() {
    // Détruit tous les objets graphiques
    if (this.container) {
        // Stoppe tous les tweens sur les enfants du container
        this.container.iterate(child => {
            if (child && child.active) {
                this.tweens.killTweensOf(child);
            }
        });
        this.container.destroy(true);
        this.container = null;
    }
    // Réinitialise les variables d'état
    this.board = this.createEmptyBoard();
    this.playerCards = [];
    this.opponentCards = [];
    this.activePlayer = 0;
    this.draggedCardIdx = null;
    this.boardCells = [];
    this.lastPlayedCard = null;
    this.endText = null;
    this.gameEnded = false;
    this.playerScore = 5;
    this.opponentScore = 5;
    // Retire les listeners éventuels
    window.removeEventListener("resize", this._resizeHandler);
    this.input.off('drop');
    if (this.socket) {
        this.socket.off('tt:update');
        this.socket.off('tt:matchReady');
    }
}

drawCardValues(x, y, w, h, card) {
        const valueFont = `${Math.round(w * 0.38)}px Arial`;
        // Haut
        this.container.add(this.add.text(x, y - h / 2 + 16, card.powerUp, {
            font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 6
        }).setOrigin(0.5, 1));
        // Bas
        this.container.add(this.add.text(x, y + h / 2 - 16, card.powerDown, {
            font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 6
        }).setOrigin(0.5, 0));
        // Gauche
        this.container.add(this.add.text(x - w / 2 + 14, y, card.powerLeft, {
            font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 6
        }).setOrigin(1, 0.5));
        // Droite
        this.container.add(this.add.text(x + w / 2 - 14, y, card.powerRight, {
            font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 6
        }).setOrigin(0, 0.5));
    }


handleCellClick(row, col) {
    // Si la case est déjà occupée, on ne fait rien
    if (this.board[row][col]) return;

    // Si aucune carte n'est sélectionnée, on ne fait rien
    if (this.draggedCardIdx === null) return;

    // PvP : on envoie l'action au serveur
    if (this.isPvP) {
        // Vérifie que c'est bien le tour du joueur
        if (this.activePlayer !== 0) return; // 0 = joueur local, 1 = adversaire

        this.socket.emit('tt:playCard', {
            matchId: this.matchId,
            playerId: this.playerId,
            cardIdx: this.draggedCardIdx,
            row,
            col
        });
        this.draggedCardIdx = null;
        // On attend la mise à jour du serveur (pas de modif locale ici)
        return;
    }
        // Logique pour poser une carte sur la grille
    if (this.board[row][col] === null && this.activePlayer === 0) {
        const cardToPlay = this.playerCards.find(card => !card.played);
        if (cardToPlay) {
            this.board[row][col] = cardToPlay;
            cardToPlay.played = true;
            if (this.sound) this.sound.play('card_place', { volume: 1 });
            this.activePlayer = 1;
            this.redrawAll();
        }
    }
    // Lancer le tour de l'IA si besoin
    if (this.mode === "ai") {
        this.time.delayedCall(600, () => this.aiPlay());
    }
}

handlePlayerCardClick(cardIdx) {
        // Logique pour sélectionner une carte à jouer
        if (this.activePlayer === 0) {
            const card = this.playerCards[cardIdx];
            if (card && !card.played) {
                // Met à jour l'état de la carte et redessine
                card.played = true;
                this.activePlayer = 1;
                this.redrawAll();
            }
        }
    }

drawCardDetail(card, width, height) {
        // Affiche uniquement les chiffres dans la partie inférieure droite
        const detailW = Math.min(120, width * 0.28);
        const detailH = detailW * 1.5;
        const x = width - detailW - 24;
        const y = height - detailH - 24;

        const statFont = `${Math.round(detailH * 0.22)}px Arial`;
        // Haut
        this.container.add(this.add.text(x + detailW / 2, y + 12, card.powerUp, {
            font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 6
        }).setOrigin(0.5, 0));
        // Bas
        this.container.add(this.add.text(x + detailW / 2, y + detailH - 12, card.powerDown, {
            font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 6
        }).setOrigin(0.5, 1));
        // Gauche
        this.container.add(this.add.text(x + 12, y + detailH / 2, card.powerLeft, {
            font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 6
        }).setOrigin(1, 0.5));
        // Droite
        this.container.add(this.add.text(x + detailW - 12, y + detailH / 2, card.powerRight, {
            font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 6
        }).setOrigin(0, 0.5));
    }

isBoardFull() {
        for (let row = 0; row < 3; row++)
            for (let col = 0; col < 3; col++)
                if (!this.board[row][col]) return false;
        return true;
    }

generateMatchId() {
        // Utilise timestamp + random pour éviter les collisions
        return `tt-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    }

ruleSame(row, col, card) {
    // Debug : affiche les infos de la carte posée et des voisins
    console.log(`[Identique] Test pour carte posée en (${row},${col})`, card);

    const dirs = [
        { dr: -1, dc: 0, self: "powerUp", opp: "powerDown", name: "haut" },
        { dr: 1, dc: 0, self: "powerDown", opp: "powerUp", name: "bas" },
        { dr: 0, dc: -1, self: "powerLeft", opp: "powerRight", name: "gauche" },
        { dr: 0, dc: 1, self: "powerRight", opp: "powerLeft", name: "droite" }
    ];
    let matches = [];
    for (const { dr, dc, self, opp, name } of dirs) {
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
            const neighbor = this.board[nr][nc];
            if (neighbor) {
                console.log(`[Identique] Voisin ${name} (${nr},${nc})`, neighbor, 
                    `| Valeur posée: ${card[self]}, Valeur voisine: ${neighbor[opp]}, Owner: ${neighbor.owner}`);
            } else {
                console.log(`[Identique] Voisin ${name} (${nr},${nc}) : vide`);
            }
            // On ne considère que les cartes adverses
            if (neighbor && neighbor.owner !== card.owner) {
                if (parseInt(card[self]) === parseInt(neighbor[opp])) {
                    console.log(`[Identique] MATCH côté ${name} : ${card[self]} == ${neighbor[opp]}`);
                    matches.push({ row: nr, col: nc, owner: card.owner });
                }
            }
        }
    }
    console.log(`[Identique] Nombre de matches adverses : ${matches.length}`, matches);
    if (matches.length >= 2) {
        console.log(`[Identique] RÈGLE ACTIVÉE : retourne`, matches);
        return matches;
    }
    console.log(`[Identique] RÈGLE NON ACTIVÉE`);
    return [];
}
}