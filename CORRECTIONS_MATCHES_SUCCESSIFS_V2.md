# Corrections des Bugs de Combat (Suite)

## 4. Blocage des Combats Successifs
**Problème :** Impossible de lancer un deuxième combat après en avoir terminé un. L'interface ne répondait plus aux clics.
**Cause :** La variable `this.turnInProgress` restait à `true` à la fin du premier combat (car elle n'était pas remise à `false` lors de la victoire/défaite/fuite). Comme Phaser réutilise la même instance de scène, le deuxième combat commençait avec `turnInProgress = true`, bloquant toutes les actions.
**Correction :**
- **Frontend Scene (`src/PokemonBattleScene.js`) :** Ajout de `this.turnInProgress = false;` dans la méthode `init()`. Cela garantit que chaque nouveau combat commence avec un état propre, débloqué.

## Récapitulatif des Corrections
1. **Sauvegarde PV Fuite :** OK (Backend + Frontend)
2. **Glitch Barres PV :** OK (Reset variables animation)
3. **GIFs Menu :** OK (Masquage explicite)
4. **Enchaînement Combats :** OK (Reset flag tour)
