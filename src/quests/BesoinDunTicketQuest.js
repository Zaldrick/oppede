import { BaseQuest } from './BaseQuest';

export class BesoinDunTicketQuest extends BaseQuest {
  constructor({ scene, mapManager, eventManager }) {
    super({ scene, mapManager, eventManager, questId: "Besoin d'un ticket" });

    // Runtime objects
    this.machineNpcs = [];
    this.gateBlocker = null;
    this.gateCollider = null;

    this.isPinCodeActive = false;

    // Anti-spam
    this.lastGateMessageAt = 0;

    // Safe reposition
    this.lastSafePos = null;
  }

  // getPlayerContext is inherited from BaseQuest

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

    // machineNpcs are in activeEvents and will also be cleared there,
    // but destroy them here as well to avoid duplicates.
    try {
      if (Array.isArray(this.machineNpcs)) {
        this.machineNpcs.forEach((z) => {
          try { if (z) z.destroy(); } catch (e) {}
        });
      }
    } catch (e) {}
    this.machineNpcs = [];

    this.lastSafePos = null;
    this.isPinCodeActive = false;
  }

  async startQuestIfMissing({ playerData, playerId }) {
    return super.startQuestIfMissing({
      playerData,
      playerId,
      questId: this.questId,
      showSystemMessage: true,
      logPrefix: 'BesoinDunTicketQuest'
    });
  }

  async advanceQuestByOne({ playerId, playerData }) {
    return super.advanceQuest({
      playerId,
      playerData,
      questId: this.questId,
      // step omitted => +1
      logPrefix: 'BesoinDunTicketQuest'
    });
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

    await super.completeQuest({
      playerId,
      playerData,
      questId: this.questId,
      step: targetLastIndex,
      logPrefix: 'BesoinDunTicketQuest'
    });
  }

  spawnForMap(mapKey) {
    // Always cleanup to avoid duplicates on map changes.
    this.destroyRuntimeObjects();

    if (mapKey !== 'metro') return;

    const player = this.scene.playerManager?.getPlayer();
    if (!player || !this.scene.physics) return;

    // --- Machine à ticket (interaction) ---
    // Rendre l'interaction possible depuis les cases 25:21, 26:21, 27:21, 28:21.
    // Le système de détection (proximité) marche mieux avec des zones centrées par tuile.
    const machineTileY = 21;
    const machineTileXs = [25, 26, 27, 28];
    const machineY = machineTileY * 48 + 24;

    this.machineNpcs = machineTileXs.map((tx) => {
      const machineX = tx * 48 + 24;
      const z = this.scene.add.zone(machineX, machineY, 48, 48);
      z.setOrigin(0.5);
      z.npcType = 'ticket_machine';
      z.npcName = 'Machine';
      z.facePlayerOnInteract = false;
      z.setInteractive();
      // Needed for getNearbyEventObject
      this.eventManager.activeEvents.push(z);
      return z;
    });

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

        // La quête doit progresser jusqu'à l'étape finale et se terminer
        // dès que la machine est déverrouillée et que le ticket est récupéré.
        const latestPlayerData = this.scene.registry.get('playerData') || playerData;
        try {
          await this.startQuestIfMissing({ playerData: latestPlayerData, playerId });
        } catch (e) {}

        try {
          await this.completeQuest({ playerId, playerData: latestPlayerData });
        } catch (e) {}
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
