const BaseQuest = require('./BaseQuest');

class Quest_007_LushMaisPasTrop extends BaseQuest {
    constructor() {
        super("Lush mais pas trop", "Lush mais pas trop", [
            "Mon frigo est verrouillé ...il y a des selfies récent de lui accrochés sur ce dernier, il doit y avoir un indice dessus",
            "Un indice était caché dans la boite de jeu dark souls, le code était 2204. J'ai trouvé quelque chose au dessus du frigo."
        ]);
    }

    async onStart(player, db) {
        console.log(`[Quest Lush mais pas trop] Started for ${player?.pseudo || 'unknown'}`);
    }

    async onAdvance(player, newStepIndex, db) {
        console.log(`[Quest Lush mais pas trop] Advanced to step ${newStepIndex} for ${player?.pseudo || 'unknown'}`);
    }

    async onComplete(player, db) {
        console.log(`[Quest Lush mais pas trop] Completed for ${player?.pseudo || 'unknown'}`);
    }
}

module.exports = Quest_007_LushMaisPasTrop;
