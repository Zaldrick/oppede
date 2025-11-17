# 🎮 Système de Capture Pokémon - Phase 4 Complète

## 📋 Vue d'ensemble

Le système de capture est maintenant **100% fonctionnel** avec :
- ✅ Formule Gen 1-5 (calcul précis du taux de capture)
- ✅ Animation fluide de la Poké Ball (lancer, secousses, résultat)
- ✅ Gestion des différents types de balls (Poké Ball, Great Ball, Ultra Ball)
- ✅ Bonus de statut (poison, paralysie, sommeil, brûlure, gel)
- ✅ Intégration complète avec le système de combat

---

## 🔢 Formule de Capture (Gen 1-5)

```javascript
a = ((3 × MaxHP - 2 × CurrentHP) × CatchRate × BallRate × StatusBonus) / (3 × MaxHP)

// 4 checks: si rand(0-255) < a, success shake
// 4 shakes = capturé !
```

### Facteurs

- **HP actuels** : Plus les HP du Pokémon sont bas, plus il est facile à capturer
- **Catch Rate** : Taux de capture de l'espèce (stocké dans `speciesData.capture_rate`)
- **Ball Rate** :
  - Poké Ball : 1.0×
  - Great Ball : 1.5×
  - Ultra Ball : 2.0×
  - Master Ball : 255× (capture garantie)
- **Status Bonus** :
  - Sleep / Freeze : 2.0×
  - Poison / Burn / Paralysis : 1.5×
  - Aucun statut : 1.0×

---

## 🏗️ Architecture

### Backend

#### `managers/PokemonBattleLogicManager.js`

**Méthode `calculateCapture(pokemon, ballRate)`** (lignes 590-630)
- Calcule le taux de capture modifié `a`
- Effectue 4 checks de secousse
- Retourne `{ captured, shakes, catchRate, statusBonus }`

```javascript
const captureResult = battleLogic.calculateCapture(wildPokemon, ballRate);
// → { captured: true, shakes: 4, catchRate: 45, statusBonus: 2.0 }
```

#### `managers/PokemonBattleManager.js`

**Méthode `attemptCapture(playerId, wildPokemon, ballType)`** (lignes 600-680)
- Appelle `calculateCapture()`
- Si capturé : crée le Pokémon dans la collection `pokemonPlayer`
- Retourne le résultat complet avec `pokemonId`

**Route API `POST /api/battle/capture`** (lignes 365-415)
- Vérifie que c'est un combat sauvage
- Appelle `attemptCapture()`
- Si capturé : met à jour le combat (state = 'captured')
- Retire le combat de la mémoire

### Frontend

#### `src/CaptureScene.js` (350 lignes)

Scène dédiée à l'animation de capture :

1. **Lancer la ball** (800ms) - Arc parabolique avec rotation
2. **Flash + disparition** (300ms) - Pokémon absorbé
3. **Chute au sol** (300ms) - Ball rebondit
4. **Appel API** - Calcul du résultat
5. **Secousses** (150ms × shakes) - Animation gauche/droite
6. **Résultat** :
   - ✅ **Capturé** : "Gotcha! Pokémon capturé!" + étoiles
   - ❌ **Échappé** : "Oh non! Le Pokémon s'est échappé!"

#### `src/PokemonBattleScene.js`

**Méthode `useItemInBattle(item)`** (lignes 1090-1140)
- Détecte si item.type === 'pokeball'
- Lance `CaptureScene` avec callback
- Si capturé : termine le combat et retourne à l'overworld
- Si échappé : adversaire attaque, retour au menu

#### `src/BagScene.js`

**Méthode `useItem(item)`** (lignes 183-205)
- Détecte les Poké Balls (type === 'pokeball')
- Retourne l'item au battle scene pour déclencher la capture

---

## 🎬 Flow Complet

```
1. Battle → Joueur clique "SAC"
2. BagScene affiche inventaire
3. Joueur sélectionne "Poké Ball"
4. BagScene.useItem() → callback vers BattleScene
5. BattleScene.useItemInBattle() détecte type='pokeball'
6. Lance CaptureScene avec animation
7. CaptureScene.attemptCapture() → API POST /api/battle/capture
8. Backend calcule résultat (4 checks)
9. CaptureScene affiche secousses + résultat
10a. SI CAPTURÉ → Fin combat, retour overworld
10b. SI ÉCHAPPÉ → Adversaire attaque, retour combat
```

---

## 📊 Données

### Collection `pokemonPlayer` (capturés)

```javascript
{
  _id: ObjectId,
  player_id: ObjectId,           // Propriétaire
  species_id: Number,             // 1-1025
  species_name: String,           // "bulbasaur"
  nickname: String|null,          // Surnom optionnel
  level: Number,                  // Niveau de capture
  experience: Number,             // XP (medium-slow)
  currentHP: Number,
  maxHP: Number,
  attack: Number,
  defense: Number,
  speed: Number,
  moveset: Array,                 // 4 moves max
  originalTrainer: ObjectId,      // Dresseur d'origine
  heldItem: String|null,          // "lucky-egg", etc.
  statusCondition: {
    type: String|null,            // "poison", "burn", etc.
    turns: Number
  }
}
```

### Collection `battles`

```javascript
{
  _id: ObjectId,
  player_id: ObjectId,
  battle_type: "wild" | "trainer",
  state: "ongoing" | "captured" | "player_won" | "opponent_won",
  captured_pokemon_id: ObjectId|null,  // ID du Pokémon capturé
  // ...
}
```

### Collection `inventory`

```javascript
{
  _id: ObjectId,
  player_id: String,              // ID joueur
  item_id: String,                // "poke-ball", "great-ball", etc.
  quantity: Number
}
```

---

## 🔧 Items Disponibles

### Poké Balls

| Item ID | Nom | Ball Rate | Capture Rate |
|---------|-----|-----------|--------------|
| `poke-ball` | Poké Ball | 1.0× | Standard |
| `great-ball` | Super Ball | 1.5× | +50% |
| `ultra-ball` | Hyper Ball | 2.0× | +100% |
| `master-ball` | Master Ball | 255× | Garantie |

### Autres Items

- `potion` : +20 HP
- `super-potion` : +50 HP
- `antidote` : Guérit empoisonnement
- `paralyze-heal` : Guérit paralysie
- `lucky-egg` : +50% XP (held item)

---

## 🎮 Usage

### 1. Donner des Poké Balls aux joueurs

```powershell
node scripts/giveStarterItems.js
```

Attribution automatique :
- 10× Poké Ball
- 5× Super Ball
- 10× Potion
- 5× Super Potion
- 5× Antidote
- 5× Anti-Para

### 2. Lancer un combat sauvage

Dans GameScene, appuyer sur le bouton debug "Démarrer Combat Pokémon".

### 3. Utiliser une Poké Ball

1. Combat en cours
2. Cliquer "SAC"
3. Sélectionner "Poké Ball"
4. Animation de capture
5. Résultat affiché

---

## 🧪 Tests

### Tester différents scénarios

**Capture facile** (HP bas + statut) :
```
HP: 5/100 → 95% réduits
Statut: Sleep → ×2.0
Ball: Ultra Ball → ×2.0
→ Taux très élevé, ~4 shakes
```

**Capture difficile** (HP pleins) :
```
HP: 100/100 → Aucune réduction
Statut: None → ×1.0
Ball: Poké Ball → ×1.0
→ Taux faible, souvent 0-2 shakes
```

**Capture moyenne** (HP moyens + paralysie) :
```
HP: 50/100 → 50% réduits
Statut: Paralysis → ×1.5
Ball: Super Ball → ×1.5
→ Taux moyen, 2-3 shakes
```

### Logs Console

Le système log chaque étape :
```
[Capture] Calcul pour bulbasaur avec ball rate 1.5
  HP: 25/100, CatchRate: 45, StatusBonus: 2.0, a: 101
  → 4 secousse(s), CAPTURÉ
[Battle] Pokémon capturé avec succès !
```

---

## 📈 Statistiques

### Taux de Capture par Espèce

Les Pokémon légendaires ont un catch rate très bas :
- **Pikachu** : 190 (très facile)
- **Bulbizarre/Salamèche/Carapuce** : 45 (moyen)
- **Dracaufeu/Florizarre/Tortank** : 45 (moyen)
- **Mewtwo** : 3 (extrêmement difficile)
- **Artikodin/Sulfura/Électhor** : 3 (extrêmement difficile)

### Probabilité de Capture (approximation)

Formule simplifiée : `P = a / 256`

Exemples :
- `a = 128` → 50% de succès par shake → 6.25% capture totale
- `a = 192` → 75% de succès par shake → 31.6% capture totale
- `a = 255` → ~100% de succès par shake → ~100% capture totale

---

## 🚀 Améliorations Futures

### Phase 5+ (optionnel)

1. **PC Box System** - Stockage quand >6 Pokémon
2. **Critical Capture** - Shake unique avec animation spéciale
3. **Son et Musique** - SFX pour lancer, secousses, succès/échec
4. **Quick Ball** - Bonus au 1er tour
5. **Dusk Ball** - Bonus la nuit/grottes
6. **Net Ball** - Bonus Bug/Water types
7. **Timer Ball** - Bonus après X tours
8. **Master Ball** - Capture garantie sans animation

---

## 📝 Code Clé

### Calculer une capture (backend)

```javascript
const battleLogic = new PokemonBattleLogicManager();
const result = battleLogic.calculateCapture(wildPokemon, 1.5); // Super Ball
// → { captured: true, shakes: 4, catchRate: 45, statusBonus: 2.0 }
```

### Lancer CaptureScene (frontend)

```javascript
this.scene.launch('CaptureScene', {
    battleScene: this,
    ballType: 'great-ball',
    wildPokemon: this.opponentPokemon,
    callback: (result) => {
        if (result.captured) {
            console.log('Pokémon capturé!', result.pokemonId);
        }
    }
});
```

---

## ✅ Phase 4 - 100% Complète

Tous les systèmes Phase 4 sont opérationnels :

- ✅ XP Gains (Gen 1-5 formula)
- ✅ Pokémon Switching
- ✅ Held Items (Lucky Egg)
- ✅ Original Trainer
- ✅ Move Learning (after level up)
- ✅ Status Conditions (poison, burn, paralysis, sleep, freeze)
- ✅ Item System (Potions, Antidotes, etc.)
- ✅ **Capture System** (formule Gen 1-5, animation, intégration)

**Prochaine phase** : Intégration des noms français via TranslationManager + Polish UI.

---

🎉 **Le système de capture est prêt pour la production !**
