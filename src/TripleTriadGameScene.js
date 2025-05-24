import Phaser from "phaser";

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
    }

    init(data) {
        this.isPvP = data.mode === "pvp";
        this.matchId = data.matchId || null;
        this.playerId = data.playerId;
        this.opponentId = data.opponentId;
        this.playerCards = data.playerCards || [];
        this.opponentCards = data.opponentCards || [];
        this.board = this.createEmptyBoard();
        this.activePlayer = 0;
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

        this.socket.emit('tt:startMatch', {
            matchId: this.matchId,
            playerId: this.playerId,
            opponentId: this.opponentId,
            playerCards: this.playerCards
        });

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

        this.socket.on('tt:update', ({ state }) => {
            this.board = state.board;
            this.activePlayer = state.turn === this.playerId ? 0 : 1;
            this.redrawAll();
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
    if (this.container) this.container.destroy();
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
            this.container.add(
                this.add.image(x, y, card.image)
                    .setDisplaySize(cardW, cardH)
                    .setOrigin(0.5)
                    .setAlpha(card.played ? 0.3 : 1)
            );
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
            this.add.rectangle(width / 2, boardY + boardH / 2, boardW, boardH, 0x222244, 0.95)
                .setOrigin(0.5)
                .setStrokeStyle(4, 0xffffff)
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
                let cellColor = 0x333366;
                let cellAlpha = 0.85;
                if (card) {
                    if (card.owner === "player") cellColor = 0x99ccff;
                    else if (card.owner === "opponent") cellColor = 0xffbbbb;
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
                        .setOrigin(0.5);
                    // Pas de tint sur la carte !
                    this.container.add(img);

                    // Affiche les valeurs en bas à droite de la carte posée, resserré et petit, sans cadre
                    const valueW = cellW * 0.28;
                    const valueH = cellH * 0.28;
                    const dx = x + cellW * 0.9 / 2 - valueW ;
                    const dy = y + cellH * 0.9 / 2 - valueH ;
                    const statFont = `${Math.round(valueH * 0.34)}px Arial`;

                    // Haut
                    this.container.add(this.add.text(dx + valueW / 2, dy + 4, card.powerUp, {
                        font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 2
                    }).setOrigin(0.5, 0));
                    // Bas
                    this.container.add(this.add.text(dx + valueW / 2, dy + valueH - 4, card.powerDown, {
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
        if (this.endText) {
            this.container.add(this.endText);
        }
    }

    drawScores(width, height) {
        // Score joueur en bas à droite, adversaire en haut à droite
        const playerScore = this.countOwnedCards("player");
        const opponentScore = this.countOwnedCards("opponent");
        const fontSize = Math.round(width * 0.1);

        // Joueur
        this.container.add(this.add.text(width *.96, height*.92, `${playerScore}`, {
            font: `${fontSize}px Arial`,
            fill: "#3399ff",
            fontStyle: "bold"
        }).setOrigin(1, 1));

        // Adversaire
        this.container.add(this.add.text(width *.96, height*.05, `${opponentScore}`, {
            font: `${fontSize}px Arial`,
            fill: "#ff3333",
            fontStyle: "bold"
        }).setOrigin(1, 0));
    }

    countOwnedCards(owner) {
        let count = 0;
        for (let row = 0; row < 3; row++)
            for (let col = 0; col < 3; col++)
                if (this.board[row][col] && this.board[row][col].owner === owner)
                    count++;
        return count;
    }

    drawPlayerHand() {
        const { width, height } = this.sys.game.canvas;
        const cardW = Math.min(60, width / 8);
        const cardH = cardW * 1.5;
        const handY = height - cardH - 20; // Remonte la main du joueur
        const startX = width / 2 - ((cardW + 8) * 5 - 8) / 2;

        this.playerCards.forEach((card, i) => {
            const x = startX + i * (cardW + 8);
            const img = this.add.image(x, handY, card.image)
                .setDisplaySize(cardW, cardH)
                .setOrigin(0.5)
                .setAlpha(card.played ? 0.3 : 1)
                .setInteractive({ draggable: !card.played && this.activePlayer === 0 });

            // Effet de survol (hover/touch)
            img.on('pointerover', () => {
                if (!card.played && this.activePlayer === 0) {
                    this.tweens.add({
                        targets: img,
                        scale: 1.12,
                        duration: 120,
                        ease: 'Quad.easeOut'
                    });
                }
            });
            img.on('pointerout', () => {
                if (!card.played && this.activePlayer === 0) {
                    this.tweens.add({
                        targets: img,
                        scale: 1,
                        duration: 120,
                        ease: 'Quad.easeIn'
                    });
                }
            });

            // Drag events
            img.on('dragstart', (pointer) => {
                if (!card.played && this.activePlayer === 0) {
                    this.draggedCardIdx = i;
                    img.setAlpha(0.7);
                }
            });
            img.on('drag', (pointer, dragX, dragY) => {
                if (!card.played && this.activePlayer === 0) {
                    img.x = dragX;
                    img.y = dragY;
                }
            });
            img.on('dragend', (pointer, dropX, dropY, dropped) => {
                if (!card.played && this.activePlayer === 0) {
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
                            // Pose directe sans animation pour le joueur local
                            const card = { ...this.playerCards[this.draggedCardIdx], owner: "player" };
                            this.playerCards[this.draggedCardIdx].played = true;
                            this.lastPlayedCard = card;
                            this.board[row][col] = card;
                            // Capture logique
                            this.captureCards(row, col, card, true);
                            this.activePlayer = 1;
                            this.draggedCardIdx = null;
                            this.redrawAll();
                            // Vérifie fin de partie
                            if (this.isBoardFull()) {
                                this.endGame();
                            } else {
                                // Déclenche le tour IA après un court délai
                                this.time.delayedCall(600, () => this.aiPlay(), [], this);
                            }
                            return;
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

    // Animation de capture : pulse + flash couleur
    animateCapture(row, col, newOwner) {
        const { width, height } = this.sys.game.canvas;
        const cardW = Math.min(60, width / 8);
        const cellW = (width * 0.80) / 3;
        const cellH = cellW * 1.5;
        const boardW = cellW * 3;
        const boardX = width / 2 - boardW / 2;
        const boardY = cardW*1.5*.72 + ((height - cardW*1.5*.72 - (cardW*1.5 + 24)) - cellH*3) / 2;
        const x = boardX + col * cellW + cellW / 2;
        const y = boardY + row * cellH + cellH / 2;

        // Ajoute un effet visuel temporaire
        const flash = this.add.rectangle(x, y, cellW * 0.9, cellH * 0.9, newOwner === "player" ?  0x3399ff : 0xff3333, 0.5)
            .setOrigin(0.5)
            .setDepth(1001);
        this.tweens.add({
            targets: flash,
            alpha: 0,
            scale: 1.3,
            duration: 350,
            ease: 'Cubic.easeOut',
            onComplete: () => flash.destroy()
        });
    }

    // Capture logique avec animation
    captureCards(row, col, card, animate = false) {
        const dirs = [
            { dr: -1, dc: 0, self: "powerUp", opp: "powerDown" },    // haut
            { dr: 1, dc: 0, self: "powerDown", opp: "powerUp" },     // bas
            { dr: 0, dc: -1, self: "powerLeft", opp: "powerRight" }, // gauche
            { dr: 0, dc: 1, self: "powerRight", opp: "powerLeft" }   // droite
        ];
        for (const { dr, dc, self, opp } of dirs) {
            const nr = row + dr, nc = col + dc;
            if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
                const neighbor = this.board[nr][nc];
                if (neighbor && neighbor.owner !== card.owner) {
                    if (parseInt(card[self]) > parseInt(neighbor[opp])) {
                        neighbor.owner = card.owner;
                        if (animate) this.animateCapture(nr, nc, card.owner);
                    }
                }
            }
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
            // Animation IA (similaire à animateCardPlacement, mais plus simple)
            this.animateCardPlacementAI(card, pos.row, pos.col, () => {
                this.board[pos.row][pos.col] = card;
                // Capture logique IA avec animation
                this.captureCards(pos.row, pos.col, card, true);
                this.activePlayer = 0;
                this.redrawAll();
                // Vérifie fin de partie
                if (this.isBoardFull()) {
                    this.endGame();
                }
            });
        }
    }

    endGame() {
        this.gameEnded = true;
        const playerScore = this.countOwnedCards("player");
        const opponentScore = this.countOwnedCards("opponent");
        let resultText = "";
        let color = "#fff";
        if (playerScore > opponentScore) {
            resultText = "VICTOIRE";
            color = "#33ff33";
        } else if (playerScore < opponentScore) {
            resultText = "DEFAITE";
            color = "#ff3333";
        } else {
            resultText = "EGALITÉ";
            color = "#ffff33";
        }
        const { width, height } = this.sys.game.canvas;
        this.endText = this.add.text(width / 2, height / 2, resultText, {
            font: `bold ${Math.round(width * 0.13)}px Arial`,
            fill: color,
            stroke: "#000",
            strokeThickness: 8
        }).setOrigin(0.5).setAlpha(0).setScale(0.7);

        this.container.add(this.endText);

        // Animation d'apparition du texte de fin
        this.tweens.add({
            targets: this.endText,
            alpha: 1,
            scale: 1,
            duration: 420,
            ease: 'Back.easeOut'
        });

        // Quitte la scène après 2.5s
        this.time.delayedCall(2500, () => {
            this.cleanUp();
            this.scene.stop();
            this.scene.resume("GameScene");
        });
    }

cleanUp() {
    // Détruit tous les objets graphiques
    if (this.container) {
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

    // Retire les listeners éventuels
    window.removeEventListener("resize", this._resizeHandler);
    this.input.off('drop');
}

    drawCardValues(x, y, w, h, card) {
        const valueFont = `${Math.round(w * 0.38)}px Arial`;
        // Haut
        this.container.add(this.add.text(x, y - h / 2 + 16, card.powerUp, {
            font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 4
        }).setOrigin(0.5, 1));
        // Bas
        this.container.add(this.add.text(x, y + h / 2 - 16, card.powerDown, {
            font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 4
        }).setOrigin(0.5, 0));
        // Gauche
        this.container.add(this.add.text(x - w / 2 + 14, y, card.powerLeft, {
            font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 4
        }).setOrigin(1, 0.5));
        // Droite
        this.container.add(this.add.text(x + w / 2 - 14, y, card.powerRight, {
            font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 4
        }).setOrigin(0, 0.5));
    }

    drawUI() {
        const { width, height } = this.sys.game.canvas;
        // Ajoute ici les scores, le tour, etc.
        this.container.add(
            this.add.text(width / 2, height*0.15, `Tour: ${this.activePlayer === 0 ? "Joueur" : "Adversaire"}`, {
                font: `${Math.round(width * 0.04)}px Arial`,
                fill: "#fff",
                fontStyle: "bold"
            }).setOrigin(0.5)
        );
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
            font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 3
        }).setOrigin(0.5, 0));
        // Bas
        this.container.add(this.add.text(x + detailW / 2, y + detailH - 12, card.powerDown, {
            font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 3
        }).setOrigin(0.5, 1));
        // Gauche
        this.container.add(this.add.text(x + 12, y + detailH / 2, card.powerLeft, {
            font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 3
        }).setOrigin(1, 0.5));
        // Droite
        this.container.add(this.add.text(x + detailW - 12, y + detailH / 2, card.powerRight, {
            font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 3
        }).setOrigin(0, 0.5));
    }

    isBoardFull() {
        for (let row = 0; row < 3; row++)
            for (let col = 0; col < 3; col++)
                if (!this.board[row][col]) return false;
        return true;
    }
}