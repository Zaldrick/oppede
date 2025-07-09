/**
 * ResponsiveManager - Gestionnaire des layouts responsives
 * 
 * Ce manager s'occupe de :
 * - Adapter les tailles selon l'écran
 * - Gérer les breakpoints mobile/desktop
 * - Calculer les layouts de grilles
 * - Optimiser pour différentes résolutions
 */
export class ResponsiveManager {
    constructor() {
        this.currentBreakpoint = null;
        this.screenInfo = null;
        this.lastResize = 0;
        this.resizeThrottle = 100; // ms
    }

    /**
     * Initialise le manager responsive pour une scène
     */
    initialize(scene) {
        this.scene = scene;
        this.updateScreenInfo();
        this.setupResizeListener();
        return this.getResponsiveConfig();
    }

    /**
     * Met à jour les informations d'écran
     */
    updateScreenInfo() {
        const { width, height } = this.scene.scale;
        
        this.screenInfo = {
            width,
            height,
            aspectRatio: width / height,
            isLandscape: width > height,
            isPortrait: height > width,
            isSquare: Math.abs(width - height) < 50,
            diagonal: Math.sqrt(width * width + height * height),
        };

        // Détermine le breakpoint
        this.currentBreakpoint = this.getBreakpoint();
    }

    /**
     * Détermine le breakpoint actuel
     */
    getBreakpoint() {
        const { width } = this.screenInfo;
        
        if (width < 480) return 'xs';
        if (width < 768) return 'sm';
        if (width < 1024) return 'md';
        if (width < 1440) return 'lg';
        return 'xl';
    }

    /**
     * Configure un listener de resize throttlé
     */
    setupResizeListener() {
        if (!this.scene || !this.scene.scale) return;

        this.scene.scale.on('resize', (gameSize) => {
            const now = Date.now();
            if (now - this.lastResize > this.resizeThrottle) {
                this.lastResize = now;
                this.handleResize(gameSize);
            }
        });
    }

    /**
     * Gère le redimensionnement
     */
    handleResize(gameSize) {
        const oldBreakpoint = this.currentBreakpoint;
        this.updateScreenInfo();
        
        // Si le breakpoint a changé, émet un événement
        if (oldBreakpoint !== this.currentBreakpoint) {
            this.scene.events.emit('breakpoint-changed', {
                old: oldBreakpoint,
                new: this.currentBreakpoint,
                screenInfo: this.screenInfo
            });
        }

        // Émet toujours un événement de resize
        this.scene.events.emit('responsive-resize', this.screenInfo);
    }

    /**
     * Obtient la configuration responsive pour la scène courante
     */
    getResponsiveConfig() {
        const { width, height } = this.screenInfo;
        
        return {
            ...this.screenInfo,
            breakpoint: this.currentBreakpoint,
            
            // Tailles de base adaptées
            baseUnit: this.getBaseUnit(),
            
            // Facteurs d'échelle selon le breakpoint
            scale: this.getScaleFactor(),
            
            // Grilles adaptatives
            grid: this.getGridConfig(),
            
            // Espacements adaptatifs
            spacing: this.getSpacingConfig(),
            
            // Typographie adaptive
            typography: this.getTypographyConfig(),
            
            // Configuration UI adaptée
            ui: this.getUIConfig(),
        };
    }

    /**
     * Calcule l'unité de base selon l'écran
     */
    getBaseUnit() {
        const { width, height } = this.screenInfo;
        return Math.min(width, height) / 16; // 1/16 de la plus petite dimension
    }

    /**
     * Obtient le facteur d'échelle selon le breakpoint
     */
    getScaleFactor() {
        const factors = {
            xs: 0.7,
            sm: 0.8,
            md: 0.9,
            lg: 1.0,
            xl: 1.1
        };
        return factors[this.currentBreakpoint] || 1.0;
    }

    /**
     * Configuration de grille adaptée pour les cartes
     */
    getGridConfig() {
        const { width, height, isPortrait } = this.screenInfo;
        const scale = this.getScaleFactor();
        
        // Adapte le nombre de colonnes selon la largeur et l'orientation
        let cols = 4; // par défaut
        if (isPortrait) {
            if (width < 480) cols = 2;
            else if (width < 768) cols = 3;
            else cols = 4;
        } else {
            if (width < 768) cols = 3;
            else if (width < 1024) cols = 4;
            else if (width < 1440) cols = 5;
            else cols = 6;
        }

        const availableWidth = width * 0.8; // 80% de la largeur
        const cardWidth = Math.min(120 * scale, availableWidth / cols * 0.8);
        const cardHeight = cardWidth * 1.5; // Ratio carte
        const spacing = cardWidth * 0.1;

        return {
            cols,
            rows: 2, // Toujours 2 lignes pour le carrousel
            cardWidth,
            cardHeight,
            spacing,
            totalWidth: cols * cardWidth + (cols - 1) * spacing,
            startX: (width - (cols * cardWidth + (cols - 1) * spacing)) / 2,
            cardsPerPage: cols * 2 // 2 lignes
        };
    }

    /**
     * Configuration d'espacement adaptée
     */
    getSpacingConfig() {
        const baseUnit = this.getBaseUnit();
        const scale = this.getScaleFactor();
        
        return {
            xs: Math.max(4, baseUnit * 0.25 * scale),
            sm: Math.max(8, baseUnit * 0.5 * scale),
            md: Math.max(12, baseUnit * 1 * scale),
            lg: Math.max(16, baseUnit * 1.5 * scale),
            xl: Math.max(20, baseUnit * 2 * scale),
            xxl: Math.max(24, baseUnit * 3 * scale),
        };
    }

    /**
     * Configuration typographique adaptée
     */
    getTypographyConfig() {
        const { width, isPortrait } = this.screenInfo;
        const scale = this.getScaleFactor();
        
        const baseSizes = {
            xs: { title: 20, subtitle: 16, body: 12, caption: 10, button: 14 },
            sm: { title: 24, subtitle: 18, body: 14, caption: 12, button: 16 },
            md: { title: 28, subtitle: 22, body: 16, caption: 14, button: 18 },
            lg: { title: 32, subtitle: 26, body: 18, caption: 16, button: 20 },
            xl: { title: 36, subtitle: 30, body: 20, caption: 18, button: 22 },
        };

        const sizes = baseSizes[this.currentBreakpoint];
        
        // Ajustement spécial pour les écrans très larges
        const maxScale = isPortrait ? 1.2 : 1.4;
        const finalScale = Math.min(scale, maxScale);
        
        return {
            title: Math.round(sizes.title * finalScale),
            subtitle: Math.round(sizes.subtitle * finalScale),
            body: Math.round(sizes.body * finalScale),
            caption: Math.round(sizes.caption * finalScale),
            button: Math.round(sizes.button * finalScale),
            
            // Styles Phaser prêts à l'emploi
            titleStyle: {
                fontSize: `${Math.round(sizes.title * finalScale)}px`,
                fontFamily: 'Arial',
                color: '#ffffff',
                fontStyle: 'bold'
            },
            
            subtitleStyle: {
                fontSize: `${Math.round(sizes.subtitle * finalScale)}px`,
                fontFamily: 'Arial',
                color: '#ffffff'
            },
            
            bodyStyle: {
                fontSize: `${Math.round(sizes.body * finalScale)}px`,
                fontFamily: 'Arial',
                color: '#ffffff'
            },
            
            captionStyle: {
                fontSize: `${Math.round(sizes.caption * finalScale)}px`,
                fontFamily: 'Arial',
                color: '#cccccc'
            },

            buttonStyle: {
                fontSize: `${Math.round(sizes.button * finalScale)}px`,
                fontFamily: 'Arial',
                color: '#ffffff'
            }
        };
    }

    /**
     * Configuration UI adaptée
     */
    getUIConfig() {
        const { width, height, isPortrait } = this.screenInfo;
        const scale = this.getScaleFactor();
        
        return {
            // Boutons
            button: {
                minWidth: Math.max(100, width * 0.15 * scale),
                minHeight: Math.max(40, height * 0.06 * scale),
                padding: {
                    x: Math.max(8, width * 0.02 * scale),
                    y: Math.max(4, height * 0.01 * scale),
                }
            },
            
            // Zone de détail des cartes
            detailZone: {
                imageWidth: Math.min(150 * scale, width * 0.25),
                imageHeight: Math.min(225 * scale, width * 0.25 * 1.5),
                textAreaWidth: width * (isPortrait ? 0.6 : 0.5),
                topMargin: height * 0.02,
            },
            
            // Zone de sélection en bas
            selectionZone: {
                height: Math.max(80, height * 0.12),
                cardWidth: Math.min(50 * scale, (width - 60) / 5 * 0.8),
                bottomMargin: Math.max(60, height * 0.08),
            },

            // Carrousel de cartes
            carousel: {
                topMargin: Math.max(60, height * 0.08),
                height: Math.max(200, height * 0.25),
                arrowSize: Math.max(20, width * 0.03),
            },

            // Marges et paddings généraux
            layout: {
                padding: Math.max(16, Math.min(width, height) * 0.03),
                sectionSpacing: Math.max(20, height * 0.03),
                borderRadius: Math.max(4, scale * 6),
            }
        };
    }

    /**
     * Calcule une taille responsive
     */
    responsive(baseValue, unit = 'px') {
        const scale = this.getScaleFactor();
        const value = baseValue * scale;
        
        switch (unit) {
            case 'vw': return `${(value / this.screenInfo.width) * 100}vw`;
            case 'vh': return `${(value / this.screenInfo.height) * 100}vh`;
            case '%w': return (value / this.screenInfo.width) * 100;
            case '%h': return (value / this.screenInfo.height) * 100;
            default: return Math.round(value);
        }
    }

    /**
     * Vérifie si on est sur un breakpoint donné ou plus grand
     */
    isBreakpointUp(breakpoint) {
        const order = ['xs', 'sm', 'md', 'lg', 'xl'];
        const currentIndex = order.indexOf(this.currentBreakpoint);
        const targetIndex = order.indexOf(breakpoint);
        return currentIndex >= targetIndex;
    }

    /**
     * Vérifie si on est sur un breakpoint donné ou plus petit
     */
    isBreakpointDown(breakpoint) {
        const order = ['xs', 'sm', 'md', 'lg', 'xl'];
        const currentIndex = order.indexOf(this.currentBreakpoint);
        const targetIndex = order.indexOf(breakpoint);
        return currentIndex <= targetIndex;
    }

    /**
     * Applique des styles responsives à un objet Phaser
     */
    applyResponsiveStyle(gameObject, styles) {
        const currentStyle = styles[this.currentBreakpoint] || styles.default || {};
        
        Object.keys(currentStyle).forEach(prop => {
            if (gameObject[prop] !== undefined) {
                if (typeof gameObject[prop] === 'function') {
                    gameObject[prop](currentStyle[prop]);
                } else {
                    gameObject[prop] = currentStyle[prop];
                }
            }
        });
        
        return gameObject;
    }

    /**
     * Obtient des informations de debug
     */
    getDebugInfo() {
        return {
            screenInfo: this.screenInfo,
            breakpoint: this.currentBreakpoint,
            scale: this.getScaleFactor(),
            baseUnit: this.getBaseUnit(),
        };
    }
}

// Export singleton
export default new ResponsiveManager();