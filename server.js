const express = require('express');
const app = express();
const httpServer = require('http').createServer(app);
const io = require('socket.io')(httpServer, {
  cors: {
    origin: ["http://localhost:3000", "https://fc15-89-82-23-250.ngrok-free.app"], // Ajoutez ici toutes les origines nécessaires
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 5000;

// Servir les fichiers statiques depuis le dossier "public"
app.use(express.static('public'));

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
    console.log(`Interaction de ${data.from} vers ${data.to} : ${data.message}`);
    socket.emit('interactionFeedback', {
      from: data.from,
      to: data.to,
      action: data.message,
      type: 'emitter',
    });
    socket.to(data.to).emit('interactionFeedback', {
      from: data.from,
      to: data.to,
      action: data.message,
      type: 'receiver',
    });
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
  console.log(`Serveur démarré sur le port ${PORT}`);
});
