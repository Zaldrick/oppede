# Procédure de Mise à Jour du Mapping (Mobile Compatible)

Ce projet utilise une technique de découpage des tilesets pour contourner les limitations de taille de texture sur mobile (WebGL limits).
Le tileset `Interiors_48x48.png` est trop grand (> 16384px de haut) pour être chargé en un seul morceau sur la plupart des téléphones.

## Étapes pour mettre à jour la map

Si vous modifiez la map dans Tiled et que vous ré-exportez le fichier JSON, vous devez ré-appliquer le patch pour que la map fonctionne sur mobile.

### 1. Exporter depuis Tiled
1. Faites vos modifications dans Tiled.
2. Exportez la map au format **JSON** (`qwest.tmj`) dans `public/assets/maps/`.
   - Assurez-vous que le tileset `Interiors_48x48` est bien présent (même s'il est géant).

### 2. (Optionnel) Si vous avez modifié l'image du tileset
Si vous avez modifié le fichier image `Interiors_48x48.png` lui-même (ajout de nouveaux tiles graphiques), vous devez relancer le découpage :

1. Ouvrez un terminal PowerShell dans le dossier du projet.
2. Exécutez la commande suivante :
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts/Split-Tileset.ps1
   ```
   Cela va générer les fichiers `Interiors_48x48_part_0.png` à `part_10.png`.

### 3. Patcher le fichier JSON de la map
Cette étape est **obligatoire** après chaque export Tiled, car Tiled remet la référence vers l'image géante unique.

1. Ouvrez un terminal (PowerShell ou CMD) dans le dossier du projet.
2. Exécutez le script de patch :
   ```bash
   node scripts/patch_map_json.js
   ```
   
   Ce script va :
   - Lire `qwest.tmj`.
   - Remplacer l'entrée du tileset géant par les 11 entrées des tilesets découpés.
   - Ajuster les `firstgid` pour que les tiles de la map correspondent aux bonnes images.

### 4. Vérification
Relancez le jeu. La map devrait s'afficher correctement sur PC et Mobile.

## Note sur les Calques d'Objets (Object Layers)
Le jeu supporte désormais l'affichage des **Tile Objects** placés dans les calques d'objets.
- Si vous placez une tuile dans un calque d'objets (pour décorer librement), elle sera affichée en jeu.
- La profondeur (Z-index) dépend du nom du calque (ex: un calque nommé "15" sera affiché au-dessus du joueur).
- La couche nommée "events" est ignorée par le rendu visuel (réservée aux scripts).

