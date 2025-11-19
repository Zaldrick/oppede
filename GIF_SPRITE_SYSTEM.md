# 🎬 Système de Sprites GIF Animés

## 📋 Vue d'ensemble

Le système de sprites GIF permet aux joueurs de choisir entre des sprites **PNG statiques** (par défaut) ou des **GIF animés** pour les combats Pokémon.

## 🎮 Utilisation pour les joueurs

### Activer/Désactiver les sprites GIF

1. Ouvrir le **menu Équipe Pokémon** (touche `P` ou bouton équipe)
2. Cliquer sur le bouton **"🎬 Sprites GIF"** en haut à droite
3. Le bouton affiche l'état actuel :
   - 🎬 **Sprites GIF: ON** (vert) → GIF animés actifs
   - 🖼️ **Sprites GIF: OFF** (gris) → PNG statiques actifs

### Sauvegarde automatique

La préférence est **sauvegardée automatiquement** dans le navigateur (localStorage) et persiste entre les sessions.

## 🔧 Fonctionnement technique

### Architecture

```
┌─────────────────────────────────────────────┐
│  PokemonTeamScene.js                        │
│  ├─ Bouton toggle GIF/PNG                   │
│  └─ Sauvegarde dans localStorage            │
└─────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  PokemonBattleScene.js                      │
│  ├─ Lecture localStorage au démarrage       │
│  ├─ this.useAnimatedSprites = true/false    │
│  └─ Nettoyage GIF containers à la fin       │
└─────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  BattleSpriteManager.js                     │
│  ├─ createOpponentSprite()                  │
│  ├─ createPlayerSprite()                    │
│  └─ createOrUpdatePlayerSprite()            │
│      → Utilise displaySpriteAuto()          │
└─────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│  SpriteLoader.js (spriteLoader.js)          │
│  ├─ displaySpriteAuto() → WRAPPER GÉNÉRIQUE │
│  │   ├─ Détecte GIF vs PNG                  │
│  │   ├─ Retourne objet unifié               │
│  │   └─ { type, sprite, gifContainer, ... } │
│  ├─ displayAnimatedGif() → Overlay DOM      │
│  ├─ hideAllGifs() / showAllGifs()           │
│  └─ removeAnimatedGif() → Cleanup           │
└─────────────────────────────────────────────┘
```

### Détection automatique

Les GIFs sont détectés automatiquement via le pattern d'URL :
```javascript
// GIF détecté
/assets/apparences/animated/pokemon-001.gif

// PNG détecté
/assets/apparences/pokemon-001.png
```

### Méthode `displaySpriteAuto()`

```javascript
const result = await SpriteLoader.displaySpriteAuto(
    scene,           // Scene Phaser
    x, y,            // Position
    spriteUrl,       // URL du sprite
    fallbackText,    // Texte si échec chargement
    scale,           // Échelle
    depth,           // Profondeur z-index
    useAnimated      // true = GIF, false = PNG
);

// Retourne un objet unifié
{
    type: 'phaser' | 'gif',
    sprite: Phaser.Image | null,
    gifContainer: HTMLDivElement | null,
    gifElement: HTMLImageElement | null,
    x, y, scale, depth
}
```

### Méthodes génériques

```javascript
// Destruction (Phaser ou DOM)
BattleSpriteManager.destroySprite(spriteData);

// Animation fade-in (Phaser tweens ou CSS)
await BattleSpriteManager.fadeInSprite(spriteData, shadow, 500);
```

## 📂 Structure des fichiers

### Fichiers modifiés

1. **src/utils/spriteLoader.js** (281 lignes)
   - ✅ 7 nouvelles méthodes GIF
   - ✅ Wrapper `displaySpriteAuto()`

2. **src/battle/BattleSpriteManager.js** (~280 lignes)
   - ✅ 2 méthodes génériques (`destroySprite`, `fadeInSprite`)
   - ✅ 3 méthodes converties (opponent, player, createOrUpdate)

3. **src/PokemonBattleScene.js** (2178 lignes)
   - ✅ Lecture localStorage
   - ✅ Tracking `gifContainers`
   - ✅ Event listener `resume`
   - ✅ Cleanup dans `cleanupBattle()`

4. **src/battle/BattleMenuManager.js** (145 lignes)
   - ✅ Import `SpriteLoader`
   - ✅ `hideAllGifs()` dans `showPokemonMenu()`

5. **src/PokemonTeamScene.js** (915 lignes)
   - ✅ Bouton toggle GIF/PNG
   - ✅ Sauvegarde localStorage
   - ✅ Notification visuelle

## 🎨 Gestion des menus

### Masquage automatique

Quand le menu Pokémon s'ouvre en combat :
```javascript
// BattleMenuManager.showPokemonMenu()
SpriteLoader.hideAllGifs(this.scene);
```

### Réaffichage automatique

Quand le menu se ferme :
```javascript
// PokemonBattleScene event listener
this.events.on('resume', () => {
    SpriteLoader.showAllGifs(this);
});
```

## 🧹 Nettoyage des ressources

### Fin de combat

```javascript
// PokemonBattleScene.cleanupBattle()
if (this.gifContainers?.length > 0) {
    this.gifContainers.forEach(container => {
        SpriteLoader.removeAnimatedGif(container);
    });
    this.gifContainers = [];
}
```

## 🧪 Tests

### Mode PNG (défaut)
- ✅ Sprites s'affichent correctement
- ✅ Animations (fade, HP, XP) fonctionnent
- ✅ Switch Pokémon sans erreurs
- ✅ Pas de containers GIF créés

### Mode GIF
- ✅ GIFs s'affichent aux bonnes positions
- ✅ Profondeur/z-index correct (player: 1, opponent: 5)
- ✅ GIFs masqués pendant menu équipe
- ✅ GIFs réaffichés après fermeture menu
- ✅ GIFs détruits à la fin du combat

## 📝 Notes importantes

### Compatibilité

- ✅ **Non-destructif** : Le système PNG existant fonctionne exactement comme avant
- ✅ **Rétrocompatible** : Pas besoin de modifier les URLs existantes
- ✅ **Performance** : Pas d'impact sur les performances PNG

### localStorage

La préférence est stockée dans :
```javascript
localStorage.getItem('useAnimatedSprites') // 'true' | 'false'
```

**Défaut** : `true` (sprites GIF activés) si la clé n'existe pas

### Profondeur des sprites

- **Shadows** : depth = 0
- **Player sprite** : depth = 1
- **UI elements** : depth = 3
- **Opponent sprite** : depth = 5
- **Notification** : depth = 1000-1001

## 🚀 Améliorations futures possibles

1. **Préchargement GIF** : Cache les GIF animés au démarrage
2. **Option par Pokémon** : Certains GIF, certains PNG
3. **Qualité GIF** : Option qualité basse/haute
4. **Taille adaptative** : Ajuster selon résolution écran
5. **Fallback automatique** : PNG si GIF introuvable

## 📞 Support

En cas de bug ou comportement inattendu :
1. Vérifier la console navigateur (F12)
2. Vérifier localStorage : `localStorage.getItem('useAnimatedSprites')`
3. Réinitialiser : `localStorage.removeItem('useAnimatedSprites')`
4. Recharger la page (F5)

---

**Version** : 1.0  
**Date** : 19 Novembre 2025  
**Auteur** : Équipe de développement Oppede
