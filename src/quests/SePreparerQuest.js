export class SePreparerQuest {
  constructor({ scene, mapManager, eventManager }) {
    this.scene = scene;
    this.mapManager = mapManager;
    this.eventManager = eventManager;

    this.questId = 'Se préparer';

    this.gateBlocker = null;
    this.gateCollider = null;
    this.lastSafePos = null;
    this.lastGateMessageAt = 0;
    this.isResolvingGate = false;
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
    try {
      if (this.gateCollider) this.gateCollider.destroy();
    } catch (e) {}
    this.gateCollider = null;

    try {
      if (this.gateBlocker) this.gateBlocker.destroy();
    } catch (e) {}
    this.gateBlocker = null;

    this.lastSafePos = null;
    this.lastGateMessageAt = 0;
    this.isResolvingGate = false;
  }

  async startQuestIfMissing({ playerData, playerId }) {
    if (!playerData) return false;
    if (playerData.quests?.[this.questId] !== undefined) return false;

    if (!playerData.quests) playerData.quests = {};
    playerData.quests[this.questId] = 0;
    this.scene.registry.set('playerData', playerData);

    const apiUrl = process.env.REACT_APP_API_URL;
    if (apiUrl && playerId) {
      try {
        await fetch(`${apiUrl}/api/quests/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, questId: this.questId })
        });
      } catch (e) {
        console.warn('[SePreparerQuest] start failed', e);
      }
    }

    return true;
  }

  async completeQuest({ playerId, playerData }) {
    if (!playerData) return;

    const apiUrl = process.env.REACT_APP_API_URL;
    if (apiUrl && playerId) {
      try {
        await fetch(`${apiUrl}/api/quests/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, questId: this.questId })
        });
      } catch (e) {
        console.warn('[SePreparerQuest] complete failed', e);
      }
    }

    if (!playerData.quests) playerData.quests = {};
    playerData.quests[this.questId] = 1;
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
      console.warn('[SePreparerQuest] hasAnyPokemon failed', e);
      return false;
    }
  }

  spawnForMap(mapKey) {
    this.destroyRuntimeObjects();

    if (mapKey !== 'qwest') return;
    if (!this.scene.physics) return;

    const player = this.getPlayer();
    if (!player) return;

    this.lastSafePos = { x: player.x, y: player.y };

    const gateX = 15 * 48 + 24;
    const gateY = 5 * 48 + 24;

    const blocker = this.scene.add.zone(gateX, gateY, 48, 48);
    blocker.setOrigin(0.5);
    this.scene.physics.add.existing(blocker, true);
    this.gateBlocker = blocker;

    this.gateCollider = this.scene.physics.add.collider(player, blocker, () => {
      const { playerPseudo, playerData, playerId } = this.getPlayerContext();

      const step = playerData?.quests?.[this.questId];
      if (step !== undefined && Number(step) >= 1) {
        this.destroyRuntimeObjects();
        return;
      }

      if (this.isResolvingGate) return;
      this.isResolvingGate = true;

      // Reposition immediately to avoid jitter
      try {
        const p = this.getPlayer();
        if (p && this.lastSafePos) {
          p.setVelocity(0, 0);
          p.x = this.lastSafePos.x;
          p.y = this.lastSafePos.y;
        }
      } catch (e) {}

      void (async () => {
        await this.startQuestIfMissing({ playerData, playerId });

        const hasPokemon = await this.hasAnyPokemon({ playerId });
        if (hasPokemon) {
          await this.completeQuest({ playerId, playerData });
          this.destroyRuntimeObjects();
          this.isResolvingGate = false;
          return;
        }

        const now = Date.now();
        if (now - (this.lastGateMessageAt || 0) > 1200) {
          this.lastGateMessageAt = now;
          this.scene.displayMessage("Je devrais peut-être mieux me préparer avant de sortir.", playerPseudo);
        }

        this.isResolvingGate = false;
      })();
    });
  }

  update() {
    const mapKey = this.getCurrentMapKey();
    if (mapKey !== 'qwest') return;

    const player = this.getPlayer();
    if (!player) return;

    try {
      const tile = this.getTilePos();
      if (tile) {
        const isOnGateTile = tile.tileX === 15 && tile.tileY === 5;
        if (!isOnGateTile && !(this.scene.uiManager && this.scene.uiManager.isDialogueActive)) {
          this.lastSafePos = { x: player.x, y: player.y };
        }
      }
    } catch (e) {}
  }
}
