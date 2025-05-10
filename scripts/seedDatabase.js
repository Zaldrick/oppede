const { MongoClient, ObjectId } = require("mongodb");

async function connectToDatabase() {
  const uri = process.env.MONGO_URI || "mongodb+srv://zaldrick:xtHDAM0ZFpq2iL9L@oppede.zfhlzph.mongodb.net/oppede";
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  await client.connect();
  return client;
}

async function seedDatabase() {
  let client;

  try {
    client = await connectToDatabase();
    console.log("Connecté à la base de données MongoDB");

    const db = client.db("oppede");

    // Collections
    const playersCollection = db.collection("players");
    const itemsCollection = db.collection("items");
    const inventoryCollection = db.collection("inventory");
    const itemActionsCollection = db.collection("itemActions");

    // Données pour la collection players
    const players = [
      { pseudo: "Mehdi", dailyTeam: "1", dailyScore: 10, totalScore: 100, posX: 677.93, posY: 1286.59, updatedAt: new Date() },
      { pseudo: "Arthur", dailyTeam: "2", dailyScore: 15, totalScore: 120, posX: 500.0, posY: 800.0, updatedAt: new Date() },
      { pseudo: "Marie", dailyTeam: "2", dailyScore: 15, totalScore: 120, posX: 500.0, posY: 800.0, updatedAt: new Date() }
    ];

    // Données pour la collection items
    const items = [
      { nom: "Potion", image: "fc265.png", is_echangeable: true, prix: 10 },
      { nom: "Épée", image: "fc1777.png", is_echangeable: false, prix: 50 },
      { nom: "Clef", image: "fc71.png", is_echangeable: true, prix: 30 },
      { nom: "Livre Rouge", image: "fc97.png", is_echangeable: true, prix: 40 },
    ];

    // Nettoyer les collections avant d'insérer
    await playersCollection.deleteMany({});
    await itemsCollection.deleteMany({});
    await inventoryCollection.deleteMany({});
    await itemActionsCollection.deleteMany({});

    // Insérer les données dans la collection players
    const insertedPlayers = await playersCollection.insertMany(players);
    console.log("Collection 'players' alimentée avec succès");

    // Insérer les données dans la collection items
    const insertedItems = await itemsCollection.insertMany(items);
    console.log("Collection 'items' alimentée avec succès");

    // Données pour la collection inventory
    const inventory = [
      {
        player_id: insertedPlayers.insertedIds[0], // Lien avec le premier joueur
        item_id: insertedItems.insertedIds[0], // Lien avec "Potion"
        quantité: 5,
      },
      {
        player_id: insertedPlayers.insertedIds[0], // Lien avec le premier joueur
        item_id: insertedItems.insertedIds[1], // Lien avec "Épée"
        quantité: 1,
      },
      {
        player_id: insertedPlayers.insertedIds[1], // Lien avec le deuxième joueur
        item_id: insertedItems.insertedIds[2], // Lien avec "Clef"
        quantité: 2,
      },
      {
        player_id: insertedPlayers.insertedIds[1], // Lien avec le deuxième joueur
        item_id: insertedItems.insertedIds[3], // Lien avec "Livre Rouge"
        quantité: 1,
      },
    ];

    // Insérer les données dans la collection inventory
    await inventoryCollection.insertMany(inventory);
    console.log("Collection 'inventory' alimentée avec succès");

    // Données pour la collection itemActions
    const itemActions = [
      {
        item_id: insertedItems.insertedIds[0], // Lien avec "Potion"
        action_name: "Utiliser",
        action_type: "heal",
        parameters: { amount: 50 },
      },
      {
        item_id: insertedItems.insertedIds[1], // Lien avec "Épée"
        action_name: "Équiper",
        action_type: "equip",
        parameters: { slot: "weapon" },
      },
      {
        item_id: insertedItems.insertedIds[2], // Lien avec "Clef"
        action_name: "Utiliser",
        action_type: "unlock",
        parameters: { door_id: "12345" },
      },
      {
        item_id: insertedItems.insertedIds[3], // Lien avec "Livre Rouge"
        action_name: "Lire",
        action_type: "read",
        parameters: { lore: "Ancient secrets revealed..." },
      },
    ];

    // Insérer les données dans la collection itemActions
    await itemActionsCollection.insertMany(itemActions);
    console.log("Collection 'itemActions' alimentée avec succès");
  } catch (error) {
    console.error("Erreur lors de l'alimentation de la base de données :", error);
  } finally {
    if (client) {
      await client.close();
      console.log("Connexion à MongoDB fermée");
    }
  }
}

seedDatabase();