# 🧪 Test Switch Pokémon & Navigation - Checklist

## Test Rapide (3 minutes)

### ✅ Test 1: Sprite Correct dans DetailScene
- [ ] Ouvrir menu équipe (depuis GameScene ou BattleScene)
- [ ] Cliquer sur Pokémon #1 → Vérifier sprite = Pokémon #1
- [ ] Retour → Cliquer sur Pokémon #2 → Vérifier sprite = Pokémon #2
- [ ] Retour → Cliquer sur Pokémon #3 → Vérifier sprite = Pokémon #3

**Résultat attendu:** ✅ Chaque Pokémon affiche SON sprite (pas toujours le même)

---

### ✅ Test 2: Messages de Switch Corrects
- [ ] En combat, cliquer "POKÉMON"
- [ ] Sélectionner un Pokémon différent
- [ ] Cliquer "⚔️ Envoyer au combat"
- [ ] Vérifier message: "Reviens, [NOM] !" (pas "undefined")
- [ ] Vérifier message: "Go, [NOM] !" (pas "undefined")

**Résultat attendu:** ✅ Noms corrects affichés (nickname ou nom d'espèce)

---

### ✅ Test 3: Pas d'Erreur Console
- [ ] Effectuer un switch de Pokémon
- [ ] Ouvrir console (F12)
- [ ] Vérifier AUCUNE erreur rouge

**Erreurs à NE PAS voir:**
- ❌ "Cannot read properties of undefined (reading 'substring')"
- ❌ "Revient undefined"
- ❌ "Go undefined"

**Résultat attendu:** ✅ Console propre, juste des logs bleus/verts

---

### ✅ Test 4: Retour TeamScene depuis GameScene
- [ ] Depuis GameScene → Ouvrir équipe
- [ ] Cliquer sur un Pokémon
- [ ] Cliquer "← Retour" → Retour à TeamScene ✅
- [ ] Cliquer "← Retour" → Retour à GameScene ✅

**Résultat attendu:** ✅ Navigation fluide GameScene ↔ TeamScene ↔ DetailScene

---

### ✅ Test 5: Retour TeamScene depuis BattleScene
- [ ] En combat → Cliquer "POKÉMON"
- [ ] Cliquer sur un Pokémon
- [ ] Cliquer "← Retour" → Retour à TeamScene ✅
- [ ] Cliquer "← Retour" → Retour à BattleScene ✅
- [ ] Combat reprend normalement ✅

**Résultat attendu:** ✅ Navigation fluide BattleScene ↔ TeamScene ↔ DetailScene

---

## 🔍 Logs à Vérifier

Ouvrir console (F12) et chercher:

```
✅ [BattleScene] Switch Pokemon: { newIndex: 2, newPokemon: {...}, oldPokemon: {...} }
✅ [PokemonDetail] Sprite URL: /assets/pokemon/sprites/25.png
✅ [PokemonDetail] Retour à la scène précédente
✅ [PokemonTeam] Retour à BattleScene (ou GameScene)
```

**Aucune erreur ne doit apparaître !**

---

## 🎯 Si Tout Fonctionne

→ ✅ Marquer todo "Refactoriser menu changement Pokémon" comme COMPLET  
→ 🎉 Passer aux tests complets Phase 4 (voir TEST_MENU_NAVIGATION.md)

---

## 🐛 Si Problème Persiste

**Sprite toujours identique:**
→ Vérifier log `[PokemonDetail] Sprite URL`
→ URL doit changer selon le Pokémon

**Noms undefined:**
→ Vérifier log `[BattleScene] Switch Pokemon`
→ Objets doivent avoir `nickname` ou `name`

**Erreur substring:**
→ Vérifier que `spriteKey` a une valeur par défaut 'PK'

---

**Date:** 2025-11-17  
**Durée estimée:** 3 minutes  
**Status:** ✅ READY
