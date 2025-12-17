export class BesoinDunTicketQuest {
  constructor({ scene, mapManager, eventManager }) {
    this.scene = scene;
    this.mapManager = mapManager;
    this.eventManager = eventManager;

    this.questId = "Besoin d'un ticket";

    // Runtime objects
    this.machineNpc = null;
    this.gateBlocker = null;
    this.gateCollider = null;

    this.isPinCodeActive = false;

    // Anti-spam
    this.lastGateMessageAt = 0;

    // Safe reposition
    this.lastSafePos = null;
  }

  getPlayerContext() {
    const playerPseudo = this.scene.registry.get('playerPseudo') || 'Moi';
    const playerData = this.scene.registry.get('playerData');
    const playerId = playerData ? playerData._id : null;

    if (playerData && !playerData.quests) playerData.quests = {};

    return { playerPseudo, playerData, playerId };
  }

  hasTicket() {
    const inv = Array.isArray(this.scene.inventory) ? this.scene.inventory : [];
    return inv.some((i) => {
      if (!i) return false;
      if (i.nom !== 'ticket de métro') return false;
      const qty = Number(i.quantite ?? i['quantité'] ?? i.quantity ?? 0) || 0;
      return qty > 0;
    });
  }

  destroyRuntimeObjects() {
    try {
      if (this.gateCollider) {
        this.gateCollider.destroy();
      }
    } catch (e) {}
    this.gateCollider = null;

    try {
      if (this.gateBlocker) {
        this.gateBlocker.destroy();
      }
    } catch (e) {}
    this.gateBlocker = null;

    // machineNpc is in activeEvents and will also be cleared there,
    // but destroy it here as well to avoid duplicates.
    try {
      if (this.machineNpc) {
        this.machineNpc.destroy();
      }
    } catch (e) {}
    this.machineNpc = null;

    this.lastSafePos = null;
    this.isPinCodeActive = false;
  }

  async startQuestIfMissing({ playerData, playerId }) {
    if (!playerData) return false;
    if (playerData.quests[this.questId] !== undefined) return false;

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
        console.warn('[BesoinDunTicketQuest] start failed', e);
      }
    }

    this.scene.displayMessage(`Quête ajoutée : ${this.questId}`, 'Système');
    return true;
  }

  async advanceQuestByOne({ playerId, playerData }) {
    if (!playerData) return;

    const current = Number(playerData.quests?.[this.questId] ?? 0) || 0;
    const next = current + 1;

    const apiUrl = process.env.REACT_APP_API_URL;
    if (apiUrl && playerId) {
      try {
        await fetch(`${apiUrl}/api/quests/advance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, questId: this.questId })
        });
      } catch (e) {
        console.warn('[BesoinDunTicketQuest] advance failed', e);
      }
    }

    playerData.quests[this.questId] = next;
    this.scene.registry.set('playerData', playerData);
  }

  async completeQuest({ playerId, playerData }) {
    if (!playerData) return;

    // Ensure local step is last (index 3) so UI shows full description.
    const targetLastIndex = 3;
    const current = Number(playerData.quests?.[this.questId] ?? 0) || 0;

    // Bring server stepIndex up to lastIndex, then mark completed.
    try {
      for (let i = current; i < targetLastIndex; i++) {
        await this.advanceQuestByOne({ playerId, playerData });
      }
    } catch (e) {
      // If advance fails, still attempt to complete.
    }

    const apiUrl = process.env.REACT_APP_API_URL;
    if (apiUrl && playerId) {
      try {
        await fetch(`${apiUrl}/api/quests/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, questId: this.questId })
        });
      } catch (e) {
        console.warn('[BesoinDunTicketQuest] complete failed', e);
      }
    }

    playerData.quests[this.questId] = targetLastIndex;
    this.scene.registry.set('playerData', playerData);
  }

  spawnForMap(mapKey) {
    // Always cleanup to avoid duplicates on map changes.
    this.destroyRuntimeObjects();

    if (mapKey !== 'metro') return;

    const player = this.scene.playerManager?.getPlayer();
    if (!player || !this.scene.physics) return;

    // --- Machine à ticket (interaction) ---
    // Machine sur 27:21 et déborde sur 28:21 => zone 96x48 centrée.
    const machineX = 27 * 48 + 48;
    const machineY = 21 * 48 + 24;

    const machine = this.scene.add.zone(machineX, machineY, 96, 48);
    machine.setOrigin(0.5);
    machine.npcType = 'ticket_machine';
    machine.npcName = 'Machine';
    machine.facePlayerOnInteract = false;
    machine.setInteractive();

    this.machineNpc = machine;
    // Needed for getNearbyEventObject
    this.eventManager.activeEvents.push(machine);

    // --- Portique (collision gate) ---
    const gateX = 21 * 48 + 24;
    const gateY = 24 * 48 + 24;

    const blocker = this.scene.add.zone(gateX, gateY, 48, 48);
    blocker.setOrigin(0.5);
    this.scene.physics.add.existing(blocker, true);

    this.gateBlocker = blocker;

    // Init safe pos
    this.lastSafePos = { x: player.x, y: player.y };

    this.gateCollider = this.scene.physics.add.collider(player, blocker, () => {
      // If player already has ticket: open gate once and play sound.
      if (this.hasTicket()) {
        try {
          this.scene.sound.play('ticket', { volume: 0.9 });
        } catch (e) {}
        this.destroyRuntimeObjects();
        return;
      }

      // Without ticket: block and start quest.
      const now = Date.now();
      if (now - (this.lastGateMessageAt || 0) > 1200) {
        this.lastGateMessageAt = now;
        const { playerPseudo, playerData, playerId } = this.getPlayerContext();
        this.scene.displayMessage(
          "Je n'ai pas de ticket, je devrais vérifier la machine à côté",
          playerPseudo
        );
        void this.startQuestIfMissing({ playerData, playerId });
      }

      // Reposition to last safe spot so we don't get stuck jittering in the collider.
      try {
        const p = this.scene.playerManager?.getPlayer();
        if (p && this.lastSafePos) {
          p.setVelocity(0, 0);
          p.x = this.lastSafePos.x;
          p.y = this.lastSafePos.y;
        }
      } catch (e) {}
    });
  }

  update() {
    const mapKey = this.mapManager?.map?.key || this.scene.registry.get('currentMapKey') || '';
    if (mapKey !== 'metro') return;

    const player = this.scene.playerManager?.getPlayer();
    if (!player) return;

    // Track last safe position (outside the gate tile).
    try {
      const tileX = Math.floor(player.x / 48);
      const tileY = Math.floor(player.y / 48);
      const isOnGateTile = tileX === 21 && tileY === 24;

      if (!isOnGateTile && !(this.scene.uiManager && this.scene.uiManager.isDialogueActive)) {
        this.lastSafePos = { x: player.x, y: player.y };
      }
    } catch (e) {}
  }

  handleNPCInteraction(npc) {
    if (!npc || npc.npcType !== 'ticket_machine') return false;

    const { playerData, playerId } = this.getPlayerContext();
    if (!playerData) return true;

    // Si la quête est à l'étape 1 (index 0), passer à l'étape 2 (index 1)
    const step = playerData.quests?.[this.questId];
    if (step === 0) {
      void this.advanceQuestByOne({ playerId, playerData });
    }

    if (this.isPinCodeActive || this.scene.scene.isActive('PinCodeScene')) {
      return true;
    }

    // IMPORTANT: pause GameScene et ouvrir PinCodeScene
    this.isPinCodeActive = true;

    // Safety: close any existing dialogue before pausing
    try {
      if (typeof this.scene?.forceCloseDialogue === 'function') {
        this.scene.forceCloseDialogue({ clearQueue: true });
      }
    } catch (e) {}

    this.scene.scene.launch('PinCodeScene', {
      targetCode: '1234',
      onSuccess: async () => {
        this.isPinCodeActive = false;
        this.scene.scene.resume('GameScene');

        // Donne le ticket
        this.scene.addItemToInventory({ nom: 'ticket de métro', quantite: 1, isKeyItem: true, type: 'key_items' });

        // Si quête à l'étape 3 (index 2), terminer la quête
        const latestPlayerData = this.scene.registry.get('playerData');
        const latestStep = latestPlayerData?.quests?.[this.questId];
        if (latestStep === 2) {
          await this.completeQuest({ playerId, playerData: latestPlayerData });
        }
      },
      onFailure: () => {
        this.isPinCodeActive = false;
        this.scene.scene.resume('GameScene');
      }
    });

    this.scene.scene.pause('GameScene');
    return true;
  }
}
