const { ObjectId } = require('mongodb');
const PokemonEvolutionManager = require('./PokemonEvolutionManager');
const { calculateAllStats, calculateMaxHP } = require('../utils/pokemonStats');

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
        this.evolutionManager = new PokemonEvolutionManager(databaseManager);
        this.speciesStatsCache = new Map(); // Cache pour les stats de base
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

        // 🧬 Exécuter une évolution
        app.post('/api/pokemon/evolve', async (req, res) => {
            try {
                const { pokemonId, targetSpeciesId } = req.body;
                
                if (!pokemonId || !targetSpeciesId) {
                    return res.status(400).json({ success: false, error: 'pokemonId et targetSpeciesId requis' });
                }

                const result = await this.evolutionManager.performEvolution(pokemonId, targetSpeciesId);
                res.json(result);
            } catch (error) {
                console.error('Erreur évolution:', error);
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
     * Calcule l'XP minimum requise pour atteindre un niveau (formule medium-slow)
     */
    calculateXPFromLevel(level) {
        if (level <= 1) return 0;
        return Math.floor(1.2 * Math.pow(level, 3) - 15 * Math.pow(level, 2) + 100 * level - 140);
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
            
            // Calculer le level, stats dynamiques et traductions FR si disponibles
            for (const pokemon of team) {
                // 1. Calculer niveau depuis XP
                pokemon.level = this.calculateLevelFromXP(pokemon.experience || 0);
                
                // 2. Récupérer stats de base
                const baseStats = await this.getBaseStats(pokemon.species_id);
                
                // 3. Calculer stats complètes
                const stats = calculateAllStats(
                    baseStats, 
                    pokemon.level, 
                    pokemon.ivs || {}, 
                    pokemon.evs || {}, 
                    pokemon.nature || 'hardy'
                );
                
                // 4. Injecter maxHP et autres stats dans l'objet retourné (sans sauvegarder en DB)
                pokemon.maxHP = stats.maxHP;
                pokemon.stats = stats; // Pour le frontend qui pourrait en avoir besoin
                // 5. Traduction FR
                try {
                    if (this.translationManager && typeof this.translationManager.getPokemonNameFR === 'function') {
                        const nameFr = await this.translationManager.getPokemonNameFR(pokemon.species_id);
                        pokemon.species_name_fr = nameFr;
                        // si le surnom est égal au nom anglais (ex: "Squirtle"), remplacer par FR
                        if (pokemon.nickname && pokemon.species_name && pokemon.nickname.toLowerCase() === pokemon.species_name.toLowerCase()) {
                            pokemon.nickname = nameFr;
                        }
                        if (!pokemon.nickname) pokemon.nickname = nameFr;
                    }
                } catch (e) {
                    console.warn('Erreur traduction dans getPlayerTeam:', e.message);
                }
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
                // 1. Calculer niveau depuis XP
                pokemon.level = this.calculateLevelFromXP(pokemon.experience || 0);
                
                // 2. Récupérer stats de base
                const baseStats = await this.getBaseStats(pokemon.species_id);
                
                // 3. Calculer stats complètes
                const stats = calculateAllStats(
                    baseStats, 
                    pokemon.level, 
                    pokemon.ivs || {}, 
                    pokemon.evs || {}, 
                    pokemon.nature || 'hardy'
                );
                
                // 4. Injecter maxHP et autres stats
                pokemon.maxHP = stats.maxHP;
                pokemon.stats = stats;
                // 5. Traduction FR pour les détails
                try {
                    if (this.translationManager && typeof this.translationManager.getPokemonNameFR === 'function') {
                        const nameFr = await this.translationManager.getPokemonNameFR(pokemon.species_id);
                        pokemon.species_name_fr = nameFr;
                        if (pokemon.nickname && pokemon.species_name && pokemon.nickname.toLowerCase() === pokemon.species_name.toLowerCase()) {
                            pokemon.nickname = nameFr;
                        }
                        if (!pokemon.nickname) pokemon.nickname = nameFr;
                    }
                } catch (e) {
                    console.warn('Erreur traduction dans getPokemonById:', e.message);
                }
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
            const level = 5; // Niveau par défaut pour les starters

            // Utiliser la méthode centralisée
            const pokemonData = await this.generatePokemonData(speciesId, level, playerId, nickname);

            // Déterminer la position dans l'équipe
            const count = await this.pokemonPlayerCollection.countDocuments({
                owner_id: playerObjectId
            });

            pokemonData.teamPosition = count;
            pokemonData.position = count + 1;
            if (speciesName) pokemonData.species_name = speciesName;

            const result = await this.pokemonPlayerCollection.insertOne(pokemonData);
            pokemonData._id = result.insertedId;
            
            console.log(`✅ Pokémon créé: ${pokemonData.nickname} (ID ${pokemonData.species_id})`);
            return pokemonData;
        } catch (error) {
            console.error('Erreur createPlayerPokemon:', error);
            throw error;
        }
    }

    /**
     * Récupère tous les moves qu'un Pokémon aurait pu apprendre jusqu'à un certain niveau
     * Filtre STRICTEMENT sur scarlet-violet
     */
    async getAllLearnableMoves(speciesId, level) {
        try {
            const fetch = (await import('node-fetch')).default;
            const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}`);
            
            if (!response.ok) return [];
            
            const data = await response.json();
            const potentialMoves = [];
            
            for (const moveEntry of data.moves) {
                // 1. Chercher spécifiquement dans scarlet-violet
                const svDetail = moveEntry.version_group_details.find(detail => 
                    detail.version_group.name === 'scarlet-violet' &&
                    detail.move_learn_method.name === 'level-up' &&
                    detail.level_learned_at <= level
                );

                if (svDetail) {
                    potentialMoves.push({
                        name: moveEntry.move.name,
                        url: moveEntry.move.url,
                        learnLevel: svDetail.level_learned_at
                    });
                }
            }
            
            // 2. Trier par niveau d'apprentissage (croissant)
            potentialMoves.sort((a, b) => a.learnLevel - b.learnLevel);

            // 3. Récupérer les détails des moves (en parallèle pour la vitesse)
            const movePromises = potentialMoves.map(async (move) => {
                try {
                    const moveRes = await fetch(move.url);
                    const moveData = await moveRes.json();
                    return {
                        name: moveData.name,
                        type: moveData.type.name,
                        category: moveData.damage_class.name,
                        power: moveData.power || 0,
                        accuracy: moveData.accuracy || 100,
                        pp: moveData.pp || 10,
                        maxPP: moveData.pp || 10,
                        learnLevel: move.learnLevel
                    };
                } catch (e) {
                    console.warn(`Erreur fetch move ${move.name}`);
                    return null;
                }
            });

            const resolvedMoves = await Promise.all(movePromises);
            return resolvedMoves.filter(m => m !== null);
            
        } catch (error) {
            console.error('Erreur getAllLearnableMoves:', error);
            return [];
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

            const wildPokemon = await this.generatePokemonData(randomSpeciesId, level);
            wildPokemon.isWild = true;

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
            const debugLevel = 15; // Niveau demandé pour le debug
            
            // 1. Générer les données via la méthode centralisée
            const pokemonData = await this.generatePokemonData(speciesId, debugLevel, playerId);
            
            // 2. Trouver la première position disponible (1-6)
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
            
            // Ajouter les champs spécifiques au debug/joueur
            pokemonData.teamPosition = teamPosition;
            pokemonData.position = displayPosition;
            pokemonData.originalTrainer = playerId;
            pokemonData.heldItem = null; // Pas d'objet par défaut
            
            const result = await this.pokemonPlayerCollection.insertOne(pokemonData);
            pokemonData._id = result.insertedId;
            
            console.log(`✅ Pokémon DEBUG créé: ${pokemonData.nickname} (ID ${speciesId}) niveau ${debugLevel} avec ${pokemonData.moveset.length} moves`);
            return pokemonData;
            
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

    /**
     * Récupère les stats de base d'une espèce (avec cache)
     */
    async getBaseStats(speciesId) {
        if (this.speciesStatsCache.has(speciesId)) {
            return this.speciesStatsCache.get(speciesId);
        }

        try {
            const fetch = (await import('node-fetch')).default;
            const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}`);
            
            if (!response.ok) throw new Error('Species not found');
            
            const data = await response.json();
            const baseStats = {
                hp: data.stats.find(s => s.stat.name === 'hp').base_stat,
                attack: data.stats.find(s => s.stat.name === 'attack').base_stat,
                defense: data.stats.find(s => s.stat.name === 'defense').base_stat,
                sp_attack: data.stats.find(s => s.stat.name === 'special-attack').base_stat,
                sp_defense: data.stats.find(s => s.stat.name === 'special-defense').base_stat,
                speed: data.stats.find(s => s.stat.name === 'speed').base_stat
            };

            this.speciesStatsCache.set(speciesId, baseStats);
            return baseStats;
        } catch (error) {
            console.warn(`[PokemonDatabaseManager] Impossible de récupérer stats pour ${speciesId}, utilisation défauts`);
            return { hp: 45, attack: 49, defense: 49, sp_attack: 65, sp_defense: 65, speed: 45 };
        }
    }

    /**
     * Génère les données complètes d'un Pokémon (Stats, Moves, IVs, EVs, etc.
     * Centralise la logique de création pour Wild, Debug et Starter
     */
    async generatePokemonData(speciesId, level, ownerId = null, nickname = null) {
        // 1. Récupérer stats de base
        const baseStats = await this.getBaseStats(speciesId);
        
        // 2. Générer IVs, EVs, Nature
        const ivs = {
            hp: Math.floor(Math.random() * 32),
            attack: Math.floor(Math.random() * 32),
            defense: Math.floor(Math.random() * 32),
            sp_attack: Math.floor(Math.random() * 32),
            sp_defense: Math.floor(Math.random() * 32),
            speed: Math.floor(Math.random() * 32)
        };
        const evs = { hp: 0, attack: 0, defense: 0, sp_attack: 0, sp_defense: 0, speed: 0 };
        const nature = this.getRandomNature();

        // 3. Calculer stats
        const stats = calculateAllStats(baseStats, level, ivs, evs, nature);
        const experience = this.calculateXPFromLevel(level);

        // 4. Générer Moveset (Scarlet/Violet logic)
        const learnedMoves = await this.getAllLearnableMoves(speciesId, level);
        // Prendre les 4 derniers moves appris
        const moveset = learnedMoves.slice(-4);

        // 5. Récupérer le nom de l'espèce et base_experience si possible (optionnel, pour le debug et XP)
        let speciesName = `Pokemon_${speciesId}`;
        let speciesNameFR = null;
        let baseExperience = 50; // Valeur par défaut
        try {
            const fetch = (await import('node-fetch')).default;
            const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}`);
            if (response.ok) {
                const data = await response.json();
                speciesName = data.name;
                baseExperience = data.base_experience || 50;
            }
        } catch (e) {
            console.warn('Erreur fetch name et base_experience dans generatePokemonData');
        }

        // Optional: Fetch FR name via TranslationManager
        try {
            if (this.translationManager && typeof this.translationManager.getPokemonNameFR === 'function') {
                speciesNameFR = await this.translationManager.getPokemonNameFR(speciesId);
            }
        } catch (tErr) {
            // non-blocking
            console.warn(`Erreur fetch name_fr via TranslationManager pour ${speciesId}:`, tErr.message);
        }

        const finalNickname = nickname || (speciesNameFR ? (speciesNameFR.charAt(0).toUpperCase() + speciesNameFR.slice(1)) : (speciesName.charAt(0).toUpperCase() + speciesName.slice(1)));

        return {
            owner_id: ownerId ? new ObjectId(ownerId) : null,
            species_id: speciesId,
            species_name: speciesName,
            species_name_fr: speciesNameFR || null,
            nickname: finalNickname,
            level: level,
            experience: experience,
            base_experience: baseExperience,
            currentHP: stats.maxHP,
            attack: stats.attack,
            defense: stats.defense,
            sp_attack: stats.sp_attack,
            sp_defense: stats.sp_defense,
            speed: stats.speed,
            ivs,
            evs,
            nature,
            moveset,
            learnedMoves,
            heldItem: null,
            statusCondition: { type: null, turns: 0 },
            custom: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }
}

module.exports = PokemonDatabaseManager;
