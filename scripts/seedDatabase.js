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
            { pseudo: "Mehdi", dailyTeam: "1", dailyScore: 10, totalScore: 100, posX: 500.0, posY: 360.0, mapId: 2, updatedAt: new Date() },
            { pseudo: "Arthur", dailyTeam: "2", dailyScore: 15, totalScore: 120, posX: 2424.0, posY: 360.0, mapId: 2, updatedAt: new Date() },
            { pseudo: "Marie", dailyTeam: "2", dailyScore: 15, totalScore: 120, posX: 2424.0, posY: 360.0, mapId: 2, updatedAt: new Date() },
            { pseudo: "Marin", dailyTeam: "2", dailyScore: 15, totalScore: 120, posX: 2424.0, posY: 360.0, mapId: 2, updatedAt: new Date() }
        ];

        // Données pour la collection items (objets + cartes)
        const items = loadJsonData("items.json");

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
            prix: 10,
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
            prix: 50,
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
            prix: 250,
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
            prix: 1000,
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

        console.log("Chargement des questions de quiz depuis les fichiers séparés...");

        // Charger toutes les catégories de quiz
        const quizHistoire = loadJsonData("quizHistoire.json");
        const quizGeographie = loadJsonData("quizGeographie.json");
        const quizArt = loadJsonData("quizArt.json");
        const quizScience = loadJsonData("quizScience.json");
        const quizSport = loadJsonData("quizSport.json");
        const quizJeuVideo = loadJsonData("quizJeuVideo.json");

        // Fusionner toutes les questions dans un seul tableau
        const quizQuestions = [
            ...quizHistoire,
            ...quizGeographie,
            ...quizArt,
            ...quizScience,
            ...quizSport,
            ...quizJeuVideo
        ];

        console.log("📋 Questions chargées par catégorie :");
        console.log(`   - Histoire: ${quizHistoire.length} questions`);
        console.log(`   - Géographie: ${quizGeographie.length} questions`);
        console.log(`   - Art & Littérature: ${quizArt.length} questions`);
        console.log(`   - Science et Nature: ${quizScience.length} questions`);
        console.log(`   - Sport: ${quizSport.length} questions`);
        console.log(`   - Jeu Vidéo: ${quizJeuVideo.length} questions`);
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