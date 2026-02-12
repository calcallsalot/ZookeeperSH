function countsAsLiberalForJournalist(role) {
  if (!role || typeof role !== "object") return false;

  // Special register rules
  // Grandma registers as Liberal for investigations/info.
  if (role.id === "Grandma") return true;

  const g = role.group;
  if (g === "loyalist" || g === "dissident") return true;
  if (g === "agent" || g === "dictator") return false;

  const a = role.alignment;
  if (a === "liberal") return true;
  if (a === "fascist") return false;

  return false;
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

function countLiberalsForJournalist(roleBySeat, seatCount) {
  const nRaw = Number(seatCount);
  const n = Number.isFinite(nRaw) && nRaw > 0 ? nRaw : inferSeatCount(roleBySeat);
  if (!Number.isFinite(n) || n <= 0) return 0;

  let c = 0;
  for (let s = 1; s <= n; s += 1) {
    if (countsAsLiberalForJournalist(roleBySeat?.[s])) c += 1;
  }
  return c;
}

function countFascistsForJournalist(roleBySeat, seatCount) {
  const nRaw = Number(seatCount);
  const n = Number.isFinite(nRaw) && nRaw > 0 ? nRaw : inferSeatCount(roleBySeat);
  if (!Number.isFinite(n) || n <= 0) return 0;

  let c = 0;
  for (let s = 1; s <= n; s += 1) {
    if (!countsAsLiberalForJournalist(roleBySeat?.[s])) c += 1;
  }
  return c;
}

function normalizeSeatList(seats) {
  const list = Array.isArray(seats) ? seats : [];
  /** @type {number[]} */
  const out = [];
  const seen = new Set();

  for (const raw of list) {
    const s = Number(raw);
    if (!Number.isFinite(s)) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }

  return out;
}

function countPickedLiberalsForJournalist({ roleBySeat, pickedSeats }) {
  const picks = normalizeSeatList(pickedSeats);
  let c = 0;
  for (const s of picks) {
    if (countsAsLiberalForJournalist(roleBySeat?.[s])) c += 1;
  }
  return c;
}

function rumorizeLiberalCount({ truth, roleBySeat, seatCount, pickCount }) {
  const k = Math.max(0, Math.min(3, Number(pickCount ?? 0)));
  if (!Number.isFinite(k) || k <= 0) return 0;

  const liberals = countLiberalsForJournalist(roleBySeat, seatCount);
  const fascists = countFascistsForJournalist(roleBySeat, seatCount);

  // Plausible bounds given global counts.
  const maxL = Math.min(k, liberals);
  const minL = Math.max(0, k - fascists);

  const t = Math.max(minL, Math.min(maxL, Number(truth ?? 0)));
  if (maxL <= minL) return t;

  const options = [];
  for (let i = minL; i <= maxL; i += 1) {
    if (i !== t) options.push(i);
  }
  if (options.length === 0) return t;
  return options[Math.floor(Math.random() * options.length)];
}

function getJournalistLiberalCount({ roleBySeat, seatCount, pickedSeats, learningRumors }) {
  const picks = normalizeSeatList(pickedSeats);
  const truth = countPickedLiberalsForJournalist({ roleBySeat, pickedSeats: picks });
  if (!learningRumors) return truth;
  return rumorizeLiberalCount({ truth, roleBySeat, seatCount, pickCount: picks.length });
}

module.exports = {
  countsAsLiberalForJournalist,
  countPickedLiberalsForJournalist,
  getJournalistLiberalCount,
};
