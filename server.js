console.log('NODE_ENV:', process.env.NODE_ENV);
if (process.env.NODE_ENV === 'production') {
    require('dotenv').config({ path: '.env.production' });
} else {
    require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const bodyParser = require('body-parser');

// Import des managers
const DatabaseManager = require('./managers/DatabaseManager');
const PlayerManager = require('./managers/PlayerManager');
const QuizManager = require('./managers/QuizManager');
const TripleTriadManager = require('./managers/TripleTriadManager');
const PhotoManager = require('./managers/PhotoManager');
const SocketManager = require('./managers/SocketManager');
const PokemonDatabaseManager = require('./managers/PokemonDatabaseManager');
const PokemonBattleManager = require('./managers/PokemonBattleManager');
const PokemonEvolutionManager = require('./managers/PokemonEvolutionManager'); // 🆕 Import EvolutionManager
const TranslationManager = require('./managers/TranslationManager');
const ItemManager = require('./managers/ItemManager'); // 🆕 Import ItemManager
const QuestManager = require('./managers/QuestManager'); // 🆕 Import QuestManager


const PORT = process.env.BACKEND_PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Configuration CORS
const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            "https://warband.fr",
            "https://www.warband.fr",
        ];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    methods: ["GET", "POST", "DELETE"],
    credentials: true,
};

class Server {
    constructor() {
        this.app = express();
        this.server = null;
        this.managers = {};
    }

    async initialize() {
        console.log('🚀 Initialisation du serveur...');

        // Configuration Express
        this.setupExpress();

        // Création du serveur HTTP/HTTPS
        this.createServer();

        // Initialisation des managers
        await this.initializeManagers();

        // Configuration des routes
        this.setupRoutes();

        // Configuration Socket.IO
        this.setupSocket();

        // Démarrage du serveur
        this.start();
    }

    setupExpress() {

        this.app.use(cors(corsOptions));
        this.app.use(bodyParser.json());
        this.app.use('/public', cors(corsOptions), express.static('public'));
    }

    createServer() {
        if (isProduction) {
            try {
                const sslOptions = {
                    key: fs.readFileSync('/etc/letsencrypt/live/warband.fr/privkey.pem'),
                    cert: fs.readFileSync('/etc/letsencrypt/live/warband.fr/fullchain.pem'),
                };
                this.server = https.createServer(sslOptions, this.app);
                console.log('✅ Mode production avec HTTPS');
            } catch (error) {
                console.warn('⚠️ Certificats SSL non trouvés, fallback HTTP');
                this.server = http.createServer(this.app);
            }
        } else {
            this.server = http.createServer(this.app);
            console.log('✅ Mode développement avec HTTP');
        }
    }

    async initializeManagers() {
        console.log('📦 Initialisation des managers...');

        try {
            // DatabaseManager - connecte à MongoDB
            this.managers.databaseManager = new DatabaseManager();
            await this.managers.databaseManager.initialize();
            console.log('✅ DatabaseManager initialisé');

            // SocketManager - configure Socket.IO
            this.managers.socketManager = new SocketManager(this.server, corsOptions);
            const io = this.managers.socketManager.getIo();
            console.log('✅ SocketManager initialisé');

            // PlayerManager - gère joueurs et chat
            this.managers.playerManager = new PlayerManager(io, this.managers.databaseManager);
            console.log('✅ PlayerManager initialisé');

            // QuizManager - système de quiz
            this.managers.quizManager = new QuizManager(io, this.managers.databaseManager);
            console.log('✅ QuizManager initialisé');

            // TripleTriadManager - Jeux de cartes
            this.managers.tripleTriadManager = new TripleTriadManager(io,this.managers.databaseManager);
            console.log('✅ TripleTriadManager initialisé');

            // PhotoManager - galerie photos
            this.managers.photoManager = new PhotoManager(this.managers.databaseManager);
            console.log('✅ PhotoManager initialisé');

            // PokemonDatabaseManager - gestion Pokémon
            this.managers.pokemonDatabaseManager = new PokemonDatabaseManager(this.managers.databaseManager);
            await this.managers.pokemonDatabaseManager.initialize();
            console.log('✅ PokemonDatabaseManager initialisé');

            // PokemonBattleManager - système de combat
            this.managers.pokemonBattleManager = new PokemonBattleManager(this.managers.databaseManager);
            console.log('✅ PokemonBattleManager initialisé');
            // Exposer TranslationManager aux managers nécessitant les traductions FR
            if (this.managers.translationManager) {
                this.managers.pokemonBattleManager.translationManager = this.managers.translationManager;
                this.managers.pokemonDatabaseManager.translationManager = this.managers.translationManager;
            }
            // Rendre PokemonDatabaseManager accessible au manager de combat pour utilitaires
            this.managers.pokemonBattleManager.pokemonDatabaseManager = this.managers.pokemonDatabaseManager;

            // PokemonEvolutionManager - gestion évolutions
            this.managers.pokemonEvolutionManager = new PokemonEvolutionManager(this.managers.databaseManager);
            console.log('✅ PokemonEvolutionManager initialisé');

            // TranslationManager - traductions FR Pokémon/Moves
            this.managers.translationManager = new TranslationManager(this.managers.databaseManager);
            await this.managers.translationManager.initialize();
            console.log('✅ TranslationManager initialisé');

            // Ré-declarer références de TranslationManager sur les managers déjà créés
            if (this.managers.pokemonBattleManager) {
                this.managers.pokemonBattleManager.translationManager = this.managers.translationManager;
            }
            if (this.managers.pokemonDatabaseManager) {
                this.managers.pokemonDatabaseManager.translationManager = this.managers.translationManager;
            }

            // ItemManager - gestion des objets et seeding
            this.managers.itemManager = new ItemManager(
                this.managers.databaseManager, 
                this.managers.pokemonEvolutionManager,
                this.managers.pokemonDatabaseManager
            );
            await this.managers.itemManager.initialize();
            console.log('✅ ItemManager initialisé');

            // QuestManager - gestion des quêtes
            this.managers.questManager = new QuestManager(this.managers.databaseManager);
            await this.managers.questManager.initialize();
            console.log('✅ QuestManager initialisé');

        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation des managers:', error);
            throw error;
        }
    }


    setupRoutes() {
        console.log('🛣️ Configuration des routes...');

        // Middleware pour rendre DatabaseManager accessible aux routes
        this.app.use((req, res, next) => {
            req.databaseManager = this.managers.databaseManager;
            next();
        });

        // Route de base pour vérifier que le serveur fonctionne
        this.app.get('/', (req, res) => {
            res.json({
                message: 'Oppede Server is running 🏃‍♂️',
                version: '2.0.0',
                managers: Object.keys(this.managers),
                uptime: process.uptime(),
                environment: process.env.NODE_ENV || 'development'
            });
        });

        // ✅ AJOUT - Routes de la boutique
        this.setupShopRoutes();

        // Routes Pokémon
        this.managers.pokemonDatabaseManager.setupRoutes(this.app);

        // Routes Combat Pokémon
        this.managers.pokemonBattleManager.setupRoutes(this.app);


        // Routes Quêtes
        this.managers.questManager.setupRoutes(this.app);
        // Routes Évolution Pokémon
        this.managers.pokemonEvolutionManager.setupRoutes(this.app);

        // Routes Traductions
        this.managers.translationManager.setupRoutes(this.app);



        // Routes gérées par les managers
        this.managers.databaseManager.setupRoutes(this.app);
        this.managers.photoManager.setupRoutes(this.app);

        // Routes externes
        const boosterRoutes = require('./routes/booster');
        this.app.use(boosterRoutes);

        console.log('✅ Routes configurées');
    }

    // ✅ NOUVELLE MÉTHODE - Configuration des routes de boutique
    setupShopRoutes() {
        const { ObjectId } = require('mongodb');

        // Route pour récupérer les boosters disponibles à la vente
        this.app.get('/api/items', async (req, res) => {
            const { type } = req.query;

            try {
                const db = await this.managers.databaseManager.connectToDatabase();
                const itemsCol = db.collection('items');

                let query = {};
                if (type) {
                    query.type = type;
                }

                const items = await itemsCol.find(query).toArray();
                res.json(items);

            } catch (error) {
                console.error('Erreur lors de la récupération des items:', error);
                res.status(500).json({ error: "Erreur serveur" });
            }
        });

        // Route pour acheter un booster
        this.app.post('/api/shop/buy-booster', async (req, res) => {
            const { playerId, boosterId, price } = req.body;

            if (!playerId || !boosterId || !price) {
                return res.status(400).json({ error: "Paramètres manquants" });
            }

            try {
                const db = await this.managers.databaseManager.connectToDatabase();
                const playersCol = db.collection('players');
                const inventoryCol = db.collection('inventory');
                const itemsCol = db.collection('items');

                // Vérifier que le joueur existe et a assez d'argent
                const player = await playersCol.findOne({ _id: new ObjectId(playerId) });
                if (!player) {
                    return res.status(404).json({ error: "Joueur non trouvé" });
                }

                if (player.totalScore < price) {
                    return res.status(400).json({ error: "Pas assez d'argent" });
                }

                // Vérifier que le booster existe
                const booster = await itemsCol.findOne({
                    _id: new ObjectId(boosterId),
                    type: "booster"
                });
                if (!booster) {
                    return res.status(404).json({ error: "Booster non trouvé" });
                }

                // Débiter l'argent du joueur
                await playersCol.updateOne(
                    { _id: new ObjectId(playerId) },
                    { $inc: { totalScore: -price } }
                );

                // Ajouter le booster à l'inventaire du joueur
                await inventoryCol.updateOne(
                    { player_id: new ObjectId(playerId), item_id: new ObjectId(boosterId) },
                    { $inc: { quantité: 1 } },
                    { upsert: true }
                );

                console.log(`🛒 Booster acheté: ${booster.nom} par joueur ${playerId} pour ${price} pièces`);

                res.json({
                    success: true,
                    message: "Booster acheté avec succès",
                    newBalance: player.totalScore - price
                });

            } catch (error) {
                console.error('Erreur lors de l\'achat du booster:', error);
                res.status(500).json({ error: "Erreur serveur" });
            }
        });

        console.log('🛒 Routes de boutique configurées');
    }

    setupSocket() {
        console.log('🔌 Configuration Socket.IO...');

        // Initialisation des événements Socket.IO via les managers
        this.managers.socketManager.initialize({
            playerManager: this.managers.playerManager,
            quizManager: this.managers.quizManager,
            tripleTriadManager: this.managers.tripleTriadManager
        });

        // Démarrer la diffusion des mises à jour des joueurs
        this.managers.playerManager.startPlayersUpdateBroadcast();

        console.log('✅ Socket.IO configuré');
    }

    start() {
        this.server.listen(PORT, () => {
            console.log('');
            console.log('🎉 ====================================');
            console.log(`🚀 Serveur Oppede démarré sur le port ${PORT}`);
            console.log(`🔧 Environnement: ${process.env.NODE_ENV || 'development'}`);
            console.log(`📁 Managers actifs: ${Object.keys(this.managers).length}`);
            console.log('   • DatabaseManager (MongoDB)');
            console.log('   • PlayerManager (Joueurs + Chat)');
            console.log('   • QuizManager (Quiz multijoueur)');
            console.log('   • TripleTriadManager (Jeux de cartes)');
            console.log('   • PhotoManager (Galerie photos)');
            console.log('   • PokemonDatabaseManager (Pokémon)');
            console.log('   • SocketManager (WebSocket)');
            console.log('   • ItemManager (Objets)');
            console.log('🎉 ====================================');
            console.log('');
        });

        // Gestion propre de l'arrêt du serveur
        process.on('SIGINT', () => {
            console.log('\n🛑 Arrêt du serveur en cours...');
            this.shutdown();
        });

        process.on('SIGTERM', () => {
            console.log('\n🛑 Arrêt du serveur demandé...');
            this.shutdown();
        });
    }

    shutdown() {
        console.log('🧹 Nettoyage des ressources...');

        if (this.server) {
            this.server.close(() => {
                console.log('✅ Serveur fermé proprement');
                process.exit(0);
            });
        }
    }
}

// Démarrage du serveur avec gestion d'erreur
const server = new Server();
server.initialize().catch(error => {
    console.error('❌ Échec du démarrage du serveur:', error);
    process.exit(1);
});