import Phaser from "phaser";

/**
 * Menu de configuration pour les défis PvP
 * Permet de choisir les règles avant de lancer le défi
 */
export class TripleTriadPvPConfigScene extends Phaser.Scene {
    
    constructor() {
        super("TripleTriadPvPConfigScene");
        this.selectedRules = {
            same: true,
            plus: true,
            murale: true,
            mortSubite: false
        };
        this.playerId = null;
        this.opponentId = null;
        this.container = null;
    }
    
    init(data) {
        this.playerId = data.playerId;
        this.opponentId = data.opponentId;
        this.opponentName = data.opponentName || "Adversaire";
        this.selectedRules = data.rules || {
            same: true,
            plus: true,
            murale: true,
            mortSubite: false
        };
        // ? NOUVEAU : Gère les cartes pré-sélectionnées
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
        this.container.add(this.add.text(width / 2, height * 0.1, "Configuration du Défi", {
            font: `${Math.round(width * 0.06)}px Arial`,
            fill: "#fff",
            fontStyle: "bold"
        }).setOrigin(0.5));
        
        // === ADVERSAIRE ===
        this.container.add(this.add.text(width / 2, height * 0.2, `Adversaire : ${this.opponentName}`, {
            font: `${Math.round(width * 0.04)}px Arial`,
            fill: "#ffcc00",
            fontStyle: "bold"
        }).setOrigin(0.5));
        
        // === SECTION RÈGLES ===
        const rulesY = height * 0.3;
        
        this.container.add(this.add.text(width / 2, rulesY, "Règles du défi", {
            font: `${Math.round(width * 0.045)}px Arial`,
            fill: "#fff",
            fontStyle: "bold"
        }).setOrigin(0.5));
        
        this.container.add(this.add.text(width / 2, rulesY + 30, "Choisissez les règles qui s'appliqueront durant la partie", {
            font: `${Math.round(width * 0.03)}px Arial`,
            fill: "#ccc"
        }).setOrigin(0.5));
        
        const rules = [
            { 
                key: 'same', 
                label: 'Règle Identique', 
                desc: 'Si 2+ cartes adjacentes ont des valeurs égales,\nelles sont capturées' 
            },
            { 
                key: 'plus', 
                label: 'Règle Plus', 
                desc: 'Si 2+ cartes adjacentes ont la même somme,\nelles sont capturées' 
            },
            { 
                key: 'murale', 
                label: 'Règle Murale', 
                desc: 'Les bords du plateau comptent comme\ndes murs avec la valeur 10' 
            },
            { 
                key: 'mortSubite', 
                label: 'Mort Subite', 
                desc: 'En cas d\'égalité, une nouvelle manche\ncommence avec les cartes du plateau' 
            }
        ];
        
        rules.forEach((rule, index) => {
            const btnY = rulesY + 80 + index * 80;
            const isSelected = this.selectedRules[rule.key];
            
            // Checkbox
            const checkbox = this.add.text(width * 0.15, btnY, isSelected ? "?" : "?", {
                font: `${Math.round(width * 0.045)}px Arial`,
                fill: isSelected ? "#0f0" : "#fff"
            })
                .setOrigin(0.5)
                .setInteractive()
                .on('pointerdown', () => {
                    this.selectedRules[rule.key] = !this.selectedRules[rule.key];
                    this.drawConfigMenu();
                });
            
            this.container.add(checkbox);
            
            // Label cliquable
            const label = this.add.text(width * 0.2, btnY - 10, rule.label, {
                font: `${Math.round(width * 0.04)}px Arial`,
                fill: isSelected ? "#fff" : "#ccc",
                fontStyle: isSelected ? "bold" : "normal"
            })
                .setOrigin(0, 0.5)
                .setInteractive()
                .on('pointerdown', () => {
                    this.selectedRules[rule.key] = !this.selectedRules[rule.key];
                    this.drawConfigMenu();
                });
            
            this.container.add(label);
            
            // Description
            this.container.add(this.add.text(width * 0.2, btnY + 15, rule.desc, {
                font: `${Math.round(width * 0.025)}px Arial`,
                fill: "#aaa"
            }).setOrigin(0, 0.5));
        });
        
        // === APERÇU DES RÈGLES SÉLECTIONNÉES ===
        const previewY = height * 0.75;
        const activeRules = Object.entries(this.selectedRules).filter(([key, value]) => value);
        
        this.container.add(this.add.text(width / 2, previewY, "Règles actives :", {
            font: `${Math.round(width * 0.035)}px Arial`,
            fill: "#fff",
            fontStyle: "bold"
        }).setOrigin(0.5));
        
        if (activeRules.length > 0) {
            const ruleNames = activeRules.map(([key]) => {
                const ruleLabels = {
                    same: "Identique",
                    plus: "Plus",
                    murale: "Murale",
                    mortSubite: "Mort Subite"
                };
                return ruleLabels[key];
            }).join(" • ");
            
            this.container.add(this.add.text(width / 2, previewY + 25, ruleNames, {
                font: `${Math.round(width * 0.03)}px Arial`,
                fill: "#0f0"
            }).setOrigin(0.5));
        } else {
            this.container.add(this.add.text(width / 2, previewY + 25, "Aucune règle spéciale", {
                font: `${Math.round(width * 0.03)}px Arial`,
                fill: "#ff6666"
            }).setOrigin(0.5));
        }
        
        // === BOUTONS ===
        const btnY = height * 0.9;
        
        // Bouton Annuler
        const cancelBtn = this.add.text(width / 2 - 100, btnY, "Annuler", {
            font: `${Math.round(width * 0.04)}px Arial`,
            fill: "#fff",
            backgroundColor: "#666"
        })
            .setOrigin(0.5)
            .setPadding(20, 10, 20, 10)
            .setInteractive()
            .on('pointerdown', () => this.cancel());
        
        this.container.add(cancelBtn);
        
        // Bouton Lancer le Défi
        const challengeBtn = this.add.text(width / 2 + 100, btnY, "Lancer le Défi", {
            font: `${Math.round(width * 0.04)}px Arial`,
            fill: "#fff",
            backgroundColor: "#cc6600"
        })
            .setOrigin(0.5)
            .setPadding(20, 10, 20, 10)
            .setInteractive()
            .on('pointerdown', () => this.launchChallenge());
        
        this.container.add(challengeBtn);
    }
    
    cancel() {
        this.scene.stop();
        this.scene.resume("GameScene");
    }
    
    launchChallenge() {
        this.scene.stop();
        
        // ? NOUVEAU : Si on a des cartes pré-sélectionnées, lance directement le jeu
        if (this.preSelectedCards) {
            this.scene.launch("TripleTriadGameScene", {
                mode: "pvp",
                playerId: this.playerId,
                opponentId: this.opponentId,
                playerCards: this.preSelectedCards,
                rules: this.selectedRules
            });
        } else {
            // Lance la scène de sélection de cartes avec la configuration PvP
            this.scene.launch("TripleTriadSelectScene", {
                playerId: this.playerId,
                opponentId: this.opponentId,
                mode: "pvp",
                rules: this.selectedRules
            });
        }
    }
}