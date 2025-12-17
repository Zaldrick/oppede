/**
 * seedPlayerPokemon.js
 * Script pour ajouter des Pokémon au joueur dans la nouvelle architecture lazy-loading
 * 
 * Architecture: Pokémon stockés en DB (pokemonPlayer), espèces chargées lazy depuis PokéAPI
 * 
 * Usage:
 *   node scripts/seedPlayerPokemon.js                    // Seed tous les joueurs avec des Pokémon
 *   node scripts/seedPlayerPokemon.js "Marin"            // Seed un joueur spécifique
 *   node scripts/seedPlayerPokemon.js --clear "Marin"    // Supprimer Pokémon d'un joueur
 *   node scripts/seedPlayerPokemon.js --clear-all        // Supprimer tous les Pokémon joueur
 * 
 * Configuration:
 *   Modifiez PLAYER_POKEMON_TEMPLATES ci-dessous pour ajouter des Pokémon à des joueurs
 */

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

let _fetch = null;
async function getFetch() {
    if (_fetch) return _fetch;
    if (typeof fetch === 'function') {
        _fetch = fetch;
        return _fetch;
    }
    _fetch = (await import('node-fetch')).default;
    return _fetch;
}

async function fetchJson(url) {
    try {
        const f = await getFetch();
        const res = await f(url);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.warn(`[seedPlayerPokemon] fetch failed: ${url} (${e.message})`);
        return null;
    }
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://zaldrick:xtHDAM0ZFpq2iL9L@oppede.zfhlzph.mongodb.net/oppede';

/**
 * Dictionnaire des noms Pokémon en français (Gen 1 - 151 Pokémon)
 */
const POKEMON_FRENCH_NAMES = {
    1: 'Bulbizarre', 2: 'Herbizarre', 3: 'Florizarre', 4: 'Salamèche', 5: 'Reptincel', 
    6: 'Dracaufeu', 7: 'Carapuce', 8: 'Carabaffe', 9: 'Tortank', 10: 'Chenipan',
    11: 'Chrysacier', 12: 'Papilusion', 13: 'Aspicot', 14: 'Coconfort', 15: 'Dardargnan',
    16: 'Roucoups', 17: 'Roucoupe', 18: 'Roucarnage', 19: 'Rattata', 20: 'Rattatac',
    21: 'Piafabec', 22: 'Rapasdepic', 23: 'Abo', 24: 'Arbok', 25: 'Pikachu',
    26: 'Raichu', 27: 'Sabelette', 28: 'Sablaireau', 29: 'Mélofée', 30: 'Mélofée',
    31: 'Rondoudou', 32: 'Grodoudou', 33: 'Nosferapti', 34: 'Nosferapti', 35: 'Mélofée',
    36: 'Clefable', 37: 'Goupix', 38: 'Renégon', 39: 'Rondoudou', 40: 'Grodoudou',
    41: 'Nosferapti', 42: 'Nosferalto', 43: 'Glaucéma', 44: 'Glaucémaglaucé', 45: 'Florizarre',
    46: 'Paras', 47: 'Parasect', 48: 'Mimitoss', 49: 'Aéromite', 50: 'Taupe',
    51: 'Triopikeur', 52: 'Félineux', 53: 'Félinochat', 54: 'Psykokwak', 55: 'Akwakwak',
    56: 'Félineux', 57: 'Félinochat', 58: 'Caninos', 59: 'Arcanin', 60: 'Têtarte',
    61: 'Têtarterne', 62: 'Tartard', 63: 'Abra', 64: 'Kadabra', 65: 'Alakazam',
    66: 'Machop', 67: 'Machopeur', 68: 'Mackogneur', 69: 'Chétiflor', 70: 'Boustiflor',
    71: 'Empiflor', 72: 'Tentacool', 73: 'Tentacruel', 74: 'Racaillou', 75: 'Gronderre',
    76: 'Grolem', 77: 'Ponyta', 78: 'Gallame', 79: 'Ramoloss', 80: 'Flagadoss',
    81: 'Magnéti', 82: 'Magnéton', 83: 'Canarticho', 84: 'Doduo', 85: 'Dodrio',
    86: 'Otaria', 87: 'Lamantine', 88: 'Tadmorv', 89: 'Grotadmorv', 90: 'Kokiyas',
    91: 'Tentacool', 92: 'Spectreh', 93: 'Spectres', 94: 'Ectoplasma', 95: 'Onix',
    96: 'Soporifik', 97: 'Hypnomade', 98: 'Crustabri', 99: 'Crustabri', 100: 'Voltorbe',
    101: 'Électrode', 102: 'Nœunœuf', 103: 'Noadkoko', 104: 'Ossatueur', 105: 'Osselait',
    106: 'Kicklee', 107: 'Tygnon', 108: 'Excelangue', 109: 'Smogo', 110: 'Smogogo',
    111: 'Rhinocorne', 112: 'Rhinoféros', 113: 'Leveinard', 114: 'Saquedeneu', 115: 'Kangourex',
    116: 'Hippopotame', 117: 'Hippodonte', 118: 'Hypotrempe', 119: 'Hypocéan', 120: 'Poliwag',
    121: 'Poliwrath', 122: 'AbomSnow', 123: 'Insécateur', 124: 'Lokhlass', 125: 'Électrode',
    126: 'Magnemite', 127: 'Scarabrute', 128: 'Tauros', 129: 'Magicarpe', 130: 'Léviator',
    131: 'Lokhlass', 132: 'Métamorph', 133: 'Évoli', 134: 'Aquali', 135: 'Voltali',
    136: 'Pyroli', 137: 'Porygon', 138: 'Amonita', 139: 'Amonistar', 140: 'Kabuto',
    141: 'Kabutops', 142: 'Ptéra', 143: 'Ronflex', 144: 'Artikodin', 145: 'Électhor',
    146: 'Sulfura', 147: 'Minidraco', 148: 'Draco', 149: 'Dracolosse', 150: 'Mewtwo',
    151: 'Mew'
};

/**
 * Natures Pokémon (25 au total)
 */
const NATURES_FRENCH = [
    'Audacieuse', 'Solitaire', 'Brave', 'Triste', 'Docile',
    'Assuré', 'Calme', 'Modeste', 'Doux', 'Agressif',
    'Timide', 'Pressé', 'Sérieux', 'Joyeux', 'Naïf',
    'Modéré', 'Doux', 'Silencieux', 'Honteux', 'Agressif',
    'Calme', 'Tendre', 'Chic', 'Prudent', 'Farfelu'
];

/**
 * Configuration: Pokémon à ajouter à chaque joueur (species_id Gen 1)
 * Format: { pseudo: "nom", pokemons: [pokedexId, ...] }
 */
const PLAYER_POKEMON_TEMPLATES = [
    {
        // 🆕 Pokémons custom (clones) pour tests
        // Détection côté client via nickname (Gaara/Floki/Tanuki/Sirius)
        pseudo: "Admin",
        pokemons: [
            { speciesId: 552, nickname: 'Gaara' },  // clone Escroco
            { speciesId: 471, nickname: 'Floki' },  // clone Givrali
            { speciesId: 405, nickname: 'Tanuki' }, // clone Luxray
            { speciesId: 59, nickname: 'Sirius' }   // clone Arcanin
        ]
    },
    {
        pseudo: "Marin",
        pokemons: [1, 4, 7, 25, 39, 54]  // Bulbizarre, Salamèche, Carapuce, Pikachu, Rondoudou, Psykokwak
    },
    {
        pseudo: "Mehdi",
        pokemons: [6, 3, 9, 35, 58, 63]  // Dracaufeu, Florizarre, Tortank, Mélofée, Caninos, Abra
    },
    {
        pseudo: "Jo",
        pokemons: [5, 8, 23, 16, 20, 41]  // Reptincel, Carabaffe, Abo, Roucoups, Rattatac, Nosferapti
    }
];

class PlayerPokemonSeeder {
    constructor(mongoUri) {
        this.mongoUri = mongoUri;
        this.mongoClient = null;
        this.db = null;
        this.playersCollection = null;
        this.pokemonPlayerCollection = null;
    }

    async connect() {
        if (!this.mongoClient) {
            this.mongoClient = new MongoClient(this.mongoUri, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            await this.mongoClient.connect();
        }
        this.db = this.mongoClient.db('oppede');
        this.playersCollection = this.db.collection('players');
        this.pokemonPlayerCollection = this.db.collection('pokemonPlayer');
        
        console.log('✅ Connexion MongoDB établie');
    }

    async close() {
        if (this.mongoClient) {
            await this.mongoClient.close();
        }
    }

    /**
     * Récupère un joueur par pseudo
     */
    async getPlayerByPseudo(pseudo) {
        const player = await this.playersCollection.findOne({ pseudo });
        if (!player) {
            console.warn(`⚠️  Joueur "${pseudo}" non trouvé`);
            return null;
        }
        return player;
    }

    /**
     * Récupère le nom français d'un Pokémon
     */
    getFrenchName(pokedexId) {
        return POKEMON_FRENCH_NAMES[pokedexId] || `Pokemon_${pokedexId}`;
    }

    /**
     * Calcule l'XP pour le niveau 5
     * Formule Gen V: XP = (n^3 * 4/5) - (3n^2 * 1/5) + 2n - 1
     * Pour level 5 (seuil d'arrivée): ~1000 XP
     */
    calculateXpForLevel(level) {
        if (level <= 1) return 0;
        // Formule exponentielle simplifiée
        return Math.floor(Math.pow(level, 3) * 0.8);
    }

    /**
     * Crée un Pokémon joueur avec stats correctes
     * niveau: 5, XP = 224 (pour atteindre level 5)
     */
    async createPlayerPokemon(playerId, speciesId, position = null, nickname = null) {
        try {
            const frenchName = this.getFrenchName(speciesId);
            const finalNickname = nickname || frenchName;

            // 🆕 Construire un moveset cohérent (objets moves) via PokeAPI
            // Le système de combat attend des moves sous forme d'objets: { name, type, category, power, accuracy, pp, maxPP }
            const level = 5;
            const moveset = await this.getMovesetForLevel(speciesId, level);

            // Générer des IV aléatoires (0-31)
            const ivs = {
                hp: Math.floor(Math.random() * 32),
                attack: Math.floor(Math.random() * 32),
                defense: Math.floor(Math.random() * 32),
                sp_attack: Math.floor(Math.random() * 32),
                sp_defense: Math.floor(Math.random() * 32),
                speed: Math.floor(Math.random() * 32)
            };

            // EV initiaux à 0
            const evs = {
                hp: 0,
                attack: 0,
                defense: 0,
                sp_attack: 0,
                sp_defense: 0,
                speed: 0
            };

            // Nature aléatoire (en français)
            const nature = NATURES_FRENCH[Math.floor(Math.random() * NATURES_FRENCH.length)];

            // Calcul HP au niveau 5
            // Formule Gen V: HP = ((2 * baseStat + IV + EV/4) * level / 100) + level + 5
            // Stats de base moyennes pour Gen 1: ~50 HP
            const baseHP = 50;
            const hpLevel5 = Math.floor(((2 * baseHP + ivs.hp + 0) * 5 / 100) + 5 + 5);

            // XP pour level 5
            // XP = (n^3 * 4/5) - (3n^2 * 1/5) + 2n - 1
            const xpForLevel5 = Math.floor((Math.pow(5, 3) * 4 / 5) - (3 * Math.pow(5, 2) * 1 / 5) + 2 * 5 - 1);
            const result = await this.pokemonPlayerCollection.insertOne({
                owner_id: playerId,
                species_id: speciesId,
                species_name: frenchName,
                nickname: finalNickname,
                level,
                experience: xpForLevel5,
                currentHP: hpLevel5,
                maxHP: hpLevel5,
                ivs,
                evs,
                nature,
                moveset,  // 🆕 Objets moves compatibles combat
                heldItem: null,
                status: null,
                custom: false,
                position: position,  // Position dans l'équipe (1-6) ou null
                createdAt: new Date(),
                updatedAt: new Date()
            });

            return result.insertedId;
        } catch (error) {
            console.error(`❌ Erreur création Pokémon:`, error.message);
            return null;
        }
    }

    /**
     * 🆕 Génère un moveset (max 4) compatible combat pour un niveau donné.
     * Stratégie: prendre les derniers moves appris par level-up (<= level) sur scarlet-violet.
     */
    async getMovesetForLevel(speciesId, level) {
        const pokemonData = await fetchJson(`https://pokeapi.co/api/v2/pokemon/${speciesId}`);
        if (!pokemonData?.moves) {
            return [
                { name: 'tackle', type: 'normal', category: 'physical', power: 40, accuracy: 100, pp: 35, maxPP: 35 }
            ];
        }

        const learnable = [];
        for (const moveEntry of pokemonData.moves) {
            const details = moveEntry.version_group_details || [];
            const sv = details.find(d =>
                d.version_group?.name === 'scarlet-violet' &&
                d.move_learn_method?.name === 'level-up' &&
                typeof d.level_learned_at === 'number' &&
                d.level_learned_at > 0 &&
                d.level_learned_at <= level
            );
            if (sv) {
                learnable.push({
                    name: moveEntry.move?.name,
                    url: moveEntry.move?.url,
                    learnLevel: sv.level_learned_at
                });
            }
        }

        learnable.sort((a, b) => a.learnLevel - b.learnLevel);
        const selected = learnable.slice(-4);

        if (selected.length === 0) {
            return [
                { name: 'tackle', type: 'normal', category: 'physical', power: 40, accuracy: 100, pp: 35, maxPP: 35 }
            ];
        }

        const moves = [];
        for (const m of selected) {
            if (!m?.url) continue;
            const moveData = await fetchJson(m.url);
            if (!moveData) continue;

            moves.push({
                name: moveData.name,
                type: moveData.type?.name || 'normal',
                category: moveData.damage_class?.name || 'physical',
                power: moveData.power || 0,
                accuracy: moveData.accuracy ?? 100,
                pp: moveData.pp || 10,
                maxPP: moveData.pp || 10
            });
        }

        return moves.length > 0 ? moves : [
            { name: 'tackle', type: 'normal', category: 'physical', power: 40, accuracy: 100, pp: 35, maxPP: 35 }
        ];
    }

    /**
     * Ajoute des Pokémon à un joueur
     */
    async addPokemonToPlayer(pseudo, entries) {
        const player = await this.getPlayerByPseudo(pseudo);
        if (!player) return 0;

        console.log(`\n📝 Ajout de Pokémon au joueur "${pseudo}"...`);
        let added = 0;

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const pokedexId = (typeof entry === 'number') ? entry : entry?.speciesId;
            const nickname = (typeof entry === 'object' && entry) ? entry.nickname : null;

            const frenchName = this.getFrenchName(pokedexId);
            if (!frenchName) {
                console.warn(`  ⚠️  Pokémon ID ${pokedexId} non trouvé - passage`);
                continue;
            }
            // Position dans l'équipe: i+1 (positions 1-6)
            const position = (i < 6) ? (i + 1) : null;
            const result = await this.createPlayerPokemon(player._id, pokedexId, position, nickname);
            if (result) {
                console.log(`  ✅ ${(nickname || frenchName)} (ID: ${pokedexId}, Lvl 5, Position ${position}) ajouté`);
                added++;
            }
        }

        console.log(`  ✅ ${added}/${entries.length} Pokémon ajoutés à ${pseudo}\n`);
        return added;
    }

    /**
     * Supprime tous les Pokémon d'un joueur
     */
    async clearPlayerPokemon(pseudo) {
        const player = await this.getPlayerByPseudo(pseudo);
        if (!player) return 0;

        const result = await this.pokemonPlayerCollection.deleteMany({
            owner_id: player._id
        });

        console.log(`🗑️  ${result.deletedCount} Pokémon supprimés pour ${pseudo}`);
        return result.deletedCount;
    }

    /**
     * Supprime tous les Pokémon joueur de la base
     */
    async clearAllPlayerPokemon() {
        const result = await this.pokemonPlayerCollection.deleteMany({});
        console.log(`🗑️  ${result.deletedCount} Pokémon joueur supprimés de la base`);
        return result.deletedCount;
    }

    /**
     * Liste tous les joueurs et leurs Pokémon
     */
    async listAllPlayers() {
        console.log('\n📊 Joueurs et leurs Pokémon:');
        console.log('═'.repeat(70));

        const players = await this.playersCollection.find({}).toArray();

        for (const player of players) {
            const pokemons = await this.pokemonPlayerCollection.find({
                owner_id: player._id
            }).toArray();

            if (pokemons.length === 0) {
                console.log(`👤 ${player.pseudo} - 0 Pokémon`);
            } else {
                console.log(`👤 ${player.pseudo} - ${pokemons.length} Pokémon:`);
                pokemons.forEach((poke, idx) => {
                    console.log(`   ${idx + 1}. ${poke.nickname} (${poke.species_name}) - Lvl ${poke.level}, ${poke.currentHP}/${poke.maxHP} HP`);
                });
            }
        }

        console.log('═'.repeat(70) + '\n');
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    const seeder = new PlayerPokemonSeeder(MONGO_URI);

    try {
        await seeder.connect();

        // Option 1: --clear-all (supprime tous les Pokémon joueur)
        if (args.includes('--clear-all')) {
            console.log('🚀 Mode: Suppression complète + seed');
            await seeder.clearAllPlayerPokemon();
            
            // Seed tous les templates
            for (const template of PLAYER_POKEMON_TEMPLATES) {
                await seeder.addPokemonToPlayer(template.pseudo, template.pokemons);
            }
            
            await seeder.listAllPlayers();
            console.log('✅ Seed terminé avec succès!');
            return;
        }

        // Option 2: --clear "pseudo" (supprime Pokémon d'un joueur spécifique)
        if (args[0] === '--clear' && args[1]) {
            const pseudo = args[1];
            await seeder.clearPlayerPokemon(pseudo);
            await seeder.listAllPlayers();
            return;
        }

        // Option 3: Pseudo spécifique
        if (args.length > 0 && !args[0].startsWith('--')) {
            const pseudo = args[0];
            const template = PLAYER_POKEMON_TEMPLATES.find(t => t.pseudo === pseudo);
            
            if (template) {
                await seeder.addPokemonToPlayer(pseudo, template.pokemons);
            } else {
                console.warn(`⚠️  Aucune config trouvée pour "${pseudo}"`);
                console.log(`\nPseudos disponibles:`);
                PLAYER_POKEMON_TEMPLATES.forEach(t => {
                    const names = t.pokemons.map(p => {
                        const id = (typeof p === 'number') ? p : p?.speciesId;
                        const nick = (typeof p === 'object' && p) ? p.nickname : null;
                        return nick || (POKEMON_FRENCH_NAMES[id] || `Pokemon_${id}`);
                    });
                    console.log(`  - ${t.pseudo}: ${names.join(', ')}`);
                });
            }
            
            await seeder.listAllPlayers();
            return;
        }

        // Option 4: Défaut - seed tous les templates
        console.log('🚀 Mode: Seed tous les joueurs');
        console.log('\nTemplates configurés:');
        PLAYER_POKEMON_TEMPLATES.forEach(t => {
            const names = t.pokemons.map(id => POKEMON_FRENCH_NAMES[id] || `Pokemon_${id}`);
            console.log(`  - ${t.pseudo}: ${names.join(', ')}`);
        });
        for (const template of PLAYER_POKEMON_TEMPLATES) {
            await seeder.addPokemonToPlayer(template.pseudo, template.pokemons);
        }

        await seeder.listAllPlayers();
        console.log('✅ Seed terminé avec succès!');

    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    } finally {
        await seeder.close();
    }
}

main();
