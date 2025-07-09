/**
 * ConfigManager - Gestionnaire centralis� de toutes les constantes et configurations
 * 
 * Ce manager centralise :
 * - Toutes les valeurs de layout responsive
 * - Les constantes de gameplay
 * - Les configurations d'UI
 * - Les param�tres d'animation
 * - Les URLs et chemins
 */

class ConfigManager {
    constructor() {
        this.init();
    }

    init() {
        // === CONFIGURATION RESPONSIVE ===
        this.LAYOUT = {
            // Pourcentages de taille d'�cran
            SCREEN: {
                INVENTORY_WIDTH_RATIO: 0.9,
                INVENTORY_HEIGHT_RATIO: 0.85,
                TITLE_FONT_RATIO: 0.1,
                SUBTITLE_FONT_RATIO: 0.045,
                LARGE_FONT_RATIO: 0.07,
                MEDIUM_FONT_RATIO: 0.05,
                SMALL_FONT_RATIO: 0.04,
                MINI_FONT_RATIO: 0.035,
            },

            // Grilles et cellules
            GRID: {
                INVENTORY_COLS: 4,
                INVENTORY_ROWS: 4,
                CELL_SIZE_RATIO: 0.165,
                CELL_CONTENT_RATIO: 0.8,
                CELL_CONTENT_LARGE_RATIO: 0.9,
                QUANTITY_OFFSET: 0.3,
            },

            // Marges et espacements
            SPACING: {
                STANDARD_MARGIN: 24,
                SMALL_MARGIN: 16,
                LARGE_MARGIN: 32,
                GRID_SPACING: 8,
                BUTTON_SPACING: 10,
                ROW_SPACING_FACTOR: 1.5,
            },

            // Boutons et interactions
            BUTTONS: {
                HEIGHT_RATIO: 0.04,
                WIDTH_RATIO: 0.3,
                PADDING_X: 18,
                PADDING_Y: 10,
                RADIUS_RATIO: 0.07,
            },

            // Images et assets
            IMAGES: {
                LARGE_IMAGE_RATIO: 0.28,
                CARD_ASPECT_RATIO: 1.5,
                ICON_SIZE_RATIO: 0.06,
                THUMB_SIZE_RATIO: 0.8,
            }
        };

        // === CONFIGURATION TRIPLE TRIAD ===
        this.TRIPLE_TRIAD = {
            BOARD: {
                SIZE: 3, // Plateau 3x3
                CELL_WIDTH_RATIO: 0.80 / 3, // 80% de largeur divis� par 3
                BORDER_WIDTH: 7,
                BACKGROUND_COLOR: 0xA6A6A6,
                BACKGROUND_ALPHA: 0.95,
                STROKE_COLOR: 0xB0B0B0,
            },

            CARDS: {
                WIDTH_RATIO: 0.125, // width / 8
                MAX_WIDTH: 60,
                HAND_SIZE: 5,
                VALUES_FONT_RATIO: 0.38,
                STROKE_THICKNESS: 6,
                GLOW_ALPHA: 0.22,
                GLOW_SCALE: 1.4,
                GLOW_STEPS: 22,
            },

            COLORS: {
                PLAYER_BORDER: 0x3399ff,
                OPPONENT_BORDER: 0xff3333,
                PLAYER_GLOW: 0xcbe2ea,
                OPPONENT_GLOW: 0xeacbcb,
                CELL_DEFAULT: 0x626262,
                CELL_SELECTED: 0xff0000,
            },

            LAYOUT: {
                TOP_MARGIN_RATIO: 0.72,
                BOTTOM_MARGIN: 24,
                SCORE_FONT_RATIO: 0.1,
                CAROUSEL_CARDS_PER_ROW: 4,
                CAROUSEL_ROWS: 2,
                CAROUSEL_WIDTH_RATIO: 0.75,
            },

            ANIMATIONS: {
                CARD_PLACE_DURATION: 320,
                CARD_BOUNCE_DURATION: 120,
                CAPTURE_DURATION: 220,
                CAPTURE_REOPEN_DURATION: 200,
                FLASH_DURATION: 180,
                ARROW_SPIN_DURATION: 1400,
                ARROW_SCALE_DURATION: 220,
                GLOW_PULSE_DURATION: 1200,
            }
        };

        // === CONFIGURATION BOOSTER ===
        this.BOOSTER = {
            PACK: {
                WIDTH_RATIO: 0.35,
                HEIGHT_RATIO: 0.5,
            },

            REVEAL: {
                CARD_WIDTH_RATIO: 0.6,
                CARD_HEIGHT_RATIO: 0.7,
                INSTRUCTION_FONT: "28px 'Press Start 2P', monospace",
                ANIMATION_DURATION: 350,
                ANIMATION_DELAY: 150,
                NAME_FONT_BASE: 60,
                NAME_FONT_MIN: 25,
                NAME_WIDTH_RATIO: 0.9,
            },

            RECAP: {
                BG_WIDTH: 420,
                BG_HEIGHT: 340,
                MARGIN: 24,
                CARDS_PER_ROW: 5,
                CARD_MAX_WIDTH: 80,
                CARD_MAX_HEIGHT: 120,
                SPACING_RATIO: 0.85,
                NAME_FONT_BASE: 15,
                NAME_FONT_MIN: 12,
            }
        };

        // === CONFIGURATION UI/UX ===
        this.UI = {
            JOYSTICK: {
                BASE_COLOR: 0x888888,
                THUMB_COLOR: 0xffffff,
                RADIUS_RATIO: 0.12,
                THUMB_RATIO: 0.5,
                POSITION_X_RATIO: 0.2,
                POSITION_Y_RATIO: 0.82,
            },

            MOBILE_BUTTONS: {
                A_POSITION: { x: 0.92, y: 0.79 },
                B_POSITION: { x: 0.75, y: 0.85 },
                START_POSITION: { x: 0.5, y: 0.93 },
                START_SIZE: { width: 0.20, height: 0.04 },
            },

            INVENTORY: {
                DETAIL_POSITION: { x: 0.32, y: 0.64 },
                DETAIL_TEXT_POSITION: { x: 0.16, y: -0.1 },
                BUTTON_POSITIONS: {
                    USE: { x: -0.22, y: 0.03 },
                    THROW: { x: 0.22, y: 0.03 },
                },
                RETURN_POSITION: { x: 0.5, y: 0.88 },
            },

            COLORS: {
                BACKGROUND: 0x000000,
                BACKGROUND_ALPHA: 0.8,
                TEXT_PRIMARY: "#ffffff",
                TEXT_SECONDARY: "#cccccc",
                SUCCESS: "#33ff33",
                ERROR: "#ff3333",
                WARNING: "#ffff33",
                BUTTON_DEFAULT: 0x666666,
                BUTTON_SUCCESS: 0x229922,
                BUTTON_SELECTED: 0xff0000,
                BORDER: "#ffffff",
            }
        };

        // === CONFIGURATION GAMEPLAY ===
        this.GAMEPLAY = {
            PLAYER: {
                DEFAULT_SPEED: 160,
                BOOST_MULTIPLIER: 2,
                INTERACTION_DISTANCE: 64,
                UPDATE_INTERVAL: 2000,
                BROADCAST_INTERVAL: 50,
            },

            QUIZ: {
                DEFAULT_QUESTIONS: 10,
                ANSWER_TIME: 30,
                CATEGORIES: [
                    "Geographie",
                    "Art & Litterature", 
                    "Histoire",
                    "Science et Nature",
                    "Sport"
                ],
                DIFFICULTIES: ["facile", "moyen", "difficile", "mixte"],
            },

            CARDS: {
                DEFAULT_HAND_SIZE: 5,
                MAX_RARITY: 5,
                POWER_RANGE: [1, 10],
            }
        };

        // === CONFIGURATION ANIMATIONS ===
        this.ANIMATIONS = {
            FADE: {
                IN_DURATION: 1000,
                OUT_DURATION: 700,
                FAST_DURATION: 250,
            },

            TWEEN: {
                BOUNCE_EASE: 'Back.easeOut',
                SMOOTH_EASE: 'Cubic.easeOut',
                FAST_EASE: 'Cubic.easeIn',
                PULSE_EASE: 'Sine.easeInOut',
            },

            MESSAGE: {
                DISPLAY_TIME: 3000,
                FADE_DURATION: 500,
            }
        };

        // === CONFIGURATION R�SEAU ===
        this.NETWORK = {
            API: {
                BASE_URL: process.env.REACT_APP_API_URL || "http://localhost:5000",
                SOCKET_URL: process.env.REACT_APP_SOCKET_URL || "http://localhost:5000",
                TIMEOUT: 10000,
            },

            ENDPOINTS: {
                PLAYERS: "/api/players",
                INVENTORY: "/api/inventory",
                CARDS: "/api/cards",
                WORLD_EVENTS: "/api/world-events",
                PHOTOS: "/api/photos",
                BOOSTER: "/api/open-booster",
            }
        };

        // === CONFIGURATION ASSETS ===
        this.ASSETS = {
            PATHS: {
                ITEMS: "/assets/items/",
                CARDS: "/assets/items/",
                APPARENCES: "/assets/apparences/",
                SOUNDS: "/assets/sounds/",
                MUSICS: "/assets/musics/",
                MAPS: "/assets/maps/",
            },

            FORMATS: {
                IMAGES: [".png", ".jpg", ".jpeg", ".gif"],
                AUDIO: [".mp3", ".wav", ".ogg"],
            }
        };

        // === CONFIGURATION DE QUALIT� ===
        this.QUALITY = {
            TEXTURE_RESOLUTION: 1,
            ANTIALIAS: true,
            PIXEL_ART: false,
            MAX_TEXTURES: 500,
        };
    }

    // === M�THODES UTILITAIRES ===

    /**
     * Calcule la taille responsive d'un �l�ment
     */
    getResponsiveSize(baseSize, screenDimension, ratio) {
        return Math.min(baseSize, screenDimension * ratio);
    }

    /**
     * Obtient la taille de police optimale pour un texte
     */
    getOptimalFontSize(text, maxWidth, baseFontSize = 60, minFontSize = 25) {
        const charWidth = baseFontSize * 0.6;
        const estimatedWidth = text.length * charWidth;
        
        if (estimatedWidth <= maxWidth) {
            return baseFontSize;
        }
        
        const ratio = maxWidth / estimatedWidth;
        return Math.max(Math.floor(baseFontSize * ratio), minFontSize);
    }

    /**
     * Calcule la position centr�e d'une grille
     */
    getCenteredGridPosition(screenWidth, gridCols, cellSize, spacing = 0) {
        const gridWidth = gridCols * cellSize + (gridCols - 1) * spacing;
        return (screenWidth - gridWidth) / 2 + cellSize / 2;
    }

    /**
     * Calcule l'�chelle pour adapter une image � une taille max
     */
    getImageScale(originalWidth, originalHeight, maxWidth, maxHeight) {
        const scaleX = maxWidth / originalWidth;
        const scaleY = maxHeight / originalHeight;
        return Math.min(scaleX, scaleY, 1);
    }

    /**
     * Obtient une couleur en fonction du propri�taire (PvP vs IA)
     */
    getOwnerColor(owner, playerId, isPvP = false) {
        if (isPvP) {
            return owner === playerId ? 
                this.TRIPLE_TRIAD.COLORS.PLAYER_BORDER : 
                this.TRIPLE_TRIAD.COLORS.OPPONENT_BORDER;
        } else {
            return owner === "player" ? 
                this.TRIPLE_TRIAD.COLORS.PLAYER_BORDER : 
                this.TRIPLE_TRIAD.COLORS.OPPONENT_BORDER;
        }
    }

    /**
     * G�n�re une configuration de style pour les textes
     */
    getTextStyle(type, screenWidth, customOptions = {}) {
        const baseStyles = {
            title: {
                font: `${screenWidth * this.LAYOUT.SCREEN.TITLE_FONT_RATIO}px Arial`,
                fill: this.UI.COLORS.TEXT_PRIMARY,
                fontStyle: "bold"
            },
            subtitle: {
                font: `${screenWidth * this.LAYOUT.SCREEN.SUBTITLE_FONT_RATIO}px Arial`,
                fill: this.UI.COLORS.TEXT_PRIMARY,
            },
            button: {
                font: `${screenWidth * this.LAYOUT.SCREEN.MEDIUM_FONT_RATIO}px Arial`,
                fill: this.UI.COLORS.TEXT_PRIMARY,
                backgroundColor: "#333333",
                padding: { x: this.LAYOUT.BUTTONS.PADDING_X, y: this.LAYOUT.BUTTONS.PADDING_Y }
            },
            message: {
                font: `${screenWidth * this.LAYOUT.SCREEN.SMALL_FONT_RATIO}px Arial`,
                fill: this.UI.COLORS.TEXT_PRIMARY,
                backgroundColor: "#000000",
                padding: { x: 10, y: 5 },
                align: "center"
            }
        };

        return { ...baseStyles[type], ...customOptions };
    }

    /**
     * V�rifie si on est en mode mobile
     */
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    /**
     * Obtient la configuration compl�te pour une sc�ne
     */
    getSceneConfig(sceneName, screenWidth, screenHeight) {
        const baseConfig = {
            width: screenWidth,
            height: screenHeight,
            isMobile: this.isMobile(),
        };

        switch (sceneName) {
            case 'TripleTriad':
                return {
                    ...baseConfig,
                    ...this.TRIPLE_TRIAD,
                    cardWidth: Math.min(this.TRIPLE_TRIAD.CARDS.MAX_WIDTH, screenWidth / 8),
                    cellWidth: (screenWidth * this.TRIPLE_TRIAD.BOARD.CELL_WIDTH_RATIO),
                };

            case 'Inventory':
                return {
                    ...baseConfig,
                    ...this.UI.INVENTORY,
                    cellSize: screenWidth * this.LAYOUT.GRID.CELL_SIZE_RATIO,
                    gridCols: this.LAYOUT.GRID.INVENTORY_COLS,
                    gridRows: this.LAYOUT.GRID.INVENTORY_ROWS,
                };

            case 'Booster':
                return {
                    ...baseConfig,
                    ...this.BOOSTER,
                    packWidth: screenWidth * this.BOOSTER.PACK.WIDTH_RATIO,
                    packHeight: screenHeight * this.BOOSTER.PACK.HEIGHT_RATIO,
                };

            default:
                return baseConfig;
        }
    }
}

// Export singleton
export default new ConfigManager();