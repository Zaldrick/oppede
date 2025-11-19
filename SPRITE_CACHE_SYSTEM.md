# Système de Cache des Sprites Pokémon

## 📝 Description

Ce système évite de refaire des appels à PokeAPI à chaque chargement en mettant en cache les URLs des sprites.

## 🏗️ Architecture

### Côté Client (Browser)
- **Fichier**: `src/utils/spriteCacheManager.js`
- **Stockage**: `localStorage` (persistant entre sessions)
- **Durée**: 7 jours
- **Format**: URLs des sprites (front, back, frontShiny, backShiny)

### Côté Serveur (Node.js)
- **Fichier**: `managers/SpriteCacheManager.js`
- **Stockage**: Mémoire (`Map`)
- **Durée**: Jusqu'au redémarrage du serveur
- **Format**: URLs des sprites (menu, frontCombat, backCombat)

## 🔄 Flux de fonctionnement

### Premier chargement (cache vide)
```
Client demande sprite #25 (Pikachu)
  ↓
Cache localStorage: MISS
  ↓
Fetch PokeAPI: https://pokeapi.co/api/v2/pokemon/25
  ↓
Extraction URLs sprites
  ↓
Stockage dans localStorage
  ↓
Affichage sprite
```

### Chargements suivants (cache présent)
```
Client demande sprite #25 (Pikachu)
  ↓
Cache localStorage: HIT ✅
  ↓
Récupération URL depuis cache (pas d'appel API!)
  ↓
Affichage sprite
```

## 📊 Utilisation

### Pré-chargement automatique
Le système pré-charge automatiquement les sprites de l'équipe du joueur au démarrage de la GameScene.

### Commandes console (debug)
```javascript
// Voir les stats du cache
window.SpriteCacheManager.getCacheStats()
// {
//   version: "1.0",
//   spriteCount: 12,
//   ageInDays: 0,
//   createdAt: "18/11/2025 15:30:45",
//   sizeKB: 2.5
// }

// Vider le cache (force reload depuis PokeAPI)
window.SpriteCacheManager.clearCache()

// Récupérer les sprites d'un Pokémon (cache → API si besoin)
await window.SpriteCacheManager.getSprites(25) // Pikachu
```

## 🔧 Intégrations

### PokemonAPIManager (client)
```javascript
// Ligne 79-88: Extraction + mise en cache
SpriteCacheManager.setCachedSprites(pokedexId, {
    front: sprites.front || sprites.menu,
    back: sprites.back,
    frontShiny: pokemonData.sprites?.front_shiny,
    backShiny: pokemonData.sprites?.back_shiny
});
```

### PokemonBattleManager (serveur)
```javascript
// Ligne 579-597: Vérification cache avant fetch
const cachedSprites = spriteCacheManager.getSprites(speciesId);
if (cachedSprites) {
    console.log(`✅ Sprites #${speciesId} depuis cache serveur`);
}
```

### GameScene
```javascript
// Ligne 98: Pré-chargement au démarrage
this.preloadTeamSprites(playerData._id);
```

## ⚡ Performance

### Avant (sans cache)
- Chaque affichage de sprite = 1 appel PokeAPI (~200-500ms)
- Combat avec 2 Pokémon = 2-4 appels API
- Ouverture menu équipe (6 Pokémon) = 6 appels API

### Après (avec cache)
- Premier affichage = 1 appel PokeAPI + mise en cache
- Affichages suivants = 0 appel API (~instant)
- Combat = 0 appel API si sprites déjà cachés
- Menu équipe = 0 appel API (pré-chargés au démarrage)

### Réduction estimée
- **95% de réduction des appels PokeAPI**
- **Temps de chargement divisé par 10-20**
- **Pas de limite rate-limit PokeAPI**

## 🗑️ Maintenance

### Expiration automatique
- Client: 7 jours (MAX_CACHE_AGE)
- Serveur: Redémarrage serveur

### Vider le cache manuellement
```javascript
// Client
localStorage.removeItem('pokemon_sprite_cache')

// Ou via console
window.SpriteCacheManager.clearCache()
```

## 🐛 Dépannage

### Cache corrompu
Si le cache est corrompu, il est automatiquement recréé :
```javascript
// Version obsolète détectée → nouveau cache
// Erreur parsing JSON → nouveau cache
// Cache expiré → nouveau cache
```

### Cache trop gros
Le cache utilise localStorage (limite ~5-10MB selon navigateurs).
Pour un jeu avec 151 Pokémon Gen I :
- URLs moyenne: ~80 bytes/sprite
- 4 sprites/Pokémon = 320 bytes
- 151 Pokémon = ~48 KB
- **Très loin de la limite !**

## 📈 Améliorations futures possibles

1. **IndexedDB** pour plus d'espace et performances
2. **Service Worker** pour cache offline complet
3. **Compression** des URLs (base64 short codes)
4. **Pré-chargement intelligent** (prédiction des Pokémon à afficher)
5. **Partage de cache** entre utilisateurs (CDN custom)
