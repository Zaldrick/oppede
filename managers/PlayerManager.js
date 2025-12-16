class PlayerManager {
    constructor(io, databaseManager) {
        this.io = io;
        this.db = databaseManager;
        this.players = {};
        this.chatMessages = [];
        this.playerIdToSocketId = {};
    }

    setupEvents(socket) {
        socket.on('newPlayer', async (data) => this.handleNewPlayer(socket, data));
        socket.on('playerMove', (data) => this.handlePlayerMove(socket, data));
        socket.on('interaction', (data) => this.handleInteraction(socket, data));
        socket.on('chatMessage', (data, callback) => this.handleChatMessage(socket, data, callback));
        socket.on('updatePseudo', (data) => this.handleUpdatePseudo(data));
        socket.on('updateAppearance', (data) => this.handleUpdateAppearance(data));
        socket.on('registerPlayer', ({ playerId }) => this.handleRegisterPlayer(socket, playerId));

        // Envoyer l'historique des messages au nouveau client
        socket.emit('chatHistory', this.chatMessages);
    }

    async handleNewPlayer(socket, data) {
        const { pseudo, mapId = 0 } = data;

        // V�rifier si le pseudo est d�j� connect�
        const existingPlayerSocketId = Object.keys(this.players).find(
            (id) => this.players[id].pseudo === pseudo
        );

        // R�cup�rer le playerData depuis MongoDB
        const db = await this.db.connectToDatabase();
        const playersCollection = db.collection('players');
        const playerData = await playersCollection.findOne({ pseudo });

        if (existingPlayerSocketId && existingPlayerSocketId !== socket.id) {
            // D�connecter l'ancienne connexion (m�me pseudo, autre socket)
            // IMPORTANT: ne pas envoyer 'disconnectMessage' car le client force un retour au menu.
            // On coupe simplement l'ancienne socket pour �viter les doubles sessions.
            delete this.players[existingPlayerSocketId];
            this.io.sockets.sockets.get(existingPlayerSocketId)?.disconnect(true);
        }

        this.players[socket.id] = {
            x: data.x,
            y: data.y,
            mapId,
            character: data.character || `/assets/apparences/${data.pseudo}.png`,
            pseudo: data.pseudo || "Inconnu",
            playerId: playerData._id
        };
    }

    handleRegisterPlayer(socket, playerId) {
        if (playerId) {
            this.playerIdToSocketId[playerId] = socket.id;
            socket.playerId = playerId;
        }
    }

    handlePlayerMove(socket, data) {
        if (this.players[socket.id]) {
            if (data.mapId === undefined) {
                console.warn(`MapId non d�fini pour le joueur ${socket.id}. Donn�es re�ues :`, data);
                return;
            }
            const previousMapId = this.players[socket   .id].mapId;
            this.players[socket.id].x = data.x;
            this.players[socket.id].y = data.y;
            this.players[socket.id].mapId = data.mapId;
            this.players[socket.id].anim = data.anim;

            if (previousMapId !== data.mapId) {
                this.io.emit('playerLeftMap', { id: socket.id, mapId: previousMapId });
            }
        } else {
            console.warn(`Tentative de mise � jour pour un joueur non enregistr� : ${socket.id}`);
        }
    }

    handleInteraction(socket, data) {
        console.log(`Interaction re�ue :`, data);
        console.log(`Interaction de ${data.from} vers ${data.to} : ${data.action}`);
        
        // Gestion des interactions par playerId
        if (data.fromPlayerId && data.toPlayerId) {
            const toSocketId = this.playerIdToSocketId[data.toPlayerId];
            if (toSocketId) {
                this.io.to(toSocketId).emit('interaction', { 
                    fromPlayerId: data.fromPlayerId, 
                    toPlayerId: data.toPlayerId, 
                    action: data.action 
                });
            }
        }

        // Notify the emitter
        socket.emit('interactionFeedback', {
            from: data.from,
            to: data.to,
            action: data.action,
            type: 'emitter',
        });

        // Notify the receiver
        if (this.players[data.to]) {
            this.io.to(data.to).emit('interactionFeedback', {
                from: data.from,
                to: data.to,
                action: data.action,
                type: 'receiver',
            });

            // Handle "faireSigne" action
            if (data.action === "faireSigne") {
                const senderPseudo = this.players[data.from]?.pseudo || "Inconnu";
                this.io.to(data.to).emit('chatMessage', {
                    pseudo: "System",
                    message: `Le joueur ${senderPseudo} vous a fait signe !`
                });
            }
        } else {
            console.warn(`Le joueur cible ${data.to} n'est pas connect�.`);
        }
    }

    handleChatMessage(socket, data, callback) {
        console.log(`Tentative de r�ception de 'chatMessage' de ${socket.id}`);

        // Validation des donn�es re�ues
        if (!data || !data.message || typeof data.message !== 'string' || !data.pseudo || data.mapId === undefined) {
            console.warn(`Message invalide re�u de ${socket.id}:`, data);
            if (callback) callback({ status: 'error', message: 'Message invalide' });
            return;
        }

        // Inclure le mapId dans le message
        const message = { pseudo: data.pseudo, message: data.message, mapId: data.mapId };
        this.chatMessages.push(message);

        // Diffuser le message � tous les clients
        this.io.emit('chatMessage', message);

        if (callback) {
            callback({ status: 'ok', message: 'Message re�u par le serveur' });
        }
    }

    handleUpdatePseudo(data) {
        if (this.players[data.id]) {
            this.players[data.id].pseudo = data.pseudo;
            console.log(`Pseudo updated for ${data.id}: ${data.pseudo}`);
        }
    }

    handleUpdateAppearance(data) {
        if (this.players[data.id]) {
            this.players[data.id].character = data.character;
            this.io.emit('appearanceUpdate', { id: data.id, character: data.character });
            console.log(`Appearance updated for ${data.id}: ${data.character}`);
        }
    }

    handleDisconnect(socket) {
        console.log(`Joueur d�connect� : ${socket.id}`);
        const disconnectedPlayer = this.players[socket.id];
        if (socket.playerId) delete this.playerIdToSocketId[socket.playerId];
        delete this.players[socket.id];

        // Informer les autres joueurs de la d�connexion
        this.io.emit('playerDisconnected', { id: socket.id, mapId: disconnectedPlayer?.mapId });

        console.log("�tat actuel des joueurs apr�s d�connexion :", this.players);
    }

    getPlayers() {
        return this.players;
    }

    getPlayerIdToSocketId() {
        return this.playerIdToSocketId;
    }

    startPlayersUpdateBroadcast() {
        // Diffuser l'�tat complet des joueurs 20 fois par seconde (toutes les 50ms)
        setInterval(() => {
            const playersWithMapId = Object.keys(this.players).reduce((result, id) => {
                result[id] = {
                    ...this.players[id],
                    mapId: this.players[id].mapId || 0,
                };
                return result;
            }, {});

            this.io.emit('playersUpdate', playersWithMapId);
        }, 50);
    }
}

module.exports = PlayerManager;