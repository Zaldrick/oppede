const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

// Helper pour tirer une carte selon les chances de rareté
function getRandomCard(booster, items) {
    const rand = Math.random();
    let rarity;
    if (rand < booster.rarityChances.oneStar) rarity = 1;
    else rarity = 2;
    // Filtrer les cartes possibles de la bonne rareté
    const possible = items.filter(
        i => i.type === "card" && booster.possibleCards.includes(i.nom) && i.rarity === rarity
    );
    if (possible.length === 0) return null;
    return possible[Math.floor(Math.random() * possible.length)];
}

router.post('/api/open-booster', async (req, res) => {
    const { playerId, boosterItemId } = req.body;
    if (!playerId || !boosterItemId) return res.status(400).json({ error: "Missing playerId or boosterItemId" });

    const db = req.app.locals.db;
    const inventoryCol = db.collection('inventory');
    const itemsCol = db.collection('items');

    // Vérifier que le joueur possède le booster
    const boosterInventory = await inventoryCol.findOne({
        player_id: playerId,
        item_id: ObjectId(boosterItemId),
        quantité: { $gt: 0 }
    });
    if (!boosterInventory) return res.status(400).json({ error: "Booster not found in inventory" });

    // Récupérer le booster (item)
    const booster = await itemsCol.findOne({ _id: ObjectId(boosterItemId), type: "booster" });
    if (!booster) return res.status(400).json({ error: "Booster item not found" });

    // Récupérer toutes les cartes possibles
    const allItems = await itemsCol.find({ type: "card", nom: { $in: booster.possibleCards } }).toArray();

    // Tirer les cartes
    const cards = [];
    for (let i = 0; i < booster.cardCount; i++) {
        const card = getRandomCard(booster, allItems);
        if (card) cards.push(card);
    }

    // Ajouter les cartes à l'inventaire du joueur
    for (const card of cards) {
        await inventoryCol.updateOne(
            { player_id: playerId, item_id: card._id },
            { $inc: { quantité: 1 } },
            { upsert: true }
        );
    }

    // Retirer le booster de l'inventaire
    await inventoryCol.updateOne(
        { player_id: playerId, item_id: ObjectId(boosterItemId) },
        { $inc: { quantité: -1 } }
    );

    res.json({ cards });
});

module.exports = router;
