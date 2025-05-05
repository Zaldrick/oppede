const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 4000; // Port dédié pour le menu profil

// Servir les fichiers statiques du dossier public
app.use(express.static(path.join(__dirname, 'public')));

// Route pour servir la page profile.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// Route pour apparences
app.get('/assets/apparences', (req, res) => {
  const apparencesDir = path.join(__dirname, 'public', 'assets', 'apparences');
  fs.readdir(apparencesDir, (err, files) => {
    if (err) {
      console.error('Error reading apparences directory:', err);
      return res.status(500).json({ error: 'Failed to load apparences' });
    }
    const imageFiles = files.filter(file => /\.(png|jpg|jpeg|gif)$/i.test(file));
    res.json(imageFiles);
  });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`Profile server running on http://localhost:${PORT}`);
});
