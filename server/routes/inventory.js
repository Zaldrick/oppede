const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const db = require("../db"); // Assure-toi que ce fichier gère la connexion à MongoDB

// Route pour récupérer l'inventaire d'un joueur
router.get("/:playerId", async (req, res) => {
  try {
    const playerId = req.params.playerId;

    // Vérifie si l'ID est valide
    if (!ObjectId.isValid(playerId)) {
      return res.status(400).json({ error: "Invalid player ID" });
    }

    const inventory = await db.collection("inventory").find({ player_id: new ObjectId(playerId) }).toArray();

    if (!inventory) {
      return res.status(404).json({ error: "Inventory not found" });
    }

    res.json(inventory);
  } catch (error) {
    console.error("Error fetching inventory:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
