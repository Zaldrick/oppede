# 🔴 Phase 1 : Infrastructure Backend Pokémon ✅ COMPLÉTÉE

## 📋 Résumé des modifications

### Fichiers créés :

1. **`managers/PokemonDatabaseManager.js`** (653 lignes)
   - Gère les collections MongoDB : `pokemonSpecies`, `pokemonPlayer`
   - Méthodes principales :
     - `getPlayerTeam(playerId)` - Récupère l'équipe du joueur
     - `getPokemonById(pokemonId)` - Détails d'un Pokémon
     - `createPlayerPokemon(playerId, speciesId, nickname)` - Crée un nouveau Pokémon
     - `reorderTeam(playerId, newOrder)` - Réorganise l'équipe
     - `updatePokemon(pokemonId, updates)` - Mise à jour stats
     - `getWildPokemon(mapId)` - Pokémon sauvage aléatoire
     - `getSpecies(speciesId)` - Récupère une espèce du cache
     - `getPokemonForBattle(pokemonId)` - Prépare un Pokémon pour le combat

   **Routes configurées :**
   - `GET /api/pokemon/team/:playerId` - Équipe complète
   - `GET /api/pokemon/:pokemonId` - Détails Pokémon
   - `POST /api/pokemon/team/reorder` - Réorganiser équipe
   - `POST /api/pokemon/create` - Ajouter Pokémon
   - `PUT /api/pokemon/:pokemonId` - Update stats
   - `GET /api/pokemon/wild/:mapId` - Pokémon sauvage
   - `GET /api/pokemon/species/:id` - Détails espèce

2. **`managers/PokemonPokeAPIManager.js`** (310 lignes)
   - Synchronise avec PokéAPI
   - Respecte le rate limit (250-400ms délai entre requêtes)
   - Méthodes principales :
     - `syncSpecies(start, end)` - Sync un range d'espèces
     - `fetchSpeciesData(pokedexId)` - Récupère données espèce
     - `fetchMoveData(moveName)` - Récupère mouvement
     - `initializeNatures()` - Charge les natures
     - `getNature(natureName)` - Récupère nature et modifieurs
     - `getNatureStatMultiplier(natureName, stat)` - Calcule modificateur
     - `getSprites(pokedexId)` - Récupère sprites
     - `healthCheck()` - Vérifie connexion API

3. **`scripts/seedPokemon.js`** (280 lignes)
   - Script autonome pour peupler la base de données
   - Utilisation :
     ```bash
     # Sync Gen 1 (1-151) - par défaut
     node scripts/seedPokemon.js
     
     # Sync custom range
     node scripts/seedPokemon.js 1 100
     
     # Clear + sync
     node scripts/seedPokemon.js --clear
     ```

### Fichiers modifiés :

1. **`server.js`**
   - ✅ Import `PokemonDatabaseManager`
   - ✅ Import `PokemonPokeAPIManager`
   - ✅ Initialisation des deux managers dans `initializeManagers()`
   - ✅ Appel `setupRoutes()` des managers dans la méthode `setupRoutes()`

---

## 🗄️ Schéma Collections MongoDB

### `pokemonSpecies`
```javascript
{
  _id: ObjectId,
  pokedexId: 25,                    // ID unique Pokédex
  name: "Pikachu",
  types: ["electric"],
  baseStats: {
    hp: 35,
    attack: 55,
    defense: 40,
    sp_attack: 50,
    sp_defense: 50,
    speed: 90
  },
  moves: [
    {
      moveId: 1,
      name: "Thunder-shock",
      type: "electric",
      power: 40,
      accuracy: 100,
      priority: 0,
      category: "special",
      pp: 30
    },
    // ... max 8 mouvements
  ],
  sprites: {
    front: "https://...",
    back: "https://...",
    frontShiny: "https://...",
    backShiny: "https://..."
  },
  height: 4,
  weight: 60,
  baseExperience: 112,
  catchRate: 191,
  custom: false,
  createdAt: ISODate("2025-11-16...")
}
```

### `pokemonPlayer`
```javascript
{
  _id: ObjectId,
  owner_id: ObjectId,               // Ref au joueur
  species_id: 25,                   // Ref espèce (pokedexId)
  species_name: "Pikachu",
  nickname: "PikaPika",
  level: 5,
  experience: 0,
  currentHP: 18,                    // HP actuel
  maxHP: 18,
  ivs: {
    hp: 20,
    attack: 15,
    defense: 12,
    sp_attack: 8,
    sp_defense: 25,
    speed: 31
  },
  evs: {
    hp: 0,
    attack: 0,
    defense: 0,
    sp_attack: 0,
    sp_defense: 0,
    speed: 0
  },
  nature: "timid",                  // Affecte stats +10%/-10%
  moveset: [1, 40, 98],            // Array de moveIds (max 4)
  heldItem: null,                   // ID item ou null
  status: null,                     // { type, turns } ou null
  custom: false,
  teamPosition: 0,                  // 0-5 pour l'ordre équipe
  createdAt: ISODate("2025-11-16..."),
  updatedAt: ISODate("2025-11-16...")
}
```

---

## 🚀 Comment utiliser

### 1️⃣ Synchroniser les données Pokémon

```bash
# Depuis le répertoire racine du projet
node scripts/seedPokemon.js
```

**Temps estimé :** 10-15 minutes pour Gen 1 (151 Pokémon)
**Output** : 
```
✅ Collections initialisées
[PokéAPI] Utilisation de fetch natif
🔄 Début synchronisation PokéAPI (1-151)...
  ✅ 10/151 espèces synchronisées
  ✅ 20/151 espèces synchronisées
  ...
✅ Synchronisation terminée: 151 success, 0 failed, 0 skipped
```

### 2️⃣ Tester l'API

```bash
# Récupérer une espèce (une fois seed terminé)
curl http://localhost:3000/api/pokemon/species/25
# Response: { "success": true, "species": { ... } }

# Créer un Pokémon pour un joueur
curl -X POST http://localhost:3000/api/pokemon/create \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": "USER_ID_HERE",
    "speciesId": 25,
    "nickname": "PikaPika"
  }'

# Récupérer l'équipe d'un joueur
curl http://localhost:3000/api/pokemon/team/USER_ID_HERE

# Réorganiser l'équipe
curl -X POST http://localhost:3000/api/pokemon/team/reorder \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": "USER_ID_HERE",
    "newOrder": ["POKEMON_ID_1", "POKEMON_ID_2", ...]
  }'
```

### 3️⃣ Démarrer le serveur

```bash
npm run server
```

**Vérifier que tout est initialisé :**
```
✅ Collections Pokémon initialisées
✅ PokemonDatabaseManager initialisé
✅ PokemonPokeAPIManager initialisé
✅ Routes configurées
```

---

## 📝 Notes techniques

### Rate Limiting PokéAPI
- Délai de **250-400ms** entre les requêtes
- Évite le throttle de PokéAPI (3-4 req/s max)
- Données cachées dans MongoDB après la 1ère sync

### Calcul HP au combat
```
HP(niveau N) = floor((2 * base_hp + IV_hp + EV_hp/4) * N/100 + N + 5)
Au niveau 5 : HP = floor((2*35 + IV + EV/4)*5/100 + 5 + 5) ≈ 18
```

### Natures disponibles
25 natures (5×5 grid) affectant 2 stats chacune :
- Hardy, Lonely, Brave, Adamant, Naughty
- Bold, Docile, Relaxed, Impish, Lax
- Timid, Hasty, Serious, Jolly, Naive
- Modest, Mild, Quiet, Bashful, Rash
- Calm, Gentle, Sassy, Careful, Quirky

---

## ✅ Checklist Phase 1

- [x] `PokemonDatabaseManager.js` - Collections MongoDB + CRUD
- [x] `PokemonPokeAPIManager.js` - Sync PokéAPI
- [x] Routes API complètes (7 endpoints)
- [x] Intégration dans `server.js`
- [x] Script `seedPokemon.js`
- [x] Documentation

---

## 🔗 Prochaines étapes (Phase 2)

- **Frontend :** PokemonTeamScene.js + PokemonDetailScene.js
- **Gestion équipe :** Affichage, réorganisation, sélection
- **Intégration MainMenuScene :** Lien vers équipe Pokémon

**Status :** ✅ Phase 1 complétée | ⏳ Prêt pour Phase 2
