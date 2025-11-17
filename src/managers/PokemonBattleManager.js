/**
 * PokemonBattleManager.js (Client-Side)
 * API client pour gérer les combats Pokémon
 * 
 * Méthodes:
 * - startBattle(): Démarre un nouveau combat
 * - takeTurn(): Exécute un tour de combat
 * - getBattleState(): Récupère l'état actuel
 * - endBattle(): Termine le combat
 */

export default class PokemonBattleManager {
    constructor() {
        this.baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
        this.currentBattle = null;
    }

    /**
     * Démarre un nouveau combat
     * @param {string} playerId - ID du joueur
     * @param {string|null} opponentId - ID de l'adversaire (null pour combat sauvage)
     * @param {string} battleType - "wild" ou "pvp"
     * @returns {Promise<Object>} - Données du combat
     */
    async startBattle(playerId, opponentId = null, battleType = 'wild') {
        try {
            console.log('[BattleManager Client] Démarrage combat:', { playerId, battleType });

            const response = await fetch(`${this.baseUrl}/api/battle/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    playerId,
                    opponentId,
                    battleType
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erreur démarrage combat');
            }

            this.currentBattle = await response.json();
            console.log('[BattleManager Client] Combat démarré:', this.currentBattle.battleId);

            return this.currentBattle;

        } catch (error) {
            console.error('[BattleManager Client] Erreur startBattle:', error);
            throw error;
        }
    }

    /**
     * Exécute un tour de combat
     * @param {string} battleId - ID du combat
     * @param {string} moveName - Nom du move à utiliser
     * @param {string|null} targetId - ID de la cible (optionnel)
     * @returns {Promise<Object>} - Résultat du tour
     */
    async takeTurn(battleId, moveName, targetId = null) {
        try {
            console.log('[BattleManager Client] Tour de combat:', { battleId, moveName });

            const response = await fetch(`${this.baseUrl}/api/battle/turn`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    battleId,
                    actionType: 'move',
                    moveName,
                    targetId
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erreur exécution tour');
            }

            const turnResult = await response.json();
            console.log('[BattleManager Client] Tour exécuté:', turnResult);

            // Mettre à jour l'état local
            if (this.currentBattle && this.currentBattle.battleId === battleId) {
                this.currentBattle.turnCount = turnResult.turnCount;
                this.currentBattle.state = turnResult.state;
                this.currentBattle.isOver = turnResult.isOver;
                this.currentBattle.winner = turnResult.winner;
            }

            return turnResult;

        } catch (error) {
            console.error('[BattleManager Client] Erreur takeTurn:', error);
            throw error;
        }
    }

    /**
     * Récupère l'état actuel du combat
     * @param {string} battleId - ID du combat
     * @returns {Promise<Object>} - État du combat
     */
    async getBattleState(battleId) {
        try {
            console.log('[BattleManager Client] Récupération état combat:', battleId);

            const response = await fetch(`${this.baseUrl}/api/battle/${battleId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Combat introuvable');
            }

            const battleState = await response.json();
            console.log('[BattleManager Client] État récupéré:', battleState);

            return battleState;

        } catch (error) {
            console.error('[BattleManager Client] Erreur getBattleState:', error);
            throw error;
        }
    }

    /**
     * Termine le combat
     * @param {string} battleId - ID du combat
     * @param {string} winner - "player" ou "opponent"
     * @returns {Promise<Object>} - Résultat final et récompenses
     */
    async endBattle(battleId, winner) {
        try {
            console.log('[BattleManager Client] Fin de combat:', { battleId, winner });

            const response = await fetch(`${this.baseUrl}/api/battle/end`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    battleId,
                    winner
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erreur fin combat');
            }

            const result = await response.json();
            console.log('[BattleManager Client] Combat terminé:', result);

            // Réinitialiser l'état local
            this.currentBattle = null;

            return result;

        } catch (error) {
            console.error('[BattleManager Client] Erreur endBattle:', error);
            throw error;
        }
    }

    /**
     * Récupère le combat actuel en mémoire
     * @returns {Object|null}
     */
    getCurrentBattle() {
        return this.currentBattle;
    }

    /**
     * Change le Pokémon actif (switch)
     * @param {string} battleId - ID du combat
     * @param {number} newIndex - Index du nouveau Pokémon
     * @returns {Promise<Object>}
     */
    async switchPokemon(battleId, newIndex) {
        try {
            console.log('[BattleManager Client] Switch Pokémon:', { battleId, newIndex });

            const response = await fetch(`${this.baseUrl}/api/battle/switch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    battleId,
                    newIndex
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erreur switch Pokémon');
            }

            return await response.json();

        } catch (error) {
            console.error('[BattleManager Client] Erreur switchPokemon:', error);
            throw error;
        }
    }

    /**
     * Fuit le combat (combat sauvage uniquement)
     * @param {string} battleId - ID du combat
     * @returns {Promise<Object>}
     */
    async flee(battleId) {
        try {
            console.log('[BattleManager Client] Fuite du combat:', battleId);

            const response = await fetch(`${this.baseUrl}/api/battle/flee`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ battleId })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Impossible de fuir');
            }

            const result = await response.json();
            this.currentBattle = null;

            return result;

        } catch (error) {
            console.error('[BattleManager Client] Erreur flee:', error);
            throw error;
        }
    }
}
