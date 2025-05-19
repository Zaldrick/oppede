// Exemple de commandes pour manipuler la main du joueur

export function addCardToPlayer(game, playerIndex, cardId) {
    return game.players[playerIndex].addCard(cardId);
}

export function removeCardFromPlayer(game, playerIndex, cardId) {
    return game.players[playerIndex].removeCard(cardId);
}

// Ajoute ici d'autres commandes globales si besoin
