# Test Menu Navigation & Z-Index

## Objectif
Vérifier que toutes les scènes s'affichent correctement au premier plan et que le bouton "Envoyer au combat" fonctionne.

## Tests à effectuer

### Test 1: Ouverture TeamScene depuis BattleScene
**Étapes:**
1. Démarrer un combat
2. Cliquer sur le bouton "POKÉMON"
3. **Vérification:** TeamScene doit s'afficher AU-DESSUS de BattleScene (pas en arrière-plan)

**Résultat attendu:**
- ✅ TeamScene visible et interactive
- ✅ Sprites des Pokémon visibles
- ✅ Barres HP visibles
- ✅ Pas de transparence/superposition avec BattleScene

---

### Test 2: Ouverture DetailScene depuis TeamScene
**Étapes:**
1. Depuis TeamScene (ouvert en combat), cliquer sur une carte Pokémon
2. **Vérification:** DetailScene doit s'afficher AU-DESSUS

**Résultat attendu:**
- ✅ DetailScene visible et interactive
- ✅ Stats du Pokémon affichées
- ✅ Sprite principal visible
- ✅ Pas de superposition avec TeamScene/BattleScene

---

### Test 3: Bouton "Envoyer au combat" - Conditions d'affichage
**Étapes:**
1. Ouvrir DetailScene en combat
2. **Vérifier pour chaque cas:**

**Cas A: Pokémon non-K.O. et non-actif**
- ✅ Bouton "⚔️ Envoyer au combat" DOIT être visible

**Cas B: Pokémon K.O. (currentHP = 0)**
- ✅ Bouton NE DOIT PAS être visible

**Cas C: Pokémon déjà actif en combat**
- ✅ Bouton NE DOIT PAS être visible

---

### Test 4: Fonctionnalité bouton "Envoyer au combat"
**Étapes:**
1. Ouvrir DetailScene d'un Pokémon éligible (non-K.O., non-actif)
2. Cliquer sur "⚔️ Envoyer au combat"

**Résultat attendu:**
- ✅ DetailScene se ferme
- ✅ TeamScene se ferme
- ✅ BattleScene reprend AU PREMIER PLAN
- ✅ Le Pokémon sélectionné remplace le Pokémon actif
- ✅ Nouveau sprite visible à gauche
- ✅ Nouvelles stats affichées (HP, nom, niveau)
- ✅ Console log: `[PokemonDetail] Envoi au combat: [nom]`

---

### Test 5: Retour normal depuis DetailScene (bouton Retour)
**Étapes:**
1. Ouvrir DetailScene en combat
2. Cliquer sur le bouton "← Retour"

**Résultat attendu:**
- ✅ DetailScene se ferme
- ✅ TeamScene reprend AU PREMIER PLAN
- ✅ Liste des Pokémon toujours visible
- ✅ BattleScene reste en pause en arrière-plan

---

### Test 6: Retour depuis TeamScene vers BattleScene
**Étapes:**
1. Depuis TeamScene (ouvert en combat), cliquer "← Retour"

**Résultat attendu:**
- ✅ TeamScene se ferme
- ✅ BattleScene reprend AU PREMIER PLAN
- ✅ Combat reprend normalement
- ✅ Interface de combat complète (HP bars, boutons, sprites)

---

### Test 7: Navigation hors combat (vérification non-régression)
**Étapes:**
1. Depuis MainMenu, ouvrir l'équipe
2. Cliquer sur une carte Pokémon

**Résultat attendu:**
- ✅ DetailScene s'ouvre normalement
- ✅ Stats affichées correctement
- ✅ Bouton "Envoyer au combat" NON visible (inBattle=false)
- ✅ Seul bouton "← Retour" présent

---

### Test 8: Feedback visuel du bouton
**Étapes:**
1. Ouvrir DetailScene avec bouton "Envoyer au combat" visible
2. Survoler le bouton avec la souris

**Résultat attendu:**
- ✅ Couleur change (0x3498DB → 0x2980B9)
- ✅ Animation scale (1.0 → 1.05)
- ✅ Curseur devient "pointer" (main)
- ✅ Retour à la normale quand souris sort

---

## Résumé des corrections appliquées

### PokemonBattleScene.js (ligne 1287)
```javascript
showPokemonMenu() {
    // ...
    this.scene.launch('PokemonTeamScene', {...});
    this.scene.bringToTop('PokemonTeamScene'); // ✅ Ajouté
}
```

### PokemonTeamScene.js (ligne 555)
```javascript
goToDetail(pokemon) {
    // ...
    this.scene.start('PokemonDetailScene', {...});
    this.scene.bringToTop('PokemonDetailScene'); // ✅ Ajouté
}
```

### PokemonTeamScene.js (ligne 608)
```javascript
returnToScene() {
    if (this.scene.isPaused(this.returnScene)) {
        this.scene.resume(this.returnScene);
        this.scene.bringToTop(this.returnScene); // ✅ Ajouté
    }
    this.scene.stop();
}
```

### PokemonDetailScene.js (ligne 558)
```javascript
button.on('pointerdown', () => {
    // ...
    this.scene.resume('PokemonBattleScene');
    this.scene.bringToTop('PokemonBattleScene'); // ✅ Ajouté
    // ...
});
```

---

## Console Logs à surveiller

Lors de la navigation, vous devriez voir:

```
[PokemonBattleScene] Ouverture menu Pokémon
[PokemonTeam] Initialisation avec data: {playerId, returnScene, inBattle: true, battleState}
[PokemonTeam] Accès détails: [nom du Pokémon]
[PokemonDetail] Initialisation: {pokemon, returnScene, inBattle: true, battleState}
[PokemonDetail] Pokémon fourni directement: {...}
[PokemonDetail] Species depuis speciesData (ou species_id)
[PokemonDetail] Stats calculées: {hp, attack, defense, ...}
```

Si bouton cliqué:
```
[PokemonDetail] Envoi au combat: [nom du Pokémon]
[BattleScene] Switch Pokémon vers index: X
```

---

## Checklist rapide

- [ ] BattleScene → TeamScene: z-index OK
- [ ] TeamScene → DetailScene: z-index OK
- [ ] DetailScene → BattleScene (bouton): z-index OK
- [ ] DetailScene → TeamScene (retour): z-index OK
- [ ] TeamScene → BattleScene (retour): z-index OK
- [ ] Bouton affiché uniquement si éligible
- [ ] Changement de Pokémon fonctionne
- [ ] Feedback visuel sur hover
- [ ] Pas d'erreurs console
- [ ] Stats affichées correctement
- [ ] Traductions FR visibles

---

## Commandes pour tester

**Terminal 1 (Frontend):**
```powershell
npm run start
```

**Terminal 2 (Backend):**
```powershell
npm run server
```

**Navigateur:**
1. Ouvrir http://localhost:3000
2. Se connecter
3. Lancer un combat (wild ou trainer)
4. Suivre les tests ci-dessus

---

## En cas d'erreur

**Si TeamScene/DetailScene invisible:**
- Vérifier que `bringToTop()` est appelé après `launch()`/`resume()`
- Vérifier les console logs pour voir l'ordre d'exécution

**Si bouton ne fonctionne pas:**
- Vérifier `battleState.playerTeam` contient bien les Pokémon
- Vérifier `battleScene.switchPokemon()` existe et fonctionne
- Vérifier les _id correspondent (toString() des deux côtés)

**Si stats null:**
- Vérifier que `pokemon.speciesData` ou `pokemon.species_id` existe
- Vérifier que `nature` a une valeur par défaut ('hardy')
- Vérifier les logs de calcul des stats

---

## Status: ✅ READY FOR TESTING

Toutes les corrections ont été appliquées. Aucune erreur de compilation détectée.
