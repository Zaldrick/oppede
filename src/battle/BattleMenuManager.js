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
        if (this.scene.turnInProgress) return;

        console.log('[BattleMenuManager] Ouverture du sac');
        this.hideMainMenu();

        this.scene.scene.launch('BagScene', {
            playerId: this.scene.playerId,
            inBattle: true,
            battleContext: this.scene.battleState,
            onItemUsed: (item) => {
                if (!item) {
                    this.hideDialog();
                    return;
                }
                this.scene.turnManager.useItemInBattle(item);
            }
        });
    }

    /**
     * Affiche le menu Pokémon
     */
    showPokemonMenu() {
        if (this.scene.turnInProgress) return;

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
        if (this.scene.dialogBox) {
            this.scene.dialogBox.setVisible(true);
            this.scene.dialogText.setText(message);
            this.scene.dialogText.setVisible(true);
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
    }

    /**
     * Masque le menu principal
     */
    hideMainMenu() {
        if (this.scene.dialogBox) this.scene.dialogBox.setVisible(false);
        if (this.scene.dialogText) this.scene.dialogText.setVisible(false);
        
        if (this.scene.actionButtons) {
            this.scene.actionButtons.forEach(btn => {
                if (btn.button) btn.button.setVisible(false);
                if (btn.text) btn.text.setVisible(false);
            });
        }
    }

    /**
     * Placeholder sac
     */
    showBagMenuPlaceholder() {
        if (this.scene.turnInProgress) return;
        this.showDialog("Le sac n'est pas encore implémenté en combat.");
        setTimeout(() => {
            this.hideDialog();
        }, 2000);
    }
}
