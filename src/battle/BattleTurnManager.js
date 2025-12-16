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
     * Sélectionne et exécute un move
     */
    async selectMove(moveName) {
        if (this.scene.turnInProgress) return;

        this.scene.turnInProgress = true;
        console.log('[BattleTurnManager] Move sélectionné:', moveName);

        this.scene.menuManager.hideMoveSelector();

        try {
            const moveNameFR = await this.scene.getMoveName(moveName);
            this.scene.menuManager.showDialog(`${getPokemonDisplayName(this.scene.battleState.playerActive)} utilise ${moveNameFR} !`);
            await this.scene.wait(800);

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

            // 🆕 Combat dresseur: si le serveur a envoyé le Pokémon suivant, recréer l'UI et le sprite adverses
            await this.handleOpponentAutoSwitch(result);

            if (result.isOver) {
                console.log('[BattleTurnManager] Combat terminé - winner:', result.winner);

                // Message de fin (sinon la transition ressemble à un "reload")
                if (result.winner === 'player') {
                    this.scene.menuManager.showDialog('Vous avez gagné !');
                } else {
                    this.scene.menuManager.showDialog('Vous avez perdu...');
                }
                await this.scene.wait(1200);
                
                if (result.winner === 'player' && result.xpGains && result.xpGains.length > 0) {
                    console.log('[BattleTurnManager] ✅ XP à distribuer:', result.xpGains.length, 'gains');
                    console.log('[BattleTurnManager] Détail gains:', JSON.stringify(result.xpGains));
                    
                    // 🆕 DEBUG: Afficher explicitement pourquoi l'évolution échoue
                    result.xpGains.forEach(gain => {
                        if (gain.evolutionCheckDebug) {
                            console.log(`[Battle] 🔍 Debug Evolution pour ${gain.pokemonName}:`, gain.evolutionCheckDebug);
                            if (!gain.evolutionCheckDebug.canEvolve) {
                                console.warn(`[Battle] ⚠️ Échec évolution: ${gain.evolutionCheckDebug.error}`);
                            }
                        }
                    });

                    // 🧬 Stocker les évolutions à déclencher
                    const pendingEvolutions = [];

                    for (const gain of result.xpGains) {
                        // 🔧 FIXE: Chercher par ID (string ou ObjectId)
                        const pokemon = this.scene.battleState.playerTeam.find(p => 
                            p._id && (p._id === gain.pokemonId || p._id.toString() === gain.pokemonId.toString())
                        );
                        
                        if (pokemon) {
                            // Sync server-side move_learned (offered moves) if provided
                            if (gain.move_learned && Array.isArray(gain.move_learned)) {
                                pokemon.move_learned = gain.move_learned;
                            }
                            // 🔧 FIXE: Utiliser le bon nom (nickname > name > species name)
                            const pokemonName = getPokemonDisplayName(pokemon) || gain.pokemonName;
                            
                            this.scene.menuManager.showDialog(`${pokemonName} gagne ${gain.xpGained} points d'expérience !`);
                            await this.scene.wait(1500);
                            
                            // Animer XP seulement pour le Pokémon actif
                            if (pokemon._id === this.scene.battleState.playerActive._id || 
                                pokemon._id.toString() === this.scene.battleState.playerActive._id.toString()) {
                                // 🆕 Passer l'ancien XP et l'ancien niveau pour animation correcte
                                const oldXP = gain.currentXP || 0;
                                
                                const leveledUp = await this.scene.animManager.animateXPGain(
                                    gain.xpGained, 
                                    oldXP
                                );
                                
                                // Gérer apprentissage de nouveaux moves
                                if (leveledUp && gain.newMovesAvailable && gain.newMovesAvailable.length > 0) {
                                    console.log('[Battle] Nouveaux moves disponibles:', gain.newMovesAvailable);
                                    
                                    // Process moves sequentially by shifting them out of the array
                                    while (gain.newMovesAvailable && gain.newMovesAvailable.length > 0) {
                                        const newMove = gain.newMovesAvailable.shift();
                                        // Vérifier si le move est déjà connu
                                        const knownMoveset = pokemon.moveset && pokemon.moveset.some(m => m.name === newMove.name);
                                        const normalizedLearned = (pokemon.move_learned || []).map(m => (typeof m === 'string' ? m : (m.name || m)));
                                        const alreadyKnown = knownMoveset || (normalizedLearned && normalizedLearned.includes(newMove.name));
                                        if (alreadyKnown) continue;

                                        const newMoveFR = await this.scene.getMoveName(newMove.name);
                                        this.scene.menuManager.showDialog(`${pokemonName} veut apprendre ${newMoveFR}...`);
                                        await this.scene.wait(1000);

                                        await new Promise(resolve => {
                                            // Masquer les GIFs et l'UI pendant le choix du move
                                            SpriteLoader.hideAllGifs(this.scene);
                                            // Lancer la scène en parallèle (launch) et non remplacement (start)
                                            if (!this.scene.scene.isActive('MoveLearnScene')) {
                                                this.scene.scene.launch('MoveLearnScene', {
                                                    pokemon: pokemon,
                                                    newMove: newMove,
                                                    onComplete: (learned, moveName, updatedMoveset, updatedMoveLearned) => {
                                                        console.log('[BattleTurnManager] MoveLearnScene onComplete:', { learned, moveName, updatedMovesetCount: updatedMoveset ? updatedMoveset.length : null });
                                                        // Callback appelé quand la scène se ferme
                                                        this.scene.scene.stop('MoveLearnScene');
                                                        this.scene.scene.resume(this.scene.key); // Reprendre la scène de combat

                                                        // Réafficher les GIFs
                                                        SpriteLoader.showAllGifs(this.scene);

                                                        if (learned) {
                                                            // FR name is passed as moveName
                                                            this.scene.menuManager.showDialog(`${pokemonName} a appris ${moveName} !`);

                                                            // Si le backend retourne le moveset mis à jour, l'utiliser
                                                            if (updatedMoveset && Array.isArray(updatedMoveset)) {
                                                                pokemon.moveset = updatedMoveset;
                                                                // Mettre à jour l'UI si c'est le Pokémon actif
                                                                if (this.scene.battleState.playerActive && (this.scene.battleState.playerActive._id === pokemon._id || this.scene.battleState.playerActive._id.toString() === pokemon._id.toString())) {
                                                                    this.scene.updatePlayerUI(pokemon);
                                                                }
                                                            } else {
                                                                // Fallback: si moins de 4 moves, push
                                                                if (!pokemon.moveset) pokemon.moveset = [];
                                                                if (pokemon.moveset.length < 4) {
                                                                    pokemon.moveset.push(newMove);
                                                                    if (this.scene.battleState.playerActive && (this.scene.battleState.playerActive._id === pokemon._id || this.scene.battleState.playerActive._id.toString() === pokemon._id.toString())) {
                                                                        this.scene.updatePlayerUI(pokemon);
                                                                    }
                                                                }
                                                            }

                                                            // Mettre à jour le historique move_learned si renvoyé
                                                            if (updatedMoveLearned && Array.isArray(updatedMoveLearned)) {
                                                                pokemon.move_learned = updatedMoveLearned;
                                                            }
                                                        } else {
                                                            // Update move_learned if provided (user ignored)
                                                            if (updatedMoveLearned && Array.isArray(updatedMoveLearned)) {
                                                                pokemon.move_learned = updatedMoveLearned;
                                                            }
                                                            this.scene.menuManager.showDialog(`${pokemonName} n'a pas appris ${moveName}.`);
                                                        }

                                                        // Petit délai pour lire le message
                                                        setTimeout(resolve, 1500);
                                                    }
                                                });
                                            } else {
                                                console.warn('[BattleTurnManager] MoveLearnScene déjà active, skipping launch');
                                                // Réafficher les gifs si nous avions caché
                                                SpriteLoader.showAllGifs(this.scene);
                                                setTimeout(resolve, 10);
                                                return;
                                            }
                                            
                                            // Mettre en pause la scène de combat
                                            this.scene.scene.pause(this.scene.key);
                                        });
                                    }
                                }
                            } else {
                                // 🆕 Pour les Pokémon non-actifs, afficher juste un message si level-up
                                if (gain.leveledUp) {
                                    this.scene.menuManager.showDialog(`${pokemonName} passe niveau ${gain.newLevel} !`);
                                    await this.scene.wait(1500);
                                }
                            }

                            // 🧬 Vérifier si une évolution est disponible
                            if (gain.evolution) {
                                console.log(`[Battle] Données évolution reçues pour ${pokemonName}:`, gain.evolution);
                                if (gain.evolution.canEvolve) {
                                    console.log(`[Battle] 🧬 Évolution VALIDÉE pour ${pokemonName}`);
                                    pendingEvolutions.push({
                                        pokemon: pokemon,
                                        evolution: gain.evolution
                                    });
                                } else {
                                    console.log(`[Battle] Évolution refusée (canEvolve=false)`);
                                }
                            }
                        } else {
                            console.warn(`[Battle] Pokémon ${gain.pokemonId} non trouvé dans l'équipe locale`);
                        }
                    }

                    // 🧬 Déclencher les évolutions s'il y en a
                    if (pendingEvolutions.length > 0) {
                        for (const evo of pendingEvolutions) {
                            this.scene.menuManager.showDialog(`Quoi ? ${getPokemonDisplayName(evo.pokemon)} évolue !`);
                            await this.scene.wait(1000);
                            
                            // Lancer la scène d'évolution en overlay (pause la scène actuelle)
                            // Masquer les GIFs pour qu'ils ne se superposent pas à l'animation
                            SpriteLoader.hideAllGifs(this.scene);

                            await new Promise(resolve => {
                                this.scene.scene.pause(this.scene.key);
                                this.scene.scene.launch('PokemonEvolutionScene', {
                                    pokemon: evo.pokemon,
                                    evolution: evo.evolution,
                                    onComplete: (updatedPokemon) => {
                                        this.scene.scene.stop('PokemonEvolutionScene');
                                        this.scene.scene.resume(this.scene.key);
                                        
                                        // 🆕 Mettre à jour l'UI si c'est le Pokémon actif qui a évolué
                                            if (updatedPokemon && (updatedPokemon._id === this.scene.battleState.playerActive._id || updatedPokemon._id.toString() === this.scene.battleState.playerActive._id.toString())) {
                                            console.log('[Battle] Mise à jour UI après évolution pour', getPokemonDisplayName(updatedPokemon));
                                            this.scene.updatePlayerUI(updatedPokemon);
                                            
                                            // Réafficher les GIFs (car updatePlayerUI recrée le sprite mais peut-être pas les autres)
                                            const SpriteLoader = require('../utils/spriteLoader').default;
                                            SpriteLoader.showAllGifs(this.scene);
                                        }
                                        
                                        resolve();
                                    }
                                });
                            });
                            
                            this.scene.menuManager.showDialog(`${getPokemonDisplayName(evo.pokemon)} a bien évolué !`);
                            await this.scene.wait(1000);
                        }
                    }
                } else {
                    console.log('[BattleTurnManager] Pas de gains XP ou perdant');
                }

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
                
                await this.scene.returnToSceneWithTransition();
            } else {
                if (this.scene.battleState.playerActive.currentHP <= 0) {
                    const alivePokemon = this.scene.battleState.playerTeam.filter(p => p.currentHP > 0);
                    
                    if (alivePokemon.length === 0) {
                        this.scene.menuManager.showDialog('Vous n\'avez plus de Pokémon ! Vous avez perdu...');
                        await this.scene.wait(2000);

                        // Terminer officiellement le combat côté serveur
                        try {
                            if (this.scene?.battleManager?.endBattle && this.scene?.battleId) {
                                await this.scene.battleManager.endBattle(this.scene.battleId, 'opponent');
                            }
                        } catch (e) {
                            console.warn('[BattleTurnManager] Erreur endBattle (lose) non bloquant:', e);
                        }
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
                    this.scene.menuManager.showDialog(`Que va faire ${getPokemonDisplayName(this.scene.battleState.playerActive)} ?`);
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

        // Message d'envoi du Pokémon suivant (simple)
        this.scene.menuManager.showDialog(`${getPokemonDisplayName(newOpponent)} entre en combat !`);
        await this.scene.wait(900);

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
            if (result.playerAction.missed) {
                // AFFICHER MESSAGE DE RATÉ
                const opponentName = getPokemonDisplayName(this.scene.battleState.opponentActive);
                this.scene.menuManager.showDialog(`${getPokemonDisplayName(this.scene.battleState.playerActive)} rate ${opponentName} adverse !`);
                await this.scene.wait(1500);
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
                            this.scene.menuManager.showDialog(effectivenessMsg);
                            await this.scene.wait(1000);
                        }
                    }
                    
                    if (result.playerAction.critical) {
                        this.scene.menuManager.showDialog('Coup critique !');
                        await this.scene.wait(1000);
                    }
                    
                    // MESSAGE K.O. AVANT ANIMATION
                    if (result.opponentHP <= 0) {
                        const opponentName = getPokemonDisplayName(this.scene.battleState.opponentActive);
                        this.scene.menuManager.showDialog(`Le ${opponentName} adverse est K.O. !`);
                        await this.scene.wait(1200);
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
                this.scene.menuManager.showDialog(`${getPokemonDisplayName(this.scene.battleState.opponentActive)} rate ${playerName} !`);
                await this.scene.wait(1500);
            } else {
                // Attaque réussie
                const opponentMove = this.scene.battleState.opponentActive.moveset[0];
                const moveNameFR = await this.scene.getMoveName(opponentMove?.name || 'Charge');
                this.scene.menuManager.showDialog(`${getPokemonDisplayName(this.scene.battleState.opponentActive)} utilise ${moveNameFR} !`);
                await this.scene.wait(800);
                
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
                        this.scene.menuManager.showDialog(`${playerName} est K.O. !`);
                        await this.scene.wait(1200);
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
        this.scene.menuManager.showDialog(`${getPokemonDisplayName(this.scene.battleState.opponentActive)} utilise ${moveNameFR} !`);
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
                this.scene.menuManager.showDialog(effectivenessMsg);
                await this.scene.wait(1000);
            }
        }

        if (this.scene.battleState.playerActive.currentHP <= 0) {
            await this.scene.animManager.animateKO(this.scene.playerSprite, 'playerContainer', false);
            this.scene.menuManager.showDialog(`${getPokemonDisplayName(this.scene.battleState.playerActive)} est K.O. !`);
            await this.scene.wait(1500);
            
            const alivePokemon = this.scene.battleState.playerTeam.filter(p => p.currentHP > 0);
            
            if (alivePokemon.length === 0) {
                this.scene.menuManager.showDialog('Vous n\'avez plus de Pokémon ! Vous avez perdu...');
                await this.scene.wait(2000);

                // Terminer officiellement le combat côté serveur
                try {
                    if (this.scene?.battleManager?.endBattle && this.scene?.battleId) {
                        await this.scene.battleManager.endBattle(this.scene.battleId, 'opponent');
                    }
                } catch (e) {
                    console.warn('[BattleTurnManager] Erreur endBattle (opponentTurn lose) non bloquant:', e);
                }
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
            this.scene.menuManager.showDialog(`Reviens, ${oldName} !`);
            await this.scene.wait(1000);
        } else {
            this.scene.menuManager.showDialog(`À toi, ${newName} !`);
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
                        this.scene.menuManager.showDialog(`${getPokemonDisplayName(result.pokemon)} a été capturé !`);
                        await this.scene.wait(2000);
                        await this.scene.returnToSceneWithTransition();
                    } else {
                        this.scene.showBattleUI();
                        this.scene.menuManager.showDialog(`${getPokemonDisplayName(this.scene.opponentPokemon)} s'est échappé !`);
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
