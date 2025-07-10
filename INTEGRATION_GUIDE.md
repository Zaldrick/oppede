// === EXEMPLE D'INT�GRATION DANS GAMESCENE ===

// Dans votre GameScene.js, ajoutez ces imports :
import { TripleTriadAIConfigScene } from './TripleTriadAIConfigScene.js';
import { TripleTriadPvPConfigScene } from './TripleTriadPvPConfigScene.js';

// Dans votre m�thode create() ou l� o� vous g�rez les menus :

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

// === BOUTON POUR D�FIER UN JOUEUR ===
// Au lieu de lancer directement le d�fi, lancez la config PvP :
const challengeButton = this.add.text(x, y, "D�fier un joueur", { ... })
    .setInteractive()
    .on('pointerdown', () => {
        // Supposons que vous avez s�lectionn� un adversaire
        const opponentId = this.selectedOpponentId;
        const opponentName = this.selectedOpponentName;
        
        this.scene.pause();
        this.scene.launch("TripleTriadPvPConfigScene", {
            playerId: this.playerId,
            opponentId: opponentId,
            opponentName: opponentName
        });
    });

// === ENREGISTREMENT DES SC�NES ===
// Dans votre main.js ou l� o� vous configurez Phaser :
const config = {
    // ... autres configurations
    scene: [
        // ... vos autres sc�nes
        TripleTriadAIConfigScene,
        TripleTriadPvPConfigScene,
        // ... 
    ]
};

// === NAVIGATION DE RETOUR ===
// Les sc�nes de config retournent automatiquement � "GameScene"
// Si votre sc�ne principale a un autre nom, modifiez dans les fichiers :
// this.scene.resume("GameScene"); ? this.scene.resume("VotreNomDeScene");