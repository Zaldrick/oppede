/**
 * TranslationManager.js
 * Gestion des traductions FR pour Pokémon et moves via cache DB + PokeAPI
 * 
 * Collections MongoDB:
 * - translations_pokemon: { species_id, name_en, name_fr }
 * - translations_moves: { move_name_en, name_fr, description_fr }
 */

class TranslationManager {
    constructor(databaseManager) {
        this.databaseManager = databaseManager;
        this.pokemonTranslations = null;
        this.moveTranslations = null;
        console.log('[TranslationManager] Initialisé');
    }

    /**
     * Initialise les collections (appelé au démarrage)
     */
    async initialize() {
        const db = await this.databaseManager.connectToDatabase();
        this.pokemonTranslations = db.collection('translations_pokemon');
        this.moveTranslations = db.collection('translations_moves');

        // Créer index pour performances
        await this.pokemonTranslations.createIndex({ species_id: 1 }, { unique: true });
        await this.moveTranslations.createIndex({ move_name_en: 1 }, { unique: true });

        console.log('[TranslationManager] Collections initialisées');
    }

    /**
     * Configure les routes Express
     */
    setupRoutes(app) {
        console.log('[TranslationManager] Configuration des routes...');

        // Récupérer nom FR d'un Pokémon
        app.get('/api/translations/pokemon/:speciesId', async (req, res) => {
            try {
                const { speciesId } = req.params;
                const name = await this.getPokemonNameFR(parseInt(speciesId));
                res.json({ success: true, name_fr: name });
            } catch (error) {
                console.error('Erreur traduction Pokémon:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Récupérer nom FR d'un move
        app.get('/api/translations/move/:moveName', async (req, res) => {
            try {
                const { moveName } = req.params;
                const translation = await this.getMoveNameFR(moveName);
                res.json({ success: true, ...translation });
            } catch (error) {
                console.error('Erreur traduction move:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Batch: traduire plusieurs Pokémon
        app.post('/api/translations/pokemon/batch', async (req, res) => {
            try {
                const { speciesIds } = req.body;
                const translations = {};
                
                for (const id of speciesIds) {
                    translations[id] = await this.getPokemonNameFR(id);
                }

                res.json({ success: true, translations });
            } catch (error) {
                console.error('Erreur batch traduction:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });
    }

    /**
     * Récupérer nom FR d'un Pokémon (cache DB → PokeAPI si absent)
     */
    async getPokemonNameFR(speciesId) {
        try {
            // 1. Vérifier cache DB
            let cached = await this.pokemonTranslations.findOne({ species_id: speciesId });
            
            if (cached) {
                return cached.name_fr;
            }

            // 2. Appel PokeAPI pour récupérer traduction
            console.log(`[Translation] Récupération FR pour Pokémon ${speciesId} via PokeAPI...`);
            
            const response = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${speciesId}`);
            if (!response.ok) throw new Error(`PokeAPI error: ${response.status}`);
            
            const speciesData = await response.json();

            // Extraire nom FR
            const frName = speciesData.names.find(n => n.language.name === 'fr');
            const enName = speciesData.names.find(n => n.language.name === 'en');

            const nameFR = frName ? frName.name : (enName ? enName.name : speciesData.name);
            const nameEN = enName ? enName.name : speciesData.name;

            // 3. Sauvegarder en cache
            await this.pokemonTranslations.updateOne(
                { species_id: speciesId },
                { 
                    $set: { 
                        species_id: speciesId,
                        name_en: nameEN,
                        name_fr: nameFR,
                        cached_at: new Date()
                    } 
                },
                { upsert: true }
            );

            console.log(`  ✅ ${nameEN} → ${nameFR}`);
            return nameFR;

        } catch (error) {
            console.error(`[Translation] Erreur Pokémon ${speciesId}:`, error);
            return `Pokemon #${speciesId}`; // Fallback
        }
    }

    /**
     * Récupérer nom FR d'un move (cache DB → PokeAPI si absent)
     */
    async getMoveNameFR(moveNameEN) {
        try {
            const normalizedName = moveNameEN.toLowerCase().trim();

            // 1. Vérifier cache DB
            let cached = await this.moveTranslations.findOne({ move_name_en: normalizedName });
            
            if (cached) {
                return { 
                    name_fr: cached.name_fr, 
                    description_fr: cached.description_fr 
                };
            }

            // 2. Appel PokeAPI
            console.log(`[Translation] Récupération FR pour move "${normalizedName}" via PokeAPI...`);
            
            const response = await fetch(`https://pokeapi.co/api/v2/move/${normalizedName}`);
            if (!response.ok) throw new Error(`PokeAPI error: ${response.status}`);
            
            const moveData = await response.json();

            // Extraire nom et description FR
            const frName = moveData.names.find(n => n.language.name === 'fr');
            const frDesc = moveData.flavor_text_entries.find(f => f.language.name === 'fr');
            const enName = moveData.names.find(n => n.language.name === 'en');

            const nameFR = frName ? frName.name : (enName ? enName.name : normalizedName);
            const descFR = frDesc ? frDesc.flavor_text : '';

            // 3. Sauvegarder en cache
            await this.moveTranslations.updateOne(
                { move_name_en: normalizedName },
                { 
                    $set: { 
                        move_name_en: normalizedName,
                        name_fr: nameFR,
                        description_fr: descFR,
                        cached_at: new Date()
                    } 
                },
                { upsert: true }
            );

            console.log(`  ✅ ${normalizedName} → ${nameFR}`);
            return { name_fr: nameFR, description_fr: descFR };

        } catch (error) {
            console.error(`[Translation] Erreur move "${moveNameEN}":`, error);
            return { name_fr: moveNameEN, description_fr: '' }; // Fallback
        }
    }

    /**
     * Traduire un Pokémon complet (objet avec species_id et species_name)
     */
    async translatePokemon(pokemon) {
        if (!pokemon) return pokemon;

        const nameFR = await this.getPokemonNameFR(pokemon.species_id);
        return {
            ...pokemon,
            species_name_fr: nameFR,
            nickname: pokemon.nickname || nameFR // Utiliser nom FR si pas de surnom
        };
    }

    /**
     * Traduire un moveset complet
     */
    async translateMoveset(moveset) {
        if (!moveset || !Array.isArray(moveset)) return moveset;

        const translated = [];
        for (const move of moveset) {
            const { name_fr } = await this.getMoveNameFR(move.name);
            translated.push({
                ...move,
                name_fr: name_fr,
                display_name: name_fr // Nom à afficher
            });
        }

        return translated;
    }
}

module.exports = TranslationManager;
