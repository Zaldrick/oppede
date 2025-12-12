# Problème de Tileset Invisible : Interiors_48x48

## Analyse
Le tileset `Interiors_48x48` ne s'affiche pas dans le jeu, alors que `Room_Builder_48x48` fonctionne correctement.

### Données Techniques
- **Room_Builder_48x48.png** : 3648 x 5424 pixels. (Fonctionne)
- **Interiors_48x48.png** : 768 x 41232 pixels. (Ne fonctionne pas)

### Cause Probable
La hauteur de l'image `Interiors_48x48.png` est de **41 232 pixels**.
La plupart des cartes graphiques (GPU) et des navigateurs via WebGL ont une limite de taille de texture (`MAX_TEXTURE_SIZE`).
- **Limite standard Desktop** : 16 384 pixels.
- **Limite standard Mobile** : 4 096 ou 8 192 pixels.

L'image dépasse largement cette limite (41k > 16k), ce qui empêche Phaser de charger ou d'afficher la texture correctement en mode WebGL.

## Solutions

### Solution Recommandée : Découper le Tileset
Il faut découper `Interiors_48x48.png` en plusieurs images plus petites (par exemple 3 images de ~14 000px de haut maximum, idéalement moins de 8192px pour la compatibilité mobile).
1. Découper l'image (ex: `Interiors_A.png`, `Interiors_B.png`, `Interiors_C.png`).
2. Dans Tiled, supprimer l'ancien tileset `Interiors_48x48`.
3. Ajouter les nouveaux tilesets.
4. Repeindre les calques concernés avec les nouveaux tilesets.

### Test Temporaire : Mode Canvas
On peut forcer Phaser à utiliser le moteur de rendu `CANVAS` au lieu de `WEBGL`. Le Canvas HTML5 utilise la RAM et n'a pas la même limite stricte de texture que le GPU, mais les performances seront moins bonnes.

**Pour tester :**
Modifier `src/App.js` :
```javascript
const config = {
    type: Phaser.CANVAS, // Au lieu de Phaser.AUTO
    // ...
};
```
Si cela fonctionne, cela confirme que le problème est bien la taille de la texture.
