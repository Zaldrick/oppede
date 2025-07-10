import { TRIPLE_TRIAD_CONSTANTS } from './TripleTriadConstants.js';
import { TripleTriadUtils } from './TripleTriadUtils.js';

/**
 * Gestionnaire du plateau de jeu Triple Triad
 * Gère l'état du plateau, les cartes posées et les interactions
 */
export class TripleTriadBoardManager {
    
    constructor(scene) {
        this.scene = scene;
        this.board = TripleTriadUtils.createEmptyBoard();
        this.playerCards = [];
        this.opponentCards = [];
        this.activePlayer = 0; // 0: joueur, 1: adversaire
        this.draggedCardIdx = null;
        this.boardCells = [];
        this.playerScore = 5;
        this.opponentScore = 5;
        this.gameEnded = false;
    }
    
    /**
     * Initialise le plateau avec les cartes des joueurs
     */
    initialize(playerCards, opponentCards, activePlayer = TRIPLE_TRIAD_CONSTANTS.PLAYERS.PLAYER) {
        this.board = TripleTriadUtils.createEmptyBoard();
        this.playerCards = [...playerCards];
        this.opponentCards = opponentCards || TripleTriadUtils.generateRandomAICards();
        this.activePlayer = activePlayer;
        this.gameEnded = false;
        this.playerScore = TRIPLE_TRIAD_CONSTANTS.SCORES.INITIAL_PLAYER;
        this.opponentScore = TRIPLE_TRIAD_CONSTANTS.SCORES.INITIAL_OPPONENT;
        this.boardCells = [];
    }
    
    /**
     * Place une carte sur le plateau
     */
    placeCard(row, col, cardIndex, owner) {
        if (!TripleTriadUtils.isCellEmpty(this.board, row, col)) {
            return { success: false, error: 'Cell not empty' };
        }
        
        const cards = owner === "player" ? this.playerCards : this.opponentCards;
        const card = cards[cardIndex];
        
        if (!card || card.played) {
            return { success: false, error: 'Invalid card' };
        }
        
        // Marquer la carte comme jouée
        card.played = true;
        
        // Placer sur le plateau avec le bon propriétaire
        const placedCard = { ...card, owner };
        this.board[row][col] = placedCard;
        
        return { 
            success: true, 
            placedCard,
            position: { row, col }
        };
    }
    
    /**
     * Obtient l'état actuel du jeu
     */
    getGameState() {
        return {
            board: TripleTriadUtils.cloneBoard(this.board),
            playerCards: [...this.playerCards],
            opponentCards: [...this.opponentCards],
            playerScore: this.playerScore,
            opponentScore: this.opponentScore,
            activePlayer: this.activePlayer,
            gameEnded: this.gameEnded,
            isBoardFull: TripleTriadUtils.isBoardFull(this.board)
        };
    }
    
    /**
     * Met à jour l'état du jeu (pour le mode PvP)
     */
    updateGameState(newState) {
        this.board = newState.board || this.board;
        this.playerCards = newState.playerCards || this.playerCards;
        this.opponentCards = newState.opponentCards || this.opponentCards;
        this.playerScore = newState.playerScore !== undefined ? newState.playerScore : this.playerScore;
        this.opponentScore = newState.opponentScore !== undefined ? newState.opponentScore : this.opponentScore;
        this.activePlayer = newState.activePlayer !== undefined ? newState.activePlayer : this.activePlayer;
        this.gameEnded = newState.gameEnded !== undefined ? newState.gameEnded : this.gameEnded;
    }
    
    /**
     * Change le joueur actif
     */
    switchActivePlayer() {
        this.activePlayer = this.activePlayer === TRIPLE_TRIAD_CONSTANTS.PLAYERS.PLAYER ? 
            TRIPLE_TRIAD_CONSTANTS.PLAYERS.OPPONENT : 
            TRIPLE_TRIAD_CONSTANTS.PLAYERS.PLAYER;
    }
    
    /**
     * Obtient les positions disponibles pour jouer
     */
    getAvailableCards(owner) {
        const cards = owner === "player" ? this.playerCards : this.opponentCards;
        return cards.filter(card => !card.played);
    }
    
    /**
     * Obtient les cartes disponibles pour un joueur
     */
    getAvailableCards(owner) {
        const cards = owner === "player" ? this.playerCards : this.opponentCards;
        return cards.filter(card => !card.played);
    }
    
    /**
     * Trouve l'index de la première carte disponible
     */
    getFirstAvailableCardIndex(owner) {
        const cards = owner === "player" ? this.playerCards : this.opponentCards;
        return cards.findIndex(card => !card.played);
    }
    
    /**
     * Vérifie si un joueur peut jouer
     */
    canPlayerMove(owner) {
        return this.getAvailableCards(owner).length > 0 && 
               this.getAvailablePositions().length > 0 && 
               !this.gameEnded;
    }
    
    /**
     * Vérifie si c'est le tour d'un joueur spécifique
     */
    isPlayerTurn(owner) {
        const playerIndex = owner === "player" ? 
            TRIPLE_TRIAD_CONSTANTS.PLAYERS.PLAYER : 
            TRIPLE_TRIAD_CONSTANTS.PLAYERS.OPPONENT;
        return this.activePlayer === playerIndex;
    }
    
    /**
     * Met à jour les scores
     */
    updateScores(playerScore, opponentScore) {
        this.playerScore = playerScore;
        this.opponentScore = opponentScore;
    }
    
    /**
     * Termine la partie
     */
    endGame() {
        this.gameEnded = true;
    }
    
    /**
     * Réinitialise le plateau pour une nouvelle partie
     */
    reset() {
        this.board = TripleTriadUtils.createEmptyBoard();
        this.playerCards.forEach(card => card.played = false);
        this.opponentCards.forEach(card => card.played = false);
        this.playerScore = TRIPLE_TRIAD_CONSTANTS.SCORES.INITIAL_PLAYER;
        this.opponentScore = TRIPLE_TRIAD_CONSTANTS.SCORES.INITIAL_OPPONENT;
        this.activePlayer = TRIPLE_TRIAD_CONSTANTS.PLAYERS.PLAYER;
        this.gameEnded = false;
        this.boardCells = [];
    }
    
    /**
     * Obtient les informations d'une cellule du plateau
     */
    getCellInfo(row, col) {
        if (!TripleTriadUtils.isValidPosition(row, col)) {
            return null;
        }
        
        return {
            card: this.board[row][col],
            isEmpty: !this.board[row][col],
            position: { row, col },
            phaserObject: this.boardCells[row] ? this.boardCells[row][col] : null
        };
    }
    
    /**
     * Stocke les objets Phaser des cellules du plateau
     */
    setBoardCells(cells) {
        this.boardCells = cells;
    }
    
    /**
     * Trouve la cellule Phaser correspondant à une position
     */
    findBoardCell(row, col) {
        return this.boardCells[row] ? this.boardCells[row][col] : null;
    }
    
    /**
     * Trouve la position d'une cellule Phaser
     */
    findCellPosition(cellObject) {
        for (let row = 0; row < TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE; row++) {
            for (let col = 0; col < TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE; col++) {
                if (this.boardCells[row] && this.boardCells[row][col] === cellObject) {
                    return { row, col };
                }
            }
        }
        return null;
    }
    
    /**
     * Obtient des statistiques de la partie
     */
    getGameStats() {
        const totalCards = TRIPLE_TRIAD_CONSTANTS.CARDS.HAND_SIZE * 2;
        const cardsPlayed = this.playerCards.filter(c => c.played).length + 
                           this.opponentCards.filter(c => c.played).length;
        
        return {
            totalCards,
            cardsPlayed,
            cardsRemaining: totalCards - cardsPlayed,
            playerCardsLeft: this.getAvailableCards("player").length,
            opponentCardsLeft: this.getAvailableCards("opponent").length,
            boardFillPercentage: Math.round((cardsPlayed / 9) * 100),
            playerScore: this.playerScore,
            opponentScore: this.opponentScore,
            gameEnded: this.gameEnded
        };
    }
}