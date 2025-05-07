const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");
const db = require("../db"); // Assure-toi que ce fichier gère la connexion à MongoDB

// Route pour récupérer les données d'un joueur par pseudo
router.get("/:pseudo", async (req, res) => {
  try {
    const pseudo = req.params.pseudo;

    const player = await db.collection("players").findOne({ pseudo });

    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }

    res.json(player);
  } catch (error) {
    console.error("Error fetching player:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route pour mettre à jour la position d'un joueur
router.post("/update-position", async (req, res) => {
  try {
    const { pseudo, posX, posY } = req.body;

    if (!pseudo || posX == null || posY == null) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await db.collection("players").updateOne(
      { pseudo },
      { $set: { posX, posY, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Player not found" });
    }

    res.json({ message: "Player position updated successfully" });
  } catch (error) {
    console.error("Error updating player position:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
