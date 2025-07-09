# ?? Guide d'utilisation - ConfigManager & ResponsiveManager

## ?? **Architecture Corrig�e**

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

### **1. Import dans vos sc�nes**

```javascript
// Dans n'importe quelle sc�ne
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
        
        // ?? APR�S (constants centralis�es)
        const titleStyle = ConfigManager.getTextStyle('title', width);
        const cellSize = width * ConfigManager.LAYOUT.GRID.CELL_SIZE_RATIO;
        const bgColor = ConfigManager.UI.COLORS.BACKGROUND;
        
        // Exemple avec configuration de sc�ne
        const config = ConfigManager.getSceneConfig('Inventory', width, height);
        console.log('Config responsive:', config.cellSize, config.gridCols);
    }
}
```

### **3. ResponsiveManager pour layouts adaptatifs**

```javascript
export class ResponsiveScene extends Phaser.Scene {
    create() {
        // Initialise le responsive pour cette sc�ne
        const responsive = ResponsiveManager.initialize(this);
        
        console.log('Breakpoint actuel:', responsive.breakpoint); // xs, sm, md, lg, xl
        console.log('Grille adaptative:', responsive.grid.cols); // 2-5 selon �cran
        
        // �coute les changements de breakpoint
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
// Styles pr�ts � l'emploi
const titleStyle = ConfigManager.getTextStyle('title', width);
const buttonStyle = ConfigManager.getTextStyle('button', width);
const messageStyle = ConfigManager.getTextStyle('message', width);

// Personnalis�s
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

// Position centr�e d'une grille
const startX = ConfigManager.getCenteredGridPosition(screenWidth, 4, cellSize);

// �chelle d'image
const scale = ConfigManager.getImageScale(imgWidth, imgHeight, maxWidth, maxHeight);

// D�tection mobile
const isMobile = ConfigManager.isMobile();

// Couleur selon propri�taire (PvP vs IA)
const color = ConfigManager.getOwnerColor(owner, playerId, isPvP);
```

## ?? **Migration d'une sc�ne existante**

### **�tape 1 : Remplacer les magic numbers**

```javascript
// ? AVANT
const gameWidth = this.scale.width;
const gameHeight = this.scale.height;
this.add.rectangle(gameWidth / 2, gameHeight / 2, gameWidth * 0.9, gameHeight * 0.85, 0x000000, 0.8);

// ? APR�S
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

### **�tape 2 : Remplacer les styles de texte**

```javascript
// ? AVANT
font: `${gameWidth * 0.1}px Arial`, fill: "#ffffff"

// ? APR�S
const titleStyle = ConfigManager.getTextStyle('title', width);
```

### **�tape 3 : Utiliser les constantes**

```javascript
// ? AVANT
const gridCols = 4;
const cellSize = gameWidth * 0.165;

// ? APR�S
const config = ConfigManager.getSceneConfig('Inventory', width, height);
const { cellSize, gridCols } = config;
```

## ?? **Avantages**

? **Fini les magic numbers** - Toutes les valeurs sont centralis�es
? **Responsive automatique** - Adaptation selon l'�cran
? **Maintenance facile** - Une modif = tout change
? **Coh�rence visuelle** - M�mes valeurs partout
? **Debugging simple** - `ResponsiveManager.getDebugInfo()`
? **Typescript ready** - Structure claire pour types

## ?? **Prochaines �tapes**

1. Migrer `InventoryScene.js` ? utiliser l'exemple
2. Migrer `TripleTriadGameScene.js` ? plus gros refactoring
3. Cr�er `AssetManager.js` pour centraliser les assets
4. Cr�er `AnimationManager.js` pour les tweens r�currents

---

**Note :** Les anciens managers backend (`managers/`) restent inchang�s. Seuls les nouveaux managers frontend (`src/managers/`) utilisent la nouvelle architecture.