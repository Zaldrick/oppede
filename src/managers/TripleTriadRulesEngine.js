import { TRIPLE_TRIAD_CONSTANTS, DIRECTIONS_ARRAY } from './TripleTriadConstants.js';
import { TripleTriadUtils } from './TripleTriadUtils.js';

/**
 * Moteur de r�gles pour Triple Triad
 * G�re toutes les r�gles sp�ciales et la logique de capture
 */
export class TripleTriadRulesEngine {
    
    constructor(rules = TRIPLE_TRIAD_CONSTANTS.RULES.DEFAULT) {
        this.rules = { ...rules };
    }
    
    /**
     * Applique toutes les captures apr�s qu'une carte soit pos�e
     */
    captureCards(board, row, col, card, gameState, onCaptureComplete = null) {
        const captures = {
            classic: [],
            special: [],
            combo: []
        };
        
        // 1. V�rifier les r�gles sp�ciales d'abord
        if (this.rules.same || this.rules.plus || this.rules.murale) {  // ? CORRECTION : "same" au lieu de "identique"
            captures.special = this.applySpecialRules(board, row, col, card);
        }
        
        // 2. Appliquer les captures classiques
        captures.classic = this.applyClassicCaptures(board, row, col, card);
        
        // 3. Appliquer les captures combo (r�cursives)
        const allCaptures = [...captures.special, ...captures.classic];
        for (const capture of allCaptures) {
            if (TripleTriadUtils.isValidPosition(capture.row, capture.col)) {
                const capturedCard = board[capture.row][capture.col];
                if (capturedCard && capturedCard.owner !== card.owner) {
                    // Changer le propri�taire
                    capturedCard.owner = card.owner;
                    this.updateScores(gameState, card.owner);
                    
                    // Appliquer combo r�cursif
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
     * Applique les r�gles sp�ciales (Same, Plus, Murale)
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
        
        // Marquer les r�gles d�clench�es
        allCaptures.forEach(capture => {
            capture.triggeredRules = triggeredRules;
        });
        
        return allCaptures;
    }
    
    /**
     * R�gle "Same" - Au moins 2 voisins adverses avec valeurs �gales
     */
    ruleSame(board, row, col, card) {
        console.log(`[Same] Test pour carte pos�e en (${row},${col})`, card);
        
        let matches = [];
        for (const direction of DIRECTIONS_ARRAY) {
            const nr = row + direction.dr;
            const nc = col + direction.dc;
            
            if (TripleTriadUtils.isValidPosition(nr, nc)) {
                const neighbor = board[nr][nc];
                if (neighbor && neighbor.owner !== card.owner) {
                    if (parseInt(card[direction.self]) === parseInt(neighbor[direction.opp])) {
                        console.log(`[Same] MATCH c�t� ${direction.name} : ${card[direction.self]} == ${neighbor[direction.opp]}`);
                        matches.push({ row: nr, col: nc, owner: card.owner });
                    }
                }
            }
        }
        
        console.log(`[Same] Nombre de matches adverses : ${matches.length}`, matches);
        
        // La r�gle ne s'active que s'il y a AU MOINS 2 matches
        if (matches.length >= 2) {
            console.log(`[Same] R�GLE ACTIV�E : retourne`, matches);
            return matches;
        }
        
        console.log(`[Same] R�GLE NON ACTIV�E`);
        return [];
    }
    
    /**
     * R�gle "Plus" - Au moins deux voisins adverses avec la m�me somme
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
        
        // Cherche toutes les paires de voisins adverses avec la m�me somme
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
            console.log(`[Plus] R�GLE ACTIV�E : retourne`, flips);
        }
        
        return flips;
    }
    
    /**
     * R�gle "Murale" - Valeurs identiques avec les murs (valeur 10)
     */
    ruleSameWall(board, row, col, card) {
        let matches = [];
        let hasWall = false;
        
        for (const direction of DIRECTIONS_ARRAY) {
            const nr = row + direction.dr;
            const nc = col + direction.dc;
            
            // V�rifier si c'est un mur (hors plateau)
            if (!TripleTriadUtils.isValidPosition(nr, nc)) {
                if (parseInt(card[direction.self]) === TRIPLE_TRIAD_CONSTANTS.RULES.WALL_VALUE) {
                    matches.push({ row: nr, col: nc, wall: true });
                    hasWall = true;
                }
            } else {
                // V�rifier les voisins normaux
                const neighbor = board[nr][nc];
                if (neighbor && neighbor.owner !== card.owner) {
                    if (parseInt(card[direction.self]) === parseInt(neighbor[direction.opp])) {
                        matches.push({ row: nr, col: nc });
                    }
                }
            }
        }
        
        const flips = matches.filter(m => !m.wall);
        
        // La r�gle ne s'active que s'il y a AU MOINS un mur impliqu� ET des cartes � capturer
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
     * Capture combo - Applique r�cursivement les captures classiques
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
                        
                        // Appliquer combo r�cursif
                        const recursiveCaptures = this.applyComboCaptures(board, nr, nc, owner);
                        captures.push(...recursiveCaptures);
                    }
                }
            }
        }
        
        return captures;
    }
    
    /**
     * Met � jour les scores apr�s une capture
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
     * V�rifie la condition de Mort Subite
     */
    shouldApplySuddenDeath(gameState) {
        return this.rules.mortSubite && 
               gameState.playerScore === gameState.opponentScore &&
               TripleTriadUtils.isBoardFull(gameState.board);
    }
    
    /**
     * Applique la r�gle Mort Subite
     */
    applySuddenDeath(gameState) {
        if (!this.shouldApplySuddenDeath(gameState)) return false;
        
        // R�colter toutes les cartes du plateau
        const cardsOnBoard = [];
        for (let row = 0; row < TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE; row++) {
            for (let col = 0; col < TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE; col++) {
                const cell = gameState.board[row][col];
                if (cell && cell.owner) {
                    cardsOnBoard.push({ ...cell });
                }
            }
        }
        
        // R�initialiser le plateau
        gameState.board = TripleTriadUtils.createEmptyBoard();
        
        // Remettre les cartes dans les mains
        gameState.playerCards = gameState.playerCards.map(card => ({ ...card, played: false }));
        gameState.opponentCards = gameState.opponentCards.map(card => ({ ...card, played: false }));
        
        // R�initialiser les scores
        gameState.playerScore = TRIPLE_TRIAD_CONSTANTS.SCORES.INITIAL_PLAYER;
        gameState.opponentScore = TRIPLE_TRIAD_CONSTANTS.SCORES.INITIAL_OPPONENT;
        
        // Choisir un joueur al�atoire pour commencer
        gameState.activePlayer = Math.random() < 0.5 ? 
            TRIPLE_TRIAD_CONSTANTS.PLAYERS.PLAYER : 
            TRIPLE_TRIAD_CONSTANTS.PLAYERS.OPPONENT;
        
        return true;
    }
    
    /**
     * D�termine le gagnant de la partie
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
                text: 'D�FAITE',
                color: TRIPLE_TRIAD_CONSTANTS.COLORS.DEFEAT,
                music: TRIPLE_TRIAD_CONSTANTS.AUDIO.DEFEAT
            };
        } else {
            return {
                result: 'tie',
                text: '�GALIT�',
                color: TRIPLE_TRIAD_CONSTANTS.COLORS.TIE,
                music: TRIPLE_TRIAD_CONSTANTS.AUDIO.DEFEAT
            };
        }
    }
    
    /**
     * Obtient les noms des r�gles d�clench�es
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