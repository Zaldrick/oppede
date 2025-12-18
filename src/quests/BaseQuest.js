export class BaseQuest {
  constructor({ scene, mapManager, eventManager, questId }) {
    this.scene = scene;
    this.mapManager = mapManager;
    this.eventManager = eventManager;
    this.questId = questId || '';
  }

  getApiUrl() {
    return process.env.REACT_APP_API_URL;
  }

  ensurePlayerDataQuests(playerData) {
    if (playerData && !playerData.quests) playerData.quests = {};
    return playerData;
  }

  getPlayerContext() {
    const playerPseudo = this.scene?.registry?.get('playerPseudo') || 'Moi';
    const playerData = this.scene?.registry?.get('playerData');
    const playerId = playerData ? playerData._id : null;

    this.ensurePlayerDataQuests(playerData);

    return { playerPseudo, playerData, playerId };
  }

  setLocalQuestStep({ playerData, questId, step }) {
    if (!playerData) return;
    this.ensurePlayerDataQuests(playerData);
    const id = questId || this.questId;
    if (!id) return;

    playerData.quests[id] = step;
    try {
      this.scene?.registry?.set('playerData', playerData);
    } catch (e) {
      // ignore
    }
  }

  async postQuest(endpoint, body, logPrefix = 'BaseQuest') {
    const apiUrl = this.getApiUrl();
    if (!apiUrl) return false;

    try {
      const res = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      });
      return res.ok;
    } catch (e) {
      console.warn(`[${logPrefix}] POST ${endpoint} failed`, e);
      return false;
    }
  }

  async startQuestIfMissing({ playerData, playerId, questId, showSystemMessage = false, logPrefix = 'BaseQuest' }) {
    if (!playerData) return false;

    const id = questId || this.questId;
    if (!id) return false;

    this.ensurePlayerDataQuests(playerData);
    if (playerData.quests[id] !== undefined) return false;

    // Local first to avoid double-start if API is slow.
    this.setLocalQuestStep({ playerData, questId: id, step: 0 });

    if (playerId) {
      await this.postQuest('/api/quests/start', { playerId, questId: id }, logPrefix);
    }

    if (showSystemMessage) {
      try {
        this.scene?.displayMessage?.(`Quête ajoutée : ${id}`, 'Système');
      } catch (e) {
        // ignore
      }
    }

    return true;
  }

  async advanceQuest({ playerId, playerData, questId, step, logPrefix = 'BaseQuest' }) {
    if (!playerData) return;

    const id = questId || this.questId;
    if (!id) return;

    if (playerId) {
      await this.postQuest('/api/quests/advance', { playerId, questId: id }, logPrefix);
    }

    const current = Number(playerData.quests?.[id] ?? 0) || 0;
    const next = step !== undefined ? step : current + 1;
    this.setLocalQuestStep({ playerData, questId: id, step: next });
  }

  async completeQuest({ playerId, playerData, questId, step, logPrefix = 'BaseQuest' }) {
    if (!playerData) return;

    const id = questId || this.questId;
    if (!id) return;

    if (playerId) {
      await this.postQuest('/api/quests/complete', { playerId, questId: id }, logPrefix);
    }

    // By default, completion means step 1 if not specified (matches several quests).
    const finalStep = step !== undefined ? step : 1;
    this.setLocalQuestStep({ playerData, questId: id, step: finalStep });
  }
}
