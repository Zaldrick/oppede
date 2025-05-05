const express = require('express');
const cors = require('cors'); // Ensure CORS is imported
const fs = require('fs');
const path = require('path');
const app = express();
const httpServer = require('http').createServer(app);
const io = require('socket.io')(httpServer, {
  cors: {
    origin: ["http://localhost:3000"],
      //, "https://1194-89-82-23-250.ngrok-free.app"], // Add your frontend's origin here
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 5000;

// Configure CORS options
const corsOptions = {
  origin: "http://localhost:3000", // Allow requests from the React app
  methods: ["GET", "POST"],
  credentials: true, // Allow cookies if needed
};

// Enable CORS for all routes
app.use(cors(corsOptions));

// Log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// Serve static files from the "public" directory with CORS enabled
app.use('/public', cors(), express.static('public'));

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
    res.set('Access-Control-Allow-Origin', 'http://localhost:3000'); // Add CORS header
    res.json(imageFiles);
  });
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

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
