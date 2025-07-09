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
    if (!playerId || !boosterItemId) {
        return res.status(400).json({ error: "Missing playerId or boosterItemId" });
    }

    try {
        // Utiliser le DatabaseManager depuis le middleware
        const databaseManager = req.databaseManager;
        if (!databaseManager) {
            console.error('DatabaseManager not found in request');
            return res.status(500).json({ error: "Database manager not available" });
        }

        const db = await databaseManager.connectToDatabase();
        const inventoryCol = db.collection('inventory');
        const itemsCol = db.collection('items');

        // Vérifier que le joueur possède le booster
        const boosterInventory = await inventoryCol.findOne({
            player_id: new ObjectId(playerId),
            item_id: new ObjectId(boosterItemId),
            quantite: { $gt: 0 }
        });
        
        if (!boosterInventory) {
            return res.status(400).json({ error: "Booster not found in inventory" });
        }

        // Récupérer le booster (item)
        const booster = await itemsCol.findOne({ 
            _id: new ObjectId(boosterItemId), 
            type: "booster" 
        });
        
        if (!booster) {
            return res.status(400).json({ error: "Booster item not found" });
        }

        // Récupérer toutes les cartes possibles
        const allItems = await itemsCol.find({ 
            type: "card", 
            nom: { $in: booster.possibleCards } 
        }).toArray();

        // Tirer les cartes
        const cards = [];
        for (let i = 0; i < booster.cardCount; i++) {
            const card = getRandomCard(booster, allItems);
            if (card) cards.push(card);
        }

        if (cards.length === 0) {
            return res.status(400).json({ error: "No cards could be drawn from this booster" });
        }

        // Ajouter les cartes à l'inventaire du joueur
        for (const card of cards) {
            await inventoryCol.updateOne(
                { player_id: new ObjectId(playerId), item_id: card._id },
                { $inc: { quantite: 1 } },
                { upsert: true }
            );
        }

        // Retirer le booster de l'inventaire
        await inventoryCol.updateOne(
            { player_id: new ObjectId(playerId), item_id: new ObjectId(boosterItemId) },
            { $inc: { quantite: -1 } }
        );

        console.log(`✅ Booster ouvert: ${cards.length} cartes tirées pour le joueur ${playerId}`);
        res.json({ 
            cards,
            message: `${cards.length} cartes obtenues !`
        });

    } catch (error) {
        console.error('❌ Erreur lors de l\'ouverture du booster:', error);
        res.status(500).json({ 
            error: "Internal server error",
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;
