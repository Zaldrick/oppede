const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

/**
 * PokemonEvolutionManager
 * Gère la logique d'évolution des Pokémon
 */
class PokemonEvolutionManager {
    constructor(databaseManager) {
        this.db = databaseManager;
        this.chainCache = new Map(); // Cache simple en mémoire pour les chaînes d'évolution
    }

    /**
     * Configure les routes Express
     */
    setupRoutes(app) {
        console.log('[EvolutionManager] Configuration des routes...');

        // Vérifier si un Pokémon peut évoluer
        app.post('/api/evolution/check', async (req, res) => {
            try {
                const { pokemonId } = req.body;
                if (!pokemonId) return res.status(400).json({ error: 'pokemonId requis' });

                const db = await this.db.connectToDatabase();
                const pokemon = await db.collection('pokemonPlayer').findOne({ _id: new ObjectId(pokemonId) });

                if (!pokemon) return res.status(404).json({ error: 'Pokémon introuvable' });

                const result = await this.checkEvolution(pokemon, 'level-up', pokemon.level);
                res.json(result);

            } catch (error) {
                console.error('[Evolution] Erreur route check:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Exécuter l'évolution
        app.post('/api/evolution/perform', async (req, res) => {
            try {
                const { pokemonId, targetSpeciesId } = req.body;
                if (!pokemonId || !targetSpeciesId) return res.status(400).json({ error: 'pokemonId et targetSpeciesId requis' });

                const result = await this.performEvolution(pokemonId, targetSpeciesId);
                res.json(result);

            } catch (error) {
                console.error('[Evolution] Erreur route perform:', error);
                res.status(500).json({ error: error.message });
            }
        });
    }

    /**
     * Vérifie si un Pokémon peut évoluer
     * @param {Object} pokemon - Le Pokémon du joueur
     * @param {string} triggerType - 'level-up', 'item', 'trade'
     * @param {any} triggerValue - La valeur du déclencheur (ex: nouveau niveau)
     */
    async checkEvolution(pokemon, triggerType, triggerValue) {
        try {
            // console.log(`[Evolution] Vérification pour ${pokemon.nickname} (${pokemon.species_name}) - Trigger: ${triggerType} ${triggerValue}`);
            
            const chain = await this.getEvolutionChain(pokemon.species_id);
            if (!chain) return { canEvolve: false, error: 'Chaîne introuvable' };

            // Trouver le nœud actuel dans la chaîne
            const currentNode = this.findNodeInChain(chain.chain, pokemon.species_id);
            if (!currentNode) {
                console.warn(`[Evolution] Espèce ${pokemon.species_id} non trouvée dans sa propre chaîne`);
                return { canEvolve: false, error: 'Espèce non trouvée dans la chaîne' };
            }

            // Vérifier les évolutions possibles
            for (const evolution of currentNode.evolves_to) {
                const details = evolution.evolution_details[0]; // On prend le premier moyen d'évolution pour simplifier
                
                if (!details) continue;

                let meetsCondition = false;

                if (triggerType === 'level-up' && details.trigger.name === 'level-up') {
                    // Vérifier le niveau minimum
                    if (details.min_level && triggerValue >= details.min_level) {
                        meetsCondition = true;
                    } else {
                        console.log(`[Evolution] Niveau insuffisant: ${triggerValue} < ${details.min_level}`);
                    }
                    // TODO: Gérer d'autres conditions de level-up (bonheur, heure, etc.)
                }
                // TODO: Gérer 'item' et 'trade'

                if (meetsCondition) {
                    // Récupérer l'ID de l'espèce cible depuis l'URL
                    const targetSpeciesId = parseInt(evolution.species.url.split('/').filter(Boolean).pop());
                    
                    console.log(`[Evolution] ✅ Condition remplie! Évolue en ${evolution.species.name} (ID ${targetSpeciesId})`);
                    
                    return {
                        canEvolve: true,
                        targetSpeciesId: targetSpeciesId,
                        targetSpeciesName: evolution.species.name,
                        minLevel: details.min_level
                    };
                }
            }

            return { canEvolve: false, error: 'Aucune condition remplie' };

        } catch (error) {
            console.error('[Evolution] Erreur checkEvolution:', error);
            return { canEvolve: false, error: error.message };
        }
    }

    /**
     * Récupère la chaîne d'évolution depuis PokéAPI ou le cache
     */
    async getEvolutionChain(speciesId) {
        // 1. Vérifier le cache
        if (this.chainCache.has(speciesId)) {
            return this.chainCache.get(speciesId);
        }

        try {
            // 2. Récupérer les infos de l'espèce pour avoir l'URL de la chaîne
            const speciesResponse = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${speciesId}/`);
            if (!speciesResponse.ok) throw new Error(`Species fetch failed: ${speciesResponse.status}`);
            
            const speciesData = await speciesResponse.json();
            const chainUrl = speciesData.evolution_chain.url;

            // 3. Récupérer la chaîne d'évolution
            const chainResponse = await fetch(chainUrl);
            if (!chainResponse.ok) throw new Error(`Chain fetch failed: ${chainResponse.status}`);
            
            const chainData = await chainResponse.json();

            // 4. Mettre en cache (pour toutes les espèces de cette chaîne idéalement, mais ici on simplifie)
            this.chainCache.set(speciesId, chainData);
            
            return chainData;

        } catch (error) {
            console.error(`[Evolution] Erreur récupération chaîne pour ${speciesId}:`, error);
            return null;
        }
    }

    /**
     * Trouve récursivement le nœud correspondant à l'espèce dans l'arbre
     */
    findNodeInChain(node, speciesId) {
        const nodeId = parseInt(node.species.url.split('/').filter(Boolean).pop());
        
        if (nodeId === parseInt(speciesId)) {
            return node;
        }

        for (const child of node.evolves_to) {
            const found = this.findNodeInChain(child, speciesId);
            if (found) return found;
        }

        return null;
    }

    /**
     * Exécute l'évolution (Mise à jour BDD)
     */
    async performEvolution(pokemonId, targetSpeciesId) {
        try {
            const { ObjectId } = require('mongodb');
            const db = await this.db.connectToDatabase();
            const collection = db.collection('pokemonPlayer');

            // 1. Récupérer les nouvelles stats de base
            const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${targetSpeciesId}/`);
            if (!response.ok) throw new Error('Impossible de récupérer les données du Pokémon cible');
            const data = await response.json();

            // 2. Récupérer le Pokémon actuel
            const pokemon = await collection.findOne({ _id: new ObjectId(pokemonId) });
            if (!pokemon) throw new Error('Pokémon introuvable');

            console.log(`[Evolution] Données brutes DB pour ${pokemonId}:`, JSON.stringify(pokemon, null, 2));

            // 3. Préparer les stats
            const ivs = pokemon.ivs || { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 };
            const evs = pokemon.evs || { hp: 0, attack: 0, defense: 0, special_attack: 0, special_defense: 0, speed: 0 };
            
            // 🔧 FIXE: Recalculer le niveau depuis l'XP si le niveau est 1 ou manquant
            let level = parseInt(pokemon.level) || 1;
            const experience = pokemon.experience || 0;
            
            if (level === 1 && experience > 0) {
                const calculatedLevel = this.calculateLevelFromXP(experience);
                if (calculatedLevel > level) {
                    console.log(`[Evolution] Correction niveau: ${level} -> ${calculatedLevel} (basé sur ${experience} XP)`);
                    level = calculatedLevel;
                }
            }

            console.log(`[Evolution] Calcul stats pour Lvl ${level} (Base: ${data.name})`);

            // Helper pour trouver une stat de base
            const getBaseStat = (name) => {
                const stat = data.stats.find(s => s.stat.name === name);
                return stat ? stat.base_stat : 0;
            };

            // Calcul des nouvelles stats (uniquement pour la logique de PV, pas pour sauvegarde)
            // Formule HP: ((2 * Base + IV + (EV/4)) * Level / 100) + Level + 10
            const baseHP = getBaseStat('hp');
            const newMaxHP = Math.floor(((2 * baseHP + (ivs.hp || 0) + ((evs.hp || 0) / 4)) * level) / 100) + level + 10;

            console.log(`[Evolution] HP Calc (Interne): Base=${baseHP}, Lvl=${level} -> MaxHP=${newMaxHP}`);

            // Gestion du surnom
            let newNickname = pokemon.nickname;
            // Récupérer le nom FR de l'espèce actuelle si disponible
            let currentSpeciesNameFr = pokemon.species_name_fr;
            if (!currentSpeciesNameFr && pokemon.species_id) {
                try {
                    const sRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemon.species_id}`);
                    if (sRes.ok) {
                        const sData = await sRes.json();
                        const frNameEntry = sData.names.find(n => n.language && n.language.name === 'fr');
                        currentSpeciesNameFr = frNameEntry ? frNameEntry.name : null;
                    }
                } catch (e) {
                    // ignore any error here; we'll fallback to english comparison only
                }
            }

            // Récupérer le nom FR de la cible si possible
            let targetSpeciesNameFr = null;
            try {
                const targetSpeciesResponse = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${targetSpeciesId}/`);
                if (targetSpeciesResponse.ok) {
                    const targetSpeciesData = await targetSpeciesResponse.json();
                    const targetFrNameEntry = targetSpeciesData.names.find(n => n.language && n.language.name === 'fr');
                    if (targetFrNameEntry) targetSpeciesNameFr = targetFrNameEntry.name;
                }
            } catch (e) {
                // fallback: ignore
            }

            // Normaliser pour comparaison
            const nicknameLc = (pokemon.nickname || '').toLowerCase();
            const speciesNameEnLc = (pokemon.species_name || '').toLowerCase();
            const speciesNameFrLc = currentSpeciesNameFr ? currentSpeciesNameFr.toLowerCase() : null;

            if (nicknameLc && (nicknameLc === speciesNameEnLc || (speciesNameFrLc && nicknameLc === speciesNameFrLc) || pokemon.nickname === `Pokemon_${pokemon.species_id}`)) {
                // On met le surnom par défaut au NOM FR si disponible, sinon au nom anglais capitalisé
                if (targetSpeciesNameFr) newNickname = targetSpeciesNameFr;
                else newNickname = data.name.charAt(0).toUpperCase() + data.name.slice(1);
            }

            // Gestion des PV actuels
            let newCurrentHP = pokemon.currentHP !== undefined ? pokemon.currentHP : newMaxHP;
            
            // Soigner la différence de PV gagnée par l'évolution (optionnel mais sympa)
            // Pour l'instant, on s'assure juste de ne pas dépasser le nouveau max
            if (newCurrentHP > newMaxHP) newCurrentHP = newMaxHP;

            // --- GESTION DES MOVES ---
            // Récupérer les moves que la NOUVELLE espèce aurait dû apprendre jusqu'à ce niveau
            const newLearnableMoves = await this.getAllLearnableMoves(targetSpeciesId, level);
            
            // Fusionner avec l'historique existant
            const existingLearnedMoves = (pokemon.move_learned || []).map(m => (typeof m === 'string' ? m : (m.name || m)));
            const existingMoveNames = new Set(existingLearnedMoves);
            
            const movesToLearn = [];
            for (const move of newLearnableMoves) {
                if (!existingMoveNames.has(move.name)) {
                    movesToLearn.push(move);
                    existingLearnedMoves.push(move.name); // Ajouter à l'historique (string name)
                }
            }

            // Mettre à jour le moveset actif si place disponible
            let currentMoveset = pokemon.moveset || [];
            let movesetUpdated = false;
            
            if (movesToLearn.length > 0) {
                console.log(`[Evolution] ${movesToLearn.length} nouveaux moves potentiels détectés.`);
                
                for (const move of movesToLearn) {
                    if (currentMoveset.length < 4) {
                        currentMoveset.push(move);
                        movesetUpdated = true;
                        console.log(`[Evolution] 💡 Appris automatiquement: ${move.name}`);
                    } else {
                        console.log(`[Evolution] ⚠️ Pas de place pour: ${move.name} (disponible dans l'historique)`);
                    }
                }
            }

            // Préparation de l'update
            const updateFields = { 
                species_id: targetSpeciesId,
                species_name: data.name,
                nickname: newNickname,
                species_name_fr: targetSpeciesNameFr || data.name,
                level: level,
                currentHP: newCurrentHP,
                updatedAt: new Date(),
                move_learned: existingLearnedMoves
            };

            if (movesetUpdated) {
                updateFields.moveset = currentMoveset;
            }

            // Mise à jour BDD
            const updateResult = await collection.updateOne(
                { _id: new ObjectId(pokemonId) },
                { 
                    $set: updateFields,
                    $unset: { stats: "", maxHP: "" } // On nettoie les champs obsolètes
                }
            );

            console.log(`[Evolution] 🌟 ${pokemon.nickname} a évolué en ${data.name} !`);
            
            return { 
                success: true, 
                newSpecies: data.name,
                newId: targetSpeciesId,
                newNickname: newNickname,
                species_name_fr: targetSpeciesNameFr || data.name,
                maxHP: newMaxHP, // Retourné pour info frontend, mais pas stocké
                learnedMovesCount: movesToLearn.length
            };

        } catch (error) {
            console.error('[Evolution] Erreur performEvolution:', error);
            throw error;
        }
    }

    /**
     * Récupère tous les moves qu'un Pokémon aurait pu apprendre jusqu'à un certain niveau
     * (Dupliqué de PokemonDatabaseManager pour éviter dépendance circulaire)
     */
    async getAllLearnableMoves(speciesId, level) {
        try {
            const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}`);
            
            if (!response.ok) return [];
            
            const data = await response.json();
            const learnableMoves = [];
            
            for (const moveEntry of data.moves) {
                for (const versionDetail of moveEntry.version_group_details) {
                    if (versionDetail.move_learn_method.name === 'level-up' && 
                        versionDetail.level_learned_at <= level) {
                        
                        // Récupérer détails
                        try {
                            const moveRes = await fetch(moveEntry.move.url);
                            const moveData = await moveRes.json();
                            
                            learnableMoves.push({
                                name: moveData.name,
                                type: moveData.type.name,
                                category: moveData.damage_class.name,
                                power: moveData.power || 0,
                                accuracy: moveData.accuracy || 100,
                                pp: moveData.pp || 10,
                                maxPP: moveData.pp || 10,
                                learnLevel: versionDetail.level_learned_at
                            });
                        } catch (e) {
                            console.warn(`Erreur fetch move ${moveEntry.move.name}`);
                        }
                        break; // Un seul suffit
                    }
                }
            }
            
            // Trier par niveau d'apprentissage
            return learnableMoves.sort((a, b) => a.learnLevel - b.learnLevel);
            
        } catch (error) {
            console.error('Erreur getAllLearnableMoves (Evolution):', error);
            return [];
        }
    }

    /**
     * Calcule l'XP minimum requis pour un niveau (formule medium-slow)
     */
    calculateXPForLevel(level) {
        if (level <= 1) return 0;
        return Math.floor(1.2 * Math.pow(level, 3) - 15 * Math.pow(level, 2) + 100 * level - 140);
    }
    
    /**
     * Calcule le niveau depuis l'XP (formule medium-slow)
     */
    calculateLevelFromXP(experience) {
        if (!experience || experience < 0) return 1;
        
        for (let level = 1; level <= 100; level++) {
            const xpNeeded = this.calculateXPForLevel(level);
            if (experience < xpNeeded) {
                return level - 1;
            }
        }
        return 100;
    }
}

module.exports = PokemonEvolutionManager;
