import { TRIPLE_TRIAD_CONSTANTS, DIRECTIONS_ARRAY } from './TripleTriadConstants.js';
import { TripleTriadUtils } from './TripleTriadUtils.js';

/**
 * Moteur de règles pour Triple Triad
 * Gère toutes les règles spéciales et la logique de capture
 */
export class TripleTriadRulesEngine {
    
    constructor(rules = TRIPLE_TRIAD_CONSTANTS.RULES.DEFAULT) {
        this.rules = { ...rules };
    }
    
    /**
     * Applique toutes les captures après qu'une carte soit posée
     */
    captureCards(board, row, col, card, gameState, onCaptureComplete = null) {
        const captures = {
            classic: [],
            special: [],
            combo: []
        };
        
        // 1. Vérifier les règles spéciales d'abord
        if (this.rules.same || this.rules.plus || this.rules.murale) {  // ? CORRECTION : "same" au lieu de "identique"
            captures.special = this.applySpecialRules(board, row, col, card);
        }
        
        // 2. Appliquer les captures classiques
        captures.classic = this.applyClassicCaptures(board, row, col, card);
        
        // 3. Appliquer les captures combo (récursives)
        const allCaptures = [...captures.special, ...captures.classic];
        for (const capture of allCaptures) {
            if (TripleTriadUtils.isValidPosition(capture.row, capture.col)) {
                const capturedCard = board[capture.row][capture.col];
                if (capturedCard && capturedCard.owner !== card.owner) {
                    // Changer le propriétaire
                    capturedCard.owner = card.owner;
                    this.updateScores(gameState, card.owner);
                    
                    // Appliquer combo récursif
                    const comboCaptures = this.applyComboCaptures(board, capture.row, capture.col, card.owner);
                    captures.combo.push(...comboCaptures);
                }
            }
        }
        
        return {
            total: captures.classic.length + captures.special.length + captures.combo.length,
            captures,
            triggeredRules: this.getTriggeredRules(captures.special)
        };
    }
    
    /**
     * Applique les règles spéciales (Same, Plus, Murale)
     */
    applySpecialRules(board, row, col, card) {
        let allCaptures = [];
        let triggeredRules = [];
        
        if (this.rules.same) {  // ? CORRECTION : "same" au lieu de "identique"
            const sameCaptures = this.ruleSame(board, row, col, card);
            if (sameCaptures.length >= 2) {
                allCaptures.push(...sameCaptures);
                triggeredRules.push('Same');  // ? CORRECTION : "Same" au lieu de "Identique"
            }
        }
        
        if (this.rules.plus) {
            const plusCaptures = this.rulePlus(board, row, col, card);
            if (plusCaptures.length > 0) {
                allCaptures.push(...plusCaptures);
                triggeredRules.push('Plus');
            }
        }
        
        if (this.rules.murale) {
            const wallCaptures = this.ruleSameWall(board, row, col, card);
            if (wallCaptures.length > 0) {
                allCaptures.push(...wallCaptures);
                triggeredRules.push('Murale');
            }
        }
        
        // Marquer les règles déclenchées
        allCaptures.forEach(capture => {
            capture.triggeredRules = triggeredRules;
        });
        
        return allCaptures;
    }
    
    /**
     * Règle "Same" - Au moins 2 voisins adverses avec valeurs égales
     */
    ruleSame(board, row, col, card) {
        console.log(`[Same] Test pour carte posée en (${row},${col})`, card);
        
        let matches = [];
        for (const direction of DIRECTIONS_ARRAY) {
            const nr = row + direction.dr;
            const nc = col + direction.dc;
            
            if (TripleTriadUtils.isValidPosition(nr, nc)) {
                const neighbor = board[nr][nc];
                if (neighbor && neighbor.owner !== card.owner) {
                    if (parseInt(card[direction.self]) === parseInt(neighbor[direction.opp])) {
                        console.log(`[Same] MATCH côté ${direction.name} : ${card[direction.self]} == ${neighbor[direction.opp]}`);
                        matches.push({ row: nr, col: nc, owner: card.owner });
                    }
                }
            }
        }
        
        console.log(`[Same] Nombre de matches adverses : ${matches.length}`, matches);
        
        // La règle ne s'active que s'il y a AU MOINS 2 matches
        if (matches.length >= 2) {
            console.log(`[Same] RÈGLE ACTIVÉE : retourne`, matches);
            return matches;
        }
        
        console.log(`[Same] RÈGLE NON ACTIVÉE`);
        return [];
    }
    
    /**
     * Règle "Plus" - Au moins deux voisins adverses avec la même somme
     */
    rulePlus(board, row, col, card) {
        let sums = [];
        
        for (const direction of DIRECTIONS_ARRAY) {
            const nr = row + direction.dr;
            const nc = col + direction.dc;
            
            if (TripleTriadUtils.isValidPosition(nr, nc)) {
                const neighbor = board[nr][nc];
                if (neighbor && neighbor.owner !== card.owner) {
                    const sum = parseInt(card[direction.self]) + parseInt(neighbor[direction.opp]);
                    sums.push({ sum, nr, nc, neighbor, name: direction.name });
                }
            }
        }
        
        // Cherche toutes les paires de voisins adverses avec la même somme
        let flips = [];
        for (let i = 0; i < sums.length; i++) {
            for (let j = i + 1; j < sums.length; j++) {
                if (sums[i].sum === sums[j].sum) {
                    flips.push({ row: sums[i].nr, col: sums[i].nc, owner: card.owner });
                    flips.push({ row: sums[j].nr, col: sums[j].nc, owner: card.owner });
                }
            }
        }
        
        // Supprime les doublons
        flips = flips.filter((v, i, a) => 
            a.findIndex(t => t.row === v.row && t.col === v.col) === i
        );
        
        if (flips.length > 0) {
            console.log(`[Plus] RÈGLE ACTIVÉE : retourne`, flips);
        }
        
        return flips;
    }
    
    /**
     * Règle "Murale" - Valeurs identiques avec les murs (valeur 10)
     */
    ruleSameWall(board, row, col, card) {
        let matches = [];
        let hasWall = false;
        
        for (const direction of DIRECTIONS_ARRAY) {
            const nr = row + direction.dr;
            const nc = col + direction.dc;
            
            // Vérifier si c'est un mur (hors plateau)
            if (!TripleTriadUtils.isValidPosition(nr, nc)) {
                if (parseInt(card[direction.self]) === TRIPLE_TRIAD_CONSTANTS.RULES.WALL_VALUE) {
                    matches.push({ row: nr, col: nc, wall: true });
                    hasWall = true;
                }
            } else {
                // Vérifier les voisins normaux
                const neighbor = board[nr][nc];
                if (neighbor && neighbor.owner !== card.owner) {
                    if (parseInt(card[direction.self]) === parseInt(neighbor[direction.opp])) {
                        matches.push({ row: nr, col: nc });
                    }
                }
            }
        }
        
        const flips = matches.filter(m => !m.wall);
        
        // La règle ne s'active que s'il y a AU MOINS un mur impliqué ET des cartes à capturer
        if (hasWall && matches.length >= 2 && flips.length > 0) {
            return flips;
        }
        
        return [];
    }
    
    /**
     * Capture classique - Comparaison simple des valeurs
     */
    applyClassicCaptures(board, row, col, card) {
        const captures = [];
        
        for (const direction of DIRECTIONS_ARRAY) {
            const nr = row + direction.dr;
            const nc = col + direction.dc;
            
            if (TripleTriadUtils.isValidPosition(nr, nc)) {
                const neighbor = board[nr][nc];
                if (neighbor && neighbor.owner !== card.owner) {
                    if (parseInt(card[direction.self]) > parseInt(neighbor[direction.opp])) {
                        captures.push({ row: nr, col: nc, owner: card.owner });
                    }
                }
            }
        }
        
        return captures;
    }
    
    /**
     * Capture combo - Applique récursivement les captures classiques
     */
    applyComboCaptures(board, row, col, owner) {
        const captures = [];
        const card = board[row][col];
        
        if (!card) return captures;
        
        for (const direction of DIRECTIONS_ARRAY) {
            const nr = row + direction.dr;
            const nc = col + direction.dc;
            
            if (TripleTriadUtils.isValidPosition(nr, nc)) {
                const neighbor = board[nr][nc];
                if (neighbor && neighbor.owner !== owner) {
                    if (parseInt(card[direction.self]) > parseInt(neighbor[direction.opp])) {
                        // Capturer cette carte
                        neighbor.owner = owner;
                        captures.push({ row: nr, col: nc, owner });
                        
                        // Appliquer combo récursif
                        const recursiveCaptures = this.applyComboCaptures(board, nr, nc, owner);
                        captures.push(...recursiveCaptures);
                    }
                }
            }
        }
        
        return captures;
    }
    
    /**
     * Met à jour les scores après une capture
     */
    updateScores(gameState, cardOwner) {
        const { isPvP, playerId, opponentId } = gameState;
        
        if (isPvP) {
            if (cardOwner === playerId) {
                gameState.playerScore++;
                gameState.opponentScore--;
            } else {
                gameState.opponentScore++;
                gameState.playerScore--;
            }
        } else {
            if (cardOwner === "player") {
                gameState.playerScore++;
                gameState.opponentScore--;
            } else {
                gameState.opponentScore++;
                gameState.playerScore--;
            }
        }
    }
    
    /**
     * Vérifie la condition de Mort Subite
     */
    shouldApplySuddenDeath(gameState) {
        return this.rules.mortSubite && 
               gameState.playerScore === gameState.opponentScore &&
               TripleTriadUtils.isBoardFull(gameState.board);
    }
    
    /**
     * Applique la règle Mort Subite
     */
    applySuddenDeath(gameState) {
        if (!this.shouldApplySuddenDeath(gameState)) return false;
        
        // Récolter toutes les cartes du plateau
        const cardsOnBoard = [];
        for (let row = 0; row < TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE; row++) {
            for (let col = 0; col < TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE; col++) {
                const cell = gameState.board[row][col];
                if (cell && cell.owner) {
                    cardsOnBoard.push({ ...cell });
                }
            }
        }
        
        // Réinitialiser le plateau
        gameState.board = TripleTriadUtils.createEmptyBoard();
        
        // Remettre les cartes dans les mains
        gameState.playerCards = gameState.playerCards.map(card => ({ ...card, played: false }));
        gameState.opponentCards = gameState.opponentCards.map(card => ({ ...card, played: false }));
        
        // Réinitialiser les scores
        gameState.playerScore = TRIPLE_TRIAD_CONSTANTS.SCORES.INITIAL_PLAYER;
        gameState.opponentScore = TRIPLE_TRIAD_CONSTANTS.SCORES.INITIAL_OPPONENT;
        
        // Choisir un joueur aléatoire pour commencer
        gameState.activePlayer = Math.random() < 0.5 ? 
            TRIPLE_TRIAD_CONSTANTS.PLAYERS.PLAYER : 
            TRIPLE_TRIAD_CONSTANTS.PLAYERS.OPPONENT;
        
        return true;
    }
    
    /**
     * Détermine le gagnant de la partie
     */
    determineWinner(gameState) {
        const { playerScore, opponentScore } = gameState;
        
        if (playerScore > opponentScore) {
            return {
                result: 'victory',
                text: 'VICTOIRE',
                color: TRIPLE_TRIAD_CONSTANTS.COLORS.SUCCESS,
                music: TRIPLE_TRIAD_CONSTANTS.AUDIO.VICTORY
            };
        } else if (playerScore < opponentScore) {
            return {
                result: 'defeat',
                text: 'DÉFAITE',
                color: TRIPLE_TRIAD_CONSTANTS.COLORS.DEFEAT,
                music: TRIPLE_TRIAD_CONSTANTS.AUDIO.DEFEAT
            };
        } else {
            return {
                result: 'tie',
                text: 'ÉGALITÉ',
                color: TRIPLE_TRIAD_CONSTANTS.COLORS.TIE,
                music: TRIPLE_TRIAD_CONSTANTS.AUDIO.DEFEAT
            };
        }
    }
    
    /**
     * Obtient les noms des règles déclenchées
     */
    getTriggeredRules(specialCaptures) {
        const rules = new Set();
        specialCaptures.forEach(capture => {
            if (capture.triggeredRules) {
                capture.triggeredRules.forEach(rule => rules.add(rule));
            }
        });
        return Array.from(rules);
    }
}