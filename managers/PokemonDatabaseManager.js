const { ObjectId } = require('mongodb');

/**
 * PokemonDatabaseManager
 * Gère toutes les opérations de base de données liées aux Pokémon du joueur
 * Collection: pokemonPlayer
 * Species data: Fetched on-demand from PokéAPI (lazy loading)
 */
class PokemonDatabaseManager {
    constructor(databaseManager) {
        this.db = databaseManager;
        this.pokemonPlayerCollection = null;
    }

    /**
     * Initialise les collections MongoDB
     */
    async initialize() {
        try {
            const database = await this.db.connectToDatabase();
            
            this.pokemonPlayerCollection = database.collection('pokemonPlayer');

            // Créer les index pour optimiser les requêtes
            await this.pokemonPlayerCollection.createIndex({ owner_id: 1 });
            await this.pokemonPlayerCollection.createIndex({ owner_id: 1, teamPosition: 1 });

            console.log("✅ Collection pokemonPlayer initialisée (lazy loading PokéAPI)");
        } catch (err) {
            console.error("❌ Erreur lors de l'initialisation de la collection Pokémon:", err);
        }
    }

    /**
     * Configuration des routes API
     */
    setupRoutes(app) {
        // 📋 Récupérer l'équipe complète d'un joueur
        app.get('/api/pokemon/team/:playerId', async (req, res) => {
            try {
                const { playerId } = req.params;
                const team = await this.getPlayerTeam(playerId);
                res.json({ success: true, team });
            } catch (error) {
                console.error('Erreur récupération équipe:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // 🔍 Récupérer les détails d'un Pokémon du joueur
        app.get('/api/pokemon/:pokemonId', async (req, res) => {
            try {
                const { pokemonId } = req.params;
                const pokemon = await this.getPokemonById(pokemonId);
                if (!pokemon) {
                    return res.status(404).json({ success: false, error: 'Pokémon non trouvé' });
                }
                res.json({ success: true, pokemon });
            } catch (error) {
                console.error('Erreur récupération Pokémon:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // 📝 Réorganiser l'équipe (changer l'ordre)
        app.post('/api/pokemon/team/reorder', async (req, res) => {
            try {
                const { playerId, newOrder } = req.body;
                
                if (!playerId || !Array.isArray(newOrder)) {
                    return res.status(400).json({ success: false, error: 'Données invalides' });
                }

                await this.reorderTeam(playerId, newOrder);
                res.json({ success: true, message: 'Équipe réorganisée' });
            } catch (error) {
                console.error('Erreur réorganisation équipe:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // ➕ Ajouter un nouveau Pokémon à l'équipe
        app.post('/api/pokemon/create', async (req, res) => {
            try {
                const { playerId, speciesId, nickname } = req.body;
                
                if (!playerId || !speciesId) {
                    return res.status(400).json({ success: false, error: 'Données invalides' });
                }

                const newPokemon = await this.createPlayerPokemon(playerId, speciesId, nickname);
                res.json({ success: true, pokemon: newPokemon });
            } catch (error) {
                console.error('Erreur création Pokémon:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // 🔄 Mettre à jour les stats d'un Pokémon (HP, expérience, niveau, etc.)
        app.put('/api/pokemon/:pokemonId', async (req, res) => {
            try {
                const { pokemonId } = req.params;
                const updates = req.body;

                const updated = await this.updatePokemon(pokemonId, updates);
                res.json({ success: true, pokemon: updated });
            } catch (error) {
                console.error('Erreur mise à jour Pokémon:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // 🎲 Récupérer un Pokémon sauvage aléatoire (pour combats)
        app.get('/api/pokemon/wild/:mapId', async (req, res) => {
            try {
                const { mapId } = req.params;
                const wildPokemon = await this.getWildPokemon(mapId);
                res.json({ success: true, pokemon: wildPokemon });
            } catch (error) {
                console.error('Erreur Pokémon sauvage:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });
    }

    /**
     * Récupère l'équipe complète d'un joueur (6 Pokémon max, ordonnés par teamPosition)
     */
    async getPlayerTeam(playerId) {
        try {
            const objectId = new ObjectId(playerId);
            const team = await this.pokemonPlayerCollection
                .find({ owner_id: objectId })
                .sort({ teamPosition: 1 })
                .limit(6)
                .toArray();
            return team;
        } catch (error) {
            console.error('Erreur getPlayerTeam:', error);
            return [];
        }
    }

    /**
     * Récupère les détails d'un Pokémon spécifique
     */
    async getPokemonById(pokemonId) {
        try {
            const objectId = new ObjectId(pokemonId);
            const pokemon = await this.pokemonPlayerCollection.findOne({ _id: objectId });
            return pokemon;
        } catch (error) {
            console.error('Erreur getPokemonById:', error);
            return null;
        }
    }

    /**
     * Crée un nouveau Pokémon pour un joueur
     * Note: species_name est stocké pour la persistance; les données d'espèce sont enrichies côté client
     */
    async createPlayerPokemon(playerId, speciesId, nickname = null, speciesName = null) {
        try {
            const playerObjectId = new ObjectId(playerId);

            // Déterminer la position dans l'équipe
            const teamPosition = await this.pokemonPlayerCollection.countDocuments({
                owner_id: playerObjectId
            });

            // Générer IV aléatoires (0-31)
            const ivs = {
                hp: Math.floor(Math.random() * 32),
                attack: Math.floor(Math.random() * 32),
                defense: Math.floor(Math.random() * 32),
                sp_attack: Math.floor(Math.random() * 32),
                sp_defense: Math.floor(Math.random() * 32),
                speed: Math.floor(Math.random() * 32)
            };

            // Créer le nouveau Pokémon
            const newPokemon = {
                owner_id: playerObjectId,
                species_id: speciesId,
                species_name: speciesName || `Pokemon_${speciesId}`,
                nickname: nickname || `Pokemon_${speciesId}`,
                level: 5,
                experience: 0,
                currentHP: 20,
                maxHP: 20,
                ivs,
                evs: { hp: 0, attack: 0, defense: 0, sp_attack: 0, sp_defense: 0, speed: 0 },
                nature: this.getRandomNature(),
                moveset: [],
                heldItem: null,
                status: null,
                custom: false,
                position: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await this.pokemonPlayerCollection.insertOne(newPokemon);
            newPokemon._id = result.insertedId;
            
            console.log(`✅ Pokémon créé: ${newPokemon.nickname} (ID ${newPokemon.species_id})`);
            return newPokemon;
        } catch (error) {
            console.error('Erreur createPlayerPokemon:', error);
            throw error;
        }
    }

    /**
     * Réorganise l'équipe du joueur
     */
    async reorderTeam(playerId, newOrder) {
        try {
            const playerObjectId = new ObjectId(playerId);

            // Valider que tous les IDs appartiennent au joueur
            const userPokemon = await this.pokemonPlayerCollection
                .find({ owner_id: playerObjectId })
                .toArray();
            
            const userPokemonIds = new Set(userPokemon.map(p => p._id.toString()));
            
            for (const pokemonId of newOrder) {
                if (!userPokemonIds.has(pokemonId)) {
                    throw new Error(`Pokémon ${pokemonId} n'appartient pas au joueur`);
                }
            }

            // Mettre à jour les positions
            for (let i = 0; i < newOrder.length; i++) {
                await this.pokemonPlayerCollection.updateOne(
                    { _id: new ObjectId(newOrder[i]) },
                    { $set: { teamPosition: i, updatedAt: new Date() } }
                );
            }

            console.log(`✅ Équipe réorganisée pour ${playerId}`);
        } catch (error) {
            console.error('Erreur reorderTeam:', error);
            throw error;
        }
    }

    /**
     * Mettre à jour les stats d'un Pokémon
     */
    async updatePokemon(pokemonId, updates) {
        try {
            const objectId = new ObjectId(pokemonId);
            updates.updatedAt = new Date();

            const result = await this.pokemonPlayerCollection.findOneAndUpdate(
                { _id: objectId },
                { $set: updates },
                { returnDocument: 'after' }
            );

            return result.value;
        } catch (error) {
            console.error('Erreur updatePokemon:', error);
            throw error;
        }
    }

    /**
     * Récupère un Pokémon sauvage aléatoire pour une carte
     * Note: Données enrichies côté client (lazy loading)
     */
    async getWildPokemon(mapId) {
        try {
            // Pour l'instant, retourner un Pokémon aléatoire de faible niveau
            // À améliorer avec une table pokemonWildEncounters plus tard
            const randomSpeciesId = Math.floor(Math.random() * 151) + 1; // Gen 1

            const level = Math.floor(Math.random() * 5) + 3; // Niveau 3-8
            const wildPokemon = {
                species_id: randomSpeciesId,
                species_name: `Pokemon_${randomSpeciesId}`,
                level,
                currentHP: 20,
                maxHP: 20,
                ivs: { hp: 15, attack: 15, defense: 15, sp_attack: 15, sp_defense: 15, speed: 15 },
                evs: { hp: 0, attack: 0, defense: 0, sp_attack: 0, sp_defense: 0, speed: 0 },
                nature: 'hardy',
                moveset: [],
                heldItem: null,
                status: null,
                isWild: true
            };

            return wildPokemon;
        } catch (error) {
            console.error('Erreur getWildPokemon:', error);
            return null;
        }
    }

    /**
     * Utilitaire : retourne une nature aléatoire
     */
    getRandomNature() {
        const natures = [
            'hardy', 'lonely', 'brave', 'adamant', 'naughty',
            'bold', 'docile', 'relaxed', 'impish', 'lax',
            'timid', 'hasty', 'serious', 'jolly', 'naive',
            'modest', 'mild', 'quiet', 'bashful', 'rash',
            'calm', 'gentle', 'sassy', 'careful', 'quirky'
        ];
        return natures[Math.floor(Math.random() * natures.length)];
    }

    /**
     * Efface tous les Pokémon d'un joueur (pour reset)
     */
    async deletePlayerPokemon(playerId) {
        try {
            const playerObjectId = new ObjectId(playerId);
            const result = await this.pokemonPlayerCollection.deleteMany({
                owner_id: playerObjectId
            });
            console.log(`✅ ${result.deletedCount} Pokémon supprimés pour ${playerId}`);
            return result.deletedCount;
        } catch (error) {
            console.error('Erreur deletePlayerPokemon:', error);
            throw error;
        }
    }
}

module.exports = PokemonDatabaseManager;
