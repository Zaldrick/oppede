class BaseQuest {
    constructor(id, title, steps) {
        this.id = id;
        this.title = title;
        this.steps = steps || [];
    }

    /**
     * Retourne la description cumulative jusqu'à l'étape donnée.
     * Peut être surchargé pour une description dynamique.
     */
    getDescription(stepIndex) {
        let description = "";
        for (let i = 0; i <= stepIndex && i < this.steps.length; i++) {
            description += this.steps[i] + "\n\n";
        }
        return description.trim();
    }

    /**
     * Appelé avant de démarrer la quête.
     * Retourne true si la quête peut démarrer.
     */
    async canStart(player, db) {
        return true;
    }

    /**
     * Appelé lors du démarrage de la quête.
     */
    async onStart(player, db) {
        // Logique personnalisée (donner un item, etc.)
    }

    /**
     * Appelé avant d'avancer à l'étape suivante.
     * Retourne true si on peut avancer.
     */
    async canAdvance(player, currentStepIndex, db) {
        return true;
    }

    /**
     * Appelé après avoir avancé d'une étape.
     */
    async onAdvance(player, newStepIndex, db) {
        // Logique personnalisée
    }

    /**
     * Appelé lors de la complétion de la quête.
     */
    async onComplete(player, db) {
        // Donner récompense, XP, etc.
    }
}

module.exports = BaseQuest;
