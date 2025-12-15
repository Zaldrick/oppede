const BaseQuest = require('./BaseQuest');

class Quest_002_EtoileDuSoir extends BaseQuest {
    constructor() {
        super("Etoile du Soir", "Etoile du Soir", [
            "Je dois récupérer les clés de la voiture au magasin à côté. J'espère qu'elles sont réparées.",
            "Le réparateur a laissé les clés dans un coffre mais a oublié le code. Il sait juste qu'il y a un 6 et un 9.",
            "Un mémo sur le coffre indique : 'Gimli ouvre la voie'.",
            "Le code était 649. J'ai récupéré les clés ! Je devrais retourner à la voiture.",
            "Je peux maintenant utiliser la voiture pour aller direct sur lille. Quelque chose était caché dans la pochette arrière du siège passager!"
        ]);
    }

    async onStart(player, db) {
        console.log(`[Quest Etoile du Soir] Started for ${player.pseudo}`);
    }

    async onAdvance(player, newStepIndex, db) {
        console.log(`[Quest Etoile du Soir] Advanced to step ${newStepIndex} for ${player.pseudo}`);
    }

    async onComplete(player, db) {
        console.log(`[Quest Etoile du Soir] Completed for ${player.pseudo}`);
    }
}

module.exports = Quest_002_EtoileDuSoir;
