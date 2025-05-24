import Phaser from "phaser";

export class SelectionCartesScene extends Phaser.Scene {
    constructor() {
        super("SelectionCartesScene");
        this.cartesJoueur = [];
        this.cartesAdversaire = [];
    }

    preload() {
        // Charge toutes les images de cartes nécessaires
        this.load.image('ifrit', 'assets/cards/ifrit.png');
        this.load.image('shiva', 'assets/cards/shiva.png');
        this.load.image('odin', 'assets/cards/odin.png');
        this.load.image('chocobo', 'assets/cards/chocobo.png');
        this.load.image('sephiroth', 'assets/cards/sephiroth.png');
        this.load.image('bahamut', 'assets/cards/bahamut.png');
        this.load.image('cloud', 'assets/cards/cloud.png');
        this.load.image('zidane', 'assets/cards/zidane.png');
        this.load.image('squall', 'assets/cards/squall.png');
        this.load.image('malboro', 'assets/cards/malboro.png');
        this.load.image('bomb', 'assets/cards/bomb.png');
        this.load.image('lightning', 'assets/cards/lightning.png');
        this.load.image('tidus', 'assets/cards/tidus.png');
        this.load.image('tomberry', 'assets/cards/tomberry.png');
    }

    init(data) {
        // data: { cartesJoueur, cartesAdversaire }
        this.cartesJoueur = data.cartesJoueur || [];
        this.cartesAdversaire = data.cartesAdversaire || [];
    }

    create(data) {
        const { width, height } = this.sys.game.canvas;

        // Fond
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000);

        // Titre
        this.add.text(width / 2, 20, "Sélectionnez vos cartes", {
            font: "28px Arial",
            fill: "#ffffff"
        }).setOrigin(0.5);

        // Cartes du joueur
        this.cartesJoueur.forEach((carte, index) => {
            this.afficherCarte(carte, index, 100, height / 2, true);
        });

        // Cartes de l'adversaire (IA), affichées en haut
        this.cartesAdversaire.forEach((carte, index) => {
            this.afficherCarte(carte, index, 100, height / 2 - 100, false);
        });

        // Bouton Annuler
        this.add.text(100, 100, "Annuler", { fill: "#f00" })
            .setInteractive()
            .on('pointerdown', () => {
                if (data.onAnnuler) data.onAnnuler();
            });

        // Bouton Valider
        this.add.text(300, 100, "Valider", { fill: "#0f0" })
            .setInteractive()
            .on('pointerdown', () => {
                const cartes = this.getSelectedCards();
                if (data.onValider) data.onValider(cartes);
            });
    }

    afficherCarte(carte, index, x, y, isJoueur) {
        const carteImage = this.add.image(x + index * 70, y, carte.image)
            .setOrigin(0.5)
            .setInteractive();

        // Sombre la carte si c'est l'adversaire
        if (!isJoueur) {
            carteImage.setAlpha(0.5);
        }

        carteImage.on('pointerdown', () => {
            if (isJoueur) {
                carte.selectionnee = !carte.selectionnee;
                carteImage.setTint(carte.selectionnee ? 0x44ff44 : 0xffffff);
            }
        });
    }

    getSelectedCards() {
        return this.cartesJoueur.filter(carte => carte.selectionnee);
    }
}