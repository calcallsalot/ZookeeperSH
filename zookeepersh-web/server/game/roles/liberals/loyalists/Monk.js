// The Monk, when exiling a player, publicly chooses two players other than themselves and learns
// whether those two players share the same alignment.

function getAlignmentForMonk(role) {
  if (!role || typeof role !== "object") return null;

  // Special register rules (keep aligned with investigation logic).
  if (role.id === "Grandma") return "liberal";

  const g = role.group;
  if (g === "loyalist" || g === "dissident") return "liberal";
  if (g === "agent" || g === "dictator") return "fascist";

  const a = role.alignment;
  if (a === "liberal" || a === "fascist") return a;

  return null;
}

function inferSeatCount(roleBySeat) {
  if (!roleBySeat || typeof roleBySeat !== "object") return 0;

  let max = 0;
  for (const k of Object.keys(roleBySeat)) {
    const s = Number(k);
    if (!Number.isFinite(s)) continue;
    if (s > max) max = s;
  }
  return max;
}

function countAlignmentsForMonk(roleBySeat, seatCount) {
  const nRaw = Number(seatCount);
  const n = Number.isFinite(nRaw) && nRaw > 0 ? nRaw : inferSeatCount(roleBySeat);

  let liberals = 0;
  let fascists = 0;

  for (let s = 1; s <= n; s += 1) {
    const team = getAlignmentForMonk(roleBySeat?.[s]);
    if (team === "liberal") liberals += 1;
    else if (team === "fascist") fascists += 1;
  }

  return { liberals, fascists };
}

function monkTruthSameAlignment(roleA, roleB) {
  const ta = getAlignmentForMonk(roleA);
  const tb = getAlignmentForMonk(roleB);
  if (!ta || !tb) return null;
  return ta === tb;
}

function rumorizeMonkSameAlignment({ truth, roleBySeat, seatCount }) {
  if (truth == null) return null;

  // Keep rumors plausible: if only one alignment exists in the game state,
  // then the answer must be "same" for any pair.
  const { liberals, fascists } = countAlignmentsForMonk(roleBySeat, seatCount);
  if (liberals === 0 || fascists === 0) return truth;

  // Boolean question: the simplest plausible rumor is the opposite answer.
  return !truth;
}

function normalizePickedSeats(pickedSeats, seatCount, actorSeat) {
  const n = Number(seatCount ?? 0);
  const maxSeat = Number.isFinite(n) && n > 0 ? n : null;

  const actor = Number(actorSeat);
  const hasActor = Number.isFinite(actor) && actor > 0;

  const raw = Array.isArray(pickedSeats) ? pickedSeats : [];
  const out = [];
  const seen = new Set();

  for (const x of raw) {
    const s = Number(x);
    if (!Number.isFinite(s)) continue;
    const seat = Math.trunc(s);
    if (seat <= 0) continue;
    if (maxSeat != null && seat > maxSeat) continue;
    if (hasActor && seat === actor) continue;
    if (seen.has(seat)) continue;
    seen.add(seat);
    out.push(seat);
  }

  return out;
}

function formatMonkInfoText(sameAlignment, pickedSeats) {
  const picks = Array.isArray(pickedSeats) ? pickedSeats : [];
  const a = Number(picks?.[0]);
  const b = Number(picks?.[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "Monk info: inconclusive.";
  if (sameAlignment == null) return "Monk info: inconclusive.";
  return `Monk info: Seats ${a} and ${b} ${sameAlignment ? "share" : "do not share"} the same alignment.`;
}

function getMonkInfo({ roleBySeat, seatCount, pickedSeats, actorSeat, learningRumors }) {
  const picks = normalizePickedSeats(pickedSeats, seatCount, actorSeat);
  const pair = picks.slice(0, 2);

  if (pair.length < 2) {
    return {
      pickedSeats: pair,
      sameAlignment: null,
      text: "Monk info: inconclusive.",
    };
  }

  const truth = monkTruthSameAlignment(roleBySeat?.[pair[0]] ?? null, roleBySeat?.[pair[1]] ?? null);
  const sameAlignment = learningRumors
    ? rumorizeMonkSameAlignment({ truth, roleBySeat, seatCount })
    : truth;

  return {
    pickedSeats: pair,
    sameAlignment,
    text: formatMonkInfoText(sameAlignment, pair),
  };
}

// Back-compat helpers (used by early prototypes in handlers)
function getMonkSameAlignment({ roleA, roleB, learningRumors, roleBySeat, seatCount }) {
  const truth = monkTruthSameAlignment(roleA, roleB);
  if (!learningRumors) return truth;
  if (!roleBySeat || typeof roleBySeat !== "object") return truth == null ? null : !truth;
  return rumorizeMonkSameAlignment({ truth, roleBySeat, seatCount });
}

function getMonkSameAlignmentBySeat({ roleBySeat, seatA, seatB, learningRumors, seatCount }) {
  const a = Number(seatA);
  const b = Number(seatB);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return getMonkSameAlignment({
    roleA: roleBySeat?.[a] ?? null,
    roleB: roleBySeat?.[b] ?? null,
    learningRumors,
    roleBySeat,
    seatCount,
  });
}

function buildMonkInfoText({ seatA, seatB, sameAlignment }) {
  return formatMonkInfoText(sameAlignment, [seatA, seatB]);
}

function getMonkExileInfo({ roleBySeat, seatA, seatB, learningRumors, seatCount }) {
  const { pickedSeats, sameAlignment, text } = getMonkInfo({
    roleBySeat,
    seatCount,
    pickedSeats: [seatA, seatB],
    learningRumors,
  });

  return {
    pickedSeats,
    sameAlignment,
    text,
  };
}

module.exports = {
  getAlignmentForMonk,
  inferSeatCount,
  countAlignmentsForMonk,
  monkTruthSameAlignment,
  rumorizeMonkSameAlignment,
  normalizePickedSeats,
  formatMonkInfoText,
  getMonkInfo,

  // Back-compat exports
  getMonkSameAlignment,
  getMonkSameAlignmentBySeat,
  buildMonkInfoText,
  getMonkExileInfo,
};
