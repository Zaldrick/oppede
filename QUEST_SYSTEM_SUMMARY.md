# Système de Quêtes - Implémentation Complète

## 1. Backend (`managers/QuestManager.js`)
- **Collections** :
  - `quests` : Définitions des quêtes (titre, étapes).
  - `player_quests` : Progression des joueurs (questId, status, stepIndex).
- **Logique** :
  - `seedQuests()` : Initialise une quête d'exemple ("Le lait de Zack").
  - `GET /api/quests/:playerId` : Récupère les quêtes du joueur avec la description cumulative basée sur l'étape actuelle.
  - `POST /api/quests/start` : Démarre une quête.
  - `POST /api/quests/advance` : Avance d'une étape.
  - `POST /api/quests/complete` : Termine une quête.

## 2. Frontend (`src/QuestScene.js`)
- **Interface** :
  - Overlay sombre avec style cohérent.
  - **Onglets** : "En cours" et "Terminées".
  - **Liste** : Affiche les titres et l'étape actuelle.
  - **Détails** : Affiche le titre et la description complète (historique des étapes).
  - **Fermeture** : Bouton croix en haut à droite.

## 3. UI (`src/managers/UIManager.js`)
- **Menu Start** :
  - Remplacement du bouton "Fermer" par "Journal" (Icône 📜).
  - Ajout d'une croix (✕) en haut à droite du menu pour le fermer.
  - Méthode `openQuestJournal()` ajoutée pour lancer la scène.

## 4. Intégration (`server.js` & `src/App.js`)
- Le `QuestManager` est initialisé au démarrage du serveur.
- La `QuestScene` est enregistrée dans la configuration Phaser.

## Utilisation
- Ouvrez le menu Start (Echap ou bouton menu).
- Cliquez sur "Journal" pour voir vos quêtes.
- Utilisez la croix en haut à droite du menu Start pour le fermer sans ouvrir d'autre menu.
