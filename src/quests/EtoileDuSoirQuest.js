export class EtoileDuSoirQuest {
  constructor({ scene, mapManager, eventManager }) {
    this.scene = scene;
    this.mapManager = mapManager;
    this.eventManager = eventManager;

    this.questId = 'Etoile du Soir';

    // Empêche les relances de PinCodeScene pendant un enchaînement de dialogues
    this.isPinCodeActive = false;
  }

  getPlayerContext() {
    const playerPseudo = this.scene.registry.get('playerPseudo') || 'Moi';
    const playerData = this.scene.registry.get('playerData');
    const playerId = playerData ? playerData._id : null;

    if (playerData && !playerData.quests) playerData.quests = {};

    return { playerPseudo, playerData, playerId };
  }

  async startQuestIfMissing({ playerData, playerId }) {
    if (!playerData) return false;
    if (playerData.quests[this.questId] !== undefined) return false;

    // State local d'abord (évite les doubles starts si l'API est lente)
    playerData.quests[this.questId] = 0;
    this.scene.registry.set('playerData', playerData);

    // Persistance backend ensuite
    const apiUrl = process.env.REACT_APP_API_URL;
    if (apiUrl && playerId) {
      try {
        await fetch(`${apiUrl}/api/quests/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, questId: this.questId })
        });
      } catch (e) {
        console.warn('[EtoileDuSoirQuest] start failed', e);
      }
    }

    // Message uniquement si on vient vraiment d'ajouter la quête
    this.scene.displayMessage(`Quête ajoutée : ${this.questId}`, 'Système');
    return true;
  }

  async advanceQuest({ playerId, playerData, step }) {
    if (!playerData) return;

    const apiUrl = process.env.REACT_APP_API_URL;
    if (apiUrl && playerId) {
      try {
        await fetch(`${apiUrl}/api/quests/advance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, questId: this.questId })
        });
      } catch (e) {
        console.warn('[EtoileDuSoirQuest] advance failed', e);
      }
    }

    playerData.quests[this.questId] = step;
    this.scene.registry.set('playerData', playerData);
  }

  spawnForMap(mapKey) {
    if (mapKey !== 'douai') return;

    this.createSparklesEvent();
    this.createJoshNPC();
    this.createQuestChest();
  }

  handleNPCInteraction(npc) {
    if (!npc || !npc.npcType) return false;

    if (npc.npcType === 'sparkles_quest') {
      void this.handleCarInteraction();
      return true;
    }

    if (npc.npcType === 'josh_quest') {
      void this.handleJoshInteraction();
      return true;
    }

    if (npc.npcType === 'quest_chest') {
      void this.handleQuestChestInteraction(npc);
      return true;
    }

    return false;
  }

  async handleCarInteraction() {
    const { playerPseudo, playerData, playerId } = this.getPlayerContext();
    if (!playerData) return;

    const hasKeys = Array.isArray(this.scene.inventory)
      ? this.scene.inventory.some((item) => item && item.nom === 'Clés de voiture')
      : false;

    if (!hasKeys) {
      this.scene.displayMessage(
        "Je dois d'abord récupérer les clés au magasin à coté, j'espère qu'elles sont réparées",
        playerPseudo
      );

      await this.startQuestIfMissing({ playerData, playerId });
      return;
    }

    const questStep = playerData.quests[this.questId];
    if (questStep >= 3) {

      const doCarTeleport = async () => {
        try {
          this.scene.sound.play('car_start');
        } catch (e) {
          console.warn('Sound car_start not found');
        }

        this.scene.time.delayedCall(1000, () => {
          this.mapManager.changeMap('qwest', 14 * 48 + 24, 21 * 48);
        });
      };

      // Si on est à l'étape 3, on doit attendre la fermeture du dialogue avant de téléporter
      if (questStep === 3) {
        this.scene.displayMessage(
          "Hmm c'est bizarre, c'est comme si il y avait quelque chose de caché dans la pochette arrière du siège passager",
          playerPseudo,
          async () => {
            await this.advanceQuest({ playerId, playerData, step: 4 });
            await doCarTeleport();
          }
        );
        return;
      }

      // Étape > 3 : pas de dialogue, on peut téléporter directement
      await doCarTeleport();
    } else {
      this.scene.displayMessage('La voiture est verrouillée.', playerPseudo);
    }
  }

  async handleJoshInteraction() {
    const { playerData, playerId } = this.getPlayerContext();
    if (!playerData) return;

    // Si on parle à Josh en premier, on démarre la quête
    if (playerData.quests[this.questId] === undefined) {
      await this.startQuestIfMissing({ playerData, playerId });
    }

    const questStep = playerData.quests[this.questId];

    if (questStep >= 3) {
      this.scene.displayMessage('Bien joué !', 'Réparateur');
      return;
    }

    this.scene.displayMessage(
      "Ah j'ai réparé tes clés ! Par contre je les ai laissés dans ce coffre et je ne me souviens plus du code...",
      'Réparateur',
      () => {
        this.scene.displayMessage(
          "Je sais juste que c'est 3 chiffres et qu'il y a un 6 et un 9 dedans. J'ai laissé un mémo sur le coffre mais je ne sais pas lire.",
          'Réparateur'
        );
      }
    );

    if (questStep === 0) {
      await this.advanceQuest({ playerId, playerData, step: 1 });
    }
  }

  async handleQuestChestInteraction(chestNpc) {
    const { playerPseudo, playerData, playerId } = this.getPlayerContext();
    if (!playerData) return;

    const questStep = playerData.quests[this.questId] || 0;

    if (questStep === 1 || questStep === 2) {
      if (this.isPinCodeActive || this.scene.scene.isActive('PinCodeScene')) {
        return;
      }
        await this.advanceQuest({ playerId, playerData, step: 2 });
      // IMPORTANT: on attend la fin du dialogue (fermeture) avant de lancer PinCodeScene
      this.scene.displayMessage('Un mémo est visible sur ce coffre: "Gimli ouvre la voie"', playerPseudo, () => {

        // Safety: ensure no lingering dialogue box before pausing GameScene
        try {
          if (typeof this.scene?.forceCloseDialogue === 'function') {
            this.scene.forceCloseDialogue({ clearQueue: true });
          }
        } catch (e) {}

        if (this.isPinCodeActive || this.scene.scene.isActive('PinCodeScene')) {
          return;
        }
        this.isPinCodeActive = true;

        this.scene.scene.launch('PinCodeScene', {
          targetCode: '649',
          onSuccess: async () => {
            this.isPinCodeActive = false;
            this.scene.scene.resume('GameScene');
            this.scene.displayMessage("Ca s'ouvre ! Mes clés !", playerPseudo);

            try {
              chestNpc.play('coffre_open');
            } catch (e) {}

            await this.advanceQuest({ playerId, playerData, step: 3 });

            // Donne l'item + persistance inventaire
            this.scene.addItemToInventory({ nom: 'Clés de voiture', quantite: 1, isKeyItem: true, type: 'key_items' });
          },
          onFailure: () => {
            this.isPinCodeActive = false;
            this.scene.scene.resume('GameScene');
          }
        });

        this.scene.scene.pause('GameScene');
      });
      return;
    }

    if (questStep >= 3) {
      if (chestNpc?.frame?.name !== 3 && chestNpc?.frame?.name !== '3') {
        chestNpc.setFrame(3);
      }
      this.scene.displayMessage('Le coffre est vide.', playerPseudo);
      return;
    }

    this.scene.displayMessage("C'est un coffre verrouillé.", playerPseudo);
  }

  createSparklesEvent() {
    const x = 41 * 48 + 24;
    const y = 73 * 48 + 24;

    if (!this.scene.anims.exists('sparkles_anim')) {
      this.scene.anims.create({
        key: 'sparkles_anim',
        frames: this.scene.anims.generateFrameNumbers('sparkles', { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1
      });
    }

    const sparkles = this.scene.physics.add.sprite(x, y, 'sparkles');
    sparkles.play('sparkles_anim');
    sparkles.setImmovable(true);
    sparkles.setInteractive();
    sparkles.npcType = 'sparkles_quest';

    sparkles.body.setSize(32, 32);
    sparkles.body.setOffset(8, 8);

    this.eventManager.activeEvents.push(sparkles);
  }

  createJoshNPC() {
    const x = 50 * 48 + 24;
    const y = 73 * 48 + 24;

    const josh = this.scene.physics.add.sprite(x, y - 24, 'npc_old_man_josh', 0);
    josh.body.setSize(32, 32);
    josh.body.setOffset(8, 64);
    josh.setImmovable(true);
    josh.setInteractive();
    josh.npcType = 'josh_quest';

    const animKey = 'old_man_josh_idle';
    if (!this.scene.anims.exists(animKey)) {
      this.scene.anims.create({
        key: animKey,
        frames: this.scene.anims.generateFrameNumbers('npc_old_man_josh', { start: 0, end: 3 }),
        frameRate: 4,
        repeat: -1,
        yoyo: true
      });
    }
    josh.play(animKey);

    const player = this.scene.playerManager?.getPlayer();
    if (player) {
      this.scene.physics.add.collider(player, josh);
    }

    this.eventManager.activeEvents.push(josh);
  }

  createQuestChest() {
    const x = 49 * 48 + 24;
    const y = 73 * 48 + 24;

    const chest = this.scene.physics.add.sprite(x, y, 'coffre', 0);
    chest.setImmovable(true);
    chest.setInteractive();
    chest.npcType = 'quest_chest';
    chest.facePlayerOnInteract = false;

    chest.body.setSize(32, 32);
    chest.body.setOffset(8, 16);

    if (!this.scene.anims.exists('coffre_open')) {
      this.scene.anims.create({
        key: 'coffre_open',
        frames: this.scene.anims.generateFrameNumbers('coffre', { start: 0, end: 3 }),
        frameRate: 8,
        repeat: 0
      });
    }

    const playerData = this.scene.registry.get('playerData');
    const questStep = playerData?.quests ? playerData.quests[this.questId] : 0;
    if (questStep >= 3) {
      chest.setFrame(3);
    }

    const player = this.scene.playerManager?.getPlayer();
    if (player) {
      this.scene.physics.add.collider(player, chest);
    }

    this.eventManager.activeEvents.push(chest);
  }
}
