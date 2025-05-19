// Gestion de la main du joueur pour Triple Triad

var TripleTriadHand = {
    addCard: function(cardId) {
        if (!$dataTripleTriad.self_tt_cards.includes(cardId) && $dataTripleTriad.self_tt_cards.length < 5) {
            $dataTripleTriad.self_tt_cards.push(cardId);
            return true;
        }
        return false;
    },
    removeCard: function(cardId) {
        const idx = $dataTripleTriad.self_tt_cards.indexOf(cardId);
        if (idx !== -1) {
            $dataTripleTriad.self_tt_cards.splice(idx, 1);
            return true;
        }
        return false;
    },
    hasCard: function(cardId) {
        return $dataTripleTriad.self_tt_cards.includes(cardId);
    },
    handCount: function() {
        return $dataTripleTriad.self_tt_cards.length;
    }
};
