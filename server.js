console.log('NODE_ENV:', process.env.NODE_ENV); // Log pour vérifier NODE_ENV
if (process.env.NODE_ENV === 'production') {
  require('dotenv').config({ path: '.env.production' }); // Charger les variables d'environnement de production
} else {
  require('dotenv').config(); // Charger les variables d'environnement par défaut
}

console.log('Loaded FRONTEND_URL:', process.env.FRONTEND_URL); // Log pour vérifier FRONTEND_URL
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const app = express();
const http = require('http');
const https = require('https');

const PORT = process.env.BACKEND_PORT || 3000; // Default port for backend
const isProduction = process.env.NODE_ENV === 'production';

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
  methods: ["GET", "POST"],
  credentials: true, // Allow cookies if needed
};

// Enable CORS for all routes
app.use(cors(corsOptions));

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
const connectToDatabase = async () => {
  try {
    const connection = await mongoose.connect('mongodb+srv://zaldrick:xtHDAM0ZFpq2iL9L@oppede.zfhlzph.mongodb.net/oppede', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB successfully!');
    return connection.connection.db;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
};

// Log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

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

    // Log the raw query result
    console.log('Raw query result from MongoDB:', playerList);

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


// Middleware to parse JSON request bodies
app.use(express.json());

app.post('/api/players/update-position', async (req, res) => {
    try {
        const { pseudo, posX, posY } = req.body;

        // Validate the request body
        if (!pseudo || posX === undefined || posY === undefined) {
            console.error("Invalid request body:", req.body);
            return res.status(400).json({ error: 'Invalid request. Missing pseudo, posX, or posY.' });
        }

        const db = await connectToDatabase();
        const players = db.collection('players');

        // Update the player's position in the database
        const result = await players.updateOne(
            { pseudo },
            { $set: { posX, posY, updatedAt: new Date() } }
        );

        if (result.matchedCount === 0) {
            console.warn(`Player not found: ${pseudo}`);
            return res.status(404).json({ error: 'Player not found' });
        }

        console.log(`Player position updated: { pseudo: ${pseudo}, posX: ${posX}, posY: ${posY} }`);
        res.json({ success: true, message: 'Player position updated successfully.' });
    } catch (error) {
        console.error('Error updating player position:', error);
        res.status(500).json({ error: 'Failed to update player position' });
    }
});

let players = {};
let chatMessages = []; // Stocker les messages de chat

io.on('connection', (socket) => {
  console.log(`Client connecté : ${socket.id}`);

  socket.on('connect_error', (err) => {
    console.error('Erreur de connexion Socket.IO :', err.message);
  });

  // Réception d'un nouveau joueur
  socket.on('newPlayer', (data) => {
    players[socket.id] = {
      x: data.x,
      y: data.y,
      character: data.character
    };
    console.log(`Joueur connecté : ${socket.id} (Total: ${Object.keys(players).length})`);
  });

  // Mise à jour des mouvements du joueur (limitation de fréquence)
  socket.on('playerMove', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].anim = data.anim;
    }
  });

  // Gestion des interactions entre joueurs
  socket.on('interaction', (data) => {
    console.log(`Interaction de ${data.from} vers ${data.to} : ${data.action}`);
    // Notify the emitter
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
    } else {
        console.warn(`Le joueur cible ${data.to} n'est pas connecté.`);
    }
  });

  // Gestion de l'événement 'chatMessage'
  socket.on('chatMessage', (data, callback) => {
    console.log(`Tentative de réception de 'chatMessage' de ${socket.id}`);

    if (!data || !data.message || typeof data.message !== 'string') {
      console.warn(`Message invalide reçu de ${socket.id}:`, data);
      if (callback) callback({ status: 'error', message: 'Message invalide' });
      return;
    }

    const message = { id: socket.id, message: data.message };
    chatMessages.push(message); // Ajouter le message à l'historique
    io.emit('chatMessage', message); // Diffuser le message à tous les clients
    console.log(`Message reçu et diffusé : ${data.message}`);

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
    delete players[socket.id];
  });
});

// Diffuser l'état complet des joueurs 20 fois par seconde (toutes les 50ms)
setInterval(() => {
  io.emit('playersUpdate', players);
}, 50);

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

        console.log(`Position for player ${pseudo} fetched from MongoDB:`, player); // Log the fetched position
        res.json({ x: player.posX, y: player.posY }); // Return the position
    } catch (error) {
        console.error('Error fetching player position:', error);
        res.status(500).json({ error: 'Failed to fetch player position' });
    }
});

app.get('/api/inventory/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params; // Récupère l'ID du joueur depuis les paramètres
    const db = await connectToDatabase();
    const inventoryCollection = db.collection('inventory');

    // Recherche l'inventaire du joueur par son ID
    const inventory = await inventoryCollection.find({ player_id: new mongoose.Types.ObjectId(playerId) }).toArray();

    if (!inventory || inventory.length === 0) {
      return res.status(404).json({ error: 'Inventory not found' });
    }

    res.json(inventory); // Retourne l'inventaire
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});
