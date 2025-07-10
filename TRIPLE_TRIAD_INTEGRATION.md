// === CONFIGURATION PHASER MISE À JOUR ===
// Ajoutez ces scènes à votre configuration Phaser dans main.js ou index.js

import { TripleTriadAIConfigScene } from './src/TripleTriadAIConfigScene.js';
import { TripleTriadPvPConfigScene } from './src/TripleTriadPvPConfigScene.js';
import { TripleTriadSelectScene } from './src/TripleTriadSelectScene.js';
import { TripleTriadGameScene } from './src/TripleTriadGameScene.js';

// Dans votre configuration Phaser :
const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    scene: [
        // ... vos autres scènes existantes
        GameScene,
        QuizLobbyScene,
        QuizGameScene,
        
        // ? NOUVELLES SCÈNES TRIPLE TRIAD
        TripleTriadAIConfigScene,      // Menu config IA
        TripleTriadPvPConfigScene,     // Menu config PvP
        TripleTriadSelectScene,        // Sélection de cartes
        TripleTriadGameScene,          // Jeu Triple Triad
        
        // ... autres scènes
    ],
    physics: {
        default: 'arcade',
        arcade: { debug: false }
    }
};

// === EXEMPLE D'UTILISATION DANS VOS INTERFACES ===

// Dans votre UIManager.js ou là où vous créez les boutons :

createTripleTriadButtons() {
    const { width, height } = this.scene.scale;
    
    // Bouton "Jouer contre IA"
    const aiButton = this.scene.add.text(width - 200, 100, "Triple Triad IA", {
        font: "24px Arial",
        fill: "#fff",
        backgroundColor: "#4a4a4a"
    })
        .setPadding(12, 8, 12, 8)
        .setInteractive()
        .setScrollFactor(0)
        .on('pointerdown', () => {
            this.scene.startTripleTriadAI();
        })
        .on('pointerover', () => aiButton.setStyle({ backgroundColor: "#666" }))
        .on('pointerout', () => aiButton.setStyle({ backgroundColor: "#4a4a4a" }));
    
    // Bouton "Défier un joueur"
    const pvpButton = this.scene.add.text(width - 200, 150, "Défier Joueur", {
        font: "24px Arial", 
        fill: "#fff",
        backgroundColor: "#cc6600"
    })
        .setPadding(12, 8, 12, 8)
        .setInteractive()
        .setScrollFactor(0)
        .on('pointerdown', () => {
            this.scene.showOpponentSelector();
        })
        .on('pointerover', () => pvpButton.setStyle({ backgroundColor: "#dd7711" }))
        .on('pointerout', () => pvpButton.setStyle({ backgroundColor: "#cc6600" }));
}

// === INTÉGRATION DANS LES OBJETS INTERACTIFS ===

// Dans vos objets de la carte (PNJ, panneaux, etc.) :
createTripleTriadNPC() {
    // Exemple : PNJ qui propose des défis Triple Triad
    const npc = this.add.sprite(x, y, 'npc_sprite')
        .setInteractive()
        .on('pointerdown', () => {
            // Dialogue du PNJ
            this.displayMessage("Voulez-vous jouer au Triple Triad ?");
            
            // Menu contextuel
            this.showTripleTriadMenu();
        });
}

showTripleTriadMenu() {
    const { width, height } = this.scale;
    
    // Menu contextuel
    const menuBg = this.add.rectangle(width / 2, height / 2, 300, 200, 0x000000, 0.8)
        .setInteractive();
    
    const aiBtn = this.add.text(width / 2, height / 2 - 30, "Contre IA", {
        font: "20px Arial", fill: "#fff", backgroundColor: "#4a4a4a"
    })
        .setOrigin(0.5)
        .setPadding(10, 5, 10, 5)
        .setInteractive()
        .on('pointerdown', () => {
            menuBg.destroy();
            aiBtn.destroy();
            pvpBtn.destroy();
            this.startTripleTriadAI();
        });
    
    const pvpBtn = this.add.text(width / 2, height / 2 + 30, "Défier Joueur", {
        font: "20px Arial", fill: "#fff", backgroundColor: "#cc6600"
    })
        .setOrigin(0.5)
        .setPadding(10, 5, 10, 5)  
        .setInteractive()
        .on('pointerdown', () => {
            menuBg.destroy();
            aiBtn.destroy();
            pvpBtn.destroy();
            this.showOpponentSelector();
        });
}