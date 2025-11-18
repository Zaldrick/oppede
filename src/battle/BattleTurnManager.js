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

export default class BattleTurnManager {
    constructor(scene) {
        this.scene = scene;
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
            this.scene.menuManager.showDialog(`${this.scene.battleState.playerActive.name} utilise ${moveNameFR} !`);
            await this.scene.wait(800);

            const result = await this.scene.battleManager.takeTurn(
                this.scene.battleId,
                moveName
            );

            console.log('[BattleTurnManager] Résultat tour:', result);

            await this.animateTurn(result);
            await this.updateBattleState(result);

            if (result.isOver) {
                if (result.winner === 'player' && result.xpGains && result.xpGains.length > 0) {
                    for (const gain of result.xpGains) {
                        const pokemon = this.scene.battleState.playerTeam.find(p => p._id === gain.pokemonId);
                        if (pokemon) {
                            this.scene.menuManager.showDialog(`${pokemon.name} gagne ${gain.xpGained} points d'expérience !`);
                            await this.scene.wait(1500);
                            
                            if (pokemon._id === this.scene.battleState.playerActive._id) {
                                await this.scene.animManager.animateXPGain(gain.xpGained);
                            }
                        }
                    }
                }
                
                await this.scene.returnToSceneWithTransition();
            } else {
                if (this.scene.battleState.playerActive.currentHP <= 0) {
                    const alivePokemon = this.scene.battleState.playerTeam.filter(p => p.currentHP > 0);
                    
                    if (alivePokemon.length === 0) {
                        this.scene.menuManager.showDialog('Vous n\'avez plus de Pokémon ! Vous avez perdu...');
                        await this.scene.wait(2000);
                        await this.scene.returnToSceneWithTransition();
                    } else {
                        this.scene.turnInProgress = false;
                        this.scene.menuManager.showDialog('Choisissez un autre Pokémon !');
                        await this.scene.wait(1000);
                        this.scene.menuManager.showPokemonMenu();
                    }
                    return;
                }
                
                this.scene.menuManager.hideDialog();
                setTimeout(() => {
                    this.scene.menuManager.showDialog(`Que va faire ${this.scene.battleState.playerActive.name} ?`);
                }, 500);
                this.scene.turnInProgress = false;
            }

        } catch (error) {
            console.error('[BattleTurnManager] Erreur tour:', error);
            this.scene.menuManager.showDialog('Une erreur est survenue !');
            setTimeout(() => {
                this.scene.menuManager.hideDialog();
                this.scene.turnInProgress = false;
            }, 2000);
        }
    }

    /**
     * Anime un tour de combat
     */
    async animateTurn(result) {
        if (result.playerAction && !result.playerAction.missed) {
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
                        this.scene.menuManager.showDialog(effectivenessMsg);
                        await this.scene.wait(1000);
                    }
                }
                
                if (result.playerAction.critical) {
                    this.scene.menuManager.showDialog('Coup critique !');
                    await this.scene.wait(1000);
                }
                
                if (result.opponentHP <= 0) {
                    await this.scene.animManager.animateKO(this.scene.opponentSprite, 'opponentContainer', true);
                }
            }
        }

        if (result.opponentAction && !result.opponentAction.missed) {
            const opponentMove = this.scene.battleState.opponentActive.moveset[0];
            const moveNameFR = await this.scene.getMoveName(opponentMove?.name || 'Charge');
            this.scene.menuManager.showDialog(`${this.scene.battleState.opponentActive.name} utilise ${moveNameFR} !`);
            await this.scene.wait(800);
            
            await this.scene.animManager.animateAttack(this.scene.opponentSprite, this.scene.playerSprite, result.opponentAction);
            
            if (result.opponentAction.damage > 0) {
                await this.scene.animManager.animateHPDrain(
                    this.scene.playerHPBar,
                    this.scene.playerHPText,
                    result.playerHP,
                    this.scene.battleState.playerActive.maxHP
                );
                
                if (result.playerHP <= 0) {
                    await this.scene.animManager.animateKO(this.scene.playerSprite, 'playerContainer', false);
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
        this.scene.menuManager.showDialog(`${this.scene.battleState.opponentActive.name} utilise ${moveNameFR} !`);
        await this.scene.wait(800);

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
            effectiveness: effectiveness
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
                this.scene.menuManager.showDialog(effectivenessMsg);
                await this.scene.wait(1000);
            }
        }

        if (this.scene.battleState.playerActive.currentHP <= 0) {
            await this.scene.animManager.animateKO(this.scene.playerSprite, 'playerContainer', false);
            this.scene.menuManager.showDialog(`${this.scene.battleState.playerActive.name} est K.O. !`);
            await this.scene.wait(1500);
            
            const alivePokemon = this.scene.battleState.playerTeam.filter(p => p.currentHP > 0);
            
            if (alivePokemon.length === 0) {
                this.scene.menuManager.showDialog('Vous n\'avez plus de Pokémon ! Vous avez perdu...');
                await this.scene.wait(2000);
                await this.scene.returnToSceneWithTransition();
            } else {
                this.scene.turnInProgress = false;
                this.scene.menuManager.showDialog('Choisissez un autre Pokémon !');
                await this.scene.wait(1000);
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
        
        if (!newPokemon) {
            console.error('[BattleTurnManager] Nouveau Pokémon introuvable');
            this.scene.turnInProgress = false;
            return;
        }
        
        const oldName = oldPokemon?.nickname || oldPokemon?.name || 'Pokémon';
        const newName = newPokemon?.nickname || newPokemon?.name || 'Pokémon';
        
        this.scene.menuManager.showDialog(`Reviens, ${oldName} !`);
        await this.scene.wait(1000);
        
        if (this.scene.playerSprite) {
            await new Promise(resolve => {
                this.scene.tweens.add({
                    targets: this.scene.playerSprite,
                    alpha: 0,
                    scaleX: 3.0,
                    scaleY: 3.0,
                    duration: 500,
                    onComplete: () => {
                        if (this.scene.playerSprite) this.scene.playerSprite.destroy();
                        if (this.scene.playerShadow) this.scene.playerShadow.destroy();
                        resolve();
                    }
                });
            });
        }
        
        // Notifier serveur
        try {
            const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
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
                this.scene.menuManager.showDialog('Erreur lors du changement de Pokémon');
                this.scene.turnInProgress = false;
                return;
            }

            const switchResult = await response.json();
            console.log('[BattleTurnManager] Switch confirmé:', switchResult);

        } catch (error) {
            console.error('[BattleTurnManager] Erreur appel /switch:', error);
            this.scene.menuManager.showDialog('Erreur de connexion');
            this.scene.turnInProgress = false;
            return;
        }
        
        this.scene.battleState.playerActive = newPokemon;
        
        const oldIndex = this.scene.battleState.playerTeam.findIndex(p => p._id === oldPokemon._id);
        if (oldIndex !== -1) {
            this.scene.battleState.playerTeam[oldIndex].currentHP = oldPokemon.currentHP;
        }
        
        this.scene.menuManager.showDialog(`Go, ${newName} !`);
        await this.scene.wait(800);
        
        await this.recreatePlayerSpriteAndUI(newPokemon);
        await this.opponentTurn();
        
        this.scene.turnInProgress = false;
        this.scene.menuManager.hideDialog();
    }

    /**
     * Recrée sprite et UI après switch
     */
    async recreatePlayerSpriteAndUI(pokemon) {
        await this.scene.spriteManager.recreatePlayerSprite(pokemon);
        await this.updateCompletePlayerUI(pokemon);
    }

    /**
     * Met à jour l'UI complète du joueur
     */
    async updateCompletePlayerUI(pokemon) {
        // Simplifié - deléguer à uiManager si besoin
        console.log('[BattleTurnManager] Update UI pour:', pokemon.name);
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
                        this.scene.menuManager.showDialog(`${result.pokemon.name} a été capturé !`);
                        await this.scene.wait(2000);
                        await this.scene.returnToSceneWithTransition();
                    } else {
                        this.scene.showBattleUI();
                        this.scene.menuManager.showDialog(`${this.scene.opponentPokemon.name} s'est échappé !`);
                        await this.scene.wait(1500);
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
        this.scene.menuManager.showDialog('Vous fuyez le combat...');
        await this.scene.wait(1500);
        await this.scene.returnToSceneWithTransition();
    }
}
