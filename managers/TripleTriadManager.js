class TripleTriadManager {
    constructor(io) {
        this.io = io;
        this.matches = {};
        this.challenges = {};
        this.tripleTriadRules = this.initializeRules();
        this.dirs = [
            { dr: -1, dc: 0, self: "powerUp", opp: "powerDown" },
            { dr: 1, dc: 0, self: "powerDown", opp: "powerUp" },
            { dr: 0, dc: -1, self: "powerLeft", opp: "powerRight" },
            { dr: 0, dc: 1, self: "powerRight", opp: "powerLeft" }
        ];
    }

    initializeRules() {
        return {
            identique: (board, row, col, card, playerId) => {
                let matches = [];
                for (const { dr, dc, self, opp } of this.dirs) {
                    const nr = row + dr, nc = col + dc;
                    if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
                        const neighbor = board[nr][nc];
                        if (neighbor && neighbor.owner !== playerId) {
                            if (parseInt(card[self]) === parseInt(neighbor[opp])) {
                                matches.push({ row: nr, col: nc });
                            }
                        }
                    }
                }
                if (matches.length >= 2) {
                    return matches;
                }
                return [];
            },
            plus: (board, row, col, card, playerId) => {
                let sums = [];
                for (const { dr, dc, self, opp } of this.dirs) {
                    const nr = row + dr, nc = col + dc;
                    if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
                        const neighbor = board[nr][nc];
                        if (neighbor && neighbor.owner !== playerId) {
                            const sum = parseInt(card[self]) + parseInt(neighbor[opp]);
                            sums.push({ sum, nr, nc, neighbor });
                        }
                    }
                }
                let flips = [];
                for (let i = 0; i < sums.length; i++) {
                    for (let j = i + 1; j < sums.length; j++) {
                        if (sums[i].sum === sums[j].sum) {
                            flips.push({ row: sums[i].nr, col: sums[i].nc });
                            flips.push({ row: sums[j].nr, col: sums[j].nc });
                        }
                    }
                }
                flips = flips.filter((v, i, a) => a.findIndex(t => t.row === v.row && t.col === v.col) === i);
                return flips;
            },
            murale: (board, row, col, card, playerId) => {
                let matches = [];
                let hasWall = false;
                for (const { dr, dc, self, opp } of this.dirs) {
                    const nr = row + dr, nc = col + dc;
                    if (nr < 0 || nr > 2 || nc < 0 || nc > 2) {
                        if (parseInt(card[self]) === 10) {
                            matches.push({ row: nr, col: nc, wall: true });
                            hasWall = true;
                        }
                    } else {
                        const neighbor = board[nr][nc];
                        if (neighbor && neighbor.owner !== playerId) {
                            if (parseInt(card[self]) === parseInt(neighbor[opp])) {
                                matches.push({ row: nr, col: nc });
                            }
                        }
                    }
                }
                const flips = matches.filter(m => !m.wall);
                if (hasWall && matches.length >= 2 && flips.length > 0) {
                    return flips;
                }
                return [];
            },
            mortSubite: (board, row, col, card, playerId) => {
                return [];
            }
        };
    }

    setupEvents(socket) {
        socket.on('tt:startMatch', (data) => this.handleStartMatch(socket, data));
        socket.on('tt:playCard', (data) => this.handlePlayCard(socket, data));
        socket.on('tt:leaveMatch', (data) => this.handleLeaveMatch(socket, data));
        socket.on('challenge:send', (data) => this.handleChallengeSend(socket, data));
        socket.on('challenge:accept', (data) => this.handleChallengeAccept(socket, data));
        socket.on('challenge:cancel', (data) => this.handleChallengeCancel(socket, data));
    }

    handleStartMatch(socket, { matchId, playerId, opponentId, playerCards }) {
        console.log(`[tt:startMatch] matchId=${matchId}, playerId=${playerId}, socket.id=${socket.id}`);

        if (!this.matches[matchId]) {
            this.matches[matchId] = {
                createdAt: Date.now(),
                players: [socket.id],
                playerIds: [playerId],
                cards: { [playerId]: playerCards },
                state: {
                    board: Array.from({ length: 3 }, () => Array(3).fill(null)),
                    turn: playerId,
                    moves: [],
                },
                rules: { identique: true, plus: false, murale: false }
            };
        } else {
            if (!this.matches[matchId].playerIds.includes(playerId)) {
                this.matches[matchId].players.push(socket.id);
                this.matches[matchId].playerIds.push(playerId);
                this.matches[matchId].cards[playerId] = playerCards;
            }
            if (this.matches[matchId].players.length === 2) {
                const firstIdx = Math.floor(Math.random() * 2);
                const firstPlayerId = this.matches[matchId].playerIds[firstIdx];
                this.matches[matchId].state.turn = firstPlayerId;
                this.matches[matchId].players.forEach((sid, idx) => {
                    this.io.to(sid).emit('tt:matchReady', {
                        matchId,
                        playerId: this.matches[matchId].playerIds[idx],
                        opponentId: this.matches[matchId].playerIds[1-idx],
                        playerCards: this.matches[matchId].cards[this.matches[matchId].playerIds[idx]],
                        opponentCards: this.matches[matchId].cards[this.matches[matchId].playerIds[1-idx]],
                        state: this.matches[matchId].state
                    });
                });
            }
        }
        console.log(`[tt:startMatch] Etat du match après ajout:`, JSON.stringify(this.matches[matchId], null, 2));

        socket.join(matchId);
    }

    handlePlayCard(socket, { matchId, playerId, cardIdx, row, col }) {
        const match = this.matches[matchId];
        if (!match) return;
        if (match.state.turn !== playerId) return;
        if (match.state.board[row][col]) return;

        const card = { ...match.cards[playerId][cardIdx], owner: playerId };
        match.cards[playerId][cardIdx].played = true;
        match.state.board[row][col] = card;
        match.state.moves.push({ playerId, cardIdx, row, col });
        
        let appliedRules = []; 
        let flips = [];
        for (const ruleName in match.rules) {
            if (match.rules[ruleName] && this.tripleTriadRules[ruleName]) {
                const ruleFlips = this.tripleTriadRules[ruleName](match.state.board, row, col, card, playerId);
                if (ruleFlips && ruleFlips.length) {
                    appliedRules.push(ruleName);
                    flips.push(...ruleFlips);
                }
            }
        }
        
        for (const flip of flips) {
            const neighbor = match.state.board[flip.row][flip.col];
            if (neighbor && neighbor.owner !== playerId) {
                neighbor.owner = playerId;
                this.applyCombo(match.state.board, flip.row, flip.col, playerId);
            }
        }
        
        for (const { dr, dc, self, opp } of this.dirs) {
            const nr = row + dr, nc = col + dc;
            if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
                const neighbor = match.state.board[nr][nc];
                if (neighbor && neighbor.owner !== playerId) {
                    if (parseInt(card[self]) > parseInt(neighbor[opp])) {
                        neighbor.owner = playerId;
                    }
                }
            }
        }
        
        const score = { [match.playerIds[0]]: 0, [match.playerIds[1]]: 0 };

        for (const pid of match.playerIds) {
            const hand = match.cards[pid];
            if (hand) {
                score[pid] += hand.filter(card => !card.played).length;
            }
        }

        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                const cell = match.state.board[r][c];
                if (cell && cell.owner && score[cell.owner] !== undefined) {
                    score[cell.owner]++;
                }
            }
        }
        match.state.scores = score;

        match.state.turn = match.playerIds.find(id => id !== playerId);

        const isFull = match.state.board.flat().every(cell => cell);
        if (isFull) {
            const score = { [match.playerIds[0]]: 0, [match.playerIds[1]]: 0 };

            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    const cell = match.state.board[r][c];
                    if (cell && cell.owner && score[cell.owner] !== undefined) {
                        score[cell.owner]++;
                    }
                }
            }
            for (const pid of match.playerIds) {
                const hand = match.cards[pid];
                if (hand) {
                    score[pid] += hand.filter(card => !card.played).length;
                }
            }

            match.state.scores = score;
            match.state.gameEnded = true;
            if (match.rules.mortSubite && score[match.playerIds[0]] === score[match.playerIds[1]]) {
                const cardsOnBoard = [];
                for (let r = 0; r < 3; r++) {
                    for (let c = 0; c < 3; c++) {
                        const cell = match.state.board[r][c];
                        if (cell && cell.owner) {
                            cardsOnBoard.push({ ...cell });
                        }
                    }
                }
                match.state.board = Array.from({ length: 3 }, () => Array(3).fill(null));
                for (const pid of match.playerIds) {
                    match.cards[pid] = cardsOnBoard.filter(card => card.owner === pid).map(card => {
                        const { owner, ...rest } = card;
                        return { ...rest, played: false };
                    });
                }
                match.state.moves = [];
                match.state.round = (match.state.round || 1) + 1;
                match.state.gameEnded = false;
                this.io.to(matchId).emit('tt:suddenDeath', { message: "Mort subite ! Nouvelle manche." });
            }
        }

        this.io.to(matchId).emit('tt:update', { state: match.state, appliedRules });
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

    handleChallengeSend(socket, { challengerId, challengedId, challengerPlayerId, challengedPlayerId, matchId }) {
        this.challenges[challengedId] = { challengerId, matchId };
        this.io.to(challengedId).emit('challenge:received', { 
            challengerId, 
            challengerPlayerId,
            matchId
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

    applyCombo(board, row, col, owner) {
        for (const { dr, dc, self, opp } of this.dirs) {
            const nr = row + dr, nc = col + dc;
            if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
                const neighbor = board[nr][nc];
                if (neighbor && neighbor.owner !== owner) {
                    if (parseInt(board[row][col][self]) > parseInt(neighbor[opp])) {
                        neighbor.owner = owner;
                        this.applyCombo(board, nr, nc, owner);
                    }
                }
            }
        }
    }

    handleDisconnect(socket) {
        // Nettoyage des matchs
        for (const matchId in this.matches) {
            const match = this.matches[matchId];
            const idx = match.players.indexOf(socket.id);
            if (idx !== -1) {
                match.players.splice(idx, 1);
                match.playerIds.splice(idx, 1);
            }
            if (match.players.length === 0) {
                delete this.matches[matchId];
            }
        }

        // Nettoyage des challenges
        for (const challengedId in this.challenges) {
            if (challengedId === socket.id || this.challenges[challengedId] === socket.id) {
                delete this.challenges[challengedId];
            }
        }
    }
}

module.exports = TripleTriadManager;