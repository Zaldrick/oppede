const BaseQuest = require('./BaseQuest');

class Quest_007_AHauteurDeBetteu extends BaseQuest {
    constructor() {
        super(
            'A hauteur de betteu',
            'A hauteur de betteu',
            [
                "Il y a quelque chose de gravé sur le coffre : ∑𝑛∈Todolist.",
                "J'ai trouvé le code, j'ai ouvert le coffre. Un mot est écrit : \"Dans la SdB, au fond d'un placard...\""
            ]
        );
    }

    async onStart(player, db) {
        console.log(`[Quest A hauteur de betteu] Started for ${player?.pseudo || 'unknown'}`);
    }

    async onAdvance(player, newStepIndex, db) {
        console.log(`[Quest A hauteur de betteu] Advanced to step ${newStepIndex} for ${player?.pseudo || 'unknown'}`);
    }

    async onComplete(player, db) {
        console.log(`[Quest A hauteur de betteu] Completed for ${player?.pseudo || 'unknown'}`);
    }
}

module.exports = Quest_007_AHauteurDeBetteu;
