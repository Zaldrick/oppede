import { TRIPLE_TRIAD_CONSTANTS } from './TripleTriadConstants.js';

/**
 * Fonctions utilitaires pour Triple Triad
 */
export class TripleTriadUtils {
    
    /**
     * Crée un plateau vide 3x3
     */
    static createEmptyBoard() {
        return Array.from({ length: TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE }, () => 
            Array(TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE).fill(TRIPLE_TRIAD_CONSTANTS.BOARD.EMPTY_VALUE)
        );
    }
    
    /**
     * Vérifie si le plateau est plein
     */
    static isBoardFull(board) {
        for (let row = 0; row < TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE; row++) {
            for (let col = 0; col < TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE; col++) {
                if (!board[row][col]) return false;
            }
        }
        return true;
    }
    
    /**
     * Compte les cartes possédées par un joueur
     */
    static countOwnedCards(board, owner, isPvP = false, playerId = null, opponentId = null) {
        let count = 0;
        for (let row = 0; row < TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE; row++) {
            for (let col = 0; col < TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE; col++) {
                const card = board[row][col];
                if (card) {
                    if (isPvP) {
                        if (owner === "player" && card.owner === playerId) count++;
                        else if (owner === "opponent" && card.owner === opponentId) count++;
                    } else {
                        if (card.owner === owner) count++;
                    }
                }
            }
        }
        return count;
    }
    
    /**
     * Génère un ID de match unique
     */
    static generateMatchId() {
        return `tt-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    }
    
    /**
     * Calcule les dimensions des cartes selon l'écran
     */
    static calculateCardDimensions(screenWidth) {
        const cardWidth = Math.min(60, screenWidth * TRIPLE_TRIAD_CONSTANTS.CARDS.MAX_WIDTH_RATIO);
        const cardHeight = cardWidth * TRIPLE_TRIAD_CONSTANTS.CARDS.ASPECT_RATIO;
        return { cardWidth, cardHeight };
    }
    
    /**
     * Calcule les dimensions des cellules du plateau
     */
    static calculateBoardDimensions(screenWidth, screenHeight) {
        const { cardWidth, cardHeight } = this.calculateCardDimensions(screenWidth);
        const cellWidth = (screenWidth * TRIPLE_TRIAD_CONSTANTS.VISUAL_BOARD.WIDTH_RATIO) / TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE;
        const cellHeight = cellWidth * TRIPLE_TRIAD_CONSTANTS.CARDS.ASPECT_RATIO;
        
        const topMargin = cardHeight * TRIPLE_TRIAD_CONSTANTS.LAYOUT.TOP_MARGIN_RATIO;
        const bottomMargin = cardHeight + TRIPLE_TRIAD_CONSTANTS.LAYOUT.BOTTOM_MARGIN;
        const availableHeight = screenHeight - topMargin - bottomMargin;
        
        const boardWidth = cellWidth * TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE;
        const boardHeight = cellHeight * TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE;
        const boardX = screenWidth / 2 - boardWidth / 2;
        const boardY = topMargin + (availableHeight - boardHeight) / 2;
        
        return {
            cellWidth,
            cellHeight,
            boardWidth,
            boardHeight,
            boardX,
            boardY,
            topMargin,
            bottomMargin
        };
    }
    
    /**
     * Calcule la position d'une cellule du plateau
     */
    static getBoardCellPosition(row, col, boardDimensions) {
        const { boardX, boardY, cellWidth, cellHeight } = boardDimensions;
        return {
            x: boardX + col * cellWidth + cellWidth / 2,
            y: boardY + row * cellHeight + cellHeight / 2
        };
    }
    
    /**
     * Calcule la position de la main du joueur
     */
    static getPlayerHandPosition(screenWidth, screenHeight, cardIndex) {
        const { cardWidth, cardHeight } = this.calculateCardDimensions(screenWidth);
        const handY = screenHeight - cardHeight - TRIPLE_TRIAD_CONSTANTS.LAYOUT.HAND_BOTTOM_MARGIN;
        const spacing = TRIPLE_TRIAD_CONSTANTS.LAYOUT.CARD_SPACING;
        const startX = screenWidth / 2 - ((cardWidth + spacing) * TRIPLE_TRIAD_CONSTANTS.CARDS.HAND_SIZE - spacing) / 2;
        
        return {
            x: startX + cardIndex * (cardWidth + spacing),
            y: handY
        };
    }
    
    /**
     * Calcule la position de la main de l'adversaire
     */
    static getOpponentHandPosition(screenWidth, cardIndex) {
        const { cardWidth, cardHeight } = this.calculateCardDimensions(screenWidth);
        const spacing = TRIPLE_TRIAD_CONSTANTS.LAYOUT.CARD_SPACING;
        const startX = screenWidth / 2 - ((cardWidth + spacing) * TRIPLE_TRIAD_CONSTANTS.CARDS.HAND_SIZE - spacing) / 2;
        const y = cardHeight / 2 + 10;
        
        return {
            x: startX + cardIndex * (cardWidth + spacing),
            y
        };
    }
    
    /**
     * Obtient la couleur de bordure selon le propriétaire
     */
    static getOwnerBorderColor(owner, playerId = null, opponentId = null, isPvP = false) {
        if (isPvP) {
            if (owner === playerId) return TRIPLE_TRIAD_CONSTANTS.COLORS.PLAYER_BORDER;
            if (owner === opponentId) return TRIPLE_TRIAD_CONSTANTS.COLORS.OPPONENT_BORDER;
        } else {
            if (owner === "player") return TRIPLE_TRIAD_CONSTANTS.COLORS.PLAYER_BORDER;
            if (owner === "opponent") return TRIPLE_TRIAD_CONSTANTS.COLORS.OPPONENT_BORDER;
        }
        return TRIPLE_TRIAD_CONSTANTS.COLORS.CELL_BORDER_DEFAULT;
    }
    
    /**
     * Obtient la couleur de lueur selon le joueur
     */
    static getGlowColor(isPlayer) {
        return isPlayer ? 
            TRIPLE_TRIAD_CONSTANTS.COLORS.PLAYER_GLOW : 
            TRIPLE_TRIAD_CONSTANTS.COLORS.OPPONENT_GLOW;
    }
    
    /**
     * Mélange un tableau (Fisher-Yates)
     */
    static shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    /**
     * Sélectionne des cartes aléatoires pour l'IA
     */
    static generateRandomAICards(count = TRIPLE_TRIAD_CONSTANTS.CARDS.HAND_SIZE) {
        const shuffled = this.shuffleArray(TRIPLE_TRIAD_CONSTANTS.DEFAULT_AI_CARDS);
        return shuffled.slice(0, count).map(card => ({ ...card, played: false }));
    }
    
    /**
     * Récupère des cartes aléatoires pour l'IA depuis la BDD
     */
    static async generateRandomAICardsFromDB(difficulty = 'medium', count = TRIPLE_TRIAD_CONSTANTS.CARDS.HAND_SIZE) {
        try {
            const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:5000";
            const response = await fetch(`${apiUrl}/api/cards/ai/random?count=${count}&difficulty=${difficulty}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            // Si la BDD retourne un fallback, utilise les cartes par défaut
            if (data.fallback || !Array.isArray(data)) {
                console.warn('[TripleTriad] Fallback vers cartes par défaut pour l\'IA');
                return this.generateRandomAICards(count);
            }
            
            // Formate les cartes de la BDD
            return data.map(card => ({
                ...card,
                played: false,
                // S'assure que les champs requis existent
                nom: card.nom || card.name || 'Carte Inconnue',
                image: card.image || 'default.png',
                powerUp: parseInt(card.powerUp) || 1,
                powerDown: parseInt(card.powerDown) || 1,
                powerLeft: parseInt(card.powerLeft) || 1,
                powerRight: parseInt(card.powerRight) || 1
            }));
            
        } catch (error) {
            console.error('[TripleTriad] Erreur récupération cartes IA depuis BDD:', error);
            console.log('[TripleTriad] Fallback vers cartes par défaut');
            return this.generateRandomAICards(count);
        }
    }
    
    /**
     * Vérifie si une position est valide sur le plateau
     */
    static isValidPosition(row, col) {
        return row >= 0 && row < TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE && 
               col >= 0 && col < TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE;
    }
    
    /**
     * Vérifie si une cellule est libre
     */
    static isCellEmpty(board, row, col) {
        return this.isValidPosition(row, col) && !board[row][col];
    }
    
    /**
     * Obtient toutes les positions libres du plateau
     */
    static getAvailablePositions(board) {
        const available = [];
        for (let row = 0; row < TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE; row++) {
            for (let col = 0; col < TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE; col++) {
                if (!board[row][col]) {
                    available.push({ row, col });
                }
            }
        }
        return available;
    }
    
    /**
     * Clone profond d'un plateau
     */
    static cloneBoard(board) {
        return board.map(row => row.map(cell => cell ? { ...cell } : null));
    }
}