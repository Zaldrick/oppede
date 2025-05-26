import Phaser from "phaser";
import MusicManager from './MusicManager';

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
        this.load.image('ifrit', 'assets/cards/ifrit.png');
        this.load.image('shiva', 'assets/cards/shiva.png');
        this.load.image('odin', 'assets/cards/odin.png');
        this.load.image('chocobo', 'assets/cards/chocobo.png');
        this.load.image('sephiroth', 'assets/cards/sephiroth.png');
        this.load.image('bahamut', 'assets/cards/bahamut.png');
        this.load.image('cloud', 'assets/cards/cloud.png');
        this.load.image('zidane', 'assets/cards/zidane.png');
        this.load.image('squall', 'assets/cards/squall.png');
        this.load.image('malboro', 'assets/cards/malboro.png');
        this.load.image('bomb', 'assets/cards/bomb.png');
        this.load.image('lightning', 'assets/cards/lightning.png');
        this.load.image('tidus', 'assets/cards/tidus.png');
        this.load.image('tomberry', 'assets/cards/tomberry.png');
        this.load.image('back', 'assets/cards/back.png');
        
        this.load.audio('tripleTriadMusic', 'assets/musics/tripleTriadMusic.mp3');
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
        this.socket = this.registry.get("socket");
        if (!this.socket) {
            // Fallback pour debug si jamais le registry n'est pas set
            this.socket = window.socket;
        }
            if (data.mode === "ai" && (!this.opponentCards || this.opponentCards.length === 0)) {
        // Prends 5 cartes aléatoires différentes parmi toutes les cartes possibles
        const allCards = [
            { image: 'ifrit', powerUp: 7, powerDown: 2, powerLeft: 6, powerRight: 3 },
            { image: 'shiva', powerUp: 5, powerDown: 7, powerLeft: 2, powerRight: 6 },
            { image: 'odin', powerUp: 6, powerDown: 5, powerLeft: 7, powerRight: 2 },
            { image: 'chocobo', powerUp: 3, powerDown: 6, powerLeft: 5, powerRight: 7 },
            { image: 'sephiroth', powerUp: 8, powerDown: 8, powerLeft: 8, powerRight: 8 },
            { image: 'bahamut', powerUp: 7, powerDown: 8, powerLeft: 6, powerRight: 7 },
            { image: 'cloud', powerUp: 6, powerDown: 7, powerLeft: 7, powerRight: 6 },
            { image: 'zidane', powerUp: 5, powerDown: 6, powerLeft: 8, powerRight: 5 },
            { image: 'squall', powerUp: 7, powerDown: 5, powerLeft: 6, powerRight: 8 },
            { image: 'malboro', powerUp: 4, powerDown: 7, powerLeft: 5, powerRight: 6 },
            { image: 'bomb', powerUp: 6, powerDown: 4, powerLeft: 7, powerRight: 5 },
            { image: 'lightning', powerUp: 8, powerDown: 5, powerLeft: 4, powerRight: 7 },
            { image: 'tidus', powerUp: 5, powerDown: 8, powerLeft: 6, powerRight: 4 },
            { image: 'tomberry', powerUp: 4, powerDown: 6, powerLeft: 5, powerRight: 8 }
        ];
        // Mélange et prend 5 cartes
        this.opponentCards = Phaser.Utils.Array.Shuffle(allCards).slice(0, 5).map(card => ({ ...card, played: false }));
    }
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
                }
            });
        });
        
        this.socket.emit('tt:startMatch', {
            matchId: this.matchId,
            playerId: this.playerId,
            opponentId: this.opponentId,
            playerCards: this.playerCards
        });

this.socket.on('tt:update', ({ state }) => {
    const previousBoard = JSON.parse(JSON.stringify(this.board));
    this.board = state.board;
    this.activePlayer = state.turn === this.playerId ? 0 : 1;
    this.lastState = state;
    this.playerScore = state.scores?.[this.playerId] ?? 0;
    this.opponentScore = state.scores?.[this.opponentId] ?? 0;
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

        let animsToDo = 0;
        let poseToDo = 0;
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const prev = previousBoard[row][col];
                const curr = this.board[row][col];
                if (!prev && curr) {
                    animsToDo++;
                    poseToDo++; // Compte les poses
                } else if (prev && curr && prev.owner !== curr.owner) {
                    animsToDo++;
                }
            }
        }

        let animsDone = 0;
        let poseDone = 0;
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const prev = previousBoard[row][col];
                const curr = this.board[row][col];
                if (!prev && curr) {
                    this.animateCardPlacement(
                        curr, row, col, curr.owner === this.playerId ? "player" : "opponent",
                        () => {
                            animsDone++;
                            poseDone++;
                            // Si flips à venir, redraw tout de suite après la pose pour afficher la carte posée
                            if (animsToDo > poseToDo && poseDone === poseToDo) {
                                this.redrawAll();
                            }
                            if (animsDone === animsToDo) this.redrawAll();
                        }
                    );
                } else if (prev && curr && prev.owner !== curr.owner) {
                    this.animateCapture(
                        row, col, curr.owner === this.playerId ? "player" : "opponent",
                        () => {
                            animsDone++;
                            if (animsDone === animsToDo) this.redrawAll();
                        }
                    );
                }
            }
        }

    // Si aucune animation, redraw tout de suite
    if (animsToDo === 0) {
        this.redrawAll();
    }

    MusicManager.play(this, 'tripleTriadMusic', { loop: true, volume: 0.5 });

    // Si le serveur indique que la partie est finie, affiche le résultat
    if (state.gameEnded) {
        console.log("[TripleTriad] Fin de partie reçue !", state.scores, state);

        // Sécurité : si pas de scores, force le calcul local (en dernier recours)
        let myScore = state.scores?.[this.playerId];
        let oppScore = state.scores?.[this.opponentId];
        if (myScore === undefined || oppScore === undefined) {
            // Fallback ultra défensif (devrait être inutile si serveur ok)
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
});



    } else {
        // Mode IA : pas d'attente
        this.resize();
        this.drawBackground();
        this.drawOpponentHand();
        this.drawBoard();
        this.drawPlayerHand();
        this.drawUI();
        this.setupResizeListener();
        this.lastPlayedCard = null;
        this.endText = null;
        this.gameEnded = false;
        MusicManager.play(this, 'tripleTriadMusic', { loop: true, volume: 0.5 });
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
    this.drawUI();
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


             const img = this.add.image(x, y, card.image)
                .setDisplaySize(cardW, cardH)
                .setOrigin(0.5)
                .setAlpha(card.played ? 0.3 : 1);

            if (this.activePlayer === 1 && !card.played && !this.gameEnded) {
                this.applyGlowEffect(img, x, y, cardW, cardH, 0xeacbcb, 0.5, 1.03);
               img.setTint(0xeacbcb); // Optionnel : teinte pour l'adversaire
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
                let cellAlpha = 0.7;
                if (card) {
                    if (this.isPvP) {
                        if (card.owner === this.playerId) cellColor = 0x99ccff;
                        else if (card.owner === this.opponentId) cellColor = 0xffbbbb;
                    } else {
                        if (card.owner === "player") cellColor = 0x99ccff;
                        else if (card.owner === "opponent") cellColor = 0xffbbbb;
                    }
                    cellAlpha = 0.55;
                }
                const cell = this.add.rectangle(x, y, cellW - 8, cellH - 8, cellColor, cellAlpha)
                    .setOrigin(0.5)
                    .setStrokeStyle(2, 0xffffff)
                    .setInteractive({ dropZone: true });
                this.container.add(cell);
                this.boardCells[row][col] = cell;

                // Affiche la carte posée si besoin
                if (card) {
                    const img = this.add.image(x, y, card.image)
                        .setDisplaySize(cellW * 0.9, cellH * 0.9)
                        .setOrigin(0.5)
                        .clearTint();
                    // Pas de tint sur la carte !
                    this.container.add(img);

                    // Affiche les valeurs en bas à droite de la carte posée, resserré et petit, sans cadre
                    const valueW = cellW * 0.28;
                    const valueH = cellH * 0.28;
                    const dx = x + cellW * 0.9 / 2 - valueW ;
                    const dy = y + cellH * 0.9 / 2 - valueH ;
                    const statFont = `${Math.round(valueH * 0.55)}px Arial`;

                    // Haut
                    this.container.add(this.add.text(dx + valueW / 2, dy - 6, card.powerUp, {
                        font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 2
                    }).setOrigin(0.5, 0));
                    // Bas
                    this.container.add(this.add.text(dx + valueW / 2, dy + valueH + 6, card.powerDown, {
                        font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 2
                    }).setOrigin(0.5, 1));
                    // Gauche
                    this.container.add(this.add.text(dx + 9, dy + valueH / 2, card.powerLeft, {
                        font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 2
                    }).setOrigin(1, 0.5));
                    // Droite
                    this.container.add(this.add.text(dx + valueW - 9, dy + valueH / 2, card.powerRight, {
                        font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 2
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
        const img = this.add.image(x, handY, card.image)
            .setDisplaySize(cardW, cardH)
            .setOrigin(0.5)
            .setAlpha(card.played ? 0.3 : 1)
            .setInteractive({ draggable: !card.played && this.activePlayer === 0 && !this.gameEnded });

           // --- Effet lumineux si c'est au joueur de jouer et la carte n'est pas jouée ---
        if (this.activePlayer === 0 && !card.played && !this.gameEnded) {
                this.applyGlowEffect(img, x, handY, cardW, cardH, 0xcbe2ea, 0.5, 1.12);
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
                            this.redrawAll();
                            // --- ATTEND LA FIN DES FLIPS AVANT REDRAW ET TOUR IA ---
                            this.captureCards(row, col, card, true, () => {
                                this.redrawAll();
                                if (this.isBoardFull()) {
                                    this.endGame();
                                } else {
                                    this.time.delayedCall(600, () => this.aiPlay(), [], this);
                                }
                            });
                            return;
                        }
                    }
                }
            }
        }
    });
}

    // Animation de pose de carte (vol depuis la main vers la case)
    animateCardPlacement(card, row, col, owner, onComplete) {
        const { width, height } = this.sys.game.canvas;
        const cardW = Math.min(60, width / 8);
        const cardH = cardW * 1.5;
        const handY = height - cardH - 20;
        const startX = width / 2 - ((cardW + 8) * 5 - 8) / 2;
        const fromX = startX + this.draggedCardIdx * (cardW + 8);
        const fromY = handY;

        // Destination sur le plateau
        const cellW = (width * 0.80) / 3;
        const cellH = cellW * 1.5;
        const boardW = cellW * 3;
        const boardH = cellH * 3;
        const boardX = width / 2 - boardW / 2;
        const boardY = cardH*.72 + ((height - cardH*.72 - (cardH + 24)) - boardH) / 2;
        const toX = boardX + col * cellW + cellW / 2;
        const toY = boardY + row * cellH + cellH / 2;

        const img = this.add.image(fromX, fromY, card.image)
            .setDisplaySize(cardW, cardH)
            .setOrigin(0.5)
            .setDepth(1000);
        img.setTint(owner === "player" ? 0x99ccff : 0xff9999);
        if (this.sound) this.sound.play('card_place', { volume: 1 });
        this.tweens.add({
            targets: img,
            x: toX,
            y: toY,
            scale: { from: 1, to: 1.1 },
            duration: 320,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: img,
                    scale: 1,
                    duration: 120,
                    ease: 'Bounce.easeOut',
                    onComplete: () => {
                        img.destroy();
                        if (onComplete) onComplete();
                    }
                });
            }
        });
    }

    // Animation de pose IA (depuis le haut)
    animateCardPlacementAI(card, row, col, onComplete) {
        const { width, height } = this.sys.game.canvas;
        const cardW = Math.min(60, width / 8);
        const cardH = cardW * 1.5;
        const cellW = (width * 0.80) / 3;
        const cellH = cellW * 1.5;
        const boardW = cellW * 3;
        const boardH = cellH * 3;
        const boardX = width / 2 - boardW / 2;
        const boardY = cardH*.72 + ((height - cardH*.72 - (cardH + 24)) - boardH) / 2;
        const toX = boardX + col * cellW + cellW / 2;
        const toY = boardY + row * cellH + cellH / 2;

        const img = this.add.image(toX, -cardH, card.image)
            .setDisplaySize(cardW, cardH)
            .setOrigin(0.5)
            .setDepth(1000);
        img.setTint(0xff9999);
        if (this.sound) this.sound.play('card_place', { volume: 1 });
        this.tweens.add({
            targets: img,
            y: toY,
            scale: { from: 1, to: 1.1 },
            duration: 320,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: img,
                    scale: 1,
                    duration: 120,
                    ease: 'Bounce.easeOut',
                    onComplete: () => {
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

    // Cherche l'image de la carte sur le plateau
    let cardImg = null;
    this.container.iterate(child => {
        if (child.texture && child.x === x && child.y === y && child.displayWidth === cellW * 0.9) {
            cardImg = child;
        }
    });
    if (!cardImg) return;

    // Animation de flip 360°
    this.tweens.add({
        targets: cardImg,
        scaleX: 0,
        duration: 220,
        ease: 'Cubic.easeIn',
        onComplete: () => {
            // Change la texture au milieu du flip
            cardImg.setTexture(this.board[row][col].image);
            cardImg.setTint(newOwner === "player" ? 0x99ccff : 0xffbbbb);
            if (this.sound) this.sound.play('card_capture', { volume: 1 });
            // Optionnel : petit flash couleur
            const flash = this.add.rectangle(x, y, cellW * 0.9, cellH * 0.9, newOwner === "player" ? 0x3399ff : 0xff3333, 0.5)
                .setOrigin(0.5)
                .setDepth(1001);
            this.tweens.add({
                targets: cardImg,
                scaleX: 1,
                duration: 220,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    cardImg.scaleX = 1;
                    cardImg.displayWidth = cellW * 0.9;
                    cardImg.displayHeight = cellH * 0.9;
                    cardImg.clearTint();
                    this.tweens.add({
                        targets: flash,
                        alpha: 0,
                        scale: 1.3,
                        duration: 350,
                        ease: 'Cubic.easeOut',
                        onComplete: () => {
                            flash.destroy();
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
        // --- AJOUTE LA CARTE AU BOARD AVANT LES ANIMATIONS ---
        this.board[pos.row][pos.col] = card;
        // --- Compte les animations à faire (pose + flips) ---
        let animsToDo = 1; // la pose
        let animsDone = 0;
        // On simule la capture pour savoir combien de flips il y aura
        const dirs = [
            { dr: -1, dc: 0, self: "powerUp", opp: "powerDown" },
            { dr: 1, dc: 0, self: "powerDown", opp: "powerUp" },
            { dr: 0, dc: -1, self: "powerLeft", opp: "powerRight" },
            { dr: 0, dc: 1, self: "powerRight", opp: "powerLeft" }
        ];
        for (const { dr, dc, self, opp } of dirs) {
            const nr = pos.row + dr, nc = pos.col + dc;
            if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
                const neighbor = this.board[nr][nc];
                if (neighbor && neighbor.owner !== card.owner) {
                    if (parseInt(card[self]) > parseInt(neighbor[opp])) {
                        animsToDo++;
                    }
                }
            }
        }



        // Fonction de fin de tour IA, appelée UNE SEULE FOIS quand toutes les anims sont faites
        const finish = () => {
            if (this.activePlayer !== 1) return; // Empêche double appel
            this.activePlayer = 0;
            this.redrawAll();
            if (this.isBoardFull()) this.endGame();
            else this.time.delayedCall(600, () => this.aiPlay(), [], this);
        };

        // --- Animation de pose ---
        this.animateCardPlacementAI(card, pos.row, pos.col, () => {
            animsDone++;
            // S'il y a des flips à faire, redraw tout de suite pour afficher la carte IA sur le plateau
            if (animsToDo > 1 && animsDone === 1) {
                this.redrawAll();
            }
            if (animsDone === animsToDo) finish();
        });

        // --- Animation de capture (chaque flip appelle ce callback) ---
        // On modifie captureCards pour qu'elle appelle le callback autant de fois qu'il y a de flips
        this.captureCards(pos.row, pos.col, card, true, () => {
            animsDone++;
            if (animsDone === animsToDo) finish();
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

    drawUI() {
        /*const { width, height } = this.sys.game.canvas;
        // Ajoute ici les scores, le tour, etc.
        this.container.add(
            this.add.text(width / 2, height*0.15, `Tour: ${this.activePlayer === 0 ? "Joueur" : "Adversaire"}`, {
                font: `${Math.round(width * 0.04)}px Arial`,
                fill: "#fff",
                fontStyle: "bold"
            }).setOrigin(0.5)
        );*/
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
}