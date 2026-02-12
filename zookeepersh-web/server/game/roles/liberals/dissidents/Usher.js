
// The Usher, each deck, chooses a player other than themselves and must vote Ja if that player is nominated.

function isUsherRole(role) {
  return Boolean(role && typeof role === "object" && role.id === "Usher");
}

function normalizeSeat(seat) {
  const s = Number(seat);
  return Number.isFinite(s) ? s : null;
}

function playerBySeat(gs, seat) {
  const s = normalizeSeat(seat);
  if (s == null) return null;
  const players = Array.isArray(gs?.players) ? gs.players : [];
  return players.find((p) => p?.seat === s) ?? null;
}

function isSeatAlive(gs, seat) {
  const p = playerBySeat(gs, seat);
  return p?.alive !== false;
}

function getDeckNumberFromGameState(gs) {
  const n = Number(gs?.policyDeckMeta?.deckNumber ?? 1);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function ensureUsherState(gs) {
  if (!gs || typeof gs !== "object") return;
  if (!gs.secret || typeof gs.secret !== "object") return;

  if (!gs.secret.usher || typeof gs.secret.usher !== "object") {
    gs.secret.usher = {
      pickedTargetBySeat: {},
      pickedDeckBySeat: {},
      pickedAtBySeat: {},
    };
  }

  if (!gs.secret.usher.pickedTargetBySeat || typeof gs.secret.usher.pickedTargetBySeat !== "object") {
    gs.secret.usher.pickedTargetBySeat = {};
  }
  if (!gs.secret.usher.pickedDeckBySeat || typeof gs.secret.usher.pickedDeckBySeat !== "object") {
    gs.secret.usher.pickedDeckBySeat = {};
  }
  if (!gs.secret.usher.pickedAtBySeat || typeof gs.secret.usher.pickedAtBySeat !== "object") {
    gs.secret.usher.pickedAtBySeat = {};
  }

  if (!gs.secret.lastInvestigationBySeat || typeof gs.secret.lastInvestigationBySeat !== "object") {
    gs.secret.lastInvestigationBySeat = {};
  }
}

function getUsherPickForDeck({ gs, usherSeat, deckNumber }) {
  if (!gs || typeof gs !== "object") return null;
  const seat = normalizeSeat(usherSeat);
  if (seat == null) return null;

  ensureUsherState(gs);

  const deck = Number(deckNumber ?? getDeckNumberFromGameState(gs));
  const pickedDeck = Number(gs.secret?.usher?.pickedDeckBySeat?.[seat] ?? 0);
  if (!Number.isFinite(deck) || deck <= 0) return null;
  if (!Number.isFinite(pickedDeck) || pickedDeck !== deck) return null;

  const target = normalizeSeat(gs.secret?.usher?.pickedTargetBySeat?.[seat]);
  if (target == null) return null;
  if (target === seat) return null;

  return target;
}

function needsUsherPickForCurrentDeck({ gs, usherSeat }) {
  if (!gs || typeof gs !== "object") return false;
  const seat = normalizeSeat(usherSeat);
  if (seat == null) return false;

  if (!isSeatAlive(gs, seat)) return false;
  if (!isUsherRole(gs?.secret?.roleBySeat?.[seat] ?? null)) return false;

  ensureUsherState(gs);

  const deckNumber = getDeckNumberFromGameState(gs);
  const pickedDeck = Number(gs.secret?.usher?.pickedDeckBySeat?.[seat] ?? 0);
  return !(Number.isFinite(pickedDeck) && pickedDeck === deckNumber);
}

function canUseUsherPick({ gs, actorSeat, targetSeat }) {
  if (!gs || typeof gs !== "object") return { ok: false, reason: "invalid_game_state" };
  if (gs.phase === "game_over" || gs.gameOver) return { ok: false, reason: "game_over" };

  const actor = normalizeSeat(actorSeat);
  if (actor == null) return { ok: false, reason: "invalid_actor_seat" };

  const target = normalizeSeat(targetSeat);
  if (target == null) return { ok: false, reason: "invalid_target_seat" };

  const actorPlayer = playerBySeat(gs, actor);
  if (!actorPlayer) return { ok: false, reason: "unknown_actor_seat" };
  if (actorPlayer.alive === false) return { ok: false, reason: "dead_actor" };

  const targetPlayer = playerBySeat(gs, target);
  if (!targetPlayer) return { ok: false, reason: "unknown_target_seat" };
  if (targetPlayer.alive === false) return { ok: false, reason: "dead_target" };
  if (target === actor) return { ok: false, reason: "cannot_target_self" };

  const secret = gs.secret;
  if (!secret || typeof secret !== "object") return { ok: false, reason: "secret_state_missing" };

  const role = secret?.roleBySeat?.[actor] ?? null;
  if (!isUsherRole(role)) return { ok: false, reason: "no_power" };

  ensureUsherState(gs);
  const deckNumber = getDeckNumberFromGameState(gs);

  const pickedDeck = Number(secret?.usher?.pickedDeckBySeat?.[actor] ?? 0);
  if (Number.isFinite(pickedDeck) && pickedDeck === deckNumber) {
    return { ok: false, reason: "already_picked_this_deck" };
  }

  return { ok: true, reason: null };
}

function buildUsherPickInfoText({ targetSeat, deckNumber }) {
  const t = normalizeSeat(targetSeat);
  const deck = Number(deckNumber ?? 1);
  const seatStr = t != null ? String(t) : "?";
  const deckStr = Number.isFinite(deck) ? String(deck) : "?";
  return `Usher: For deck ${deckStr}, you must vote Ja if seat ${seatStr} is nominated.`;
}

function useUsherPick({ gs, actorSeat, targetSeat, now, writeLastInvestigation }) {
  const check = canUseUsherPick({ gs, actorSeat, targetSeat });
  if (!check.ok) return { ok: false, reason: check.reason };

  const actor = normalizeSeat(actorSeat);
  const target = normalizeSeat(targetSeat);
  if (actor == null || target == null) return { ok: false, reason: "invalid_seat" };

  ensureUsherState(gs);
  const deckNumber = getDeckNumberFromGameState(gs);
  const ts = typeof now === "number" && Number.isFinite(now) ? now : Date.now();

  gs.secret.usher.pickedTargetBySeat[actor] = target;
  gs.secret.usher.pickedDeckBySeat[actor] = deckNumber;
  gs.secret.usher.pickedAtBySeat[actor] = ts;

  const privateText = buildUsherPickInfoText({ targetSeat: target, deckNumber });

  const shouldWrite = writeLastInvestigation !== false;
  if (shouldWrite) {
    gs.secret.lastInvestigationBySeat[actor] = {
      ts,
      targetSeat: target,
      result: { kind: "text", text: privateText },
    };
  }

  return {
    ok: true,
    reason: null,
    actorSeat: actor,
    targetSeat: target,
    deckNumber,
    privateText,
  };
}

function getUsherForcedVote({ gs, voterSeat }) {
  if (!gs || typeof gs !== "object") return null;
  if (gs.phase !== "election_voting") return null;

  const voter = normalizeSeat(voterSeat);
  if (voter == null) return null;
  if (!isSeatAlive(gs, voter)) return null;

  const role = gs.secret?.roleBySeat?.[voter] ?? null;
  if (!isUsherRole(role)) return null;

  const nominated = normalizeSeat(gs?.election?.nominatedChancellorSeat);
  if (nominated == null) return null;

  const deckNumber = getDeckNumberFromGameState(gs);
  const pick = getUsherPickForDeck({ gs, usherSeat: voter, deckNumber });
  if (pick == null) return null;
  if (pick !== nominated) return null;

  return "ja";
}

function coerceVoteWithUsher({ gs, voterSeat, requestedVote }) {
  const forced = getUsherForcedVote({ gs, voterSeat });
  const v = requestedVote === "ja" ? "ja" : requestedVote === "nein" ? "nein" : null;
  if (!forced) return { vote: v, forced: false };
  if (v === "ja") return { vote: "ja", forced: false };
  return { vote: "ja", forced: true };
}

function buildUsherDeckPickPower({ actorSeat, eligibleSeats, resumePhase }) {
  const s = normalizeSeat(actorSeat);
  if (s == null) return null;

  const seats = Array.isArray(eligibleSeats) ? eligibleSeats.map((x) => Number(x)).filter(Number.isFinite) : [];
  const eligible = seats.filter((x) => x !== s).sort((a, b) => a - b);

  return {
    type: "role_pick",
    kind: "usher",
    actorSeat: s,
    pickCount: 1,
    pickedSeats: [],
    eligibleSeats: eligible,
    resumePhase: typeof resumePhase === "string" && resumePhase ? resumePhase : "election_nomination",
  };
}

module.exports = {
  isUsherRole,
  getDeckNumberFromGameState,
  ensureUsherState,
  getUsherPickForDeck,
  needsUsherPickForCurrentDeck,
  canUseUsherPick,
  buildUsherPickInfoText,
  useUsherPick,
  getUsherForcedVote,
  coerceVoteWithUsher,
  buildUsherDeckPickPower,
};
