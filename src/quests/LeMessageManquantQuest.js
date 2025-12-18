import { BaseQuest } from './BaseQuest';

export class LeMessageManquantQuest extends BaseQuest {
  constructor({ scene, mapManager, eventManager }) {
    super({ scene, mapManager, eventManager, questId: 'Le message manquant' });

    this.marinSparkle = null;
    this.qwestSparkle = null;

    this.isInteracting = false;
  }

  // getPlayerContext is inherited from BaseQuest

  destroyRuntimeObjects() {
    try {
      if (this.marinSparkle) this.marinSparkle.destroy();
    } catch (e) {}
    this.marinSparkle = null;

    try {
      if (this.qwestSparkle) this.qwestSparkle.destroy();
    } catch (e) {}
    this.qwestSparkle = null;

    this.isInteracting = false;
  }

  ensureSparklesRow4Anim() {
    const animKey = 'sparkles_row4_idle';
    if (!this.scene?.anims?.exists?.(animKey)) {
      this.scene.anims.create({
        key: animKey,
        frames: this.scene.anims.generateFrameNumbers('sparkles', { start: 12, end: 15 }),
        frameRate: 8,
        repeat: -1
      });
    }
    return animKey;
  }

  async startQuestIfMissing({ playerData, playerId }) {
    return super.startQuestIfMissing({
      playerData,
      playerId,
      questId: this.questId,
      showSystemMessage: false,
      logPrefix: 'LeMessageManquantQuest'
    });
  }

  async completeQuest({ playerData, playerId }) {
    return super.completeQuest({
      playerId,
      playerData,
      questId: this.questId,
      step: 1,
      logPrefix: 'LeMessageManquantQuest'
    });
  }

  spawnForMap(mapKey) {
    this.destroyRuntimeObjects();

    if (!this.scene.physics) return;

    const { playerData } = this.getPlayerContext();
    const step = playerData?.quests?.[this.questId];

    const animKey = this.ensureSparklesRow4Anim();

    // Marin: 33:9 only if player does NOT have the quest
    if (mapKey === 'marin') {
      if (step !== undefined) return;

      const x = 33 * 48;
      const y = 9 * 48;

      const sparkles = this.scene.physics.add.sprite(x, y, 'sparkles');
      sparkles.play(animKey);
      sparkles.setImmovable(true);
      sparkles.setInteractive();
      sparkles.npcType = 'marin_missing_message_sparkle';
      sparkles.facePlayerOnInteract = false;
      try {
        sparkles.body.setSize(48, 48);
        sparkles.body.setOffset(8, 8);
      } catch (e) {}

      this.marinSparkle = sparkles;
      this.eventManager.activeEvents.push(sparkles);
      return;
    }

    // Qwest: 13:14 only if player HAS the quest at step 0
    if (mapKey === 'qwest') {
      if (step === undefined || Number(step) >= 1) return;

      const x = 13 * 48;
      const y = 14 * 48-12;

      const sparkles = this.scene.physics.add.sprite(x, y, 'sparkles');
      sparkles.play(animKey);
      sparkles.setImmovable(true);
      sparkles.setInteractive();
      sparkles.npcType = 'qwest_missing_message_sparkle';
      sparkles.facePlayerOnInteract = false;
      try {
        sparkles.body.setSize(32, 32);
        sparkles.body.setOffset(8, 8);
      } catch (e) {}

      this.qwestSparkle = sparkles;
      this.eventManager.activeEvents.push(sparkles);
      return;
    }
  }

  removeEventSprite(sprite) {
    if (!sprite) return;

    try {
      if (this.eventManager?.activeEvents) {
        this.eventManager.activeEvents = (this.eventManager.activeEvents || []).filter((ev) => ev !== sprite);
      }
    } catch (e) {}

    try {
      sprite.destroy();
    } catch (e) {}
  }

  handleNPCInteraction(npc) {
    if (!npc) return false;

    if (npc.npcType !== 'marin_missing_message_sparkle' && npc.npcType !== 'qwest_missing_message_sparkle') {
      return false;
    }

    if (this.isInteracting) return true;
    this.isInteracting = true;

    const { playerPseudo, playerData, playerId } = this.getPlayerContext();

    if (npc.npcType === 'marin_missing_message_sparkle') {
      const step = playerData?.quests?.[this.questId];
      if (step !== undefined) {
        this.isInteracting = false;
        this.removeEventSprite(npc);
        return true;
      }

      const line1 = "Mmh, j'ai reçu un message sur discord  : c'est écrit:";
      const line2 = "\"J'ai caché quelque chose, laisse moi te dire où c'est : \"";
      const line3 = "Y'a pas d'autres messages mais je vois la notif qu'il est en train d'écrire.";
      const line4 = "Peut-être il y a un moyen de savoir ce qu'il allait envoyer.";

      this.scene.displayMessage(line1, playerPseudo, () => {
        this.scene.displayMessage(line2, playerPseudo, () => {
          this.scene.displayMessage(line3, playerPseudo, () => {
            this.scene.displayMessage(line4, playerPseudo, () => {
                void (async () => {
                await this.startQuestIfMissing({ playerData, playerId });
                this.removeEventSprite(npc);
                this.isInteracting = false;
                })();
            });
          });
        });
      });

      return true;
    }

    // qwest_missing_message_sparkle
    const step = playerData?.quests?.[this.questId];
    if (step === undefined || Number(step) >= 1) {
      this.isInteracting = false;
      this.removeEventSprite(npc);
      return true;
    }

    const reveal = "Le message est \"Quel grand carton ! Pratique pour planquer des choses !\"";
    this.scene.displayMessage(reveal, playerPseudo, () => {
      void (async () => {
        await this.advanceQuest({ playerId, playerData, step: 2 });
        await this.completeQuest({ playerData, playerId });
        this.removeEventSprite(npc);
        this.isInteracting = false;
      })();
    });

    return true;
  }
}
