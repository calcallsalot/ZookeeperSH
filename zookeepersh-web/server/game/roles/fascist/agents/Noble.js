// The Noble, each deck, chooses a player who will die if two consecutive elections fail before a reshuffle.

function isNobleRole(role) {
  return Boolean(role && typeof role === "object" && role.id === "Noble");
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

function findNobleSeats({ roleBySeat, seatCount }) {
  const nRaw = Number(seatCount);
  const n = Number.isFinite(nRaw) && nRaw > 0 ? Math.trunc(nRaw) : inferSeatCount(roleBySeat);
  if (!Number.isFinite(n) || n <= 0) return [];

  /** @type {number[]} */
  const out = [];
  for (let s = 1; s <= n; s += 1) {
    if (isNobleRole(roleBySeat?.[s])) out.push(s);
  }
  return out;
}

function playerBySeat(gs, seat) {
  const s = Number(seat);
  if (!Number.isFinite(s)) return null;
  const players = Array.isArray(gs?.players) ? gs.players : [];
  return players.find((p) => p?.seat === s) ?? null;
}

function isSeatAlive(gs, seat) {
  const p = playerBySeat(gs, seat);
  return p?.alive !== false;
}

function getDeckNumberFromGameState(gs, deckNumberOverride) {
  const raw = deckNumberOverride ?? gs?.policyDeckMeta?.deckNumber;
  const n = Number(raw ?? 1);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 1;
}

function getFailedElectionsFromGameState(gs) {
  const n = Number(gs?.election?.failedElections ?? 0);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function ensureNobleState(gs) {
  if (!gs || typeof gs !== "object") return;
  if (!gs.secret || typeof gs.secret !== "object") return;

  if (!gs.secret.noble || typeof gs.secret.noble !== "object") {
    gs.secret.noble = {
      lastUsedDeckBySeat: {},
      selectionBySeat: {},
    };
    return;
  }

  if (!gs.secret.noble.lastUsedDeckBySeat || typeof gs.secret.noble.lastUsedDeckBySeat !== "object") {
    gs.secret.noble.lastUsedDeckBySeat = {};
  }

  if (!gs.secret.noble.selectionBySeat || typeof gs.secret.noble.selectionBySeat !== "object") {
    gs.secret.noble.selectionBySeat = {};
  }
}

function canUseNoblePick({ gs, actorSeat, targetSeat, deckNumber }) {
  if (!gs || typeof gs !== "object") return { ok: false, reason: "invalid_game_state" };
  if (gs.phase === "game_over" || gs.gameOver) return { ok: false, reason: "game_over" };

  // Noble is only available in nomination to avoid disrupting an in-progress election.
  if (gs.phase !== "election_nomination") return { ok: false, reason: "wrong_phase" };

  const actor = Number(actorSeat);
  if (!Number.isFinite(actor)) return { ok: false, reason: "invalid_actor_seat" };
  const target = Number(targetSeat);
  if (!Number.isFinite(target)) return { ok: false, reason: "invalid_target_seat" };
  if (target === actor) return { ok: false, reason: "cannot_target_self" };

  const actorPlayer = playerBySeat(gs, actor);
  if (!actorPlayer) return { ok: false, reason: "unknown_actor_seat" };
  if (actorPlayer.alive === false) return { ok: false, reason: "dead_actor" };

  const targetPlayer = playerBySeat(gs, target);
  if (!targetPlayer) return { ok: false, reason: "unknown_target_seat" };
  if (targetPlayer.alive === false) return { ok: false, reason: "dead_target" };

  const secret = gs.secret;
  if (!secret || typeof secret !== "object") return { ok: false, reason: "secret_state_missing" };

  const role = secret?.roleBySeat?.[actor] ?? null;
  if (!isNobleRole(role)) return { ok: false, reason: "no_power" };

  ensureNobleState(gs);
  const deck = getDeckNumberFromGameState(gs, deckNumber);
  if (deck < 2) return { ok: false, reason: "not_unlocked_yet" };

  const failedElections = getFailedElectionsFromGameState(gs);
  if (failedElections < 2) return { ok: false, reason: "not_ready" };

  const lastUsed = Number(secret?.noble?.lastUsedDeckBySeat?.[actor] ?? 0);
  if (Number.isFinite(lastUsed) && lastUsed === deck) return { ok: false, reason: "already_used_this_deck" };

  return { ok: true, reason: null };
}

function useNoblePick({ gs, actorSeat, targetSeat, deckNumber }) {
  const check = canUseNoblePick({ gs, actorSeat, targetSeat, deckNumber });
  if (!check.ok) return { ok: false, reason: check.reason };

  const actor = Number(actorSeat);
  const target = Number(targetSeat);
  const deck = getDeckNumberFromGameState(gs, deckNumber);

  ensureNobleState(gs);
  gs.secret.noble.lastUsedDeckBySeat[actor] = deck;

  return {
    ok: true,
    reason: null,
    actorSeat: actor,
    targetSeat: target,
    deckNumber: deck,
  };
}

function shouldNobleTriggerOnFailedElections(failedElections) {
  // "Two consecutive elections fail" -> the second failure.
  const n = Number(failedElections ?? 0);
  return Number.isFinite(n) && Math.trunc(n) === 2;
}

function listNobleVictimSeats({ gs, deckNumber, failedElections }) {
  if (!gs || typeof gs !== "object") return [];
  if (!gs.secret || typeof gs.secret !== "object") return [];
  if (!shouldNobleTriggerOnFailedElections(failedElections)) return [];

  ensureNobleState(gs);
  const deck = getDeckNumberFromGameState(gs, deckNumber);

  /** @type {number[]} */
  const victims = [];
  const selectionBySeat = gs.secret?.noble?.selectionBySeat ?? {};

  for (const [k, rec] of Object.entries(selectionBySeat)) {
    const actor = Number(k);
    if (!Number.isFinite(actor)) continue;
    if (!rec || typeof rec !== "object") continue;
    if (Number(rec.deckNumber) !== deck) continue;
    if (rec.triggered === true) continue;

    const target = Number(rec.targetSeat);
    if (!Number.isFinite(target)) continue;
    const p = playerBySeat(gs, target);
    if (!p || p.alive === false) continue;
    victims.push(target);
  }

  // Dedupe + stable order.
  victims.sort((a, b) => a - b);
  return victims.filter((s, i) => i === 0 || s !== victims[i - 1]);
}

// Mutates gameState.players (marks victims dead) and marks the Noble selections as triggered.
function applyNobleDeaths({ gs, deckNumber, failedElections }) {
  if (!gs || typeof gs !== "object") return { ok: false, reason: "invalid_game_state", victimSeats: [] };
  if (!gs.secret || typeof gs.secret !== "object") return { ok: false, reason: "secret_state_missing", victimSeats: [] };

  if (!shouldNobleTriggerOnFailedElections(failedElections)) {
    return { ok: false, reason: "not_trigger", victimSeats: [] };
  }

  ensureNobleState(gs);
  const deck = getDeckNumberFromGameState(gs, deckNumber);
  const victims = listNobleVictimSeats({ gs, deckNumber: deck, failedElections });
  if (victims.length === 0) return { ok: true, reason: null, victimSeats: [] };

  for (const s of victims) {
    const p = playerBySeat(gs, s);
    if (p) p.alive = false;
  }

  const selectionBySeat = gs.secret?.noble?.selectionBySeat ?? {};
  for (const rec of Object.values(selectionBySeat)) {
    if (!rec || typeof rec !== "object") continue;
    if (Number(rec.deckNumber) !== deck) continue;
    rec.triggered = true;
  }

  return { ok: true, reason: null, victimSeats: victims };
}

// Noble's effect ends on reshuffle. Nothing must be done for correctness if callers always
// check the current deckNumber, but this helper cleans up stale selections.
function clearNobleSelectionsOnReshuffle({ gs }) {
  if (!gs || typeof gs !== "object") return;
  if (!gs.secret || typeof gs.secret !== "object") return;
  ensureNobleState(gs);

  // Keep lastUsedDeckBySeat for history; just clear selections.
  gs.secret.noble.selectionBySeat = {};
}

function needsNoblePickForCurrentDeck({ gs, nobleSeat }) {
  if (!gs || typeof gs !== "object") return false;
  if (!gs.secret || typeof gs.secret !== "object") return false;

  if (gs.phase === "game_over" || gs.gameOver) return false;
  if (gs.phase !== "election_nomination") return false;

  const seat = Number(nobleSeat);
  if (!Number.isFinite(seat) || seat <= 0) return false;
  if (!isSeatAlive(gs, seat)) return false;

  if (!isNobleRole(gs.secret?.roleBySeat?.[seat] ?? null)) return false;

  ensureNobleState(gs);
  const deck = getDeckNumberFromGameState(gs);
  if (deck < 2) return false;

  const failedElections = getFailedElectionsFromGameState(gs);
  if (failedElections < 2) return false;

  const lastUsed = Number(gs.secret?.noble?.lastUsedDeckBySeat?.[seat] ?? 0);
  return !(Number.isFinite(lastUsed) && lastUsed === deck);
}

function buildNobleDeckPickPower({ actorSeat, eligibleSeats, resumePhase }) {
  const s = Number(actorSeat);
  if (!Number.isFinite(s)) return null;

  const seats = Array.isArray(eligibleSeats)
    ? eligibleSeats.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
    : [];
  seats.sort((a, b) => a - b);

  return {
    type: "role_pick",
    kind: "noble",
    actorSeat: s,
    pickCount: 1,
    pickedSeats: [],
    eligibleSeats: seats,
    resumePhase: typeof resumePhase === "string" && resumePhase ? resumePhase : "election_nomination",
  };
}

module.exports = {
  isNobleRole,
  inferSeatCount,
  findNobleSeats,
  ensureNobleState,
  canUseNoblePick,
  useNoblePick,
  shouldNobleTriggerOnFailedElections,
  listNobleVictimSeats,
  applyNobleDeaths,
  clearNobleSelectionsOnReshuffle,
  needsNoblePickForCurrentDeck,
  buildNobleDeckPickPower,
};
