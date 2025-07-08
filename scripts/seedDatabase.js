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

    // **1. SEED DES QUESTIONS DE QUIZ**
    const quizQuestions = [
      // ===== HISTOIRE =====
      {
          question: "En quelle année a eu lieu la Révolution française ?",
          answers: ["1789", "1792", "1776", "1804"],
          correct: 0,
          category: "Histoire",
          difficulty: "facile"
      },
      {
          question: "Qui était le premier empereur romain ?",
          answers: ["Jules César", "Auguste", "Néron", "Trajan"],
          correct: 1,
          category: "Histoire",
          difficulty: "moyen"
      },
      {
          question: "Quelle bataille a marqué la fin de l'Empire napoléonien ?",
          answers: ["Austerlitz", "Waterloo", "Iéna", "Wagram"],
          correct: 1,
          category: "Histoire",
          difficulty: "moyen"
      },
      {
          question: "En quelle année a commencé la Première Guerre mondiale ?",
          answers: ["1912", "1913", "1914", "1915"],
          correct: 2,
          category: "Histoire",
          difficulty: "facile"
      },
      {
          question: "Quel pharaon a fait construire la Grande Pyramide de Gizeh ?",
          answers: ["Khéops", "Khéphren", "Mykérinos", "Ramsès II"],
          correct: 0,
          category: "Histoire",
          difficulty: "difficile"
      },
      {
          question: "Quelle civilisation a inventé l'écriture cunéiforme ?",
          answers: ["Égyptiens", "Grecs", "Sumériens", "Phéniciens"],
          correct: 2,
          category: "Histoire",
          difficulty: "difficile"
      },
      {
          question: "En quelle année l'homme a-t-il marché sur la Lune pour la première fois ?",
          answers: ["1967", "1968", "1969", "1970"],
          correct: 2,
          category: "Histoire",
          difficulty: "facile"
      },
      {
          question: "Qui a unifié l'Allemagne au XIXe siècle ?",
          answers: ["Bismarck", "Guillaume Ier", "François-Joseph", "Metternich"],
          correct: 0,
          category: "Histoire",
          difficulty: "moyen"
      },

      // ===== GÉOGRAPHIE =====
      {
          question: "Quelle est la capitale de l'Australie ?",
          answers: ["Sydney", "Melbourne", "Canberra", "Perth"],
          correct: 2,
          category: "Géographie",
          difficulty: "moyen"
      },
      {
          question: "Quel est le plus grand désert du monde ?",
          answers: ["Sahara", "Gobi", "Antarctique", "Kalahari"],
          correct: 2,
          category: "Géographie",
          difficulty: "difficile"
      },
      {
          question: "Combien y a-t-il de continents ?",
          answers: ["5", "6", "7", "8"],
          correct: 2,
          category: "Géographie",
          difficulty: "facile"
      },
      {
          question: "Quel fleuve traverse Paris ?",
          answers: ["La Loire", "La Seine", "Le Rhône", "La Garonne"],
          correct: 1,
          category: "Géographie",
          difficulty: "facile"
      },
      {
          question: "Quelle chaîne de montagnes sépare l'Europe de l'Asie ?",
          answers: ["Les Alpes", "L'Himalaya", "L'Oural", "Le Caucase"],
          correct: 2,
          category: "Géographie",
          difficulty: "moyen"
      },
      {
          question: "Quel pays a le plus de fuseaux horaires ?",
          answers: ["Russie", "États-Unis", "Chine", "Canada"],
          correct: 0,
          category: "Géographie",
          difficulty: "difficile"
      },
      {
          question: "Quelle est la capitale du Canada ?",
          answers: ["Toronto", "Vancouver", "Montréal", "Ottawa"],
          correct: 3,
          category: "Géographie",
          difficulty: "moyen"
      },
      {
          question: "Quel océan borde la côte ouest de l'Afrique ?",
          answers: ["Atlantique", "Indien", "Pacifique", "Arctique"],
          correct: 0,
          category: "Géographie",
          difficulty: "facile"
      },

      // ===== ART & LITTÉRATURE =====
      {
          question: "Qui a peint 'La Joconde' ?",
          answers: ["Picasso", "Van Gogh", "Léonard de Vinci", "Monet"],
          correct: 2,
          category: "Art & Littérature",
          difficulty: "facile"
      },
      {
          question: "Qui a écrit 'Les Misérables' ?",
          answers: ["Émile Zola", "Victor Hugo", "Gustave Flaubert", "Honoré de Balzac"],
          correct: 1,
          category: "Art & Littérature",
          difficulty: "facile"
      },
      {
          question: "Quel mouvement artistique Picasso a-t-il co-fondé ?",
          answers: ["Impressionnisme", "Surréalisme", "Cubisme", "Fauvisme"],
          correct: 2,
          category: "Art & Littérature",
          difficulty: "moyen"
      },
      {
          question: "Qui a composé 'La 9ème Symphonie' ?",
          answers: ["Mozart", "Bach", "Beethoven", "Vivaldi"],
          correct: 2,
          category: "Art & Littérature",
          difficulty: "moyen"
      },
      {
          question: "Dans quel musée se trouve la Vénus de Milo ?",
          answers: ["Musée d'Orsay", "Louvre", "Musée Rodin", "Centre Pompidou"],
          correct: 1,
          category: "Art & Littérature",
          difficulty: "difficile"
      },
      {
          question: "Qui a écrit 'Hamlet' ?",
          answers: ["Charles Dickens", "William Shakespeare", "Oscar Wilde", "George Orwell"],
          correct: 1,
          category: "Art & Littérature",
          difficulty: "facile"
      },
      {
          question: "Quel peintre a coupé son oreille ?",
          answers: ["Picasso", "Van Gogh", "Monet", "Renoir"],
          correct: 1,
          category: "Art & Littérature",
          difficulty: "moyen"
      },
      {
          question: "Qui a écrit '1984' ?",
          answers: ["Aldous Huxley", "Ray Bradbury", "George Orwell", "Isaac Asimov"],
          correct: 2,
          category: "Art & Littérature",
          difficulty: "moyen"
      },

      // ===== SCIENCE ET NATURE =====
      {
          question: "Quel est l'élément chimique avec le symbole 'Au' ?",
          answers: ["Argent", "Or", "Aluminium", "Arsenic"],
          correct: 1,
          category: "Science et Nature",
          difficulty: "moyen"
      },
      {
          question: "Combien d'os y a-t-il dans le corps humain adulte ?",
          answers: ["206", "208", "210", "212"],
          correct: 0,
          category: "Science et Nature",
          difficulty: "difficile"
      },
      {
          question: "Quelle planète est la plus proche du Soleil ?",
          answers: ["Vénus", "Terre", "Mercure", "Mars"],
          correct: 2,
          category: "Science et Nature",
          difficulty: "facile"
      },
      {
          question: "Quelle est la vitesse de la lumière ?",
          answers: ["300 000 km/s", "150 000 km/s", "450 000 km/s", "600 000 km/s"],
          correct: 0,
          category: "Science et Nature",
          difficulty: "moyen"
      },
      {
          question: "Quel gaz représente environ 78% de l'atmosphère terrestre ?",
          answers: ["Oxygène", "Azote", "Dioxyde de carbone", "Argon"],
          correct: 1,
          category: "Science et Nature",
          difficulty: "moyen"
      },
      {
          question: "Combien de cœurs a une pieuvre ?",
          answers: ["1", "2", "3", "4"],
          correct: 2,
          category: "Science et Nature",
          difficulty: "difficile"
      },
      {
          question: "Quel scientifique a développé la théorie de l'évolution ?",
          answers: ["Newton", "Einstein", "Darwin", "Galilée"],
          correct: 2,
          category: "Science et Nature",
          difficulty: "facile"
      },
      {
          question: "Quelle est l'unité de mesure de la force ?",
          answers: ["Joule", "Watt", "Newton", "Pascal"],
          correct: 2,
          category: "Science et Nature",
          difficulty: "moyen"
      },

      // ===== SPORT =====
      {
          question: "Combien de joueurs y a-t-il dans une équipe de football ?",
          answers: ["10", "11", "12", "13"],
          correct: 1,
          category: "Sport",
          difficulty: "facile"
      },
      {
          question: "En quelle année ont eu lieu les premiers Jeux Olympiques modernes ?",
          answers: ["1892", "1894", "1896", "1898"],
          correct: 2,
          category: "Sport",
          difficulty: "moyen"
      },
      {
          question: "Quel pays a remporté la Coupe du Monde de football 2018 ?",
          answers: ["Brésil", "Allemagne", "France", "Argentine"],
          correct: 2,
          category: "Sport",
          difficulty: "facile"
      },
      {
          question: "Combien de sets faut-il gagner pour remporter un match de tennis masculin en Grand Chelem ?",
          answers: ["2", "3", "4", "5"],
          correct: 1,
          category: "Sport",
          difficulty: "moyen"
      },
      {
          question: "Quel sport pratique-t-on à Wimbledon ?",
          answers: ["Golf", "Tennis", "Cricket", "Rugby"],
          correct: 1,
          category: "Sport",
          difficulty: "facile"
      },
      {
          question: "Qui détient le record du monde du 100m masculin ?",
          answers: ["Carl Lewis", "Usain Bolt", "Justin Gat