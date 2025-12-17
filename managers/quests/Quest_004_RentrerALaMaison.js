const BaseQuest = require('./BaseQuest');

class Quest_004_RentrerALaMaison extends BaseQuest {
    constructor() {
        super("Rentrer à la maison", "Rentrer à la maison", [
            "Je devrais rentrer à la maison.",
            "Je suis rentré à la maison."
        ]);
    }

    async onStart(player, db) {
        console.log(`[Quest Rentrer à la maison] Started for ${player?.pseudo || 'unknown'}`);
    }

    async onAdvance(player, newStepIndex, db) {
        console.log(`[Quest Rentrer à la maison] Advanced to step ${newStepIndex} for ${player?.pseudo || 'unknown'}`);
    }

    async onComplete(player, db) {
        console.log(`[Quest Rentrer à la maison] Completed for ${player?.pseudo || 'unknown'}`);
    }
}

module.exports = Quest_004_RentrerALaMaison;
