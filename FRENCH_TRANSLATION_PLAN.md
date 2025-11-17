# 🌐 Intégration Traductions Françaises - Plan

## ✅ Système de Traduction Créé

- **TranslationManager.js** : Gestionnaire avec cache DB + PokeAPI fallback
- **Collections MongoDB** :
  - `translations_pokemon` : { speciesId, name_en, name_fr }
  - `translations_moves` : { moveName, name_fr, description_fr }
- **Routes API** :
  - `GET /api/translations/pokemon/:speciesId`
  - `GET /api/translations/move/:moveName`
  - `POST /api/translations/pokemon/batch`
  - `POST /api/translations/move/batch`

## 🎯 Intégration à Faire

### 1. **GameScene.js** - Bouton Debug
```javascript
// Ligne ~800 createDebugPokemon()
const response = await fetch(`/api/translations/pokemon/${speciesId}`);
const translation = await response.json();
const nameFr = translation.name_fr || speciesName;
// Utiliser nameFr dans console.log et affichage
```

### 2. **PokemonBattleScene.js** - Combat
```javascript
// Ajouter au create():
this.translations = { pokemon: {}, moves: {} };

// Méthode helper:
async getPokemonName(pokemon) {
    if (pokemon.nickname) return pokemon.nickname;
    const speciesId = pokemon.species_id;
    if (!this.translations.pokemon[speciesId]) {
        const res = await fetch(`/api/translations/pokemon/${speciesId}`);
        const data = await res.json();
        this.translations.pokemon[speciesId] = data.name_fr || pokemon.species_name;
    }
    return this.translations.pokemon[speciesId];
}

async getMoveName(moveName) {
    if (!this.translations.moves[moveName]) {
        const res = await fetch(`/api/translations/move/${moveName}`);
        const data = await res.json();
        this.translations.moves[moveName] = data.name_fr || moveName;
    }
    return this.translations.moves[moveName];
}

// Dans displayPokemonInfo():
const playerName = await this.getPokemonName(this.playerPokemon);
const opponentName = await this.getPokemonName(this.opponentPokemon);

// Dans renderMoveButtons():
for (const move of this.playerPokemon.moveset) {
    const moveFr = await this.getMoveName(move.name);
    // Utiliser moveFr dans le bouton
}
```

### 3. **PokemonTeamScene.js** - Équipe
```javascript
// Dans renderPokemonCards():
for (const pokemon of this.pokemonTeam) {
    const nameFr = await this.getPokemonName(pokemon);
    // Afficher nameFr au lieu de species_name
}
```

### 4. **MoveLearnScene.js** - Apprentissage
```javascript
// Dans renderMoveCard():
const moveFr = await this.getMoveName(move.name);
const descFr = await this.getMoveDescription(move.name);
// Utiliser moveFr et descFr
```

### 5. **PokemonDetailScene.js** - Détails
```javascript
// Dans showPokemonDetails():
const nameFr = await this.getPokemonName(this.pokemon);
for (const move of this.pokemon.moveset) {
    const moveFr = await this.getMoveName(move.name);
    // Afficher
}
```

## 🚀 Script d'Initialisation

Créer `scripts/seedTranslations.js` pour pré-remplir les traductions courantes :

```javascript
const commonPokemon = [1,2,3,4,5,6,7,8,9,25,133,134,135,136]; // Starters + Pikachu + Evoli
const commonMoves = ['tackle','growl','vine-whip','ember','water-gun','thunderbolt'];

for (const id of commonPokemon) {
    await translationManager.translatePokemon(id);
}
for (const move of commonMoves) {
    await translationManager.translateMove(move);
}
```

## ⚡ Optimisations

1. **Batch Loading** : Charger toutes les traductions d'une équipe en une seule requête
2. **LocalStorage Cache** : Stocker les traductions côté client
3. **Lazy Loading** : Charger seulement quand nécessaire

## 📊 Priorités

1. ✅ **Phase 1** : TranslationManager créé
2. 🔄 **Phase 2** : Intégrer dans PokemonBattleScene (combat)
3. 🔲 **Phase 3** : Intégrer dans PokemonTeamScene (équipe)
4. 🔲 **Phase 4** : Intégrer dans debug buttons
5. 🔲 **Phase 5** : Pre-seed traductions communes

---

**Note** : L'intégration nécessite de modifier les méthodes pour être `async` et utiliser `await` lors de l'affichage des noms.
