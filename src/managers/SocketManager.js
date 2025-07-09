export class SocketManager {
    constructor(scene) {
        this.scene = scene;
        this.socket = null;
        this.myId = null;
        this.challengePopup = null;
    }

    initialize() {
        this.socket = this.scene.registry.get("socket");

        if (this.socket.connected) {
            this.handleConnection();
        } else {
            this.socket.on('connect', () => {
                this.handleConnection();
            });
        }

        this.setupEventListeners();
    }

    handleConnection() {
        this.myId = this.socket.id;
        const currentMapId = this.scene.registry.get("playerData")?.mapId || 0;
        const playerData = this.scene.registry.get("playerData");

        // Envoyer les données du joueur
        this.socket.emit('newPlayer', {
            x: this.scene.playerManager?.getPlayer()?.x || 0,
            y: this.scene.playerManager?.getPlayer()?.y || 0,
            character: '/assets/apparences/' + this.scene.registry.get("playerPseudo") + '.png',
            pseudo: this.scene.registry.get("playerPseudo") || "Player",
            mapId: currentMapId,
        });

        // Envoyer registerPlayer pour Triple Triad
        if (playerData && playerData._id) {
            this.socket.emit('registerPlayer', {
                playerId: playerData._id
            });
            console.log('[SocketManager] registerPlayer envoyé avec playerId:', playerData._id);
        } else {
            console.warn('[SocketManager] PlayerData non disponible pour registerPlayer');
        }
    }

    setupEventListeners() {
        // Gestion de la déconnexion
        this.socket.on('disconnectMessage', (data) => {
            console.warn(data.message);
            this.scene.registry.set('disconnectMessage', data.message);
            this.scene.resetApplication();
            this.scene.scene.stop();
            this.scene.scene.start('MainMenuScene');
        });

        // Mise à jour des joueurs
        this.socket.on('playersUpdate', (players) => {
            const currentMapId = this.scene.registry.get("playerData")?.mapId;
            this.scene.remotePlayerManager?.handlePlayersUpdate(players, currentMapId, this.myId);
        });

        // Interactions entre joueurs
        this.socket.on("interaction", (data) => {
            if (data.to === this.myId) {
                const message = (data.action === "defier")
                    ? `Le joueur ${data.from}\n vous a défié !`
                    : `Le joueur ${data.from}\n vous fait signe !`;
                this.scene.displayMessage(message);
            }
        });

        // Mise à jour de l'apparence
        this.socket.on("appearanceUpdate", (data) => {
            if (data.id === this.myId) {
                this.scene.playerManager?.getPlayer()?.setTexture(data.character);
            } else if (this.scene.remotePlayerManager?.getOtherPlayers()[data.id]?.sprite) {
                this.scene.remotePlayerManager.getOtherPlayers()[data.id].sprite.setTexture(data.character);
            }
        });

        // Joueur quitte la carte
        this.socket.on('playerLeftMap', (data) => {
            const otherPlayers = this.scene.remotePlayerManager?.getOtherPlayers();
            if (otherPlayers && otherPlayers[data.id]) {
                if (otherPlayers[data.id].sprite) otherPlayers[data.id].sprite.destroy();
                if (otherPlayers[data.id].pseudoText) otherPlayers[data.id].pseudoText.destroy();
                delete otherPlayers[data.id];
            }
        });

        // Joueur déconnecté
        this.socket.on('playerDisconnected', (data) => {
            const otherPlayers = this.scene.remotePlayerManager?.getOtherPlayers();
            if (otherPlayers && otherPlayers[data.id]) {
                if (otherPlayers[data.id].sprite) otherPlayers[data.id].sprite.destroy();
                if (otherPlayers[data.id].pseudoText) otherPlayers[data.id].pseudoText.destroy();
                delete otherPlayers[data.id];
            }
        });

        // Challenge Triple Triad
        this.socket.on('challenge:received', ({ challengerId, matchId }) => {
            this.scene.registry.set('ttMatchId', matchId);
            this.displayChallengePopup(challengerId);
        });

        this.socket.on('challenge:accepted', ({ opponentId, opponentPlayerId, matchId }) => {
            const playerData = this.scene.registry.get("playerData");
            const playerId = playerData && playerData._id ? playerData._id : null;
            this.scene.registry.set('ttMatchId', matchId);
            console.log("Match ID reçu :", matchId);
            this.scene.scene.launch("TripleTriadSelectScene", {
                playerId,
                mode: "pvp",
                opponentId: opponentPlayerId
            });
            this.scene.scene.pause();
        });

        this.socket.on('challenge:cancelled', ({ challengerId, challengedId }) => {
            this.scene.displayMessage("Le défi a été annulé.");
            if (this.challengePopup) {
                this.challengePopup.destroy();
                this.challengePopup = null;
            }
        });
    }

    sendInteraction(targetId, action) {
        if (this.socket) {
            this.socket.emit("interaction", { from: this.myId, to: targetId, action });
        }
    }

    async sendChallenge(targetId) {
        if (!this.socket) return;

        const myPlayerId = this.scene.registry.get("playerData")?._id;
        const targetPlayerId = this.scene.remotePlayerManager?.getLatestPlayersData()?.[targetId]?.playerId;

        // 🛡️ MÊME VÉRIFICATION QUE DANS LE MENU
        const inventory = this.scene.inventory || [];
        const playerCards = inventory.filter(item => item.type === 'card' || item.nom.includes('Carte'));

        console.log('[SocketManager] Cartes dans l\'inventaire:', playerCards);

        if (playerCards.length < 5) {
            this.scene.displayMessage("Vous devez posséder au moins\n5 cartes pour défier un joueur !");
            return;
        }

        const matchId = `tt-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        this.scene.registry.set('ttMatchId', matchId);
        this.socket.emit("challenge:send", {
            challengerId: this.myId,
            challengedId: targetId,
            challengerPlayerId: myPlayerId,
            challengedPlayerId: targetPlayerId,
            matchId
        });
    }


    sendQuizInvite(targetId) {
        if (this.socket) {
            const myPlayerId = this.scene.registry.get("playerData")?._id;
            const targetPlayerId = this.scene.remotePlayerManager?.getLatestPlayersData()?.[targetId]?.playerId;
            const gameId = `quiz-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

            this.socket.emit("quiz:invite", {
                challengerId: this.myId,
                challengedId: targetId,
                challengerPlayerId: myPlayerId,
                challengedPlayerId: targetPlayerId,
                gameId
            });
        }
    }

    displayChallengePopup(challengerId) {
        if (this.challengePopup) {
            this.challengePopup.destroy();
        }

        let popupX = this.scene.scale.width / 2;
        let popupY = this.scene.scale.height / 2;
        let challengerPseudo = challengerId;

        const latestPlayersData = this.scene.remotePlayerManager?.latestPlayersData;
        if (latestPlayersData && latestPlayersData[challengerId]) {
            challengerPseudo = latestPlayersData[challengerId].pseudo || challengerId;
            const challengerData = latestPlayersData[challengerId];
            popupX = challengerData.x;
            popupY = challengerData.y - 60;
        }

        this.challengePopup = this.scene.add.container(popupX, popupY);

        const bg = this.scene.add.rectangle(0, 0, 340, 180, 0x222244, 0.95).setOrigin(0.5).setDepth(1003);
        const txt = this.scene.add.text(0, -40, `Défi reçu de ${challengerPseudo}\nAccepter le duel ?`, {
            font: "22px Arial",
            fill: "#fff",
            align: "center"
        }).setOrigin(0.5).setDepth(1004);

        const btnAccept = this.scene.add.text(-60, 40, "Accepter", {
            font: "20px Arial",
            fill: "#00ff00",
            backgroundColor: "#333",
            padding: { x: 12, y: 8 }
        }).setOrigin(0.5).setInteractive().setDepth(1004);

        const btnRefuse = this.scene.add.text(60, 40, "Refuser", {
            font: "20px Arial",
            fill: "#ff3333",
            backgroundColor: "#333",
            padding: { x: 12, y: 8 }
        }).setOrigin(0.5).setInteractive().setDepth(1004);

        btnAccept.on("pointerdown", () => {
            const myPlayerId = this.scene.registry.get("playerData")?._id;
            const challengerPlayerId = latestPlayersData[challengerId]?.playerId;
            const matchId = this.scene.registry.get('ttMatchId');
            this.socket.emit('challenge:accept', {
                challengerId,
                challengedId: this.myId,
                challengerPlayerId,
                challengedPlayerId: myPlayerId,
                matchId
            });
            this.challengePopup.destroy();
            this.challengePopup = null;
        });

        btnRefuse.on("pointerdown", () => {
            this.socket.emit('challenge:cancel', { challengerId, challengedId: this.myId });
            this.challengePopup.destroy();
            this.challengePopup = null;
        });

        this.challengePopup.add([bg, txt, btnAccept, btnRefuse]);
        this.challengePopup.setDepth(1005);
        this.challengePopup.setScrollFactor(1);
    }

    getSocket() {
        return this.socket;
    }

    getMyId() {
        return this.myId;
    }

    destroy() {
        if (this.socket) {
            this.socket.off('disconnectMessage');
            this.socket.off('playersUpdate');
            this.socket.off('interaction');
            this.socket.off('appearanceUpdate');
            this.socket.off('playerLeftMap');
            this.socket.off('playerDisconnected');
            this.socket.off('challenge:received');
            this.socket.off('challenge:accepted');
            this.socket.off('challenge:cancelled');
        }

        if (this.challengePopup) {
            this.challengePopup.destroy();
            this.challengePopup = null;
        }
    }
}