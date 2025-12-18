const { ObjectId } = require('mongodb');
const QuestRegistry = require('./QuestRegistry');

class QuestManager {
    constructor(databaseManager) {
        this.databaseManager = databaseManager;
        this.questsCollection = null;
        this.playerQuestsCollection = null;
        console.log('[QuestManager] Initialisé');
    }

    async initialize() {
        const db = await this.databaseManager.connectToDatabase();
        this.questsCollection = db.collection('quests');
        this.playerQuestsCollection = db.collection('player_quests');

        // Charger les quêtes depuis le registre
        QuestRegistry.loadQuests();

        // Créer des index
        try {
            await this.questsCollection.createIndex({ quest_id: 1 }, { unique: true });
            await this.playerQuestsCollection.createIndex({ playerId: 1, questId: 1 }, { unique: true });
        } catch (e) {
            // Index existe déjà
        }

        await this.seedQuests();
        console.log('[QuestManager] Collections initialisées');
    }

    async seedQuests() {
        // Synchroniser les quêtes du code vers la DB
        const codeQuests = QuestRegistry.getAllQuests();
        
        for (const quest of codeQuests) {
            const questData = {
                quest_id: quest.id,
                title: quest.title,
                steps: quest.steps
            };
            
            await this.questsCollection.updateOne(
                { quest_id: quest.id },
                { $set: questData },
                { upsert: true }
            );
        }
    }

    setupRoutes(app) {
        // Récupérer les quêtes d'un joueur
        app.get('/api/quests/:playerId', async (req, res) => {
            try {
                const { playerId } = req.params;
                
                // Récupérer toutes les définitions de quêtes (DB + Code)
                // On utilise la DB pour les titres/steps de base, mais on pourrait utiliser le code
                const allQuestsDB = await this.questsCollection.find({}).toArray();
                
                // Récupérer la progression du joueur
                const playerQuests = await this.playerQuestsCollection.find({ playerId }).toArray();
                
                // Fusionner les données
                const result = playerQuests.map(pq => {
                    const questDefDB = allQuestsDB.find(q => q.quest_id === pq.questId);
                    const questObj = QuestRegistry.getQuest(pq.questId);
                    
                    if (!questDefDB && !questObj) return null;
                    
                    const title = questObj ? questObj.title : questDefDB.title;
                    
                    // Description via objet de quête (plus flexible) ou fallback DB
                    let description = "";
                    if (questObj) {
                        description = questObj.getDescription(pq.stepIndex);
                    } else {
                        // Fallback DB logic
                        for (let i = 0; i <= pq.stepIndex && i < questDefDB.steps.length; i++) {
                            description += questDefDB.steps[i] + "\n\n";
                        }
                        description = description.trim();
                    }

                    return {
                        questId: pq.questId,
                        title: title,
                        status: pq.status, // 'active', 'completed'
                        stepIndex: pq.stepIndex,
                        description: description
                    };
                }).filter(q => q !== null);

                res.json(result);
            } catch (error) {
                console.error('Error fetching quests:', error);
                res.status(500).json({ error: 'Failed to fetch quests' });
            }
        });

        // Démarrer une quête (pour debug ou trigger)
        app.post('/api/quests/start', async (req, res) => {
            try {
                const { playerId, questId } = req.body;
                
                const questObj = QuestRegistry.getQuest(questId);
                const questDefDB = await this.questsCollection.findOne({ quest_id: questId });
                
                if (!questObj && !questDefDB) {
                    return res.status(404).json({ error: 'Quest not found' });
                }

                // Vérifier conditions de démarrage via code
                if (questObj) {
                    const player = await this.databaseManager.getDatabase().collection('players').findOne({ _id: new ObjectId(playerId) });
                    const canStart = await questObj.canStart(player, this.databaseManager.getDatabase());
                    if (!canStart) {
                        return res.status(400).json({ error: 'Conditions not met' });
                    }
                }

                await this.playerQuestsCollection.updateOne(
                    { playerId, questId },
                    { 
                        $setOnInsert: { 
                            playerId, 
                            questId, 
                            status: 'active', 
                            stepIndex: 0,
                            startedAt: new Date()
                        } 
                    },
                    { upsert: true }
                );

                // Hook onStart
                if (questObj) {
                    const player = await this.databaseManager.getDatabase().collection('players').findOne({ _id: new ObjectId(playerId) });
                    await questObj.onStart(player, this.databaseManager.getDatabase());
                }

                res.json({ success: true, message: 'Quest started' });
            } catch (error) {
                console.error('Error starting quest:', error);
                res.status(500).json({ error: 'Failed to start quest' });
            }
        });

        // Avancer une quête
        app.post('/api/quests/advance', async (req, res) => {
            try {
                const { playerId, questId } = req.body;
                
                const playerQuest = await this.playerQuestsCollection.findOne({ playerId, questId });
                if (!playerQuest) {
                    return res.status(404).json({ error: 'Player quest not found' });
                }

                const questObj = QuestRegistry.getQuest(questId);
                const questDefDB = await this.questsCollection.findOne({ quest_id: questId });
                const stepsCount = questObj ? questObj.steps.length : questDefDB.steps.length;
                
                let newIndex = playerQuest.stepIndex + 1;

                // Vérifier conditions d'avancement
                if (questObj) {
                    const player = await this.databaseManager.getDatabase().collection('players').findOne({ _id: new ObjectId(playerId) });
                    const canAdvance = await questObj.canAdvance(player, playerQuest.stepIndex, this.databaseManager.getDatabase());
                    if (!canAdvance) {
                        return res.status(400).json({ error: 'Conditions not met to advance' });
                    }
                }

                if (newIndex >= stepsCount) {
                    // Fin de quête ?
                    // Pour l'instant on bloque au max
                    newIndex = stepsCount - 1;
                }

                await this.playerQuestsCollection.updateOne(
                    { playerId, questId },
                    { 
                        $set: { 
                            stepIndex: newIndex,
                            updatedAt: new Date()
                        } 
                    }
                );

                // Hook onAdvance
                if (questObj) {
                    const player = await this.databaseManager.getDatabase().collection('players').findOne({ _id: new ObjectId(playerId) });
                    await questObj.onAdvance(player, newIndex, this.databaseManager.getDatabase());
                }

                res.json({ success: true, stepIndex: newIndex });
            } catch (error) {
                console.error('Error advancing quest:', error);
                res.status(500).json({ error: 'Failed to advance quest' });
            }
        });
        
        // Compléter une quête
        app.post('/api/quests/complete', async (req, res) => {
            try {
                const { playerId, questId } = req.body;

                const playerQuest = await this.playerQuestsCollection.findOne({ playerId, questId });
                if (!playerQuest) {
                    return res.status(404).json({ error: 'Player quest not found' });
                }

                const questObj = QuestRegistry.getQuest(questId);
                const questDefDB = await this.questsCollection.findOne({ quest_id: questId });
                const stepsCount = questObj
                    ? questObj.steps.length
                    : (questDefDB && Array.isArray(questDefDB.steps) ? questDefDB.steps.length : 0);

                const finalStepIndex = stepsCount > 0 ? Math.max(0, stepsCount - 1) : playerQuest.stepIndex;

                await this.playerQuestsCollection.updateOne(
                    { playerId, questId },
                    {
                        $set: {
                            status: 'completed',
                            stepIndex: finalStepIndex,
                            updatedAt: new Date(),
                            completedAt: new Date()
                        }
                    }
                );
                if (questObj) {
                    const player = await this.databaseManager.getDatabase().collection('players').findOne({ _id: new ObjectId(playerId) });
                    await questObj.onComplete(player, this.databaseManager.getDatabase());
                }

                res.json({ success: true, message: 'Quest completed' });
            } catch (error) {
                console.error('Error completing quest:', error);
                res.status(500).json({ error: 'Failed to complete quest' });
            }
        });

        // Supprimer une quête (Debug)
        app.delete('/api/quests/:playerId/:questIdentifier', async (req, res) => {
            try {
                const { playerId, questIdentifier } = req.params;
                const decodedIdentifier = decodeURIComponent(questIdentifier);
                
                let targetQuestId = decodedIdentifier;
                
                // 1. Chercher si l'identifiant correspond à un titre dans la DB
                const questByTitle = await this.questsCollection.findOne({ title: decodedIdentifier });
                if (questByTitle) {
                    targetQuestId = questByTitle.quest_id;
                } else {
                    // 2. Chercher si l'identifiant correspond à un titre dans le Registre (Code)
                    const allQuests = QuestRegistry.getAllQuests();
                    const questObj = allQuests.find(q => q.title === decodedIdentifier);
                    if (questObj) {
                        targetQuestId = questObj.id;
                    }
                }
                
                // 3. Tenter la suppression
                const result = await this.playerQuestsCollection.deleteOne({ 
                    playerId: playerId, 
                    questId: targetQuestId 
                });

                if (result.deletedCount > 0) {
                    res.json({ success: true, message: `Quest '${targetQuestId}' deleted for player` });
                } else {
                    // Si échec, on tente avec l'identifiant brut (au cas où c'était déjà un ID)
                    if (targetQuestId !== decodedIdentifier) {
                        const result2 = await this.playerQuestsCollection.deleteOne({ 
                            playerId: playerId, 
                            questId: decodedIdentifier 
                        });
                        
                        if (result2.deletedCount > 0) {
                            res.json({ success: true, message: `Quest '${decodedIdentifier}' deleted for player` });
                            return;
                        }
                    }
                    
                    res.status(404).json({ error: 'Quest not found or not active for player' });
                }
            } catch (error) {
                console.error('Error deleting quest:', error);
                res.status(500).json({ error: 'Failed to delete quest' });
            }
        });
    }
}

module.exports = QuestManager;
