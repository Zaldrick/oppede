export class RentrerALaMaisonQuest {
  constructor({ scene, mapManager, eventManager }) {
    this.scene = scene;
    this.mapManager = mapManager;
    this.eventManager = eventManager;

    this.homeQuestId = 'Rentrer à la maison';
    this.prepQuestId = 'Se préparer';

    // Runtime objects (qwest)
    this.arrivalHandled = false;

    this.gateBlocker = null;
    this.gateCollider = null;
    this.lastSafePos = null;
    this.lastGateMessageAt = 0;
    this.isResolvingGate = false;

    this.chestNpc = null;
    this.chestOpened = false;

    this.memoNpc = null;

    this.healNpc = null;
    this.lastHealAt = 0;

    this.isPinCodeActive = false;
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

    try {
      if (this.chestNpc) this.chestNpc.destroy();
    } catch (e) {}
    this.chestNpc = null;
    this.chestOpened = false;

    try {
      if (this.memoNpc) this.memoNpc.destroy();
    } catch (e) {}
    this.memoNpc = null;

    try {
      if (this.healNpc) this.healNpc.destroy();
    } catch (e) {}
    this.healNpc = null;
    this.lastHealAt = 0;

    this.arrivalHandled = false;
    this.lastSafePos = null;
    this.lastGateMessageAt = 0;
    this.isResolvingGate = false;
    this.isPinCodeActive = false;
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
    // Always cleanup to avoid duplicates on map changes.
    this.destroyRuntimeObjects();

    if (!this.scene.physics) return;

    // Completing "Rentrer à la maison" when first arriving on marin.
    if (mapKey === 'marin') {
      const { playerData, playerId } = this.getPlayerContext();
      const step = playerData?.quests?.[this.homeQuestId];
      if (playerData && step !== undefined && Number(step) < 1) {
        void this.completeQuest({ playerId, playerData, questId: this.homeQuestId, lastIndex: 1 });
      }
      return;
    }

    if (mapKey !== 'qwest') return;

    const player = this.getPlayer();
    if (!player) return;

    // Track safe pos
    this.lastSafePos = { x: player.x, y: player.y };

    // --- Gate blocker at 15:5 ---
    const gateX = 15 * 48 + 24;
    const gateY = 5 * 48 + 24;

    const blocker = this.scene.add.zone(gateX, gateY, 48, 48);
    blocker.setOrigin(0.5);
    this.scene.physics.add.existing(blocker, true);
    this.gateBlocker = blocker;

    this.gateCollider = this.scene.physics.add.collider(player, blocker, () => {
      const { playerPseudo, playerData, playerId } = this.getPlayerContext();

      // If already prepared, let pass (remove gate)
      const prepStep = playerData?.quests?.[this.prepQuestId];
      if (prepStep !== undefined && Number(prepStep) >= 1) {
        this.destroyRuntimeObjects();
        return;
      }

      // Avoid re-entrancy spam
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
        const hasPokemon = await this.hasAnyPokemon({ playerId });

        if (hasPokemon) {
          // Resolve "Se préparer" and open the gate
          if (playerData && (playerData.quests?.[this.prepQuestId] !== undefined) && Number(playerData.quests[this.prepQuestId]) < 1) {
            await this.completeQuest({ playerId, playerData, questId: this.prepQuestId, lastIndex: 1 });
          }
          this.destroyRuntimeObjects();
          this.isResolvingGate = false;
          return;
        }

        const now = Date.now();
        if (now - (this.lastGateMessageAt || 0) > 1200) {
          this.lastGateMessageAt = now;
          this.scene.displayMessage("Il me faut au moins un Pokémon avant d'aller plus loin.", playerPseudo);
        }

        this.isResolvingGate = false;
      })();
    });

    // --- PIN chest at 2:3 ---
    const chestX = 2 * 48 + 24;
    const chestY = 3 * 48 + 24;

    const chest = this.scene.physics.add.sprite(chestX, chestY, 'coffre', 0);
    chest.setImmovable(true);
    chest.setInteractive();
    chest.npcType = 'qwest_pincode_chest';
    this.chestNpc = chest;
    this.eventManager.activeEvents.push(chest);

    // --- Sparkle memo at 8:8 (4th row idle) ---
    const memoX = 8 * 48 + 24;
    const memoY = 8 * 48 + 24;

    const animKey = 'sparkles_row4_idle';
    if (!this.scene.anims.exists(animKey)) {
      this.scene.anims.create({
        key: animKey,
        frames: this.scene.anims.generateFrameNumbers('sparkles', { start: 12, end: 15 }),
        frameRate: 8,
        repeat: -1
      });
    }

    const sparkles = this.scene.physics.add.sprite(memoX, memoY, 'sparkles');
    sparkles.play(animKey);
    sparkles.setImmovable(true);
    sparkles.setInteractive();
    sparkles.npcType = 'qwest_memo_sparkles';
    sparkles.facePlayerOnInteract = false;
    sparkles.body.setSize(32, 32);
    sparkles.body.setOffset(8, 8);

    this.memoNpc = sparkles;
    this.eventManager.activeEvents.push(sparkles);

    // --- Pokémon Center sparkle at 3:2 (4th row idle) ---
    const healX = 3 * 48 + 24;
    const healY = 2 * 48 + 24;

    const healSparkles = this.scene.physics.add.sprite(healX, healY, 'sparkles');
    healSparkles.play(animKey);
    healSparkles.setImmovable(true);
    healSparkles.setInteractive();
    healSparkles.npcType = 'qwest_pkmncenter_sparkles';
    healSparkles.facePlayerOnInteract = false;
    healSparkles.body.setSize(32, 32);
    healSparkles.body.setOffset(8, 8);

    this.healNpc = healSparkles;
    this.eventManager.activeEvents.push(healSparkles);
  }

  update() {
    const mapKey = this.getCurrentMapKey();
    const player = this.getPlayer();
    if (!player) return;

    if (mapKey === 'qwest') {
      // Track last safe position (outside the gate tile)
      try {
        const tile = this.getTilePos();
        if (tile) {
          const isOnGateTile = tile.tileX === 15 && tile.tileY === 5;
          if (!isOnGateTile && !(this.scene.uiManager && this.scene.uiManager.isDialogueActive)) {
            this.lastSafePos = { x: player.x, y: player.y };
          }
        }
      } catch (e) {}

      // Arrival trigger at 3:4
      try {
        const tile = this.getTilePos();
        if (tile && tile.tileX === 3 && tile.tileY === 4 && !this.arrivalHandled) {
          const { playerPseudo, playerData, playerId } = this.getPlayerContext();
          const hadHome = playerData?.quests?.[this.homeQuestId] !== undefined;

          if (!hadHome) {
            this.arrivalHandled = true;
            void (async () => {
              await this.startQuestIfMissing({ playerData, playerId, questId: this.homeQuestId });
              await this.startQuestIfMissing({ playerData, playerId, questId: this.prepQuestId });
              this.scene.displayMessage('Je suis enfin arrivé à la maison.', playerPseudo);
            })();
          } else {
            this.arrivalHandled = true;
          }
        }
      } catch (e) {}
    }
  }

  handleNPCInteraction(npc) {
    if (!npc) return false;

    const { playerPseudo } = this.getPlayerContext();

    if (npc.npcType === 'qwest_memo_sparkles') {
      this.scene.displayMessage("Un mémo est posé là... Je devrais le lire.", playerPseudo);
      return true;
    }

    if (npc.npcType === 'qwest_pkmncenter_sparkles') {
      const now = Date.now();
      if (now - (this.lastHealAt || 0) < 1200) return true;
      this.lastHealAt = now;

      // Play sound
      try {
        this.scene.sound.play('pkmncenter', { volume: 0.9 });
      } catch (e) {}

      // White flashes
      try {
        const cam = this.scene.cameras?.main;
        if (cam) {
          cam.flash(120, 255, 255, 255);
          this.scene.time.delayedCall(180, () => cam.flash(120, 255, 255, 255));
          this.scene.time.delayedCall(360, () => cam.flash(120, 255, 255, 255));
        }
      } catch (e) {}

      // Heal team (server-side), then message
      const { playerId } = this.getPlayerContext();
      const apiUrl = process.env.REACT_APP_API_URL;
      if (apiUrl && playerId) {
        fetch(`${apiUrl}/api/pokemon/team/heal-all`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId })
        }).catch(() => {});
      }

      this.scene.displayMessage("toute votre équipe a été soigné", 'Système');
      return true;
    }

    if (npc.npcType === 'qwest_pincode_chest') {
      if (this.chestOpened) {
        this.scene.displayMessage('Ce coffre est déjà ouvert !', playerPseudo);
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

      // Ensure chest open animation exists
      try {
        if (!this.scene.anims.exists('coffre_open')) {
          this.scene.anims.create({
            key: 'coffre_open',
            frames: this.scene.anims.generateFrameNumbers('coffre', { start: 0, end: 3 }),
            frameRate: 8,
            repeat: 0
          });
        }
      } catch (e) {}

      this.scene.scene.launch('PinCodeScene', {
        targetCode: '10',
        onSuccess: async () => {
          this.isPinCodeActive = false;
          this.scene.scene.resume('GameScene');

          this.chestOpened = true;
          try {
            npc.play('coffre_open');
            npc.once('animationcomplete', () => {
              try {
                npc.setFrame(3);
              } catch (e) {}
            });
          } catch (e) {}

          // Rewards
          this.scene.addItemToInventory({ nom: 'Sirius', quantite: 1 });
          this.scene.addItemToInventory({ nom: 'Potion', quantite: 10 });

          this.scene.displayMessage('Vous obtenez Sirius et 10 potions !', 'Système');
        },
        onFailure: () => {
          this.isPinCodeActive = false;
          this.scene.scene.resume('GameScene');
          this.scene.displayMessage('Je devrais peut-être fouiller un peu ...', playerPseudo);
        }
      });

      this.scene.scene.pause('GameScene');
      return true;
    }

    return false;
  }
}
