export class LushMaisPasTropQuest {
  constructor({ scene, mapManager, eventManager }) {
    this.scene = scene;
    this.mapManager = mapManager;
    this.eventManager = eventManager;

    this.questId = 'Lush mais pas trop';

    this.sparkle = null;
    this.isPinCodeActive = false;
  }

  getPlayerContext() {
    const playerPseudo = this.scene.registry.get('playerPseudo') || 'Moi';
    const playerData = this.scene.registry.get('playerData');
    const playerId = playerData ? playerData._id : null;

    if (playerData && !playerData.quests) playerData.quests = {};

    return { playerPseudo, playerData, playerId };
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

  destroyRuntimeObjects() {
    try {
      if (this.sparkle) this.sparkle.destroy();
    } catch (e) {}
    this.sparkle = null;
    this.isPinCodeActive = false;
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
        console.warn('[LushMaisPasTropQuest] start failed', e);
      }
    }

    return true;
  }

  async completeQuest({ playerData, playerId }) {
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
        console.warn('[LushMaisPasTropQuest] complete failed', e);
      }
    }

    if (!playerData.quests) playerData.quests = {};
    playerData.quests[this.questId] = 1;
    this.scene.registry.set('playerData', playerData);
  }

  spawnForMap(mapKey) {
    this.destroyRuntimeObjects();

    if (mapKey !== 'marin') return;
    if (!this.scene.physics) return;

    const { playerData } = this.getPlayerContext();
    const step = playerData?.quests?.[this.questId];
    if (step !== undefined && Number(step) >= 1) {
      // quête déjà terminée -> event absent
      return;
    }

    const animKey = this.ensureSparklesRow4Anim();

    const x = 18 * 48 + 24;
    const y = 2 * 48 + 24;

    const sparkles = this.scene.physics.add.sprite(x, y, 'sparkles');
    sparkles.play(animKey);
    sparkles.setImmovable(true);
    sparkles.setInteractive();
    sparkles.npcType = 'marin_fridge_pin_sparkle';
    sparkles.facePlayerOnInteract = false;
    try {
      sparkles.body.setSize(32, 32);
      sparkles.body.setOffset(8, 8);
    } catch (e) {}

    this.sparkle = sparkles;
    this.eventManager.activeEvents.push(sparkles);
  }

  handleNPCInteraction(npc) {
    if (!npc) return false;
    if (npc.npcType !== 'marin_fridge_pin_sparkle') return false;

    const { playerPseudo, playerData, playerId } = this.getPlayerContext();

    // déjà fini -> on enlève l'event si jamais il traîne
    const step = playerData?.quests?.[this.questId];
    if (step !== undefined && Number(step) >= 1) {
      this.removeEventSprite(npc);
      return true;
    }

    if (this.isPinCodeActive || this.scene.scene.isActive('PinCodeScene')) {
      return true;
    }

    // Close any existing dialogue before pausing
    try {
      if (typeof this.scene?.forceCloseDialogue === 'function') {
        this.scene.forceCloseDialogue({ clearQueue: true });
      }
    } catch (e) {}

    this.isPinCodeActive = true;

    this.scene.scene.launch('PinCodeScene', {
      targetCode: '2204',
      onSuccess: async () => {
        this.isPinCodeActive = false;
        this.scene.scene.resume('GameScene');

        // Si le joueur n'a pas la quête, on l'ajoute, puis on la termine direct
        try {
          await this.startQuestIfMissing({ playerData, playerId });
          await this.completeQuest({ playerData, playerId });
        } catch (e) {
          // ignore
        }

        this.scene.displayMessage("C'est ouvert ! Il y a quelque chose au dessus du frigo ??", playerPseudo);

        // Une fois terminé, l'event disparaît
        this.removeEventSprite(npc);
      },
      onFailure: () => {
        this.isPinCodeActive = false;
        this.scene.scene.resume('GameScene');

        const hasQuest = playerData?.quests?.[this.questId] !== undefined;

        if (hasQuest) {
          this.scene.displayMessage('Il y a certainement un indice sur une photo ...', playerPseudo);
          return;
        }

        const line1 = "Putain mais meme sur mon frigo y'a un code pin quoi.";
        const line2 = "Mhhh, c'est bizarre, sur le frigo est accroché les derniers selfies qu'il m'a envoyé, peut-être qu'il y a un indice parmis elles ...";

        this.scene.displayMessage(line1, playerPseudo, () => {
          this.scene.displayMessage(line2, playerPseudo, () => {
            void this.startQuestIfMissing({ playerData, playerId }).finally(() => {
              // keep event available (needs pin to complete)
            });
          });
        });
      }
    });

    this.scene.scene.pause('GameScene');
    return true;
  }
}
