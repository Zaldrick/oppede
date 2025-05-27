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
        powerUp: 9,
        powerLeft: 8,
        powerRight: 6,
        powerDown: 2,
        rarity: 4,
        prix: 100,
        description: "Un démon de feu légendaire."
      },
      {
        nom: "Shiva",
        image: "shiva",
        type: "card",
        powerUp: 6,
        powerLeft: 9,
        powerRight: 7,
        powerDown: 4,
        rarity: 4,
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
        rarity: 5,
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
        rarity: 5,
        prix: 20,
        description: "Gros Baha."
      },
      {
        nom: "Sephiroth",
        image: "sephiroth",
        type: "card",
        powerUp: 9,
        powerLeft: 9,
        powerRight: 9,
        powerDown: 9,
        rarity: 5,
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
        rarity: 5,
        prix: 20,
        description: "Le beau odin blanc ou le bodin noir ?"
      },
      {
        nom: "Tomberry",
        image: "tomberry",
        type: "card",
        powerUp: 2,
        powerLeft: 4,
        powerRight: 5,
        powerDown: 6,
        rarity: 2,
        prix: 20,
        description: ""
      },
      {
        nom: "Bomb",
        image: "bomb",
        type: "card",
        powerUp: 2,
        powerLeft: 4,
        powerRight: 5,
        powerDown: 5,
        rarity: 2,
        prix: 20,
        description: ""
      },
      {
        nom: "Malboro",
        image: "malboro",
        type: "card",
        powerUp: 2,
        powerLeft: 7,
        powerRight: 7,
        powerDown: 5,
        rarity: 3,
        prix: 20,
        description: ""
      },
      {
        nom: "Lightning",
        image: "lightning",
        type: "card",
        powerUp: 9,
        powerLeft: 7,
        powerRight: 7,
        powerDown: 5,
        rarity: 5,
        prix: 20,
        description: ""
      },
      {
        nom: "Tidus",
        image: "tidus",
        type: "card",
        powerUp: 4,
        powerLeft: 8,
        powerRight: 9,
        powerDown: 5,
        rarity: 5,
        prix: 20,
        description: ""
      },
      {
        nom: "Squall",
        image: "squall",
        type: "card",
        powerUp: 7,
        powerLeft: 7,
        powerRight: 7,
        powerDown: 7,
        rarity: 5,
        prix: 20,
        description: ""
      },
      {
        nom: "Cloud",
        image: "cloud",
        type: "card",
        powerUp: 9,
        powerLeft: 2,
        powerRight: 4,
        powerDown: 9,
        rarity: 5,
        prix: 20,
        description: ""
      },
      {
        nom: "Zidane",
        image: "zidane",
        type: "card",
        powerUp: 5,
        powerLeft: 8,
        powerRight: 8,
        powerDown: 5,
        rarity: 5,
        prix: 20,
        description: ""
      },
      // Nouvelles cartes ajoutées (niveau 1 FF8, noms FR, puissances corrigées)
      {
        nom: "Boguomile",
        image: "Bogomile",
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
        image: "Fungus",
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
        image: "Elmidea",
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
        image: "Nocturnus",
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
        image: "Incube",
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
        image: "Aphide",
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
        image: "Elastos",
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
        image: "Diodon",
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
        image: "Carnidéa",
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
        image: "Larva",
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
        image: "Gallus",
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
      rarityChances: {
        fourStar: 0.3,
        fivesStars: 0.7
      },
      // Vérifie bien que possibleCards contient des objets complets (avec nom, image, rarity, etc)
      possibleCards: [...fourStarCardsFull, ...fivesStarCardsFull],
      description: "Un booster contenant 5 cartes de niveau 1 ou 2."
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
        player_id: insertedPlayers.insertedIds[0], // Lien avec le premier joueur
        item_id: insertedItems.insertedIds[13], //
        quantité: 1,
      },
      {
        player_id: insertedPlayers.insertedIds[0], // Lien avec le premier joueur
        item_id: insertedItems.insertedIds[14], //
        quantité: 1,
      },
      {
        player_id: insertedPlayers.insertedIds[0], // Lien avec le premier joueur
        item_id: insertedItems.insertedIds[15], //
        quantité: 1,
      },
      {
        player_id: insertedPlayers.insertedIds[0], // Lien avec le premier joueur
        item_id: insertedItems.insertedIds[16], //
        quantité: 1,
      },
      {
        player_id: insertedPlayers.insertedIds[0], // Lien avec le premier joueur
        item_id: insertedItems.insertedIds[17], //
        quantité: 1,
      },
           {
        player_id: insertedPlayers.insertedIds[1], // Lien avec le premier joueur
        item_id: insertedItems.insertedIds[7], // 
        quantité: 1,
      },
      {
        player_id: insertedPlayers.insertedIds[1], // Lien avec le premier joueur
        item_id: insertedItems.insertedIds[8], // 
        quantité: 1,
      },
      {
        player_id: insertedPlayers.insertedIds[1], // Lien avec le premier joueur
        item_id: insertedItems.insertedIds[9], //
        quantité: 2,
      },
      {
        player_id: insertedPlayers.insertedIds[1], // Lien avec le premier joueur
        item_id: insertedItems.insertedIds[10], //
        quantité: 1,
      },
      {
        player_id: insertedPlayers.insertedIds[1], // Lien avec le premier joueur
        item_id: insertedItems.insertedIds[11], //
        quantité: 1,
      },
      {
        player_id: insertedPlayers.insertedIds[1], // Lien avec le premier joueur
        item_id: insertedItems.insertedIds[12], //
        quantité: 1,
      },
      {
        player_id: insertedPlayers.insertedIds[1], // Lien avec le premier joueur
        item_id: insertedItems.insertedIds[13], //
        quantité: 1,
      },
      {
        player_id: insertedPlayers.insertedIds[1], // Lien avec le premier joueur
        item_id: insertedItems.insertedIds[14], //
        quantité: 1,
      },
      {
        player_id: insertedPlayers.insertedIds[1], // Lien avec le premier joueur
        item_id: insertedItems.insertedIds[15], //
        quantité: 1,
      },
      {
        player_id: insertedPlayers.insertedIds[1], // Lien avec le premier joueur
        item_id: insertedItems.insertedIds[16], //
        quantité: 1,
      },
      {
        player_id: insertedPlayers.insertedIds[1], // Lien avec le premier joueur
        item_id: insertedItems.insertedIds[17], //
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