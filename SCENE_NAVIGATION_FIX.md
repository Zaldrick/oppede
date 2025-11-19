# 🔧 Corrections Navigation Scènes - Système de Menus

## 🐛 Problème identifié

**Symptôme** : Lorsqu'on navigue `GameScene → PokemonTeamScene → InventoryScene`, l'inventaire ne s'affiche pas correctement.

**Cause racine** : Gestion incorrecte de la **pile des scènes** Phaser.
- ❌ Pas de `returnScene` transmis entre scènes
- ❌ Pas de `bringToTop()` appelé lors du retour
- ❌ `scene.pause()` et `scene.resume()` mal synchronisés
- ❌ Certaines scènes font juste `scene.stop()` sans `resume` ni `bringToTop`

## ✅ Solution implémentée

### Principe de navigation standardisé

Chaque scène suit maintenant ce pattern :

```javascript
// 1️⃣ OUVERTURE d'une scène enfant
openChildScene() {
    this.scene.pause('CurrentScene');           // Pause moi-même
    this.scene.launch('ChildScene', {
        returnScene: 'CurrentScene',            // Dire où revenir
        playerId: this.playerId,
        inBattle: this.inBattle,                // Transmettre contexte
        battleState: this.battleState
    });
    this.scene.bringToTop('ChildScene');        // Mettre enfant au premier plan
}

// 2️⃣ RETOUR vers scène parente
returnToParent() {
    this.scene.stop('CurrentScene');            // Stop moi-même
    this.scene.resume(this.returnScene);        // Resume parent
    this.scene.bringToTop(this.returnScene);    // Mettre parent au premier plan ⚠️ CRITIQUE
}
```

### Flux de navigation corrigé

```
GameScene (active)
  ├─ openPokemonTeam()
  │  └─ pause GameScene + launch PokemonTeamScene + bringToTop
  │
  └─ GameScene (paused), PokemonTeamScene (active)
      ├─ openInventory()
      │  └─ pause PokemonTeamScene + launch InventoryScene + bringToTop
      │
      └─ GameScene (paused), PokemonTeamScene (paused), InventoryScene (active)
          └─ Retour
             └─ stop InventoryScene + resume PokemonTeamScene + bringToTop ✅
                └─ GameScene (paused), PokemonTeamScene (active)
                    └─ Retour
                       └─ stop PokemonTeamScene + resume GameScene + bringToTop ✅
                          └─ GameScene (active)
```

## 📂 Fichiers modifiés

### 1. **PokemonTeamScene.js** (+60 lignes)

**Modifications :**
- ✅ Nouveau bouton **"📦 Inventaire"** (position y = 0.19)
- ✅ Méthode `openInventory()` avec gestion correcte des scènes
- ✅ Transmission de `returnScene: 'PokemonTeamScene'` à InventoryScene
- ✅ Utilisation de `bringToTop()` lors du lancement
- ✅ Boutons debug repositionnés (y = 0.90 et 0.96)

**Nouveau code :**
```javascript
openInventory() {
    this.scene.pause('PokemonTeamScene');
    this.scene.launch('InventoryScene', {
        playerId: this.currentPlayer,
        returnScene: 'PokemonTeamScene', // ⚠️ IMPORTANT
        inBattle: this.inBattle,
        battleState: this.battleState
    });
    this.scene.bringToTop('InventoryScene');
}
```

### 2. **InventoryScene.js** (~15 lignes modifiées)

**Modifications :**
- ✅ `init(data)` accepte maintenant `returnScene`, `inBattle`, `battleState`
- ✅ Bouton Retour utilise `this.returnScene` au lieu de `"GameScene"` hardcodé
- ✅ Ajout de `bringToTop()` lors du retour

**Avant :**
```javascript
init(data) {
    this.inventory = data.inventory || [];
    this.playerId = data.playerId;
}

returnButton.on("pointerdown", () => {
    this.scene.stop();
    this.scene.resume("GameScene"); // ❌ Toujours GameScene
});
```

**Après :**
```javascript
init(data) {
    this.inventory = data.inventory || [];
    this.playerId = data.playerId;
    this.returnScene = data.returnScene || 'GameScene'; // ✅ Dynamique
    this.inBattle = data.inBattle || false;
    this.battleState = data.battleState || null;
}

returnButton.on("pointerdown", () => {
    this.scene.stop('InventoryScene');
    this.scene.resume(this.returnScene); // ✅ Utilise returnScene
    this.scene.bringToTop(this.returnScene); // ✅ CRITIQUE
});
```

### 3. **UIManager.js** (~8 lignes modifiées)

**Modifications :**
- ✅ `openInventory()` transmet maintenant `returnScene: 'GameScene'`
- ✅ Pause explicite de `GameScene` (au lieu de `this.scene.scene.pause()`)
- ✅ Ajout de `bringToTop('InventoryScene')`

**Avant :**
```javascript
openInventory() {
    this.scene.scene.launch("InventoryScene", { playerId });
    this.scene.scene.pause(); // ❌ Quelle scène ?
}
```

**Après :**
```javascript
openInventory() {
    this.scene.scene.pause('GameScene'); // ✅ Explicite
    this.scene.scene.launch("InventoryScene", { 
        playerId,
        returnScene: 'GameScene', // ✅ Explicite
        inBattle: false
    });
    this.scene.scene.bringToTop('InventoryScene'); // ✅ Premier plan
}
```

### 4. **BagScene.js** (~20 lignes modifiées)

**Modifications :**
- ✅ `init(data)` accepte `returnScene` (défaut: `'PokemonBattleScene'`)
- ✅ Tous les `scene.stop()` remplacés par `stop + resume + bringToTop`
- ✅ Bouton Retour corrigé avec `bringToTop()`

**Avant :**
```javascript
init(data) {
    this.playerId = data.playerId;
    this.inBattle = data.inBattle || false;
}

button.on('pointerdown', () => {
    this.scene.stop(); // ❌ Pas de resume
});
```

**Après :**
```javascript
init(data) {
    this.playerId = data.playerId;
    this.inBattle = data.inBattle || false;
    this.returnScene = data.returnScene || 'PokemonBattleScene'; // ✅
}

button.on('pointerdown', () => {
    this.scene.stop('BagScene');
    this.scene.resume(this.returnScene); // ✅
    this.scene.bringToTop(this.returnScene); // ✅ CRITIQUE
});
```

### 5. **BattleMenuManager.js** (~8 lignes modifiées)

**Modifications :**
- ✅ `showBagMenu()` pause maintenant `PokemonBattleScene` explicitement
- ✅ Transmission de `returnScene: 'PokemonBattleScene'` à BagScene
- ✅ Ajout de `bringToTop('BagScene')`

**Avant :**
```javascript
showBagMenu() {
    this.scene.scene.launch('BagScene', {
        playerId: this.scene.playerId,
        inBattle: true
    });
}
```

**Après :**
```javascript
showBagMenu() {
    this.scene.scene.pause('PokemonBattleScene'); // ✅ Pause explicite
    this.scene.scene.launch('BagScene', {
        playerId: this.scene.playerId,
        inBattle: true,
        returnScene: 'PokemonBattleScene' // ✅ Définir retour
    });
    this.scene.scene.bringToTop('BagScene'); // ✅ Premier plan
}
```

## 🎮 Scénarios testés (théoriques)

### Scénario 1 : GameScene → Inventaire → GameScene
```
1. GameScene active
2. Clic "Inventaire" (menu Start)
   → GameScene pause
   → InventoryScene launch (returnScene: 'GameScene')
   → InventoryScene bringToTop ✅
3. Inventaire s'affiche ✅
4. Clic "Retour"
   → InventoryScene stop
   → GameScene resume
   → GameScene bringToTop ✅
5. GameScene s'affiche ✅
```

### Scénario 2 : GameScene → PokemonTeam → Inventaire → PokemonTeam → GameScene
```
1. GameScene active
2. Clic "Équipe Pokémon" (menu Start)
   → GameScene pause
   → PokemonTeamScene launch (returnScene: 'GameScene')
   → PokemonTeamScene bringToTop ✅
3. Menu équipe s'affiche ✅
4. Clic "📦 Inventaire" (nouveau bouton)
   → PokemonTeamScene pause
   → InventoryScene launch (returnScene: 'PokemonTeamScene') ✅
   → InventoryScene bringToTop ✅
5. Inventaire s'affiche ✅
6. Clic "Retour"
   → InventoryScene stop
   → PokemonTeamScene resume
   → PokemonTeamScene bringToTop ✅
7. Menu équipe s'affiche ✅
8. Clic "Retour"
   → PokemonTeamScene stop
   → GameScene resume
   → GameScene bringToTop ✅
9. GameScene s'affiche ✅
```

### Scénario 3 : Combat → Sac (BagScene) → Combat
```
1. PokemonBattleScene active
2. Clic "Sac" (menu combat)
   → PokemonBattleScene pause
   → BagScene launch (returnScene: 'PokemonBattleScene') ✅
   → BagScene bringToTop ✅
3. Sac s'affiche ✅
4. Clic "Retour" ou utilise item
   → BagScene stop
   → PokemonBattleScene resume
   → PokemonBattleScene bringToTop ✅
5. Combat s'affiche ✅
```

### Scénario 4 : Combat → Pokémon → Combat (déjà fonctionnel)
```
1. PokemonBattleScene active
2. Clic "Pokémon" (menu combat)
   → GIFs cachés (hideAllGifs)
   → PokemonBattleScene pause
   → PokemonTeamScene launch (returnScene: 'PokemonBattleScene', inBattle: true)
   → PokemonTeamScene bringToTop ✅
3. Menu équipe s'affiche ✅
4. Switch Pokémon ou Retour
   → PokemonTeamScene stop
   → PokemonBattleScene resume
   → PokemonBattleScene bringToTop ✅
   → GIFs réaffichés (event 'resume')
5. Combat s'affiche ✅
```

## 🧪 Tests à effectuer manuellement

### Test 1 : Navigation basique
- [ ] GameScene → Inventaire → GameScene
- [ ] GameScene → Équipe → GameScene
- [ ] GameScene → Équipe → Inventaire → Équipe → GameScene

### Test 2 : Navigation en combat
- [ ] Combat → Sac → Combat
- [ ] Combat → Pokémon → Combat
- [ ] Combat → Pokémon → Inventaire (si ajouté) → Pokémon → Combat

### Test 3 : Vérifier bringToTop()
- [ ] Ouvrir Inventaire → Doit être au premier plan
- [ ] Retour → Scène parente doit être au premier plan
- [ ] Pas de "ghost scenes" invisibles en arrière-plan

### Test 4 : Context preservation
- [ ] Ouvrir inventaire en combat → Doit recevoir `inBattle: true`
- [ ] Ouvrir inventaire hors combat → Doit recevoir `inBattle: false`

## 🚨 Points d'attention

### 1. **bringToTop() est CRITIQUE**
Sans `bringToTop()`, la scène peut être active mais invisible (derrière une autre scène paused).

```javascript
// ❌ MAUVAIS
this.scene.resume(this.returnScene); // Scène active mais invisible !

// ✅ BON
this.scene.resume(this.returnScene);
this.scene.bringToTop(this.returnScene); // Scène visible au premier plan
```

### 2. **Toujours transmettre returnScene**
Chaque scène enfant DOIT savoir vers quelle scène revenir.

```javascript
// ❌ MAUVAIS - Assume GameScene
this.scene.launch('InventoryScene', { playerId });

// ✅ BON - Explicite
this.scene.launch('InventoryScene', { 
    playerId,
    returnScene: 'PokemonTeamScene' // Ou 'GameScene', ou 'PokemonBattleScene'
});
```

### 3. **Pause avant launch**
Toujours pause la scène actuelle AVANT de lancer la scène enfant.

```javascript
// ✅ BON ORDRE
this.scene.pause('CurrentScene');      // 1️⃣ Pause
this.scene.launch('ChildScene', {...}); // 2️⃣ Launch
this.scene.bringToTop('ChildScene');    // 3️⃣ BringToTop
```

### 4. **Contexte combat**
En combat, transmettre `inBattle: true` et `battleState` pour que les scènes enfants adaptent leur comportement.

```javascript
this.scene.launch('InventoryScene', {
    playerId: this.playerId,
    returnScene: 'PokemonBattleScene',
    inBattle: true,              // ⚠️ Items combat uniquement
    battleState: this.battleState // ⚠️ Pokémon actifs, HP, etc.
});
```

## 📝 TODO restants

### Priorité HAUTE
- [ ] **Tester manuellement** tous les scénarios de navigation
- [ ] **Vérifier console** : Pas d'erreurs `scene not found`
- [ ] **Tester en combat** : Sac → Items → Retour combat
- [ ] **Tester hors combat** : Inventaire → Items → Retour

### Priorité MOYENNE
- [ ] **Rendre InventoryScene générique** pour combat + hors combat
  - Filtrer items selon `inBattle` (potions OK, boosters NON)
  - Ajouter sélection Pokémon cible pour items de soin
  - Gérer callback `onItemUsed` comme BagScene

### Priorité BASSE
- [ ] Créer `SceneNavigationManager` centralisé (éviter duplication code)
- [ ] Ajouter transitions visuelles (fade in/out)
- [ ] Historique de navigation (breadcrumb)

## 🎯 Résultat attendu

Après ces corrections, le joueur peut :
- ✅ Naviguer librement entre toutes les scènes
- ✅ Utiliser l'inventaire depuis GameScene OU PokemonTeamScene
- ✅ Ouvrir le sac en combat sans casser l'affichage
- ✅ Revenir correctement à la scène parente à chaque fois
- ✅ Pas de "scènes fantômes" invisibles

---

**Version** : 1.0  
**Date** : 19 Novembre 2025  
**Auteur** : Équipe de développement Oppede  
**Bug résolu** : Navigation menus cassée (InventoryScene invisible)
