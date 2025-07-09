import { TRIPLE_TRIAD_CONSTANTS } from './TripleTriadConstants.js';
import { TripleTriadUtils } from './TripleTriadUtils.js';

/**
 * Intelligence Artificielle pour Triple Triad
 * G�re la logique de jeu de l'adversaire IA
 */
export class TripleTriadAIPlayer {
    
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty;
        this.thinkingTime = this.getThinkingTime();
    }
    
    /**
     * Obtient le temps de r�flexion selon la difficult�
     */
    getThinkingTime() {
        switch (this.difficulty) {
            case 'easy': return { min: 800, max: 1500 };
            case 'medium': return { min: 600, max: 1200 };
            case 'hard': return { min: 400, max: 800 };
            default: return { min: 600, max: 1200 };
        }
    }
    
    /**
     * Choisit le meilleur coup pour l'IA
     */
    chooseMove(board, availableCards, rules, gameState) {
        const availablePositions = TripleTriadUtils.getAvailablePositions(board);
        
        if (availablePositions.length === 0 || availableCards.length === 0) {
            return null;
        }
        
        let bestMove = null;
        let bestScore = -Infinity;
        
        // �value chaque combinaison carte/position possible
        availableCards.forEach((card, cardIndex) => {
            availablePositions.forEach(position => {
                const score = this.evaluateMove(board, position, card, rules, gameState);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = {
                        cardIndex,
                        position,
                        score
                    };
                }
            });
        });
        
        // Ajoute un peu d'al�atoire selon la difficult�
        if (this.difficulty === 'easy' && Math.random() < 0.3) {
            return this.getRandomMove(availableCards, availablePositions);
        }
        
        return bestMove;
    }
    
    /**
     * �value la qualit� d'un coup
     */
    evaluateMove(board, position, card, rules, gameState) {
        const { row, col } = position;
        let score = 0;
        
        // Simule le placement de la carte
        const simulatedBoard = TripleTriadUtils.cloneBoard(board);
        const placedCard = { ...card, owner: "opponent" };
        simulatedBoard[row][col] = placedCard;
        
        // Points pour les captures directes
        const directCaptures = this.countDirectCaptures(simulatedBoard, row, col, placedCard);
        score += directCaptures * 10;
        
        // Points pour les r�gles sp�ciales
        const specialCaptures = this.countSpecialCaptures(simulatedBoard, row, col, placedCard, rules);
        score += specialCaptures * 15;
        
        // Points pour la position strat�gique
        score += this.evaluatePosition(row, col) * 3;
        
        // Points pour la d�fense (emp�cher le joueur de capturer)
        score += this.evaluateDefense(board, position, gameState.playerCards) * 5;
        
        // Malus si la carte peut �tre facilement captur�e
        score -= this.evaluateVulnerability(simulatedBoard, row, col, placedCard) * 8;
        
        return score;
    }
    
    /**
     * Compte les captures directes possibles
     */
    countDirectCaptures(board, row, col, card) {
        let captures = 0;
        
        const directions = [
            { dr: -1, dc: 0, self: "powerUp", opp: "powerDown" },
            { dr: 1, dc: 0, self: "powerDown", opp: "powerUp" },
            { dr: 0, dc: -1, self: "powerLeft", opp: "powerRight" },
            { dr: 0, dc: 1, self: "powerRight", opp: "powerLeft" }
        ];
        
        directions.forEach(dir => {
            const nr = row + dir.dr;
            const nc = col + dir.dc;
            
            if (TripleTriadUtils.isValidPosition(nr, nc)) {
                const neighbor = board[nr][nc];
                if (neighbor && neighbor.owner === "player") {
                    if (parseInt(card[dir.self]) > parseInt(neighbor[dir.opp])) {
                        captures++;
                    }
                }
            }
        });
        
        return captures;
    }
    
    /**
     * Compte les captures via r�gles sp�ciales
     */
    countSpecialCaptures(board, row, col, card, rules) {
        let specialCaptures = 0;
        
        if (rules.same) {  // ? CORRECTION : "same" au lieu de "identique"
            specialCaptures += this.evaluateIdenticalRule(board, row, col, card);
        }
        
        if (rules.plus) {
            specialCaptures += this.evaluatePlusRule(board, row, col, card);
        }
        
        if (rules.murale) {
            specialCaptures += this.evaluateWallRule(board, row, col, card);
        }
        
        return specialCaptures;
    }
    
    /**
     * �value la r�gle "Identique"
     */
    evaluateIdenticalRule(board, row, col, card) {
        const directions = [
            { dr: -1, dc: 0, self: "powerUp", opp: "powerDown" },
            { dr: 1, dc: 0, self: "powerDown", opp: "powerUp" },
            { dr: 0, dc: -1, self: "powerLeft", opp: "powerRight" },
            { dr: 0, dc: 1, self: "powerRight", opp: "powerLeft" }
        ];
        
        let matches = 0;
        
        directions.forEach(dir => {
            const nr = row + dir.dr;
            const nc = col + dir.dc;
            
            if (TripleTriadUtils.isValidPosition(nr, nc)) {
                const neighbor = board[nr][nc];
                if (neighbor && neighbor.owner === "player") {
                    if (parseInt(card[dir.self]) === parseInt(neighbor[dir.opp])) {
                        matches++;
                    }
                }
            }
        });
        
        return matches >= 2 ? matches : 0;
    }
    
    /**
     * �value la r�gle "Plus"
     */
    evaluatePlusRule(board, row, col, card) {
        const directions = [
            { dr: -1, dc: 0, self: "powerUp", opp: "powerDown" },
            { dr: 1, dc: 0, self: "powerDown", opp: "powerUp" },
            { dr: 0, dc: -1, self: "powerLeft", opp: "powerRight" },
            { dr: 0, dc: 1, self: "powerRight", opp: "powerLeft" }
        ];
        
        let sums = [];
        
        directions.forEach(dir => {
            const nr = row + dir.dr;
            const nc = col + dir.dc;
            
            if (TripleTriadUtils.isValidPosition(nr, nc)) {
                const neighbor = board[nr][nc];
                if (neighbor && neighbor.owner === "player") {
                    const sum = parseInt(card[dir.self]) + parseInt(neighbor[dir.opp]);
                    sums.push(sum);
                }
            }
        });
        
        // Compte les paires avec m�me somme
        let pairs = 0;
        for (let i = 0; i < sums.length; i++) {
            for (let j = i + 1; j < sums.length; j++) {
                if (sums[i] === sums[j]) {
                    pairs++;
                }
            }
        }
        
        return pairs;
    }
    
    /**
     * �value la r�gle "Murale"
     */
    evaluateWallRule(board, row, col, card) {
        const directions = [
            { dr: -1, dc: 0, self: "powerUp", opp: "powerDown" },
            { dr: 1, dc: 0, self: "powerDown", opp: "powerUp" },
            { dr: 0, dc: -1, self: "powerLeft", opp: "powerRight" },
            { dr: 0, dc: 1, self: "powerRight", opp: "powerLeft" }
        ];
        
        let wallMatches = 0;
        let cardMatches = 0;
        
        directions.forEach(dir => {
            const nr = row + dir.dr;
            const nc = col + dir.dc;
            
            if (!TripleTriadUtils.isValidPosition(nr, nc)) {
                // C'est un mur
                if (parseInt(card[dir.self]) === TRIPLE_TRIAD_CONSTANTS.RULES.WALL_VALUE) {
                    wallMatches++;
                }
            } else {
                const neighbor = board[nr][nc];
                if (neighbor && neighbor.owner === "player") {
                    if (parseInt(card[dir.self]) === parseInt(neighbor[dir.opp])) {
                        cardMatches++;
                    }
                }
            }
        });
        
        return (wallMatches > 0 && cardMatches > 0) ? cardMatches : 0;
    }
    
    /**
     * �value la valeur strat�gique d'une position
     */
    evaluatePosition(row, col) {
        // Le centre vaut plus
        if (row === 1 && col === 1) return 5;
        
        // Les coins valent moins
        if ((row === 0 || row === 2) && (col === 0 || col === 2)) return 1;
        
        // Les bords valent moyennement
        return 3;
    }
    
    /**
     * �value la valeur d�fensive d'un coup
     */
    evaluateDefense(board, position, playerCards) {
        let defensiveValue = 0;
        
        // V�rifie si cette position emp�che le joueur de faire un bon coup
        playerCards.filter(card => !card.played).forEach(playerCard => {
            const playerCaptures = this.countDirectCaptures(board, position.row, position.col, 
                { ...playerCard, owner: "player" });
            defensiveValue += playerCaptures;
        });
        
        return defensiveValue;
    }
    
    /**
     * �value la vuln�rabilit� d'une carte plac�e
     */
    evaluateVulnerability(board, row, col, card) {
        let vulnerability = 0;
        
        const directions = [
            { dr: -1, dc: 0, self: "powerUp", opp: "powerDown" },
            { dr: 1, dc: 0, self: "powerDown", opp: "powerUp" },
            { dr: 0, dc: -1, self: "powerLeft", opp: "powerRight" },
            { dr: 0, dc: 1, self: "powerRight", opp: "powerLeft" }
        ];
        
        directions.forEach(dir => {
            const nr = row + dir.dr;
            const nc = col + dir.dc;
            
            if (TripleTriadUtils.isValidPosition(nr, nc) && !board[nr][nc]) {
                // Position libre o� le joueur pourrait placer une carte
                vulnerability += this.getAveragePlayerCardStrength(dir.opp);
            }
        });
        
        return vulnerability;
    }
    
    /**
     * Obtient la force moyenne des cartes du joueur pour une direction
     */
    getAveragePlayerCardStrength(direction) {
        // Approximation : la plupart des cartes ont des valeurs entre 1 et 10
        return 5; // Valeur moyenne estim�e
    }
    
    /**
     * Choisit un coup al�atoire (pour la difficult� facile)
     */
    getRandomMove(availableCards, availablePositions) {
        const randomCardIndex = Math.floor(Math.random() * availableCards.length);
        const randomPosition = availablePositions[Math.floor(Math.random() * availablePositions.length)];
        
        return {
            cardIndex: randomCardIndex,
            position: randomPosition,
            score: 0
        };
    }
    
    /**
     * Simule un d�lai de r�flexion r�aliste
     */
    getThinkingDelay() {
        const { min, max } = this.thinkingTime;
        return min + Math.random() * (max - min);
    }
    
    /**
     * D�finit la difficult� de l'IA
     */
    setDifficulty(difficulty) {
        this.difficulty = difficulty;
        this.thinkingTime = this.getThinkingTime();
    }
    
    /**
     * Obtient des statistiques sur l'IA
     */
    getAIStats() {
        return {
            difficulty: this.difficulty,
            thinkingTime: this.thinkingTime,
            version: '1.0.0'
        };
    }
}