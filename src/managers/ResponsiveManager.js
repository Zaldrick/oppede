/**
 * ResponsiveManager - Gestionnaire des layouts responsives
 * 
 * Ce manager s'occupe de :
 * - Adapter les tailles selon l'écran
 * - Gérer les breakpoints mobile/desktop
 * - Calculer les layouts de grilles
 * - Optimiser pour différentes résolutions
 */

import ConfigManager from './ConfigManager.js';

class ResponsiveManager {
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
     * Configuration de grille adaptée
     */
    getGridConfig() {
        const { width } = this.screenInfo;
        const scale = this.getScaleFactor();
        
        // Adapte le nombre de colonnes selon la largeur
        let cols = 4; // par défaut
        if (width < 480) cols = 2;
        else if (width < 768) cols = 3;
        else if (width < 1024) cols = 4;
        else cols = 5;

        const cellSize = (width * 0.8) / cols * scale;
        const spacing = cellSize * 0.1;

        return {
            cols,
            rows: Math.ceil(16 / cols), // Assure 16 cellules max
            cellSize,
            spacing,
            totalWidth: cols * cellSize + (cols - 1) * spacing,
            startX: (width - (cols * cellSize + (cols - 1) * spacing)) / 2,
        };
    }

    /**
     * Configuration d'espacement adaptée
     */
    getSpacingConfig() {
        const baseUnit = this.getBaseUnit();
        const scale = this.getScaleFactor();
        
        return {
            xs: baseUnit * 0.25 * scale,
            sm: baseUnit * 0.5 * scale,
            md: baseUnit * 1 * scale,
            lg: baseUnit * 1.5 * scale,
            xl: baseUnit * 2 * scale,
            xxl: baseUnit * 3 * scale,
        };
    }

    /**
     * Configuration typographique adaptée
     */
    getTypographyConfig() {
        const { width } = this.screenInfo;
        const scale = this.getScaleFactor();
        
        const baseSizes = {
            xs: { title: 24, subtitle: 18, body: 14, caption: 12 },
            sm: { title: 28, subtitle: 20, body: 16, caption: 14 },
            md: { title: 32, subtitle: 24, body: 18, caption: 16 },
            lg: { title: 36, subtitle: 28, body: 20, caption: 18 },
            xl: { title: 42, subtitle: 32, body: 24, caption: 20 },
        };

        const sizes = baseSizes[this.currentBreakpoint];
        
        return {
            title: Math.round(sizes.title * scale),
            subtitle: Math.round(sizes.subtitle * scale),
            body: Math.round(sizes.body * scale),
            caption: Math.round(sizes.caption * scale),
            
            // Styles Phaser prêts à l'emploi
            titleStyle: {
                fontSize: `${Math.round(sizes.title * scale)}px`,
                fontFamily: 'Arial',
                color: '#ffffff',
                fontStyle: 'bold'
            },
            
            subtitleStyle: {
                fontSize: `${Math.round(sizes.subtitle * scale)}px`,
                fontFamily: 'Arial',
                color: '#ffffff'
            },
            
            bodyStyle: {
                fontSize: `${Math.round(sizes.body * scale)}px`,
                fontFamily: 'Arial',
                color: '#ffffff'
            },
            
            captionStyle: {
                fontSize: `${Math.round(sizes.caption * scale)}px`,
                fontFamily: 'Arial',
                color: '#cccccc'
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
                minWidth: width * 0.2 * scale,
                minHeight: height * 0.06 * scale,
                padding: {
                    x: width * 0.02 * scale,
                    y: height * 0.01 * scale,
                }
            },
            
            // Joystick (mobile)
            joystick: {
                size: Math.min(width, height) * 0.15 * scale,
                position: {
                    x: width * 0.15,
                    y: height * (isPortrait ? 0.85 : 0.80),
                }
            },
            
            // Boutons d'action (mobile)
            actionButtons: {
                size: Math.min(width, height) * 0.08 * scale,
                positions: {
                    A: { x: width * 0.85, y: height * 0.75 },
                    B: { x: width * 0.75, y: height * 0.85 },
                }
            },
            
            // Modales et overlays
            modal: {
                width: width * (isPortrait ? 0.9 : 0.7),
                height: height * (isPortrait ? 0.7 : 0.8),
                padding: width * 0.05 * scale,
            },
            
            // Cartes (Triple Triad, etc.)
            card: {
                width: Math.min(width * 0.15 * scale, 120),
                height: Math.min(width * 0.15 * scale, 120) * ConfigManager.LAYOUT.IMAGES.CARD_ASPECT_RATIO,
            }
        };
    }

    /**
     * Utilitaires pour les développeurs
     */

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
            isMobile: ConfigManager.isMobile(),
        };
    }
}

// Export singleton
export default new ResponsiveManager();