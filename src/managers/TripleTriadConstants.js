// Constantes centralisées pour Triple Triad
export const TRIPLE_TRIAD_CONSTANTS = {
    // Configuration du plateau
    BOARD: {
        SIZE: 3,
        EMPTY_VALUE: null
    },
    
    // Configuration des cartes
    CARDS: {
        HAND_SIZE: 5,
        MAX_WIDTH_RATIO: 0.125, // width / 8
        ASPECT_RATIO: 1.5,
        VALUE_FONT_RATIO: 0.38,
        GLOW_SCALE: 1.4,
        GLOW_ALPHA: 0.22,
        GLOW_STEPS: 22
    },
    
    // Configuration du plateau visuel
    VISUAL_BOARD: {
        WIDTH_RATIO: 0.80, // 80% de la largeur d'écran
        CELL_PADDING: 8,
        BORDER_WIDTH: 7,
        CARD_SCALE: 0.9
    },
    
    // Couleurs
    COLORS: {
        BACKGROUND: 0x000000,
        BOARD_BG: 0xA6A6A6,
        BOARD_BORDER: 0xB0B0B0,
        CELL_BG: 0x626262,
        CELL_BORDER_DEFAULT: 0xffffff,
        PLAYER_BORDER: 0x3399ff,
        OPPONENT_BORDER: 0xff3333,
        SUCCESS: "#33ff33",     // ? CORRIGÉ : Format CSS pour les textes
        DEFEAT: "#ff3333",      // ? CORRIGÉ : Format CSS pour les textes
        TIE: "#ffff33",         // ? CORRIGÉ : Format CSS pour les textes
        PLAYER_GLOW: 0xcbe2ea,
        OPPONENT_GLOW: 0xeacbcb
    },
    
    // Animations
    ANIMATIONS: {
        CARD_PLACEMENT: {
            DURATION: 320,
            BOUNCE_DURATION: 120,
            EASE: 'Cubic.easeOut',
            BOUNCE_EASE: 'Bounce.easeOut'
        },
        CARD_CAPTURE: {
            CLOSE_DURATION: 220,
            OPEN_DURATION: 200,
            FINAL_DURATION: 100,
            CLOSE_EASE: 'Cubic.easeIn',
            OPEN_EASE: 'Cubic.easeOut',
            FLASH_DURATION: 180
        },
        ARROW: {
            DURATION: 1400,
            SPINS_MIN: 5,
            SPINS_MAX: 7,
            SCALE_DURATION: 220,
            DELAY_AFTER: 700,
            EASE: 'Cubic.easeOut'
        },
        END_GAME: {
            APPEAR_DURATION: 420,
            EASE: 'Back.easeOut',
            FADE_DELAY: 4300,
            FADE_DURATION: 700
        },
        GLOW: {
            DURATION: 1200,
            EASE: 'Sine.easeInOut'
        }
    },
    
    // Audio
    AUDIO: {
        MUSIC: 'tripleTriadMusic',
        ARROW: 'tripleTriadArrow',
        CARD_PLACE: 'card_place',
        CARD_CAPTURE: 'card_capture',
        VICTORY: 'victoryMusic',
        DEFEAT: 'defeatMusic',
        VOLUME: {
            MUSIC: 0.5,
            EFFECTS: 1.0,
            END_MUSIC: 0.7
        }
    },
    
    // Règles du jeu
    RULES: {
        DEFAULT: {
            same: true,           // ? Règle "Same" (identique)
            plus: true,
            murale: true,
            mortSubite: false
        },
        WALL_VALUE: 10,
        DIFFICULTY_FILTERS: {
            easy: { maxRarity: 3 },
            medium: { maxRarity: 4 },
            hard: { maxRarity: null } // Pas de limite
        }
    },
    
    // Scores
    SCORES: {
        INITIAL_PLAYER: 5,
        INITIAL_OPPONENT: 5
    },
    
    // Players
    PLAYERS: {
        PLAYER: 0,
        OPPONENT: 1
    },
    
    // Positions et marges
    LAYOUT: {
        TOP_MARGIN_RATIO: 0.72,
        BOTTOM_MARGIN: 24,
        HAND_BOTTOM_MARGIN: 20,
        CARD_SPACING: 8,
        SCORE_MARGIN: {
            RIGHT: 0.96,
            TOP: 0.05,
            BOTTOM: 0.92
        }
    },
    
    // Cartes par défaut pour l'IA
    DEFAULT_AI_CARDS: [
        { nom: "Boguomile", image: "Bogomile.png", powerUp: 1, powerLeft: 5, powerDown: 4, powerRight: 1 },
        { nom: "Fungus", image: "Fungus.png", powerUp: 5, powerLeft: 3, powerDown: 1, powerRight: 1 },
        { nom: "Elmidea", image: "Elmidea.png", powerUp: 1, powerLeft: 5, powerDown: 3, powerRight: 3 },
        { nom: "Nocturnus", image: "Nocturnus.png", powerUp: 6, powerLeft: 2, powerDown: 1, powerRight: 1 },
        { nom: "Incube", image: "Incube.png", powerUp: 2, powerLeft: 5, powerDown: 1, powerRight: 3 },
        { nom: "Aphide", image: "Aphide.png", powerUp: 2, powerLeft: 4, powerDown: 4, powerRight: 1 },
        { nom: "Elastos", image: "Elastos.png", powerUp: 1, powerLeft: 1, powerDown: 4, powerRight: 5 },
        { nom: "Diodon", image: "Diodon.png", powerUp: 3, powerLeft: 1, powerDown: 2, powerRight: 5 },
        { nom: "Carnidea", image: "Carnidea.png", powerUp: 2, powerLeft: 1, powerDown: 6, powerRight: 1 },
        { nom: "Larva", image: "Larva.png", powerUp: 4, powerLeft: 3, powerDown: 4, powerRight: 2 },
        { nom: "Gallus", image: "Gallus.png", powerUp: 2, powerLeft: 6, powerDown: 2, powerRight: 1 }
    ]
};

// Directions pour les voisins de cellules
export const DIRECTIONS = {
    UP: { dr: -1, dc: 0, self: "powerUp", opp: "powerDown", name: "haut" },
    DOWN: { dr: 1, dc: 0, self: "powerDown", opp: "powerUp", name: "bas" },
    LEFT: { dr: 0, dc: -1, self: "powerLeft", opp: "powerRight", name: "gauche" },
    RIGHT: { dr: 0, dc: 1, self: "powerRight", opp: "powerLeft", name: "droite" }
};

export const DIRECTIONS_ARRAY = Object.values(DIRECTIONS);