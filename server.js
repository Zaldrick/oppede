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
      console.log('Received update-position request:', req.body); // Log the request body
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

socket.on('newPlayer', (data) => {
    const { pseudo, mapId = 0 } = data; // Par défaut, map1

    // Vérifier si le pseudo est déjà connecté
    const existingPlayerSocketId = Object.keys(players).find(
        (id) => players[id].pseudo === pseudo
    );

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
        pseudo: data.pseudo || "Inconnu"
    };

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
/*
            // Handle player challenges
            socket.on("challengePlayer", ({ from, to }, callback) => {
              if (!players[to]) {
                  callback({ status: "error", message: "Player not found" });
                  return;
              }
  
              // Notify the challenged player
              io.to(to).emit("challengeReceived", { from });
  
              // Set a timeout for the response
              const timeout = setTimeout(() => {
                  io.to(from).emit("challengeResponse", { to, accepted: false, reason: "timeout" });
              }, 10000); // 10 seconds
  
              // Listen for the response
              socket.on("challengeResponse", ({ accepted }) => {
                  clearTimeout(timeout); // Clear the timeout
                  io.to(from).emit("challengeResponse", { to, accepted });
              });
          });
*/
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
    delete players[socket.id];

    // Informer les autres joueurs de la déconnexion
    io.emit('playerDisconnected', { id: socket.id, mapId: disconnectedPlayer?.mapId });

    console.log("État actuel des joueurs après déconnexion :", players); // Log pour vérifier l'état des joueurs
});
});


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
    const { playerId } = req.params; // Extract playerId from the request parameters
    const db = await connectToDatabase();
    const inventoryCollection = db.collection('inventory');

    // Use aggregation to join inventory with items
    const inventory = await inventoryCollection.aggregate([
      {
        $match: { player_id: new ObjectId(playerId) }, // Match inventory by player_id
      },
      {
        $lookup: {
          from: 'items', // Join with the items collection
          localField: 'item_id', // Field in inventory
          foreignField: '_id', // Field in items
          as: 'itemDetails', // Output array field
        },
      },
      {
        $unwind: '$itemDetails', // Flatten the itemDetails array
      },
      {
        $lookup: {
          from: 'itemActions', // Join with the itemActions collection
          localField: 'item_id', // Field in inventory
          foreignField: 'item_id', // Field in itemActions
          as: 'actions', // Output array field
        },
      },
      {
        $project: {
          _id: 1,
          player_id: 1,
          item_id: 1,
          quantité: 1,
          nom: '$itemDetails.nom', // Include item details
          image: '$itemDetails.image',
          is_echangeable: '$itemDetails.is_echangeable',
          prix: '$itemDetails.prix',
          actions: 1, // Include actions
        },
      },
    ]).toArray();

    if (!inventory || inventory.length === 0) {
      return res.status(404).json({ error: 'Inventory not found' });
    }

    res.json(inventory); // Return the enriched inventory
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