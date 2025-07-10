// === EXEMPLE D'INTÉGRATION DANS GAMESCENE ===

// Dans votre GameScene.js, ajoutez ces imports :
import { TripleTriadAIConfigScene } from './TripleTriadAIConfigScene.js';
import { TripleTriadPvPConfigScene } from './TripleTriadPvPConfigScene.js';

// Dans votre méthode create() ou là où vous gérez les menus :

// === BOUTON POUR JOUER CONTRE L'IA ===
// Au lieu de lancer directement TripleTriadSelectScene, lancez la config IA :
const playAIButton = this.add.text(x, y, "Jouer contre IA", { ... })
    .setInteractive()
    .on('pointerdown', () => {
        this.scene.pause();
        this.scene.launch("TripleTriadAIConfigScene", {
            playerId: this.playerId
        });
    });

// === BOUTON POUR DÉFIER UN JOUEUR ===
// Au lieu de lancer directement le défi, lancez la config PvP :
const challengeButton = this.add.text(x, y, "Défier un joueur", { ... })
    .setInteractive()
    .on('pointerdown', () => {
        // Supposons que vous avez sélectionné un adversaire
        const opponentId = this.selectedOpponentId;
        const opponentName = this.selectedOpponentName;
        
        this.scene.pause();
        this.scene.launch("TripleTriadPvPConfigScene", {
            playerId: this.playerId,
            opponentId: opponentId,
            opponentName: opponentName
        });
    });

// === ENREGISTREMENT DES SCÈNES ===
// Dans votre main.js ou là où vous configurez Phaser :
const config = {
    // ... autres configurations
    scene: [
        // ... vos autres scènes
        TripleTriadAIConfigScene,
        TripleTriadPvPConfigScene,
        // ... 
    ]
};

// === NAVIGATION DE RETOUR ===
// Les scènes de config retournent automatiquement à "GameScene"
// Si votre scène principale a un autre nom, modifiez dans les fichiers :
// this.scene.resume("GameScene"); ? this.scene.resume("VotreNomDeScene");