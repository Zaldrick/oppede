const BaseQuest = require('./BaseQuest');

class Quest_003_BesoinDunTicket extends BaseQuest {
    constructor() {
        super("Besoin d'un ticket", "Besoin d'un ticket", [
            "Je suis bloqué par le portique, il me faut un ticket, je devrais regarder sur la machine à côté.",
            "La machine est verrouillée ? Elle me demande un code, peut-être quelqu'un dans les alentours peut m'aider.",
            "J'ai battu un taré qui avait verrouillée la machine, le code est 1234",
            "J'ai déverrouillé la machine et récupéré un ticket, je peux maintenant passer le portique !"
        ]);
    }

    async onStart(player, db) {
        console.log(`[Quest Besoin d'un ticket] Started for ${player?.pseudo || 'unknown'}`);
    }

    async onAdvance(player, newStepIndex, db) {
        console.log(`[Quest Besoin d'un ticket] Advanced to step ${newStepIndex} for ${player?.pseudo || 'unknown'}`);
    }

    async onComplete(player, db) {
        console.log(`[Quest Besoin d'un ticket] Completed for ${player?.pseudo || 'unknown'}`);
    }
}

module.exports = Quest_003_BesoinDunTicket;
