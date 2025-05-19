// This file contains utility functions for the Triple Triad game.

export function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export function generateRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function cloneObject(obj) {
    return JSON.parse(JSON.stringify(obj));
}

export function isCardPlayable(card, boardPosition) {
    // Implement logic to determine if a card can be played at the given board position
    // This is a placeholder for actual game logic
    return true;
}