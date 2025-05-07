const express = require("express");
const app = express();
const inventoryRoutes = require("./routes/inventory");
const playersRoutes = require("./routes/players");

// Middleware pour parser les JSON
app.use(express.json());

// Route pour l'inventaire
app.use("/api/inventory", inventoryRoutes);

// Route pour les joueurs
app.use("/api/players", playersRoutes);

// Autres routes...
