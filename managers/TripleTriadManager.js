class TripleTriadManager {
    constructor(io) {
        this.io = io;
        this.matches = {};
        this.challenges = {};
        this.players = {};
        this.dirs = [
            { dr: -1, dc: 0, self: "powerUp", opp: "powerDown" },
            { dr: 1, dc: 0, self: "powerDown", opp: "powerUp" },
            { dr: 0, dc: -1, self: "powerLeft", opp: "powerRight" },
            { dr: 0, dc: 1, self: "powerRight", opp: "powerLeft" }
        ];
    }

    setupEvents(socket) {
        socket.on('registerPlayer', ({ playerId }) => {
            this.players[socket.id] = playerId;
            console.log(`[TripleTriad] Joueur ${playerId} enregistré avec socket ${socket.id}`);
        });

        socket.on('challenge:send', (data) => this.handleChallengeSend(socket, data));
        socket.on('challenge:accept', (data) => this.handleChallengeAccept(socket, data));
        socket.on('challenge:cancel', (data) => this.handleChallengeCancel(socket, data));
        socket.on('tt:startMatch', (data) => this.handleStartMatch(socket, data));
        socket.on('tt:playCard', (data) => this.handlePlayCard(socket, data));
        socket.on('tt:leaveMatch', (data) => this.handleLeaveMatch(socket, data));
    }

    handleStartMatch(socket, { matchId, playerId, opponentId, playerCards, rules }) {
        console.log(`[TripleTriad] Démarrage du match ${matchId}`);
        console.log(`[TripleTriad] Règles reçues du client:`, rules);

        if (!this.matches[matchId]) {
            let finalRules = rules;

            if (!finalRules) {
                const challengeData = Object.values(this.challenges).find(c => c.matchId === matchId);
                finalRules = challengeData?.rules;
                console.log(`[TripleTriad] Challenge data trouvé:`, challengeData);
            }

            if (!finalRules) {
                finalRules = {
                    same: false,
                    plus: false,
                    murale: false,
                    mortSubite: false
                };
                console.log(`[TripleTriad] Utilisation des règles par défaut`);
            }

            console.log(`[TripleTriad] Règles finales utilisées:`, finalRules);

            this.matches[matchId] = {
                players: [socket.id],
                playerIds: [playerId],
                playerCards: { [playerId]: playerCards },
                state: {
                    board: Array.from({ length: 3 }, () => Array(3).fill(null)),
                    turn: playerId,
                    gameEnded: false,
                    scores: { [playerId]: 5 },
                    moves: []
                },
                rules: finalRules
            };
            socket.join(matchId);
            console.log(`[TripleTriad] Match créé avec les règles:`, finalRules);
        } else {
            this.matches[matchId].players.push(socket.id);
            this.matches[matchId].playerIds.push(playerId);
            this.matches[matchId].playerCards[playerId] = playerCards;
            this.matches[matchId].state.scores[playerId] = 5;
            socket.join(matchId);

            console.log(`[TripleTriad] Match ${matchId} prêt avec ${this.matches[matchId].players.length} joueurs`);
            console.log(`[TripleTriad] Règles du match prêt:`, this.matches[matchId].rules);

            const match = this.matches[matchId];
            const [player1Id, player2Id] = match.playerIds;

            match.players.forEach((socketId, index) => {
                const currentPlayerId = match.playerIds[index];
                const opponentPlayerId = match.playerIds[1 - index];

                this.io.to(socketId).emit('tt:matchReady', {
                    playerCards: match.playerCards[currentPlayerId],
                    opponentCards: match.playerCards[opponentPlayerId],
                    state: match.state,
                    rules: match.rules,
                    players: match.playerIds
                });
            });
        }
    }

    handlePlayCard(socket, { matchId, playerId, cardIdx, row, col }) {
        const match = this.matches[matchId];
        if (!match || match.state.turn !== playerId || match.state.board[row][col]) {
            return;
        }

        const card = match.playerCards[playerId][cardIdx];
        if (!card) return;

        match.playerCards[playerId][cardIdx].played = true;

        card.owner = playerId;
        card.cardIdx = cardIdx;
        match.state.board[row][col] = card;
        match.state.moves.push({ playerId, cardIdx, row, col });

        console.log(`[TripleTriad] Règles actives pour ${matchId}:`, match.rules);

        const appliedRules = this.applySpecialRules(match, row, col, card);

        if (appliedRules.length > 0) {
            console.log(`[TripleTriad] Règles appliquées: ${appliedRules.join(', ')}`);
        } else {
            console.log(`[TripleTriad] Aucune règle spéciale appliquée`);
        }

        const playerIndex = match.playerIds.indexOf(playerId);
        const nextPlayerIndex = (playerIndex + 1) % match.playerIds.length;
        match.state.turn = match.playerIds[nextPlayerIndex];

        const totalMoves = match.state.moves.length;
        if (totalMoves >= 9) {
            match.state.gameEnded = true;

            if (match.rules.mortSubite) {
                const scores = this.calculateScores(match.state.board, match.playerIds);
                const playerScores = Object.values(scores);

                if (playerScores[0] === playerScores[1]) {
                    console.log(`[TripleTriad] Mort subite activée pour le match ${matchId}`);
                    match.state.board = Array.from({ length: 3 }, () => Array(3).fill(null));
                    match.playerCards = Object.fromEntries(
                        match.playerIds.map(pid => [pid, match.playerCards[pid].map(card => ({ ...card, played: false }))])
                    );
                    match.state.moves = [];
                    match.state.round = (match.state.round || 1) + 1;
                    match.state.gameEnded = false;
                    this.io.to(matchId).emit('tt:suddenDeath', { message: "Mort subite ! Nouvelle manche." });
                }
            }

            // ✅ NOUVEAU : Attribution des points pour les deux joueurs
            if (match.state.gameEnded) {
                this.handleGameEnd(matchId);
            }
        }

        this.io.to(matchId).emit('tt:update', {
            state: match.state,
            appliedRules,
            rules: match.rules
        });
    }

    // ✅ NOUVELLE MÉTHODE : Gestion de fin de partie avec attribution de points pour les deux joueurs
    async handleGameEnd(matchId) {
        const match = this.matches[matchId];
        if (!match) return;

        console.log(`[TripleTriad] Fin de partie pour le match ${matchId}`);

        const finalScores = this.calculateScores(match.state.board, match.playerIds);
        const [player1Id, player2Id] = match.playerIds;
        const player1Score = finalScores[player1Id];
        const player2Score = finalScores[player2Id];

        console.log(`[TripleTriad] Scores finaux - ${player1Id}: ${player1Score}, ${player2Id}: ${player2Score}`);

        let winnerId = null;
        let loserId = null;
        let winnerScore = 0;
        let loserScore = 0;

        if (player1Score > player2Score) {
            winnerId = player1Id;
            winnerScore = player1Score;
            loserId = player2Id;
            loserScore = player2Score;
        } else if (player2Score > player1Score) {
            winnerId = player2Id;
            winnerScore = player2Score;
            loserId = player1Id;
            loserScore = player1Score;
        }

        // ✅ ATTRIBUTION DES POINTS POUR LES DEUX JOUEURS
        const pointsDistribution = [];

        try {
            const fetch = require('node-fetch');

            // Attribution des points au gagnant (score * 2)
            if (winnerId) {
                const winnerPoints = winnerScore * 2;
                console.log(`[TripleTriad] Attribution de ${winnerPoints} points au gagnant ${winnerId} (${winnerScore} * 2)`);

                const winnerResponse = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3000'}/api/players/add-points`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        playerId: winnerId,
                        points: winnerPoints,
                        source: 'triple_triad_victory'
                    })
                });

                if (winnerResponse.ok) {
                    const winnerResult = await winnerResponse.json();
                    console.log(`[TripleTriad] Points gagnant attribués: ${winnerResult.newTotalScore} points total`);
                    pointsDistribution.push({
                        playerId: winnerId,
                        status: 'winner',
                        pointsEarned: winnerPoints,
                        newTotalScore: winnerResult.newTotalScore
                    });
                } else {
                    console.error(`[TripleTriad] Erreur lors de l'attribution des points au gagnant: ${winnerResponse.status}`);
                }

                // Attribution des points au perdant (score * 2)
                const loserPoints = loserScore * 2;
                console.log(`[TripleTriad] Attribution de ${loserPoints} points au perdant ${loserId} (${loserScore} * 2)`);

                const loserResponse = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3000'}/api/players/add-points`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        playerId: loserId,
                        points: loserPoints,
                        source: 'triple_triad_participation'
                    })
                });

                if (loserResponse.ok) {
                    const loserResult = await loserResponse.json();
                    console.log(`[TripleTriad] Points perdant attribués: ${loserResult.newTotalScore} points total`);
                    pointsDistribution.push({
                        playerId: loserId,
                        status: 'loser',
                        pointsEarned: loserPoints,
                        newTotalScore: loserResult.newTotalScore
                    });
                } else {
                    console.error(`[TripleTriad] Erreur lors de l'attribution des points au perdant: ${loserResponse.status}`);
                }
            } else {
                // ✅ CAS D'ÉGALITÉ : Les deux joueurs reçoivent leur score * 2
                console.log(`[TripleTriad] Match nul - attribution des points d'égalité`);

                for (const playerId of [player1Id, player2Id]) {
                    const playerScore = finalScores[playerId];
                    const equalityPoints = playerScore * 2;

                    console.log(`[TripleTriad] Attribution de ${equalityPoints} points d'égalité à ${playerId} (${playerScore} * 2)`);

                    const response = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3000'}/api/players/add-points`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            playerId: playerId,
                            points: equalityPoints,
                            source: 'triple_triad_draw'
                        })
                    });

                    if (response.ok) {
                        const result = await response.json();
                        console.log(`[TripleTriad] Points d'égalité attribués à ${playerId}: ${result.newTotalScore} points total`);
                        pointsDistribution.push({
                            playerId: playerId,
                            status: 'draw',
                            pointsEarned: equalityPoints,
                            newTotalScore: result.newTotalScore
                        });
                    } else {
                        console.error(`[TripleTriad] Erreur lors de l'attribution des points d'égalité à ${playerId}: ${response.status}`);
                    }
                }
            }

            // Notifier les joueurs de l'attribution des points
            this.io.to(matchId).emit('tt:pointsAwarded', {
                pointsDistribution
            });

        } catch (error) {
            console.error('[TripleTriad] Erreur lors de l\'attribution des points:', error);
        }

        // Émettre les résultats finaux
        this.io.to(matchId).emit('tt:gameEnd', {
            finalScores,
            winnerId,
            winnerScore,
            loserId,
            loserScore,
            pointsDistribution
        });
    }

    applySpecialRules(match, row, col, card) {
        const appliedRules = [];
        let specialFlips = [];

        if (match.rules.same) {
            const sameFlips = this.ruleSame(match.state.board, row, col, card);
            if (sameFlips.length > 0) {
                specialFlips.push(...sameFlips);
                appliedRules.push("Identique");
            }
        }

        if (match.rules.plus) {
            const plusFlips = this.rulePlus(match.state.board, row, col, card);
            if (plusFlips.length > 0) {
                specialFlips.push(...plusFlips);
                appliedRules.push("Plus");
            }
        }

        if (match.rules.murale) {
            const wallFlips = this.ruleMurale(match.state.board, row, col, card);
            if (wallFlips.length > 0) {
                specialFlips.push(...wallFlips);
                appliedRules.push("Murale");
            }
        }

        for (const flip of specialFlips) {
            const neighbor = match.state.board[flip.row][flip.col];
            if (neighbor && neighbor.owner !== card.owner) {
                const previousOwner = neighbor.owner;
                neighbor.owner = card.owner;
                match.state.scores[card.owner]++;
                match.state.scores[previousOwner]--;

                this.applyCombo(match.state.board, flip.row, flip.col, card.owner, match.state.scores);
            }
        }

        for (const { dr, dc, self, opp } of this.dirs) {
            const nr = row + dr, nc = col + dc;
            if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
                const neighbor = match.state.board[nr][nc];
                if (neighbor && neighbor.owner !== card.owner) {
                    if (parseInt(card[self]) > parseInt(neighbor[opp])) {
                        const previousOwner = neighbor.owner;
                        neighbor.owner = card.owner;
                        match.state.scores[card.owner]++;
                        match.state.scores[previousOwner]--;
                    }
                }
            }
        }

        return appliedRules;
    }

    ruleSame(board, row, col, card) {
        console.log(`[TripleTriad] Règle Same - Test carte:`, card);
        const matches = [];

        for (const { dr, dc, self, opp } of this.dirs) {
            const nr = row + dr, nc = col + dc;
            if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
                const neighbor = board[nr][nc];
                if (neighbor && neighbor.owner !== card.owner) {
                    const cardValue = parseInt(card[self]);
                    const neighborValue = parseInt(neighbor[opp]);
                    console.log(`[TripleTriad] Same - Compare ${self}=${cardValue} vs ${opp}=${neighborValue}`);

                    if (cardValue === neighborValue) {
                        matches.push({ row: nr, col: nc });
                        console.log(`[TripleTriad] Same - Match trouvé à [${nr},${nc}]`);
                    }
                }
            }
        }

        console.log(`[TripleTriad] Same - Total matches: ${matches.length}`);
        if (matches.length >= 2) {
            console.log(`[TripleTriad] Règle Same activée: ${matches.length} matches`);
            return matches;
        }
        return [];
    }

    rulePlus(board, row, col, card) {
        console.log(`[TripleTriad] Règle Plus - Test carte:`, card);
        let sums = [];

        for (const { dr, dc, self, opp } of this.dirs) {
            const nr = row + dr, nc = col + dc;
            if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
                const neighbor = board[nr][nc];
                if (neighbor && neighbor.owner !== card.owner) {
                    const cardValue = parseInt(card[self]);
                    const neighborValue = parseInt(neighbor[opp]);
                    const sum = cardValue + neighborValue;
                    sums.push({ sum, row: nr, col: nc });
                    console.log(`[TripleTriad] Plus - ${self}=${cardValue} + ${opp}=${neighborValue} = ${sum} à [${nr},${nc}]`);
                }
            }
        }

        console.log(`[TripleTriad] Plus - Sommes calculées:`, sums);

        const flips = [];
        for (let i = 0; i < sums.length; i++) {
            for (let j = i + 1; j < sums.length; j++) {
                if (sums[i].sum === sums[j].sum) {
                    flips.push({ row: sums[i].row, col: sums[i].col });
                    flips.push({ row: sums[j].row, col: sums[j].col });
                    console.log(`[TripleTriad] Plus - Sommes égales: ${sums[i].sum} trouvées`);
                }
            }
        }

        const uniqueFlips = flips.filter((v, i, a) =>
            a.findIndex(t => t.row === v.row && t.col === v.col) === i
        );

        console.log(`[TripleTriad] Plus - Retournements finaux:`, uniqueFlips);

        if (uniqueFlips.length > 0) {
            console.log(`[TripleTriad] Règle Plus activée: ${uniqueFlips.length} flips`);
        }

        return uniqueFlips;
    }

    ruleMurale(board, row, col, card) {
        const matches = [];
        let hasWall = false;

        for (const { dr, dc, self } of this.dirs) {
            const nr = row + dr, nc = col + dc;

            if (nr < 0 || nr > 2 || nc < 0 || nc > 2) {
                if (parseInt(card[self]) === 10) {
                    hasWall = true;
                    matches.push({ row: nr, col: nc, wall: true });
                }
            } else {
                const neighbor = board[nr][nc];
                if (neighbor && neighbor.owner !== card.owner) {
                    if (parseInt(card[self]) === parseInt(neighbor[self === "powerUp" ? "powerDown" :
                        self === "powerDown" ? "powerUp" :
                            self === "powerLeft" ? "powerRight" : "powerLeft"])) {
                        matches.push({ row: nr, col: nc });
                    }
                }
            }
        }

        const cardFlips = matches.filter(m => !m.wall);
        if (hasWall && matches.length >= 2 && cardFlips.length > 0) {
            console.log(`[TripleTriad] Règle Murale activée: ${cardFlips.length} flips`);
            return cardFlips;
        }

        return [];
    }

    applyCombo(board, row, col, owner, scores) {
        for (const { dr, dc, self, opp } of this.dirs) {
            const nr = row + dr, nc = col + dc;
            if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
                const neighbor = board[nr][nc];
                if (neighbor && neighbor.owner !== owner) {
                    if (parseInt(board[row][col][self]) > parseInt(neighbor[opp])) {
                        const previousOwner = neighbor.owner;
                        neighbor.owner = owner;
                        scores[owner]++;
                        scores[previousOwner]--;
                        this.applyCombo(board, nr, nc, owner, scores);
                    }
                }
            }
        }
    }

    calculateScores(board, playerIds) {
        const scores = {};
        playerIds.forEach(pid => scores[pid] = 0);

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const card = board[row][col];
                if (card && card.owner) {
                    scores[card.owner]++;
                }
            }
        }

        return scores;
    }

    handleLeaveMatch(socket, { matchId }) {
        socket.leave(matchId);
        if (this.matches[matchId]) {
            const idx = this.matches[matchId].players.indexOf(socket.id);
            if (idx !== -1) {
                this.matches[matchId].players.splice(idx, 1);
                this.matches[matchId].playerIds.splice(idx, 1);
            }
            if (this.matches[matchId].players.length === 0) {
                delete this.matches[matchId];
            }
        }
    }

    handleChallengeSend(socket, { challengerId, challengedId, challengerPlayerId, challengedPlayerId, matchId, rules }) {
        console.log(`[TripleTriad] Challenge envoyé: ${challengerId} -> ${challengedId}`);
        console.log(`[TripleTriad] Règles incluses:`, rules);

        this.challenges[challengedId] = { challengerId, matchId, rules };
        this.io.to(challengedId).emit('challenge:received', {
            challengerId,
            challengerPlayerId,
            matchId,
            rules
        });
    }

    handleChallengeAccept(socket, { challengerId, challengedId, challengerPlayerId, challengedPlayerId, matchId }) {
        this.io.to(challengerId).emit('challenge:accepted', {
            opponentId: challengedId,
            opponentPlayerId: challengedPlayerId,
            matchId
        });
        this.io.to(challengedId).emit('challenge:accepted', {
            opponentId: challengerId,
            opponentPlayerId: challengerPlayerId,
            matchId
        });
        delete this.challenges[challengedId];
    }

    handleChallengeCancel(socket, { challengerId, challengedId }) {
        this.io.to(challengerId).emit('challenge:cancelled', { challengedId });
        this.io.to(challengedId).emit('challenge:cancelled', { challengerId });
        delete this.challenges[challengedId];
    }

    handleDisconnect(socket) {
        for (const matchId in this.matches) {
            const match = this.matches[matchId];
            const idx = match.players.indexOf(socket.id);
            if (idx !== -1) {
                match.players.splice(idx, 1);
                match.playerIds.splice(idx, 1);
                if (match.players.length === 0) {
                    delete this.matches[matchId];
                }
            }
        }
        delete this.players[socket.id];
    }
}

module.exports = TripleTriadManager;