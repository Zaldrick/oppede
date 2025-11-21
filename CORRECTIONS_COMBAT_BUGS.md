# Corrections des Bugs de Combat

## 1. Sauvegarde des PV lors de la Fuite
**Problème :** Les PV perdus pendant un combat n'étaient pas sauvegardés si le joueur fuyait.
**Correction :**
- **Backend (`managers/PokemonBattleManager.js`) :** Ajout de la route `POST /api/battle/flee`. Cette route :
    - Récupère l'état actuel du combat.
    - Sauvegarde les HP et XP de tous les participants via `updatePokemonHPAndXP`.
    - Marque le combat comme 'fled'.
- **Frontend Client (`src/managers/PokemonBattleManager.js`) :** Mise à jour de la méthode `flee` pour envoyer `playerId` et appeler la nouvelle route.
- **Frontend Scene (`src/PokemonBattleScene.js`) :** La méthode `flee()` appelle maintenant `await this.battleManager.flee(...)` avant de quitter la scène.

## 2. Glitch des Barres de Vie (Reset Visuel)
**Problème :** Les barres de vie s'animaient depuis la valeur du combat précédent au lieu de commencer pleines (ou à la valeur actuelle).
**Cause :** `BattleAnimationManager` utilisait des variables `currentPlayerHPPercent` stockées sur la scène (`this.scene`) qui persistaient entre les redémarrages de scène Phaser.
**Correction :**
- **Frontend Scene (`src/PokemonBattleScene.js`) :** Dans la méthode `init()`, on force la réinitialisation de ces variables :
    ```javascript
    this.currentPlayerHPPercent = undefined;
    this.currentOpponentHPPercent = undefined;
    ```
    Cela force `BattleAnimationManager` à recalculer le pourcentage initial basé sur les HP actuels du Pokémon au début du combat.

## 3. Visibilité des GIFs dans le Menu Pokémon
**Problème :** Les sprites animés (GIFs) restaient visibles par-dessus le menu "Pokémon" (équipe) car ce sont des éléments DOM hors du canvas Phaser.
**Correction :**
- **Frontend Menu Manager (`src/battle/BattleMenuManager.js`) :** Dans `showPokemonMenu()`, appel explicite à `SpriteLoader.hideAllGifs(this.scene)` avant de lancer la scène d'équipe.
- **Frontend Scene (`src/PokemonBattleScene.js`) :** La scène écoutait déjà l'événement `resume` pour réafficher les GIFs (`SpriteLoader.showAllGifs(this)`), assurant qu'ils reviennent quand on quitte le menu.

## Fichiers Modifiés
- `managers/PokemonBattleManager.js` (Backend)
- `src/managers/PokemonBattleManager.js` (Frontend)
- `src/PokemonBattleScene.js`
- `src/battle/BattleMenuManager.js`
