const { MongoClient, ObjectId } = require("mongodb");

async function checkMarinInventory() {
    const uri = process.env.MONGO_URI || "mongodb+srv://zaldrick:xtHDAM0ZFpq2iL9L@oppede.zfhlzph.mongodb.net/oppede";
    const client = new MongoClient(uri);
    
    try {
        await client.connect();
        console.log("✅ Connecté à MongoDB");
        
        const db = client.db("oppede");
        const playersCollection = db.collection("players");
        const inventoryCollection = db.collection("inventory");
        const itemsCollection = db.collection("items");
        
        // Trouver Marin
        const marin = await playersCollection.findOne({ pseudo: "Marin" });
        if (!marin) {
            console.log("❌ Joueur 'Marin' non trouvé !");
            return;
        }
        
        console.log("\n👤 Joueur Marin trouvé:");
        console.log(`   _id: ${marin._id}`);
        console.log(`   pseudo: ${marin.pseudo}`);
        
        // Chercher son inventaire
        const inventory = await inventoryCollection.find({ player_id: marin._id }).toArray();
        
        console.log(`\n📦 Inventaire de Marin (${inventory.length} entrées):`);
        
        if (inventory.length === 0) {
            console.log("   ⚠️  Inventaire vide !");
        } else {
            for (const entry of inventory) {
                const item = await itemsCollection.findOne({ _id: entry.item_id });
                console.log(`   - ${item?.nom || 'Unknown'} (quantité: ${entry.quantité})`);
                console.log(`     item_id: ${entry.item_id}`);
                console.log(`     type: ${item?.type || 'N/A'}`);
            }
        }
        
        // Tester l'aggregate (comme l'API)
        console.log("\n🔍 Test de l'aggregate (comme l'API):");
        const aggregateResult = await inventoryCollection.aggregate([
            { $match: { player_id: marin._id } },
            {
                $lookup: {
                    from: 'items',
                    localField: 'item_id',
                    foreignField: '_id',
                    as: 'itemDetails',
                },
            },
            { $unwind: '$itemDetails' },
        ]).toArray();
        
        console.log(`   Résultats: ${aggregateResult.length} items`);
        aggregateResult.forEach(item => {
            console.log(`   - ${item.itemDetails.nom} (${item.itemDetails.type}) x${item.quantité}`);
        });
        
    } catch (error) {
        console.error("❌ Erreur:", error);
    } finally {
        await client.close();
    }
}

checkMarinInventory();
