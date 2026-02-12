// The Insurrectionary, each deck, chooses a player who then learns rumors until a reshuffle occurs.

function isInsurrectionaryRole(role) {
  return Boolean(role && typeof role === "object" && role.id === "Insurrectionary");
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

function findInsurrectionarySeats({ roleBySeat, seatCount }) {
  const nRaw = Number(seatCount);
  const n = Number.isFinite(nRaw) && nRaw > 0 ? Math.trunc(nRaw) : inferSeatCount(roleBySeat);
  if (!Number.isFinite(n) || n <= 0) return [];

  /** @type {number[]} */
  const out = [];
  for (let s = 1; s <= n; s += 1) {
    if (isInsurrectionaryRole(roleBySeat?.[s])) out.push(s);
  }
  return out;
}

function playerBySeat(gs, seat) {
  const s = Number(seat);
  if (!Number.isFinite(s)) return null;
  const players = Array.isArray(gs?.players) ? gs.players : [];
  return players.find((p) => p?.seat === s) ?? null;
}

function getDeckNumberFromGameState(gs, deckNumberOverride) {
  const raw = deckNumberOverride ?? gs?.policyDeckMeta?.deckNumber;
  const n = Number(raw ?? 1);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 1;
}

function ensureInsurrectionaryState(gs) {
  if (!gs || typeof gs !== "object") return;
  if (!gs.secret || typeof gs.secret !== "object") return;

  if (!gs.secret.learningRumorsBySeat || typeof gs.secret.learningRumorsBySeat !== "object") {
    gs.secret.learningRumorsBySeat = {};
  }

  if (!gs.secret.insurrectionary || typeof gs.secret.insurrectionary !== "object") {
    gs.secret.insurrectionary = {
      lastUsedDeckBySeat: {},
      forcedRumorsBySeat: {},
    };
    return;
  }

  if (!gs.secret.insurrectionary.lastUsedDeckBySeat || typeof gs.secret.insurrectionary.lastUsedDeckBySeat !== "object") {
    gs.secret.insurrectionary.lastUsedDeckBySeat = {};
  }

  if (!gs.secret.insurrectionary.forcedRumorsBySeat || typeof gs.secret.insurrectionary.forcedRumorsBySeat !== "object") {
    gs.secret.insurrectionary.forcedRumorsBySeat = {};
  }
}

function canUseInsurrectionaryPick({ gs, actorSeat, targetSeat, deckNumber }) {
  if (!gs || typeof gs !== "object") return { ok: false, reason: "invalid_game_state" };
  if (gs.phase === "game_over" || gs.gameOver) return { ok: false, reason: "game_over" };

  const actor = Number(actorSeat);
  if (!Number.isFinite(actor)) return { ok: false, reason: "invalid_actor_seat" };
  const target = Number(targetSeat);
  if (!Number.isFinite(target)) return { ok: false, reason: "invalid_target_seat" };

  const actorPlayer = playerBySeat(gs, actor);
  if (!actorPlayer) return { ok: false, reason: "unknown_actor_seat" };
  if (actorPlayer.alive === false) return { ok: false, reason: "dead_actor" };

  const targetPlayer = playerBySeat(gs, target);
  if (!targetPlayer) return { ok: false, reason: "unknown_target_seat" };
  if (targetPlayer.alive === false) return { ok: false, reason: "dead_target" };

  const secret = gs.secret;
  if (!secret || typeof secret !== "object") return { ok: false, reason: "secret_state_missing" };

  const role = secret?.roleBySeat?.[actor] ?? null;
  if (!isInsurrectionaryRole(role)) return { ok: false, reason: "no_power" };

  ensureInsurrectionaryState(gs);
  const deck = getDeckNumberFromGameState(gs, deckNumber);
  const lastUsed = Number(secret?.insurrectionary?.lastUsedDeckBySeat?.[actor] ?? 0);
  if (Number.isFinite(lastUsed) && lastUsed === deck) return { ok: false, reason: "already_used_this_deck" };

  return { ok: true, reason: null };
}

function useInsurrectionaryPick({ gs, actorSeat, targetSeat, deckNumber }) {
  const check = canUseInsurrectionaryPick({ gs, actorSeat, targetSeat, deckNumber });
  if (!check.ok) return { ok: false, reason: check.reason };

  const actor = Number(actorSeat);
  const target = Number(targetSeat);
  const deck = getDeckNumberFromGameState(gs, deckNumber);

  ensureInsurrectionaryState(gs);
  gs.secret.insurrectionary.lastUsedDeckBySeat[actor] = deck;

  const wasLearningRumors = gs.secret.learningRumorsBySeat?.[target] === true;
  let forced = false;
  if (!wasLearningRumors) {
    gs.secret.learningRumorsBySeat[target] = true;
    gs.secret.insurrectionary.forcedRumorsBySeat[target] = true;
    forced = true;
  }

  return {
    ok: true,
    reason: null,
    actorSeat: actor,
    targetSeat: target,
    deckNumber: deck,
    forced,
  };
}

// Clears any Insurrectionary-applied rumor learning at a reshuffle.
// This should be invoked when the deck reshuffles (i.e., when a new deck starts).
function clearInsurrectionaryRumorsOnReshuffle({ gs }) {
  if (!gs || typeof gs !== "object") return;
  if (!gs.secret || typeof gs.secret !== "object") return;

  ensureInsurrectionaryState(gs);

  const forced = gs.secret.insurrectionary?.forcedRumorsBySeat ?? {};
  const roleBySeat = gs.secret?.roleBySeat ?? null;

  for (const k of Object.keys(forced)) {
    if (forced[k] !== true) continue;
    const s = Number(k);
    if (!Number.isFinite(s)) continue;

    const r = roleBySeat?.[s] ?? null;
    // Baseline: Rumorist always learns rumors.
    gs.secret.learningRumorsBySeat[s] = r?.id === "Rumorist";
  }

  gs.secret.insurrectionary.forcedRumorsBySeat = {};
}

module.exports = {
  isInsurrectionaryRole,
  inferSeatCount,
  findInsurrectionarySeats,
  ensureInsurrectionaryState,
  canUseInsurrectionaryPick,
  useInsurrectionaryPick,
  clearInsurrectionaryRumorsOnReshuffle,
};
