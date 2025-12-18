/**
 * BattleTurnManager.js
 * Gère la logique des tours de combat et les actions
 * 
 * Responsabilités:
 * - Exécution des moves
 * - Tour de l'adversaire
 * - Switch de Pokémon
 * - Utilisation d'items
 * - Fuite
 */

import { getTypeEffectiveness, getEffectivenessMessage } from '../utils/typeEffectiveness';
import SpriteLoader from '../utils/spriteLoader';
import getPokemonDisplayName from '../utils/getDisplayName';

export default class BattleTurnManager {
    constructor(scene) {
        this.scene = scene;
    }

    /**
     * Affiche un message de combat (attaque) sans attendre un clic.
     * Le message reste affiché un court instant puis s'auto-valide.
     * Le joueur peut quand même cliquer pour avancer plus vite.
     */
    async showAttackDialog(message, autoAdvanceMs = 1000) {
        if (!this.scene?.menuManager?.showDialog) return;

        let resolved = false;
        const dialogPromise = this.scene.menuManager.showDialog(message);
        dialogPromise
            .then(() => { resolved = true; })
            .catch(() => { resolved = true; });

        const advance = () => {
            if (resolved) return;
            if (this.scene?.menuManager?.dialogActive && this.scene?.menuManager?.advanceDialog) {
                this.scene.menuManager.advanceDialog();
            }
        };

        if (this.scene?.time?.delayedCall) {
            this.scene.time.delayedCall(autoAdvanceMs, advance);
        } else {
            setTimeout(advance, autoAdvanceMs);
        }

        await dialogPromise;
    }

    /**
     * Sélectionne et exécute un move
     */
    async selectMove(moveName) {
        if (this.scene.turnInProgress) return;

        this.scene.turnInProgress = true;
        console.log('[BattleTurnManager] Move sélectionné:', moveName);

        this.scene.menuManager.hideMoveSelector();

        try {
            const moveNameFR = await this.scene.getMoveName(moveName);
            await this.showAttackDialog(`${getPokemonDisplayName(this.scene.battleState.playerActive)} utilise ${moveNameFR} !`);

            const result = await this.scene.battleManager.takeTurn(
                this.scene.battleId,
                moveName
            );

            // console.log('[BattleTurnManager] Résultat tour:', result);

            // 🆕 Ajouter isPlayer pour aider BattleAnimationManager (GIF support)
            if (result.playerAction) result.playerAction.isPlayer = true;
            if (result.opponentAction) result.opponentAction.isPlayer = false;

            await this.animateTurn(result);
            await this.updateBattleState(result);

            // 🆕 XP: à chaque K.O. adverse, pas seulement à la fin
            await this.processXPGains(result.xpGains);

            // 🆕 Combat dresseur: si le serveur a envoyé le Pokémon suivant, recréer l'UI et le sprite adverses
            await this.handleOpponentAutoSwitch(result);

            if (result.isOver) {
                console.log('[BattleTurnManager] Combat terminé - winner:', result.winner);

                // Message de fin (sinon la transition ressemble à un "reload")
                if (result.winner === 'player') {
                    await this.scene.menuManager.showDialog('Vous avez gagné !');
                } else {
                    await this.scene.menuManager.showDialog('Vous avez perdu...');
                }

                // (XP déjà gérée via processXPGains au moment du K.O.)

                // 🔧 IMPORTANT: terminer officiellement le combat côté serveur
                // (supprime l'activeBattle et, pour les dresseurs, marque le PNJ comme battu)
                try {
                    if (this.scene?.battleManager?.endBattle && this.scene?.battleId && result?.winner) {
                        await this.scene.battleManager.endBattle(this.scene.battleId, result.winner);
                    }
                } catch (e) {
                    console.warn('[BattleTurnManager] Erreur endBattle (non bloquant):', e);
                }

                // ✅ Combat dresseur: mettre à jour le PNJ côté client sans recharger la map
                try {
                    if (result.winner === 'player' && this.scene?.battleType === 'trainer' && this.scene?.trainerBattle?.trainerId) {
                        const returnSceneKey = this.scene.returnScene || 'GameScene';
                        const returnScene = this.scene.scene?.get ? this.scene.scene.get(returnSceneKey) : null;
                        const eventManager = returnScene?.mapManager?.eventManager;
                        if (eventManager?.markTrainerDefeated) {
                            eventManager.markTrainerDefeated(this.scene.trainerBattle.trainerId);
                        }
                    }
                } catch (e) {
                    console.warn('[BattleTurnManager] Impossible de maj PNJ dresseur (non bloquant):', e);
                }

                // 🆕 Défaite (plus de Pokémon en vie): TP qwest 3:3 + heal équipe + message
                try {
                    if (result.winner !== 'player' && typeof this.scene?.applyDefeatConsequences === 'function') {
                        await this.scene.applyDefeatConsequences();
                    }
                } catch (e) {
                    console.warn('[BattleTurnManager] applyDefeatConsequences (isOver) non bloquant:', e);
                }
                
                await this.scene.returnToSceneWithTransition();
            } else {
                if (this.scene.battleState.playerActive.currentHP <= 0) {
                    const alivePokemon = this.scene.battleState.playerTeam.filter(p => p.currentHP > 0);
                    
                    if (alivePokemon.length === 0) {
                        await this.scene.menuManager.showDialog('Vous n\'avez plus de Pokémon ! Vous avez perdu...');

                        // Terminer officiellement le combat côté serveur
                        try {
                            if (this.scene?.battleManager?.endBattle && this.scene?.battleId) {
                                await this.scene.battleManager.endBattle(this.scene.battleId, 'opponent');
                            }
                        } catch (e) {
                            console.warn('[BattleTurnManager] Erreur endBattle (lose) non bloquant:', e);
                        }

                        // 🆕 Défaite (plus de Pokémon en vie): TP qwest 3:3 + heal équipe + message
                        try {
                            if (typeof this.scene?.applyDefeatConsequences === 'function') {
                                await this.scene.applyDefeatConsequences();
                            }
                        } catch (e) {
                            console.warn('[BattleTurnManager] applyDefeatConsequences (no alive) non bloquant:', e);
                        }
                        await this.scene.returnToSceneWithTransition();
                    } else {
                        await this.scene.menuManager.showDialog('Choisissez un autre Pokémon !');
                        this.scene.turnInProgress = false;
                        this.scene.menuManager.showPokemonMenu();
                    }
                    return;
                }

                // Prompt persistant: pas de clic requis, le joueur choisit directement.
                if (this.scene?.menuManager?.showPrompt) {
                    this.scene.menuManager.showPrompt(`Que va faire ${getPokemonDisplayName(this.scene.battleState.playerActive)} ?`);
                } else {
                    // Fallback (ancien comportement)
                    this.scene.menuManager.showDialog(`Que va faire ${getPokemonDisplayName(this.scene.battleState.playerActive)} ?`);
                }
                this.scene.turnInProgress = false;
            }

        } catch (error) {
            console.error('[BattleTurnManager] Erreur tour:', error);
            await this.scene.menuManager.showDialog('Une erreur est survenue !');
            this.scene.menuManager.hideDialog();
            this.scene.turnInProgress = false;
        }
    }

    /**
     * Utilise un item en combat (consomme le tour) via le serveur.
     */
    async useItem(itemId, targetPokemonId, itemName = 'Objet') {
        if (this.scene.turnInProgress) return;

        this.scene.turnInProgress = true;
        console.log('[BattleTurnManager] Item utilisé:', { itemId, targetPokemonId, itemName });

        try {
            const result = await this.scene.battleManager.useItem(
                this.scene.battleId,
                itemId,
                targetPokemonId
            );

            if (result.playerAction) result.playerAction.isPlayer = true;
            if (result.opponentAction) result.opponentAction.isPlayer = false;

            await this.animateTurn(result);
            await this.updateBattleState(result);

            await this.processXPGains(result.xpGains);
            await this.handleOpponentAutoSwitch(result);

            if (result.isOver) {
                console.log('[BattleTurnManager] Combat terminé (item) - winner:', result.winner);

                if (result.winner === 'player') {
                    await this.scene.menuManager.showDialog('Vous avez gagné !');
                } else {
                    await this.scene.menuManager.showDialog('Vous avez perdu...');
                }

                try {
                    if (this.scene?.battleManager?.endBattle && this.scene?.battleId && result?.winner) {
                        await this.scene.battleManager.endBattle(this.scene.battleId, result.winner);
                    }
                } catch (e) {
                    console.warn('[BattleTurnManager] Erreur endBattle (item) non bloquant:', e);
                }

                try {
                    if (result.winner === 'player' && this.scene?.battleType === 'trainer' && this.scene?.trainerBattle?.trainerId) {
                        const returnSceneKey = this.scene.returnScene || 'GameScene';
                        const returnScene = this.scene.scene?.get ? this.scene.scene.get(returnSceneKey) : null;
                        const eventManager = returnScene?.mapManager?.eventManager;
                        if (eventManager?.markTrainerDefeated) {
                            eventManager.markTrainerDefeated(this.scene.trainerBattle.trainerId);
                        }
                    }
                } catch (e) {
                    console.warn('[BattleTurnManager] Impossible de maj PNJ dresseur (item) non bloquant:', e);
                }

                try {
                    if (result.winner !== 'player' && typeof this.scene?.applyDefeatConsequences === 'function') {
                        await this.scene.applyDefeatConsequences();
                    }
                } catch (e) {
                    console.warn('[BattleTurnManager] applyDefeatConsequences (item isOver) non bloquant:', e);
                }

                await this.scene.returnToSceneWithTransition();
                return result;
            }

            if (this.scene.battleState.playerActive.currentHP <= 0) {
                const alivePokemon = this.scene.battleState.playerTeam.filter(p => p.currentHP > 0);

                if (alivePokemon.length === 0) {
                    await this.scene.menuManager.showDialog('Vous n\'avez plus de Pokémon ! Vous avez perdu...');

                    try {
                        if (this.scene?.battleManager?.endBattle && this.scene?.battleId) {
                            await this.scene.battleManager.endBattle(this.scene.battleId, 'opponent');
                        }
                    } catch (e) {
                        console.warn('[BattleTurnManager] Erreur endBattle (item lose) non bloquant:', e);
                    }

                    try {
                        if (typeof this.scene?.applyDefeatConsequences === 'function') {
                            await this.scene.applyDefeatConsequences();
                        }
                    } catch (e) {
                        console.warn('[BattleTurnManager] applyDefeatConsequences (item no alive) non bloquant:', e);
                    }
                    await this.scene.returnToSceneWithTransition();
                } else {
                    await this.scene.menuManager.showDialog('Choisissez un autre Pokémon !');
                    this.scene.turnInProgress = false;
                    this.scene.menuManager.showPokemonMenu();
                }
                return result;
            }

            if (this.scene?.menuManager?.showPrompt) {
                this.scene.menuManager.showPrompt(`Que va faire ${getPokemonDisplayName(this.scene.battleState.playerActive)} ?`);
            } else {
                this.scene.menuManager.showDialog(`Que va faire ${getPokemonDisplayName(this.scene.battleState.playerActive)} ?`);
            }
            this.scene.turnInProgress = false;

            return result;
        } catch (error) {
            console.error('[BattleTurnManager] Erreur item:', error);
            await this.scene.menuManager.showDialog(error?.message || 'Une erreur est survenue !');
            this.scene.menuManager.hideDialog();
            this.scene.turnInProgress = false;
            throw error;
        }
    }

    /**
     * Traite les gains d'XP à chaque K.O. adverse (et/ou fin de combat).
     */
    async processXPGains(xpGains) {
        if (!xpGains || !Array.isArray(xpGains) || xpGains.length === 0) return;

        for (const gain of xpGains) {
            const pokemon = this.scene.battleState.playerTeam.find(p =>
                p._id && (p._id === gain.pokemonId || p._id.toString() === gain.pokemonId.toString())
            );
            if (!pokemon) continue;

            const pokemonName = getPokemonDisplayName(pokemon) || gain.pokemonName;
            await this.scene.menuManager.showDialog(`${pokemonName} gagne ${gain.xpGained} points d'expérience !`);

            // IMPORTANT: Pour que l'animation soit cohérente, on doit animer depuis l'XP/Niv AVANT le gain.
            // Si on met à jour pokemon.level/pokemon.experience avant l'animation, la barre repart à 0
            // et le level-up peut ne pas être visible.
            const xpGained = Number(gain.xpGained ?? 0);
            const oldXP = (typeof gain.currentXP === 'number')
                ? Number(gain.currentXP)
                : Number(pokemon.experience ?? 0);
            const oldLevel = (typeof gain.currentLevel === 'number')
                ? Number(gain.currentLevel)
                : (Number.isFinite(Number(pokemon.level)) ? Number(pokemon.level) : this.scene.calculateLevelFromXP(oldXP));

            const newXP = oldXP + xpGained;
            const newLevel = (typeof gain.newLevel === 'number')
                ? Number(gain.newLevel)
                : this.scene.calculateLevelFromXP(newXP);

            // Animer la barre XP uniquement pour le Pokémon actif
            const isActive = pokemon._id && this.scene.battleState.playerActive &&
                (pokemon._id === this.scene.battleState.playerActive._id || pokemon._id.toString() === this.scene.battleState.playerActive._id.toString());
            if (isActive) {
                await this.scene.animManager.animateXPGain(xpGained, oldXP, oldLevel);
            }

            // Sync local state for future switches (après l'animation)
            pokemon.experience = newXP;
            pokemon.level = newLevel;

            // 🆕 Si le niveau-up a changé le MaxHP, le refléter immédiatement dans l'UI.
            // Le serveur peut aussi avoir augmenté currentHP via +ΔmaxHP; ici on se contente
            // de synchroniser maxHP (+ optionnellement currentHP) côté client pour éviter les désynchros.
            const newMaxHP = Number(gain?.newMaxHP);
            if (Number.isFinite(newMaxHP) && newMaxHP > 0) {
                const oldMaxHP = Number.isFinite(Number(gain?.oldMaxHP))
                    ? Number(gain.oldMaxHP)
                    : Number(pokemon?.stats?.maxHP ?? pokemon?.maxHP ?? 0);

                if (!pokemon.stats) pokemon.stats = {};
                pokemon.stats.maxHP = newMaxHP;
                pokemon.maxHP = newMaxHP;

                // 🔧 Match server behavior: on level-up, heal by +ΔmaxHP (capped).
                // (Only if we have a sane oldMaxHP; otherwise we leave currentHP unchanged.)
                if (Number.isFinite(oldMaxHP) && oldMaxHP > 0) {
                    const delta = newMaxHP - oldMaxHP;
                    if (delta > 0) {
                        pokemon.currentHP = Math.min(newMaxHP, Number(pokemon.currentHP || 0) + delta);
                    }
                }

                if (isActive) {
                    const active = this.scene.battleState.playerActive;
                    // Assurer cohérence active.stats.maxHP
                    if (active) {
                        if (!active.stats) active.stats = {};
                        active.stats.maxHP = newMaxHP;
                        active.maxHP = newMaxHP;

                        if (Number.isFinite(oldMaxHP) && oldMaxHP > 0) {
                            const delta = newMaxHP - oldMaxHP;
                            if (delta > 0) {
                                active.currentHP = pokemon.currentHP;
                            }
                        }
                    }

                    if (this.scene.playerHPText) {
                        this.scene.playerHPText.setText(`${pokemon.currentHP}/${newMaxHP}`);
                    }

                    if (this.scene.playerHPBarProps && this.scene.playerHPBar) {
                        this.scene.playerHPBarProps.maxHP = newMaxHP;
                        const hpPercent = (Number(pokemon.currentHP || 0) / newMaxHP) * 100;
                        const { x, y, width, height } = this.scene.playerHPBarProps;

                        let hpColor1, hpColor2;
                        if (hpPercent > 50) { hpColor1 = 0x2ECC71; hpColor2 = 0x27AE60; }
                        else if (hpPercent > 25) { hpColor1 = 0xF39C12; hpColor2 = 0xE67E22; }
                        else { hpColor1 = 0xE74C3C; hpColor2 = 0xC0392B; }

                        this.scene.playerHPBar.clear();
                        this.scene.playerHPBar.fillGradientStyle(hpColor1, hpColor1, hpColor2, hpColor2, 1, 1, 1, 1);
                        this.scene.playerHPBar.fillRoundedRect(
                            x + 2,
                            y - height/2 + 2,
                            (width - 4) * Math.max(0, Math.min(100, hpPercent)) / 100,
                            height - 4,
                            4
                        );
                    }
                }
            }
        }
    }

    /**
     * 🆕 Si le serveur auto-switch l'adversaire (combat dresseur), on met à jour l'état local
     * et on recrée sprite + UI (car animateKO détruit le sprite/ombre et cache la box).
     */
    async handleOpponentAutoSwitch(result) {
        if (!result || !result.opponentSwitched || !result.newOpponentActive) return;

        // Mettre à jour l'état local
        const newOpponent = result.newOpponentActive;
        this.scene.battleState.opponentActive = newOpponent;

        if (Array.isArray(this.scene.battleState.opponentTeam) && Number.isInteger(result.newOpponentActiveIndex)) {
            const idx = result.newOpponentActiveIndex;
            this.scene.battleState.opponentTeam[idx] = newOpponent;
        }

        // 🔧 Reset de l'animation HP adverse pour éviter un "glitch" sur la nouvelle barre
        this.scene.currentOpponentHPPercent = undefined;

        // Nettoyer les refs adverses (KO détruit parfois le sprite mais laisse les refs)
        try {
            if (this.scene.opponentSpriteData) {
                this.scene.spriteManager.destroySprite(this.scene.opponentSpriteData);
            }
        } catch (e) {
            // ignore
        }
        this.scene.opponentSpriteData = null;
        this.scene.opponentSprite = null;
        this.scene.opponentGifContainer = null;

        if (this.scene.opponentShadow) {
            try { this.scene.opponentShadow.destroy(); } catch (e) { /* ignore */ }
            this.scene.opponentShadow = null;
        }

        // Message d'envoi du Pokémon suivant
        await this.scene.menuManager.showDialog(`L'adversaire envoie ${getPokemonDisplayName(newOpponent)} !`);

        // Recréer UI + sprite
        if (this.scene.uiManager && this.scene.uiManager.updateCompleteOpponentUI) {
            await this.scene.uiManager.updateCompleteOpponentUI(newOpponent);
        } else if (this.scene.uiManager && this.scene.uiManager.createOpponentUI) {
            const { width, height } = this.scene.scale;
            await this.scene.uiManager.createOpponentUI(width, height);
        }

        const { width, height } = this.scene.scale;
        await this.scene.spriteManager.createOpponentSprite(width, height);
        if (this.scene.opponentSpriteData) {
            await this.scene.spriteManager.fadeInSprite(this.scene.opponentSpriteData, this.scene.opponentShadow, 500);
        }

        // Mettre à jour la barre HP adverse à 100% (si nécessaire)
        try {
            if (this.scene.opponentHPBar && this.scene.opponentHPBarProps) {
                await this.scene.animManager.animateHPDrain(
                    this.scene.opponentHPBar,
                    null,
                    newOpponent.currentHP,
                    newOpponent.maxHP
                );
            }
        } catch (e) {
            // ignore
        }
    }

    /**
     * Anime un tour de combat
     */
    async animateTurn(result) {
        // ========== ACTION DU JOUEUR ==========
        if (result.playerAction) {
            // 🆕 Item (soins) : pas d'attaque, juste message + éventuelle animation HP (si cible active)
            if (result.playerAction.actionType === 'item') {
                const msg = result.playerAction.message
                    || (result.playerAction.itemName ? `${result.playerAction.itemName} utilisé !` : 'Objet utilisé !');
                await this.showAttackDialog(msg);

                // Si la cible est le Pokémon actif, animer la barre HP vers la nouvelle valeur (après le tour complet)
                const targetId = String(result.playerAction.targetPokemonId || result?.itemTarget?._id || '');
                const activeId = String(this.scene?.battleState?.playerActive?._id || '');
                if (targetId && activeId && targetId === activeId) {
                    const maxHP = this.scene.battleState.playerActive.stats
                        ? this.scene.battleState.playerActive.stats.maxHP
                        : (this.scene.battleState.playerActive.maxHP || 1);
                    const hpAfterItem = (typeof result.playerHPAfterItem === 'number')
                        ? result.playerHPAfterItem
                        : (typeof result?.itemTarget?.hpAfterItem === 'number' ? result.itemTarget.hpAfterItem : result.playerHP);
                    await this.scene.animManager.animateHPDrain(
                        this.scene.playerHPBar,
                        this.scene.playerHPText,
                        hpAfterItem,
                        maxHP
                    );
                }
            } else if (result.playerAction.missed) {
                // AFFICHER MESSAGE DE RATÉ
                const opponentName = getPokemonDisplayName(this.scene.battleState.opponentActive);
                await this.showAttackDialog(`${getPokemonDisplayName(this.scene.battleState.playerActive)} rate ${opponentName} adverse !`);
            } else {
                // Attaque réussie
                await this.scene.animManager.animateAttack(this.scene.playerSprite, this.scene.opponentSprite, result.playerAction);
                if (result.playerAction.damage > 0) {
                    await this.scene.animManager.animateHPDrain(
                        this.scene.opponentHPBar,
                        null,
                        result.opponentHP,
                        this.scene.battleState.opponentActive.maxHP
                    );
                    
                    const effectiveness = result.playerAction.effectiveness || 1;
                    if (effectiveness !== 1) {
                        const effectivenessMsg = getEffectivenessMessage(effectiveness);
                        if (effectivenessMsg) {
                            await this.showAttackDialog(effectivenessMsg);
                        }
                    }
                    
                    if (result.playerAction.critical) {
                        await this.showAttackDialog('Coup critique !');
                    }
                    
                    // MESSAGE K.O. AVANT ANIMATION
                    if (result.opponentHP <= 0) {
                        const opponentName = getPokemonDisplayName(this.scene.battleState.opponentActive);
                        await this.showAttackDialog(`Le ${opponentName} adverse est K.O. !`);
                        await this.scene.animManager.animateKO(this.scene.opponentSprite, 'opponentContainer', true);
                    }
                }
            }
        }

        // ========== ACTION DE L'ADVERSAIRE ==========
        // 🔧 FIXE: Vérifier que l'adversaire n'est pas K.O. avant d'attaquer
        if (result.opponentAction && result.opponentHP > 0) {
            if (result.opponentAction.missed) {
                // AFFICHER MESSAGE DE RATÉ
                const playerName = getPokemonDisplayName(this.scene.battleState.playerActive);
                await this.showAttackDialog(`${getPokemonDisplayName(this.scene.battleState.opponentActive)} rate ${playerName} !`);
            } else {
                // Attaque réussie
                const opponentMove = this.scene.battleState.opponentActive.moveset[0];
                const moveNameFR = await this.scene.getMoveName(opponentMove?.name || 'Charge');
                await this.showAttackDialog(`${getPokemonDisplayName(this.scene.battleState.opponentActive)} utilise ${moveNameFR} !`);
                
                await this.scene.animManager.animateAttack(this.scene.opponentSprite, this.scene.playerSprite, result.opponentAction);
                
                if (result.opponentAction.damage > 0) {
                    await this.scene.animManager.animateHPDrain(
                        this.scene.playerHPBar,
                        this.scene.playerHPText,
                        result.playerHP,
                        this.scene.battleState.playerActive.maxHP
                    );
                    
                    // MESSAGE K.O. AVANT ANIMATION
                    if (result.playerHP <= 0) {
                        const playerName = getPokemonDisplayName(this.scene.battleState.playerActive);
                        await this.showAttackDialog(`${playerName} est K.O. !`);
                        await this.scene.animManager.animateKO(this.scene.playerSprite, 'playerContainer', false);
                    }
                }
            }
        }
    }

    /**
     * Met à jour le battle state
     */
    async updateBattleState(result) {
        this.scene.battleState.playerActive.currentHP = result.playerHP;
        this.scene.battleState.opponentActive.currentHP = result.opponentHP;
        
        const teamIndex = this.scene.battleState.playerTeam.findIndex(
            p => p._id === this.scene.battleState.playerActive._id
        );
        if (teamIndex !== -1) {
            this.scene.battleState.playerTeam[teamIndex].currentHP = result.playerHP;
        }

        // 🆕 Si l'item a ciblé un Pokémon (pas forcément actif), mettre à jour ses PV dans l'équipe.
        if (result?.itemTarget?._id && Array.isArray(this.scene.battleState.playerTeam)) {
            const targetId = String(result.itemTarget._id);
            const idx = this.scene.battleState.playerTeam.findIndex(p => String(p?._id) === targetId);
            if (idx !== -1) {
                this.scene.battleState.playerTeam[idx].currentHP = Number(result.itemTarget.currentHP ?? this.scene.battleState.playerTeam[idx].currentHP);
                const maxHP = Number(result.itemTarget.maxHP ?? 0);
                if (maxHP > 0) {
                    if (this.scene.battleState.playerTeam[idx].stats) {
                        this.scene.battleState.playerTeam[idx].stats.maxHP = maxHP;
                    }
                    if (!this.scene.battleState.playerTeam[idx].maxHP) {
                        this.scene.battleState.playerTeam[idx].maxHP = maxHP;
                    }
                }

                // Si c'est aussi le Pokémon actif, garder la cohérence
                if (String(this.scene.battleState.playerActive?._id) === targetId) {
                    this.scene.battleState.playerActive.currentHP = this.scene.battleState.playerTeam[idx].currentHP;
                    if (this.scene.battleState.playerActive.stats && maxHP > 0) {
                        this.scene.battleState.playerActive.stats.maxHP = maxHP;
                    }
                    if (!this.scene.battleState.playerActive.maxHP && maxHP > 0) {
                        this.scene.battleState.playerActive.maxHP = maxHP;
                    }
                }
            }
        }
    }

    /**
     * Tour de l'adversaire
     */
    async opponentTurn() {
        if (this.scene.battleState.opponentActive.currentHP <= 0) {
            console.log('[BattleTurnManager] Adversaire K.O., pas d\'attaque');
            return;
        }
        
        const opponentMove = this.scene.battleState.opponentActive.moveset[
            Math.floor(Math.random() * this.scene.battleState.opponentActive.moveset.length)
        ];

        const moveNameFR = await this.scene.getMoveName(opponentMove.name);
        await this.showAttackDialog(`${getPokemonDisplayName(this.scene.battleState.opponentActive)} utilise ${moveNameFR} !`);

        const attacker = this.scene.battleState.opponentActive;
        const defender = this.scene.battleState.playerActive;
        
        let damage = 0;
        let effectiveness = 1.0;
        
        if (opponentMove.power && opponentMove.power > 0) {
            const attack = opponentMove.category === 'special' ? attacker.stats?.sp_attack || 50 : attacker.stats?.attack || 50;
            const defense = opponentMove.category === 'special' ? defender.stats?.sp_defense || 50 : defender.stats?.defense || 50;
            const level = attacker.level || 5;
            
            damage = Math.floor(((2 * level / 5 + 2) * opponentMove.power * attack / defense) / 50) + 2;
            
            const attackerTypes = attacker.types || [];
            const defenderTypes = defender.types || [];
            const stab = attackerTypes.includes(opponentMove.type) ? 1.5 : 1.0;
            effectiveness = getTypeEffectiveness(opponentMove.type, defenderTypes);
            damage = Math.floor(damage * stab * effectiveness);
            damage = Math.max(1, Math.floor(damage * (Math.random() * 0.15 + 0.85)));
        }

        await this.scene.animManager.animateAttack(this.scene.opponentSprite, this.scene.playerSprite, { 
            move: opponentMove.name, 
            damage: damage,
            effectiveness: effectiveness,
            isPlayer: false // 🆕 Important pour GIF support
        });

        this.scene.battleState.playerActive.currentHP = Math.max(0, this.scene.battleState.playerActive.currentHP - damage);
        
        const teamIndex = this.scene.battleState.playerTeam.findIndex(p => p._id === this.scene.battleState.playerActive._id);
        if (teamIndex !== -1) {
            this.scene.battleState.playerTeam[teamIndex].currentHP = this.scene.battleState.playerActive.currentHP;
        }
        
        await this.scene.animManager.animateHPDrain(
            this.scene.playerHPBar, 
            this.scene.playerHPText, 
            this.scene.battleState.playerActive.currentHP, 
            this.scene.battleState.playerActive.maxHP
        );
        
        if (damage > 0) {
            const effectivenessMsg = getEffectivenessMessage(effectiveness);
            if (effectivenessMsg) {
                await this.showAttackDialog(effectivenessMsg);
            }
        }

        if (this.scene.battleState.playerActive.currentHP <= 0) {
            await this.scene.animManager.animateKO(this.scene.playerSprite, 'playerContainer', false);
            await this.showAttackDialog(`${getPokemonDisplayName(this.scene.battleState.playerActive)} est K.O. !`);
            
            const alivePokemon = this.scene.battleState.playerTeam.filter(p => p.currentHP > 0);
            
            if (alivePokemon.length === 0) {
                await this.scene.menuManager.showDialog('Vous n\'avez plus de Pokémon ! Vous avez perdu...');

                // Terminer officiellement le combat côté serveur
                try {
                    if (this.scene?.battleManager?.endBattle && this.scene?.battleId) {
                        await this.scene.battleManager.endBattle(this.scene.battleId, 'opponent');
                    }
                } catch (e) {
                    console.warn('[BattleTurnManager] Erreur endBattle (opponentTurn lose) non bloquant:', e);
                }

                // 🆕 Défaite (plus de Pokémon en vie): TP qwest 3:3 + heal équipe + message
                try {
                    if (typeof this.scene?.applyDefeatConsequences === 'function') {
                        await this.scene.applyDefeatConsequences();
                    }
                } catch (e) {
                    console.warn('[BattleTurnManager] applyDefeatConsequences (opponentTurn lose) non bloquant:', e);
                }
                await this.scene.returnToSceneWithTransition();
            } else {
                this.scene.turnInProgress = false;
                await this.scene.menuManager.showDialog('Choisissez un autre Pokémon !');
                this.scene.menuManager.showPokemonMenu();
            }
            return;
        }
    }

    /**
     * Switch Pokémon
     */
    async switchPokemon(newIndex) {
        this.scene.turnInProgress = true;
        
        const newPokemon = this.scene.battleState.playerTeam[newIndex];
        const oldPokemon = this.scene.battleState.playerActive;
        
        // 🆕 Détecter si c'est un remplacement après K.O. (pas de tour adverse)
        const isForcedSwitch = oldPokemon.currentHP <= 0;
        
        if (!newPokemon) {
            console.error('[BattleTurnManager] Nouveau Pokémon introuvable');
            this.scene.turnInProgress = false;
            return;
        }
        
        const oldName = oldPokemon?.nickname || oldPokemon?.name || 'Pokémon';
        const newName = newPokemon?.nickname || newPokemon?.name || 'Pokémon';
        
        // Message de rappel seulement si pas K.O.
        if (!isForcedSwitch) {
            await this.scene.menuManager.showDialog(`Reviens, ${oldName} !`);
        } else {
            await this.scene.menuManager.showDialog(`À toi, ${newName} !`);
        }
        
        // 🔧 FIXE: Animation de sortie compatible GIF et PNG
        if (this.scene.playerSpriteData) {
            if (this.scene.playerSpriteData.type === 'phaser' && this.scene.playerSprite) {
                await new Promise(resolve => {
                    this.scene.tweens.add({
                        targets: this.scene.playerSprite,
                        alpha: 0,
                        scaleX: 3.0,
                        scaleY: 3.0,
                        duration: 500,
                        onComplete: resolve
                    });
                });
            } else if (this.scene.playerSpriteData.type === 'gif' && this.scene.playerGifContainer) {
                // Animation CSS pour le GIF
                this.scene.playerGifContainer.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                this.scene.playerGifContainer.style.opacity = '0';
                this.scene.playerGifContainer.style.transform = 'translate(-50%, -50%) scale(3)'; // Garder le centrage
                await this.scene.wait(500);
            }
            
            // Nettoyage propre via le manager
            this.scene.spriteManager.destroySprite(this.scene.playerSpriteData);
            this.scene.playerSprite = null;
            this.scene.playerGifContainer = null;
            this.scene.playerSpriteData = null;
        } else if (this.scene.playerSprite) {
            // Fallback ancien système
            this.scene.playerSprite.destroy();
            this.scene.playerSprite = null;
        }

        if (this.scene.playerShadow) {
            this.scene.playerShadow.destroy();
            this.scene.playerShadow = null;
        }
        
        // Notifier serveur
        try {
            const apiUrl = process.env.REACT_APP_API_URL;
            if (!apiUrl) {
                console.error("REACT_APP_API_URL manquant");
                throw new Error("Configuration manquante");
            }

            const response = await fetch(`${apiUrl}/api/battle/switch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    battleId: this.scene.battleId,
                    newIndex: newIndex
                })
            });

            if (!response.ok) {
                const error = await response.json();
                console.error('[BattleTurnManager] Erreur switch serveur:', error);
                await this.scene.menuManager.showDialog('Erreur lors du changement de Pokémon');
                this.scene.turnInProgress = false;
                return;
            }

            const switchResult = await response.json();
            console.log('[BattleTurnManager] Switch confirmé:', switchResult);

        } catch (error) {
            console.error('[BattleTurnManager] Erreur appel /switch:', error);
            await this.scene.menuManager.showDialog('Erreur de connexion');
            this.scene.turnInProgress = false;
            return;
        }
        
        this.scene.battleState.playerActive = newPokemon;
        
        const oldIndex = this.scene.battleState.playerTeam.findIndex(p => p._id === oldPokemon._id);
        if (oldIndex !== -1) {
            this.scene.battleState.playerTeam[oldIndex].currentHP = oldPokemon.currentHP;
        }
        
        await this.scene.menuManager.showDialog(`Go, ${newName} !`);
        
        await this.recreatePlayerSpriteAndUI(newPokemon);
        
        // 🆕 Si switch forcé (K.O.), l'adversaire n'attaque pas (nouveau tour)
        if (!isForcedSwitch) {
            await this.opponentTurn();
        }
        
        this.scene.turnInProgress = false;
        this.scene.menuManager.hideDialog();
        this.scene.menuManager.showMainMenu();
    }

    /**
     * Recrée sprite et UI après switch
     */
    async recreatePlayerSpriteAndUI(pokemon) {
        // 🔧 FIXE: Utiliser createOrUpdatePlayerSprite pour supporter les GIFs
        await this.scene.spriteManager.createOrUpdatePlayerSprite(pokemon, true);
        await this.updateCompletePlayerUI(pokemon);
    }

    /**
     * Met à jour l'UI complète du joueur
     */
    async updateCompletePlayerUI(pokemon) {
        console.log('[BattleTurnManager] Update UI pour:', pokemon.name);
        if (this.scene.uiManager) {
            await this.scene.uiManager.updateCompletePlayerUI(pokemon);
        }
    }

    /**
     * Utilise un item en combat
     */
    async useItemInBattle(item) {
        console.log('[BattleTurnManager] Usage item:', item.itemData.name_fr);
        
        if (item.itemData.type === 'pokeball') {
            this.scene.hideBattleUI();
            
            this.scene.scene.launch('CaptureScene', {
                battleScene: this.scene,
                ballType: item.item_id,
                wildPokemon: this.scene.opponentPokemon,
                callback: async (result) => {
                    this.scene.scene.stop('CaptureScene');
                    
                    if (result.captured) {
                        await this.scene.menuManager.showDialog(`${getPokemonDisplayName(result.pokemon)} a été capturé !`);
                        await this.scene.returnToSceneWithTransition();
                    } else {
                        this.scene.showBattleUI();
                        await this.scene.menuManager.showDialog(`${getPokemonDisplayName(this.scene.opponentPokemon)} s'est échappé !`);
                        await this.opponentTurn();
                        this.scene.turnInProgress = false;
                        this.scene.menuManager.hideDialog();
                    }
                }
            });
            this.scene.scene.pause();
        }
    }

    /**
     * Fuit le combat
     */
    async flee() {
        if (this.scene.turnInProgress) return;

        this.scene.turnInProgress = true;
        await this.scene.menuManager.showDialog('Vous fuyez le combat...');
        await this.scene.returnToSceneWithTransition();
    }
}
