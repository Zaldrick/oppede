---
description: Checklist rapide pour tester la navigation menu combat
---

# 🎯 Checklist Rapide - Navigation Menu Combat

## ⚡ Test Rapide (5 minutes)

### 1. Combat → Menu Team
- [ ] Démarrer combat
- [ ] Cliquer "POKÉMON"
- [ ] TeamScene visible AU-DESSUS ✅

### 2. Team → Detail
- [ ] Cliquer carte Pokémon
- [ ] DetailScene visible AU-DESSUS ✅
- [ ] Stats affichées ✅

### 3. Bouton "Envoyer au combat"
- [ ] Visible si Pokémon OK (non-K.O., non-actif) ✅
- [ ] Invisible si K.O. ✅
- [ ] Invisible si déjà actif ✅
- [ ] Cliquer → Switch fonctionne ✅
- [ ] BattleScene au premier plan ✅

### 4. Retours
- [ ] Detail → Team (← Retour) ✅
- [ ] Team → Battle (← Retour) ✅

### 5. Console
- [ ] Pas d'erreurs rouges ✅
- [ ] Logs de navigation présents ✅

---

## 🐛 Si Problème

**Scène invisible:**
→ Vérifier `bringToTop()` après `launch()`/`resume()`

**Bouton ne fonctionne pas:**
→ Vérifier console logs
→ Vérifier `battleScene.switchPokemon` existe

**Stats null:**
→ Vérifier `pokemon.speciesData` ou `pokemon.species_id`

---

## ✅ Si Tout Fonctionne

→ Marquer todo "Refactoriser menu changement Pokémon" comme ✅ COMPLET

→ Passer aux tests complets Phase 4 (combat, XP, capture, etc.)

---

**Status:** Prêt pour test
**Dernière modif:** 2025-11-17
