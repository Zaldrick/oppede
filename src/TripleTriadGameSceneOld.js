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
 * Version refactorisée de TripleTriadGameScene
 * Utilise le pattern Manager pour séparer les responsabilités
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
        
        // État du jeu
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
        // Initialise l'état du jeu
        this.gameState.isPvP = data.mode === "pvp";
        this.gameState.playerId = data.playerId;
        this.gameState.opponentId = data.opponentId;
        this.gameState.matchId = data.matchId || TripleTriadUtils.generateMatchId();
        this.gameState.gameEnded = false;
        this.gameState.draggedCardIdx = null;
        
        // Récupère les cartes du joueur
        const playerCards = data.playerCards || [];
        
        // Pour les cartes de l'IA, on les récupérera de manière asynchrone si nécessaire
        this.gameState.opponentCards = data.opponentCards || null;
        this.gameState.aiDifficulty = data.aiDifficulty || 'medium';
        
        // Initialise les managers (les cartes IA seront chargées dans create())
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
        // Crée le container principal
        this.container = this.add.container(0, 0);
        
        // Initialise le renderer
        this.renderer = new TripleTriadRenderer(this, this.container);
        
        // Charge les cartes de l'IA si nécessaire
        if (!this.gameState.isPvP && !this.gameState.opponentCards) {
            await this.loadAICards();
        }
        
        if (this.gameState.isPvP) {
            this.startPvPMode();
        } else {
            this.startAIMode();
        }
        
        // Configure les événements de redimensionnement
        this.setupResizeListener();
    }
    
    /**
     * Charge les cartes de l'IA depuis la BDD ou utilise le fallback
     */
    async loadAICards() {
        try {
            console.log(`[TripleTriad] Chargement des cartes IA (difficulté: ${this.gameState.aiDifficulty})`);
            
            const aiCards = await TripleTriadUtils.generateRandomAICardsFromDB(
                this.gameState.aiDifficulty, 
                TRIPLE_TRIAD_CONSTANTS.CARDS.HAND_SIZE
            );
            
            // Met à jour les cartes de l'IA dans le board manager
            this.boardManager.opponentCards = aiCards.map(card => ({
                ...card,
                played: false
            }));
            
            console.log(`[TripleTriad] ${aiCards.length} cartes IA chargées:`, aiCards.map(c => c.nom));
            
        } catch (error) {
            console.error('[TripleTriad] Erreur lors du chargement des cartes IA:', error);
            
            // Fallback vers les cartes par défaut
            const fallbackCards = TripleTriadUtils.generateRandomAICards();
            this.boardManager.opponentCards = fallbackCards;
            
            console.log('[TripleTriad] Utilisation des cartes par défaut pour l\'IA');
        }
    }
    
    /**
     * Initialise tous les managers
     */
    initializeManagers(rules, playerCards, opponentCards) {
        // S'assure que toutes les cartes ont la propriété 'played'
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
        
        // Moteur de règles
        this.rulesEngine = new TripleTriadRulesEngine(rules);
        
        // Gestionnaire d'animations
        this.animationManager = new TripleTriadAnimationManager(this);
        
        // IA (si mode solo)
        if (!this.gameState.isPvP) {
            this.aiPlayer = new TripleTriadAIPlayer('medium');
        }
        
        // Gestionnaire réseau (si mode PvP)
        if (this.gameState.isPvP) {
            const socket = this.registry.get("socket");
            this.networkHandler = new TripleTriadNetworkHandler(this, socket);
            this.setupNetworkEvents();
        }
        
        console.log(`[TripleTriad] Initialisé avec ${processedPlayerCards.length} cartes joueur et ${processedOpponentCards.length} cartes adversaire`);
    }
    
    /**
     * Initialise une nouvelle partie
     */
    initializeGame() {
        console.log('[TripleTriad] Initialisation du jeu...');
        
        // ✅ ESSENTIEL : Nettoyage complet avant nouvelle partie
        this.cleanUp();
        
        // Initialise les managers
        this.boardManager.initialize(this.gameState.playerCards, this.gameState.opponentCards);
        this.rulesEngine = new TripleTriadRulesEngine(this.gameState.rules);
        
        // ✅ ESSENTIEL : Recrée le container proprement
        this.renderer.recreateContainer();
        
        // Configure l'état initial
        this.gameEnded = false;
        this.draggedCardIdx = null;
        
        // ✅ ESSENTIEL : Initialise un joueur actif aléatoire
        this.boardManager.activePlayer = Math.random() < 0.5 ? 
            TRIPLE_TRIAD_CONSTANTS.PLAYERS.PLAYER : 
            TRIPLE_TRIAD_CONSTANTS.PLAYERS.OPPONENT;
        
        console.log(`[TripleTriad] Joueur actif: ${this.boardManager.activePlayer === 0 ? 'Player' : 'Opponent'}`);
        
        // Dessine l'interface
        this.drawAll();
        
        // ✅ ESSENTIEL : Lance l'animation de la flèche
        this.animationManager.showStartingArrow(this.boardManager.activePlayer, () => {
            console.log('[TripleTriad] Flèche terminée, jeu prêt');
            
            // Si c'est le tour de l'IA, lance le premier coup
            if (this.boardManager.activePlayer === TRIPLE_TRIAD_CONSTANTS.PLAYERS.OPPONENT && !this.gameState.isPvP) {
                this.time.delayedCall(600, () => this.executeAITurn());
            }
        });
        
        // Configure les événements de drag & drop
        this.setupDragAndDrop();
        
        console.log('[TripleTriad] Jeu initialisé avec succès');
    }
    
    /**
     * Démarre le mode PvP
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
    
    // Démarre le mode IA
startAIMode() {
    // Détermine qui commence
    const startingPlayer = Math.random() < 0.5 ? 
        TRIPLE_TRIAD_CONSTANTS.PLAYERS.PLAYER : 
        TRIPLE_TRIAD_CONSTANTS.PLAYERS.OPPONENT;
    
    this.boardManager.activePlayer = startingPlayer;

    // ✅ DEBUG
    console.log('[DEBUG] startAIMode - activePlayer défini à:', startingPlayer);
    console.log('[DEBUG] startAIMode - PLAYER constant:', TRIPLE_TRIAD_CONSTANTS.PLAYERS.PLAYER);
    console.log('[DEBUG] startAIMode - OPPONENT constant:', TRIPLE_TRIAD_CONSTANTS.PLAYERS.OPPONENT);


    // Lance la musique
    MusicManager.play(this, 'tripleTriadMusic', { 
        loop: true, 
        volume: 0.5 
    });
    
    // Dessine l'interface
    this.drawAll();
    
    // Montre la flèche de début
    this.animationManager.showStartingArrow(startingPlayer, () => {
        if (startingPlayer === TRIPLE_TRIAD_CONSTANTS.PLAYERS.OPPONENT) {
            this.executeAITurn();
        }
    });
}
    
    /**
     * Configure les événements réseau
     */
    setupNetworkEvents() {
        this.events.on('match-ready', (data) => {
            this.hideWaitingMessage();
            this.showDuelMessage();
            
            // Initialise avec les données du serveur
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
     * Gère une mise à jour du jeu en PvP
     */
    handleGameUpdate(data) {
        const { state, appliedRules } = data;
        
        // Sauvegarde l'ancien état pour les animations
        const previousBoard = TripleTriadUtils.cloneBoard(this.boardManager.board);
        
        // Met à jour l'état
        this.boardManager.updateGameState({
            board: state.board,
            activePlayer: state.turn === this.gameState.playerId ? 
                TRIPLE_TRIAD_CONSTANTS.PLAYERS.PLAYER : 
                TRIPLE_TRIAD_CONSTANTS.PLAYERS.OPPONENT,
            playerScore: state.scores?.[this.gameState.playerId] ?? this.boardManager.playerScore,
            opponentScore: state.scores?.[this.gameState.opponentId] ?? this.boardManager.opponentScore
        });
        
        // Montre les règles déclenchées
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
     * Anime les changements entre deux états du plateau (pour PvP)
     */
    animateChanges(previousBoard, newState, onComplete) {
        const poses = [];
        const flips = [];
        
        // Détecte les poses et flips
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
        
        // Si aucune animation, on termine immédiatement
        if (totalAnimations === 0 && onComplete) {
            onComplete();
        }
    }
    
    /**
     * Exécute le tour de l'IA
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
        
        // L'index retourné par l'IA correspond à l'index dans availableCards
        // Il faut convertir vers l'index dans la main complète de l'IA
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
        
        console.log(`[TripleTriad AI] Index réel dans la main: ${cardIndexInHand}`);
        
        // Simule un délai de réflexion
        const thinkingDelay = this.aiPlayer.getThinkingDelay();
        
        this.time.delayedCall(thinkingDelay, () => {
            this.executeMove("opponent", cardIndexInHand, aiMove.position.row, aiMove.position.col);
        });
    }
    

//Exécute un mouvement (joueur ou IA)
    executeMove(owner, cardIndex, row, col) {
        console.log(`[TripleTriad] Tentative de placement carte - Owner: ${owner}, Index: ${cardIndex}, Position: (${row}, ${col})`);

        // Vérifie la validité de l'index
        const cards = owner === "player" ? this.boardManager.playerCards : this.boardManager.opponentCards;
        if (cardIndex < 0 || cardIndex >= cards.length) {
            console.error(`[TripleTriad] Index de carte invalide: ${cardIndex}, cartes disponibles: ${cards.length}`);
            return;
        }

        const card = cards[cardIndex];
        if (!card) {
            console.error(`[TripleTriad] Aucune carte trouvée à l'index: ${cardIndex}`);
            return;
        }

        // ✅ CORRECTION CRUCIALE : Vérification supplémentaire anti-double-jeu
        if (card.played) {
            console.error(`[TripleTriad] ERREUR : Tentative de jouer une carte déjà jouée: ${card.nom || card.name}`);
            return; // ✅ STOP IMMÉDIATEMENT si la carte est déjà jouée
        }

        console.log(`[TripleTriad] Placement de la carte: ${card.nom || card.name} (owner: ${owner})`);

        // Place la carte
        const result = this.boardManager.placeCard(row, col, cardIndex, owner);

        if (!result.success) {
            console.error('[TripleTriad] Échec du placement de carte:', result.error);
            return;
        }

        // Applique les règles de capture
        const gameState = this.boardManager.getGameState();
        gameState.isPvP = this.gameState.isPvP;
        gameState.playerId = this.gameState.playerId;
        gameState.opponentId = this.gameState.opponentId;

        const captureResult = this.rulesEngine.captureCards(
            this.boardManager.board, row, col, result.placedCard, gameState
        );

        // Met à jour les scores
        this.boardManager.updateScores(gameState.playerScore, gameState.opponentScore);

        // Montre les règles déclenchées
        if (captureResult.triggeredRules.length > 0 && !this.gameState.isPvP) {
            this.animationManager.showRuleMessage(`Règle : ${captureResult.triggeredRules.join(', ')}`);
        }

        // ✅ AJOUT : Continue le jeu après le mouvement
        this.time.delayedCall(100, () => {
            this.drawAll();

            if (TripleTriadUtils.isBoardFull(this.boardManager.board)) {
                this.handleGameEnd();
            } else {
                // Switch au tour suivant
                this.boardManager.switchActivePlayer();

                // Si c'est maintenant le tour de l'IA, la faire jouer
                if (this.boardManager.activePlayer === TRIPLE_TRIAD_CONSTANTS.PLAYERS.OPPONENT && !this.gameState.isPvP) {
                    this.time.delayedCall(600, () => this.executeAITurn());
                }
            }
        });
    }
    
    /**
     * Gère la fin de partie
     */
    handleGameEnd() {
        // Vérifie la mort subite
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
        
        // Détermine le gagnant
        const result = this.rulesEngine.determineWinner(gameState);
        
        this.boardManager.endGame();
        
        // Arrête la musique et joue celle de fin
        MusicManager.stop();
        MusicManager.play(this, result.music, { 
            loop: false, 
            volume: TRIPLE_TRIAD_CONSTANTS.AUDIO.VOLUME.END_MUSIC 
        });
        
        // Anime la fin
        const endAnimation = this.animationManager.animateEndGame(result.text, result.color, () => {
            this.cleanUp();
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
        
        // Dessine les éléments
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
     * Gère les interactions avec les cartes
     */
    handleCardInteraction(action, cardIndex, ...args) {
        if (action === 'dragstart') {
            // ✅ CORRECTION : Plus besoin de définir ici car c'est fait dans setupCardInteraction
            console.log(`[TripleTriad] Début drag carte index: ${cardIndex}`);
        } else if (action === 'dragend') {
            const [pointer, dropX, dropY, dropped] = args;
            if (!dropped) {
                // ✅ La carte n'a pas été droppée, on remet à null
                this.gameState.draggedCardIdx = null;
                console.log('[TripleTriad] Drag annulé');
            } else {
                console.log('[TripleTriad] Carte droppée');
            }
        }
    }
    /**
 * Configure les zones de drop du plateau
 */
    setupDropZones(boardCells) {
        this.input.off('drop'); // Évite les doublons

        this.input.on('drop', (pointer, gameObject, dropZone) => {
            if (this.gameState.draggedCardIdx !== null &&
                this.boardManager.activePlayer === TRIPLE_TRIAD_CONSTANTS.PLAYERS.PLAYER &&
                !this.boardManager.gameEnded) {

                for (let row = 0; row < TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE; row++) {
                    for (let col = 0; col < TRIPLE_TRIAD_CONSTANTS.BOARD.SIZE; col++) {
                        if (boardCells[row] && boardCells[row][col] === dropZone &&
                            !this.boardManager.board[row][col]) {

                            if (this.gameState.isPvP) {
                                // Mode PvP : envoie au serveur
                                this.networkHandler.playCard(this.gameState.draggedCardIdx, row, col);
                                this.gameState.draggedCardIdx = null;
                                return;
                            } else {
                                // ✅ MODE IA : EXACTEMENT comme l'ancienne version
                                const card = { ...this.boardManager.playerCards[this.gameState.draggedCardIdx], owner: "player" };
                                this.boardManager.playerCards[this.gameState.draggedCardIdx].played = true;
                                this.boardManager.board[row][col] = card;
                                if (this.sound) this.sound.play('card_place', { volume: 1 });
                                this.boardManager.activePlayer = TRIPLE_TRIAD_CONSTANTS.PLAYERS.OPPONENT;
                                this.gameState.draggedCardIdx = null;

                                // Animation et capture exactement comme l'ancienne version
                                const { width, height } = this.sys.game.canvas;
                                const cellWidth = (width * 0.80) / 3;
                                const cellHeight = cellWidth * 1.5;
                                const boardWidth = cellWidth * 3;
                                const boardX = width / 2 - boardWidth / 2;
                                const cardW = Math.min(60, width / 8);
                                const cardH = cardW * 1.5;
                                const boardY = cardW * 1.5 * .72 + ((height - cardW * 1.5 * .72 - (cardW * 1.5 + 24)) - cellHeight * 3) / 2;
                                const toX = boardX + col * cellWidth + cellWidth / 2;
                                const toY = boardY + row * cellHeight + cellHeight / 2;

                                // Place immédiatement sur le plateau et lance les captures
                                this.rulesEngine.captureCards(this.boardManager.board, row, col, card, this.boardManager.getGameState());

                                this.drawAll(); // Redessine immédiatement

                                // Vérifie si la partie est finie, sinon lance l'IA
                                if (TripleTriadUtils.isBoardFull(this.boardManager.board)) {
                                    this.handleGameEnd();
                                } else {
                                    this.time.delayedCall(600, () => this.executeAITurn());
                                }
                                return;
                            }
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Configure les événements de drag & drop pour les cartes
     */
    setupDragAndDrop() {
        // ✅ ESSENTIEL : Retire les anciens listeners pour éviter les doublons
        this.input.off('drop');
        
        // Configure le drop pour chaque cellule du plateau
        this.input.on('drop', (pointer, gameObject, dropZone) => {
            if (this.draggedCardIdx !== null && 
                this.boardManager.activePlayer === TRIPLE_TRIAD_CONSTANTS.PLAYERS.PLAYER && 
                !this.gameEnded) {
                
                // Trouve la position de la cellule
                const position = this.boardManager.findCellPosition(dropZone);
                if (position && TripleTriadUtils.isCellEmpty(this.boardManager.board, position.row, position.col)) {
                    
                    if (this.gameState.isPvP) {
                        // Mode PvP : envoie au serveur
                        this.networkHandler.playCard(this.draggedCardIdx, position.row, position.col);
                        this.draggedCardIdx = null;
                    } else {
                        // Mode IA : traite localement
                        this.executePlayerMove(position.row, position.col, this.draggedCardIdx);
                        this.draggedCardIdx = null;
                    }
                }
            }
        });
        
        console.log('[TripleTriad] Drag & drop configuré');
    }
    
    /**
     * Anime le placement d'une carte
     */
    animatePlacement(placementResult, onComplete) {
        const { placedCard, position } = placementResult;
        const { width, height } = this.sys.game.canvas;
        
        // Calcule les positions de départ et d'arrivée
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
     * Nettoyage complet à la fin de partie
     */
    cleanUp() {
        console.log('[TripleTriad] Nettoyage de la scène...');
        
        // ✅ ESSENTIEL : Arrête toutes les animations actives
        if (this.animationManager) {
            this.animationManager.stopAllAnimations();
        }
        
        // ✅ ESSENTIEL : Détruit le container principal et tous ses enfants
        if (this.renderer && this.renderer.container) {
            this.renderer.container.iterate(child => {
                if (child && child.active) {
                    this.tweens.killTweensOf(child);
                }
            });
            this.renderer.container.destroy(true);
            this.renderer.container = null;
        }
        
        // ✅ ESSENTIEL : Remet à zéro tous les managers
        if (this.boardManager) {
            this.boardManager.reset();
        }
        
        if (this.networkHandler) {
            this.networkHandler.cleanup();
        }
        
        // ✅ ESSENTIEL : Nettoie les listeners d'événements
        this.input.off('drop');
        
        // ✅ ESSENTIEL : Remet à zéro les variables d'état pour le prochain match
        this.gameEnded = false;
        this.gameState.draggedCardIdx = null;
        
        // ✅ ESSENTIEL : Retire les listeners de resize
        if (this._resizeHandler) {
            window.removeEventListener("resize", this._resizeHandler);
            this._resizeHandler = null;
        }
        
        console.log('[TripleTriad] Nettoyage terminé');
    }

    /**
     * Retourne au lobby principal
     */
    returnToLobby() {
        this.cleanUp();
        this.scene.stop();
        this.scene.resume("GameScene");
    }
}