// src/tripleTriad.js

class Player {
    constructor(name) {
        this.name = name;
        this.hand = [];
    }
    addCard(cardId) {
        if (!this.hand.includes(cardId) && this.hand.length < 5) {
            this.hand.push(cardId);
            return true;
        }
        return false;
    }
    removeCard(cardId) {
        const idx = this.hand.indexOf(cardId);
        if (idx !== -1) {
            this.hand.splice(idx, 1);
            return true;
        }
        return false;
    }
    hasCard(cardId) {
        return this.hand.includes(cardId);
    }
    handCount() {
        return this.hand.length;
    }
}

class TripleTriad {
    constructor() {
        this.players = [new Player('Player 1'), new Player('Player 2')];
        this.currentPlayerIndex = 0;
        this.gameOver = false;
        // Board and other logic can be added here
    }

    // Ajoute une carte à la main du joueur courant
    addCardToCurrentPlayer(cardId) {
        return this.players[this.currentPlayerIndex].addCard(cardId);
    }

    // Retire une carte de la main du joueur courant
    removeCardFromCurrentPlayer(cardId) {
        return this.players[this.currentPlayerIndex].removeCard(cardId);
    }

    // Affiche la main du joueur courant
    showCurrentPlayerHand() {
        const player = this.players[this.currentPlayerIndex];
        console.log(`${player.name} hand:`, player.hand);
    }

    // Vérifie si une carte est dans la main du joueur courant
    currentPlayerHasCard(cardId) {
        return this.players[this.currentPlayerIndex].hasCard(cardId);
    }

    switchPlayer() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    }

    // Minimal game loop for demonstration
    gameLoop() {
        if (this.gameOver) {
            console.log('Game Over!');
            return;
        }
        // ...game logic...
        setTimeout(() => this.gameLoop(), 1000);
    }

    start() {
        this.gameLoop();
    }
}

const game = new TripleTriad();
// Exemple d'utilisation :
game.addCardToCurrentPlayer(1);
game.addCardToCurrentPlayer(2);
game.showCurrentPlayerHand();
game.switchPlayer();
game.addCardToCurrentPlayer(3);
game.showCurrentPlayerHand();
game.switchPlayer();
game.showCurrentPlayerHand();
game.start();