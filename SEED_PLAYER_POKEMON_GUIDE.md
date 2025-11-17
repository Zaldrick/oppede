# 🔴 Seed Pokémon Joueur

Script pour ajouter rapidement des Pokémon à des joueurs.

## 📝 Configuration

Éditez `scripts/seedPlayerPokemon.js` et modifiez `PLAYER_POKEMON_TEMPLATES` :

```javascript
const PLAYER_POKEMON_TEMPLATES = [
    {
        pseudo: "Marin",
        pokemons: [1, 4, 7, 25, 39, 54]  // IDs Pokédex
    },
    {
        pseudo: "Alice",
        pokemons: [6, 3, 9]
    }
];
```

## 🚀 Commandes d'utilisation

### 1️⃣ Seed tous les joueurs (défaut)
```bash
node scripts/seedPlayerPokemon.js
```
Ajoute tous les Pokémon configurés à chaque joueur du template.

### 2️⃣ Seed un joueur spécifique
```bash
node scripts/seedPlayerPokemon.js "Marin"
```
Ajoute seulement les Pokémon du joueur "Marin".

### 3️⃣ Clear + Seed (supprimer tous puis repeupler)
```bash
node scripts/seedPlayerPokemon.js --clear-all
```
Supprime TOUS les Pokémon joueur, puis ajoute ceux du template.

## 📊 Exemple output

```
✅ Connexion MongoDB établie

🚀 Mode: Seed tous les joueurs

Templates configurés:
  - Marin: 1, 4, 7, 25, 39, 54
  - Alice: 6, 3, 9, 35, 58, 63

📝 Ajout de Pokémon au joueur "Marin"...
  ✅ Bulbizarre (ID: 1) ajouté
  ✅ Salamèche (ID: 4) ajouté
  ✅ Carapuce (ID: 7) ajouté
  ✅ Pikachu (ID: 25) ajouté
  ✅ Rondoudou (ID: 39) ajouté
  ✅ Psykokwak (ID: 54) ajouté
  ✅ 6/6 Pokémon ajoutés à Marin

📊 Joueurs et leurs Pokémon:
════════════════════════════════════════════════════════════
👤 Marin - 6 Pokémon
👤 Alice - 6 Pokémon
👤 Bob - 6 Pokémon
════════════════════════════════════════════════════════════

✅ Seed terminé avec succès!
```

## 🔍 Pokédex Gen 1 (1-151)

| ID | Nom | ID | Nom | ID | Nom |
|----|-----|----|----|----|----|
| 1 | Bulbizarre | 2 | Herbizarre | 3 | Florizarre |
| 4 | Salamèche | 5 | Reptincel | 6 | Dracaufeu |
| 7 | Carapuce | 8 | Carabaffe | 9 | Tortank |
| 25 | Pikachu | 26 | Raichu | 39 | Rondoudou |
| 54 | Psykokwak | 55 | Psykoduck | 58 | Taupe |
| 63 | Abra | 64 | Kadabra | 65 | Alakazam |

... (voir PokéAPI pour la liste complète)

## ⚠️ Préalables

✅ `pokemonSpecies` doit être peuplée (lancez d'abord `seedPokemon.js`)
✅ Les joueurs doivent exister (créez-les depuis le jeu)

## 💡 Exemple complet

```bash
# 1. Sync tous les Pokémon Gen 1
node scripts/seedPokemon.js

# 2. Ajouter des Pokémon à "Marin"
node scripts/seedPlayerPokemon.js "Marin"

# 3. Lancer le jeu et vérifier
npm start
```

Puis en jeu: Appuyez **START** → Cliquez **Équipe** 🔴

## 🎯 Cas d'usage

- **Développement**: Remplir rapidement les joueurs de test
- **Démo**: Préparer des équipes pour présentation
- **Reset**: `--clear-all` pour nettoyer et recommencer
