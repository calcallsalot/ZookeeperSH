
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

  if (!gs.secret.rumorist || typeof gs.secret.rumorist !== "object") {
    gs.secret.rumorist = { believedRoleIdBySeat: {} };
  }

  if (!gs.secret.rumorist.believedRoleIdBySeat || typeof gs.secret.rumorist.believedRoleIdBySeat !== "object") {
    gs.secret.rumorist.believedRoleIdBySeat = {};
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

function pickRumoristBelievedRoleId({ roleBySeat, seatCount }) {
  const nRaw = Number(seatCount);
  const n = Number.isFinite(nRaw) && nRaw > 0 ? nRaw : inferSeatCount(roleBySeat);

  /** @type {Set<string>} */
  const taken = new Set();
  if (Number.isFinite(n) && n > 0) {
    for (let s = 1; s <= n; s += 1) {
      const id = roleBySeat?.[s]?.id;
      if (typeof id === "string" && id.trim()) taken.add(id);
    }
  }

  const options = LOYALIST_ROLE_ID_POOL.filter((id) => id && !taken.has(id));
  const pool = options.length > 0 ? options : LOYALIST_ROLE_ID_POOL;
  if (pool.length === 0) return "Inspector";

  return pool[Math.floor(Math.random() * pool.length)] ?? "Inspector";
}

function ensureRumoristBeliefs({ gs, roleBySeat, seatCount }) {
  if (!gs || typeof gs !== "object") return;
  ensureRumoristState(gs);

  const rb = roleBySeat ?? gs.secret?.roleBySeat ?? null;
  const n = Number(seatCount ?? (Array.isArray(gs?.players) ? gs.players.length : 0));

  const rumoristSeats = listRumoristSeats(rb, n);
  for (const s of rumoristSeats) {
    const existing = gs.secret?.rumorist?.believedRoleIdBySeat?.[s] ?? null;
    if (typeof existing === "string" && existing.trim()) continue;
    gs.secret.rumorist.believedRoleIdBySeat[s] = pickRumoristBelievedRoleId({ roleBySeat: rb, seatCount: n });
  }
}

function getRumoristBelievedRoleId({ gs, seat }) {
  const s = normalizeSeat(seat);
  if (s == null) return null;
  const id = gs?.secret?.rumorist?.believedRoleIdBySeat?.[s] ?? null;
  return typeof id === "string" && id.trim() ? id : null;
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
  isRumoristRole,
  inferSeatCount,
  listRumoristSeats,
  findDictatorSeat,
  ensureRumoristState,
  applyRumoristBaselineLearningRumors,
  pickRumoristBelievedRoleId,
  ensureRumoristBeliefs,
  getRumoristBelievedRoleId,
  buildDictatorRumoristInfoText,
  buildDictatorRumoristInvestigation,
  grantDictatorRumoristInfo,
};
