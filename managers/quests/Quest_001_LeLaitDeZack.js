const BaseQuest = require('./BaseQuest');

class Quest_001_LeLaitDeZack extends BaseQuest {
    constructor() {
        super(1, "Le lait de Zack", [
            "Zack m'a demandé d'aller vérifier dans le frigo si il reste du lait.",
            "J'ai essayé d'accéder au frigo mais il est fermé à clé, je dois trouver une clé.",
            "J'ai trouvé la clé du frigo, je devrais y retourner.",
            "J'ai ouvert le frigo mais il n'y avait pas de lait, je devrais retourner voir Zack.",
            "Zack m'a dit d'aller au magasin en acheter."
        ]);
    }

    async onStart(player, db) {
        console.log(`[Quest 1] Started for ${player.pseudo}`);
    }

    async onAdvance(player, newStepIndex, db) {
        console.log(`[Quest 1] Advanced to step ${newStepIndex} for ${player.pseudo}`);
        if (newStepIndex === 2) {
            // Exemple : Donner un item fictif "Clé du frigo" si on voulait
        }
    }

    async onComplete(player, db) {
        console.log(`[Quest 1] Completed by ${player.pseudo}`);
        // Récompense
        // await db.collection('players').updateOne({ _id: player._id }, { $inc: { totalScore: 100 } });
    }
}

module.exports = Quest_001_LeLaitDeZack;
