export class QwestEvents {
  constructor({ scene, mapManager, eventManager }) {
    this.scene = scene;
    this.mapManager = mapManager;
    this.eventManager = eventManager;

    this.chestNpc = null;
    this.memoNpc = null;
    this.healNpc = null;

    this.isPinCodeActive = false;
    this.lastHealAt = 0;
  }

  getPlayerContext() {
    const playerPseudo = this.scene.registry.get('playerPseudo') || 'Moi';
    const playerData = this.scene.registry.get('playerData');
    const playerId = playerData ? playerData._id : null;

    return { playerPseudo, playerData, playerId };
  }

  destroyRuntimeObjects() {
    try {
      if (this.chestNpc) this.chestNpc.destroy();
    } catch (e) {}
    this.chestNpc = null;

    try {
      if (this.memoNpc) this.memoNpc.destroy();
    } catch (e) {}
    this.memoNpc = null;

    try {
      if (this.healNpc) this.healNpc.destroy();
    } catch (e) {}
    this.healNpc = null;

    this.isPinCodeActive = false;
    this.lastHealAt = 0;
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

  ensureChestOpenAnim() {
    try {
      if (!this.scene.anims.exists('coffre_open')) {
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

    if (mapKey !== 'qwest') return;
    if (!this.scene.physics) return;

    const { playerData } = this.getPlayerContext();

    const animKey = this.ensureSparklesRow4Anim();

    // --- PIN chest at 2:3 ---
    const chestX = 2 * 48 + 24;
    const chestY = 3 * 48 + 24;

    const chest = this.scene.physics.add.sprite(chestX, chestY, 'coffre', 0);
    chest.setImmovable(true);
    chest.setInteractive();
    chest.npcType = 'qwest_pincode_chest';
    chest.chestId = 'qwest_sirius_chest';

    // Hitbox
    try {
      chest.body.setSize(32, 32);
      chest.body.setOffset(8, 16);
    } catch (e) {}

    this.ensureChestOpenAnim();

    const opened = Array.isArray(playerData?.openedChests) && playerData.openedChests.includes(String(chest.chestId));
    chest.__opened = Boolean(opened);
    if (opened) {
      try {
        chest.setFrame(3);
      } catch (e) {}
    }

    const player = this.scene.playerManager?.getPlayer();
    if (player) {
      this.scene.physics.add.collider(player, chest);
    }

    this.chestNpc = chest;
    this.eventManager.activeEvents.push(chest);

    // --- Sparkle memo at 8:8 (row 4 idle) ---
    const memoX = 8 * 48 + 24;
    const memoY = 8 * 48 + 24;

    const sparkles = this.scene.physics.add.sprite(memoX, memoY, 'sparkles');
    sparkles.play(animKey);
    sparkles.setImmovable(true);
    sparkles.setInteractive();
    sparkles.npcType = 'qwest_memo_sparkles';
    sparkles.facePlayerOnInteract = false;
    try {
      sparkles.body.setSize(32, 32);
      sparkles.body.setOffset(8, 8);
    } catch (e) {}

    this.memoNpc = sparkles;
    this.eventManager.activeEvents.push(sparkles);

    // --- Pokémon Center sparkle at 3:2 (row 4 idle) ---
    const healX = 3 * 48 + 24;
    const healY = 2 * 48 + 24;

    const healSparkles = this.scene.physics.add.sprite(healX, healY, 'sparkles');
    healSparkles.play(animKey);
    healSparkles.setImmovable(true);
    healSparkles.setInteractive();
    healSparkles.npcType = 'qwest_pkmncenter_sparkles';
    healSparkles.facePlayerOnInteract = false;
    try {
      healSparkles.body.setSize(32, 32);
      healSparkles.body.setOffset(8, 8);
    } catch (e) {}

    this.healNpc = healSparkles;
    this.eventManager.activeEvents.push(healSparkles);
  }

  persistChestOpened({ playerId, playerData, chestId }) {
    try {
      const apiUrl = process.env.REACT_APP_API_URL;
      if (apiUrl && playerId && chestId) {
        fetch(`${apiUrl}/api/players/opened-chests/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId, chestId: String(chestId) })
        }).catch(() => {});
      }

      if (playerData && chestId) {
        const current = Array.isArray(playerData.openedChests) ? playerData.openedChests : [];
        if (!current.includes(String(chestId))) {
          const updated = { ...playerData, openedChests: [...current, String(chestId)] };
          this.scene.registry.set('playerData', updated);
        }
      }
    } catch (e) {
      // ignore
    }
  }

  async giveSiriusPokemon({ playerId }) {
    const apiUrl = process.env.REACT_APP_API_URL;
    if (!apiUrl || !playerId) return;

    // Sirius is a custom clone mapped client-side to speciesId 59 (Arcanin) via nickname.
    await fetch(`${apiUrl}/api/pokemon/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, speciesId: 59, nickname: 'Sirius' })
    }).then(async (res) => {
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${body}`);
      }
      return res.json().catch(() => null);
    });
  }

  handleNPCInteraction(npc) {
    if (!npc) return false;

    const { playerPseudo, playerData, playerId } = this.getPlayerContext();

    if (npc.npcType === 'qwest_memo_sparkles') {
      this.scene.displayMessage('Mhhh, un memo est visible : "Il y a peut-être plus que des chocolats dans ce calendrier ..."', playerPseudo);
      return true;
    }

    if (npc.npcType === 'qwest_pkmncenter_sparkles') {
      const now = Date.now();
      if (now - (this.lastHealAt || 0) < 1200) return true;
      this.lastHealAt = now;

      try {
        this.scene.sound.play('pkmncenter', { volume: 0.9 });
      } catch (e) {}

      try {
        const cam = this.scene.cameras?.main;
        if (cam) {
          cam.flash(120, 255, 255, 255);
          this.scene.time.delayedCall(180, () => cam.flash(120, 255, 255, 255));
          this.scene.time.delayedCall(360, () => cam.flash(120, 255, 255, 255));
        }
      } catch (e) {}

      const apiUrl = process.env.REACT_APP_API_URL;
      if (apiUrl && playerId) {
        fetch(`${apiUrl}/api/pokemon/team/heal-all`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId })
        }).catch(() => {});
      }

      this.scene.displayMessage('toute votre équipe a été soigné', 'Système');
      return true;
    }

    if (npc.npcType === 'qwest_pincode_chest') {
      if (npc.__opened) {
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
      this.ensureChestOpenAnim();

      this.scene.scene.launch('PinCodeScene', {
        targetCode: '10',
        onSuccess: async () => {
          this.isPinCodeActive = false;
          this.scene.scene.resume('GameScene');

          npc.__opened = true;
          this.persistChestOpened({ playerId, playerData, chestId: npc.chestId });

          try {
            npc.play('coffre_open');
            npc.once('animationcomplete', () => {
              try {
                npc.setFrame(3);
              } catch (e) {}
            });
          } catch (e) {
            try {
              npc.setFrame(3);
            } catch (err) {}
          }

          try {
            await this.giveSiriusPokemon({ playerId });
          } catch (e) {
            console.warn('[QwestEvents] giveSiriusPokemon failed:', e);
          }

          try {
            this.scene.addItemToInventory({ nom: 'Potion', quantite: 10 });
          } catch (e) {
            console.warn('[QwestEvents] addItemToInventory failed:', e);
          }

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
