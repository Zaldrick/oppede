# ?? Guide d'utilisation - ConfigManager & ResponsiveManager

## ?? **Architecture Corrigée**

```
oppede/
??? managers/                     # ?? BACKEND - Node.js
?   ??? DatabaseManager.js
?   ??? PlayerManager.js
?   ??? QuizManager.js
?   ??? TripleTriadManager.js
?   ??? PhotoManager.js
?   ??? SocketManager.js
??? src/
?   ??? managers/                 # ?? FRONTEND - Browser
?   ?   ??? ConfigManager.js     ? NOUVEAUX !
?   ?   ??? ResponsiveManager.js ? NOUVEAUX !
?   ?   ??? MapManager.js
?   ?   ??? PlayerManager.js
?   ?   ??? RemotePlayerManager.js
?   ?   ??? SocketManager.js
?   ?   ??? UIManager.js
?   ??? scenes/
??? server.js
```

## ?? **Comment Utiliser**

### **1. Import dans vos scènes**

```javascript
// Dans n'importe quelle scène
import ConfigManager from './managers/ConfigManager.js';
import ResponsiveManager from './managers/ResponsiveManager.js';
```

### **2. Utilisation basique**

```javascript
export class YourScene extends Phaser.Scene {
    create() {
        const { width, height } = this.scale;
        
        // ? AVANT (magic numbers partout)
        // const titleFont = `${width * 0.1}px Arial`;
        // const cellSize = width * 0.165;
        // const bgColor = 0x000000;
        
        // ?? APRÈS (constants centralisées)
        const titleStyle = ConfigManager.getTextStyle('title', width);
        const cellSize = width * ConfigManager.LAYOUT.GRID.CELL_SIZE_RATIO;
        const bgColor = ConfigManager.UI.COLORS.BACKGROUND;
        
        // Exemple avec configuration de scène
        const config = ConfigManager.getSceneConfig('Inventory', width, height);
        console.log('Config responsive:', config.cellSize, config.gridCols);
    }
}
```

### **3. ResponsiveManager pour layouts adaptatifs**

```javascript
export class ResponsiveScene extends Phaser.Scene {
    create() {
        // Initialise le responsive pour cette scène
        const responsive = ResponsiveManager.initialize(this);
        
        console.log('Breakpoint actuel:', responsive.breakpoint); // xs, sm, md, lg, xl
        console.log('Grille adaptative:', responsive.grid.cols); // 2-5 selon écran
        
        // Écoute les changements de breakpoint
        this.events.on('breakpoint-changed', (data) => {
            console.log(`Breakpoint: ${data.old} ? ${data.new}`);
            this.redrawUI(); // Redessine l'interface
        });
        
        // Utilise la grille responsive
        const { cellSize, cols, spacing, startX } = responsive.grid;
        this.createGrid(cellSize, cols, spacing, startX);
    }
}
```

### **4. Styles de texte automatiques**

```javascript
// Styles prêts à l'emploi
const titleStyle = ConfigManager.getTextStyle('title', width);
const buttonStyle = ConfigManager.getTextStyle('button', width);
const messageStyle = ConfigManager.getTextStyle('message', width);

// Personnalisés
const customStyle = ConfigManager.getTextStyle('title', width, {
    fill: '#ff0000',
    backgroundColor: '#000000'
});

this.add.text(x, y, "Mon titre", titleStyle);
```

### **5. Couleurs et constantes**

```javascript
// Couleurs
const playerColor = ConfigManager.TRIPLE_TRIAD.COLORS.PLAYER_BORDER;
const successColor = ConfigManager.UI.COLORS.SUCCESS;

// Tailles Triple Triad
const cardWidth = Math.min(ConfigManager.TRIPLE_TRIAD.CARDS.MAX_WIDTH, width / 8);
const boardSize = ConfigManager.TRIPLE_TRIAD.BOARD.SIZE; // 3

// Animations
const fadeDuration = ConfigManager.ANIMATIONS.FADE.IN_DURATION;
const bounceEase = ConfigManager.ANIMATIONS.TWEEN.BOUNCE_EASE;

// API
const apiUrl = ConfigManager.NETWORK.API.BASE_URL;
const endpoint = ConfigManager.NETWORK.ENDPOINTS.INVENTORY;
```

### **6. Utilitaires pratiques**

```javascript
// Police optimale pour un texte
const fontSize = ConfigManager.getOptimalFontSize("Long texte", maxWidth, 60, 25);

// Position centrée d'une grille
const startX = ConfigManager.getCenteredGridPosition(screenWidth, 4, cellSize);

// Échelle d'image
const scale = ConfigManager.getImageScale(imgWidth, imgHeight, maxWidth, maxHeight);

// Détection mobile
const isMobile = ConfigManager.isMobile();

// Couleur selon propriétaire (PvP vs IA)
const color = ConfigManager.getOwnerColor(owner, playerId, isPvP);
```

## ?? **Migration d'une scène existante**

### **Étape 1 : Remplacer les magic numbers**

```javascript
// ? AVANT
const gameWidth = this.scale.width;
const gameHeight = this.scale.height;
this.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth * 0.9, gameHeight * 0.85, 0x000000, 0.8);

// ? APRÈS
const { width, height } = this.scale;
this.add.rectangle(
    width / 2, 
    height / 2, 
    width * ConfigManager.LAYOUT.SCREEN.INVENTORY_WIDTH_RATIO, 
    height * ConfigManager.LAYOUT.SCREEN.INVENTORY_HEIGHT_RATIO, 
    ConfigManager.UI.COLORS.BACKGROUND, 
    ConfigManager.UI.COLORS.BACKGROUND_ALPHA
);
```

### **Étape 2 : Remplacer les styles de texte**

```javascript
// ? AVANT
font: `${gameWidth * 0.1}px Arial`, fill: "#ffffff"

// ? APRÈS
const titleStyle = ConfigManager.getTextStyle('title', width);
```

### **Étape 3 : Utiliser les constantes**

```javascript
// ? AVANT
const gridCols = 4;
const cellSize = gameWidth * 0.165;

// ? APRÈS
const config = ConfigManager.getSceneConfig('Inventory', width, height);
const { cellSize, gridCols } = config;
```

## ?? **Avantages**

? **Fini les magic numbers** - Toutes les valeurs sont centralisées
? **Responsive automatique** - Adaptation selon l'écran
? **Maintenance facile** - Une modif = tout change
? **Cohérence visuelle** - Mêmes valeurs partout
? **Debugging simple** - `ResponsiveManager.getDebugInfo()`
? **Typescript ready** - Structure claire pour types

## ?? **Prochaines étapes**

1. Migrer `InventoryScene.js` ? utiliser l'exemple
2. Migrer `TripleTriadGameScene.js` ? plus gros refactoring
3. Créer `AssetManager.js` pour centraliser les assets
4. Créer `AnimationManager.js` pour les tweens récurrents

---

**Note :** Les anciens managers backend (`managers/`) restent inchangés. Seuls les nouveaux managers frontend (`src/managers/`) utilisent la nouvelle architecture.