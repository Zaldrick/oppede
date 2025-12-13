const fs = require('fs');
const path = require('path');

class QuestRegistry {
    constructor() {
        this.quests = new Map();
    }

    loadQuests() {
        const questsDir = path.join(__dirname, 'quests');
        if (!fs.existsSync(questsDir)) {
            console.log('[QuestRegistry] Directory not found:', questsDir);
            return;
        }

        const files = fs.readdirSync(questsDir);
        for (const file of files) {
            if (file.endsWith('.js') && file !== 'BaseQuest.js') {
                try {
                    const QuestClass = require(path.join(questsDir, file));
                    // Vérifier si c'est une classe
                    if (typeof QuestClass === 'function') {
                        const questInstance = new QuestClass();
                        if (questInstance.id) {
                            this.quests.set(questInstance.id, questInstance);
                            console.log(`[QuestRegistry] Loaded quest: ${questInstance.id} - ${questInstance.title}`);
                        }
                    }
                } catch (e) {
                    console.error(`[QuestRegistry] Failed to load quest ${file}:`, e);
                }
            }
        }
    }

    getQuest(questId) {
        return this.quests.get(questId);
    }

    getAllQuests() {
        return Array.from(this.quests.values());
    }
}

module.exports = new QuestRegistry();
