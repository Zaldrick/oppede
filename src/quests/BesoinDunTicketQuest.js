import { BaseQuest } from './BaseQuest';

export class BesoinDunTicketQuest extends BaseQuest {
  constructor({ scene, mapManager, eventManager }) {
    super({ scene, mapManager, eventManager, questId: "Besoin d'un ticket" });

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
