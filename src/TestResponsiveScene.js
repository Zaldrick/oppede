// Test simple du ResponsiveManager
import ResponsiveManager from "./managers/ResponsiveManager.js";

console.log("ResponsiveManager importé avec succès !");

export class TestResponsiveScene extends Phaser.Scene {
    constructor() {
        super("TestResponsiveScene");
    }

    create() {
        console.log("Test ResponsiveManager...");
        
        // Test d'initialisation
        const responsive = ResponsiveManager.initialize(this);
        
        console.log("Responsive config:", {
            breakpoint: responsive.breakpoint,
            width: responsive.width,
            height: responsive.height,
            scale: responsive.scale
        });

        // Test des méthodes utilitaires
        console.log("Base unit:", responsive.baseUnit);
        console.log("Grid config:", responsive.grid);
        console.log("Typography:", responsive.typography);
        console.log("UI config:", responsive.ui);
        
        // Test de création d'éléments responsives
        const title = this.add.text(
            responsive.width / 2,
            50,
            `Breakpoint: ${responsive.breakpoint}`,
            responsive.typography.titleStyle
        ).setOrigin(0.5);

        const subtitle = this.add.text(
            responsive.width / 2,
            100,
            `Taille: ${responsive.width}x${responsive.height}`,
            responsive.typography.subtitleStyle
        ).setOrigin(0.5);

        // Test de la grille responsive
        const { grid } = responsive;
        for (let i = 0; i < 6; i++) {
            const x = grid.startX + (i % grid.cols) * (grid.cardWidth + grid.spacing);
            const y = 200 + Math.floor(i / grid.cols) * (grid.cardHeight + grid.spacing);
            
            const card = this.add.rectangle(
                x + grid.cardWidth / 2,
                y + grid.cardHeight / 2,
                grid.cardWidth,
                grid.cardHeight,
                0x3366ff
            );
            
            const cardText = this.add.text(
                x + grid.cardWidth / 2,
                y + grid.cardHeight / 2,
                `${i + 1}`,
                responsive.typography.bodyStyle
            ).setOrigin(0.5);
        }

        console.log("? Test ResponsiveManager réussi !");
    }
}