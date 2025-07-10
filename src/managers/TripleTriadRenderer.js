import { TRIPLE_TRIAD_CONSTANTS } from './TripleTriadConstants.js';
import { TripleTriadUtils } from './TripleTriadUtils.js';

/**
 * Gestionnaire de rendu visuel pour Triple Triad
 * Centralise l'affichage des cartes, du plateau et des interfaces
 */
export class TripleTriadRenderer {
    
    constructor(scene, container) {
        this.scene = scene;
        this.container = container;
        this.glowEffects = new Map(); // Stocke les effets de lueur actifs
    }
    
    /**
     * Dessine l'arrière-plan du jeu
     */
    drawBackground() {
        const { width, height } = this.scene.sys.game.canvas;
        
        const background = this.scene.add.rectangle(
            width / 2, height / 2, width, height, 
            TRIPLE_TRIAD_CONSTANTS.COLORS.BACKGROUND, 0.98
        );
        
        this.container.add(background);
        return background;
    }
    
    /**
     * Dessine le plateau de jeu
     */
    drawBoard(board, boardCells, gameState) {
        const { width, height } = this.scene.sys.game.canvas;
        const boardDimensions = TripleTriadUtils.calculateBoardDimensions(width, height);
        const { cellWidth, cellHeight, boardWidth, boardHeight, boardX, boardY } = boardDimensions;
        
        // Fond du plateau
        const boardBackground = this.scene.add.rectangle(
            width / 2, boardY + boardHeight / 2, boardWidth, boardHeight,
            TRIPLE_TRIAD_CONSTANTS.COLORS.BOARD_BG, 0.95
        ).setOrigin(0.5)
         .setStrokeStyle(4, TRIPLE_TRIAD_CONSTANTS.COLORS.BOARD_BORDER);
        
        this.container.add(boardBackground);
        
        // Grille 3x3
        for (let row = 0; row < TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE; row++) {
            if (!boardCells[row]) boardCells[row] = [];
            
            for (let col = 0; col < TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE; col++) {
                const position = TripleTriadUtils.getBoardCellPosition(row, col, boardDimensions);
                const card = board[row][col];
                
                // Couleur de bordure selon le propriétaire
                let borderColor = TRIPLE_TRIAD_CONSTANTS.COLORS.CELL_BORDER_DEFAULT;
                if (card) {
                    if (gameState.isPvP) {
                        // Mode PvP : utilise les IDs des joueurs
                        if (card.owner === gameState.playerId) borderColor = TRIPLE_TRIAD_CONSTANTS.COLORS.PLAYER_BORDER; // bleu joueur
                        else if (card.owner === gameState.opponentId) borderColor = TRIPLE_TRIAD_CONSTANTS.COLORS.OPPONENT_BORDER; // rouge adversaire
                    } else {
                        // Mode IA : utilise "player" et "opponent"
                        if (card.owner === "player") borderColor = TRIPLE_TRIAD_CONSTANTS.COLORS.PLAYER_BORDER;
                        else if (card.owner === "opponent") borderColor = TRIPLE_TRIAD_CONSTANTS.COLORS.OPPONENT_BORDER;
                    }
                }
                
                // Cellule
                const cell = this.scene.add.rectangle(
                    position.x, position.y,
                    cellWidth - TRIPLE_TRIAD_CONSTANTS.VISUAL_BOARD.CELL_PADDING,
                    cellHeight - TRIPLE_TRIAD_CONSTANTS.VISUAL_BOARD.CELL_PADDING,
                    TRIPLE_TRIAD_CONSTANTS.COLORS.CELL_BG, 1
                ).setOrigin(0.5)
                 .setStrokeStyle(TRIPLE_TRIAD_CONSTANTS.VISUAL_BOARD.BORDER_WIDTH, borderColor)
                 .setInteractive({ dropZone: true });
                
                this.container.add(cell);
                boardCells[row][col] = cell;
                
                // Carte sur la cellule
                if (card) {
                    this.drawCardOnBoard(card, position, cellWidth, cellHeight);
                }
            }
        }
        
        return boardBackground;
    }
    
    /**
     * Dessine une carte sur le plateau
     */
    drawCardOnBoard(card, position, cellWidth, cellHeight) {
        const cardImage = this.scene.add.image(position.x, position.y, `item_${card.image}`)
            .setDisplaySize(
                cellWidth * TRIPLE_TRIAD_CONSTANTS.VISUAL_BOARD.CARD_SCALE,
                cellHeight * TRIPLE_TRIAD_CONSTANTS.VISUAL_BOARD.CARD_SCALE
            ).setOrigin(0.5);
        
        this.container.add(cardImage);
        
        // Valeurs de la carte
        this.drawCardValuesOnBoard(card, position, cellWidth, cellHeight);
        
        return cardImage;
    }
    
    /**
     * Dessine les valeurs d'une carte sur le plateau
     */
    drawCardValuesOnBoard(card, position, cellWidth, cellHeight) {
        const valueWidth = cellWidth * 0.26;
        const valueHeight = cellHeight * 0.26;
        const dx = position.x + cellWidth * TRIPLE_TRIAD_CONSTANTS.VISUAL_BOARD.CARD_SCALE / 2 - valueWidth;
        const dy = position.y + cellHeight * TRIPLE_TRIAD_CONSTANTS.VISUAL_BOARD.CARD_SCALE / 2 - valueHeight;
        const fontSize = Math.round(valueHeight * 0.5);
        const statFont = `${fontSize}px Arial`;
        
        // Haut
        const topValue = this.scene.add.text(dx + valueWidth / 2, dy - 6, card.powerUp, {
            font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 6
        }).setOrigin(0.5, 0);
        
        // Bas
        const bottomValue = this.scene.add.text(dx + valueWidth / 2, dy + valueHeight + 6, card.powerDown, {
            font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 6
        }).setOrigin(0.5, 1);
        
        // Gauche
        const leftValue = this.scene.add.text(dx + 9, dy + valueHeight / 2, card.powerLeft, {
            font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 6
        }).setOrigin(1, 0.5);
        
        // Droite
        const rightValue = this.scene.add.text(dx + valueWidth - 9, dy + valueHeight / 2, card.powerRight, {
            font: statFont, fill: "#fff", stroke: "#000", strokeThickness: 6
        }).setOrigin(0, 0.5);
        
        this.container.add([topValue, bottomValue, leftValue, rightValue]);
        
        return { topValue, bottomValue, leftValue, rightValue };
    }
    
    /**
     * Dessine la main du joueur avec les cartes disponiblesdrawAll
     */
    drawPlayerHand(cards, activePlayer, gameEnded, onCardInteraction) {
        const { width, height } = this.scene.sys.game.canvas;
        const handDimensions = TripleTriadUtils.calculateHandDimensions(width, height);

        // ✅ DEBUG COMPLET
        console.log('[DEBUG] drawPlayerHand - ÉTAT COMPLET:');
        console.log('  activePlayer:', activePlayer);
        console.log('  TRIPLE_TRIAD_CONSTANTS.PLAYERS.PLAYER:', TRIPLE_TRIAD_CONSTANTS.PLAYERS.PLAYER);
        console.log('  gameEnded:', gameEnded);
        console.log('  activePlayer === PLAYER?', activePlayer === TRIPLE_TRIAD_CONSTANTS.PLAYERS.PLAYER);
        console.log('[DEBUG] drawPlayerHand - état des cartes:',
            cards.map((c, i) => `${i}: ${c.nom || c.name} - played: ${c.played}`)); // ✅ AJOUTE LE POINT-VIRGULE

        cards.forEach((card, index) => {
            const x = handDimensions.startX + index * (handDimensions.cardWidth + handDimensions.spacing);
            const y = handDimensions.playerY;

            // ✅ CORRECTION : Vérifie l'état en temps réel
            const canPlay = activePlayer === TRIPLE_TRIAD_CONSTANTS.PLAYERS.PLAYER &&
                !card.played &&
                !gameEnded;

            console.log(`[DEBUG] Carte ${index} - played: ${card.played}, canPlay: ${canPlay}`);

            const cardImage = this.scene.add.image(x, y, `item_${card.image}`)
                .setDisplaySize(handDimensions.cardWidth, handDimensions.cardHeight)
                .setOrigin(0.5)
                .setAlpha(card.played ? 0.3 : 1) // ✅ Alpha selon l'état
                .setInteractive({
                    draggable: canPlay // ✅ Draggable selon l'état
                });

            // ✅ Effet de lueur seulement si jouable
            if (canPlay) {
                this.applyGlowEffect(
                    cardImage, x, y,
                    handDimensions.cardWidth, handDimensions.cardHeight,
                    TRIPLE_TRIAD_CONSTANTS.COLORS.PLAYER_GLOW, 0.5, 1.3
                );
            }

            // ✅ Setup interactions seulement si jouable
            if (onCardInteraction && canPlay) {
                this.setupCardInteraction(cardImage, index, card, onCardInteraction);
            }

            this.container.add(cardImage);
            this.drawCardValues(x, y, handDimensions.cardWidth, handDimensions.cardHeight, card);
        });
    }
    setupCardInteraction(cardImage, cardIndex, card, onCardInteraction) {
        const originalPosition = { x: cardImage.x, y: cardImage.y };

        cardImage.on('dragstart', (pointer) => {
            // ✅ CORRECTION : Vérifie l'état en temps réel depuis le manager
            const currentCard = this.scene.boardManager.playerCards[cardIndex];
            if (currentCard.played) {
                console.log('[DEBUG] Tentative de drag sur carte déjà jouée, annulation');
                return;
            }

            this.scene.gameState.draggedCardIdx = cardIndex;
            cardImage.setAlpha(0.7);
            if (onCardInteraction) onCardInteraction('dragstart', cardIndex, pointer);
        });

        cardImage.on('drag', (pointer, dragX, dragY) => {
            // ✅ Vérifie l'état en temps réel
            const currentCard = this.scene.boardManager.playerCards[cardIndex];
            if (currentCard.played) return;

            cardImage.x = dragX;
            cardImage.y = dragY;
            if (onCardInteraction) onCardInteraction('drag', cardIndex, pointer, dragX, dragY);
        });

        cardImage.on('dragend', (pointer, dropX, dropY, dropped) => {
            // ✅ Vérifie l'état en temps réel
            const currentCard = this.scene.boardManager.playerCards[cardIndex];
            if (currentCard.played) return;

            cardImage.setAlpha(1);
            cardImage.x = originalPosition.x;
            cardImage.y = originalPosition.y;

            if (!dropped) {
                this.scene.gameState.draggedCardIdx = null;
            }

            if (onCardInteraction) {
                onCardInteraction('dragend', cardIndex, pointer, dropX, dropY, dropped);
            }
        });

        this.scene.input.setDraggable(cardImage);
    }
    
    /**
     * Dessine la main de l'adversaire
     */
    drawOpponentHand(opponentCards, activePlayer, gameEnded) {
        const { width } = this.scene.sys.game.canvas;
        const { cardWidth, cardHeight } = TripleTriadUtils.calculateCardDimensions(width);
        
        opponentCards.forEach((card, index) => {
            const position = TripleTriadUtils.getOpponentHandPosition(width, index);
            
            const cardImage = this.scene.add.image(position.x, position.y, `item_${card.image}`)
                .setDisplaySize(cardWidth, cardHeight)
                .setOrigin(0.5)
                .setAlpha(card.played ? 0.3 : 1);
            
            // Effet de lueur seulement si c'est le tour de l'adversaire ET carte non jouée
            if (activePlayer === TRIPLE_TRIAD_CONSTANTS.PLAYERS.OPPONENT && !card.played && !gameEnded) {
                this.applyGlowEffect(
                    cardImage, position.x, position.y, cardWidth, cardHeight,
                    TRIPLE_TRIAD_CONSTANTS.COLORS.OPPONENT_GLOW,
                    TRIPLE_TRIAD_CONSTANTS.CARDS.GLOW_ALPHA,
                    TRIPLE_TRIAD_CONSTANTS.CARDS.GLOW_SCALE
                );
            }
            
            this.container.add(cardImage);
            
            // Valeurs de la carte
            this.drawCardValues(position.x, position.y, cardWidth, cardHeight, card);
        });
    }
    
    /**
     * Dessine les valeurs autour d'une carte
     */
    drawCardValues(x, y, cardWidth, cardHeight, card) {
        const fontSize = Math.round(cardWidth * TRIPLE_TRIAD_CONSTANTS.CARDS.VALUE_FONT_RATIO);
        const valueFont = `${fontSize}px Arial`;
        
        // Haut
        const topValue = this.scene.add.text(x, y - cardHeight / 2 + 16, card.powerUp, {
            font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 6
        }).setOrigin(0.5, 1);
        
        // Bas
        const bottomValue = this.scene.add.text(x, y + cardHeight / 2 - 16, card.powerDown, {
            font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 6
        }).setOrigin(0.5, 0);
        
        // Gauche
        const leftValue = this.scene.add.text(x - cardWidth / 2 + 14, y, card.powerLeft, {
            font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 6
        }).setOrigin(1, 0.5);
        
        // Droite
        const rightValue = this.scene.add.text(x + cardWidth / 2 - 14, y, card.powerRight, {
            font: valueFont, fill: "#fff", stroke: "#000", strokeThickness: 6
        }).setOrigin(0, 0.5);
        
        this.container.add([topValue, bottomValue, leftValue, rightValue]);
        
        return { topValue, bottomValue, leftValue, rightValue };
    }
    
    /**
     * Dessine les scores
     */
    drawScores(playerScore, opponentScore) {
        const { width, height } = this.scene.sys.game.canvas;
        const fontSize = Math.round(width * 0.1);
        
        // Score du joueur (en bas à droite)
        const playerScoreText = this.scene.add.text(
            width * TRIPLE_TRIAD_CONSTANTS.LAYOUT.SCORE_MARGIN.RIGHT,
            height * TRIPLE_TRIAD_CONSTANTS.LAYOUT.SCORE_MARGIN.BOTTOM,
            `${playerScore}`, {
                font: `${fontSize}px Arial`,
                fill: TRIPLE_TRIAD_CONSTANTS.COLORS.PLAYER_BORDER,
                fontStyle: "bold"
            }
        ).setOrigin(1, 1);
        
        // Score de l'adversaire (en haut à droite)
        const opponentScoreText = this.scene.add.text(
            width * TRIPLE_TRIAD_CONSTANTS.LAYOUT.SCORE_MARGIN.RIGHT,
            height * TRIPLE_TRIAD_CONSTANTS.LAYOUT.SCORE_MARGIN.TOP,
            `${opponentScore}`, {
                font: `${fontSize}px Arial`,
                fill: TRIPLE_TRIAD_CONSTANTS.COLORS.OPPONENT_BORDER,
                fontStyle: "bold"
            }
        ).setOrigin(1, 0);
        
        this.container.add([playerScoreText, opponentScoreText]);
        
        return { playerScoreText, opponentScoreText };
    }
    
    /**
     * Applique un effet de lueur à un objet
     */
    applyGlowEffect(targetObject, x, y, cardWidth, cardHeight, color, alpha, scale) {
        const glowKey = `glow_${targetObject.texture.key}_${x}_${y}`;
        
        // Supprime l'ancien effet s'il existe
        if (this.glowEffects.has(glowKey)) {
            const oldGlow = this.glowEffects.get(glowKey);
            oldGlow.renderTexture.destroy();
            if (oldGlow.animation) oldGlow.animation.destroy();
            this.glowEffects.delete(glowKey);
        }
        
        const glowWidth = cardWidth * scale;
        const glowHeight = cardHeight * scale;
        const steps = TRIPLE_TRIAD_CONSTANTS.CARDS.GLOW_STEPS;
        
        const renderTexture = this.scene.add.renderTexture(x, y, glowWidth, glowHeight)
            .setOrigin(0.5, 0.5);
        
        for (let i = steps; i > 0; i--) {
            const t = i / steps;
            const ellipseW = glowWidth * t;
            const ellipseH = glowHeight * t;
            const stepAlpha = alpha * t * t;
            
            const graphics = this.scene.make.graphics({ x: 0, y: 0, add: false });
            graphics.fillStyle(color, stepAlpha);
            graphics.fillEllipse(glowWidth / 2, glowHeight / 2, ellipseW, ellipseH);
            renderTexture.draw(graphics, 0, 0);
            graphics.destroy();
        }
        
        renderTexture.setDepth(targetObject.depth ? targetObject.depth - 1 : -100);
        this.container.add(renderTexture);
        
        // Animation de pulsation
        const glowAnimation = this.scene.tweens.add({
            targets: renderTexture,
            alpha: { from: 0.7, to: 1 },
            duration: TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.GLOW.DURATION,
            yoyo: true,
            repeat: -1,
            ease: TRIPLE_TRIAD_CONSTANTS.ANIMATIONS.GLOW.EASE
        });
        
        this.glowEffects.set(glowKey, { renderTexture, animation: glowAnimation });
        
        return { renderTexture, animation: glowAnimation };
    }
    
    /**
     * Supprime tous les effets de lueur
     */
    clearAllGlowEffects() {
        this.glowEffects.forEach((glow, key) => {
            glow.renderTexture.destroy();
            if (glow.animation) glow.animation.destroy();
        });
        this.glowEffects.clear();
    }
    
    /**
     * Nettoie le rendu
     */
    cleanup() {
        this.clearAllGlowEffects();
        if (this.container) {
            this.container.removeAll(true);
        }
    }
}