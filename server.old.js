console.log('NODE_ENV:', process.env.NODE_ENV); // Log pour vérifier NODE_ENV
if (process.env.NODE_ENV === 'production') {
    require('dotenv').config({ path: '.env.production' }); // Charger les variables d'environnement de production
} else {
    require('dotenv').config(); // Charger les variables d'environnement par défaut
}

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { MongoClient, ObjectId } = require('mongodb'); // Add ObjectId here
const app = express();
const http = require('http');
const https = require('https');
const bodyParser = require('body-parser');
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://zaldrick:xtHDAM0ZFpq2iL9L@oppede.zfhlzph.mongodb.net/oppede';

const boosterRoutes = require('./routes/booster');
const multer = require('multer');
const PORT = process.env.BACKEND_PORT || 3000; // Default port for backend
const isProduction = process.env.NODE_ENV === 'production';
let challenges = {}; // { challengedSocketId: challengerSocketId }
let photosCollection;
let matches = {}; // { matchId: { players: [socketId, socketId], state: {...} } }
let playerIdToSocketId = {}; // { playerId: socket.id }

let quizGames = {}; // Stockage des parties de quiz
let quizInvites = {}; // Invitations en attente
// Configure CORS options dynamically
const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = [
            process.env.FRONTEND_URL, // e.g., https://warband.fr
            "https://warband.fr",
            "https://www.warband.fr", // Allow both with and without www
        ];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true); // Allow the request
        } else {
            callback(new Error("Not allowed by CORS")); // Reject the request
        }
    },
    methods: ["GET", "POST", "DELETE"], // <-- AJOUTE "DELETE" ICI
    credentials: true, // Allow cookies if needed
};
const dirs = [
    { dr: -1, dc: 0, self: "powerUp", opp: "powerDown" },
    { dr: 1, dc: 0, self: "powerDown", opp: "powerUp" },
    { dr: 0, dc: -1, self: "powerLeft", opp: "powerRight" },
    { dr: 0, dc: 1, self: "powerRight", opp: "powerLeft" }
];
const tripleTriadRules = {
    identique: function (board, row, col, card, playerId) {
        // Règle "Identique"
        let matches = [];
        for (const { dr, dc, self, opp } of dirs) {
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
            // Retourne les positions à retourner
            return matches;
        }
        return [];
    },
    plus: function (board, row, col, card, playerId) {
        let sums = [];
        for (const { dr, dc, self, opp } of dirs) {
            const nr = row + dr, nc = col + dc;
            if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
                const neighbor = board[nr][nc];
                if (neighbor && neighbor.owner !== playerId) {
                    const sum = parseInt(card[self]) + parseInt(neighbor[opp]);
                    sums.push({ sum, nr, nc, neighbor });
                }
            }
        }
        // Cherche toutes les paires de voisins adverses avec la même somme
        let flips = [];
        for (let i = 0; i < sums.length; i++) {
            for (let j = i + 1; j < sums.length; j++) {
                if (sums[i].sum === sums[j].sum) {
                    flips.push({ row: sums[i].nr, col: sums[i].nc });
                    flips.push({ row: sums[j].nr, col: sums[j].nc });
                }
            }
        }
        // Supprime les doublons
        flips = flips.filter((v, i, a) => a.findIndex(t => t.row === v.row && t.col === v.col) === i);
        return flips;
    },
    murale: function (board, row, col, card, playerId) {
        let matches = [];
        let hasWall = false;
        for (const { dr, dc, self, opp } of dirs) {
            const nr = row + dr, nc = col + dc;
            // Si hors plateau, on compare à un "mur" de valeur 10
            if (nr < 0 || nr > 2 || nc < 0 || nc > 2) {
                if (parseInt(card[self]) === 10) {
                    matches.push({ row: nr, col: nc, wall: true });
                    hasWall = true;
                }
            } else {
                const neighbor = board[nr][nc];
                // On ne considère que les cartes adverses
                if (neighbor && neighbor.owner !== playerId) {
                    if (parseInt(card[self]) === parseInt(neighbor[opp])) {
                        matches.push({ row: nr, col: nc });
                    }
                }
            }
        }
        // Il faut au moins 2 matches (mur ou carte adverse) ET au moins un mur impliqué
        const flips = matches.filter(m => !m.wall);
        if (hasWall && matches.length >= 2 && flips.length > 0) {
            return flips;
        }
        return [];
    },
    mortSubite: function (board, row, col, card, playerId) {
        // Cette règle ne retourne rien pendant la partie
        return [];
    }
};

// Fonction applyCombo pour les règles Triple Triad
function applyCombo(board, row, col, owner) {
    for (const { dr, dc, self, opp } of dirs) {
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < 3 && nc >= 0 && nc < 3) {
            const neighbor = board[nr][nc];
            if (neighbor && neighbor.owner !== owner) {
                if (parseInt(board[row][col][self]) > parseInt(neighbor[opp])) {
                    neighbor.owner = owner;
                    // Combo récursif
                    applyCombo(board, nr, nc, owner);
                }
            }
        }
    }
}

// Enable CORS for all routes
app.use(cors(corsOptions));
app.use(bodyParser.json());
// Create HTTP or HTTPS server based on the environment
let server;
if (isProduction) {
    const sslOptions = {
        key: fs.readFileSync('/etc/letsencrypt/live/warband.fr/privkey.pem'),
        cert: fs.readFileSync('/etc/letsencrypt/live/warband.fr/fullchain.pem'),
    };
    server = https.createServer(sslOptions, app);
    console.log('Running in production mode with HTTPS');
} else {
    server = http.createServer(app);
    console.log('Running in development mode with HTTP');
}

// Initialize Socket.IO with dynamic CORS
const io = require('socket.io')(server, {
    cors: {
        origin: (origin, callback) => {
            const allowedOrigins = [
                process.env.FRONTEND_URL, // e.g., https://warband.fr
                "https://warband.fr",
                "https://www.warband.fr", // Allow both with and without www
            ];
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true); // Allow the request
            } else {
                callback(new Error("Not allowed by CORS")); // Reject the request
            }
        },
        methods: ["GET", "POST"],
        credentials: true, // Allow cookies if needed
    },
});


// MongoDB connection function
let mongoClient;
const connectToDatabase = async () => {
    if (!mongoClient) {
        mongoClient = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        await mongoClient.connect();
    }
    return mongoClient.db('oppede');
};

(async () => {
    try {
        const db = await connectToDatabase();
        photosCollection = db.collection('photos');
        console.log("Connecté à la collection 'photos'");
    } catch (err) {
        console.error("Erreur de connexion à la collection 'photos':", err);
    }
})();

app.use('/public/photos', express.static(path.join(__dirname, 'public', 'photos'), {
    setHeaders: (res, path) => {
        res.set('Content-Disposition', 'attachment');
    }
}));

app.use('/public', cors(corsOptions), express.static('public'));
// Route pour récupérer les joueurs disponibles
app.get('/api/players', async (req, res) => {
    const db = await connectToDatabase();
    const players = db.collection('players');


    app.get('/api/players', async (req, res) => {
        try {
            const db = await connectToDatabase();
            if (!db) {
                console.error('Database connection failed');
                return res.status(500).json({ error: 'Database connection failed', players: [] });
            }
            const players = db.collection('players');
            const playerList = await players.find({}, { projection: { pseudo: 1 } }).toArray();

            // Log the pseudo values to the console
            playerList.forEach(player => console.log(`Pseudo: ${player.pseudo}`));

            res.json(playerList);
        } catch (error) {
            console.error('Error fetching players:', error);
            res.status(500).json({ error: 'Failed to fetch players', players: [] });
        }
    });


    // Route for apparences
    app.get('/assets/apparences', (req, res) => {
        const apparencesDir = path.join(__dirname, 'public', 'assets', 'apparences'); // Ensure this path exists
        fs.readdir(apparencesDir, (err, files) => {
            if (err) {
                console.error('Error reading apparences directory:', err);
                return res.status(500).json({ error: 'Failed to load apparences' });
            }
            // Filter to include only image files (e.g., .png, .jpg)
            const imageFiles = files.filter(file => /\.(png|jpg|jpeg|gif)$/i.test(file));
            res.json(imageFiles);
        });
    });

    const playerList = await players.find({}, { projection: { pseudo: 1 } }).toArray();
    res.json(playerList);
});

app.get('/api/players/:pseudo', async (req, res) => {
    try {
        const { pseudo } = req.params; // Extract pseudo from the request parameters
        const db = await connectToDatabase();
        const players = db.collection('players');

        // Find the player document by pseudo
        const player = await players.findOne({ pseudo });

        if (!player) {
            return res.status(404).json({ error: 'Player not found' });
        }

        console.log(`Player data for ${pseudo} fetched from MongoDB:`, player); // Log the fetched data
        res.json(player); // Return all player data
    } catch (error) {
        console.error('Error fetching player data:', error);
        res.status(500).json({ error: 'Failed to fetch player data' });
    }
});

app.use(boosterRoutes);
// Middleware to parse JSON request bodies
app.use(express.json());
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/photos'),
    filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname)
});
const upload = multer({ storage });

// Express route à ajouter dans server.js
app.post('/api/inventory/remove-item', async (req, res) => {
    const { playerId, itemId } = req.body;
    console.log("[remove-item] Appel reçu avec:", { playerId, itemId });

    if (!playerId || !itemId) {
        console.warn("[remove-item] playerId ou itemId manquant !");
        return res.status(400).json({ error: "playerId et itemId requis" });
    }
    try {
        const db = await connectToDatabase();
        const inventory = db.collection('inventory');
        console.log("[remove-item] Connexion BDD OK");

        const item = await inventory.findOne({ player_id: new ObjectId(playerId), item_id: new ObjectId(itemId) });
        console.log("[remove-item] Résultat findOne:", item);

        if (!item) {
            console.warn("[remove-item] Item non trouvé dans l'inventaire !");
            return res.status(404).json({ error: "Item not found" });
        }

        if (item.quantité > 1) {
            const updateRes = await inventory.updateOne(
                { player_id: new ObjectId(playerId), item_id: new ObjectId(itemId) },
                { $inc: { quantité: -1 } }
            );
            console.log(`[remove-item] Décrément quantité, résultat:`, updateRes);
        } else {
            const deleteRes = await inventory.deleteOne({ player_id: new ObjectId(playerId), item_id: new ObjectId(itemId) });
            console.log(`[remove-item] Suppression item, résultat:`, deleteRes);
        }
        res.json({ success: true });
    } catch (err) {
        console.error("[remove-item] Erreur serveur:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/players/update-position', async (req, res) => {
    try {
        const { pseudo, posX, posY, mapId } = req.body;

        // Valider la requête
        if (!pseudo || posX === undefined || posY === undefined || mapId === undefined) {
            console.error("Invalid request body:", req.body);
            return res.status(400).json({ error: 'Invalid request. Missing pseudo, posX, posY, or mapId.' });
        }

        const db = await connectToDatabase();
        const players = db.collection('players');

        // Mettre à jour la position et la carte
        const result = await players.updateOne(
            { pseudo },
            { $set: { posX, posY, mapId, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            console.warn(`Player not found: ${pseudo}`);
            return res.status(404).json({ error: 'Player not found' });
        }
        res.json({ success: true, message: 'Player position updated successfully.' });
    } catch (error) {
        console.error('Error updating player position:', error);
        res.status(500).json({ error: 'Failed to update player position' });
    }
});

let players = {};
let chatMessages = []; // Stocker les messages de chat

io.on('connection', (socket) => {

    socket.on('connect_error', (err) => {
        console.error('Erreur de connexion Socket.IO :', err.message);
    });

    socket.on('newPlayer', async (data) => {
        const { pseudo, mapId = 0 } = data; // Par défaut, map1

        // Vérifier si le pseudo est déjà connecté
        const existingPlayerSocketId = Object.keys(players).find(
            (id) => players[id].pseudo === pseudo
        );

        // Récupérer le playerData depuis MongoDB
        const db = await connectToDatabase();
        const playersCollection = db.collection('players');
        const playerData = await playersCollection.findOne({ pseudo });


        if (existingPlayerSocketId) {
            // Déconnecter l'ancienne connexion
            delete players[existingPlayerSocketId];
            io.to(existingPlayerSocketId).emit('disconnectMessage', {
                message: 'Connexion détectée sur un autre appareil.',
            });
            io.sockets.sockets.get(existingPlayerSocketId)?.disconnect();
        }

        players[socket.id] = {
            x: data.x,
            y: data.y,
            mapId, // Ajout de mapId
            character: data.character || `/assets/apparences/${data.pseudo}.png`,
            pseudo: data.pseudo || "Inconnu",
            playerId: playerData._id
        };
        socket.on('registerPlayer', ({ playerId }) => {
            if (playerId) playerIdToSocketId[playerId] = socket.id;
            socket.playerId = playerId;
        });
    });


    // Mise à jour des mouvements du joueur (limitation de fréquence)
    let lastMoveTime = 0;
    socket.on('playerMove', (data) => {
        if (players[socket.id]) {
            if (data.mapId === undefined) {
                console.warn(`MapId non défini pour le joueur ${socket.id}. Données reçues :`, data);
                return; // Ne pas mettre à jour si mapId est manquant
            }
            const previousMapId = players[socket.id].mapId;
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].mapId = data.mapId; // Ajout de mapId
            players[socket.id].anim = data.anim;

            if (previousMapId !== data.mapId) {
                io.emit('playerLeftMap', { id: socket.id, mapId: previousMapId });
            }
        } else {
            console.warn(`Tentative de mise à jour pour un joueur non enregistré : ${socket.id}`);
        }
    });

    // Gestion des interactions entre joueurs
    socket.on('interaction', (data) => {
        console.log(`Interaction reçue :`, data); // Log pour vérifier les données reçues
        console.log(`Interaction de ${data.from} vers ${data.to} : ${data.action}`);
        // Notify the emitter
        socket.on('interaction', ({ fromPlayerId, toPlayerId, action }) => {
            const toSocketId = playerIdToSocketId[toPlayerId];
            if (toSocketId) {
                io.to(toSocketId).emit('interaction', { fromPlayerId, toPlayerId, action });
            }
        });
        socket.emit('interactionFeedback', {
            from: data.from,
            to: data.to,
            action: data.action,
            type: 'emitter',
        });
        // Notify the receiver
        if (players[data.to]) {
            io.to(data.to).emit('interactionFeedback', {
                from: data.from,
                to: data.to,
                action: data.action,
                type: 'receiver',
            });

            // Handle "faireSigne" action
            if (data.action === "faireSigne") {
                const senderPseudo = players[data.from]?.pseudo || "Inconnu"; // Récupérer le pseudo de l'émetteur
                io.to(data.to).emit('chatMessage', {
                    pseudo: "System",
                    message: `Le joueur ${senderPseudo} vous a fait signe !`
                });
            }
        } else {
            console.warn(`Le joueur cible ${data.to} n'est pas connecté.`);
        }

    });

    // Gestion de l'événement 'chatMessage'
    socket.on('chatMessage', (data, callback) => {
        console.log(`Tentative de réception de 'chatMessage' de ${socket.id}`);

        // Validation des données reçues
        if (!data || !data.message || typeof data.message !== 'string' || !data.pseudo || data.mapId === undefined) {
            console.warn(`Message invalide reçu de ${socket.id}:`, data);
            if (callback) callback({ status: 'error', message: 'Message invalide' });
            return;
        }

        // Inclure le mapId dans le message
        const message = { pseudo: data.pseudo, message: data.message, mapId: data.mapId };
        chatMessages.push(message); // Ajouter le message à l'historique

        // Diffuser le message à tous les clients
        io.emit('chatMessage', message);

        if (callback) {
            callback({ status: 'ok', message: 'Message reçu par le serveur' });
        }
    });

    // Envoyer l'historique des messages au nouveau client
    socket.emit('chatHistory', chatMessages);

    socket.on('updatePseudo', (data) => {
        if (players[data.id]) {
            players[data.id].pseudo = data.pseudo;
            console.log(`Pseudo updated for ${data.id}: ${data.pseudo}`);
        }
    });

    socket.on('updateAppearance', (data) => {
        if (players[data.id]) {
            players[data.id].character = data.character;
            io.emit('appearanceUpdate', { id: data.id, character: data.character });
            console.log(`Appearance updated for ${data.id}: ${data.character}`);
        }
    });

    // Déconnexion
    socket.on('disconnect', () => {
        console.log(`Joueur déconnecté : ${socket.id}`);
        const disconnectedPlayer = players[socket.id];
        if (socket.playerId) delete playerIdToSocketId[socket.playerId];
        delete players[socket.id];

        // Nettoyage des matchs
        for (const matchId in matches) {
            const match = matches[matchId];
            const idx = match.players.indexOf(socket.id);
            if (idx !== -1) {
                match.players.splice(idx, 1);
                match.playerIds.splice(idx, 1);
            }
            // Si plus aucun joueur, supprime le match
            if (match.players.length === 0) {
                delete matches[matchId];
            }
        }

        // Nettoyage des challenges
        for (const challengedId in challenges) {
            if (challengedId === socket.id || challenges[challengedId] === socket.id) {
                delete challenges[challengedId];
            }
        }

        // Nettoyage des quiz lors de la déconnexion
        for (const gameId in quizGames) {
            const game = quizGames[gameId];
            const playerIndex = game.players.findIndex(p => p.socketId === socket.id);
            if (playerIndex !== -1) {
                game.players.splice(playerIndex, 1);
                // Si c'était l'organisateur ou s'il n'y a plus de joueurs
                if (game.hostId === socket.id || game.players.length === 0) {
                    io.to(gameId).emit('quiz:gameCancelled');
                    delete quizGames[gameId];
                } else {
                    // Notifier les autres joueurs
                    io.to(gameId).emit('quiz:gameUpdated', game);
                }
            }
        }

        // Informer les autres joueurs de la déconnexion
        io.emit('playerDisconnected', { id: socket.id, mapId: disconnectedPlayer?.mapId });

        console.log("État actuel des joueurs après déconnexion :", players);
    });

    // === ÉVÉNEMENTS QUIZ SYSTÈME LOBBY ===

    // Demande la liste des quiz disponibles
    socket.on('quiz:requestGamesList', () => {
        const availableGames = Object.values(quizGames).filter(game =>
            game.status === 'waiting' && game.players.length < game.maxPlayers
        );
        socket.emit('quiz:gamesList', availableGames);
    });
    // Créer un nouveau quiz
    socket.on('quiz:createGame', ({ gameId, hostId, hostName, maxPlayers, gameMode, categories, difficulty, totalQuestions }) => {
        console.log(`[Quiz] Création d'un quiz: ${gameId} par ${hostName}`);
        console.log(`[Quiz] Options: Mode=${gameMode}, Catégories=${categories}, Difficulté=${difficulty}`);

        quizGames[gameId] = {
            gameId,
            hostId: socket.id, // ← Forcer l'utilisation de socket.id
            hostName,
            maxPlayers,
            players: [{
                id: hostId, // Garde l'ID MongoDB pour identification
                name: hostName,
                socketId: socket.id, // Ajoute socket.id pour les communications
                score: 0,
                answeredQuestions: []
            }],
            status: 'waiting',
            createdAt: Date.now(),
            questions: [],
            currentQuestion: 0,
            // Nouvelles propriétés
            gameMode: gameMode || 'classic',
            categories: categories || ['Géographie'],
            difficulty: difficulty || 'moyen',
            totalQuestions: totalQuestions || 10,
            playerAnswers: {},
            questionStartTime: null
        };

        socket.join(gameId);
        socket.emit('quiz:gameCreated', quizGames[gameId]);

        // Notifier tous les clients qu'un nouveau quiz est disponible
        io.emit('quiz:gamesList', Object.values(quizGames).filter(game =>
            game.status === 'waiting' && game.players.length < game.maxPlayers
        ));
    });
    // Rejoindre un quiz
    socket.on('quiz:joinGame', ({ gameId, playerId, playerName }) => {
        const game = quizGames[gameId];

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

        // Vérifier si le joueur n'est pas déjà dans le quiz
        if (game.players.find(p => p.id === playerId)) {
            socket.emit('quiz:joinError', { message: 'Vous êtes déjà dans ce quiz' });
            return;
        }

        console.log(`[Quiz] ${playerName} rejoint le quiz ${gameId}`);

        // Ajouter le joueur avec socket.id
        game.players.push({
            id: playerId,
            name: playerName,
            socketId: socket.id, // ← Important : ajouter socket.id
            score: 0
        });

        socket.join(gameId);
        socket.emit('quiz:gameJoined', game);

        // Notifier tous les joueurs du quiz
        io.to(gameId).emit('quiz:gameUpdated', game);

        // Mettre à jour la liste des quiz disponibles
        io.emit('quiz:gamesList', Object.values(quizGames).filter(game =>
            game.status === 'waiting' && game.players.length < game.maxPlayers
        ));
    });

    // Quitter un quiz
    socket.on('quiz:leaveGame', ({ gameId }) => {
        const game = quizGames[gameId];
        if (!game) return;

        const playerIndex = game.players.findIndex(p => p.socketId === socket.id);
        if (playerIndex === -1) return;

        const leavingPlayer = game.players[playerIndex];
        console.log(`[Quiz] ${leavingPlayer.name} quitte le quiz ${gameId}`);

        game.players.splice(playerIndex, 1);
        socket.leave(gameId);

        // Si c'était l'organisateur ou s'il n'y a plus de joueurs
        if (leavingPlayer.id === game.hostId || game.players.length === 0) {
            io.to(gameId).emit('quiz:gameCancelled');
            delete quizGames[gameId];
        } else {
            // Notifier les autres joueurs
            io.to(gameId).emit('quiz:gameUpdated', game);
        }

        // Mettre à jour la liste des quiz disponibles
        io.emit('quiz:gamesList', Object.values(quizGames).filter(game =>
            game.status === 'waiting' && game.players.length < game.maxPlayers
        ));
    });

    // Annuler un quiz (organisateur uniquement)
    socket.on('quiz:cancelGame', ({ gameId }) => {
        const game = quizGames[gameId];
        if (!game || game.hostId !== socket.id) return;

        console.log(`[Quiz] Annulation du quiz ${gameId} par l'organisateur`);

        io.to(gameId).emit('quiz:gameCancelled');
        delete quizGames[gameId];

        // Mettre à jour la liste des quiz disponibles
        io.emit('quiz:gamesList', Object.values(quizGames).filter(game =>
            game.status === 'waiting' && game.players.length < game.maxPlayers
        ));
    });

    // Lancer un quiz (organisateur uniquement)
    socket.on('quiz:startGame', async ({ gameId }) => {
        const game = quizGames[gameId];

        if (!game) {
            console.log(`[Quiz] Erreur: Quiz ${gameId} introuvable`);
            socket.emit('quiz:startError', { message: 'Quiz introuvable' });
            return;
        }

        // Vérifier que c'est bien l'organisateur en utilisant socket.id
        if (game.hostId !== socket.id) {
            console.log(`[Quiz] Erreur: ${socket.id} n'est pas l'organisateur de ${gameId} (organisateur: ${game.hostId})`);
            socket.emit('quiz:startError', { message: 'Vous n\'êtes pas l\'organisateur de ce quiz' });
            return;
        }

        // Vérifier le nombre minimum de joueurs
        if (game.players.length < 2) {
            console.log(`[Quiz] Erreur: Pas assez de joueurs (${game.players.length}/2 minimum)`);
            socket.emit('quiz:startError', { message: 'Il faut au moins 2 joueurs pour commencer' });
            return;
        }

        console.log(`[Quiz] Lancement du quiz ${gameId} avec ${game.players.length} joueurs`);
        console.log(`[Quiz] Catégories: ${game.categories.join(', ')}, Difficulté: ${game.difficulty}`);

        try {
            // Changer le statut
            game.status = 'playing';

            // Récupération des questions depuis MongoDB
            game.questions = await getRandomQuestions(game.categories, game.difficulty, game.totalQuestions);

            if (!game.questions || game.questions.length === 0) {
                console.error(`[Quiz] Aucune question trouvée pour ${gameId}`);
                socket.emit('quiz:startError', { message: 'Aucune question disponible pour ces catégories' });
                return;
            }

            game.currentQuestion = 0;
            game.playerAnswers = {};

            console.log(`[Quiz] ${game.questions.length} questions chargées pour ${gameId}`);

            // Notifier tous les joueurs que le quiz commence
            io.to(gameId).emit('quiz:gameStarted', {
                gameId: game.gameId,
                playerId: game.hostId,
                playerName: game.hostName,
                isHost: true,
                gameInfo: {  // ← Changement ici : passer gameInfo directement au premier niveau
                    categories: game.categories,
                    difficulty: game.difficulty,
                    totalQuestions: game.questions.length
                },
                gameData: game  // ← Garder les données complètes du jeu
            });

            // Retirer de la liste des quiz disponibles
            io.emit('quiz:gamesList', Object.values(quizGames).filter(game =>
                game.status === 'waiting' && game.players.length < game.maxPlayers
            ));

            // Démarrer la première question après un délai
            setTimeout(() => {
                sendNextQuestion(gameId);
            }, 4000);

        } catch (error) {
            console.error(`[Quiz] Erreur lors du lancement du quiz ${gameId}:`, error);
            socket.emit('quiz:startError', { message: 'Erreur lors du lancement du quiz' });
        }
    });
    // Lancer un quiz (organisateur uniquement)
    socket.on('quiz:startGame', async ({ gameId }) => {
        const game = quizGames[gameId];

        if (!game) {
            console.log(`[Quiz] Erreur: Quiz ${gameId} introuvable`);
            return;
        }

        // Vérifier que c'est bien l'organisateur
        if (game.hostId !== socket.id) {
            console.log(`[Quiz] Erreur: ${socket.id} n'est pas l'organisateur de ${gameId}`);
            return;
        }

        // Vérifier le nombre minimum de joueurs
        if (game.players.length < 2) {
            console.log(`[Quiz] Erreur: Pas assez de joueurs (${game.players.length}/2 minimum)`);
            socket.emit('quiz:startError', { message: 'Il faut au moins 2 joueurs pour commencer' });
            return;
        }

        console.log(`[Quiz] Lancement du quiz ${gameId} avec ${game.players.length} joueurs`);
        console.log(`[Quiz] Catégories: ${game.categories.join(', ')}, Difficulté: ${game.difficulty}`);

        try {
            // Changer le statut
            game.status = 'playing';

            // Récupération des questions depuis MongoDB
            game.questions = await getRandomQuestions(game.categories, game.difficulty, game.totalQuestions);

            if (!game.questions || game.questions.length === 0) {
                console.error(`[Quiz] Aucune question trouvée pour ${gameId}`);
                socket.emit('quiz:startError', { message: 'Aucune question disponible pour ces catégories' });
                return;
            }

            game.currentQuestion = 0;

            // Réinitialise les réponses
            game.playerAnswers = {};

            console.log(`[Quiz] ${game.questions.length} questions chargées pour ${gameId}`);

            // Notifier tous les joueurs que le quiz commence
            io.to(gameId).emit('quiz:gameStarted', {
                gameId: game.gameId,
                playerId: game.hostId,
                playerName: game.hostName,
                isHost: true,
                gameData: {
                    ...game,
                    gameInfo: {
                        categories: game.categories,
                        difficulty: game.difficulty,
                        totalQuestions: game.questions.length
                    }
                }
            });

            // Retirer de la liste des quiz disponibles
            io.emit('quiz:gamesList', Object.values(quizGames).filter(game =>
                game.status === 'waiting' && game.players.length < game.maxPlayers
            ));

            // Démarrer la première question après un délai
            setTimeout(() => {
                sendNextQuestion(gameId);
            }, 4000); // 4 secondes de préparation

        } catch (error) {
            console.error(`[Quiz] Erreur lors du lancement du quiz ${gameId}:`, error);
            socket.emit('quiz:startError', { message: 'Erreur lors du lancement du quiz' });
        }
    });

    // === ANCIENS ÉVÉNEMENTS QUIZ (à conserver pour plus tard) ===

    socket.on('quiz:submitAnswer', ({ gameId, playerId, answer, timeRemaining }) => {
        const game = quizGames[gameId];
        if (!game) return;

        console.log(`[Quiz] Réponse reçue de ${playerId}: ${answer} pour ${gameId}`);

        const player = game.players.find(p => p.id === playerId);
        if (!player) return;

        // Vérifier si le joueur a déjà répondu à cette question
        if (game.playerAnswers[playerId]) {
            console.log(`[Quiz] ${playerId} a déjà répondu à cette question`);
            return;
        }

        // Enregistrer la réponse avec timestamp pour l'ordre
        game.playerAnswers[playerId] = {
            answer: answer,
            timeRemaining: timeRemaining,
            timestamp: Date.now()
        };

        // Compter les réponses reçues
        const answersReceived = Object.keys(game.playerAnswers).length;
        const totalPlayers = game.players.length;

        console.log(`[Quiz] ${answersReceived}/${totalPlayers} réponses reçues pour ${gameId}`);

        // Notifier le joueur que sa réponse a été enregistrée
        socket.emit('quiz:answerReceived', {
            answersReceived: answersReceived,
            totalPlayers: totalPlayers
        });

        // Notifier tous les joueurs du nombre de réponses reçues
        io.to(gameId).emit('quiz:waitingForAnswers', {
            answersReceived: answersReceived,
            totalPlayers: totalPlayers
        });

        // Vérifier si tous les joueurs ont répondu
        if (answersReceived >= totalPlayers) {
            console.log(`[Quiz] Toutes les réponses reçues pour ${gameId}, envoi des résultats`);
            // Attendre 1 seconde puis envoyer les résultats
            setTimeout(() => {
                sendRoundResults(gameId);
            }, 1000);
        }
    });

    socket.on('quiz:invite', ({ challengerId, challengedId, challengerPlayerId, challengedPlayerId, gameId }) => {
        quizInvites[challengedId] = { challengerId, gameId };
        io.to(challengedId).emit('quiz:invitation', {
            challengerId,
            challengerPlayerId,
            gameId,
            message: `${players[challengerId]?.pseudo || 'Un joueur'} vous invite à un quiz !`
        });
    });

    socket.on('tt:startMatch', ({ matchId, playerId, opponentId, playerCards }) => {
        console.log(`[tt:startMatch] matchId=${matchId}, playerId=${playerId}, socket.id=${socket.id}`);

        // Crée ou rejoint la partie
        if (!matches[matchId]) {
            matches[matchId] = {
                createdAt: Date.now(), // Ajoute la date de création
                players: [socket.id],
                playerIds: [playerId],
                cards: { [playerId]: playerCards },
                state: {
                    board: Array.from({ length: 3 }, () => Array(3).fill(null)),
                    turn: playerId, // Le joueur qui commence
                    moves: [],
                },
                rules: { identique: true, plus: false, murale: false }
            };
        } else {
            if (!matches[matchId].playerIds.includes(playerId)) {
                matches[matchId].players.push(socket.id);
                matches[matchId].playerIds.push(playerId);
                matches[matchId].cards[playerId] = playerCards;
            }
            // Quand les deux joueurs sont là, envoie l'état initial
            if (matches[matchId].players.length === 2) {
                const firstIdx = Math.floor(Math.random() * 2);
                const firstPlayerId = matches[matchId].playerIds[firstIdx];
                matches[matchId].state.turn = firstPlayerId;
                matches[matchId].players.forEach((sid, idx) => {
                    io.to(sid).emit('tt:matchReady', {
                        matchId,
                        playerId: matches[matchId].playerIds[idx],
                        opponentId: matches[matchId].playerIds[1 - idx],
                        playerCards: matches[matchId].cards[matches[matchId].playerIds[idx]],
                        opponentCards: matches[matchId].cards[matches[matchId].playerIds[1 - idx]],
                        state: matches[matchId].state
                    });
                });
            }
        }
        console.log(`[tt:startMatch] Etat du match après ajout:`, JSON.stringify(matches[matchId], null, 2));

        socket.join(matchId);
    });

    socket.on('tt:playCard', ({ matchId, playerId, cardIdx, row, col }) => {
        const match = matches[matchId];
        if (!match) return;
        // Vérifie le tour
        if (match.state.turn !== playerId) return;
        // Vérifie que la case est vide
        if (match.state.board[row][col]) return;

        // Place la carte
        const card = { ...match.cards[playerId][cardIdx], owner: playerId };
        match.cards[playerId][cardIdx].played = true;
        match.state.board[row][col] = card;
        match.state.moves.push({ playerId, cardIdx, row, col });
        let appliedRules = [];
        let flips = [];
        for (const ruleName in match.rules) {
            if (match.rules[ruleName] && tripleTriadRules[ruleName]) {
                const ruleFlips = tripleTriadRules[ruleName](match.state.board, row, col, card, playerId);
                if (ruleFlips && ruleFlips.length) {
                    appliedRules.push(ruleName); // Ajoute le nom de la règle appliquée
                    flips.push(...ruleFlips);
                }
            }
        }
        // Applique les flips spéciaux
        for (const flip of flips) {
            const neighbor = match.state.board[flip.row][flip.col];
            if (neighbor && neighbor.owner !== playerId) {
                neighbor.owner = playerId;
                applyCombo(match.state.board, flip.row, flip.col, playerId);
            }
        }
        // Logique de capture Triple Triad
        const dirs = [
            { dr: -1, dc: 0, self: "powerUp", opp: "powerDown" },
            { dr: 1, dc: 0, self: "powerDown", opp: "powerUp" },
            { dr: 0, dc: -1, self: "powerLeft", opp: "powerRight" },
            { dr: 0, dc: 1, self: "powerRight", opp: "powerLeft" }
        ];
        for (const { dr, dc, self, opp } of dirs) {
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

        // Calcul du score : cartes restantes en main + cartes sur le plateau
        const score = { [match.playerIds[0]]: 0, [match.playerIds[1]]: 0 };

        // Comptage des cartes restantes en main
        for (const pid of match.playerIds) {
            const hand = match.cards[pid];
            if (hand) {
                score[pid] += hand.filter(card => !card.played).length;
            }
        }

        // Comptage des cartes sur le plateau
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                const cell = match.state.board[r][c];
                if (cell && cell.owner && score[cell.owner] !== undefined) {
                    score[cell.owner]++;
                }
            }
        }
        match.state.scores = score;

        // Change de tour
        match.state.turn = match.playerIds.find(id => id !== playerId);

        // Vérifie fin de partie
        const isFull = match.state.board.flat().every(cell => cell);
        if (isFull) {
            // Calcul du score final : cartes sur le plateau + cartes restantes en main
            const score = { [match.playerIds[0]]: 0, [match.playerIds[1]]: 0 };

            // Cartes sur le plateau
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    const cell = match.state.board[r][c];
                    if (cell && cell.owner && score[cell.owner] !== undefined) {
                        score[cell.owner]++;
                    }
                }
            }
            // Cartes restantes en main
            for (const pid of match.playerIds) {
                const hand = match.cards[pid];
                if (hand) {
                    score[pid] += hand.filter(card => !card.played).length;
                }
            }

            match.state.scores = score;
            match.state.gameEnded = true;
            if (match.rules.mortSubite && score[match.playerIds[0]] === score[match.playerIds[1]]) {
                // Récupère toutes les cartes du plateau
                const cardsOnBoard = [];
                for (let r = 0; r < 3; r++) {
                    for (let c = 0; c < 3; c++) {
                        const cell = match.state.board[r][c];
                        if (cell && cell.owner) {
                            cardsOnBoard.push({ ...cell });
                        }
                    }
                }
                // Réinitialise le plateau
                match.state.board = Array.from({ length: 3 }, () => Array(3).fill(null));
                // Remet les cartes dans la main de chaque joueur
                for (const pid of match.playerIds) {
                    match.cards[pid] = cardsOnBoard.filter(card => card.owner === pid).map(card => {
                        const { owner, ...rest } = card;
                        return { ...rest, played: false };
                    });
                }
                // Vide les moves
                match.state.moves = [];
                // Incrémente un compteur de manche si tu veux (optionnel)
                match.state.round = (match.state.round || 1) + 1;
                match.state.gameEnded = false; // La partie continue
                // Optionnel : notifie le front
                io.to(matchId).emit('tt:suddenDeath', { message: "Mort subite ! Nouvelle manche." });
            }
        }

        // Diffuse le nouvel état
        io.to(matchId).emit('tt:update', { state: match.state, appliedRules });
    });

    socket.on('tt:leaveMatch', ({ matchId }) => {
        socket.leave(matchId);
        if (matches[matchId]) {
            const idx = matches[matchId].players.indexOf(socket.id);
            if (idx !== -1) {
                matches[matchId].players.splice(idx, 1);
                matches[matchId].playerIds.splice(idx, 1);
            }
            if (matches[matchId].players.length === 0) {
                delete matches[matchId];
            }
        }
    });

    socket.on('challenge:send', ({ challengerId, challengedId, challengerPlayerId, challengedPlayerId, matchId }) => {
        challenges[challengedId] = { challengerId, matchId };
        io.to(challengedId).emit('challenge:received', {
            challengerId,
            challengerPlayerId, // Ajoute le vrai playerId du challenger
            matchId // Passe le matchId au défié
        });
    });

    socket.on('challenge:accept', ({ challengerId, challengedId, challengerPlayerId, challengedPlayerId, matchId }) => {
        io.to(challengerId).emit('challenge:accepted', {
            opponentId: challengedId,
            opponentPlayerId: challengedPlayerId, // Ajoute le vrai playerId de l'adversaire
            matchId // Passe le matchId au challenger
        });
        io.to(challengedId).emit('challenge:accepted', {
            opponentId: challengerId,
            opponentPlayerId: challengerPlayerId, // Ajoute le vrai playerId de l'adversaire
            matchId // Passe le matchId au challenger
        });
        delete challenges[challengedId];
    });

    socket.on('challenge:cancel', ({ challengerId, challengedId }) => {
        io.to(challengerId).emit('challenge:cancelled', { challengedId });
        io.to(challengedId).emit('challenge:cancelled', { challengerId });
        delete challenges[challengedId];
    });

});

// Fonction sendNextQuestion - déjà existante, mais on l'améliore
function sendNextQuestion(gameId) {
    const game = quizGames[gameId];
    if (!game || game.currentQuestion >= game.questions.length) {
        endQuizGame(gameId);
        return;
    }

    const question = game.questions[game.currentQuestion];
    game.playerAnswers = {}; // Reset des réponses pour cette question

    console.log(`[Quiz] Envoi question ${game.currentQuestion + 1}/${game.questions.length} pour ${gameId}`);
    console.log(`[Quiz] Question: ${question.question}`);

    io.to(gameId).emit('quiz:questionStart', {
        question: {
            question: question.question,
            answers: question.answers,
            category: question.category
        },
        questionNumber: game.currentQuestion + 1,
        totalQuestions: game.questions.length,
        timeLimit: 30
    });

    // Auto-passer à la question suivante après 35 secondes si pas toutes les réponses
    setTimeout(() => {
        if (game && Object.keys(game.playerAnswers).length < game.players.length) {
            console.log(`[Quiz] Timeout atteint pour ${gameId}, passage aux résultats`);
            sendRoundResults(gameId);
        }
    }, 35000);
}
function sendRoundResults(gameId) {
    const game = quizGames[gameId];
    if (!game) return;

    const currentQ = game.questions[game.currentQuestion];
    console.log(`[Quiz] Envoi résultats question ${game.currentQuestion + 1} pour ${gameId}`);

    // Nouveau système de points basé sur l'ordre des réponses correctes
    const totalPlayers = game.players.length;
    const correctAnswers = [];

    // Identifier toutes les réponses correctes avec leur timestamp
    Object.entries(game.playerAnswers).forEach(([playerId, answerData]) => {
        if (answerData.answer === currentQ.correct && answerData.answer >= 0) {
            correctAnswers.push({
                playerId,
                timestamp: answerData.timestamp
            });
        }
    });

    // Trier par timestamp (plus tôt = plus de points)
    correctAnswers.sort((a, b) => a.timestamp - b.timestamp);

    // Attribuer les points selon l'ordre
    correctAnswers.forEach((answer, index) => {
        const player = game.players.find(p => p.id === answer.playerId);
        if (player) {
            const points = totalPlayers - index; // Premier = totalPlayers points, deuxième = totalPlayers-1, etc.
            player.score += points;
            console.log(`[Quiz] ${player.name} a gagné ${points} points (position ${index + 1})`);
        }
    });

    // Créer le classement actuel
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

    io.to(gameId).emit('quiz:roundResults', resultsData);

    // Passer à la question suivante après 5 secondes
    setTimeout(() => {
        game.currentQuestion++;
        if (game.currentQuestion >= game.questions.length) {
            endQuizGame(gameId);
        } else {
            sendNextQuestion(gameId);
        }
    }, 5000);
}

// Fonction pour terminer le quiz
function endQuizGame(gameId) {
    const game = quizGames[gameId];
    if (!game) return;

    console.log(`[Quiz] Fin du quiz ${gameId}`);

    // Créer le classement final
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

    io.to(gameId).emit('quiz:gameEnd', endData);

    // Nettoyer le quiz après 30 secondes
    setTimeout(() => {
        delete quizGames[gameId];
        console.log(`[Quiz] Quiz ${gameId} supprimé de la mémoire`);
    }, 30000);
}

// Diffuser l'état complet des joueurs 20 fois par seconde (toutes les 50ms)
setInterval(() => {
    const playersWithMapId = Object.keys(players).reduce((result, id) => {
        result[id] = {
            ...players[id],
            mapId: players[id].mapId || 0, // Ajout de mapId avec une valeur par défaut si manquant
        };
        return result;
    }, {});

    io.emit('playersUpdate', playersWithMapId); // Inclure mapId dans les mises à jour
}, 50);




// Ajout d'une photo
app.post('/api/photos/upload', upload.single('photo'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const db = await connectToDatabase();
    const photosCollection = db.collection('photos');

    const { description, taggedPlayers, uploader, dateTaken } = req.body;
    const photoDoc = {
        filename: req.file.filename,
        url: `/public/photos/${req.file.filename}`,
        dateTaken: dateTaken || new Date().toISOString().slice(0, 10),
        description: description || "",
        taggedPlayers: taggedPlayers ? JSON.parse(taggedPlayers) : [],
        uploader: uploader || "Inconnu",
        votes: 0
    };
    await photosCollection.insertOne(photoDoc);

    res.json({ url: photoDoc.url });
});

// Vote sur une photo
app.post('/api/photos/:id/vote', async (req, res) => {
    const { id } = req.params;
    const db = await connectToDatabase();
    const photosCollection = db.collection('photos');

    const updateResult = await photosCollection.updateOne(
        { _id: new ObjectId(id) },
        { $inc: { votes: 1 } }
    );
    if (updateResult.matchedCount === 0) {
        return res.status(404).json({ error: "Photo not found" });
    }
    // Répond juste 200 OK, sans body
    res.sendStatus(200);
});

// Récupérer les photos
app.get('/api/photos', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const photosCollection = db.collection('photos');
        const date = req.query.date; // ex: "2025-06-04"
        let filter = {};
        if (date) filter.dateTaken = date;
        const photos = await photosCollection.find(filter).toArray();
        res.json({ photos });
    } catch (err) {
        console.error("Erreur lors de la récupération des photos:", err);
        res.status(500).json({ photos: [] });
    }
});

// Suppression d'une photo
app.delete('/api/photos/:id', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const photosCollection = db.collection('photos');
        const { id } = req.params;
        const photo = await photosCollection.findOne({ _id: new ObjectId(id) });
        if (!photo) return res.status(404).json({ error: "Photo introuvable" });

        // Supprimer le fichier physique si besoin
        const fs = require("fs");
        const path = require("path");
        const filePath = path.join(__dirname, "public", "photos", photo.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        await photosCollection.deleteOne({ _id: new ObjectId(id) });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Erreur lors de la suppression" });
    }
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

app.get('/api/players/position/:pseudo', async (req, res) => {
    try {
        const { pseudo } = req.params; // Extract pseudo from the request parameters
        const db = await connectToDatabase();
        const players = db.collection('players');

        // Find the player document by pseudo
        const player = await players.findOne({ pseudo }, { projection: { posX: 1, posY: 1 } });

        if (!player) {
            return res.status(404).json({ error: 'Player not found' });
        }

        res.json({ x: player.posX, y: player.posY }); // Return the position
    } catch (error) {
        console.error('Error fetching player position:', error);
        res.status(500).json({ error: 'Failed to fetch player position' });
    }
});

app.get('/api/inventory/:playerId', async (req, res) => {
    try {
        const { playerId } = req.params;
        const db = await connectToDatabase();
        const inventoryCollection = db.collection('inventory');

        // Use aggregation to join inventory with items
        const inventory = await inventoryCollection.aggregate([
            {
                $match: { player_id: new ObjectId(playerId) },
            },
            {
                $lookup: {
                    from: 'items',
                    localField: 'item_id',
                    foreignField: '_id',
                    as: 'itemDetails',
                },
            },
            {
                $unwind: '$itemDetails',
            },
            {
                $lookup: {
                    from: 'itemActions',
                    localField: 'item_id',
                    foreignField: 'item_id',
                    as: 'actions',
                },
            },
            {
                $project: {
                    _id: 1,
                    player_id: 1,
                    item_id: 1,
                    quantité: 1,
                    nom: '$itemDetails.nom',
                    image: '$itemDetails.image',
                    is_echangeable: '$itemDetails.is_echangeable',
                    prix: '$itemDetails.prix',
                    actions: 1,
                    type: '$itemDetails.type',
                    // Ajoute les propriétés spécifiques aux boosters :
                    possibleCards: '$itemDetails.possibleCards',
                    cardCount: '$itemDetails.cardCount',
                    rarityChances: '$itemDetails.rarityChances',
                    description: '$itemDetails.description',
                },
            },
        ]).toArray();

        if (!inventory || inventory.length === 0) {
            return res.status(404).json({ error: 'Inventory not found' });
        }

        // DEBUG : log un booster si présent
        const booster = inventory.find(i => i.type === "booster" || i.nom?.toLowerCase().includes("booster"));
        if (booster) {
            console.log("Booster dans l'inventaire envoyé au front:", booster);
        }

        res.json(inventory);
    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).json({ error: 'Failed to fetch inventory' });
    }
});

app.get('/api/world-events', async (req, res) => {
    const mapKey = req.query.mapKey;
    if (!mapKey) return res.status(400).json({ error: "mapKey is required" });

    try {
        const db = await connectToDatabase();
        const events = await db.collection("worldEvents").find({ mapKey }).toArray();
        res.json(events);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

app.post('/api/world-events/:id/state', async (req, res) => {
    const eventId = req.params.id;
    const newState = req.body; // Par exemple { opened: true }

    if (!eventId) return res.status(400).json({ error: "eventId is required" });

    try {
        const db = await connectToDatabase();
        const result = await db.collection("worldEvents").updateOne(
            { _id: new ObjectId(eventId) },
            { $set: { state: newState } }
        );
        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: "Event not found or not updated" });
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

app.get('/api/cards', async (req, res) => {
    try {
        const db = await connectToDatabase();
        // Récupère toutes les cartes (type: "card") depuis la collection items
        const cards = await db.collection('items').find({ type: "card" }).project({
            _id: 1,
            nom: 1,
            image: 1,
            rarity: 1,
            powerUp: 1,
            powerLeft: 1,
            powerRight: 1,
            powerDown: 1,
            description: 1
        }).toArray();

        if (!cards || cards.length === 0) {
            return res.status(404).json({ error: 'No cards found.' });
        }

        res.json(cards);
    } catch (e) {
        console.error('Error fetching all cards:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/inventory/add-cards', async (req, res) => {
    try {
        const { playerId, cards } = req.body;
        console.log("[add-cards] Reçu:", { playerId, cards: cards && cards.map(c => c._id) });
        if (!playerId || !Array.isArray(cards) || !cards.length) {
            console.warn("[add-cards] playerId ou cards manquants !");
            return res.status(400).json({ error: "playerId et cards requis" });
        }
        const db = await connectToDatabase();
        const inventory = db.collection('inventory');

        for (const card of cards) {
            if (!card._id) {
                console.warn("[add-cards] Carte sans _id:", card);
                continue;
            }
            let playerObjId, cardObjId;
            try {
                playerObjId = new ObjectId(playerId);
                cardObjId = new ObjectId(card._id);
            } catch (e) {
                console.error("[add-cards] Mauvais ObjectId:", playerId, card._id, e);
                continue;
            }

            // Vérifie si la carte existe déjà dans l'inventaire du joueur
            const existing = await inventory.findOne({
                player_id: playerObjId,
                item_id: cardObjId
            });
            if (existing) {
                console.log(`[add-cards] Carte déjà présente, incrémentation: ${card._id}`);
                await inventory.updateOne(
                    { _id: existing._id },
                    { $inc: { quantité: 1 } }
                );
            } else {
                console.log(`[add-cards] Nouvelle carte ajoutée: ${card._id}`);
                await inventory.insertOne({
                    player_id: playerObjId,
                    item_id: cardObjId,
                    quantité: 1
                });
            }
        }
        res.json({ success: true });
    } catch (err) {
        console.error("[add-cards] Erreur ajout cartes:", err);
        res.status(500).json({ error: "Erreur serveur lors de l'ajout des cartes" });
    }
});

app.get('/api/cards/:playerId', async (req, res) => {
    try {
        const { playerId } = req.params;
        const db = await connectToDatabase();

        // Agrégation pour récupérer les cartes du joueur
        const cards = await db.collection('inventory').aggregate([
            { $match: { player_id: new ObjectId(playerId) } },
            {
                $lookup: {
                    from: 'items',
                    localField: 'item_id',
                    foreignField: '_id',
                    as: 'item'
                }
            },
            { $unwind: '$item' },
            { $match: { 'item.type': 'card' } },
            {
                $project: {
                    _id: '$item._id',
                    nom: '$item.nom',
                    image: '$item.image',
                    quantity: '$quantité',
                    rarity: '$item.rarity',
                    powerUp: '$item.powerUp',
                    powerLeft: '$item.powerLeft',
                    powerRight: '$item.powerRight',
                    powerDown: '$item.powerDown',
                    description: '$item.description'
                }
            }
        ]).toArray();

        if (!cards || cards.length === 0) {
            return res.status(404).json({ error: 'No cards found for this player.' });
        }

        res.json(cards);
    } catch (e) {
        console.error('Error fetching cards:', e);
        res.status(500).json({ error: e.message });
    }

});
// Fonction pour obtenir des questions par catégorie et difficulté
async function getRandomQuestions(categories, difficulty, count = 10) {
    try {
        const db = await connectToDatabase();
        const questionsCollection = db.collection('quizQuestions');

        console.log(`[Quiz] Recherche de ${count} questions - Catégories: ${categories.join(', ')}, Difficulté: ${difficulty}`);

        // Construire le filtre
        const filter = {
            category: { $in: categories }
        };

        // Ajouter le filtre de difficulté si spécifié
        if (difficulty && difficulty !== 'mixte') {
            filter.difficulty = difficulty;
        }

        // Compter d'abord les questions disponibles
        const totalAvailable = await questionsCollection.countDocuments(filter);
        console.log(`[Quiz] ${totalAvailable} questions disponibles pour les critères`);

        if (totalAvailable === 0) {
            console.warn(`[Quiz] Aucune question trouvée pour les critères spécifiés`);
            return getSampleQuestions(count);
        }

        // Récupérer les questions aléatoirement
        const questions = await questionsCollection.aggregate([
            { $match: filter },
            { $sample: { size: Math.min(count, totalAvailable) } }
        ]).toArray();

        console.log(`[Quiz] ${questions.length} questions récupérées depuis la BDD`);

        // Si pas assez de questions en BDD, compléter avec des questions d'exemple
        if (questions.length < count) {
            console.warn(`[Quiz] Seulement ${questions.length} questions trouvées sur ${count} demandées, ajout de questions d'exemple`);
            const sampleQuestions = getSampleQuestions(count - questions.length);
            questions.push(...sampleQuestions);
        }

        return questions;
    } catch (error) {
        console.error('[Quiz] Erreur récupération questions:', error);
        return getSampleQuestions(count);
    }
}
function getSampleQuestions(count) {
    const sampleQuestions = [
        {
            question: "Quelle est la capitale de la France ?",
            answers: ["Paris", "Lyon", "Marseille", "Bordeaux"],
            correct: 0,
            category: "Géographie",
            difficulty: "facile"
        },
        {
            question: "Qui a peint 'La Joconde' ?",
            answers: ["Picasso", "Van Gogh", "Léonard de Vinci", "Monet"],
            correct: 2,
            category: "Art & Littérature",
            difficulty: "facile"
        },
        {
            question: "En quelle année a eu lieu la Révolution française ?",
            answers: ["1789", "1792", "1776", "1804"],
            correct: 0,
            category: "Histoire",
            difficulty: "facile"
        },
        {
            question: "Quel est l'élément chimique avec le symbole 'O' ?",
            answers: ["Or", "Oxygène", "Osmium", "Olivine"],
            correct: 1,
            category: "Science et Nature",
            difficulty: "facile"
        },
        {
            question: "Combien y a-t-il de joueurs dans une équipe de football ?",
            answers: ["10", "11", "12", "9"],
            correct: 1,
            category: "Sport",
            difficulty: "facile"
        }
    ];

    // Mélanger et retourner le nombre demandé
    const shuffled = [...sampleQuestions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
}

function sendNextQuestion(gameId) {
    const game = quizGames[gameId];
    if (!game || game.currentQuestion >= game.questions.length) {
        endQuizGame(gameId);
        return;
    }

    const question = game.questions[game.currentQuestion];
    game.answersThisRound = 0;

    io.to(gameId).emit('quiz:questionStart', {
        question: {
            question: question.question,
            answers: question.answers
        },
        questionNumber: game.currentQuestion + 1,
        totalQuestions: game.questions.length,
        timeLimit: 30
    });

    // Auto-passer à la question suivante après 35 secondes
    setTimeout(() => {
        sendRoundResults(gameId);
    }, 35000);
}

function sendRoundResults(gameId) {
    const game = quizGames[gameId];
    if (!game) return;

    const currentQ = game.questions[game.currentQuestion];
    console.log(`[Quiz] Envoi résultats question ${game.currentQuestion + 1} pour ${gameId}`);

    // Créer le classement actuel
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
        totalQuestions: game.questions.length
    };

    io.to(gameId).emit('quiz:roundResults', resultsData);

    // Passer à la question suivante après 5 secondes
    setTimeout(() => {
        game.currentQuestion++;
        if (game.currentQuestion >= game.questions.length) {
            endQuizGame(gameId);
        } else {
            sendNextQuestion(gameId);
        }
    }, 5000);
}

function endQuizGame(gameId) {
    const game = quizGames[gameId];
    if (!game) return;

    console.log(`[Quiz] Fin du quiz ${gameId}`);

    // Créer le classement final
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

    io.to(gameId).emit('quiz:gameEnd', endData);

    // Nettoyer le quiz après 30 secondes
    setTimeout(() => {
        delete quizGames[gameId];
        console.log(`[Quiz] Quiz ${gameId} supprimé de la mémoire`);
    }, 30000);
}