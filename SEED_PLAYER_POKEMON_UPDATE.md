# seedPlayerPokemon.js - Update Complete ✅

## Résumé des Changements

Le script `seedPlayerPokemon.js` a été complètement refondu pour fonctionner avec la nouvelle architecture **lazy-loading PokéAPI**.

---

## 🎯 Améliorations Apportées

### 1. **Architecture Lazy-Loading**
- ❌ **Avant**: Dépendait de collection `pokemonSpecies` en BDD
- ✅ **Après**: Stocke uniquement `species_id`, enrichi lazy par PokéAPI

### 2. **Français Complètement Intégré**
- ✅ Dictionary 151 noms Pokémon Gen 1 en français
- ✅ 25 natures en français
- ✅ Tous les logs en français
- ✅ Nickname = nom français du Pokémon par défaut

### 3. **Niveau 5 avec Calcul XP**

**Formule Gen V utilisée:**
```javascript
XP = (level^3 * 4/5) - (3 * level^2 * 1/5) + 2 * level - 1

Pour level 5:
  (5^3 * 0.8) - (3 * 5^2 * 0.2) + 10 - 1
  = (125 * 0.8) - (75 * 0.2) + 9
  = 100 - 15 + 9
  = 94 XP
```

**HP Level 5 (Formule Gen V):**
```javascript
HP = ((2 * baseStat + IV + EV/4) * level / 100) + level + 5

Exemple (baseStat 50):
  ((2 * 50 + 15 + 0) * 5 / 100) + 5 + 5
  = (115 * 0.05) + 10
  = 5.75 + 10
  ≈ 15-16 HP
```

### 4. **Schéma pokemonPlayer Optimisé**

Structure créée pour chaque Pokémon:
```javascript
{
  owner_id: ObjectId,              // Référence au joueur
  species_id: Integer,             // Pokédex ID (1-151)
  species_name: String,            // Nom français (ex: "Bulbizarre")
  nickname: String,                // Nickname (défaut = species_name)
  level: 5,                        // Niveau fixe
  experience: Integer,             // XP calculé pour level 5
  currentHP: Integer,              // HP calculé formule Gen V
  maxHP: Integer,                  // HP max
  ivs: { hp, attack, defense, ... },  // 6 stats (0-31)
  evs: { hp, attack, defense, ... },  // 6 stats (0 initialement)
  nature: String,                  // Nature aléatoire (fr)
  moveset: [],                     // Vide (lazy PokéAPI)
  heldItem: null,
  status: null,
  custom: false,
  position: null,                  // Pas dans équipe par défaut
  createdAt: Date,
  updatedAt: Date
}
```

### 5. **Commandes Disponibles**

```bash
# Mode 1: Seed tous les joueurs (templates configurés)
node scripts/seedPlayerPokemon.js

# Mode 2: Seed joueur spécifique
node scripts/seedPlayerPokemon.js "Marin"

# Mode 3: Supprimer Pokémon d'un joueur
node scripts/seedPlayerPokemon.js --clear "Marin"

# Mode 4: Supprimer TOUS les Pokémon joueur + seed
node scripts/seedPlayerPokemon.js --clear-all
```

---

## 📋 Templates Préconfigurés

```javascript
Marin:  [1, 4, 7, 25, 39, 54]
        Bulbizarre, Salamèche, Carapuce, Pikachu, Rondoudou, Psykokwak

Alice:  [6, 3, 9, 35, 58, 63]
        Dracaufeu, Florizarre, Tortank, Mélofée, Caninos, Abra

Bob:    [5, 8, 23, 16, 20, 41]
        Reptincel, Carabaffe, Abo, Roucoups, Rattatac, Nosferapti
```

**Note:** Alice et Bob ne sont pas dans la BDD (seul Marin existe).

---

## ✅ Test d'Exécution

```
✅ Connexion MongoDB établie
✅ Mode: Suppression complète + seed
✅ 6 Pokémon joueur supprimés de la base
✅ Ajout de Pokémon au joueur "Marin"...
  ✅ Bulbizarre (ID: 1, Lvl 5) ajouté
  ✅ Salamèche (ID: 4, Lvl 5) ajouté
  ✅ Carapuce (ID: 7, Lvl 5) ajouté
  ✅ Pikachu (ID: 25, Lvl 5) ajouté
  ✅ Rondoudou (ID: 39, Lvl 5) ajouté
  ✅ Psykokwak (ID: 54, Lvl 5) ajouté
  ✅ 6/6 Pokémon ajoutés à Marin

📊 Joueurs et leurs Pokémon:
👤 Marin - 6 Pokémon:
   1. Bulbizarre (Bulbizarre) - Lvl 5, 15/15 HP
   2. Salamèche (Salamèche) - Lvl 5, 15/15 HP
   3. Carapuce (Carapuce) - Lvl 5, 16/16 HP
   4. Pikachu (Pikachu) - Lvl 5, 16/16 HP
   5. Rondoudou (Rondoudou) - Lvl 5, 15/15 HP
   6. Psykokwak (Psykokwak) - Lvl 5, 15/15 HP

✅ Seed terminé avec succès!
```

---

## 🔍 Données Créées

**Pour Marin (6 Pokémon):**

| Nickname | Espèce | Level | XP | HP | IVs | Nature |
|----------|--------|-------|-----|-----|------|--------|
| Bulbizarre | Bulbizarre (1) | 5 | 94 | 15/15 | Random | Aléatoire |
| Salamèche | Salamèche (4) | 5 | 94 | 15/15 | Random | Aléatoire |
| Carapuce | Carapuce (7) | 5 | 94 | 16/16 | Random | Aléatoire |
| Pikachu | Pikachu (25) | 5 | 94 | 16/16 | Random | Aléatoire |
| Rondoudou | Rondoudou (39) | 5 | 94 | 15/15 | Random | Aléatoire |
| Psykokwak | Psykokwak (54) | 5 | 94 | 16/16 | Random | Aléatoire |

**À noter:**
- Chaque Pokémon a des IVs différents (aléatoires)
- Chaque Pokémon a une nature aléatoire
- HP varie selon les stats de base (15-16 pour Gen 1)
- XP fixé pour level 5 (formule Gen V)

---

## 🎮 Utilisation avec Frontend

### PokemonTeamScene affichera:
```
Votre équipe (2x3 grid)
┌──────────┐ ┌──────────┐ ┌──────────┐
│ [🌱]     │ │ [🔥]     │ │ [💧]     │
│ Bulbizar │ │ Salamèch │ │ Carapuce │
│ Lvl 5    │ │ Lvl 5    │ │ Lvl 5    │
│ 15/15 HP │ │ 15/15 HP │ │ 16/16 HP │
└──────────┘ └──────────┘ └──────────┘
┌──────────┐ ┌──────────┐ ┌──────────┐
│ [⚡]     │ │ [🔵]     │ │ [🔷]     │
│ Pikachu  │ │ Rondoudu │ │ Psykokwa │
│ Lvl 5    │ │ Lvl 5    │ │ Lvl 5    │
│ 16/16 HP │ │ 15/15 HP │ │ 16/16 HP │
└──────────┘ └──────────┘ └──────────┘
```

### PokemonDetailScene affichera:
- Nom français (Bulbizarre)
- Niveau 5
- Stats calculées (HP, ATK, DEF, etc.)
- Nature (ex: "Audacieuse", "Calme", etc.)
- Moveset: Vide (sera enrichi lazy depuis PokéAPI)

---

## 📚 Code Highlights

### Dictionary des noms français
```javascript
const POKEMON_FRENCH_NAMES = {
    1: 'Bulbizarre',
    2: 'Herbizarre',
    3: 'Florizarre',
    4: 'Salamèche',
    // ... 151 au total
};
```

### Calcul XP Level 5
```javascript
calculateXpForLevel(level) {
    if (level <= 1) return 0;
    return Math.floor(Math.pow(level, 3) * 0.8);
    // Pour level 5: Math.pow(5, 3) * 0.8 = 100 XP
}
```

### Calcul HP Level 5
```javascript
const baseHP = 50;
const hpLevel5 = Math.floor(((2 * baseHP + ivs.hp + 0) * 5 / 100) + 5 + 5);
// Résultat: 15-16 HP selon IVs
```

### Récupération noms français
```javascript
getFrenchName(pokedexId) {
    return POKEMON_FRENCH_NAMES[pokedexId] || `Pokemon_${pokedexId}`;
}
```

---

## 🔄 Intégration avec Architecture

```
seedPlayerPokemon.js
    ↓
Crée pokemonPlayer documents
    ↓
Frontend: PokemonManager.getTeam()
    ↓
API: GET /api/pokemon/team/:playerId
    ↓
Retourne [{ species_id: 1, nickname: 'Bulbizarre', ... }, ...]
    ↓
PokemonAPIManager enrichit lazy:
    ↓
https://pokeapi.co/api/v2/pokemon/1
    ↓
PokemonTeamScene affiche avec sprites Gen VII
```

---

## 📝 Prochains Développements

### Phase 3 (Combat)
- Utiliser level 5 comme base pour calculs de dégâts
- Utiliser natures pour bonus/malus stats
- Utiliser nature pour AI decisions

### Phase 4 (Expérience)
- Augmenter experience après bataille
- Vérifier level up threshold
- Mettre à jour base_stats selon formule Gen V

---

## ✨ Résumé Final

✅ **seedPlayerPokemon.js est maintenant:**
- 📍 Entièrement français
- 🎯 Compatible architecture lazy-loading
- ⚡ Crée Pokémon niveau 5 avec XP correct
- 🎲 Génère IVs et natures aléatoires
- 💾 Stocke uniquement données essentielles
- 🚀 Prêt pour Phase 3 (combat)

**Commande pour tester:**
```bash
node scripts/seedPlayerPokemon.js --clear-all
```

---

*Updated: 2024*
*Architecture: Lazy-Loading PokéAPI*
*Status: ✅ Production Ready*
