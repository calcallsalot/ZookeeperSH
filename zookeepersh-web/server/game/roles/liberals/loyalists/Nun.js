function isNunRole(role) {
  return Boolean(role && typeof role === "object" && role.id === "Nun");
}

function getAlignmentForNunInfo(role) {
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

  // Special register rules
  // Grandma registers as Liberal for investigations/info.
  if (role.id === "Grandma") return "liberal";

  const g = role.group;
  if (g === "loyalist" || g === "dissident") return "liberal";
  if (g === "agent" || g === "dictator") return "fascist";

  const a = role.alignment;
  if (a === "liberal" || a === "fascist") return a;

  return null;
}

function countsAsFascistForNun(role) {
  return getAlignmentForNunInfo(role) === "fascist";
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

function neighborSeatsForSeat(targetSeat, seatCount) {
  const n = Number(seatCount ?? 0);
  const t = Number(targetSeat);
  if (!Number.isFinite(n) || n <= 1) return [];
  if (!Number.isFinite(t) || t < 1 || t > n) return [];

  const prev = t === 1 ? n : t - 1;
  const next = t === n ? 1 : t + 1;
  return prev === next ? [prev] : [prev, next];
}

function countFascistsForNun(roleBySeat, seatCount, excludeSeat) {
  const nRaw = Number(seatCount);
  const n = Number.isFinite(nRaw) && nRaw > 0 ? Math.trunc(nRaw) : inferSeatCount(roleBySeat);
  if (!Number.isFinite(n) || n <= 0) return 0;

  const ex = Number(excludeSeat);
  const hasExclude = Number.isFinite(ex) && ex > 0;

  let c = 0;
  for (let s = 1; s <= n; s += 1) {
    if (hasExclude && s === ex) continue;
    if (countsAsFascistForNun(roleBySeat?.[s])) c += 1;
  }
  return c;
}

function countFascistNeighborsForNun({ roleBySeat, seatCount, targetSeat }) {
  const nRaw = Number(seatCount);
  const n = Number.isFinite(nRaw) && nRaw > 0 ? Math.trunc(nRaw) : inferSeatCount(roleBySeat);
  const t = Number(targetSeat);
  if (!Number.isFinite(n) || n <= 1) return { fascist: 0, neighborCount: 0 };
  if (!Number.isFinite(t) || t < 1 || t > n) return { fascist: 0, neighborCount: 0 };

  const neighbors = neighborSeatsForSeat(t, n);
  let fascist = 0;
  for (const s of neighbors) {
    if (countsAsFascistForNun(roleBySeat?.[s])) fascist += 1;
  }

  return { fascist, neighborCount: neighbors.length };
}

function rumorizeNunNeighborCount({ truth, roleBySeat, seatCount, targetSeat }) {
  const t = Number(truth ?? 0);
  const nRaw = Number(seatCount);
  const n = Number.isFinite(nRaw) && nRaw > 0 ? Math.trunc(nRaw) : inferSeatCount(roleBySeat);
  const seat = Number(targetSeat);

  if (!Number.isFinite(n) || n <= 1) return 0;
  if (!Number.isFinite(seat) || seat < 1 || seat > n) return 0;

  const neighborCount = neighborSeatsForSeat(seat, n).length;
  if (neighborCount <= 0) return 0;

  const fascistsOther = countFascistsForNun(roleBySeat, n, seat);
  const nonFascistsOther = Math.max(0, (n - 1) - fascistsOther);

  // Hypergeometric bounds for neighborCount draws from the other (n-1) seats.
  const minPossible = Math.max(0, neighborCount - nonFascistsOther);
  const maxPossible = Math.min(neighborCount, fascistsOther);

  const clampedTruth = Math.max(minPossible, Math.min(maxPossible, t));
  if (maxPossible <= minPossible) return clampedTruth;

  const options = [];
  for (let i = minPossible; i <= maxPossible; i += 1) {
    if (i !== clampedTruth) options.push(i);
  }
  if (options.length === 0) return clampedTruth;
  return options[Math.floor(Math.random() * options.length)];
}

function getNunFascistNeighborCount({ roleBySeat, seatCount, targetSeat, learningRumors }) {
  const { fascist: truth } = countFascistNeighborsForNun({ roleBySeat, seatCount, targetSeat });
  if (!learningRumors) return truth;
  return rumorizeNunNeighborCount({ truth, roleBySeat, seatCount, targetSeat });
}

// Back-compat name (older codepaths counted only living neighbors).
function getNunLivingFascistNeighborCount({ roleBySeat, players, seatCount, targetSeat, learningRumors }) {
  return getNunFascistNeighborCount({ roleBySeat, seatCount: seatCount ?? (players?.length ?? 0), targetSeat, learningRumors });
}

function buildNunInfoText({ targetSeat, fascistNeighborCount }) {
  const seat = Number(targetSeat);
  const c = Number(fascistNeighborCount ?? 0);
  const s = Number.isFinite(seat) ? seat : "?";
  const n = Number.isFinite(c) ? c : 0;
  return `Nun info: Seat ${s} has ${n} fascist neighbor${n === 1 ? "" : "s"}.`;
}

function buildNunInvestigation({ targetSeat, fascistNeighborCount, ts }) {
  return {
    ts: typeof ts === "number" ? ts : Date.now(),
    targetSeat: Number(targetSeat),
    result: {
      kind: "text",
      text: buildNunInfoText({ targetSeat, fascistNeighborCount }),
    },
  };
}

function shouldNunTriggerOnPolicy(policyType) {
  const p = String(policyType ?? "");
  return p === "fascist";
}

function shouldNunSelfExileOnEnact({ enactedPolicy, actorRole }) {
  return shouldNunTriggerOnPolicy(enactedPolicy) && isNunRole(actorRole);
}

function shouldNunSelfExileOnEnactBySeat({ enactedPolicy, actorSeat, roleBySeat }) {
  const s = Number(actorSeat);
  if (!Number.isFinite(s) || s <= 0) return false;
  return shouldNunSelfExileOnEnact({ enactedPolicy, actorRole: roleBySeat?.[s] ?? null });
}

function ensureExileState(gs) {
  if (!gs || typeof gs !== "object") return;
  if (!gs.exile || typeof gs.exile !== "object") {
    gs.exile = {
      exiledBySeat: {},
      claimExileUsedDeckBySeat: {},
    };
    return;
  }
  if (!gs.exile.exiledBySeat || typeof gs.exile.exiledBySeat !== "object") gs.exile.exiledBySeat = {};
  if (!gs.exile.claimExileUsedDeckBySeat || typeof gs.exile.claimExileUsedDeckBySeat !== "object") {
    gs.exile.claimExileUsedDeckBySeat = {};
  }
}

function ensureNunPrivateState(gs) {
  if (!gs || typeof gs !== "object") return;
  if (!gs.secret || typeof gs.secret !== "object") return;
  if (!gs.secret.lastInvestigationBySeat || typeof gs.secret.lastInvestigationBySeat !== "object") {
    gs.secret.lastInvestigationBySeat = {};
  }
  if (!gs.secret.learningRumorsBySeat || typeof gs.secret.learningRumorsBySeat !== "object") {
    gs.secret.learningRumorsBySeat = {};
  }
}

function applyNunSelfExileOnEnact({ gs, actorSeat, enactedPolicy, now }) {
  if (!gs || typeof gs !== "object") return { ok: false, reason: "invalid_game_state", triggered: false };
  if (!gs.secret || typeof gs.secret !== "object") return { ok: false, reason: "secret_state_missing", triggered: false };

  const actor = Number(actorSeat);
  if (!Number.isFinite(actor) || actor <= 0) return { ok: false, reason: "invalid_actor_seat", triggered: false };

  const roleBySeat = gs.secret?.roleBySeat ?? null;
  const actorRole = roleBySeat?.[actor] ?? null;
  if (!shouldNunSelfExileOnEnact({ enactedPolicy, actorRole })) {
    return { ok: true, reason: null, triggered: false };
  }

  ensureExileState(gs);
  ensureNunPrivateState(gs);

  // Forced self-exile: bypass office checks (this can trigger while the player is Chancellor).
  gs.exile.exiledBySeat[actor] = true;

  const seatCount = Array.isArray(gs.players) ? gs.players.length : inferSeatCount(roleBySeat);
  const learningRumors = gs.secret?.learningRumorsBySeat?.[actor] === true;
  const fascistNeighborCount = getNunFascistNeighborCount({
    roleBySeat,
    seatCount,
    targetSeat: actor,
    learningRumors,
  });

  const ts = typeof now === "number" && Number.isFinite(now) ? now : Date.now();
  gs.secret.lastInvestigationBySeat[actor] = buildNunInvestigation({
    targetSeat: actor,
    fascistNeighborCount,
    ts,
  });

  return {
    ok: true,
    reason: null,
    triggered: true,
    actorSeat: actor,
    fascistNeighborCount,
    privateText: gs.secret.lastInvestigationBySeat?.[actor]?.result?.text ?? null,
  };
}

module.exports = {
  isNunRole,
  getAlignmentForNunInfo,
  countsAsFascistForNun,
  inferSeatCount,
  countFascistsForNun,
  neighborSeatsForSeat,
  countFascistNeighborsForNun,
  getNunLivingFascistNeighborCount,
  getNunFascistNeighborCount,
  buildNunInfoText,
  buildNunInvestigation,
  shouldNunTriggerOnPolicy,
  shouldNunSelfExileOnEnact,
  shouldNunSelfExileOnEnactBySeat,
  applyNunSelfExileOnEnact,
};
