const BaseQuest = require('./BaseQuest');

class Quest_006_LeMessageManquant extends BaseQuest {
    constructor() {
        super("Le message manquant", "Le message manquant", [
            "J'ai reçu un message sur mon pc et j'allais en recevoir un deuxieme mais il n'a pas eu le temps de l'envoyer.",
            "Le message est \"C'est un bien grand carton, très pratique pour planquer quelque chose !\""
        ]);
    }

    async onStart(player, db) {
        console.log(`[Quest Le message manquant] Started for ${player?.pseudo || 'unknown'}`);
    }

    async onAdvance(player, newStepIndex, db) {
        console.log(`[Quest Le message manquant] Advanced to step ${newStepIndex} for ${player?.pseudo || 'unknown'}`);
    }

    async onComplete(player, db) {
        console.log(`[Quest Le message manquant] Completed for ${player?.pseudo || 'unknown'}`);
    }
}

module.exports = Quest_006_LeMessageManquant;
