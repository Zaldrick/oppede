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
            same: false,
            plus: false,
            murale: false,
            mortSubite: true
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
            font: `${Math.round(Math.min(width, height) * 0.06)}px Arial`,
            fill: "#fff",
            fontStyle: "bold"
        }).setOrigin(0.5));

        // === SECTION DIFFICULTÉ ===
        const difficultyY = height * 0.20;

        this.container.add(this.add.text(width / 2, difficultyY, "Puissance de l'IA", {
            font: `${Math.round(Math.min(width, height) * 0.045)}px Arial`,
            fill: "#fff",
            fontStyle: "bold"
        }).setOrigin(0.5));

        const difficulties = [
            { key: 'facile', label: 'Pauvre', desc: 'IA avec des cartes wish' },
            { key: 'normal', label: 'Ok Tier', desc: 'IA de classe moyen' },
            { key: 'difficile', label: 'Balkany', desc: 'Rire de droite' }
        ];

        const buttonHeight = height * 0.06;
        const buttonSpacing = height * 0.01;

        difficulties.forEach((diff, index) => {
            const btnY = difficultyY + height * 0.06 + index * (buttonHeight + buttonSpacing);
            const isSelected = this.selectedDifficulty === diff.key;

            const btn = this.add.text(width / 2 - width * 0.15, btnY, diff.label, {
                font: `${Math.round(Math.min(width, height) * 0.035)}px Arial`,
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
            this.container.add(this.add.text(width / 2 + width * 0.05, btnY, diff.desc, {
                font: `${Math.round(Math.min(width, height) * 0.025)}px Arial`,
                fill: "#ccc"
            }).setOrigin(0, 0.5));
        });

        // === SECTION RÈGLES ===
        const rulesY = height * 0.55;

        this.container.add(this.add.text(width / 2, rulesY, "Règles du Jeux", {
            font: `${Math.round(Math.min(width, height) * 0.046)}px Arial`,
            fill: "#fff",
            fontStyle: "bold"
        }).setOrigin(0.5));

        const rules = [
            { key: 'same', label: 'Identique', desc: 'Capture si valeurs égales' },
            { key: 'plus', label: 'Plus', desc: 'Capture si même somme' },
            { key: 'murale', label: 'Murale', desc: 'Les murs comptent comme un A' },
            { key: 'mortSubite', label: 'Mort Subite', desc: 'ReJeux en cas d\'égalité' }
        ];

        rules.forEach((rule, index) => {
            const btnY = rulesY + height * 0.06 + index * (buttonHeight + buttonSpacing);
            const isSelected = this.selectedRules[rule.key];

            const checkbox = this.add.text(width / 2 - width * 0.25, btnY, isSelected ? "☑" : "☐", {
                font: `${Math.round(Math.min(width, height) * 0.05)}px Arial`,
                fill: isSelected ? "#0f0" : "#fff"
            })
                .setOrigin(0.5)
                .setInteractive()
                .on('pointerdown', () => {
                    this.selectedRules[rule.key] = !this.selectedRules[rule.key];
                    this.drawConfigMenu();
                });

            this.container.add(checkbox);

            const label = this.add.text(width / 2 - width * 0.20, btnY, rule.label, {
                font: `${Math.round(Math.min(width, height) * 0.035)}px Arial`,
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
            this.container.add(this.add.text(width / 2 + width * 0.05, btnY, rule.desc, {
                font: `${Math.round(Math.min(width, height) * 0.025)}px Arial`,
                fill: "#ccc"
            }).setOrigin(0, 0.5));
        });

        // === BOUTONS ===
        const actionBtnY = height * 0.92;

        // Bouton Retour
        const backBtn = this.add.text(width * 0.3, actionBtnY, "Retour", {
            font: `${Math.round(Math.min(width, height) * 0.04)}px Arial`,
            fill: "#fff",
            backgroundColor: "#666"
        })
            .setOrigin(0.5)
            .setPadding(20, 10, 20, 10)
            .setInteractive()
            .on('pointerdown', () => this.goBack());

        this.container.add(backBtn);

        // Bouton Commencer
        const startBtn = this.add.text(width * 0.7, actionBtnY, "Commencer", {
            font: `${Math.round(Math.min(width, height) * 0.04)}px Arial`,
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

        // Si on a des cartes pré-sélectionnées, lance directement le Jeux
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