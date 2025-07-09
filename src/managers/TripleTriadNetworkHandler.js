/**
 * Gestionnaire réseau pour Triple Triad en mode PvP
 * Gère les communications WebSocket avec le serveur
 */
export class TripleTriadNetworkHandler {
    
    constructor(scene, socket) {
        this.scene = scene;
        this.socket = socket;
        this.matchId = null;
        this.playerId = null;
        this.opponentId = null;
        this.isPvP = false;
        this.eventHandlers = new Map();
    }
    
    /**
     * Initialise une session PvP
     */
    initializePvP(matchId, playerId, opponentId, playerCards) {
        this.matchId = matchId;
        this.playerId = playerId;
        this.opponentId = opponentId;
        this.isPvP = true;
        
        this.setupSocketEvents();
        
        // Démarre le match
        this.socket.emit('tt:startMatch', {
            matchId: this.matchId,
            playerId: this.playerId,
            opponentId: this.opponentId,
            playerCards: playerCards
        });
    }
    
    /**
     * Configure les événements Socket.IO
     */
    setupSocketEvents() {
        // Match prêt
        this.registerHandler('tt:matchReady', (data) => {
            this.scene.events.emit('match-ready', data);
        });
        
        // Mise à jour du jeu
        this.registerHandler('tt:update', (data) => {
            this.scene.events.emit('game-update', data);
        });
        
        // Erreur de match
        this.registerHandler('tt:error', (error) => {
            this.scene.events.emit('match-error', error);
        });
        
        // Match annulé
        this.registerHandler('tt:matchCancelled', () => {
            this.scene.events.emit('match-cancelled');
        });
        
        // Joueur déconnecté
        this.registerHandler('tt:playerDisconnected', (data) => {
            this.scene.events.emit('player-disconnected', data);
        });
    }
    
    /**
     * Enregistre un gestionnaire d'événement
     */
    registerHandler(event, handler) {
        if (this.eventHandlers.has(event)) {
            this.socket.off(event, this.eventHandlers.get(event));
        }
        
        this.eventHandlers.set(event, handler);
        this.socket.on(event, handler);
    }
    
    /**
     * Envoie un coup au serveur
     */
    playCard(cardIndex, row, col) {
        if (!this.isPvP || !this.matchId) {
            console.error('[TripleTriad Network] Tentative de jouer sans session PvP active');
            return false;
        }
        
        this.socket.emit('tt:playCard', {
            matchId: this.matchId,
            playerId: this.playerId,
            cardIdx: cardIndex,
            row,
            col
        });
        
        return true;
    }
    
    /**
     * Abandonne la partie
     */
    forfeit() {
        if (!this.isPvP || !this.matchId) return false;
        
        this.socket.emit('tt:forfeit', {
            matchId: this.matchId,
            playerId: this.playerId
        });
        
        return true;
    }
    
    /**
     * Envoie un message de chat
     */
    sendChatMessage(message) {
        if (!this.isPvP || !this.matchId) return false;
        
        this.socket.emit('tt:chat', {
            matchId: this.matchId,
            playerId: this.playerId,
            message
        });
        
        return true;
    }
    
    /**
     * Demande un rematch
     */
    requestRematch() {
        if (!this.isPvP || !this.matchId) return false;
        
        this.socket.emit('tt:rematchRequest', {
            matchId: this.matchId,
            playerId: this.playerId
        });
        
        return true;
    }
    
    /**
     * Répond à une demande de rematch
     */
    respondToRematch(accept) {
        if (!this.isPvP || !this.matchId) return false;
        
        this.socket.emit('tt:rematchResponse', {
            matchId: this.matchId,
            playerId: this.playerId,
            accept
        });
        
        return true;
    }
    
    /**
     * Vérifie la connexion réseau
     */
    checkConnection() {
        return this.socket && this.socket.connected;
    }
    
    /**
     * Obtient le ping avec le serveur
     */
    getPing(callback) {
        if (!this.checkConnection()) {
            callback(null, new Error('Pas de connexion'));
            return;
        }
        
        const start = Date.now();
        this.socket.emit('ping', start);
        
        const pingHandler = (timestamp) => {
            const ping = Date.now() - timestamp;
            this.socket.off('pong', pingHandler);
            callback(ping, null);
        };
        
        this.socket.on('pong', pingHandler);
        
        // Timeout après 5 secondes
        setTimeout(() => {
            this.socket.off('pong', pingHandler);
            callback(null, new Error('Timeout'));
        }, 5000);
    }
    
    /**
     * Obtient les statistiques réseau
     */
    getNetworkStats() {
        return {
            connected: this.checkConnection(),
            matchId: this.matchId,
            playerId: this.playerId,
            opponentId: this.opponentId,
            isPvP: this.isPvP,
            eventsRegistered: this.eventHandlers.size
        };
    }
    
    /**
     * Nettoie les gestionnaires d'événements
     */
    cleanup() {
        // Supprime tous les gestionnaires d'événements
        this.eventHandlers.forEach((handler, event) => {
            this.socket.off(event, handler);
        });
        this.eventHandlers.clear();
        
        // Remet à zéro les propriétés
        this.matchId = null;
        this.playerId = null;
        this.opponentId = null;
        this.isPvP = false;
    }
    
    /**
     * Gère la reconnexion automatique
     */
    handleReconnection() {
        if (!this.checkConnection()) {
            console.warn('[TripleTriad Network] Connexion perdue, tentative de reconnexion...');
            
            // Émet un événement pour informer la scène
            this.scene.events.emit('connection-lost');
            
            // Tente de se reconnecter
            this.socket.connect();
            
            this.socket.once('connect', () => {
                console.log('[TripleTriad Network] Reconnexion réussie');
                this.scene.events.emit('connection-restored');
                
                // Redémarre le match si nécessaire
                if (this.matchId && this.playerId) {
                    this.socket.emit('tt:rejoinMatch', {
                        matchId: this.matchId,
                        playerId: this.playerId
                    });
                }
            });
        }
    }
    
    /**
     * Configure la gestion automatique des déconnexions
     */
    setupAutoReconnect() {
        this.socket.on('disconnect', () => {
            console.warn('[TripleTriad Network] Déconnexion détectée');
            this.scene.events.emit('connection-lost');
            
            // Tente de se reconnecter automatiquement après 2 secondes
            setTimeout(() => {
                this.handleReconnection();
            }, 2000);
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('[TripleTriad Network] Erreur de connexion:', error);
            this.scene.events.emit('connection-error', error);
        });
    }
}