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
        nom: "Boguomile",
        image: "Bogomile.png",
        type: "card",
        powerUp: 1,
        powerLeft: 5,
        powerDown: 4,
        powerRight: 1,
        rarity: 1,
        prix: 10,
        description: "Carte monstre de base."
      },
      {
        nom: "Fungus",
        image: "Fungus.png",
        type: "card",
        powerUp: 5,
        powerLeft: 3,
        powerDown: 1,
        powerRight: 1,
        rarity: 1,
        prix: 10,
        description: "Carte monstre de base."
      },
      {
        nom: "Elmidea",
        image: "Elmidea.png",
        type: "card",
        powerUp: 1,
        powerLeft: 5,
        powerDown: 3,
        powerRight: 3,
        rarity: 1,
        prix: 10,
        description: "Carte monstre de base."
      },
      {
        nom: "Nocturnus",
        image: "Nocturnus.png",
        type: "card",
        powerUp: 6,
        powerLeft: 2,
        powerDown: 1,
        powerRight: 1,
        rarity: 1,
        prix: 10,
        description: "Carte monstre de base."
      },
      {
        nom: "Incube",
        image: "Incube.png",
        type: "card",
        powerUp: 2,
        powerLeft: 5,
        powerDown: 1,
        powerRight: 3,
        rarity: 1,
        prix: 10,
        description: "Carte monstre de base."
      },
      {
        nom: "Aphide",
        image: "Aphide.png",
        type: "card",
        powerUp: 2,
        powerLeft: 4,
        powerDown: 4,
        powerRight: 1,
        rarity: 1,
        prix: 10,
        description: "Carte monstre de base."
      },
      {
        nom: "Elastos",
        image: "Elastos.png",
        type: "card",
        powerUp: 1,
        powerLeft: 1,
        powerDown: 4,
        powerRight: 5,
        rarity: 1,
        prix: 10,
        description: "Carte monstre de base."
      },
      {
        nom: "Diodon",
        image: "Diodon.png",
        type: "card",
        powerUp: 3,
        powerLeft: 1,
        powerDown: 2,
        powerRight: 5,
        rarity: 1,
        prix: 10,
        description: "Carte monstre de base."
      },
      {
        nom: "Carnidéa",
        image: "Carnidéa.png",
        type: "card",
        powerUp: 2,
        powerLeft: 1,
        powerDown: 6,
        powerRight: 1,
        rarity: 1,
        prix: 10,
        description: "Carte monstre de base."
      },
      {
        nom: "Larva",
        image: "Larva.png",
        type: "card",
        powerUp: 4,
        powerLeft: 3,
        powerDown: 4,
        powerRight: 2,
        rarity: 1,
        prix: 10,
        description: "Carte monstre de base."
      },
      {
        nom: "Gallus",
        image: "Gallus.png",
        type: "card",
        powerUp: 2,
        powerLeft: 6,
        powerDown: 2,
        powerRight: 1,
        rarity: 1,
        prix: 10,
        description: "Carte monstre de base."
      }
    ];

    // Générer la liste des cartes de rarity 1 et 2 (objets complets, pas juste les noms)
    const oneStarCardsFull = items.filter(i => i.type === "card" && i.rarity === 1);
    const twoStarCardsFull = items.filter(i => i.type === "card" && i.rarity === 2);
    const threeStarCardsFull = items.filter(i => i.type === "card" && i.rarity === 3);
    const fourStarCardsFull = items.filter(i => i.type === "card" && i.rarity === 4);
    const fivesStarCardsFull = items.filter(i => i.type === "card" && i.rarity === 5);

    // Créer deux boosters avec toutes les cartes 1 et 2 étoiles (objets complets)
    const booster1 = {
      nom: "Booster simple",
      image: "boosterPack.png",
      type: "booster",
      cardCount: 5,
      prix:100,
      is_echangeable: false,
      rarityChances: {
        oneStar:1
      },
      // Vérifie bien que possibleCards contient des objets complets (avec nom, image, rarity, etc)
      possibleCards: [...oneStarCardsFull],
      description: "Un booster contenant 5 cartes de niveau 1"
    };

    const booster2 = {
      nom: "Booster Argent",
      image: "fc292.png",
      type: "booster",
      cardCount: 5,
      rarityChances: {
        oneStar: 0.8,
        twoStars: 0.2
      },
      possibleCards: [...oneStarCardsFull, ...twoStarCardsFull],
      description: "Un booster premium contenant 5 cartes de niveau 1 ou 2."
    };

    // Ajouter les boosters à la liste des items
    items.push(booster1, booster2);

    // Ajoute un log pour vérifier ce qui est inséré
    console.log("Booster simple inséré:", booster1);
    console.log("Booster Argent inséré:", booster2);

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
      },
      {
        player_id: insertedPlayers.insertedIds[3], // Marin
        item_id: insertedItems.insertedIds[items.length - 2], // Booster Bronze
        quantité: 3,
      },
      {
        player_id: insertedPlayers.insertedIds[0], // Marin
        item_id: insertedItems.insertedIds[items.length - 2], // Booster Bronze
        quantité: 3,
      },
      {
        player_id: insertedPlayers.insertedIds[1], // Marin
        item_id: insertedItems.insertedIds[items.length - 2], // Booster Bronze
        quantité: 3,
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
        parameters: { lore: "Ancien secrets Il vous regarde plein d'amour." },
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
      // Action pour ouvrir un booster bronze
      {
        // Pour que l'action soit trouvée pour tous les boosters, il faut une action par booster (ou une action générique par type)
        item_id: insertedItems.insertedIds[items.length - 2], // Booster Bronze
        action_name: "Ouvrir",
        action_type: "open_scene",
        parameters: {
          scene: "BoosterOpeningScene"
        }
      },
      {
        item_id: insertedItems.insertedIds[items.length - 1], // Booster Argent
        action_name: "Ouvrir",
        action_type: "open_scene",
        parameters: {
          scene: "BoosterOpeningScene"
        }
      }
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