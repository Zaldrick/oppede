class Player {
    constructor(name) {
        this.name = name;
        this.hand = [];
    }

    drawCard(card) {
        this.hand.push(card);
    }

    playCard(cardIndex) {
        if (cardIndex >= 0 && cardIndex < this.hand.length) {
            return this.hand.splice(cardIndex, 1)[0]; // Remove and return the played card
        }
        return null; // Invalid card index
    }

    calculateScore() {
        return this.hand.reduce((total, card) => total + card.value, 0); // Assuming each card has a 'value' property
    }
}

export default Player;