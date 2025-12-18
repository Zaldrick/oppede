export class RentrerALaMaisonQuest {
  constructor({ scene, mapManager, eventManager }) {
    this.scene = scene;
    this.mapManager = mapManager;
    this.eventManager = eventManager;

    this.homeQuestId = 'Rentrer à la maison';

    // Trigger guard so the intro line only fires once per teleport.
    this.arrivalHandled = false;
  }

  getPlayerContext() {
    const playerPseudo = this.scene.registry.get('playerPseudo') || 'Moi';
    const playerData = this.scene.registry.get('playerData');
    const playerId = playerData ? playerData._id : null;

    if (playerData && !playerData.quests) playerData.quests = {};

    return { playerPseudo, playerData, playerId };
  }

  getCurrentMapKey() {
    return this.mapManager?.map?.key || this.scene.registry.get('currentMapKey') || '';
  }

  getPlayer() {
    return this.scene.playerManager?.getPlayer();
  }

  getTilePos() {
    const player = this.getPlayer();
    if (!player) return null;
    return {
      tileX: Math.floor(player.x / 48),
      tileY: Math.floor(player.y / 48)
    };
  }

  destroyRuntimeObjects() {
    this.arrivalHandled = false;
  }

  async startQuestIfMissing({ playerData, playerId, questId }) {
    if (!playerData) return false;
    if (playerData.quests[questId] !== undefined) return false;

    playerData.quests[questId] = 0;
    this.scene.registry.set('playerData', playerData);

    const apiUrl = process.env.REACT_APP_API_URL;
    if (apiUrl && playerId) {
      try {
        await fetch(`${apiUrl}/api/quests/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, questId })
        });
      } catch (e) {
        console.warn('[RentrerALaMaisonQuest] start failed', e);
      }
    }

    return true;
  }

  async advanceQuestByOne({ playerId, playerData, questId }) {
    if (!playerData) return;

    const current = Number(playerData.quests?.[questId] ?? 0) || 0;
    const next = current + 1;

    const apiUrl = process.env.REACT_APP_API_URL;
    if (apiUrl && playerId) {
      try {
        await fetch(`${apiUrl}/api/quests/advance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, questId })
        });
      } catch (e) {
        console.warn('[RentrerALaMaisonQuest] advance failed', e);
      }
    }

    playerData.quests[questId] = next;
    this.scene.registry.set('playerData', playerData);
  }

  async completeQuest({ playerId, playerData, questId, lastIndex }) {
    if (!playerData) return;

    const current = Number(playerData.quests?.[questId] ?? 0) || 0;
    try {
      for (let i = current; i < lastIndex; i++) {
        await this.advanceQuestByOne({ playerId, playerData, questId });
      }
    } catch (e) {
      // ignore
    }

    const apiUrl = process.env.REACT_APP_API_URL;
    if (apiUrl && playerId) {
      try {
        await fetch(`${apiUrl}/api/quests/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, questId })
        });
      } catch (e) {
        console.warn('[RentrerALaMaisonQuest] complete failed', e);
      }
    }

    playerData.quests[questId] = lastIndex;
    this.scene.registry.set('playerData', playerData);
  }

  async hasAnyPokemon({ playerId }) {
    const apiUrl = process.env.REACT_APP_API_URL;
    if (!apiUrl || !playerId) return false;

    try {
      const res = await fetch(`${apiUrl}/api/pokemon/team/${playerId}`);
      if (!res.ok) return false;
      const data = await res.json();
      const team = data?.team || [];
      return Array.isArray(team) && team.length > 0;
    } catch (e) {
      console.warn('[RentrerALaMaisonQuest] hasAnyPokemon failed', e);
      return false;
    }
  }

  spawnForMap(mapKey) {
    this.destroyRuntimeObjects();

    // Completion: only when first arriving on marin.
    if (mapKey === 'marin') {
      const { playerPseudo, playerData, playerId } = this.getPlayerContext();
      const step = playerData?.quests?.[this.homeQuestId];
      if (playerData && step !== undefined && Number(step) < 1) {
        this.scene.displayMessage('enfin rentré', playerPseudo);
        void this.completeQuest({ playerId, playerData, questId: this.homeQuestId, lastIndex: 1 });
      }
      return;
    }

    if (mapKey !== 'qwest') return;

    // Guard resets on each map load.
    this.arrivalHandled = false;
  }

  update() {
    const mapKey = this.getCurrentMapKey();
    const player = this.getPlayer();
    if (!player) return;

    if (mapKey === 'qwest') {
      try {
        const tile = this.getTilePos();
        const teleportedByRalof = Boolean(this.scene.registry.get('teleport:ralof->qwest'));
        if (tile && tile.tileX === 3 && tile.tileY === 4 && teleportedByRalof && !this.arrivalHandled) {
          const { playerPseudo, playerData, playerId } = this.getPlayerContext();

          this.arrivalHandled = true;
          this.scene.registry.set('teleport:ralof->qwest', false);

          void (async () => {
            await this.startQuestIfMissing({ playerData, playerId, questId: this.homeQuestId });
            this.scene.displayMessage("??? Mais qu’est-ce que je fou là ? Bon, essayons de voir si je peux rentrer …", playerPseudo);
          })();
        }
      } catch (e) {}
    }
  }

  handleNPCInteraction(npc) {
    return false;
  }
}
