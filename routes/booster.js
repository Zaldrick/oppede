const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

// Helper pour tirer une carte selon les chances de rareté
function getRandomCard(booster, items) {
    const rand = Math.random();
    let cumulative = 0;
    let rarity = 1; // fallback

    // Tableau des raretés et chances
    const chances = [
        { rarity: 1, chance: booster.rarityChances.oneStar || 0 },
        { rarity: 2, chance: booster.rarityChances.twoStars || 0 },
        { rarity: 3, chance: booster.rarityChances.threeStars || 0 },
        { rarity: 4, chance: booster.rarityChances.fourStars || 0 }
    ];

    for (const entry of chances) {
        cumulative += entry.chance;
        if (rand < cumulative) {
            rarity = entry.rarity;
            break;
        }
    }
    console.log('🎯 Rareté finale:', rarity);

    // Filtrer les cartes possibles de la bonne rareté
    const possible = items.filter(i => i.rarity === rarity);

    console.log('🎯 Cartes possibles pour rareté', rarity, ':', possible.length);

    if (possible.length === 0) {
        // Fallback vers rareté 1 si aucune carte de la rareté demandée
        const fallback = items.filter(i => i.rarity === 1);
        if (fallback.length > 0) {
            return fallback[Math.floor(Math.random() * fallback.length)];
        }
        return null;
    }
    return possible[Math.floor(Math.random() * possible.length)];
}

router.post('/api/open-booster', async (req, res) => {
    console.log('🎯 Requête reçue pour ouvrir un booster');
    console.log('Body reçu:', req.body);

    const { playerId, boosterItemId } = req.body;

    console.log('playerId:', playerId, 'type:', typeof playerId);
    console.log('boosterItemId:', boosterItemId, 'type:', typeof boosterItemId);

    if (!playerId || !boosterItemId) {
        console.log('❌ Paramètres manquants');
        return res.status(400).json({ error: "Missing playerId or boosterItemId" });
    }

    try {
        // Vérifier si les IDs sont valides pour MongoDB
        if (!ObjectId.isValid(playerId)) {
            console.log('❌ playerId invalide pour MongoDB:', playerId);
            return res.status(400).json({ error: "Invalid playerId format" });
        }

        if (!ObjectId.isValid(boosterItemId)) {
            console.log('❌ boosterItemId invalide pour MongoDB:', boosterItemId);
            return res.status(400).json({ error: "Invalid boosterItemId format" });
        }

        console.log('✅ IDs valides pour MongoDB');

        // Utiliser le DatabaseManager depuis le middleware
        const databaseManager = req.databaseManager;
        if (!databaseManager) {
            console.error('DatabaseManager not found in request');
            return res.status(500).json({ error: "Database manager not available" });
        }

        const db = await databaseManager.connectToDatabase();
        const inventoryCol = db.collection('inventory');
        const itemsCol = db.collection('items');

        console.log('🔍 Recherche du booster dans l\'inventaire...');
        console.log('Recherche avec playerId ObjectId:', new ObjectId(playerId));
        console.log('Recherche avec boosterItemId ObjectId:', new ObjectId(boosterItemId));

        // Vérifier que le joueur possède le booster
        const boosterInventory = await inventoryCol.findOne({
            player_id: new ObjectId(playerId),
            item_id: new ObjectId(boosterItemId),
            $or: [
                { quantite: { $gt: 0 } },      // Sans accent
                { 'quantité': { $gt: 0 } }     // Avec accent
            ]
        });

        console.log('Résultat recherche inventaire:', boosterInventory);

        if (!boosterInventory) {
            console.log('❌ Booster non trouvé dans l\'inventaire');
            // Recherchons pourquoi il n'est pas trouvé
            console.log('🔍 Debug - recherche alternative...');

            const allPlayerInventory = await inventoryCol.find({
                player_id: new ObjectId(playerId)
            }).toArray();
            console.log('Tout l\'inventaire du joueur:', allPlayerInventory);

            const specificItem = await inventoryCol.find({
                item_id: new ObjectId(boosterItemId)
            }).toArray();
            console.log('Tous les joueurs ayant cet item:', specificItem);

            return res.status(400).json({ error: "Booster not found in inventory" });
        }

        console.log('✅ Booster trouvé dans l\'inventaire');

        // Récupérer le booster (item)
        console.log('🔍 Recherche des détails du booster...');
        const booster = await itemsCol.findOne({
            _id: new ObjectId(boosterItemId),
            type: "booster"
        });

        console.log('Résultat recherche booster:', booster);

        if (!booster) {
            console.log('❌ Booster item non trouvé dans items');
            return res.status(400).json({ error: "Booster item not found" });
        }

        console.log('✅ Booster trouvé dans items');

        // Récupérer toutes les cartes possibles
        console.log('🔍 Recherche des cartes possibles...');
        console.log('possibleCards dans le booster:', booster.possibleCards);

        // Les cartes sont déjà dans booster.possibleCards
        const allItems = booster.possibleCards;

        console.log('Cartes trouvées:', allItems.length);

        // Tirer les cartes
        const cards = [];
        for (let i = 0; i < booster.cardCount; i++) {
            const card = getRandomCard(booster, allItems);
            if (card) cards.push(card);
        }

        if (cards.length === 0) {
            console.log('❌ Aucune carte tirée');
            return res.status(400).json({ error: "No cards could be drawn from this booster" });
        }

        console.log(`✅ ${cards.length} cartes tirées`);

        // Ajouter les cartes à l'inventaire du joueur
        for (const card of cards) {
            await inventoryCol.updateOne(
                { player_id: new ObjectId(playerId), item_id: card._id },
                { $inc: { quantite: 1 } },
                { upsert: true }
            );
        }
        // Retirer le booster de l'inventaire
        const currentQuantity = boosterInventory.quantite || boosterInventory['quantité'] || 0;

        if (currentQuantity <= 1) {
            // Si la quantité est 1 ou moins, supprimer complètement l'entrée
            await inventoryCol.deleteOne({
                player_id: new ObjectId(playerId),
                item_id: new ObjectId(boosterItemId)
            });
            console.log('✅ Booster supprimé de l\'inventaire (quantité était à', currentQuantity, ')');
        } else {
            // Sinon, décrémenter la quantité - utiliser le bon champ
            const quantityField = boosterInventory.quantite !== undefined ? 'quantite' : 'quantité';
            const updateQuery = {};
            updateQuery[quantityField] = -1;

            await inventoryCol.updateOne(
                { player_id: new ObjectId(playerId), item_id: new ObjectId(boosterItemId) },
                { $inc: updateQuery }
            );
            console.log('✅ Quantité du booster décrémentée de', currentQuantity, 'à', currentQuantity - 1);
        }

        console.log('✅ Booster retiré de l\'inventaire');

        console.log(`✅ Booster ouvert avec succès: ${cards.length} cartes tirées pour le joueur ${playerId}`);
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
