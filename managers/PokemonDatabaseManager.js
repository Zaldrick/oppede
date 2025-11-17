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

        // 🐛 DEBUG: Supprimer tous les Pokémon d'un joueur
        app.delete('/api/pokemon/debug/clear/:playerId', async (req, res) => {
            try {
                const { playerId } = req.params;
                const count = await this.deletePlayerPokemon(playerId);
                res.json({ success: true, message: `${count} Pokémon supprimés`, deletedCount: count });
            } catch (error) {
                console.error('Erreur suppression debug:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // 🐛 DEBUG: Créer un Pokémon niveau 8 avec moves corrects depuis PokeAPI
        app.post('/api/pokemon/debug/create', async (req, res) => {
            try {
                const { playerId, speciesId } = req.body;
                
                if (!playerId || !speciesId) {
                    return res.status(400).json({ success: false, error: 'playerId et speciesId requis' });
                }

                const newPokemon = await this.createDebugPokemon(playerId, speciesId);
                res.json({ success: true, pokemon: newPokemon });
            } catch (error) {
                console.error('Erreur création debug Pokémon:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // 📚 Apprendre un nouveau move (remplacer si 4 moves déjà appris)
        app.post('/api/pokemon/learn-move', async (req, res) => {
            try {
                const { pokemonId, newMove, replaceIndex } = req.body;

                if (!pokemonId || !newMove) {
                    return res.status(400).json({ success: false, error: 'pokemonId et newMove requis' });
                }

                const result = await this.learnMove(pokemonId, newMove, replaceIndex);
                res.json({ success: true, moveset: result.moveset });
            } catch (error) {
                console.error('Erreur apprentissage move:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // 🔍 Récupérer moves disponibles à un niveau donné
        app.get('/api/pokemon/available-moves/:speciesId/:level', async (req, res) => {
            try {
                const { speciesId, level } = req.params;
                const moves = await this.getAvailableMovesAtLevel(speciesId, parseInt(level));
                res.json({ success: true, moves });
            } catch (error) {
                console.error('Erreur récupération moves disponibles:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });
    }

    /**
     * Calcule le niveau d'un Pokémon depuis son XP (formule medium-slow)
     */
    calculateLevelFromXP(experience) {
        if (!experience || experience < 0) return 1;
        
        for (let level = 1; level <= 100; level++) {
            const xpNeeded = Math.floor(1.2 * Math.pow(level, 3) - 15 * Math.pow(level, 2) + 100 * level - 140);
            if (experience < xpNeeded) {
                return level - 1;
            }
        }
        return 100;
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
            
            // Calculer le level dynamiquement depuis l'XP
            for (const pokemon of team) {
                pokemon.level = this.calculateLevelFromXP(pokemon.experience || 0);
            }
            
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
            
            if (pokemon) {
                // Calculer le level dynamiquement
                pokemon.level = this.calculateLevelFromXP(pokemon.experience || 0);
            }
            
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

    /**
     * 🐛 DEBUG: Crée un Pokémon niveau 8 avec moves corrects depuis PokeAPI
     */
    async createDebugPokemon(playerId, speciesId) {
        try {
            const fetch = (await import('node-fetch')).default;
            
            // 1. Récupérer les infos du Pokémon depuis PokeAPI
            console.log(`🔍 Récupération Pokémon ID ${speciesId} depuis PokeAPI...`);
            const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}`);
            
            if (!response.ok) {
                throw new Error(`Pokémon ${speciesId} non trouvé sur PokeAPI`);
            }
            
            const pokemonData = await response.json();
            const speciesName = pokemonData.name;
            
            // 2. Extraire les moves appris au niveau <= 8 par level-up
            const learntMoves = [];
            
            for (const moveEntry of pokemonData.moves) {
                // Chercher dans les version_group_details si le move est appris par level-up
                for (const versionDetail of moveEntry.version_group_details) {
                    // Filtrer uniquement level-up
                    if (versionDetail.move_learn_method.name === 'level-up') {
                        const learnLevel = versionDetail.level_learned_at;
                        
                        // Si appris au niveau <= 8
                        if (learnLevel > 0 && learnLevel <= 8) {
                            learntMoves.push({
                                name: moveEntry.move.name,
                                url: moveEntry.move.url,
                                learnLevel: learnLevel
                            });
                            break; // Un move par version_group suffit
                        }
                    }
                }
                
                // Arrêter si on a déjà 4 moves
                if (learntMoves.length >= 4) break;
            }
            
            // Trier par niveau d'apprentissage (du plus bas au plus haut)
            learntMoves.sort((a, b) => a.learnLevel - b.learnLevel);
            
            // Limiter à 4 moves max
            const selectedMoves = learntMoves.slice(0, 4);
            
            console.log(`✅ Moves trouvés pour ${speciesName}:`, selectedMoves.map(m => `${m.name} (niv ${m.learnLevel})`));
            
            // 3. Récupérer les détails complets de chaque move
            const moveset = [];
            
            for (const move of selectedMoves) {
                try {
                    const moveResponse = await fetch(move.url);
                    if (!moveResponse.ok) continue;
                    
                    const moveData = await moveResponse.json();
                    
                    moveset.push({
                        name: moveData.name,
                        type: moveData.type.name,
                        category: moveData.damage_class.name,
                        power: moveData.power || 0,
                        accuracy: moveData.accuracy || 100,
                        pp: moveData.pp || 10,
                        maxPP: moveData.pp || 10
                    });
                } catch (error) {
                    console.error(`Erreur récupération move ${move.name}:`, error);
                }
            }
            
            // 4. Calculer les stats de base (simplifiées pour niveau 8)
            const baseHP = pokemonData.stats.find(s => s.stat.name === 'hp').base_stat;
            const maxHP = Math.floor((baseHP * 2 * 8) / 100) + 8 + 10; // Formule Pokémon simplifiée
            
            // 5. Trouver la première position disponible (1-6)
            const playerObjectId = new ObjectId(playerId);
            
            // Récupérer tous les Pokémon du joueur
            const existingPokemon = await this.pokemonPlayerCollection
                .find({ owner_id: playerObjectId })
                .toArray();
            
            // Extraire les positions occupées (teamPosition, pas position)
            const occupiedPositions = existingPokemon
                .map(p => p.teamPosition)
                .filter(pos => pos !== null && pos !== undefined)
                .sort((a, b) => a - b);
            
            // Trouver la première position libre (de 0 à 5 pour max 6 Pokémon)
            let teamPosition = 0;
            for (let i = 0; i < 6; i++) {
                if (!occupiedPositions.includes(i)) {
                    teamPosition = i;
                    break;
                }
            }
            
            // Si toutes les positions sont prises (6 Pokémon), prendre la suivante
            if (occupiedPositions.length >= 6) {
                teamPosition = Math.max(...occupiedPositions) + 1;
            }
            
            // Position pour l'affichage (1-6 au lieu de 0-5)
            const displayPosition = teamPosition + 1;
            
            console.log(`📍 Position assignée: teamPosition=${teamPosition}, position=${displayPosition} (positions occupées: ${occupiedPositions.join(', ') || 'aucune'})`);
            
            const ivs = {
                hp: Math.floor(Math.random() * 32),
                attack: Math.floor(Math.random() * 32),
                defense: Math.floor(Math.random() * 32),
                sp_attack: Math.floor(Math.random() * 32),
                sp_defense: Math.floor(Math.random() * 32),
                speed: Math.floor(Math.random() * 32)
            };
            
            const debugLevel = 8;
            // Calculer l'XP minimum pour le niveau 8 (formule medium-slow)
            const minXPForLevel = Math.floor(1.2 * Math.pow(debugLevel, 3) - 15 * Math.pow(debugLevel, 2) + 100 * debugLevel - 140);
            
            const newPokemon = {
                owner_id: playerObjectId,
                originalTrainer: playerId, // 🆕 Dresseur d'origine (pour bonus traded)
                species_id: speciesId,
                species_name: speciesName,
                nickname: speciesName.charAt(0).toUpperCase() + speciesName.slice(1),
                // Pas de level stocké ! Seulement l'XP, le level sera calculé dynamiquement
                experience: minXPForLevel,
                currentHP: maxHP,
                maxHP: maxHP,
                ivs,
                evs: { hp: 0, attack: 0, defense: 0, sp_attack: 0, sp_defense: 0, speed: 0 },
                nature: this.getRandomNature(),
                moveset: moveset,
                heldItem: null, // 🆕 Objet tenu (ex: "lucky-egg", "exp-share")
                statusCondition: { type: null, turns: 0 }, // 🆕 Statuts (poison, burn, paralysis, sleep, freeze)
                teamPosition: teamPosition,
                custom: false,
                position: displayPosition, // Position 1-6 pour l'affichage
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const result = await this.pokemonPlayerCollection.insertOne(newPokemon);
            newPokemon._id = result.insertedId;
            
            console.log(`✅ Pokémon DEBUG créé: ${newPokemon.nickname} (ID ${speciesId}) niveau 8 avec ${moveset.length} moves`);
            return newPokemon;
            
        } catch (error) {
            console.error('Erreur createDebugPokemon:', error);
            throw error;
        }
    }

    /**
     * Apprendre un nouveau move (remplacer si nécessaire)
     */
    async learnMove(pokemonId, newMove, replaceIndex = null) {
        try {
            const pokemon = await this.pokemonPlayerCollection.findOne({ _id: new ObjectId(pokemonId) });
            
            if (!pokemon) {
                throw new Error('Pokémon introuvable');
            }

            let moveset = pokemon.moveset || [];

            if (replaceIndex !== null && replaceIndex >= 0 && replaceIndex < moveset.length) {
                // Remplacer un move existant
                console.log(`[LearnMove] Remplacement de ${moveset[replaceIndex].name} par ${newMove.name}`);
                moveset[replaceIndex] = {
                    name: newMove.name,
                    type: newMove.type,
                    category: newMove.category,
                    power: newMove.power || 0,
                    accuracy: newMove.accuracy || 100,
                    pp: newMove.pp || 10,
                    maxPP: newMove.maxPP || newMove.pp || 10
                };
            } else if (moveset.length < 4) {
                // Ajouter le move (place disponible)
                console.log(`[LearnMove] Ajout de ${newMove.name} (${moveset.length}/4)`);
                moveset.push({
                    name: newMove.name,
                    type: newMove.type,
                    category: newMove.category,
                    power: newMove.power || 0,
                    accuracy: newMove.accuracy || 100,
                    pp: newMove.pp || 10,
                    maxPP: newMove.maxPP || newMove.pp || 10
                });
            } else {
                throw new Error('4 moves déjà appris, replaceIndex requis');
            }

            // Mettre à jour en DB
            await this.pokemonPlayerCollection.updateOne(
                { _id: new ObjectId(pokemonId) },
                { $set: { moveset: moveset, updatedAt: new Date() } }
            );

            return { moveset };
        } catch (error) {
            console.error('[LearnMove] Erreur:', error);
            throw error;
        }
    }

    /**
     * Récupérer moves disponibles à un niveau donné via PokeAPI
     */
    async getAvailableMovesAtLevel(speciesId, level) {
        try {
            console.log(`[AvailableMoves] Récupération moves pour espèce ${speciesId} au niveau ${level}`);
            
            // Appel PokeAPI
            const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}`);
            if (!response.ok) throw new Error(`PokeAPI error: ${response.status}`);
            
            const pokemonData = await response.json();

            // Filtrer moves appris exactement à ce niveau
            const movesAtLevel = [];
            
            for (const moveEntry of pokemonData.moves) {
                for (const versionDetail of moveEntry.version_group_details) {
                    if (versionDetail.move_learn_method.name === 'level-up' && 
                        versionDetail.level_learned_at === level) {
                        
                        // Récupérer détails du move
                        const moveResponse = await fetch(moveEntry.move.url);
                        const moveData = await moveResponse.json();
                        
                        movesAtLevel.push({
                            name: moveData.name,
                            type: moveData.type.name,
                            category: moveData.damage_class.name,
                            power: moveData.power || 0,
                            accuracy: moveData.accuracy || 100,
                            pp: moveData.pp || 10,
                            maxPP: moveData.pp || 10,
                            learnLevel: level
                        });
                    }
                }
            }

            console.log(`  → ${movesAtLevel.length} move(s) disponible(s) au niveau ${level}`);
            return movesAtLevel;
            
        } catch (error) {
            console.error('[AvailableMoves] Erreur:', error);
            return [];
        }
    }
}

module.exports = PokemonDatabaseManager;
