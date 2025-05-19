// UI pour la main du joueur dans Triple Triad

function TripleTriadHandUI() {}

TripleTriadHandUI.prototype.createHandSprites = function(cardList, startX, startY, distance) {
    this._handSprites = [];
    for (let i = 0; i < cardList.length; i++) {
        const cardId = cardList[i];
        const sprite = new Sprite_Card();
        // ...récupération de l'image du cardId...
        sprite.x = startX + i * distance;
        sprite.y = startY;
        this.addChild(sprite);
        this._handSprites.push(sprite);
    }
};

TripleTriadHandUI.prototype.refreshHand = function(cardList) {
    // ...mettre à jour les sprites selon la main actuelle...
};
