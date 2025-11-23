# Correction du Changement de Pokémon après K.O.

## Problème
Lorsqu'un Pokémon était K.O., le joueur était invité à changer de Pokémon. Cependant, après avoir sélectionné un nouveau Pokémon dans le menu :
1. Rien ne se passait (le combat ne reprenait pas avec le nouveau Pokémon).
2. Le message "Choisissez un Pokémon" restait affiché.
3. Si le changement fonctionnait, l'interface (PV, Nom) ne se mettait pas à jour.
4. L'adversaire attaquait immédiatement le nouveau Pokémon (injuste après un K.O.).

## Analyse Technique
1. **Méthode Manquante** : `PokemonDetailScene` tentait d'appeler `battleScene.switchPokemon()`, mais cette méthode n'existait pas dans `PokemonBattleScene.js` (elle était déléguée au `BattleTurnManager` mais non exposée).
2. **Mise à jour UI Silencieuse** : La méthode `updateCompletePlayerUI` dans `BattleTurnManager` était vide (log seulement), donc l'interface ne reflétait pas le changement.
3. **Logique de Tour** : La méthode `switchPokemon` déclenchait systématiquement `opponentTurn()`, même si le changement était dû à un K.O. (où le tour est déjà fini).

## Corrections Appliquées

### 1. Exposition de la méthode `switchPokemon`
Ajout d'un wrapper dans `src/PokemonBattleScene.js` :
```javascript
switchPokemon(newIndex) {
    if (this.turnManager) {
        this.turnManager.switchPokemon(newIndex);
    }
}
```

### 2. Mise à jour de l'UI
Modification de `src/battle/BattleTurnManager.js` pour appeler correctement le `uiManager` :
```javascript
async updateCompletePlayerUI(pokemon) {
    if (this.scene.uiManager) {
        await this.scene.uiManager.updateCompletePlayerUI(pokemon);
    }
}
```

### 3. Gestion du Switch Forcé (K.O.)
Modification de la logique dans `BattleTurnManager.js` :
- Détection si l'ancien Pokémon est K.O. (`isForcedSwitch`).
- Si c'est un switch forcé :
  - Pas de message "Reviens !" (inutile).
  - **Pas d'attaque adverse immédiate** (`opponentTurn` sauté).
  - Réaffichage immédiat du menu principal pour laisser le joueur jouer son tour.

## Résultat
- Le changement de Pokémon fonctionne maintenant correctement depuis le menu de détails.
- L'interface se met à jour (Sprite, PV, Nom, Niveau).
- Après un K.O., le nouveau Pokémon arrive et c'est **au joueur de jouer** (l'adversaire n'attaque pas gratuitement).
