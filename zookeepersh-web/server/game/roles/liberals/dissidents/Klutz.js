
// The Klutz, upon dying, causes the Dictator to learn this, and Fascists win if a Fascist is elected Chancellor.

function isKlutzRole(role) {
  return Boolean(role && typeof role === "object" && role.id === "Klutz");
}

function normalizeSeat(seat) {
  const s = Number(seat);
  return Number.isFinite(s) ? s : null;
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

function listKlutzSeats(roleBySeat, seatCount) {
  const nRaw = Number(seatCount);
  const n = Number.isFinite(nRaw) && nRaw > 0 ? nRaw : inferSeatCount(roleBySeat);
  if (!Number.isFinite(n) || n <= 0) return [];

  const out = [];
  for (let s = 1; s <= n; s += 1) {
    if (isKlutzRole(roleBySeat?.[s])) out.push(s);
  }
  return out;
}

function findDictatorSeat(roleBySeat, seatCount) {
  const nRaw = Number(seatCount);
  const n = Number.isFinite(nRaw) && nRaw > 0 ? nRaw : inferSeatCount(roleBySeat);
  if (!Number.isFinite(n) || n <= 0) return null;

  for (let s = 1; s <= n; s += 1) {
    const r = roleBySeat?.[s] ?? null;
    if (!r || typeof r !== "object") continue;
    if (r.group === "dictator") return s;
    if (r.id === "Hitler") return s;
  }
  return null;
}

function ensureKlutzState(gs) {
  if (!gs || typeof gs !== "object") return;
  if (!gs.secret || typeof gs.secret !== "object") return;

  if (!gs.secret.klutz || typeof gs.secret.klutz !== "object") {
    gs.secret.klutz = {
      deadBySeat: {},
      activatedAt: null,
    };
  }

  if (!gs.secret.klutz.deadBySeat || typeof gs.secret.klutz.deadBySeat !== "object") {
    gs.secret.klutz.deadBySeat = {};
  }

  if (!gs.secret.lastInvestigationBySeat || typeof gs.secret.lastInvestigationBySeat !== "object") {
    gs.secret.lastInvestigationBySeat = {};
  }
}

function isKlutzDeadInGameState(gs) {
  const deadBySeat = gs?.secret?.klutz?.deadBySeat ?? null;
  if (!deadBySeat || typeof deadBySeat !== "object") return false;
  return Object.values(deadBySeat).some((v) => v === true);
}

function getAlignmentForKlutzWin(role) {
  if (!role || typeof role !== "object") return null;

  // Future-proofing: allow roles to explicitly register as another alignment.
  const reg =
    role.registerAsAlignment ??
    role.registerAlignment ??
    role.registerAs?.alignment ??
    role.registerAs?.team ??
    role.registerTeam ??
    null;

  if (reg === "liberal" || reg === "fascist") return reg;

  const a = role.alignment;
  if (a === "liberal" || a === "fascist") return a;

  const g = role.group;
  if (g === "loyalist" || g === "dissident") return "liberal";
  if (g === "agent" || g === "dictator") return "fascist";

  return null;
}

function countsAsFascistForKlutzWin(role) {
  return getAlignmentForKlutzWin(role) === "fascist";
}

function buildKlutzDeathInfoText({ klutzSeat }) {
  const s = normalizeSeat(klutzSeat);
  const seatStr = s != null ? String(s) : "?";
  return `Dictator info: Seat ${seatStr} was the Klutz. Fascists now win if any Fascist is elected Chancellor.`;
}

function buildKlutzDeathInvestigation({ klutzSeat, ts }) {
  const seat = normalizeSeat(klutzSeat);
  return {
    ts: typeof ts === "number" ? ts : Date.now(),
    targetSeat: seat ?? undefined,
    result: {
      kind: "text",
      text: buildKlutzDeathInfoText({ klutzSeat: seat }),
    },
  };
}

function markKlutzDead({ gs, klutzSeat, now }) {
  if (!gs || typeof gs !== "object") return { ok: false, reason: "invalid_game_state" };
  ensureKlutzState(gs);

  const s = normalizeSeat(klutzSeat);
  if (s == null) return { ok: false, reason: "invalid_seat" };

  const ts = typeof now === "number" && Number.isFinite(now) ? now : Date.now();
  gs.secret.klutz.deadBySeat[s] = true;
  if (gs.secret.klutz.activatedAt == null) gs.secret.klutz.activatedAt = ts;

  return { ok: true, reason: null, klutzSeat: s, ts };
}

function onSeatDiedMaybeKlutz({ gs, deadSeat, now, writeDictatorLastInvestigation }) {
  if (!gs || typeof gs !== "object") return { ok: false, reason: "invalid_game_state" };
  if (!gs.secret || typeof gs.secret !== "object") return { ok: false, reason: "secret_state_missing" };

  const seat = normalizeSeat(deadSeat);
  if (seat == null) return { ok: false, reason: "invalid_dead_seat" };

  const role = gs.secret?.roleBySeat?.[seat] ?? null;
  if (!isKlutzRole(role)) return { ok: true, triggered: false, reason: null };

  ensureKlutzState(gs);

  const marked = markKlutzDead({ gs, klutzSeat: seat, now });
  if (!marked.ok) return { ok: false, reason: marked.reason };

  const seatCount = Array.isArray(gs.players) ? gs.players.length : inferSeatCount(gs.secret?.roleBySeat);
  const dictatorSeat = findDictatorSeat(gs.secret?.roleBySeat ?? null, seatCount);

  const ts = marked.ts;
  const inv = buildKlutzDeathInvestigation({ klutzSeat: seat, ts });

  const shouldWrite = writeDictatorLastInvestigation !== false;
  if (shouldWrite && dictatorSeat != null) {
    gs.secret.lastInvestigationBySeat[dictatorSeat] = inv;
  }

  return {
    ok: true,
    reason: null,
    triggered: true,
    deadSeat: seat,
    dictatorSeat,
    privateTextToDictator: inv?.result?.text ?? null,
  };
}

function getKlutzWinIfFascistChancellorElected({ gs, chancellorSeat, electionPassed }) {
  if (!gs || typeof gs !== "object") return null;
  if (!gs.secret || typeof gs.secret !== "object") return null;

  if (electionPassed !== true) return null;
  if (!isKlutzDeadInGameState(gs)) return null;

  const seat = normalizeSeat(chancellorSeat ?? gs?.election?.nominatedChancellorSeat);
  if (seat == null) return null;

  const role = gs.secret?.roleBySeat?.[seat] ?? null;
  if (!countsAsFascistForKlutzWin(role)) return null;

  return {
    winner: "fascist",
    reason: "A Fascist was elected Chancellor after the Klutz died.",
    chancellorSeat: seat,
  };
}

module.exports = {
  isKlutzRole,
  inferSeatCount,
  listKlutzSeats,
  findDictatorSeat,
  ensureKlutzState,
  isKlutzDeadInGameState,
  getAlignmentForKlutzWin,
  countsAsFascistForKlutzWin,
  buildKlutzDeathInfoText,
  buildKlutzDeathInvestigation,
  markKlutzDead,
  onSeatDiedMaybeKlutz,
  getKlutzWinIfFascistChancellorElected,
};
