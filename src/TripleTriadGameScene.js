import Phaser from "phaser";
import MusicManager from './MusicManager.js';
import { loadCardImages } from "./utils/loadCardImages.js";

// Import des nouveaux managers
import { TRIPLE_TRIAD_CONSTANTS } from './managers/TripleTriadConstants.js';
import { TripleTriadUtils } from './managers/TripleTriadUtils.js';
import { TripleTriadBoardManager } from './managers/TripleTriadBoardManager.js';
import { TripleTriadRulesEngine } from './managers/TripleTriadRulesEngine.js';
import { TripleTriadAnimationManager } from './managers/TripleTriadAnimationManager.js';
import { TripleTriadAIPlayer } from './managers/TripleTriadAIPlayer.js';
import { TripleTriadNetworkHandler } from './managers/TripleTriadNetworkHandler.js';
import { TripleTriadRenderer } from './managers/TripleTriadRenderer.js';

/**
 * Version refactoris�e de TripleTriadGameScene
 * Utilise le pattern Manager pour s�parer les responsabilit�s
 */
export class TripleTriadGameScene extends Phaser.Scene {
    
    constructor() {
        super("TripleTriadGameScene");
        
        // Managers
        this.boardManager = null;
        this.rulesEngine = null;
        this.animationManager = null;
        this.aiPlayer = null;
        this.networkHandler = null;
        this.renderer = null;
        
        // �tat du jeu
        this.gameState = {
            isPvP: false,
            playerId: null,
            opponentId: null,
            matchId: null,
            gameEnded: false,
            draggedCardIdx: null
        };
        
        this.container = null;
    }
    
    init(data) {
        // Initialise l'�tat du jeu
        this.gameState.isPvP = data.mode === "pvp";
        this.gameState.playerId = data.playerId;
        this.gameState.opponentId = data.opponentId;
        this.gameState.matchId = data.matchId || TripleTriadUtils.generateMatchId();
        this.gameState.gameEnded = false;
        this.gameState.draggedCardIdx = null;
        
        // R�cup�re les cartes du joueur
        const playerCards = data.playerCards || [];
        
        // Pour les cartes de l'IA, on les r�cup�rera de mani�re asynchrone si n�cessaire
        this.gameState.opponentCards = data.opponentCards || null;
        this.gameState.aiDifficulty = data.aiDifficulty || 'medium';
        
        // Initialise les managers (les cartes IA seront charg�es dans create())
        this.initializeManagers(data.rules, playerCards, []);
    }
    
    preload() {
        // Charge les assets des cartes des joueurs si disponibles
        const cardsToLoad = [];
        if (this.boardManager && this.boardManager.playerCards) {
            cardsToLoad.push(...this.boardManager.playerCards);
        }
        if (this.boardManager && this.boardManager.opponentCards) {
            cardsToLoad.push(...this.boardManager.opponentCards);
        }
        
        loadCardImages(this, cardsToLoad);
        
        this.load.audio('tripleTriadMusic', 'assets/musics/tripleTriadMusic.mp3');
        this.load.audio('tripleTriadArrow', 'assets/sounds/tripleTriadArrow.mp3');
        this.load.audio('card_place', 'assets/sounds/cardPlaced.mp3');
        this.load.audio('card_capture', 'assets/sounds/cardCaptured.mp3');
        this.load.audio('victoryMusic', 'assets/musics/victoryMusic.mp3');
        this.load.audio('defeatMusic', 'assets/musics/defeatMusic.mp3');
    }
    
    async create() {
        // Cr�e le container principal
        this.container = this.add.container(0, 0);
        
        // Initialise le renderer
        this.renderer = new TripleTriadRenderer(this, this.container);
        
        // Charge les cartes de l'IA si n�cessaire
        if (!this.gameState.isPvP && !this.gameState.opponentCards) {
            await this.loadAICards();
        }
        
        if (this.gameState.isPvP) {
            this.startPvPMode();
        } else {
            this.startAIMode();
        }
        
        // Configure les �v�nements de redimensionnement
        this.setupResizeListener();
    }
    
    /**
     * Charge les cartes de l'IA depuis la BDD ou utilise le fallback
     */
    async loadAICards() {
        try {
            console.log(`[TripleTriad] Chargement des cartes IA (difficult�: ${this.gameState.aiDifficulty})`);
            
            const aiCards = await TripleTriadUtils.generateRandomAICardsFromDB(
                this.gameState.aiDifficulty, 
                TRIPLE_TRIAD_CONSTANTS.CARDS.HAND_SIZE
            );
            
            // Met � jour les cartes de l'IA dans le board manager
            this.boardManager.opponentCards = aiCards.map(card => ({
                ...card,
                played: false
            }));
            
            console.log(`[TripleTriad] ${aiCards.length} cartes IA charg�es:`, aiCards.map(c => c.nom));
            
        } catch (error) {
            console.error('[TripleTriad] Erreur lors du chargement des cartes IA:', error);
            
            // Fallback vers les cartes par d�faut
            const fallbackCards = TripleTriadUtils.generateRandomAICards();
            this.boardManager.opponentCards = fallbackCards;
            
            console.log('[TripleTriad] Utilisation des cartes par d�faut pour l\'IA');
        }
    }
    
    /**
     * Initialise tous les managers
     */
    initializeManagers(rules, playerCards, opponentCards) {
        // S'assure que toutes les cartes ont la propri�t� 'played'
        const processedPlayerCards = playerCards.map(card => ({
            ...card,
            played: card.played || false
        }));
        
        const processedOpponentCards = opponentCards.map(card => ({
            ...card,
            played: card.played || false
        }));
        
        // Gestionnaire du plateau
        this.boardManager = new TripleTriadBoardManager(this);
        this.boardManager.initialize(processedPlayerCards, processedOpponentCards);
        
        // Moteur de r�gles
        this.rulesEngine = new TripleTriadRulesEngine(rules);
        
        // Gestionnaire d'animations
        this.animationManager = new TripleTriadAnimationManager(this);
        
        // IA (si mode solo)
        if (!this.gameState.isPvP) {
            this.aiPlayer = new TripleTriadAIPlayer('medium');
        }
        
        // Gestionnaire r�seau (si mode PvP)
        if (this.gameState.isPvP) {
            const socket = this.registry.get("socket");
            this.networkHandler = new TripleTriadNetworkHandler(this, socket);
            this.setupNetworkEvents();
        }
        
        console.log(`[TripleTriad] Initialis� avec ${processedPlayerCards.length} cartes joueur et ${processedOpponentCards.length} cartes adversaire`);
    }
    
    /**
     * D�marre le mode PvP
     */
    startPvPMode() {
        this.showWaitingMessage();
        
        this.networkHandler.initializePvP(
            this.gameState.matchId,
            this.gameState.playerId,
            this.gameState.opponentId,
            this.boardManager.playerCards
        );
    }
    
    /**
     * D�marre le mode IA
     */
    startAIMode() {
        // D�termine qui commence
        const startingPlayer = Math.random() < 0.5 ? 
            TRIPLE_TRIAD_CONSTANTS.PLAYERS.PLAYER : 
            TRIPLE_TRIAD_CONSTANTS.PLAYERS.OPPONENT;
        
        this.boardManager.activePlayer = startingPlayer;
        
        // Lance la musique
        MusicManager.play(this, TRIPLE_TRIAD_CONSTANTS.AUDIO.MUSIC, { 
            loop: true, 
            volume: TRIPLE_TRIAD_CONSTANTS.AUDIO.VOLUME.MUSIC 
        });
        
        // Dessine l'interface
        this.drawAll();
        
        // Montre la fl�che de d�but
        this.animationManager.showStartingArrow(startingPlayer, () => {
            if (startingPlayer === TRIPLE_TRIAD_CONSTANTS.PLAYERS.OPPONENT) {
                this.executeAITurn();
            }
        });
    }
    
    /**
     * Configure les �v�nements r�seau
     */
    setupNetworkEvents() {
        this.events.on('match-ready', (data) => {
            this.hideWaitingMessage();
            this.showDuelMessage();
            
            // Initialise avec les donn�es du serveur
            this.boardManager.updateGameState({
                playerCards: data.playerCards,
                opponentCards: data.opponentCards,
                board: data.state.board,
                activePlayer: data.state.turn === this.gameState.playerId ? 
                    TRIPLE_TRIAD_CONSTANTS.PLAYERS.PLAYER : 
                    TRIPLE_TRIAD_CONSTANTS.PLAYERS.OPPONENT
            });
            
            MusicManager.play(this, TRIPLE_TRIAD_CONSTANTS.AUDIO.MUSIC, { 
                loop: true, 
                volume: TRIPLE_TRIAD_CONSTANTS.AUDIO.VOLUME.MUSIC 
            });
            
            this.drawAll();
            this.animationManager.showStartingArrow(this.boardManager.activePlayer, () => {
                // Le jeu peut commencer
            });
        });
        
        this.events.on('game-update', (data) => {
            this.handleGameUpdate(data);
        });
        
        this.events.on('match-error', (error) => {
            console.error('[TripleTriad] Erreur de match:', error);
            this.returnToLobby();
        });
        
        this.events.on('match-cancelled', () => {
            this.returnToLobby();
        });
    }
    
    /**
     * G�re une mise � jour du jeu en PvP
     */
    handleGameUpdate(data) {
        const { state, appliedRules } = data;
        
        // Sauvegarde l'ancien �tat pour les animations
        const previousBoard = TripleTriadUtils.cloneBoard(this.boardManager.board);
        
        // Met � jour l'�tat
        this.boardManager.updateGameState({
            board: state.board,
            activePlayer: state.turn === this.gameState.playerId ? 
                TRIPLE_TRIAD_CONSTANTS.PLAYERS.PLAYER : 
                TRIPLE_TRIAD_CONSTANTS.PLAYERS.OPPONENT,
            playerScore: state.scores?.[this.gameState.playerId] ?? this.boardManager.playerScore,
            opponentScore: state.scores?.[this.gameState.opponentId] ?? this.boardManager.opponentScore
        });
        
        // Montre les r�gles d�clench�es
        if (appliedRules && appliedRules.length > 0) {
            this.animationManager.showRuleMessage(appliedRules.join(', '));
        }
        
        // Anime les changements
        this.animateChanges(previousBoard, state, () => {
            this.drawAll();
            
            if (state.gameEnded) {
                this.handleGameEnd();
            }
        });
    }
    
    /**
     * Anime les changements entre deux �tats du plateau (pour PvP)
     */
    animateChanges(previousBoard, newState, onComplete) {
        const poses = [];
        const flips = [];
        
        // D�tecte les poses et flips
        for (let row = 0; row < TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE; row++) {
            for (let col = 0; col < TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE; col++) {
                const prev = previousBoard[row][col];
                const curr = this.boardManager.board[row][col];
                
                if (!prev && curr) {
                    poses.push({ row, col, card: curr });
                } else if (prev && curr && prev.owner !== curr.owner) {
                    flips.push({ row, col, owner: curr.owner });
                }
            }
        }
        
        let animationsCompleted = 0;
        const totalAnimations = poses.length + flips.length;
        
        const checkComplete = () => {
            animationsCompleted++;
            if (animationsCompleted >= totalAnimations && onComplete) {
                onComplete();
            }
        };
        
        // Anime les poses
        poses.forEach(({ row, col, card }) => {
            const { width, height } = this.sys.game.canvas;
            const boardDimensions = TripleTriadUtils.calculateBoardDimensions(width, height);
            const targetPos = TripleTriadUtils.getBoardCellPosition(row, col, boardDimensions);
            
            let fromPos;
            if (card.owner === this.gameState.playerId) {
                fromPos = TripleTriadUtils.getPlayerHandPosition(width, height, 0);
            } else {
                fromPos = TripleTriadUtils.getOpponentHandPosition(width, 0);
            }
            
            this.animationManager.animateCardPlacement(
                card, fromPos.x, fromPos.y, targetPos.x, targetPos.y, checkComplete
            );
        });
        
        // Anime les captures
        flips.forEach(({ row, col, owner }) => {
            const card = this.boardManager.board[row][col];
            this.animationManager.animateCardCapture(
                row, col, owner, card.image, this.container, checkComplete
            );
        });
        
        // Si aucune animation, on termine imm�diatement
        if (totalAnimations === 0 && onComplete) {
            onComplete();
        }
    }
    
    /**
     * Ex�cute le tour de l'IA
     */
    executeAITurn() {
        if (this.boardManager.activePlayer !== TRIPLE_TRIAD_CONSTANTS.PLAYERS.OPPONENT || 
            this.boardManager.gameEnded) {
            return;
        }
        
        // Obtient les cartes et positions disponibles
        const availableCards = this.boardManager.getAvailableCards("opponent");
        const gameState = this.boardManager.getGameState();
        
        console.log(`[TripleTriad AI] Cartes disponibles pour l'IA:`, availableCards.length);
        
        // L'IA choisit son coup
        const aiMove = this.aiPlayer.chooseMove(
            this.boardManager.board, 
            availableCards, 
            this.rulesEngine.rules,
            gameState
        );
        
        if (!aiMove) {
            console.error('[TripleTriad] IA ne peut pas jouer');
            return;
        }
        
        console.log(`[TripleTriad AI] IA choisit carte index ${aiMove.cardIndex} vers position (${aiMove.position.row}, ${aiMove.position.col})`);
        
        // L'index retourn� par l'IA correspond � l'index dans availableCards
        // Il faut convertir vers l'index dans la main compl�te de l'IA
        let cardIndexInHand = -1;
        let availableCount = 0;
        
        for (let i = 0; i < this.boardManager.opponentCards.length; i++) {
            const card = this.boardManager.opponentCards[i];
            if (!card.played) {
                if (availableCount === aiMove.cardIndex) {
                    cardIndexInHand = i;
                    break;
                }
                availableCount++;
            }
        }
        
        if (cardIndexInHand === -1) {
            console.error('[TripleTriad] Impossible de trouver l\'index de la carte dans la main');
            return;
        }
        
        console.log(`[TripleTriad AI] Index r�el dans la main: ${cardIndexInHand}`);
        
        // Simule un d�lai de r�flexion
        const thinkingDelay = this.aiPlayer.getThinkingDelay();
        
        this.time.delayedCall(thinkingDelay, () => {
            this.executeMove("opponent", cardIndexInHand, aiMove.position.row, aiMove.position.col);
        });
    }
    
    /**
     * Ex�cute un mouvement (joueur ou IA)
     */
    executeMove(owner, cardIndex, row, col) {
        console.log(`[TripleTriad] Tentative de placement carte - Owner: ${owner}, Index: ${cardIndex}, Position: (${row}, ${col})`);
        
        // V�rifie la validit� de l'index
        const cards = owner === "player" ? this.boardManager.playerCards : this.boardManager.opponentCards;
        if (cardIndex < 0 || cardIndex >= cards.length) {
            console.error(`[TripleTriad] Index de carte invalide: ${cardIndex}, cartes disponibles: ${cards.length}`);
            return;
        }
        
        const card = cards[cardIndex];
        if (!card) {
            console.error(`[TripleTriad] Aucune carte trouv�e � l'index: ${cardIndex}`);
            return;
        }
        
        if (card.played) {
            console.error(`[TripleTriad] Carte d�j� jou�e: ${card.nom}`);
            return;
        }
        
        console.log(`[TripleTriad] Placement de la carte: ${card.nom} (owner: ${owner})`);
        
        // Place la carte
        const result = this.boardManager.placeCard(row, col, cardIndex, owner);
        
        if (!result.success) {
            console.error('[TripleTriad] �chec du placement de carte:', result.error);
            return;
        }
        
        // Applique les r�gles de capture
        const gameState = this.boardManager.getGameState();
        gameState.isPvP = this.gameState.isPvP;
        gameState.playerId = this.gameState.playerId;
        gameState.opponentId = this.gameState.opponentId;
        
        const captureResult = this.rulesEngine.captureCards(
            this.boardManager.board, row, col, result.placedCard, gameState
        );
        
        // Met � jour les scores
        this.boardManager.updateScores(gameState.playerScore, gameState.opponentScore);
        
        // Montre les r�gles d�clench�es
        if (captureResult.triggeredRules.length > 0 && !this.gameState.isPvP) {
            this.animationManager.showRuleMessage(`R�gle : ${captureResult.triggeredRules.join(', ')}`);
        }
        
        // Anime le placement
        this.animatePlacement(result, () => {
            // Anime les captures
            this.animateCaptures(captureResult.captures, () => {
                this.boardManager.switchActivePlayer();
                this.drawAll();
                
                // V�rifie la fin de partie
                if (TripleTriadUtils.isBoardFull(this.boardManager.board)) {
                    this.handleGameEnd();
                } else if (!this.gameState.isPvP && 
                          this.boardManager.activePlayer === TRIPLE_TRIAD_CONSTANTS.PLAYERS.OPPONENT) {
                    this.time.delayedCall(600, () => this.executeAITurn());
                }
            });
        });
    }
    
    /**
     * G�re la fin de partie
     */
    handleGameEnd() {
        // V�rifie la mort subite
        const gameState = this.boardManager.getGameState();
        if (this.rulesEngine.shouldApplySuddenDeath(gameState)) {
            this.rulesEngine.applySuddenDeath(gameState);
            this.boardManager.updateGameState(gameState);
            this.animationManager.showRuleMessage("Mort subite ! Nouvelle manche");
            this.drawAll();
            
            this.time.delayedCall(1200, () => {
                if (this.boardManager.activePlayer === TRIPLE_TRIAD_CONSTANTS.PLAYERS.OPPONENT) {
                    this.executeAITurn();
                }
            });
            return;
        }
        
        // D�termine le gagnant
        const result = this.rulesEngine.determineWinner(gameState);
        
        this.boardManager.endGame();
        
        // Arr�te la musique et joue celle de fin
        MusicManager.stop();
        MusicManager.play(this, result.music, { 
            loop: false, 
            volume: TRIPLE_TRIAD_CONSTANTS.AUDIO.VOLUME.END_MUSIC 
        });
        
        // Anime la fin
        const endAnimation = this.animationManager.animateEndGame(result.text, result.color, () => {
            this.cleanup();
            this.returnToLobby();
        });
        
        // Ajoute le texte de fin au container
        this.container.add(endAnimation.endText);
    }
    
    /**
     * Dessine toute l'interface
     */
    drawAll() {
        if (this.boardManager.gameEnded || !this.renderer) return;
        
        // Nettoie le container
        this.container.removeAll(true);
        
        // Dessine les �l�ments
        this.renderer.drawBackground();
        
        const boardCells = [];
        this.renderer.drawBoard(this.boardManager.board, boardCells, {
            ...this.gameState,
            ...this.boardManager.getGameState()
        });
        this.boardManager.setBoardCells(boardCells);
        
        this.renderer.drawOpponentHand(
            this.boardManager.opponentCards,
            this.boardManager.activePlayer,
            this.boardManager.gameEnded
        );
        
        this.renderer.drawPlayerHand(
            this.boardManager.playerCards,
            this.boardManager.activePlayer,
            this.boardManager.gameEnded,
            (action, cardIndex, ...args) => this.handleCardInteraction(action, cardIndex, ...args)
        );
        
        this.renderer.drawScores(this.boardManager.playerScore, this.boardManager.opponentScore);
        
        // Configure les drop zones
        this.setupDropZones(boardCells);
    }
    
    /**
     * G�re les interactions avec les cartes
     */
    handleCardInteraction(action, cardIndex, ...args) {
        if (action === 'dragstart') {
            this.gameState.draggedCardIdx = cardIndex;
        } else if (action === 'dragend') {
            const [pointer, dropX, dropY, dropped] = args;
            if (!dropped) {
                this.gameState.draggedCardIdx = null;
            }
        }
    }
    
    /**
     * Configure les zones de drop du plateau
     */
    setupDropZones(boardCells) {
        this.input.off('drop'); // �vite les doublons
        
        this.input.on('drop', (pointer, gameObject, dropZone) => {
            if (this.gameState.draggedCardIdx !== null && 
                this.boardManager.activePlayer === TRIPLE_TRIAD_CONSTANTS.PLAYERS.PLAYER && 
                !this.boardManager.gameEnded) {
                
                // Trouve la position de la cellule
                const position = this.boardManager.findCellPosition(dropZone);
                if (position && TripleTriadUtils.isCellEmpty(this.boardManager.board, position.row, position.col)) {
                    
                    if (this.gameState.isPvP) {
                        // Envoie au serveur
                        this.networkHandler.playCard(this.gameState.draggedCardIdx, position.row, position.col);
                    } else {
                        // Ex�cute localement
                        this.executeMove("player", this.gameState.draggedCardIdx, position.row, position.col);
                    }
                    
                    this.gameState.draggedCardIdx = null;
                }
            }
        });
    }
    
    /**
     * Anime le placement d'une carte
     */
    animatePlacement(placementResult, onComplete) {
        const { placedCard, position } = placementResult;
        const { width, height } = this.sys.game.canvas;
        
        // Calcule les positions de d�part et d'arriv�e
        const boardDimensions = TripleTriadUtils.calculateBoardDimensions(width, height);
        const targetPos = TripleTriadUtils.getBoardCellPosition(position.row, position.col, boardDimensions);
        
        let fromPos;
        if (placedCard.owner === "player") {
            fromPos = TripleTriadUtils.getPlayerHandPosition(width, height, this.gameState.draggedCardIdx || 0);
        } else {
            fromPos = TripleTriadUtils.getOpponentHandPosition(width, this.gameState.draggedCardIdx || 0);
        }
        
        this.animationManager.animateCardPlacement(
            placedCard, fromPos.x, fromPos.y, targetPos.x, targetPos.y, onComplete
        );
    }
    
    /**
     * Anime les captures
     */
    animateCaptures(captures, onComplete) {
        if (!captures || !captures.classic || captures.classic.length === 0) {
            if (onComplete) onComplete();
            return;
        }
        
        let capturesCompleted = 0;
        const totalCaptures = captures.classic.length;
        
        captures.classic.forEach(capture => {
            const card = this.boardManager.board[capture.row][capture.col];
            this.animationManager.animateCardCapture(
                capture.row, capture.col, capture.owner, card.image, this.container,
                () => {
                    capturesCompleted++;
                    if (capturesCompleted === totalCaptures && onComplete) {
                        onComplete();
                    }
                }
            );
        });
    }
    
    /**
     * Configure le redimensionnement
     */
    setupResizeListener() {
        this.scale.on("resize", () => {
            this.drawAll();
        });
    }
    
    /**
     * Affiche un message d'attente
     */
    showWaitingMessage() {
        const { width, height } = this.sys.game.canvas;
        
        this.waitText = this.add.text(width / 2, height * 0.4, "En attente de l'adversaire...", {
            font: "32px Arial", fill: "#fff"
        }).setOrigin(0.5);
    }
    
    /**
     * Cache le message d'attente
     */
    hideWaitingMessage() {
        if (this.waitText) {
            this.waitText.destroy();
            this.waitText = null;
        }
    }
    
    /**
     * Montre le message de duel
     */
    showDuelMessage() {
        const { width, height } = this.sys.game.canvas;
        
        const duelText = this.add.text(width / 2, height / 2, "C'est l'heure du duel !", {
            font: "bold 40px Arial", fill: "#ff0", stroke: "#000", strokeThickness: 6
        }).setOrigin(0.5).setAlpha(0);
        
        this.tweens.add({
            targets: duelText,
            alpha: 1,
            scale: { from: 0.7, to: 1.1 },
            duration: 700,
            yoyo: true,
            hold: 700,
            onComplete: () => duelText.destroy()
        });
    }
    
    /**
     * Nettoie les ressources
     */
    cleanup() {
        // Nettoie les animations
        if (this.animationManager) {
            this.animationManager.stopAllAnimations();
        }
        
        // Nettoie le renderer
        if (this.renderer) {
            this.renderer.cleanup();
        }
        
        // Nettoie le r�seau
        if (this.networkHandler) {
            this.networkHandler.cleanup();
        }
        
        // Nettoie les �v�nements
        this.events.removeAllListeners();
        this.input.off('drop');
        
        // Nettoie le container
        if (this.container) {
            this.container.destroy(true);
            this.container = null;
        }
    }
    
    /**
     * Retourne au lobby
     */
    returnToLobby() {
        this.cleanup();
        MusicManager.stop();
        this.scene.stop();
        this.scene.resume("GameScene");
    }
}