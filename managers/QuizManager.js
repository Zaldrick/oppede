class QuizManager {
    constructor(io, databaseManager) {
        this.io = io;
        this.db = databaseManager;
        this.quizGames = {};
        this.quizInvites = {};
    }

    setupEvents(socket) {
        // Événements Quiz système lobby
        socket.on('quiz:requestGamesList', () => this.handleRequestGamesList(socket));
        socket.on('quiz:createGame', (data) => this.handleCreateGame(socket, data));
        socket.on('quiz:joinGame', (data) => this.handleJoinGame(socket, data));
        socket.on('quiz:leaveGame', (data) => this.handleLeaveGame(socket, data));
        socket.on('quiz:cancelGame', (data) => this.handleCancelGame(socket, data));
        socket.on('quiz:startGame', (data) => this.handleStartGame(socket, data));
        socket.on('quiz:submitAnswer', (data) => this.handleSubmitAnswer(socket, data));
        socket.on('quiz:invite', (data) => this.handleQuizInvite(socket, data));
    }

    handleRequestGamesList(socket) {
        const availableGames = Object.values(this.quizGames).filter(game => 
            game.status === 'waiting' && game.players.length < game.maxPlayers
        );
        socket.emit('quiz:gamesList', availableGames);
    }

    handleCreateGame(socket, { gameId, hostId, hostName, maxPlayers, gameMode, categories, difficulty, totalQuestions }) {
        console.log(`[Quiz] Création d'un quiz: ${gameId} par ${hostName}`);
        console.log(`[Quiz] Options: Mode=${gameMode}, Catégories=${categories}, Difficulté=${difficulty}`);

        this.quizGames[gameId] = {
            gameId,
            hostId: hostId,  
            hostName,
            maxPlayers,
            players: [{
                id: hostId,
                name: hostName,
                socketId: socket.id,
                score: 0,
                answeredQuestions: []
            }],
            status: 'waiting',
            createdAt: Date.now(),
            questions: [],
            currentQuestion: 0,
            gameMode: gameMode || 'classic',
            categories: categories || ['Géographie'],
            difficulty: difficulty || 'moyen',
            totalQuestions: totalQuestions || 10,
            playerAnswers: {},
            questionStartTime: null
        };

        socket.join(gameId);
        socket.emit('quiz:gameCreated', this.quizGames[gameId]);

        // Notifier tous les clients qu'un nouveau quiz est disponible
        this.io.emit('quiz:gamesList', Object.values(this.quizGames).filter(game =>
            game.status === 'waiting' && game.players.length < game.maxPlayers
        ));
    }

    handleJoinGame(socket, { gameId, playerId, playerName }) {
        const game = this.quizGames[gameId];

        if (!game) {
            socket.emit('quiz:joinError', { message: 'Quiz inexistant' });
            return;
        }

        if (game.players.length >= game.maxPlayers) {
            socket.emit('quiz:joinError', { message: 'Quiz complet' });
            return;
        }

        if (game.status !== 'waiting') {
            socket.emit('quiz:joinError', { message: 'Quiz déjà commencé' });
            return;
        }

        if (game.players.find(p => p.id === playerId)) {
            socket.emit('quiz:joinError', { message: 'Vous êtes déjà dans ce quiz' });
            return;
        }

        console.log(`[Quiz] ${playerName} rejoint le quiz ${gameId}`);

        game.players.push({
            id: playerId,
            name: playerName,
            socketId: socket.id,
            score: 0
        });

        socket.join(gameId);
        socket.emit('quiz:gameJoined', game);

        // Notifier tous les joueurs du quiz
        this.io.to(gameId).emit('quiz:gameUpdated', game);

        // Mettre à jour la liste des quiz disponibles
        this.io.emit('quiz:gamesList', Object.values(this.quizGames).filter(game =>
            game.status === 'waiting' && game.players.length < game.maxPlayers
        ));
    }

    handleLeaveGame(socket, { gameId }) {
        const game = this.quizGames[gameId];
        if (!game) return;

        const playerIndex = game.players.findIndex(p => p.socketId === socket.id);
        if (playerIndex === -1) return;

        const leavingPlayer = game.players[playerIndex];
        console.log(`[Quiz] ${leavingPlayer.name} quitte le quiz ${gameId}`);

        game.players.splice(playerIndex, 1);
        socket.leave(gameId);

        // Si c'était l'organisateur ou s'il n'y a plus de joueurs
        if (leavingPlayer.id === game.hostId || game.players.length === 0) {
            this.io.to(gameId).emit('quiz:gameCancelled');
            delete this.quizGames[gameId];
        } else {
            // Notifier les autres joueurs
            this.io.to(gameId).emit('quiz:gameUpdated', game);
        }

        // Mettre à jour la liste des quiz disponibles
        this.io.emit('quiz:gamesList', Object.values(this.quizGames).filter(game =>
            game.status === 'waiting' && game.players.length < game.maxPlayers
        ));
    }


    handleCancelGame(socket, { gameId }) {
        const game = this.quizGames[gameId];
        if (!game) return;

        // AJOUTER : Trouver le joueur par socket.id et vérifier si c'est l'organisateur
        const player = game.players.find(p => p.socketId === socket.id);
        if (!player || player.id !== game.hostId) return;

        console.log(`[Quiz] Annulation du quiz ${gameId} par l'organisateur`);

        this.io.to(gameId).emit('quiz:gameCancelled');
        delete this.quizGames[gameId];

        // Mettre à jour la liste des quiz disponibles
        this.io.emit('quiz:gamesList', Object.values(this.quizGames).filter(game =>
            game.status === 'waiting' && game.players.length < game.maxPlayers
        ));
    }

    async handleStartGame(socket, { gameId }) {
        const game = this.quizGames[gameId];

        if (!game) {
            console.log(`[Quiz] Erreur: Quiz ${gameId} introuvable`);
            socket.emit('quiz:startError', { message: 'Quiz introuvable' });
            return;
        }

        // AJOUTER : Vérifier par socket.id puis comparer l'ID du joueur
        const player = game.players.find(p => p.socketId === socket.id);
        if (!player || player.id !== game.hostId) {
            console.log(`[Quiz] Erreur: ${socket.id} n'est pas l'organisateur de ${gameId} (organisateur: ${game.hostId})`);
            socket.emit('quiz:startError', { message: 'Vous n\'êtes pas l\'organisateur de ce quiz' });
            return;
        }

        if (game.players.length < 2) {
            console.log(`[Quiz] Erreur: Pas assez de joueurs (${game.players.length}/2 minimum)`);
            socket.emit('quiz:startError', { message: 'Il faut au moins 2 joueurs pour commencer' });
            return;
        }

        console.log(`[Quiz] Lancement du quiz ${gameId} avec ${game.players.length} joueurs`);
        console.log(`[Quiz] Catégories: ${game.categories.join(', ')}, Difficulté: ${game.difficulty}`);

        try {
            game.status = 'playing';
            game.questions = await this.db.getRandomQuestions(game.categories, game.difficulty, game.totalQuestions);

            if (!game.questions || game.questions.length === 0) {
                console.error(`[Quiz] Aucune question trouvée pour ${gameId}`);
                socket.emit('quiz:startError', { message: 'Aucune question disponible pour ces catégories' });
                return;
            }

            game.currentQuestion = 0;
            game.playerAnswers = {};

            console.log(`[Quiz] ${game.questions.length} questions chargées pour ${gameId}`);

            // Notifier tous les joueurs que le quiz commence
            this.io.to(gameId).emit('quiz:gameStarted', {
                gameId: game.gameId,
                playerId: game.hostId,
                playerName: game.hostName,
                isHost: true,
                gameInfo: {
                    categories: game.categories,
                    difficulty: game.difficulty,
                    totalQuestions: game.questions.length
                },
                gameData: game
            });

            // Retirer de la liste des quiz disponibles
            this.io.emit('quiz:gamesList', Object.values(this.quizGames).filter(game =>
                game.status === 'waiting' && game.players.length < game.maxPlayers
            ));

            // Démarrer la première question après un délai
            setTimeout(() => {
                this.sendNextQuestion(gameId);
            }, 4000);

        } catch (error) {
            console.error(`[Quiz] Erreur lors du lancement du quiz ${gameId}:`, error);
            socket.emit('quiz:startError', { message: 'Erreur lors du lancement du quiz' });
        }
    }

    handleSubmitAnswer(socket, { gameId, playerId, answer, timeRemaining }) {
        const game = this.quizGames[gameId];
        if (!game) return;
        
        console.log(`[Quiz] Réponse reçue de ${playerId}: ${answer} pour ${gameId}`);
        console.log(`[Quiz] Socket ID: ${socket.id}`);
        
        // Vérifier si le joueur existe dans la liste
        const player = game.players.find(p => p.id === playerId);
        if (!player) {
            console.error(`[Quiz] Joueur ${playerId} introuvable dans la partie ${gameId}`);
            console.log(`[Quiz] Joueurs dans la partie:`, game.players.map(p => ({ id: p.id, name: p.name, socketId: p.socketId })));
            return;
        }

        // Vérifier que le socket correspond bien au joueur
        if (player.socketId !== socket.id) {
            console.error(`[Quiz] Socket ID ${socket.id} ne correspond pas au joueur ${playerId} (socket attendu: ${player.socketId})`);
            return;
        }
        
        if (game.playerAnswers[playerId]) {
            console.log(`[Quiz] ${playerId} a déjà répondu à cette question`);
            return;
        }
        
        game.playerAnswers[playerId] = {
            answer: answer,
            timeRemaining: timeRemaining,
            timestamp: Date.now()
        };
        
        const answersReceived = Object.keys(game.playerAnswers).length;
        const totalPlayers = game.players.length;
        
        console.log(`[Quiz] ${answersReceived}/${totalPlayers} réponses reçues pour ${gameId}`);
        console.log(`[Quiz] Réponses reçues de:`, Object.keys(game.playerAnswers));
        console.log(`[Quiz] Joueurs dans la partie:`, game.players.map(p => p.id));
        
        // Confirmer à celui qui a répondu que sa réponse est reçue
        socket.emit('quiz:answerReceived', {
            answersReceived: answersReceived,
            totalPlayers: totalPlayers
        });
        
        // Notifier TOUS les joueurs de l'état d'attente (y compris l'organisateur)
        this.io.to(gameId).emit('quiz:waitingForAnswers', {
            answersReceived: answersReceived,
            totalPlayers: totalPlayers
        });
        
        if (answersReceived >= totalPlayers) {
            console.log(`[Quiz] Toutes les réponses reçues pour ${gameId}, envoi des résultats`);
            setTimeout(() => {
                this.sendRoundResults(gameId);
            }, 1000);
        }
    }

    handleQuizInvite(socket, { challengerId, challengedId, challengerPlayerId, challengedPlayerId, gameId }) {
        this.quizInvites[challengedId] = { challengerId, gameId };
        this.io.to(challengedId).emit('quiz:invitation', {
            challengerId,
            challengerPlayerId,
            gameId,
            message: `Un joueur vous invite à un quiz !`
        });
    }

    sendNextQuestion(gameId) {
        const game = this.quizGames[gameId];
        if (!game || game.currentQuestion >= game.questions.length) {
            this.endQuizGame(gameId);
            return;
        }

        const question = game.questions[game.currentQuestion];
        game.playerAnswers = {};

        console.log(`[Quiz] Envoi question ${game.currentQuestion + 1}/${game.questions.length} pour ${gameId}`);
        console.log(`[Quiz] Question: ${question.question}`);

        this.io.to(gameId).emit('quiz:questionStart', {
            question: {
                question: question.question,
                answers: question.answers,
                category: question.category
            },
            questionNumber: game.currentQuestion + 1,
            totalQuestions: game.questions.length,
            timeLimit: 30
        });

        setTimeout(() => {
            if (game && Object.keys(game.playerAnswers).length < game.players.length) {
                console.log(`[Quiz] Timeout atteint pour ${gameId}, passage aux résultats`);
                this.sendRoundResults(gameId);
            }
        }, 35000);
    }

    sendRoundResults(gameId) {
        const game = this.quizGames[gameId];
        if (!game) return;

        const currentQ = game.questions[game.currentQuestion];
        console.log(`[Quiz] Envoi résultats question ${game.currentQuestion + 1} pour ${gameId}`);

        const totalPlayers = game.players.length;
        const correctAnswers = [];

        Object.entries(game.playerAnswers).forEach(([playerId, answerData]) => {
            if (answerData.answer === currentQ.correct && answerData.answer >= 0) {
                correctAnswers.push({
                    playerId,
                    timestamp: answerData.timestamp
                });
            }
        });

        correctAnswers.sort((a, b) => a.timestamp - b.timestamp);

        correctAnswers.forEach((answer, index) => {
            const player = game.players.find(p => p.id === answer.playerId);
            if (player) {
                const points = totalPlayers - index;
                player.score += points;
                console.log(`[Quiz] ${player.name} a gagné ${points} points (position ${index + 1})`);
            }
        });

        const leaderboard = game.players
            .sort((a, b) => b.score - a.score)
            .map((player, index) => ({
                id: player.id,
                name: player.name,
                score: player.score,
                rank: index + 1
            }));

        const resultsData = {
            correctAnswer: currentQ.correct,
            correctAnswerText: currentQ.answers[currentQ.correct],
            question: currentQ.question,
            leaderboard: leaderboard,
            questionNumber: game.currentQuestion + 1,
            totalQuestions: game.questions.length,
            pointsDistribution: correctAnswers.map((answer, index) => ({
                playerId: answer.playerId,
                points: totalPlayers - index,
                position: index + 1
            }))
        };

        this.io.to(gameId).emit('quiz:roundResults', resultsData);

        setTimeout(() => {
            game.currentQuestion++;
            if (game.currentQuestion >= game.questions.length) {
                this.endQuizGame(gameId);
            } else {
                this.sendNextQuestion(gameId);
            }
        }, 5000);
    }

    endQuizGame(gameId) {
        const game = this.quizGames[gameId];
        if (!game) return;
        
        console.log(`[Quiz] Fin du quiz ${gameId}`);
        
        const finalLeaderboard = game.players
            .sort((a, b) => b.score - a.score)
            .map((player, index) => ({
                id: player.id,
                name: player.name,
                score: player.score,
                rank: index + 1,
                medal: index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}.`
            }));
        
        const podium = finalLeaderboard.slice(0, 3);
        
        const endData = {
            finalLeaderboard: finalLeaderboard,
            podium: podium,
            gameId: gameId,
            totalQuestions: game.questions.length
        };
        
        this.io.to(gameId).emit('quiz:gameEnd', endData);
        
        setTimeout(() => {
            delete this.quizGames[gameId];
            console.log(`[Quiz] Quiz ${gameId} supprimé de la mémoire`);
        }, 30000);
    }

    handleDisconnect(socket) {
        // Nettoyage des quiz lors de la déconnexion
        for (const gameId in this.quizGames) {
            const game = this.quizGames[gameId];
            const playerIndex = game.players.findIndex(p => p.socketId === socket.id);
            if (playerIndex !== -1) {
                game.players.splice(playerIndex, 1);
                if (game.hostId === socket.id || game.players.length === 0) {
                    this.io.to(gameId).emit('quiz:gameCancelled');
                    delete this.quizGames[gameId];
                } else {
                    this.io.to(gameId).emit('quiz:gameUpdated', game);
                }
            }
        }
    }
}

module.exports = QuizManager;