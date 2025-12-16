/**
 * BattleMenuManager.js
 * Gère la navigation entre les différents menus du combat
 * 
 * Responsabilités:
 * - Afficher/cacher sélecteur de moves
 * - Ouvrir sac et team
 * - Afficher messages de dialogue
 */


export default class BattleMenuManager {
    constructor(scene) {
        this.scene = scene;

        // Dialogue queue (modal, click-to-advance)
        this.dialogQueue = [];
        this.dialogActive = false;
        this.dialogBlocker = null;
    }

    ensureDialogBlocker() {
        if (this.dialogBlocker || !this.scene || !this.scene.add) return;
        const width = this.scene.scale?.width || this.scene.cameras?.main?.width || 0;
        const height = this.scene.scale?.height || this.scene.cameras?.main?.height || 0;
        if (!width || !height) return;

        // Transparent interactive overlay to block all clicks and advance dialogue.
        this.dialogBlocker = this.scene.add
            .rectangle(0, 0, width, height, 0x000000, 0.001)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(10002)
            .setVisible(false);

        this.dialogBlocker.setInteractive();
        this.dialogBlocker.on('pointerdown', () => {
            if (this.dialogActive) {
                this.advanceDialog();
            }
        });
    }

    /**
     * Affiche le sélecteur de moves
     */
    async showMoveSelector() {
        this.scene.mainMenuBg.setVisible(false);
        this.scene.mainMenuButtons.forEach(btn => btn.setVisible(false));

        // Recréer si Pokemon changé
        if (this.scene.moveButtons && this.scene.moveButtons.length > 0) {
            this.scene.moveButtons.forEach(btn => {
                if (btn && btn.destroy) btn.destroy();
            });
            this.scene.moveButtons = [];
        }
        if (this.scene.backButton) {
            this.scene.backButton.destroy();
            this.scene.backButton = null;
        }
        
        const { width, height } = this.scene.cameras.main;
        await this.scene.uiManager.createMoveSelector(width, height);
        
        this.scene.moveButtons.forEach(btn => btn.setVisible(true));
        if (this.scene.backButton) this.scene.backButton.setVisible(true);
    }

    /**
     * Cache le sélecteur de moves
     */
    hideMoveSelector() {
        this.scene.mainMenuBg.setVisible(true);
        this.scene.mainMenuButtons.forEach(btn => btn.setVisible(true));

        if (this.scene.moveButtons) {
            this.scene.moveButtons.forEach(btn => btn.setVisible(false));
        }
        if (this.scene.backButton) this.scene.backButton.setVisible(false);
    }

    /**
     * Affiche le menu du sac
     */
    showBagMenu() {
        this.scene.showInventory();
    }

    /**
     * Affiche le menu Pokémon
     */
    showPokemonMenu() {
        if (this.scene.turnInProgress) return;

        // 🔧 FIXE: Masquer les GIFs animés qui passeraient au-dessus du menu
        const SpriteLoader = require('../utils/spriteLoader').default;
        SpriteLoader.hideAllGifs(this.scene);

        this.scene.scene.pause('PokemonBattleScene');
        this.scene.scene.launch('PokemonTeamScene', {
            playerId: this.scene.playerId,
            returnScene: 'PokemonBattleScene',
            inBattle: true,
            battleState: this.scene.battleState
        });
        this.scene.scene.bringToTop('PokemonTeamScene');
    }

    /**
     * Affiche un message dans la dialogBox
     */
    showDialog(message) {
        this.ensureDialogBlocker();

        return new Promise(resolve => {
            this.dialogQueue.push({ message: String(message ?? ''), resolve });
            if (!this.dialogActive) {
                this.dialogActive = true;
                this.showNextDialogItem();
            }
        });
    }

    showNextDialogItem() {
        const next = this.dialogQueue[0];
        if (!next) {
            this.dialogActive = false;
            this.hideDialog();
            return;
        }

        if (this.dialogBlocker) {
            this.dialogBlocker.setVisible(true);
            this.dialogBlocker.setActive(true);
        }

        if (this.scene.dialogBox && this.scene.dialogText) {
            this.scene.dialogBox.setVisible(true);
            this.scene.dialogText.setText(next.message);
            this.scene.dialogText.setVisible(true);
        }
    }

    advanceDialog() {
        const current = this.dialogQueue.shift();
        if (current && typeof current.resolve === 'function') {
            try { current.resolve(); } catch (e) { /* ignore */ }
        }

        if (this.dialogQueue.length > 0) {
            this.showNextDialogItem();
        } else {
            this.dialogActive = false;
            this.hideDialog();
        }
    }

    /**
     * Cache la dialogBox
     */
    hideDialog() {
        if (this.scene.dialogBox) {
            this.scene.dialogBox.setVisible(false);
            this.scene.dialogText.setVisible(false);
        }

        if (this.dialogBlocker) {
            this.dialogBlocker.setVisible(false);
            this.dialogBlocker.setActive(false);
        }
    }

    /**
     * Affiche un message "prompt" persistant (sans file d'attente, sans clic requis).
     * Utilisé pour le texte type "Que va faire X ?" qui doit rester affiché
     * pendant que le joueur choisit une action.
     */
    showPrompt(message) {
        // Stop any queued modal dialog so the UI can be interactive.
        this.dialogQueue = [];
        this.dialogActive = false;

        if (this.dialogBlocker) {
            this.dialogBlocker.setVisible(false);
            this.dialogBlocker.setActive(false);
        }

        if (this.scene.dialogBox && this.scene.dialogText) {
            this.scene.dialogBox.setVisible(true);
            this.scene.dialogText.setText(String(message ?? ''));
            this.scene.dialogText.setVisible(true);
        }
    }

    /**
     * Affiche le menu principal
     */
    showMainMenu() {
        if (this.scene.mainMenuBg) {
            this.scene.mainMenuBg.setVisible(true);
            this.scene.mainMenuBg.setAlpha(1);
        }
        
        if (this.scene.mainMenuButtons) {
            this.scene.mainMenuButtons.forEach(btn => {
                btn.setVisible(true);
                btn.setAlpha(1);
            });
        }

        // Support legacy/alternative naming
        if (this.scene.actionButtons) {
            this.scene.actionButtons.forEach(btn => {
                if (btn.button) btn.button.setVisible(true);
                if (btn.text) btn.text.setVisible(true);
            });
        }
    }

    /**
     * Masque le menu principal
     */
    hideMainMenu() {
        if (this.scene.dialogBox) this.scene.dialogBox.setVisible(false);
        if (this.scene.dialogText) this.scene.dialogText.setVisible(false);
        
        if (this.scene.mainMenuBg) this.scene.mainMenuBg.setVisible(false);

        if (this.scene.mainMenuButtons) {
            this.scene.mainMenuButtons.forEach(btn => btn.setVisible(false));
        }
        
        if (this.scene.actionButtons) {
            this.scene.actionButtons.forEach(btn => {
                if (btn.button) btn.button.setVisible(false);
                if (btn.text) btn.text.setVisible(false);
            });
        }
    }
}
