# 🔄 Nouveau Système Pokémon (Lazy Loading)

## 🎯 Architecture

### Avant (Compliqué)
- Sync PokéAPI → MongoDB (long, maintenance BDD)
- Requête → Serveur → BDD pour chaque détail
- Stock énorme de données inutiles

### Après (Simple)
```
Client → PokéAPI (lazy fetch au besoin)
         ↓
      Cache local
         ↓
      Affichage
```

---

## 🚀 Flux de données

### 1. Chargement équipe
```javascript
// PokemonManager.getTeam(playerId)
// ↓ Appel API serveur
// GET /api/pokemon/team/playerId
// ↓ Retourne Pokémon joueur avec species_id
```

### 2. Enrichissement (lazy)
```javascript
// PokemonManager.getSpecies(species_id)
// ↓ Vérifie cache local
// ↓ Si pas en cache → PokemonAPIManager.getPokemonData(pokedexId)
// ↓ Fetch PokéAPI (chemins spécifiques)
// ↓ Cache + retourne
```

### 3. Affichage
```javascript
// PokemonTeamScene utilise speciesData
// - Sprite menu: Gen VII (Ultra Sun/Moon)
// - Nom français: pokemonNames.js
// - Types colorés: pokemonNames.js
```

---

## 📍 Chemins PokéAPI utilisés

### Menu Sprite (160x144, style RPG)
```
pokemon.sprites.versions['generation-vii']['ultra-sun-ultra-moon'].front_default
```

### Front Combat (animé, 96x96)
```
pokemon.sprites.versions['generation-v']['black-white'].animated.front_default
```

### Back Combat (animé, 96x96)
```
pokemon.sprites.versions['generation-v']['black-white'].animated.back_default
```

---

## 🗂️ Fichiers clés

### `src/managers/PokemonAPIManager.js` (NOUVEAU)
- Fetch lazy depuis PokéAPI
- Cache local en mémoire
- Rate limiting (300ms entre requêtes)
- Retourne sprites + noms français

### `src/managers/PokemonManager.js` (Modifié)
- Utilise `PokemonAPIManager` pour espèces
- Plus de décodage compliqué

### `src/utils/pokemonNames.js`
- Dictionnaire 151 noms français
- Couleurs types
- Traductions

### `src/PokemonTeamScene.js` (Refactorisé)
- Lazy load au affichage
- Utilise sprites menu
- Noms français automatiques

---

## ✅ Avantages

| Aspect | Avant | Après |
|--------|-------|-------|
| BDD | 151 Pokémon stockés | Rien (lazy) |
| Cache | Serveur | Client local |
| Temps démarrage | 10-15 min (seed) | ~0s |
| Maintenance | Synchroniser PokéAPI | Rien |
| Qualité sprites | Limitée | Complète PokéAPI |
| Noms français | BDD | Fichier local |

---

## 🔧 Usage

### Créer Pokémon (serveur)
```bash
POST /api/pokemon/create
{
  "playerId": "...",
  "speciesId": 1,  // Bulbizarre
  "position": 1     // Dans équipe
}
```

### Afficher équipe
```javascript
const team = await pokemonManager.getTeam(playerId);
// ↓ Lazy enrichissement
const enriched = await Promise.all(
  team.map(p => pokemonManager.getSpecies(p.species_id))
);
// ↓ Affichage avec sprites + noms FR
```

---

## 🎮 Exemple équipe Marin

```
#1 Bulbizarre    Nv5  [Plante | Poison]  PV:20/20
   Sprite: Gen VII (menu)

#2 Salamèche     Nv5  [Feu]              PV:20/20
   Sprite: Gen VII (menu)

...
```

---

## 📝 Notes

- ✅ Pas besoin de seed database
- ✅ Noms français automatiques
- ✅ Sprites optimisés (3 versions)
- ✅ Cache local = performance
- ✅ Rate limiting = pas de throttle PokéAPI
- ⚠️ Première requête est plus lente (network)
- ⚠️ Cache effacé au refresh (amélioration possible: localStorage)

---

## 🚀 Prochaines étapes

1. Combat avec sprites front/back
2. Moves détails depuis PokéAPI
3. Persistent cache (localStorage)
4. Gestion évolutions (voir PokéAPI)
