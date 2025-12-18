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
      { speciesId: 19, weight: 40, minLevel: 7, maxLevel: 9 },  // Rattata
      { speciesId: 16, weight: 35, minLevel: 7, maxLevel: 9 },  // Pidgey
      { speciesId: 41, weight: 20, minLevel: 7, maxLevel: 9 },  // Zubat

      // Rare (pour valider que le tirage pondéré marche)
      { speciesId: 133, weight: 4, minLevel: 9, maxLevel: 10 },  // Eevee
      { speciesId: 142, weight: 1, minLevel: 10, maxLevel: 12 } // Aerodactyl
    ]
  },
  // Exemple (à adapter):
  lille: {
     entries: [
     { speciesId: 56, weight: 20, minLevel: 3, maxLevel: 6 },
       { speciesId: 51, weight: 30, minLevel: 3, maxLevel: 5 },
       { speciesId: 43, weight: 35, minLevel: 4, maxLevel: 6 }
     ]
   },
  // Exemple (à adapter):
  marin_jardin: {
     entries: [
     { speciesId: 1, weight: 100, minLevel: 12, maxLevel: 13 }
     ]
   }
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
