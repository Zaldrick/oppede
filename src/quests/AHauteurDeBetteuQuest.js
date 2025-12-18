import { BaseQuest } from './BaseQuest';

export class AHauteurDeBetteuQuest extends BaseQuest {
  constructor({ scene, mapManager, eventManager }) {
    super({ scene, mapManager, eventManager, questId: 'A hauteur de betteu' });

    this.chestNpc = null;
    this.isPinCodeActive = false;
  }

  destroyRuntimeObjects() {
    try {
      if (this.chestNpc) this.chestNpc.destroy();
    } catch (e) {}
    this.chestNpc = null;
    this.isPinCodeActive = false;
  }

  ensureChestOpenAnim() {
    try {
      if (!this.scene?.anims?.exists?.('coffre_open')) {
        this.scene.anims.create({
          key: 'coffre_open',
          frames: this.scene.anims.generateFrameNumbers('coffre', { start: 0, end: 3 }),
          frameRate: 8,
          repeat: 0
        });
      }
    } catch (e) {
      // ignore
    }
  }

  spawnForMap(mapKey) {
    this.destroyRuntimeObjects();

    if (mapKey !== 'marin') return;
    if (!this.scene?.physics) return;

    const x = 18 * 48 + 24;
    const y = 9 * 48 + 24;

    const chest = this.scene.physics.add.sprite(x, y, 'coffre', 0);
    chest.setImmovable(true);
    chest.setInteractive();
    chest.npcType = 'betteu_quest_chest';
    chest.facePlayerOnInteract = false;

    try {
      chest.body.setSize(32, 32);
      chest.body.setOffset(8, 16);
    } catch (e) {}

    this.ensureChestOpenAnim();

    const player = this.scene.playerManager?.getPlayer();
    if (player) {
      this.scene.physics.add.collider(player, chest);
    }

    // If already completed (step >= 1), show opened chest.
    const playerData = this.scene.registry.get('playerData');
    const step = Number(playerData?.quests?.[this.questId] ?? 0) || 0;
    if (playerData?.quests?.[this.questId] !== undefined && step >= 1) {
      try {
        chest.setFrame(3);
      } catch (e) {}
      chest.__opened = true;
    } else {
      chest.__opened = false;
    }

    this.chestNpc = chest;
    this.eventManager.activeEvents.push(chest);
  }

  handleNPCInteraction(npc) {
    if (!npc || npc.npcType !== 'betteu_quest_chest') return false;

    const { playerPseudo, playerData, playerId } = this.getPlayerContext();
    if (!playerData) return true;

    const step = Number(playerData?.quests?.[this.questId] ?? 0) || 0;
    const hasQuest = playerData?.quests?.[this.questId] !== undefined;

    if (hasQuest && step >= 1) {
      try {
        if (npc?.frame?.name !== 3 && npc?.frame?.name !== '3') npc.setFrame(3);
      } catch (e) {}
      this.scene.displayMessage('Le coffre est vide.', playerPseudo);
      return true;
    }

    if (this.isPinCodeActive || this.scene.scene.isActive('PinCodeScene')) {
      return true;
    }

    // Safety: close any existing dialogue before pausing
    try {
      if (typeof this.scene?.forceCloseDialogue === 'function') {
        this.scene.forceCloseDialogue({ clearQueue: true });
      }
    } catch (e) {}

    this.isPinCodeActive = true;
    this.ensureChestOpenAnim();

    this.scene.scene.launch('PinCodeScene', {
      targetCode: '13063',
      onSuccess: async () => {
        this.isPinCodeActive = false;
        this.scene.scene.resume('GameScene');

        // Open animation
        try {
          npc.__opened = true;
          npc.play('coffre_open');
          npc.once('animationcomplete', () => {
            try { npc.setFrame(3); } catch (e) {}
          });
        } catch (e) {
          try { npc.setFrame(3); } catch (err) {}
        }

        // Add quest (if missing) then mark completed at step 1
        try {
          if (!hasQuest) {
            await this.startQuestIfMissing({ playerData, playerId, questId: this.questId, showSystemMessage: false, logPrefix: 'AHauteurDeBetteuQuest' });
          }
          await this.completeQuest({ playerId, playerData, questId: this.questId, step: 1, logPrefix: 'AHauteurDeBetteuQuest' });
        } catch (e) {
          // ignore
        }

        // Reward
        this.scene.addItemToInventory({ nom: 'Super Ball', quantite: 5 });
        this.scene.displayMessage('Vous obtenez 5 Super Ball !', 'Système');

        // Note
        this.scene.displayMessage('Il y a un mot : "Dans la SdB, au fond d\'un placard..."', playerPseudo);
      },
      onFailure: async () => {
        this.isPinCodeActive = false;
        this.scene.scene.resume('GameScene');

        const latestPlayerData = this.scene.registry.get('playerData');
        const questExists = latestPlayerData?.quests?.[this.questId] !== undefined;

        if (questExists) {
          this.scene.displayMessage('Mhh, TodoList ? Comment ca ?', playerPseudo);
          return;
        }

        // First discovery: show 2 dialogue boxes, then start quest (step 0)
        this.scene.displayMessage('Il y a quelque chose de gravé sur le dessus :', playerPseudo, async () => {
          this.scene.displayMessage('∑𝑛∈Todolist', playerPseudo);
          try {
            await this.startQuestIfMissing({
              playerData: latestPlayerData,
              playerId,
              questId: this.questId,
              showSystemMessage: false,
              logPrefix: 'AHauteurDeBetteuQuest'
            });
          } catch (e) {
            // ignore
          }
        });
      }
    });

    this.scene.scene.pause('GameScene');
    return true;
  }
}
