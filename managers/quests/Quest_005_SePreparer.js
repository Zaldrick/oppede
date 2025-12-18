const BaseQuest = require('./BaseQuest');

class Quest_005_SePreparer extends BaseQuest {
    constructor() {
        super("Se préparer", "Se préparer", [
            "Je dois me préparer avant d'aller plus loin.",
            "J'ai trouvé un compagnon, ca devrait aller mieux maintenant."
        ]);
    }

    async onStart(player, db) {
        console.log(`[Quest Se préparer] Started for ${player?.pseudo || 'unknown'}`);
    }

    async onAdvance(player, newStepIndex, db) {
        console.log(`[Quest Se préparer] Advanced to step ${newStepIndex} for ${player?.pseudo || 'unknown'}`);
    }

    async onComplete(player, db) {
        console.log(`[Quest Se préparer] Completed for ${player?.pseudo || 'unknown'}`);
    }
}

module.exports = Quest_005_SePreparer;
