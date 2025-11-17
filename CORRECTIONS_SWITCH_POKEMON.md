# 🔧 Corrections Navigation & Switch Pokémon

## Problèmes Identifiés et Corrigés

### ❌ Problème 1: Sprite toujours identique dans DetailScene
**Symptôme:** Quel que soit le Pokémon cliqué dans TeamScene, le sprite affiché est toujours celui du Pokémon en combat.

**Cause:** La méthode `createSprite()` utilisait `this.species.sprites` au lieu de `this.pokemon.sprites`, affichant donc toujours le sprite du species et non celui du Pokémon individuel.

**Solution (PokemonDetailScene.js, ligne ~203):**
```javascript
async createSprite(x, y) {
    // ✅ Priorité 1: sprites du pokemon directement
    let spriteUrl = null;
    if (this.pokemon.sprites?.frontCombat) {
        spriteUrl = this.pokemon.sprites.frontCombat;
    } else if (this.pokemon.sprites?.front) {
        spriteUrl = this.pokemon.sprites.front;
    }
    // Priorité 2: sprites du species (fallback)
    else if (this.species?.sprites?.frontCombat) {
        spriteUrl = this.species.sprites.frontCombat;
    } else if (this.species?.sprites?.front) {
        spriteUrl = this.species.sprites.front;
    }
    
    console.log('[PokemonDetail] Sprite URL:', spriteUrl);
    // ... reste du code ...
}
```

---

### ❌ Problème 2: "Revient undefined" et "Go undefined"
**Symptôme:** Les messages de changement de Pokémon affichaient "Revient undefined !" et "Go undefined !".

**Cause:** Les objets `oldPokemon` et `newPokemon` n'avaient pas de propriété `nickname` ou `species_name` définie correctement.

**Solution (PokemonBattleScene.js, ligne ~1299):**
```javascript
async switchPokemon(newIndex) {
    this.turnInProgress = true;
    
    const newPokemon = this.battleState.playerTeam[newIndex];
    const oldPokemon = this.battleState.playerActive;
    
    console.log('[BattleScene] Switch Pokemon:', { newIndex, newPokemon, oldPokemon });
    
    // ✅ Vérifier que le Pokémon existe
    if (!newPokemon) {
        console.error('[BattleScene] Nouveau Pokémon introuvable à l\'index:', newIndex);
        this.turnInProgress = false;
        return;
    }
    
    // ✅ Obtenir les noms avec plusieurs fallbacks
    const oldName = oldPokemon?.nickname || oldPokemon?.name || oldPokemon?.speciesData?.name_fr || 'Pokémon';
    const newName = newPokemon?.nickname || newPokemon?.name || newPokemon?.speciesData?.name_fr || 'Pokémon';
    
    this.showDialog(`Reviens, ${oldName} !`);
    // ... suite ...
}
```

---

### ❌ Problème 3: Cannot read properties of undefined (reading 'substring')
**Symptôme:** Erreur `TypeError: Cannot read properties of undefined (reading 'substring')` à la ligne 1335.

**Cause:** `newPokemon.species_name` était `undefined`, donc `.substring(0, 2)` provoquait une erreur.

**Solution (PokemonBattleScene.js, ligne ~1335):**
```javascript
// ✅ Utiliser une clé sûre pour le sprite
const spriteKey = newPokemon.nickname?.substring(0, 2) || newName?.substring(0, 2) || 'PK';
const sprite = await SpriteLoader.displaySprite(
    this,
    playerSpriteX,
    playerSpriteY,
    newPokemon.sprites.backCombat,
    spriteKey, // ✅ Ne crashe plus
    3.8
);
```

---

### ❌ Problème 4: Bouton retour TeamScene ne va pas à la bonne scène
**Symptôme:** Le bouton retour du TeamScene ne retourne pas correctement à BattleScene ou GameScene selon le contexte.

**Solution 1 - DetailScene (ligne ~188):**
```javascript
button.on('pointerdown', () => {
    console.log('[PokemonDetail] Retour à la scène précédente');
    // ✅ Passer toutes les données nécessaires
    this.scene.start(this.returnScene, { 
        playerId: this.playerId,
        returnScene: this.inBattle ? 'PokemonBattleScene' : 'GameScene',
        inBattle: this.inBattle,
        battleState: this.battleState
    });
});
```

**Solution 2 - TeamScene (ligne ~608):**
```javascript
returnToScene() {
    console.log(`[PokemonTeam] Retour à ${this.returnScene}`);
    // ✅ Cas 1: Scène en pause (combat) → resume
    if (this.scene.isPaused(this.returnScene)) {
        this.scene.resume(this.returnScene);
        this.scene.bringToTop(this.returnScene);
        this.scene.stop();
    } 
    // ✅ Cas 2: Scène normale (GameScene) → start
    else {
        this.scene.start(this.returnScene, { 
            playerId: this.currentPlayer 
        });
    }
}
```

---

## 🎯 Points de Passage des Données

### GameScene → TeamScene
```javascript
this.scene.start('PokemonTeamScene', {
    playerId: this.currentPlayer,
    returnScene: 'GameScene', // ✅ Permet retour correct
    inBattle: false
});
```

### BattleScene → TeamScene
```javascript
this.scene.launch('PokemonTeamScene', {
    playerId: this.playerId,
    returnScene: 'PokemonBattleScene', // ✅ Permet retour correct
    inBattle: true,
    battleState: this.battleState
});
```

### TeamScene → DetailScene
```javascript
this.scene.start('PokemonDetailScene', {
    pokemon: pokemon, // ✅ Objet complet avec sprites
    returnScene: 'PokemonTeamScene',
    playerId: this.currentPlayer,
    inBattle: this.inBattle,
    battleState: this.battleState
});
```

### DetailScene → TeamScene (retour)
```javascript
this.scene.start(this.returnScene, { 
    playerId: this.playerId,
    returnScene: this.inBattle ? 'PokemonBattleScene' : 'GameScene', // ✅ Passé
    inBattle: this.inBattle,
    battleState: this.battleState
});
```

---

## 🧪 Tests à Effectuer

### Test 1: Navigation depuis GameScene
1. Ouvrir menu équipe depuis GameScene
2. Cliquer sur un Pokémon
3. **Attendu:** Bon sprite affiché
4. Cliquer "← Retour"
5. **Attendu:** Retour à TeamScene
6. Cliquer "← Retour"
7. **Attendu:** Retour à GameScene

### Test 2: Navigation depuis BattleScene
1. En combat, cliquer "POKÉMON"
2. Cliquer sur un Pokémon différent
3. **Attendu:** Bon sprite affiché (pas celui en combat)
4. Cliquer "⚔️ Envoyer au combat"
5. **Attendu:** Messages "Reviens, [NOM] !" et "Go, [NOM] !" corrects
6. **Attendu:** Nouveau sprite s'affiche
7. **Attendu:** Pas d'erreur console

### Test 3: Vérifier les logs console
Lors du changement de Pokémon, vous devriez voir:
```
[BattleScene] Switch Pokemon: { newIndex: 2, newPokemon: {...}, oldPokemon: {...} }
[PokemonDetail] Sprite URL: /assets/pokemon/sprites/...
```

**Pas d'erreur:**
- ❌ "Cannot read properties of undefined (reading 'substring')"
- ❌ "Revient undefined"
- ❌ "Go undefined"

---

## ✅ Résumé des Modifications

| Fichier | Lignes | Modification |
|---------|--------|--------------|
| PokemonDetailScene.js | ~188 | Bouton retour avec données complètes |
| PokemonDetailScene.js | ~203 | createSprite avec priorité pokemon.sprites |
| PokemonBattleScene.js | ~1299 | switchPokemon avec fallbacks noms |
| PokemonBattleScene.js | ~1335 | spriteKey sécurisé avec fallback |
| PokemonTeamScene.js | ~608 | returnToScene avec cas pause/start |

---

## 📝 Logs de Débogage Ajoutés

```javascript
// PokemonBattleScene.js
console.log('[BattleScene] Switch Pokemon:', { newIndex, newPokemon, oldPokemon });

// PokemonDetailScene.js
console.log('[PokemonDetail] Sprite URL:', spriteUrl);
console.log('[PokemonDetail] Retour à la scène précédente');
```

Ces logs aident à identifier rapidement les problèmes de données.

---

**Date:** 2025-11-17  
**Status:** ✅ CORRIGÉ - READY FOR TESTING  
**Fichiers modifiés:** 3 (PokemonBattleScene, PokemonDetailScene, PokemonTeamScene)
