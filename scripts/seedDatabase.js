const { MongoClient, ObjectId } = require("mongodb");

const fs = require("fs");
const path = require("path");

// Fonction pour charger les données JSON
function loadJsonData(filename) {
    try {
        const filePath = path.join(__dirname, filename);
        const rawData = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(rawData);
    } catch (error) {
        console.error(`Erreur lors du chargement de ${filename}:`, error.message);
        throw error;
    }
}

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
            { pseudo: "Admin", dailyTeam: "1", dailyScore: 10, totalScore: 1000, posX: 38* 48+21, posY: 73* 48+24, mapId: 7, isActif: false, updatedAt: new Date() },
            { pseudo: "Arthur", dailyTeam: "2", dailyScore: 15, totalScore: 0, posX: 2424.0, posY: 360.0, mapId: 2,isActif:true, updatedAt: new Date() },
            { pseudo: "Marie", dailyTeam: "2", dailyScore: 15, totalScore: 0, posX: 2424.0, posY: 360.0, mapId: 2,isActif:true, updatedAt: new Date() },
            { pseudo: "Marin", dailyTeam: "2", dailyScore: 15, totalScore: 0, posX: 2424.0, posY: 360.0, mapId: 2,isActif:false, updatedAt: new Date() },
            { pseudo: "Jo", dailyTeam: "2", dailyScore: 15, totalScore: 0, posX: 2424.0, posY: 360.0, mapId: 2,isActif:true, updatedAt: new Date() },
            { pseudo: "Soso", dailyTeam: "2", dailyScore: 15, totalScore: 0, posX: 2424.0, posY: 360.0, mapId: 2,isActif:true, updatedAt: new Date() },
            { pseudo: "Caro", dailyTeam: "2", dailyScore: 15, totalScore: 0, posX: 2424.0, posY: 360.0, mapId: 2,isActif:true, updatedAt: new Date() },
            { pseudo: "Steven", dailyTeam: "2", dailyScore: 15, totalScore: 0, posX: 2424.0, posY: 360.0, mapId: 2,isActif:true, updatedAt: new Date() },
            { pseudo: "Ulrich", dailyTeam: "2", dailyScore: 15, totalScore: 0, posX: 2424.0, posY: 360.0, mapId: 2,isActif:true, updatedAt: new Date() },
            { pseudo: "Morgan", dailyTeam: "2", dailyScore: 15, totalScore: 0, posX: 2424.0, posY: 360.0, mapId: 2,isActif:true, updatedAt: new Date() },
            { pseudo: "Romain", dailyTeam: "2", dailyScore: 15, totalScore: 0, posX: 2424.0, posY: 360.0, mapId: 2,isActif:true, updatedAt: new Date() },
            { pseudo: "Charlotte", dailyTeam: "2", dailyScore: 15, totalScore: 0, posX: 2424.0, posY: 360.0, mapId: 2, isActif: true, updatedAt: new Date() },
            { pseudo: "Nico", dailyTeam: "2", dailyScore: 15, totalScore: 0, posX: 2424.0, posY: 360.0, mapId: 2, isActif: true, updatedAt: new Date() },
            { pseudo: "Mehdi", dailyTeam: "1", dailyScore: 10, totalScore: 0, posX: 10 * 48 + 24, posY: 7 * 48 + 24, mapId: 6, isActif: true, updatedAt: new Date() },
            { pseudo: "Yorushima", dailyTeam: "1", dailyScore: 10, totalScore: 500, posX: 500.0, posY: 360.0, mapId: 2, isActif: true, updatedAt: new Date() }
        ];

        // Données pour la collection items (objets + cartes)
        //const items = loadJsonData("items.json");

        const items =
            [
                {
                    "nom": "Potion",
                    "image": "fc265.png",
                    "is_echangeable": true,
                    "prix": 10,
                    "type": "item"
                },
                {
                    "nom": "Épée",
                    "image": "fc1777.png",
                    "is_echangeable": false,
                    "prix": 50,
                    "type": "item"
                },
                {
                    "nom": "Clés de voiture",
                    "image": "fc75.png",
                    "is_echangeable": true,
                    "prix": 30,
                    "type": "key_items"
                },
                {
                    "nom": "Livre Rouge",
                    "image": "fc97.png",
                    "is_echangeable": true,
                    "prix": 40,
                    "type": "item"
                },
                {
                    "nom": "Super Potion",
                    "image": "super-potion.png",
                    "is_echangeable": true,
                    "prix": 700,
                    "type": "healing",
                    "description": "Rend 50 PV à un Pokémon."
                },
                {
                    "nom": "Poké Ball",
                    "image": "Poké Ball.png",
                    "is_echangeable": true,
                    "prix": 200,
                    "type": "pokeball",
                    "description": "Un objet pour capturer des Pokémon sauvages."
                },
                {
                    "nom": "Super Ball",
                    "image": "Super Ball.png",
                    "is_echangeable": true,
                    "prix": 600,
                    "type": "pokeball",
                    "description": "Une Ball plus performante que la Poké Ball."
                },
                {
                    "nom": "Antidote",
                    "image": "antidote.png",
                    "is_echangeable": true,
                    "prix": 100,
                    "type": "healing",
                    "description": "Soigne un Pokémon empoisonné."
                },
                {
                    "nom": "CT Tonnerre",
                    "image": "tm-electric.png",
                    "is_echangeable": true,
                    "prix": 3000,
                    "type": "tm_hm",
                    "description": "Apprend l'attaque Tonnerre à un Pokémon compatible."
                },
                {
                    "nom": "Floki",
                    "image": "Floki.png",
                    "is_echangeable": false,
                    "prix": 999,
                    "type": "item"
                },
                {
                    "nom": "Sirius",
                    "image": "Sirius.png",
                    "is_echangeable": false,
                    "prix": 999,
                    "type": "item"
                },
                {
                    "nom": "Gaara",
                    "image": "Gaara.png",
                    "is_echangeable": false,
                    "prix": 999,
                    "type": "item"
                },
                {
                    "nom": "L'alcoolique verte",
                    "image": "L'alcoolique verte.png",
                    "type": "card",
                    "powerUp": 7,
                    "powerLeft": 1,
                    "powerDown": 1,
                    "powerRight": 3,
                    "rarity": 1,
                    "prix": 20,
                    "description": ""
                },
                {
                    "nom": "L'alpiniste",
                    "image": "L'alpiniste.png",
                    "type": "card",
                    "powerUp": 6,
                    "powerLeft": 3,
                    "powerDown": 2,
                    "powerRight": 2,
                    "rarity": 1,
                    "prix": 20,
                    "description": ""
                },
                {
                    "nom": "L'apprentie Chatte",
                    "image": "L'apprentie Chatte.png",
                    "type": "card",
                    "powerUp": 5,
                    "powerLeft": 4,
                    "powerDown": 3,
                    "powerRight": 3,
                    "rarity": 1,
                    "prix": 20,
                    "description": ""
                },
                {
                    "nom": "L'auditrice",
                    "image": "L'auditrice.png",
                    "type": "card",
                    "powerUp": 6,
                    "powerLeft": 3,
                    "powerDown": 1,
                    "powerRight": 4,
                    "rarity": 1,
                    "prix": 20,
                    "description": ""
                },
                {
                    "nom": "L'aérobiqueuse",
                    "image": "L'aérobiqueuse.png",
                    "type": "card",
                    "powerUp": 3,
                    "powerLeft": 3,
                    "powerDown": 4,
                    "powerRight": 5,
                    "rarity": 1,
                    "prix": 20,
                    "description": ""
                },
                {
                    "nom": "La gloutonne",
                    "image": "La gloutonne.png",
                    "type": "card",
                    "powerUp": 5,
                    "powerLeft": 5,
                    "powerDown": 3,
                    "powerRight": 2,
                    "rarity": 1,
                    "prix": 20,
                    "description": ""
                },
                {
                    "nom": "La starac",
                    "image": "La starac.png",
                    "type": "card",
                    "powerUp": 5,
                    "powerLeft": 5,
                    "powerDown": 1,
                    "powerRight": 3,
                    "rarity": 1,
                    "prix": 20,
                    "description": ""
                },
                {
                    "nom": "Le Maître du Jeu",
                    "image": "Le Maître du Jeu.png",
                    "type": "card",
                    "powerUp": 5,
                    "powerLeft": 2,
                    "powerDown": 2,
                    "powerRight": 5,
                    "rarity": 1,
                    "prix": 20,
                    "description": ""
                },
                {
                    "nom": "Le mini dalleux",
                    "image": "Le mini dalleux.png",
                    "type": "card",
                    "powerUp": 4,
                    "powerLeft": 2,
                    "powerDown": 4,
                    "powerRight": 5,
                    "rarity": 1,
                    "prix": 20,
                    "description": ""
                },
                {
                    "nom": "Le pêcheur",
                    "image": "Le pêcheur.png",
                    "type": "card",
                    "powerUp": 3,
                    "powerLeft": 7,
                    "powerDown": 2,
                    "powerRight": 1,
                    "rarity": 1,
                    "prix": 20,
                    "description": ""
                },
                {
                    "nom": "Les stagiaires de droite",
                    "image": "Les stagiaires de droite.png",
                    "type": "card",
                    "powerUp": 5,
                    "powerLeft": 3,
                    "powerDown": 2,
                    "powerRight": 5,
                    "rarity": 1,
                    "prix": 20,
                    "description": ""
                },
                {
                    "nom": "L'appropriation culturelle",
                    "image": "L'appropriation culturelle.png",
                    "type": "card",
                    "powerUp": 2,
                    "powerLeft": 7,
                    "powerDown": 3,
                    "powerRight": 6,
                    "rarity": 2,
                    "prix": 40,
                    "description": ""
                },
                {
                    "nom": "L'innocent",
                    "image": "L'innocent.png",
                    "type": "card",
                    "powerUp": 6,
                    "powerLeft": 5,
                    "powerDown": 5,
                    "powerRight": 4,
                    "rarity": 2,
                    "prix": 40,
                    "description": ""
                },
                {
                    "nom": "La folle du village",
                    "image": "La folle du village.png",
                    "type": "card",
                    "powerUp": 4,
                    "powerLeft": 7,
                    "powerDown": 6,
                    "powerRight": 2,
                    "rarity": 2,
                    "prix": 40,
                    "description": ""
                },
                {
                    "nom": "La grosse carpe",
                    "image": "La grosse carpe.png",
                    "type": "card",
                    "powerUp": 2,
                    "powerLeft": 3,
                    "powerDown": 7,
                    "powerRight": 6,
                    "rarity": 2,
                    "prix": 40,
                    "description": ""
                },
                {
                    "nom": "Le fan de Chirac",
                    "image": "Le fan de Chirac.png",
                    "type": "card",
                    "powerUp": 1,
                    "powerLeft": 7,
                    "powerDown": 6,
                    "powerRight": 4,
                    "rarity": 2,
                    "prix": 40,
                    "description": ""
                },
                {
                    "nom": "Le guide",
                    "image": "Le guide.png",
                    "type": "card",
                    "powerUp": 7,
                    "powerLeft": 6,
                    "powerDown": 3,
                    "powerRight": 1,
                    "rarity": 2,
                    "prix": 40,
                    "description": ""
                },
                {
                    "nom": "Le jocat",
                    "image": "Le jocat.png",
                    "type": "card",
                    "powerUp": 7,
                    "powerLeft": 4,
                    "powerDown": 4,
                    "powerRight": 4,
                    "rarity": 2,
                    "prix": 40,
                    "description": ""
                },
                {
                    "nom": "Le queutard",
                    "image": "Le queutard.png",
                    "type": "card",
                    "powerUp": 3,
                    "powerLeft": 6,
                    "powerDown": 7,
                    "powerRight": 3,
                    "rarity": 2,
                    "prix": 40,
                    "description": ""
                },
                {
                    "nom": "le stalker",
                    "image": "le stalker.png",
                    "type": "card",
                    "powerUp": 6,
                    "powerLeft": 3,
                    "powerDown": 2,
                    "powerRight": 7,
                    "rarity": 2,
                    "prix": 40,
                    "description": ""
                },
                {
                    "nom": "Le touriste",
                    "image": "Le touriste.png",
                    "type": "card",
                    "powerUp": 4,
                    "powerLeft": 6,
                    "powerDown": 5,
                    "powerRight": 5,
                    "rarity": 2,
                    "prix": 40,
                    "description": ""
                },
                {
                    "nom": "La musicos",
                    "image": "La musicos.png",
                    "type": "card",
                    "powerUp": 7,
                    "powerLeft": 3,
                    "powerDown": 5,
                    "powerRight": 4,
                    "rarity": 2,
                    "prix": 40,
                    "description": ""
                },
                {
                    "nom": "L'apprenti Pirate",
                    "image": "L'apprenti Pirate.png",
                    "type": "card",
                    "powerUp": 2,
                    "powerLeft": 4,
                    "powerDown": 8,
                    "powerRight": 8,
                    "rarity": 3,
                    "prix": 60,
                    "description": ""
                },
                {
                    "nom": "L'invitation",
                    "image": "L'invitation.png",
                    "type": "card",
                    "powerUp": 7,
                    "powerLeft": 4,
                    "powerDown": 8,
                    "powerRight": 3,
                    "rarity": 3,
                    "prix": 60,
                    "description": ""
                },
                {
                    "nom": "La barmaid",
                    "image": "La barmaid.png",
                    "type": "card",
                    "powerUp": 4,
                    "powerLeft": 3,
                    "powerDown": 8,
                    "powerRight": 7,
                    "rarity": 3,
                    "prix": 60,
                    "description": ""
                },
                {
                    "nom": "La belle bite",
                    "image": "La belle bite.png",
                    "type": "card",
                    "powerUp": 7,
                    "powerLeft": 5,
                    "powerDown": 2,
                    "powerRight": 8,
                    "rarity": 3,
                    "prix": 60,
                    "description": ""
                },
                {
                    "nom": "La cb perdue",
                    "image": "La cb perdue.png",
                    "type": "card",
                    "powerUp": 1,
                    "powerLeft": 3,
                    "powerDown": 8,
                    "powerRight": 8,
                    "rarity": 3,
                    "prix": 60,
                    "description": ""
                },
                {
                    "nom": "La double binche",
                    "image": "La double binche.png",
                    "type": "card",
                    "powerUp": 8,
                    "powerLeft": 2,
                    "powerDown": 2,
                    "powerRight": 8,
                    "rarity": 3,
                    "prix": 60,
                    "description": ""
                },
                {
                    "nom": "La dépravé",
                    "image": "La dépravé.png",
                    "type": "card",
                    "powerUp": 6,
                    "powerLeft": 5,
                    "powerDown": 8,
                    "powerRight": 4,
                    "rarity": 3,
                    "prix": 60,
                    "description": ""
                },
                {
                    "nom": "Le fan d'histoire",
                    "image": "Le fan d'histoire.png",
                    "type": "card",
                    "powerUp": 4,
                    "powerLeft": 6,
                    "powerDown": 8,
                    "powerRight": 5,
                    "rarity": 3,
                    "prix": 60,
                    "description": ""
                },
                {
                    "nom": "Le quota de gay",
                    "image": "Le quota de gay.png",
                    "type": "card",
                    "powerUp": 1,
                    "powerLeft": 8,
                    "powerDown": 8,
                    "powerRight": 4,
                    "rarity": 3,
                    "prix": 60,
                    "description": ""
                },
                {
                    "nom": "Les campeurs du dimanche",
                    "image": "Les campeurs du dimanche.png",
                    "type": "card",
                    "powerUp": 6,
                    "powerLeft": 4,
                    "powerDown": 5,
                    "powerRight": 8,
                    "rarity": 3,
                    "prix": 60,
                    "description": ""
                },
                {
                    "nom": "Les ginyus eco+",
                    "image": "Les ginyus eco+.png",
                    "type": "card",
                    "powerUp": 7,
                    "powerLeft": 1,
                    "powerDown": 5,
                    "powerRight": 8,
                    "rarity": 3,
                    "prix": 60,
                    "description": ""
                },
                {
                    "nom": "L'allumeuse",
                    "image": "L'allumeuse.png",
                    "type": "card",
                    "powerUp": 4,
                    "powerLeft": 9,
                    "powerDown": 4,
                    "powerRight": 8,
                    "rarity": 4,
                    "prix": 80,
                    "description": ""
                },
                {
                    "nom": "L'iron Punk",
                    "image": "L'iron Punk.png",
                    "type": "card",
                    "powerUp": 9,
                    "powerLeft": 3,
                    "powerDown": 6,
                    "powerRight": 7,
                    "rarity": 4,
                    "prix": 80,
                    "description": ""
                },
                {
                    "nom": "la Pirate",
                    "image": "la Pirate.png",
                    "type": "card",
                    "powerUp": 3,
                    "powerLeft": 6,
                    "powerDown": 7,
                    "powerRight": 9,
                    "rarity": 4,
                    "prix": 80,
                    "description": ""
                },
                {
                    "nom": "La pochtronne",
                    "image": "La pochtronne.png",
                    "type": "card",
                    "powerUp": 9,
                    "powerLeft": 2,
                    "powerDown": 3,
                    "powerRight": 9,
                    "rarity": 4,
                    "prix": 80,
                    "description": ""
                },
                {
                    "nom": "Le Bibliothécaire",
                    "image": "Le Bibliothécaire.png",
                    "type": "card",
                    "powerUp": 9,
                    "powerLeft": 4,
                    "powerDown": 4,
                    "powerRight": 8,
                    "rarity": 4,
                    "prix": 80,
                    "description": ""
                },
                {
                    "nom": "Le condamné à mort",
                    "image": "Le condamné à mort.png",
                    "type": "card",
                    "powerUp": 2,
                    "powerLeft": 4,
                    "powerDown": 9,
                    "powerRight": 9,
                    "rarity": 4,
                    "prix": 80,
                    "description": ""
                },
                {
                    "nom": "Le Disparu",
                    "image": "Le Disparu.png",
                    "type": "card",
                    "powerUp": 6,
                    "powerLeft": 9,
                    "powerDown": 7,
                    "powerRight": 4,
                    "rarity": 4,
                    "prix": 80,
                    "description": ""
                },
                {
                    "nom": "Le Gourou",
                    "image": "Le Gourou.png",
                    "type": "card",
                    "powerUp": 9,
                    "powerLeft": 8,
                    "powerDown": 6,
                    "powerRight": 2,
                    "rarity": 4,
                    "prix": 80,
                    "description": ""
                },
                {
                    "nom": "Le Maître du BBQ",
                    "image": "Le Maître du BBQ.png",
                    "type": "card",
                    "powerUp": 8,
                    "powerLeft": 2,
                    "powerDown": 9,
                    "powerRight": 6,
                    "rarity": 4,
                    "prix": 80,
                    "description": ""
                },
                {
                    "nom": "Le Ravagé",
                    "image": "Le Ravagé.png",
                    "type": "card",
                    "powerUp": 5,
                    "powerLeft": 9,
                    "powerDown": 1,
                    "powerRight": 9,
                    "rarity": 4,
                    "prix": 80,
                    "description": ""
                },
                {
                    "nom": "Le Russkof",
                    "image": "Le Russkof.png",
                    "type": "card",
                    "powerUp": 9,
                    "powerLeft": 9,
                    "powerDown": 5,
                    "powerRight": 2,
                    "rarity": 4,
                    "prix": 80,
                    "description": ""
                }
            ];

        // Générer la liste des cartes de rarity 1 et 2 (objets complets, pas juste les noms)
        const oneStarCardsFull = items.filter(i => i.type === "card" && i.rarity === 1);
        const twoStarCardsFull = items.filter(i => i.type === "card" && i.rarity === 2);
        const threeStarCardsFull = items.filter(i => i.type === "card" && i.rarity === 3);
        const fourStarCardsFull = items.filter(i => i.type === "card" && i.rarity === 4);

        // Créer deux boosters avec toutes les cartes 1 et 2 étoiles (objets complets)
        const booster1 = {
            nom: "Booster simple",
            image: "boosterPack.png",
            type: "booster",
            cardCount: 5,
            prix: 15,
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
            prix: 30,
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
            prix: 50,
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
            prix: 100,
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
            // Items pour Marin (index 3)
            {
                player_id: insertedPlayers.insertedIds[3],
                item_id: insertedItems.insertedIds[9], // Floki
                quantité: 1,
            },
            {
                player_id: insertedPlayers.insertedIds[3],
                item_id: insertedItems.insertedIds[10], // Sirius
                quantité: 1,
            },
            {
                player_id: insertedPlayers.insertedIds[3],
                item_id: insertedItems.insertedIds[11], // Gaara
                quantité: 1,
            },
            // Nouveaux items pour Marin (x10)
            {
                player_id: insertedPlayers.insertedIds[3],
                item_id: insertedItems.insertedIds[4], // Super Potion
                quantité: 10,
            },
            {
                player_id: insertedPlayers.insertedIds[14],
                item_id: insertedItems.insertedIds[5], // Poké Ball
                quantité: 10,
            },
                        {
                player_id: insertedPlayers.insertedIds[14],
                item_id: insertedItems.insertedIds[6], // Poké Ball
                quantité: 10,
            },
                       {
                player_id: insertedPlayers.insertedIds[3],
                item_id: insertedItems.insertedIds[5], // Super Ball
                quantité: 10,
            },
            {
                player_id: insertedPlayers.insertedIds[3],
                item_id: insertedItems.insertedIds[6], // Super Ball
                quantité: 10,
            },
            {
                player_id: insertedPlayers.insertedIds[3],
                item_id: insertedItems.insertedIds[7], // Antidote
                quantité: 10,
            },
            {
                player_id: insertedPlayers.insertedIds[3],
                item_id: insertedItems.insertedIds[8], // CT Tonnerre
                quantité: 10,
            },
            {
                player_id: insertedPlayers.insertedIds[3], // Marin
                item_id: insertedItems.insertedIds[items.length - 2], // Booster Bronze
                quantité: 3,
            },
            {
                player_id: insertedPlayers.insertedIds[0], // Mehdi
                item_id: insertedItems.insertedIds[items.length - 4], // Booster Bronze
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
                parameters: { amount: 20 },
            },
            {
                item_id: insertedItems.insertedIds[4], // Super Potion
                action_name: "Utiliser",
                action_type: "heal",
                parameters: { amount: 50 },
            },
            {
                item_id: insertedItems.insertedIds[7], // Antidote
                action_name: "Utiliser",
                action_type: "heal_status",
                parameters: { status: "poison" },
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
                item_id: insertedItems.insertedIds[9], // Floki
                action_name: "Caresser",
                action_type: "pet",
                parameters: { lore: "Ancien secrets Il vous regarde plein d'amour." },
            },
            {
                item_id: insertedItems.insertedIds[10], // Sirius
                action_name: "Caresser",
                action_type: "pet",
                parameters: { lore: "Il vous regarde plein d'amour." },
            },
            {
                item_id: insertedItems.insertedIds[11], // Gaara
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
                properties: { name: "Vieux Sage", dialogue: "Bienvenue à Oppède, Jeuxne aventurier !" },
                state: { hasSpoken: false }
            },
            {
                type: "npc",
                mapKey: "map3",
                x: 216,
                y: 744,
                properties: { name: "Vieux Sage", dialogue: "Bienvenue à Oppède, Jeuxne aventurier !" },
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

        console.log("Chargement des questions de quiz depuis les fichiers séparés...");

        // Charger toutes les catégories de quiz
        const quizHistoire = loadJsonData("quizHistoire.json");
        const quizGeographie = loadJsonData("quizGeographie.json");
        const quizArt = loadJsonData("quizArt.json");
        const quizScience = loadJsonData("quizScience.json");
        const quizSport = loadJsonData("quizSport.json");
        const quizJeuxVideo = loadJsonData("quizJeuxVideo.json");

        // Fusionner toutes les questions dans un seul tableau
        const quizQuestions = [
            ...quizHistoire,
            ...quizGeographie,
            ...quizArt,
            ...quizScience,
            ...quizSport,
            ...quizJeuxVideo
        ];

        console.log("📋 Questions chargées par catégorie :");
        console.log(`   - Histoire: ${quizHistoire.length} questions`);
        console.log(`   - Géographie: ${quizGeographie.length} questions`);
        console.log(`   - Art & Littérature: ${quizArt.length} questions`);
        console.log(`   - Science et Nature: ${quizScience.length} questions`);
        console.log(`   - Sport: ${quizSport.length} questions`);
        console.log(`   - Jeux Vidéo: ${quizJeuxVideo.length} questions`);
        console.log(`   - TOTAL: ${quizQuestions.length} questions`);
        const quizQuestionsCollection = db.collection("quizQuestions");
        await quizQuestionsCollection.deleteMany({});
        await quizQuestionsCollection.insertMany(quizQuestions);
        console.log(`Collection 'quizQuestions' alimentée avec succès (${quizQuestions.length} questions)`);

        console.log("🎉 Toutes les collections ont été alimentées avec succès !");
        console.log("📊 Résumé:");
        console.log(`   - ${players.length} joueurs`);
        console.log(`   - ${items.length} items (dont ${items.filter(i => i.type === 'card').length} cartes et ${items.filter(i => i.type === 'booster').length} boosters)`);
        console.log(`   - ${inventory.length} entrées d'inventaire`);
        console.log(`   - ${itemActions.length} actions d'items`);
        console.log(`   - ${worldEvents.length} événements du monde`);
        console.log(`   - ${quizQuestions.length} questions de quiz`);
        } catch (error) {
        console.error(`Erreur lors de l'alimentation de la bdd :`, error.message);
        throw error;
    }

}

// Exécuter le script
if (require.main === module) {
    seedDatabase()
        .then(() => {
            console.log("✅ Script de seed terminé avec succès");
            process.exit(0);
        })
        .catch((error) => {
            console.error("❌ Erreur lors de l'exécution du script de seed:", error);
            process.exit(1);
        });
}

module.exports = { seedDatabase, loadJsonData };