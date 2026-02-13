
// The Rumorist is known to the Dictator and believes they are a Loyalist even though they are not,
// and instead learns rumors.

// Keep in sync with app/gameLogic/roles.js ROLE_GROUPS.loyalist (until a single source of truth exists).
const LOYALIST_ROLE_ID_POOL = [
  "Bureaucrat",
  "Inspector",
  "Vicar",
  "Surveyor",
  "Nun",
  "Fisherman",
  "Organizer",
  "Deputy",
  "Journalist",
  "Monk",
  "Harrier",
  "Pacifist",
  "Governor",
];

function normalizeRoleId(roleId) {
  const id = typeof roleId === "string" ? roleId.trim() : String(roleId ?? "").trim();
  return id ? id : null;
}

function isRumoristRole(role) {
  return Boolean(role && typeof role === "object" && role.id === "Rumorist");
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

function listTakenRealRoleIds({ roleBySeat, seatCount }) {
  const nRaw = Number(seatCount);
  const n = Number.isFinite(nRaw) && nRaw > 0 ? Math.trunc(nRaw) : inferSeatCount(roleBySeat);
  if (!Number.isFinite(n) || n <= 0) return new Set();

  /** @type {Set<string>} */
  const taken = new Set();
  for (let s = 1; s <= n; s += 1) {
    const id = normalizeRoleId(roleBySeat?.[s]?.id);
    if (id) taken.add(id);
  }
  return taken;
}

function listCoverRoleIds({ coverRoleBySeat, seatCount }) {
  const nRaw = Number(seatCount);
  const n = Number.isFinite(nRaw) && nRaw > 0 ? Math.trunc(nRaw) : inferSeatCount(coverRoleBySeat);
  if (!Number.isFinite(n) || n <= 0) return new Set();

  /** @type {Set<string>} */
  const covers = new Set();
  for (let s = 1; s <= n; s += 1) {
    const id = normalizeRoleId(coverRoleBySeat?.[s]?.id);
    if (id) covers.add(id);
  }
  return covers;
}

function listRumoristSeats(roleBySeat, seatCount) {
  const nRaw = Number(seatCount);
  const n = Number.isFinite(nRaw) && nRaw > 0 ? nRaw : inferSeatCount(roleBySeat);
  if (!Number.isFinite(n) || n <= 0) return [];

  const out = [];
  for (let s = 1; s <= n; s += 1) {
    if (isRumoristRole(roleBySeat?.[s])) out.push(s);
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

function ensureRumoristState(gs) {
  if (!gs || typeof gs !== "object") return;
  if (!gs.secret || typeof gs.secret !== "object") return;

  if (!gs.secret.learningRumorsBySeat || typeof gs.secret.learningRumorsBySeat !== "object") {
    gs.secret.learningRumorsBySeat = {};
  }

  // Canonical location (used by handlers and sanitizeGameStateForRecipient).
  if (!gs.secret.rumoristBelievedRoleIdBySeat || typeof gs.secret.rumoristBelievedRoleIdBySeat !== "object") {
    // Prefer any existing legacy mapping if present.
    const legacy = gs.secret?.rumorist?.believedRoleIdBySeat;
    if (legacy && typeof legacy === "object") {
      gs.secret.rumoristBelievedRoleIdBySeat = legacy;
    } else {
      gs.secret.rumoristBelievedRoleIdBySeat = {};
    }
  }

  // Back-compat alias (older prototypes used secret.rumorist.believedRoleIdBySeat).
  if (!gs.secret.rumorist || typeof gs.secret.rumorist !== "object") {
    gs.secret.rumorist = { believedRoleIdBySeat: gs.secret.rumoristBelievedRoleIdBySeat };
  }
  if (!gs.secret.rumorist.believedRoleIdBySeat || typeof gs.secret.rumorist.believedRoleIdBySeat !== "object") {
    gs.secret.rumorist.believedRoleIdBySeat = gs.secret.rumoristBelievedRoleIdBySeat;
  }

  // If both exist but diverged, merge into the canonical mapping.
  if (gs.secret.rumorist.believedRoleIdBySeat !== gs.secret.rumoristBelievedRoleIdBySeat) {
    const canon = gs.secret.rumoristBelievedRoleIdBySeat;
    const other = gs.secret.rumorist.believedRoleIdBySeat;
    for (const [k, v] of Object.entries(other ?? {})) {
      if (canon?.[k] == null && v != null) canon[k] = v;
    }
    gs.secret.rumorist.believedRoleIdBySeat = canon;
  }

  if (!gs.secret.lastInvestigationBySeat || typeof gs.secret.lastInvestigationBySeat !== "object") {
    gs.secret.lastInvestigationBySeat = {};
  }
}

function applyRumoristBaselineLearningRumors({ gs, roleBySeat, seatCount }) {
  if (!gs || typeof gs !== "object") return;
  ensureRumoristState(gs);

  const rb = roleBySeat ?? gs.secret?.roleBySeat ?? null;
  const n = Number(seatCount ?? (Array.isArray(gs?.players) ? gs.players.length : 0));
  const seats = listRumoristSeats(rb, n);
  for (const s of seats) {
    gs.secret.learningRumorsBySeat[s] = true;
  }
}

function pickFromPool(pool, usedSet) {
  const list = Array.isArray(pool) ? pool : [];
  const used = usedSet instanceof Set ? usedSet : new Set();

  const options = list
    .map((x) => normalizeRoleId(x))
    .filter((x) => x && !used.has(x));
  if (options.length === 0) return null;

  const pick = options[Math.floor(Math.random() * options.length)];
  if (pick) used.add(pick);
  return pick;
}

function pickRumoristBelievedRoleId({ roleBySeat, coverRoleBySeat, seatCount, usedRoleIds }) {
  const nRaw = Number(seatCount);
  const n = Number.isFinite(nRaw) && nRaw > 0 ? Math.trunc(nRaw) : inferSeatCount(roleBySeat);

  const takenReal = listTakenRealRoleIds({ roleBySeat, seatCount: n });
  const covers = listCoverRoleIds({ coverRoleBySeat, seatCount: n });

  const used = usedRoleIds instanceof Set ? usedRoleIds : new Set();

  const preferred = LOYALIST_ROLE_ID_POOL.filter((id) => {
    const x = normalizeRoleId(id);
    if (!x) return false;
    if (takenReal.has(x)) return false;
    if (covers.has(x)) return false;
    return true;
  }).sort();

  const unused = LOYALIST_ROLE_ID_POOL.filter((id) => {
    const x = normalizeRoleId(id);
    if (!x) return false;
    return !takenReal.has(x);
  }).sort();

  const notCover = LOYALIST_ROLE_ID_POOL.filter((id) => {
    const x = normalizeRoleId(id);
    if (!x) return false;
    return !covers.has(x);
  }).sort();

  const any = LOYALIST_ROLE_ID_POOL.map((x) => normalizeRoleId(x)).filter(Boolean).sort();

  return (
    pickFromPool(preferred, used) ||
    pickFromPool(notCover, used) ||
    pickFromPool(unused, used) ||
    pickFromPool(any, used) ||
    "Inspector"
  );
}

function buildRumoristBelievedRoleIdBySeat({ roleBySeat, coverRoleBySeat, seatCount }) {
  const nRaw = Number(seatCount);
  const n = Number.isFinite(nRaw) && nRaw > 0 ? Math.trunc(nRaw) : inferSeatCount(roleBySeat);
  if (!Number.isFinite(n) || n <= 0) return {};

  /** @type {Record<number, string>} */
  const out = {};

  const used = new Set();
  for (let s = 1; s <= n; s += 1) {
    if (!isRumoristRole(roleBySeat?.[s])) continue;
    const pick = pickRumoristBelievedRoleId({
      roleBySeat,
      coverRoleBySeat,
      seatCount: n,
      usedRoleIds: used,
    });
    out[s] = String(pick ?? "Inspector");
  }

  return out;
}

function ensureRumoristBeliefs({ gs, roleBySeat, coverRoleBySeat, seatCount }) {
  if (!gs || typeof gs !== "object") return;
  ensureRumoristState(gs);

  const rb = roleBySeat ?? gs.secret?.roleBySeat ?? null;
  const cb = coverRoleBySeat ?? gs.secret?.coverRoleBySeat ?? null;
  const n = Number(seatCount ?? (Array.isArray(gs?.players) ? gs.players.length : 0));

  const rumoristSeats = listRumoristSeats(rb, n);
  if (rumoristSeats.length === 0) return;

  const believedBySeat = gs.secret.rumoristBelievedRoleIdBySeat;
  const used = new Set();

  for (const s of rumoristSeats) {
    const existing = normalizeRoleId(believedBySeat?.[s] ?? null);
    if (existing && LOYALIST_ROLE_ID_POOL.includes(existing)) used.add(existing);
  }

  for (const s of rumoristSeats) {
    const existing = normalizeRoleId(believedBySeat?.[s] ?? null);
    if (existing && LOYALIST_ROLE_ID_POOL.includes(existing)) continue;

    believedBySeat[s] = pickRumoristBelievedRoleId({
      roleBySeat: rb,
      coverRoleBySeat: cb,
      seatCount: n,
      usedRoleIds: used,
    });
  }
}

function getRumoristBelievedRoleId({ gs, seat }) {
  const s = normalizeSeat(seat);
  if (s == null) return null;

  const top = normalizeRoleId(gs?.secret?.rumoristBelievedRoleIdBySeat?.[s] ?? null);
  if (top) return top;

  const nested = normalizeRoleId(gs?.secret?.rumorist?.believedRoleIdBySeat?.[s] ?? null);
  return nested;
}

function buildDictatorRumoristInfoText({ rumoristSeat }) {
  const s = normalizeSeat(rumoristSeat);
  if (s == null) return "Dictator info: Rumorist unknown.";
  return `Dictator info: Seat ${s} is the Rumorist.`;
}

function buildDictatorRumoristInvestigation({ rumoristSeat, ts }) {
  return {
    ts: typeof ts === "number" ? ts : Date.now(),
    targetSeat: normalizeSeat(rumoristSeat) ?? undefined,
    result: {
      kind: "text",
      text: buildDictatorRumoristInfoText({ rumoristSeat }),
    },
  };
}

function grantDictatorRumoristInfo({ gs, now, writeLastInvestigation }) {
  if (!gs || typeof gs !== "object") return { ok: false, reason: "invalid_game_state" };
  ensureRumoristState(gs);

  const roleBySeat = gs.secret?.roleBySeat ?? null;
  const seatCount = Array.isArray(gs.players) ? gs.players.length : 0;
  if (!roleBySeat || typeof roleBySeat !== "object") return { ok: false, reason: "secret_state_missing" };

  const dictatorSeat = findDictatorSeat(roleBySeat, seatCount);
  const rumoristSeats = listRumoristSeats(roleBySeat, seatCount);
  const rumoristSeat = rumoristSeats.length > 0 ? rumoristSeats[0] : null;

  if (dictatorSeat == null) return { ok: false, reason: "dictator_missing" };
  if (rumoristSeat == null) return { ok: false, reason: "rumorist_missing" };

  const ts = typeof now === "number" && Number.isFinite(now) ? now : Date.now();
  const inv = buildDictatorRumoristInvestigation({ rumoristSeat, ts });

  const shouldWrite = writeLastInvestigation !== false;
  if (shouldWrite) {
    gs.secret.lastInvestigationBySeat[dictatorSeat] = inv;
  }

  return {
    ok: true,
    reason: null,
    dictatorSeat,
    rumoristSeat,
    privateText: inv?.result?.text ?? null,
  };
}

module.exports = {
  LOYALIST_ROLE_ID_POOL,
  normalizeRoleId,
  isRumoristRole,
  inferSeatCount,
  listTakenRealRoleIds,
  listCoverRoleIds,
  listRumoristSeats,
  findDictatorSeat,
  ensureRumoristState,
  applyRumoristBaselineLearningRumors,
  pickRumoristBelievedRoleId,
  buildRumoristBelievedRoleIdBySeat,
  ensureRumoristBeliefs,
  getRumoristBelievedRoleId,
  buildDictatorRumoristInfoText,
  buildDictatorRumoristInvestigation,
  grantDictatorRumoristInfo,
};
