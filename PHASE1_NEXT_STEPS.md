# 🎮 PROCHAINES ÉTAPES - APRÈS PHASE 1

## ✅ Phase 1 est terminée !

Votre infrastructure backend Pokémon est maintenant prête. Avant de passer à la Phase 2, suivez ces étapes.

---

## 📋 ÉTAPE 1 : Synchroniser les données Pokémon (RECOMMANDÉ)

Populez votre base de données MongoDB avec les 151 Pokémon de la Gen 1 :

```bash
# Depuis le répertoire racine
node scripts/seedPokemon.js
```

**Qu'est-ce que cela fait :**
- 🔄 Télécharge 151 Pokémon depuis PokéAPI
- 💾 Les stocke dans MongoDB (collection `pokemonSpecies`)
- ⏱️ Respecte le rate limit (10-15 minutes environ)
- 📊 Affiche la progression en temps réel

**Output attendu :**
```
🔄 Début synchronisation PokéAPI (1-151)...
  ✅ 10/151 espèces synchronisées
  ✅ 20/151 espèces synchronisées
  ...
✅ Synchronisation terminée: 151 success, 0 failed, 0 skipped
```

---

## 🚀 ÉTAPE 2 : Démarrer le serveur backend

```bash
npm run server
```

**Vérification :**
Vous devriez voir :
```
✅ PokemonDatabaseManager initialisé
✅ PokemonPokeAPIManager initialisé
🎉 Serveur Oppede démarré sur le port 5000
```

---

## 🧪 ÉTAPE 3 : Tester l'API (optionnel)

Pour vérifier que tout fonctionne :

```bash
# Test 1 : Récupérer une espèce (Pikachu #25)
curl http://localhost:5000/api/pokemon/species/25

# Test 2 : Créer un Pokémon pour un joueur
# (remplacer USER_ID par un vrai MongoDB ObjectId d'un joueur existant)
curl -X POST http://localhost:5000/api/pokemon/create \
  -H "Content-Type: application/json" \
  -d '{"playerId":"USER_ID_HERE","speciesId":25,"nickname":"PikaPika"}'

# Test 3 : Récupérer l'équipe du joueur
curl http://localhost:5000/api/pokemon/team/USER_ID_HERE
```

---

## 📝 ÉTAPE 4 : Lancer le frontend React (nouveau terminal)

```bash
$env:PORT=4000; npm start
```

Cela démarrera le frontend React sur `http://localhost:4000` et backend sur `http://localhost:5000`.

---

## 🎯 ÉTAPE 5 : Prêt pour Phase 2

Une fois tout ✅, vous êtes prêt pour commencer la **Phase 2 : Frontend Équipe Pokémon**.

Les prochaines scènes à créer :
- `src/PokemonTeamScene.js` - Affichage équipe (6 Pokémon max)
- `src/PokemonDetailScene.js` - Détails d'un Pokémon (stats, mouvements)
- `src/managers/PokemonManager.js` - Client manager pour les appels API

---

## 📚 Fichiers de référence

- **Backend API** → `POKEMON_PHASE1_README.md`
- **Architecture** → `PHASE1_SUMMARY.md`
- **Implémentation** → Commentaires JSDoc dans les fichiers

---

## ⚠️ Si vous avez des problèmes

### Erreur : "Impossible de charger le fichier npm.ps1"
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
```

### Erreur : "Connexion MongoDB échouée"
- Vérifier `.env` contient `MONGO_URI` valide
- Vérifier que votre IP est whitelistée chez MongoDB Atlas

### Erreur : "PokéAPI rate limit"
- Le script attend automatiquement 250-400ms entre les requêtes
- Vous pouvez relancer `node scripts/seedPokemon.js` sans problème (il skip les doublons)

### Erreur : "Pokémon non trouvé"
- Vérifier que vous avez lancé `node scripts/seedPokemon.js` d'abord

---

## ✅ Checklist avant Phase 2

- [ ] `npm run server` démarre sans erreur
- [ ] 8 managers affichés au démarrage
- [ ] MongoDB connectée ✓
- [ ] `node scripts/seedPokemon.js` terminé (151 Pokémon)
- [ ] Test API `/api/pokemon/species/25` retourne Pikachu
- [ ] Frontend `npm start` accessible

---

## 🚀 Lancer Phase 2

Demandez simplement : **"Go Phase 2"**

Je créerai :
1. PokemonTeamScene.js - Scène gestion équipe
2. PokemonDetailScene.js - Scène détails Pokémon
3. PokemonManager.js - Client-side manager
4. Intégration dans MainMenuScene

Temps estimé : ~2-3 heures

---

**Vous êtes maintenant prêt ! 🎮**
