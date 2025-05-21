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
      { pseudo: "Mehdi", dailyTeam: "1", dailyScore: 10, totalScore: 100, posX: 677.93, posY: 1286.59, mapId:0,updatedAt: new Date() },
      { pseudo: "Arthur", dailyTeam: "2", dailyScore: 15, totalScore: 120, posX: 500.0, posY: 800.0, mapId:0,updatedAt: new Date() },
      { pseudo: "Marie", dailyTeam: "2", dailyScore: 15, totalScore: 120, posX: 500.0, posY: 800.0, mapId:0,updatedAt: new Date() },
      { pseudo: "Marin", dailyTeam: "2", dailyScore: 15, totalScore: 120, posX: 500.0, posY: 800.0, mapId:0,updatedAt: new Date() }
    ];

    // Données pour la collection items (objets + cartes)
    const items = [
      { nom: "Potion", image: "fc265.png", is_echangeable: true, prix: 10, type: "item" },
      { nom: "Épée", image: "fc1777.png", is_echangeable: false, prix: 50, type: "item" },
      { nom: "Clef", image: "fc71.png", is_echangeable: true, prix: 30, type: "item" },
      { nom: "Livre Rouge", image: "fc97.png", is_echangeable: true, prix: 40, type: "item" },
      { nom: "Floki", image: "Floki.png", is_echangeable: false, prix: 999, type: "item" },
      { nom: "Sirius", image: "Sirius.png", is_echangeable: false, prix: 999, type: "item" },
      { nom: "Gaara", image: "Gaara.png", is_echangeable: false, prix: 999, type: "item" },
      // Cartes Triple Triad
      {
        nom: "Ifrit",
        image: "ifrit",
        type: "card",
        powerUp: 7,
        powerLeft: 2,
        powerRight: 6,
        powerDown: 3,
        rarity: 5,
        prix: 100,
        description: "Un démon de feu légendaire."
      },
      {
        nom: "Shiva",
        image: "shiva",
        type: "card",
        powerUp: 3,
        powerLeft: 7,
        powerRight: 2,
        powerDown: 6,
        rarity: 5,
        prix: 100,
        description: "La reine de la glace."
      },
      {
        nom: "Chocobo",
        image: "chocobo",
        type: "card",
        powerUp: 2,
        powerLeft: 3,
        powerRight: 4,
        powerDown: 5,
        rarity: 2,
        prix: 20,
        description: "Un oiseau rapide et fidèle."
      },
      {
        nom: "Bahamut",
        image: "bahamut",
        type: "card",
        powerUp: 8,
        powerLeft: 8,
        powerRight: 4,
        powerDown: 5,
        rarity: 2,
        prix: 20,
        description: "Gros Baha."
      },
      {
        nom: "Sephirtoh",
        image: "sephiroth",
        type: "card",
        powerUp: 9,
        powerLeft: 9,
        powerRight: 9,
        powerDown: 9,
        rarity: 2,
        prix: 20,
        description: "SEPHIROOOTH."
      },
      {
        nom: "Odin",
        image: "odin",
        type: "card",
        powerUp: 2,
        powerLeft: 7,
        powerRight: 7,
        powerDown: 5,
        rarity: 2,
        prix: 20,
        description: "Le beau odin blanc ou le bodin noir ?"
      }
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
        player_id: insertedPlayers.insertedIds[0], // Lien avec le premier joueur
        item_id: insertedItems.insertedIds[7], // 
        quantité: 1,
      },
      {
        player_id: insertedPlayers.insertedIds[0], // Lien avec le premier joueur
        item_id: insertedItems.insertedIds[8], // 
        quantité: 1,
      },
      {
        player_id: insertedPlayers.insertedIds[0], // Lien avec le premier joueur
        item_id: insertedItems.insertedIds[9], //
        quantité: 2,
      },
      {
        player_id: insertedPlayers.insertedIds[0], // Lien avec le premier joueur
        item_id: insertedItems.insertedIds[10], //
        quantité: 1,
      },
      {
        player_id: insertedPlayers.insertedIds[0], // Lien avec le premier joueur
        item_id: insertedItems.insertedIds[11], //
        quantité: 1,
      },
      {
        player_id: insertedPlayers.insertedIds[0], // Lien avec le premier joueur
        item_id: insertedItems.insertedIds[12], //
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
      {
        player_id: insertedPlayers.insertedIds[3], // Lien avec le deuxième joueur
        item_id: insertedItems.insertedIds[4], // Lien avec "Livre Rouge"
        quantité: 1,
      },
      {
        player_id: insertedPlayers.insertedIds[3], // Lien avec le deuxième joueur
        item_id: insertedItems.insertedIds[5], // Lien avec "Livre Rouge"
        quantité: 1,
      },
      {
        player_id: insertedPlayers.insertedIds[3], // Lien avec le deuxième joueur
        item_id: insertedItems.insertedIds[6], // Lien avec "Livre Rouge"
        quantité: 1,
      }
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
        item_id: insertedItems.insertedIds[4], // Lien avec "Livre Rouge"
        action_name: "Caresser",
        action_type: "pet",
        parameters: { lore: "Ancient secrets Il vous regarde plein d'amour." },
      },
      {
        item_id: insertedItems.insertedIds[5], // Lien avec "Livre Rouge"
        action_name: "Caresser",
        action_type: "pet",
        parameters: { lore: "Il vous regarde plein d'amour." },
      },
      {
        item_id: insertedItems.insertedIds[6], // Lien avec "Livre Rouge"
        action_name: "Caresser",
        action_type: "pet",
        parameters: { lore: "Il vous regarde plein d'amour." },
      },
    ];

    // Insérer les données dans la collection itemActions
    await itemActionsCollection.insertMany(itemActions);
    console.log("Collection 'itemActions' alimentée avec succès");

        const worldEvents = [
      {
        type: "door",
        mapKey: "map",
        x: 480,
        y: 240,
        properties: { keyRequired: "Clef", doorId: "porte1" },
        state: { locked: true }
      },
      {
        type: "door",
        mapKey: "map",
        x: 528,
        y: 240,
        properties: { keyRequired: "Clef", doorId: "porte2" },
        state: { locked: true }
      },
      {
        type: "door",
        mapKey: "map2",
        x: 300,
        y: 500,
        properties: { keyRequired: "Clef", doorId: "porte3" },
        state: { locked: true }
      },
      {
        type: "chest",
        mapKey: "map",
        x: 264,
        y: 1080,
        properties: { loot: "Potion", chestId: "chest1" },
        state: { opened: false }
      },
      {
        type: "npc",
        mapKey: "map",
        x: 216,
        y: 744,
        properties: { name: "Vieux Sage", dialogue: "Bienvenue à Oppède, jeune aventurier !" },
        state: { hasSpoken: false }
      }
    ];

    // Nettoyer la collection worldEvents avant d'insérer
    const worldEventsCollection = db.collection("worldEvents");
    await worldEventsCollection.deleteMany({});
    await worldEventsCollection.insertMany(worldEvents);
    console.log("Collection 'worldEvents' alimentée avec succès");

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