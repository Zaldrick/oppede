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
      { pseudo: "Mehdi", dailyTeam: "1", dailyScore: 10, totalScore: 100, posX: 500.0, posY: 360.0, mapId:2,updatedAt: new Date() },
      { pseudo: "Arthur", dailyTeam: "2", dailyScore: 15, totalScore: 120, posX: 2424.0, posY: 360.0, mapId:2,updatedAt: new Date() },
      { pseudo: "Marie", dailyTeam: "2", dailyScore: 15, totalScore: 120, posX: 2424.0, posY: 360.0, mapId:2,updatedAt: new Date() },
      { pseudo: "Marin", dailyTeam: "2", dailyScore: 15, totalScore: 120, posX: 2424.0, posY: 360.0, mapId:2,updatedAt: new Date() }
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
  {
    nom: "L'alcoolique verte",
    image: "L'alcoolique verte.png",
    type: "card",
    powerUp: 7,
    powerLeft: 1,
    powerDown: 1,
    powerRight: 3,
    rarity: 1,
    prix: 20,
    description: ""
  },
  {
    nom: "L'alpiniste",
    image: "L'alpiniste.png",
    type: "card",
    powerUp: 6,
    powerLeft: 3,
    powerDown: 2,
    powerRight: 2,
    rarity: 1,
    prix: 20,
    description: ""
  },
  {
    nom: "L'apprentie Chatte",
    image: "L'apprentie Chatte.png",
    type: "card",
    powerUp: 5,
    powerLeft: 4,
    powerDown: 3,
    powerRight: 3,
    rarity: 1,
    prix: 20,
    description: ""
  },
  {
    nom: "L'auditrice",
    image: "L'auditrice.png",
    type: "card",
    powerUp: 6,
    powerLeft: 3,
    powerDown: 1,
    powerRight: 4,
    rarity: 1,
    prix: 20,
    description: ""
  },
  {
    nom: "L'aérobiqueuse",
    image: "L'aérobiqueuse.png",
    type: "card",
    powerUp: 3,
    powerLeft: 3,
    powerDown: 4,
    powerRight: 5,
    rarity: 1,
    prix: 20,
    description: ""
  },
  {
    nom: "La gloutonne",
    image: "La gloutonne.png",
    type: "card",
    powerUp: 5,
    powerLeft: 5,
    powerDown: 3,
    powerRight: 2,
    rarity: 1,
    prix: 20,
    description: ""
  },
  {
    nom: "La starac",
    image: "La starac.png",
    type: "card",
    powerUp: 5,
    powerLeft: 5,
    powerDown: 1,
    powerRight: 3,
    rarity: 1,
    prix: 20,
    description: ""
  },
  {
    nom: "Le Maître du Jeu",
    image: "Le Maître du Jeu.png",
    type: "card",
    powerUp: 5,
    powerLeft: 2,
    powerDown: 2,
    powerRight: 5,
    rarity: 1,
    prix: 20,
    description: ""
  },
  {
    nom: "Le mini dalleux",
    image: "Le mini dalleux.png",
    type: "card",
    powerUp: 4,
    powerLeft: 2,
    powerDown: 4,
    powerRight: 5,
    rarity: 1,
    prix: 20,
    description: ""
  },
  {
    nom: "Le pêcheur",
    image: "Le pêcheur.png",
    type: "card",
    powerUp: 3,
    powerLeft: 7,
    powerDown: 2,
    powerRight: 1,
    rarity: 1,
    prix: 20,
    description: ""
  },
  {
    nom: "Les stagiaires de droite",
    image: "Les stagiaires de droite.png",
    type: "card",
    powerUp: 5,
    powerLeft: 3,
    powerDown: 2,
    powerRight: 5,
    rarity: 1,
    prix: 20,
    description: ""
  },
        {
    nom: "L'appropriation culturelle",
    image: "L'appropriation culturelle.png",
    type: "card",
    powerUp: 2,
    powerLeft: 7,
    powerDown: 3,
    powerRight: 6,
    rarity: 2,
    prix: 40,
    description: ""
  },
  {
    nom: "L'innocent",
    image: "L'innocent.png",
    type: "card",
    powerUp: 6,
    powerLeft: 5,
    powerDown: 5,
    powerRight: 4,
    rarity: 2,
    prix: 40,
    description: ""
  },
  {
    nom: "La folle du village",
    image: "La folle du village.png",
    type: "card",
    powerUp: 4,
    powerLeft: 7,
    powerDown: 6,
    powerRight: 2,
    rarity: 2,
    prix: 40,
    description: ""
  },
  {
    nom: "La grosse carpe",
    image: "La grosse carpe.png",
    type: "card",
    powerUp: 2,
    powerLeft: 3,
    powerDown: 7,
    powerRight: 6,
    rarity: 2,
    prix: 40,
    description: ""
  },
  {
    nom: "Le fan de Chirac",
    image: "Le fan de Chirac.png",
    type: "card",
    powerUp: 1,
    powerLeft: 7,
    powerDown: 6,
    powerRight: 4,
    rarity: 2,
    prix: 40,
    description: ""
  },
  {
    nom: "Le guide",
    image: "Le guide.png",
    type: "card",
    powerUp: 7,
    powerLeft: 6,
    powerDown: 3,
    powerRight: 1,
    rarity: 2,
    prix: 40,
    description: ""
  },
  {
    nom: "Le jocat",
    image: "Le jocat.png",
    type: "card",
    powerUp: 7,
    powerLeft: 4,
    powerDown: 4,
    powerRight: 4,
    rarity: 2,
    prix: 40,
    description: ""
  },
  {
    nom: "Le queutard",
    image: "Le queutard.png",
    type: "card",
    powerUp: 3,
    powerLeft: 6,
    powerDown: 7,
    powerRight: 3,
    rarity: 2,
    prix: 40,
    description: ""
  },
  {
    nom: "le stalker",
    image: "le stalker.png",
    type: "card",
    powerUp: 6,
    powerLeft: 3,
    powerDown: 2,
    powerRight: 7,
    rarity: 2,
    prix: 40,
    description: ""
  },
  {
    nom: "Le touriste",
    image: "Le touriste.png",
    type: "card",
    powerUp: 4,
    powerLeft: 6,
    powerDown: 5,
    powerRight: 5,
    rarity: 2,
    prix: 40,
    description: ""
  },
  {
    nom: "La musicos",
    image: "La musicos.png",
    type: "card",
    powerUp: 7,
    powerLeft: 3,
    powerDown: 5,
    powerRight: 4,
    rarity: 2,
    prix: 40,
    description: ""
  },
  {
    nom: "L'apprenti Pirate",
    image: "L'apprenti Pirate.png",
    type: "card",
    powerUp: 2,
    powerLeft: 4,
    powerDown: 8,
    powerRight: 8,
    rarity: 3,
    prix: 60,
    description: ""
  },
  {
    nom: "L'invitation",
    image: "L'invitation.png",
    type: "card",
    powerUp: 7,
    powerLeft: 4,
    powerDown: 8,
    powerRight: 3,
    rarity: 3,
    prix: 60,
    description: ""
  },
  {
    nom: "La barmaid",
    image: "La barmaid.png",
    type: "card",
    powerUp: 4,
    powerLeft: 3,
    powerDown: 8,
    powerRight: 7,
    rarity: 3,
    prix: 60,
    description: ""
  },
  {
    nom: "La belle bite",
    image: "La belle bite.png",
    type: "card",
    powerUp: 7,
    powerLeft: 5,
    powerDown: 2,
    powerRight: 8,
    rarity: 3,
    prix: 60,
    description: ""
  },
  {
    nom: "La cb perdue",
    image: "La cb perdue.png",
    type: "card",
    powerUp: 1,
    powerLeft: 3,
    powerDown: 8,
    powerRight: 8,
    rarity: 3,
    prix: 60,
    description: ""
  },
  {
    nom: "La double binche",
    image: "La double binche.png",
    type: "card",
    powerUp: 8,
    powerLeft: 2,
    powerDown: 2,
    powerRight: 8,
    rarity: 3,
    prix: 60,
    description: ""
  },
  {
    nom: "La dépravé",
    image: "La dépravé.png",
    type: "card",
    powerUp: 6,
    powerLeft: 5,
    powerDown: 8,
    powerRight: 4,
    rarity: 3,
    prix: 60,
    description: ""
  },
  {
    nom: "Le fan d'histoire",
    image: "Le fan d'histoire.png",
    type: "card",
    powerUp: 4,
    powerLeft: 6,
    powerDown: 8,
    powerRight: 5,
    rarity: 3,
    prix: 60,
    description: ""
  },
  {
    nom: "Le quota de gay",
    image: "Le quota de gay.png",
    type: "card",
    powerUp: 1,
    powerLeft: 8,
    powerDown: 8,
    powerRight: 4,
    rarity: 3,
    prix: 60,
    description: ""
  },
  {
    nom: "Les campeurs du dimanche",
    image: "Les campeurs du dimanche.png",
    type: "card",
    powerUp: 6,
    powerLeft: 4,
    powerDown: 5,
    powerRight: 8,
    rarity: 3,
    prix: 60,
    description: ""
  },
  {
    nom: "Les ginyus eco+",
    image: "Les ginyus eco+.png",
    type: "card",
    powerUp: 7,
    powerLeft: 1,
    powerDown: 5,
    powerRight: 8,
    rarity: 3,
    prix: 60,
    description: ""
  },
  {
    nom: "L'allumeuse",
    image: "L'allumeuse.png",
    type: "card",
    powerUp: 4,
    powerLeft: 9,
    powerDown: 4,
    powerRight: 8,
    rarity: 4,
    prix: 80,
    description: ""
  },
  {
    nom: "L'iron Punk",
    image: "L'iron Punk.png",
    type: "card",
    powerUp: 9,
    powerLeft: 3,
    powerDown: 6,
    powerRight: 7,
    rarity: 4,
    prix: 80,
    description: ""
  },
  {
    nom: "la Pirate",
    image: "la Pirate.png",
    type: "card",
    powerUp: 3,
    powerLeft: 6,
    powerDown: 7,
    powerRight: 9,
    rarity: 4,
    prix: 80,
    description: ""
  },
  {
    nom: "La pochtronne",
    image: "La pochtronne.png",
    type: "card",
    powerUp: 9,
    powerLeft: 2,
    powerDown: 3,
    powerRight: 9,
    rarity: 4,
    prix: 80,
    description: ""
  },
  {
    nom: "Le Bibliothécaire",
    image: "Le Bibliothécaire.png",
    type: "card",
    powerUp: 9,
    powerLeft: 4,
    powerDown: 4,
    powerRight: 8,
    rarity: 4,
    prix: 80,
    description: ""
  },
  {
    nom: "Le condamné à mort",
    image: "Le condamné à mort.png",
    type: "card",
    powerUp: 2,
    powerLeft: 4,
    powerDown: 9,
    powerRight: 9,
    rarity: 4,
    prix: 80,
    description: ""
  },
  {
    nom: "Le Disparu",
    image: "Le Disparu.png",
    type: "card",
    powerUp: 6,
    powerLeft: 9,
    powerDown: 7,
    powerRight: 4,
    rarity: 4,
    prix: 80,
    description: ""
  },
  {
    nom: "Le Gourou",
    image: "Le Gourou.png",
    type: "card",
    powerUp: 9,
    powerLeft: 8,
    powerDown: 6,
    powerRight: 2,
    rarity: 4,
    prix: 80,
    description: ""
  },
  {
    nom: "Le Maître du BBQ",
    image: "Le Maître du BBQ.png",
    type: "card",
    powerUp: 8,
    powerLeft: 2,
    powerDown: 9,
    powerRight: 6,
    rarity: 4,
    prix: 80,
    description: ""
  },
  {
    nom: "Le Ravagé",
    image: "Le Ravagé.png",
    type: "card",
    powerUp: 5,
    powerLeft: 9,
    powerDown: 1,
    powerRight: 9,
    rarity: 4,
    prix: 80,
    description: ""
  },
  {
    nom: "Le Russkof",
    image: "Le Russkof.png",
    type: "card",
    powerUp: 9,
    powerLeft: 9,
    powerDown: 5,
    powerRight: 2,
    rarity: 4,
    prix: 80,
    description: ""
  },
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
      prix:10,
      is_echangeable: true,
      rarityChances: {
        oneStar: 0.8,
        twoStars: 0.2
      },
      // Vérifie bien que possibleCards contient des objets complets (avec nom, image, rarity, etc)
      possibleCards: [...oneStarCardsFull, ...twoStarCardsFull],
      description: "Un booster contenant 5 de faible niveau"
    };

    const booster2 = {
      nom: "Booster Argent",
      image: "boosterArgent.png",
      type: "booster",
      cardCount: 5,
        prix:50,
      is_echangeable: true,
      rarityChances: {
        twoStars: 0.8,
        threeStars: 0.2
      },
      possibleCards: [...twoStarCardsFull, ...threeStarCardsFull],
      description: "Un booster Argent contenant 5 cartes de niveau correct."
    };
      const booster3 = {
      nom: "Booster Or",
      image: "boosterOr.png",
      type: "booster",
      cardCount: 5,
      prix:250,
      is_echangeable: true,
      rarityChances: {
        threeStars: 0.8,
        fourStars: 0.2
      },
      possibleCards: [...threeStarCardsFull, ...fourStarCardsFull],
      description: "Un booster Or contenant 5 cartes de bon niveau"
    };
    const booster4 = {
      nom: "Booster Premium",
      image: "boosterP.png",
      type: "booster",
      cardCount: 3,
      prix:1000,
      is_echangeable: true,   
      rarityChances: {
        oneStar: 0.1,
        twoStars: 0.1,
        threeStars: 0.1,
        fourStars: 0.7
      },
      possibleCards: [...oneStarCardsFull, ...twoStarCardsFull, ...threeStarCardsFull, ...fourStarCardsFull],
      description: "Un booster Premium, un vrai scam"
    };

    // Ajouter les boosters à la liste des items
    items.push(booster1, booster2, booster3, booster4);

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
        player_id: insertedPlayers.insertedIds[0], // Mehdi
        item_id: insertedItems.insertedIds[items.length-4], // Booster Bronze
        quantité: 3,
      },
      {
        player_id: insertedPlayers.insertedIds[0], // Mehdi
        item_id: insertedItems.insertedIds[items.length - 3], // Booster Bronze
        quantité: 3,
      },
      {
        player_id: insertedPlayers.insertedIds[0], // Mehdi
        item_id: insertedItems.insertedIds[items.length - 2], // Booster Bronze
        quantité: 3,
      },
      {
        player_id: insertedPlayers.insertedIds[0], // Mehdi
        item_id: insertedItems.insertedIds[items.length - 1], // Booster Bronze
        quantité: 3,
      },
      {
        player_id: insertedPlayers.insertedIds[1], // Arthur
        item_id: insertedItems.insertedIds[items.length - 2], // Booster Bronze
        quantité: 3,
      },
      {
        player_id: insertedPlayers.insertedIds[2], // Marie
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
        item_id: insertedItems.insertedIds[items.length - 4], // Booster Bronze
        action_name: "Ouvrir",
        action_type: "open_scene",
        parameters: {
          scene: "BoosterOpeningScene"
        }
      },
      {
        item_id: insertedItems.insertedIds[items.length - 3], // Booster Argent
        action_name: "Ouvrir",
        action_type: "open_scene",
        parameters: {
          scene: "BoosterOpeningScene"
        }
      },
      {
        item_id: insertedItems.insertedIds[items.length - 2], // Booster Argent
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
    const photosCollection = db.collection("photos");
    await photosCollection.deleteMany({});
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