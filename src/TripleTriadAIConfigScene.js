import Phaser from "phaser";

/**
 * Menu de configuration pour jouer contre l'IA
 * Permet de choisir la difficulté et les règles
 */
export class TripleTriadAIConfigScene extends Phaser.Scene {
    
    constructor() {
        super("TripleTriadAIConfigScene");
        this.selectedDifficulty = 'medium';
        this.selectedRules = {
            same: true,
            plus: true,
            murale: true,
            mortSubite: false
        };
        this.playerId = null;
        this.container = null;
        this.preSelectedCards = null;
    }
    
    init(data) {
        this.playerId = data.playerId;
        this.selectedDifficulty = data.difficulty || 'medium';
        this.selectedRules = data.rules || {
            same: true,
            plus: true,
            murale: true,
            mortSubite: false
        };
        // Gère les cartes pré-sélectionnées
        this.preSelectedCards = data.preSelectedCards || null;
    }
    
    create() {
        const { width, height } = this.sys.game.canvas;
        
        // Fond
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.95);
        
        this.container = this.add.container(0, 0);
        
        this.drawConfigMenu();
    }
    
    drawConfigMenu() {
        const { width, height } = this.sys.game.canvas;
        
        // Nettoie le container
        this.container.removeAll(true);
        
        // === TITRE ===
        this.container.add(this.add.text(width / 2, height * 0.1, "Configuration IA", {
            font: `${Math.round(width * 0.06)}px Arial`,
            fill: "#fff",
            fontStyle: "bold"
        }).setOrigin(0.5));
        
        // === SECTION DIFFICULTÉ ===
        const difficultyY = height * 0.25;
        
        this.container.add(this.add.text(width / 2, difficultyY, "Difficulté de l'IA", {
            font: `${Math.round(width * 0.045)}px Arial`,
            fill: "#fff",
            fontStyle: "bold"
        }).setOrigin(0.5));
        
        const difficulties = [
            { key: 'easy', label: 'Facile', desc: 'IA débutante' },
            { key: 'medium', label: 'Moyen', desc: 'IA équilibrée' },
            { key: 'hard', label: 'Difficile', desc: 'IA experte' }
        ];
        
        difficulties.forEach((diff, index) => {
            const btnY = difficultyY + 60 + index * 50;
            const isSelected = this.selectedDifficulty === diff.key;
            
            const btn = this.add.text(width / 2 - 100, btnY, diff.label, {
                font: `${Math.round(width * 0.04)}px Arial`,
                fill: isSelected ? "#0f0" : "#fff",
                backgroundColor: isSelected ? "#004400" : "#444444"
            })
                .setOrigin(0, 0.5)
                .setPadding(12, 8, 12, 8)
                .setInteractive()
                .on('pointerdown', () => {
                    this.selectedDifficulty = diff.key;
                    this.drawConfigMenu();
                });
            
            this.container.add(btn);
            
            // Description
            this.container.add(this.add.text(width / 2 + 20, btnY, diff.desc, {
                font: `${Math.round(width * 0.03)}px Arial`,
                fill: "#ccc"
            }).setOrigin(0, 0.5));
        });
        
        // === SECTION RÈGLES ===
        const rulesY = height * 0.55;
        
        this.container.add(this.add.text(width / 2, rulesY, "Règles du jeu", {
            font: `${Math.round(width * 0.045)}px Arial`,
            fill: "#fff",
            fontStyle: "bold"
        }).setOrigin(0.5));
        
        const rules = [
            { key: 'same', label: 'Identique', desc: 'Capture si valeurs égales' },
            { key: 'plus', label: 'Plus', desc: 'Capture si même somme' },
            { key: 'murale', label: 'Murale', desc: 'Les murs comptent comme 10' },
            { key: 'mortSubite', label: 'Mort Subite', desc: 'Rejeu en cas d\'égalité' }
        ];
        
        rules.forEach((rule, index) => {
            const btnY = rulesY + 60 + index * 50;
            const isSelected = this.selectedRules[rule.key];
            
            const checkbox = this.add.text(width / 2 - 120, btnY, isSelected ? "?" : "?", {
                font: `${Math.round(width * 0.04)}px Arial`,
                fill: isSelected ? "#0f0" : "#fff"
            })
                .setOrigin(0.5)
                .setInteractive()
                .on('pointerdown', () => {
                    this.selectedRules[rule.key] = !this.selectedRules[rule.key];
                    this.drawConfigMenu();
                });
            
            this.container.add(checkbox);
            
            const label = this.add.text(width / 2 - 80, btnY, rule.label, {
                font: `${Math.round(width * 0.04)}px Arial`,
                fill: "#fff"
            })
                .setOrigin(0, 0.5)
                .setInteractive()
                .on('pointerdown', () => {
                    this.selectedRules[rule.key] = !this.selectedRules[rule.key];
                    this.drawConfigMenu();
                });
            
            this.container.add(label);
            
            // Description
            this.container.add(this.add.text(width / 2 + 20, btnY, rule.desc, {
                font: `${Math.round(width * 0.03)}px Arial`,
                fill: "#ccc"
            }).setOrigin(0, 0.5));
        });
        
        // === BOUTONS ===
        const btnY = height * 0.9;
        
        // Bouton Retour
        const backBtn = this.add.text(width / 2 - 100, btnY, "Retour", {
            font: `${Math.round(width * 0.04)}px Arial`,
            fill: "#fff",
            backgroundColor: "#666"
        })
            .setOrigin(0.5)
            .setPadding(20, 10, 20, 10)
            .setInteractive()
            .on('pointerdown', () => this.goBack());
        
        this.container.add(backBtn);
        
        // Bouton Commencer
        const startBtn = this.add.text(width / 2 + 100, btnY, "Commencer", {
            font: `${Math.round(width * 0.04)}px Arial`,
            fill: "#fff",
            backgroundColor: "#0a7c0a"
        })
            .setOrigin(0.5)
            .setPadding(20, 10, 20, 10)
            .setInteractive()
            .on('pointerdown', () => this.startGame());
        
        this.container.add(startBtn);
    }
    
    goBack() {
        this.scene.stop();
        this.scene.resume("GameScene");
    }
    
    startGame() {
        this.scene.stop();
        
        // Si on a des cartes pré-sélectionnées, lance directement le jeu
        if (this.preSelectedCards) {
            this.scene.launch("TripleTriadGameScene", {
                mode: "ai",
                playerId: this.playerId,
                playerCards: this.preSelectedCards,
                aiDifficulty: this.selectedDifficulty,
                rules: this.selectedRules
            });
        } else {
            // Lance la scène de sélection de cartes avec la configuration choisie
            this.scene.launch("TripleTriadSelectScene", {
                playerId: this.playerId,
                mode: "ai",
                aiDifficulty: this.selectedDifficulty,
                rules: this.selectedRules
            });
        }
    }
}