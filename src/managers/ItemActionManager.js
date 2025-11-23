/**
 * ItemActionManager.js
 * Gère la logique d'utilisation des objets selon le contexte (Combat, Menu, Extérieur)
 */

export const ITEM_CONTEXTS = {
    BATTLE: 'battle',
    MENU: 'menu',
    OVERWORLD: 'overworld',
    ANY: 'any'
};

export const ACTION_TYPES = {
    HEAL: 'heal',
    CAPTURE: 'capture',
    BOOSTER: 'booster',
    TEACH_MOVE: 'teach_move',
    EVOLVE: 'evolve',
    KEY_ITEM: 'key_item'
};

class ItemActionManager {
    constructor(scene) {
        this.scene = scene;
    }

    /**
     * Vérifie si un item est utilisable dans le contexte actuel
     * @param {Object} item - L'objet à utiliser
     * @param {String} context - Le contexte actuel (ITEM_CONTEXTS)
     * @returns {Object} { allowed: boolean, reason: string }
     */
    canUseItem(item, context) {
        if (!item) return { allowed: false, reason: "Item invalide" };

        // 1. Vérification basée sur le type d'item
        const type = item.type || '';
        
        // Pokéballs : Uniquement en combat
        if (type === 'pokeball' || item.nom.toLowerCase().includes('ball')) {
            if (context !== ITEM_CONTEXTS.BATTLE) {
                return { allowed: false, reason: "Utilisable uniquement en combat !" };
            }
            return { allowed: true };
        }

        // Boosters : Uniquement hors combat (Menu ou Overworld)
        if (type === 'booster') {
            if (context === ITEM_CONTEXTS.BATTLE) {
                return { allowed: false, reason: "Impossible d'ouvrir un booster en combat !" };
            }
            return { allowed: true };
        }

        // Soins : Tout le temps (sauf restrictions spécifiques)
        if (['healing', 'status-heal', 'revive'].includes(type) || item.nom.toLowerCase().includes('potion')) {
            return { allowed: true };
        }

        // CT/CS : Hors combat généralement
        if (type === 'tm_hm' || item.nom.toLowerCase().includes('ct')) {
            if (context === ITEM_CONTEXTS.BATTLE) {
                return { allowed: false, reason: "Impossible d'apprendre une capacité en combat !" };
            }
            return { allowed: true };
        }

        // Objets clés (Vélo, etc.)
        if (type === 'key_item' || item.isKeyItem) {
            // Exemple : Vélo uniquement en extérieur
            if (item.nom.toLowerCase().includes('vélo')) {
                if (context === ITEM_CONTEXTS.BATTLE) return { allowed: false, reason: "Pas le moment de faire du vélo !" };
                // TODO: Vérifier si on est en intérieur via MapManager
                // if (this.scene.mapManager && this.scene.mapManager.isIndoors()) ...
                return { allowed: true };
            }
            return { allowed: true }; // Par défaut autorisé (ex: Carte)
        }

        // Par défaut
        return { allowed: true };
    }

    /**
     * Exécute l'action de l'item
     * @param {Object} item - L'objet à utiliser
     * @param {String} context - Le contexte actuel
     * @param {Object} target - La cible (Pokémon, Joueur, etc.)
     */
    async executeAction(item, context, target = null) {
        const check = this.canUseItem(item, context);
        if (!check.allowed) {
            this.scene.displayMessage(check.reason);
            return false;
        }

        console.log(`[ItemActionManager] Exécution action pour ${item.nom} (Contexte: ${context})`);

        // Délégation selon le type
        const type = this.getItemType(item);

        switch (type) {
            case 'pokeball':
                return this.handlePokeballAction(item, context);
            case 'booster':
                return this.handleBoosterAction(item);
            case 'healing':
                return this.handleHealingAction(item, context, target);
            case 'tm_hm':
                return this.handleTeachMoveAction(item, target);
            default:
                console.warn("Action non gérée pour ce type d'item");
                return false;
        }
    }

    getItemType(item) {
        if (item.type) return item.type;
        const name = item.nom.toLowerCase();
        if (name.includes('ball')) return 'pokeball';
        if (name.includes('potion') || name.includes('soin')) return 'healing';
        if (name.includes('booster')) return 'booster';
        if (name.includes('ct')) return 'tm_hm';
        return 'general';
    }

    // === HANDLERS SPÉCIFIQUES ===

    handlePokeballAction(item, context) {
        if (context !== ITEM_CONTEXTS.BATTLE) return false;
        
        // En combat, l'action est gérée par le retour à la BattleScene
        // InventoryScene appelle useItemInBattle qui lance CaptureScene
        // Ici on valide juste que c'est possible
        return true;
    }

    handleBoosterAction(item) {
        // Lancer la scène d'ouverture de booster
        if (this.scene.scene.get('BoosterOpeningScene')) {
            // Si on est dans InventoryScene, on doit gérer la visibilité
            if (this.scene.domContainer) this.scene.domContainer.style.display = 'none';
            
            this.scene.scene.pause();
            this.scene.scene.launch("BoosterOpeningScene", { booster: item });
            
            // Gérer le retour
            const boosterScene = this.scene.scene.get('BoosterOpeningScene');
            boosterScene.events.once('shutdown', () => {
                if (this.scene.domContainer) this.scene.domContainer.style.display = 'flex';
                if (this.scene.handleInventoryUpdate) this.scene.handleInventoryUpdate();
                this.scene.scene.resume();
            });
            return true;
        }
        return false;
    }

    handleHealingAction(item, context, target) {
        if (context === ITEM_CONTEXTS.BATTLE) {
            // Retourner true pour signaler à InventoryScene de renvoyer l'item au combat
            return true;
        } else {
            // Hors combat : Ouvrir le menu d'équipe pour choisir sur qui utiliser
            console.log("Ouverture sélecteur équipe pour soin");
            // TODO: Implémenter la sélection de Pokémon hors combat
            this.scene.displayMessage("Utilisation de soin hors combat à venir !");
            try {
                if (this.scene && this.scene.soundManager) {
                    this.scene.soundManager.playMoveSound('pokecenter_heal', { volume: 0.85 });
                } else if (this.scene && this.scene.sound) {
                    // fallback to audio key if any exists
                    this.scene.sound.play("PokeCenter_Heal", { volume: 0.85 });
                }
            } catch (e) { /* ignore */ }
            return true;
        }
    }

    handleTeachMoveAction(item, target) {
        this.scene.displayMessage("Apprentissage de capacité à venir !");
        return true;
    }
}

export default ItemActionManager;
