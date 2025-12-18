import Phaser from 'phaser';

/**
 * WildEncounterManager (client)
 * - Lit des zones "encounter" depuis les object layers Tiled
 * - Accumule la distance parcourue DANS une zone
 * - Lance un combat sauvage quand un tirage passe
 *
 * Propriétés Tiled attendues sur chaque rectangle:
 * - encounterTableId (string) : identifiant de table (ex: "lille_grass_1")
 * - encounterRate (number)    : probabilité en % par "pas" (voir encounterStepPx)
 * Optionnel:
 * - encounterStepPx (number)  : distance (px) correspondant à 1 tirage (défaut 48)
 * - encounterCooldownMs (number) : cooldown après rencontre (défaut 2500)
 */
export class WildEncounterManager {
  constructor(scene, mapManager) {
    this.scene = scene;
    this.mapManager = mapManager;

    this.zones = [];

    this.lastX = null;
    this.lastY = null;
    this.distanceAccumulatorPx = 0;

    this.lastEncounterAtMs = 0;
    this.activeZoneKey = null;
  }

  clear() {
    this.zones = [];
    this.lastX = null;
    this.lastY = null;
    this.distanceAccumulatorPx = 0;
    this.activeZoneKey = null;
  }

  loadZonesFromCurrentMap() {
    this.clear();

    const map = this.mapManager?.map;
    if (!map || !map.objects) return;

    for (const layerData of map.objects) {
      // On ne dépend pas du nom du layer: on prend toute shape qui a encounterTableId.
      const objects = Array.isArray(layerData?.objects) ? layerData.objects : [];

      for (const obj of objects) {
        if (!obj || obj.gid) continue;
        if (obj.width == null || obj.height == null) continue;

        const props = this._getTiledProperties(obj);
        const encounterTableId = props.encounterTableId;
        const encounterRate = this._toNumber(props.encounterRate);

        if (!encounterTableId || !Number.isFinite(encounterRate)) continue;

        // Tiled rectangle: x,y = top-left (object layer rectangles)
        const rect = new Phaser.Geom.Rectangle(obj.x, obj.y, obj.width, obj.height);
        const encounterStepPx = this._toNumber(props.encounterStepPx);
        const encounterCooldownMs = this._toNumber(props.encounterCooldownMs);

        this.zones.push({
          layerName: layerData?.name || null,
          name: obj?.name || null,
          rect,
          encounterTableId: String(encounterTableId),
          encounterRate: Phaser.Math.Clamp(encounterRate, 0, 100),
          encounterStepPx: Number.isFinite(encounterStepPx) && encounterStepPx > 0 ? encounterStepPx : 48,
          encounterCooldownMs: Number.isFinite(encounterCooldownMs) && encounterCooldownMs >= 0 ? encounterCooldownMs : 2500
        });
      }
    }

    // Optional: stable ordering (makes overlapping zones deterministic)
    this.zones.sort((a, b) => {
      const la = a.layerName || '';
      const lb = b.layerName || '';
      if (la !== lb) return la.localeCompare(lb);
      const na = a.name || '';
      const nb = b.name || '';
      return na.localeCompare(nb);
    });
  }

  update() {
    const scene = this.scene;
    if (!scene || !scene.sys?.isActive()) return;

    // Global toggle (set by PokemonTeamScene)
    try {
      if (scene.registry?.get?.('encountersEnabled') === false) return;
    } catch (e) {
      // ignore
    }

    // Skip if battle overlay is active
    try {
      if (scene.scene?.isActive?.('PokemonBattleScene')) return;
    } catch (e) {
      // ignore
    }

    // Block encounters if dialogue is active
    if (scene.uiManager?.isDialogueActive) return;

    // Avoid during teleport / map load
    if (this.mapManager?.isTeleporting) return;

    const player = scene.playerManager?.getPlayer?.();
    if (!player) return;

    const x = player.x;
    const y = player.y;

    if (this.lastX == null || this.lastY == null) {
      this.lastX = x;
      this.lastY = y;
      return;
    }

    const dx = x - this.lastX;
    const dy = y - this.lastY;
    this.lastX = x;
    this.lastY = y;

    const moved = Math.hypot(dx, dy);
    if (!Number.isFinite(moved) || moved <= 0.01) return;

    const zone = this._findZoneContainingPoint(x, y);
    const zoneKey = zone ? `${zone.layerName || ''}::${zone.encounterTableId}::${zone.name || ''}` : null;

    // Si on sort / change de zone, reset l'accu pour un feeling plus cohérent.
    if (zoneKey !== this.activeZoneKey) {
      this.activeZoneKey = zoneKey;
      this.distanceAccumulatorPx = 0;

      // Debug (opt-in): ?debugEncounter=1
      const debugEncounter = (() => {
        try { return new URLSearchParams(window.location.search).get('debugEncounter') === '1'; } catch (e) { return false; }
      })();
      if (debugEncounter) {
        const msg = zone
          ? `Encounter zone: ${zone.encounterTableId} (rate=${zone.encounterRate}%/step=${zone.encounterStepPx}px)`
          : 'Encounter zone: none';
        try {
          if (typeof scene.__setStatus === 'function') scene.__setStatus(msg);
        } catch (e) {}
        try { console.log('[WildEncounter]', msg); } catch (e) {}
      }
    }

    if (!zone) return;

    const now = Date.now();
    if (now - this.lastEncounterAtMs < zone.encounterCooldownMs) return;

    this.distanceAccumulatorPx += moved;

    // Tirage discret tous les encounterStepPx parcourus.
    while (this.distanceAccumulatorPx >= zone.encounterStepPx) {
      this.distanceAccumulatorPx -= zone.encounterStepPx;

      const roll = Math.random() * 100;
      if (roll < zone.encounterRate) {
        this.lastEncounterAtMs = now;
        this.distanceAccumulatorPx = 0;

        const debugEncounter = (() => {
          try { return new URLSearchParams(window.location.search).get('debugEncounter') === '1'; } catch (e) { return false; }
        })();
        if (debugEncounter) {
          const msg = `Encounter TRIGGER: ${zone.encounterTableId}`;
          try { if (typeof scene.__setStatus === 'function') scene.__setStatus(msg); } catch (e) {}
          try { console.log('[WildEncounter]', msg); } catch (e) {}
        }

        this._triggerWildBattle(zone);
        break;
      }
    }
  }

  _triggerWildBattle(zone) {
    const playerData = this.scene.registry?.get?.('playerData');
    const playerId = playerData?._id;
    if (!playerId) return;

    // If the player was holding mobile controls (joystick/B), release them before pausing.
    try { this.scene.uiManager?.resetInputs?.(); } catch (e) {}

    const returnSceneKey = this.scene.scene?.key || 'GameScene';
    try {
      if (this.scene.scene?.isActive?.(returnSceneKey)) {
        this.scene.scene.pause(returnSceneKey);
      }
    } catch (e) {
      // ignore
    }

    if (this.scene.scene?.isActive?.('PokemonBattleScene')) {
      return;
    }

    this.scene.scene.launch('PokemonBattleScene', {
      playerId,
      battleType: 'wild',
      returnScene: returnSceneKey,
      wildEncounter: {
        encounterTableId: zone.encounterTableId,
        mapKey: this.mapManager?.map?.key || null
      }
    });
  }

  _findZoneContainingPoint(x, y) {
    // Simple scan; zones expected to be few.
    for (const zone of this.zones) {
      if (Phaser.Geom.Rectangle.Contains(zone.rect, x, y)) {
        return zone;
      }
    }
    return null;
  }

  _getTiledProperties(obj) {
    // Tiled JSON export: properties: [{name,type,value}, ...]
    const out = {};
    const arr = Array.isArray(obj?.properties) ? obj.properties : [];
    for (const p of arr) {
      if (!p || !p.name) continue;
      out[p.name] = p.value;
    }
    return out;
  }

  _toNumber(v) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      return Number.isFinite(n) ? n : NaN;
    }
    return NaN;
  }
}
