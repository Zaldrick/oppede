const express = require('express');
const app = express();
const httpServer = require('http').createServer(app);
const io = require('socket.io')(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 5000;

// Servir les fichiers statiques depuis le dossier "public"
app.use(express.static('public'));

let players = {};

io.on('connection', (socket) => {
  // Réception d'un nouveau joueur
  socket.on('newPlayer', (data) => {
    players[socket.id] = {
      x: data.x,
      y: data.y,
      character: data.character
    };
    console.log(`Joueur connecté : ${socket.id} (Total: ${Object.keys(players).length})`);
  });

  // Mise à jour des mouvements du joueur
  socket.on('playerMove', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      // Mémoriser l'animation envoyée par le client
      players[socket.id].anim = data.anim;
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
  console.log(`Serveur démarré sur le port ${PORT}`);
});
