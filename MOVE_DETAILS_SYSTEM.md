# Système de Détails des Moves Pokémon

## Vue d'ensemble

Système complet pour afficher les détails des capacités (moves) Pokémon avec:
- Modal responsive et visuellement attrayant
- Cache en base de données MongoDB
- Fallback automatique sur PokéAPI
- Informations complètes (type, catégorie, puissance, précision, PP, effet)

## Architecture

### 1. Frontend - Modal UI (`src/MoveDetailModal.js`)

**Classe réutilisable** qui affiche un modal responsive avec:

#### Design responsive
- Toutes les dimensions en pourcentages de l'écran
- Modal: 85% largeur × 65% hauteur
- Fonts adaptatives basées sur `min(screenWidth, screenHeight)`

#### Informations affichées
- **Nom du move** (titre principal en or)
- **Type** (box colorée selon le type Pokémon)
- **Catégorie** (Physical/Special/Status)
- **Puissance** (ou "-" si N/A)
- **Précision** (en % ou "-")
- **PP** (Power Points)
- **Effet** (description détaillée avec word wrap)

#### Interactions
- Clic sur overlay ou bouton "FERMER" pour fermer
- Hover sur bouton de fermeture (changement de couleur)
- Hover sur boxes de moves dans PokemonDetailScene

#### Couleurs par type
```javascript
{
  normal: 0xA8A878,
  fire: 0xF08030,
  water: 0x6890F0,
  electric: 0xF8D030,
  grass: 0x78C850,
  // ... tous les types Pokémon
}
```

#### Couleurs par catégorie
```javascript
{
  physical: 0xC0392B,  // Rouge
  special: 0x5499C7,   // Bleu
  status: 0x95A5A6     // Gris
}
```

### 2. Backend - API Route (`managers/DatabaseManager.js`)

#### Route: `GET /api/pokemon/move/:moveNameOrId`

**Logique de récupération en cascade:**

1. **Recherche en BDD** (`pokemonMoves` collection)
   - Recherche par nom OU par ID
   - Si trouvé → retour immédiat (rapide)

2. **Fallback PokéAPI** (si non trouvé en BDD)
   - Requête: `https://pokeapi.co/api/v2/move/{moveName}`
   - Extraction des données en anglais (effet, flavor text)
   - Normalisation de l'objet move

3. **Sauvegarde en BDD** (après récupération PokéAPI)
   - Insertion du move dans `pokemonMoves`
   - Utilisé pour les prochaines requêtes (cache persistant)

#### Structure de données normalisée

```javascript
{
  id: 1,                    // ID PokéAPI
  name: "pound",            // Nom du move
  type: "normal",           // Type Pokémon
  category: "physical",     // physical/special/status
  power: 40,                // Puissance (null si N/A)
  accuracy: 100,            // Précision en %
  pp: 35,                   // Power Points
  effect: "Inflicts regular damage with no additional effect.",
  priority: 0,              // Priorité du move
  target: "selected-pokemon", // Cible
  createdAt: Date           // Date d'insertion
}
```

### 3. Intégration dans PokemonDetailScene

#### Méthode `showMoveDetails(moveName)`

```javascript
async showMoveDetails(moveName) {
    // Validation (ignorer "Move 1", "Move 2", etc.)
    if (!moveName || moveName.startsWith('Move ')) return;
    
    // Fetch depuis backend
    const response = await fetch(`${backendUrl}/api/pokemon/move/${moveName}`);
    const moveData = await response.json();
    
    // Afficher le modal
    this.moveModal.show(moveData);
}
```

#### Déclenchement
- Clic sur une box de move dans `createMovesSection()`
- Vérifie si le move est valide avant d'afficher

## Collection MongoDB

### `pokemonMoves`

#### Index recommandés
```javascript
db.pokemonMoves.createIndex({ name: 1 }, { unique: true });
db.pokemonMoves.createIndex({ id: 1 });
db.pokemonMoves.createIndex({ type: 1 });
```

#### Avantages du cache
- ✅ Réduit les appels à PokéAPI (limite de rate)
- ✅ Performances optimales (récupération locale)
- ✅ Pas de latence réseau après première requête
- ✅ Permet ajout de traductions françaises futures

## Flow utilisateur

```
1. User clique sur un move dans PokemonDetailScene
   ↓
2. PokemonDetailScene.showMoveDetails(moveName)
   ↓
3. Fetch GET /api/pokemon/move/tackle
   ↓
4. Backend cherche en BDD
   ├─ Trouvé → Retour immédiat
   └─ Non trouvé → PokéAPI → Sauvegarde BDD → Retour
   ↓
5. MoveDetailModal.show(moveData)
   ↓
6. Affichage modal responsive
```

## Gestion des erreurs

### Move invalide
```javascript
if (!moveName || moveName.startsWith('Move ')) {
    console.warn('[PokemonDetail] Pas de move valide');
    return; // Pas de modal affiché
}
```

### Move non trouvé PokéAPI
```javascript
if (!response.ok) {
    return res.status(404).json({ error: 'Move introuvable' });
}
```

### Erreur réseau
```javascript
try {
    // ... fetch
} catch (error) {
    console.error('[PokemonDetail] Erreur récupération move:', error);
    // Pas de modal affiché, erreur silencieuse côté user
}
```

## Améliorations futures

### Traductions françaises
- Ajouter champ `name_fr` dans la BDD
- Traduire manuellement les moves les plus courants
- Fallback sur nom anglais si traduction indisponible

### Animations PP
- Afficher PP restants vs PP max
- Barre de progression pour les PP
- Couleur rouge si PP < 25%

### Détails avancés
- Afficher `effect_chance` (% chance d'effet secondaire)
- Afficher `stat_changes` (buffs/debuffs)
- Afficher `ailments` (statuts infligés)

### Mode hors ligne
- Pre-fetch des 50 moves les plus courants
- Fallback gracieux si PokéAPI indisponible

## Tests recommandés

### Test 1: Move en cache
```javascript
// Premier clic sur "Tackle" → PokéAPI + BDD
// Deuxième clic sur "Tackle" → BDD uniquement (rapide)
```

### Test 2: Move invalide
```javascript
// Clic sur "Move 1" → Aucun modal (comportement attendu)
```

### Test 3: Responsive design
```javascript
// Tester sur Redmi 13, iPhone 12, Samsung S25+
// Vérifier lisibilité du texte d'effet (word wrap)
```

### Test 4: Fermeture modal
```javascript
// Clic sur overlay → Fermeture
// Clic sur bouton FERMER → Fermeture
```

## Commandes utiles

### Créer les index MongoDB
```bash
node scripts/createMoveIndexes.js
```

### Vider le cache des moves
```javascript
db.pokemonMoves.deleteMany({});
```

### Lister les moves en cache
```javascript
db.pokemonMoves.find({}).limit(10);
```

### Stats du cache
```javascript
db.pokemonMoves.countDocuments(); // Nombre de moves en cache
```

## Dépendances

- **Phaser 3** (scène + containers)
- **MongoDB** (collection `pokemonMoves`)
- **PokéAPI** (https://pokeapi.co/api/v2/move/)
- **Fetch API** (requêtes HTTP)

## Fichiers modifiés

- ✅ `src/MoveDetailModal.js` (nouveau fichier)
- ✅ `src/PokemonDetailScene.js` (import + méthode showMoveDetails)
- ✅ `managers/DatabaseManager.js` (route GET /api/pokemon/move/:moveNameOrId)
- ✅ `scripts/createMoveIndexes.js` (script utilitaire)
