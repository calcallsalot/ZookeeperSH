function countsAsFascistForVicar(role) {
  if (!role || typeof role !== "object") return false;

  // Special register rules (keep aligned with investigation logic).
  // Grandma registers as Liberal for investigations/info.
  if (role.id === "Grandma") return false;

  // Future-proofing: some roles may be able to "register" as another team/group.
  // If that ever becomes part of the role object, honor it here.
  const registerGroup =
    role.registerAsGroup ?? role.registerGroup ?? role.registerAs?.group ?? role.registerAs?.registerGroup ?? null;
  if (registerGroup === "agent" || registerGroup === "dictator") return true;
  if (registerGroup === "loyalist" || registerGroup === "dissident") return false;

  const registerAlignment =
    role.registerAsAlignment ??
    role.registerAlignment ??
    role.registerAs?.alignment ??
    role.registerAs?.registerAlignment ??
    null;
  if (registerAlignment === "fascist") return true;
  if (registerAlignment === "liberal") return false;

  if (role.alignment === "fascist") return true;
  if (role.alignment === "liberal") return false;

  const g = role.group;
  if (g === "agent" || g === "dictator") return true;
  if (g === "loyalist" || g === "dissident") return false;

  return false;
}

function shuffleCopy(arr) {
  const a = Array.isArray(arr) ? arr.slice() : [];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickDistinct(pool, k) {
  const list = Array.isArray(pool) ? pool : [];
  const count = Number(k);
  if (!Number.isFinite(count) || count <= 0) return [];
  if (list.length <= count) return list.slice();
  return shuffleCopy(list).slice(0, count);
}

function buildVicarClueText(candidateSeats) {
  const seats = Array.isArray(candidateSeats) ? candidateSeats : [];
  if (seats.length === 0) return "Vicar info: inconclusive.";
  return `Vicar info: Exactly one of seats ${seats.join(", ")} is fascist.`;
}

/**
 * Vicar starting clue.
 *
 * Returns an object like:
 *   { candidateSeats: [2, 5, 7] }
 * Meaning: exactly one of those seats is Fascist.
 */
function getStartingFascistClue({ roleBySeat, seatCount, vicarSeat, learningRumors }) {
  const n = Number(seatCount ?? 0);
  if (!Number.isFinite(n) || n <= 0) return null;

  const v = Number(vicarSeat);
  const hasVicarSeat = Number.isFinite(v) && v >= 1 && v <= n;

  // Prefer not to include the Vicar themself in their own list (keeps it 3 unknowns).
  let eligible = [];
  for (let s = 1; s <= n; s += 1) {
    if (hasVicarSeat && s === v) continue;
    eligible.push(s);
  }
  if (eligible.length < 3) {
    // Fallback (very small games): allow including the Vicar.
    eligible = [];
    for (let s = 1; s <= n; s += 1) eligible.push(s);
  }
  if (eligible.length < 3) return null;

  const fascistSeats = [];
  const nonFascistSeats = [];
  for (const s of eligible) {
    if (countsAsFascistForVicar(roleBySeat?.[s])) fascistSeats.push(s);
    else nonFascistSeats.push(s);
  }

  // Truth requires 1 fascist + 2 non-fascists.
  if (fascistSeats.length === 0 || nonFascistSeats.length < 2) return null;

  const truth = {
    candidateSeats: [...pickDistinct(fascistSeats, 1), ...pickDistinct(nonFascistSeats, 2)].sort((a, b) => a - b),
  };
  if (!learningRumors) return truth;

  // Rumorize by (if possible) returning a 3-seat set that does NOT contain exactly one Fascist.
  const f = fascistSeats.length;
  const l = nonFascistSeats.length;
  const minPossible = Math.max(0, 3 - l);
  const maxPossible = Math.min(3, f);

  const options = [];
  for (let i = minPossible; i <= maxPossible; i += 1) {
    if (i !== 1) options.push(i);
  }
  if (options.length === 0) return truth;

  const rumorFascists = options[Math.floor(Math.random() * options.length)];
  const rumorNonFascists = 3 - rumorFascists;
  if (rumorFascists > f || rumorNonFascists > l) return truth;

  return {
    candidateSeats: [...pickDistinct(fascistSeats, rumorFascists), ...pickDistinct(nonFascistSeats, rumorNonFascists)].sort(
      (a, b) => a - b
    ),
  };
}

module.exports = {
  countsAsFascistForVicar,
  buildVicarClueText,
  getStartingFascistClue,
};
