# Battle System - Architecture Modulaire

## 📁 Structure

```
src/battle/
├── BattleUIManager.js          (~700 lignes) - Création et gestion UI
├── BattleMenuManager.js         (~200 lignes) - Navigation menus
├── BattleAnimationManager.js    (~500 lignes) - Animations visuelles
├── BattleSpriteManager.js       (~300 lignes) - Gestion sprites
└── BattleTurnManager.js         (~400 lignes) - Logique des tours
```

## 🎯 Responsabilités

### **BattleUIManager**
Crée et met à jour tous les éléments UI du combat :
- `createOpponentUI()` - Box adversaire avec barres HP
- `createPlayerUI()` - Box joueur avec barres HP/XP
- `createMainMenu()` - Menu FIGHT/SAC/POKÉMON/FUIR
- `createMoveSelector()` - Sélecteur de 4 moves
- `createMoveButton()` - Boutons individuels de moves
- Helpers: `getTypeColor()`, `darkenColor()`, `lightenColor()`

### **BattleMenuManager**
Gère la navigation entre les différents menus :
- `showMoveSelector()` / `hideMoveSelector()` - Afficher/cacher moves
- `showBagMenu()` - Ouvrir le sac
- `showPokemonMenu()` - Ouvrir la team
- `showDialog()` / `hideDialog()` - Messages de dialogue

### **BattleAnimationManager**
Toutes les animations visuelles du combat :
- `playEntryTransition()` - Spiral d'entrée spectaculaire
- `playUIEntryAnimations()` - Glissement progressif des UI
- `animateAttack()` - Animations d'attaque
- `animateHPDrain()` - Barre HP qui diminue
- `animateXPGain()` - Barre XP qui augmente
- `animateKO()` - K.O. avec fade out

### **BattleSpriteManager**
Gestion des sprites Pokémon :
- `createOpponentSprite()` - Sprite FACE de l'adversaire (x2.5)
- `createPlayerSprite()` - Sprite DOS du joueur (x3)
- `recreatePlayerSprite()` - Switch Pokémon
- Gestion des ombres et z-index (sprites: depth 1-5, boxes: depth 2, textes: depth 3)

### **BattleTurnManager**
Logique des tours de combat :
- `selectMove()` - Exécution d'un move du joueur
- `opponentTurn()` - Tour de l'IA adversaire
- `switchPokemon()` - Changement de Pokémon
- `useItemInBattle()` - Utilisation d'items (Pokéballs, soins)
- `flee()` - Fuite du combat
- `animateTurn()` - Orchestration animations tour
- `updateBattleState()` - Mise à jour state après actions

## 🔗 Communication

Chaque manager reçoit `scene` (PokemonBattleScene) dans son constructeur et peut :
- Accéder à `scene.battleState` (état du combat)
- Accéder aux autres managers via `scene.uiManager`, `scene.menuManager`, etc.
- Appeler des méthodes publiques d'autres managers

**Exemple d'utilisation** (dans PokemonBattleScene.js) :
```javascript
// Initialisation (dans create())
this.uiManager = new BattleUIManager(this);
this.menuManager = new BattleMenuManager(this);
this.animManager = new BattleAnimationManager(this);
this.spriteManager = new BattleSpriteManager(this);
this.turnManager = new BattleTurnManager(this);

// Utilisation
await this.uiManager.createOpponentUI(width, height);
await this.animManager.playEntryTransition(width, height);
await this.turnManager.selectMove('Charge');
```

## ✅ Avantages

- **Lisibilité** : Chaque fichier < 700 lignes (vs 2676 avant)
- **Maintenabilité** : Responsabilités claires et séparées
- **Testabilité** : Chaque manager testable individuellement
- **Réutilisabilité** : Managers réutilisables pour d'autres combats
- **Collaboration** : Plusieurs développeurs peuvent travailler en parallèle

## 🚀 Refactoring Progressif

Les managers sont initialisés mais PokemonBattleScene.js conserve encore toutes ses méthodes originales pour assurer la compatibilité. Le refactoring se fera progressivement en remplaçant les appels directs par des appels aux managers.

**Prochaines étapes** :
1. ✅ Créer les 5 managers
2. ✅ Importer et initialiser dans PokemonBattleScene
3. ⏳ Remplacer progressivement les méthodes par des appels aux managers
4. ⏳ Supprimer les méthodes dupliquées de PokemonBattleScene
5. ⏳ Tests complets de tous les flows

## 📝 Notes

- Les managers ne stockent pas d'état, ils manipulent l'état de `scene`
- Toutes les références UI restent dans `scene` pour compatibilité
- Les managers peuvent s'appeler entre eux via `scene.xxxManager`
- Le fichier principal orchestre le cycle de vie Phaser

---

**Date de création** : 2025-01-17  
**Refactoring** : PokemonBattleScene.js (2676 lignes) → 5 managers (~2100 lignes) + Scene (~500 lignes)
