# Correction : Gestion des Sprites lors du Switch Pokémon

## Problèmes Identifiés
1. **Persistance de l'ancien sprite** : Lors d'un changement de Pokémon, l'ancien sprite restait affiché si c'était un GIF animé, car le code ne nettoyait que les sprites Phaser standards.
2. **Format incorrect du nouveau sprite** : Le nouveau Pokémon apparaissait en version statique (PNG) même si l'option "GIF animés" était activée, car la méthode de recréation utilisait l'ancien chargeur de sprites.

## Corrections Appliquées

### 1. `src/battle/BattleTurnManager.js`
- **Animation de sortie** : Ajout de la logique pour animer la disparition des GIFs (via CSS transition) en plus des sprites Phaser.
- **Nettoyage** : Utilisation de `this.scene.spriteManager.destroySprite` pour supprimer proprement l'ancien sprite quel que soit son type.
- **Appel de création** : Remplacement de l'appel à `recreatePlayerSprite` par `createOrUpdatePlayerSprite` qui supporte l'option "Auto" (GIF/PNG).

### 2. `src/battle/BattleSpriteManager.js`
- **Refactoring** : La méthode `recreatePlayerSprite` redirige maintenant vers `createOrUpdatePlayerSprite` pour éviter la duplication de code et garantir que toute création de sprite utilise la logique moderne (support GIF + nettoyage).

## Résultat
- L'ancien Pokémon disparaît correctement (fondu + zoom pour Phaser, fondu + zoom CSS pour GIF).
- Le nouveau Pokémon apparaît avec le bon format (GIF animé si disponible et activé).
