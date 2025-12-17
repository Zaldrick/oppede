/**
 * Wild encounter tables (server)
 *
 * Structure:
 * {
 *   tableId: {
 *     entries: [
 *       { speciesId: number, weight: number, minLevel?: number, maxLevel?: number }
 *     ]
 *   }
 * }
 */

const WILD_ENCOUNTER_TABLES = {
  douai_marchienne: {
    entries: [
      // Commun (facile à rencontrer)
      { speciesId: 19, weight: 40, minLevel: 2, maxLevel: 4 },  // Rattata
      { speciesId: 16, weight: 35, minLevel: 2, maxLevel: 5 },  // Pidgey
      { speciesId: 41, weight: 20, minLevel: 3, maxLevel: 6 },  // Zubat

      // Rare (pour valider que le tirage pondéré marche)
      { speciesId: 133, weight: 4, minLevel: 5, maxLevel: 7 },  // Eevee
      { speciesId: 142, weight: 1, minLevel: 10, maxLevel: 12 } // Aerodactyl
    ]
  },
  // Exemple (à adapter):
  // "lille_grass_1": {
  //   entries: [
  //     { speciesId: 50, weight: 80, minLevel: 3, maxLevel: 6 },
  //     { speciesId: 51, weight: 18, minLevel: 4, maxLevel: 7 },
  //     { speciesId: 142, weight: 2, minLevel: 10, maxLevel: 12 }
  //   ]
  // }
};

function pickFromEncounterTable(tableId) {
  const table = tableId ? WILD_ENCOUNTER_TABLES[String(tableId)] : null;
  const entries = Array.isArray(table?.entries) ? table.entries : null;
  if (!entries || entries.length === 0) return null;

  let total = 0;
  for (const e of entries) {
    const w = Number(e?.weight);
    if (Number.isFinite(w) && w > 0) total += w;
  }
  if (total <= 0) return null;

  let r = Math.random() * total;
  for (const e of entries) {
    const w = Number(e?.weight);
    if (!Number.isFinite(w) || w <= 0) continue;
    r -= w;
    if (r <= 0) return e;
  }

  return entries[entries.length - 1] || null;
}

module.exports = {
  WILD_ENCOUNTER_TABLES,
  pickFromEncounterTable
};
