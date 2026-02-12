
function countsAsDissidentForDeputy(role) {
  if (!role || typeof role !== "object") return false;

  // Future-proofing: some roles may be able to "register" as another group.
  // If that ever becomes part of the role object, honor it here.
  const registerGroup =
    role.registerAsGroup ?? role.registerGroup ?? role.registerAs?.group ?? role.registerAs?.registerGroup ?? null;
  if (registerGroup === "dissident") return true;
  if (registerGroup != null) return false;

  return role.group === "dissident";
}

function normalizePickedSeats(pickedSeats, seatCount) {
  const n = Number(seatCount ?? 0);
  const maxSeat = Number.isFinite(n) && n > 0 ? n : null;

  const raw = Array.isArray(pickedSeats) ? pickedSeats : [];
  const out = [];
  const seen = new Set();

  for (const x of raw) {
    const s = Number(x);
    if (!Number.isFinite(s)) continue;
    const seat = Math.trunc(s);
    if (seat <= 0) continue;
    if (maxSeat != null && seat > maxSeat) continue;
    if (seen.has(seat)) continue;
    seen.add(seat);
    out.push(seat);
  }

  return out;
}

function countDissidentsForDeputy(roleBySeat, pickedSeats) {
  const seats = Array.isArray(pickedSeats) ? pickedSeats : [];

  let c = 0;
  for (const s of seats) {
    if (countsAsDissidentForDeputy(roleBySeat?.[s])) c += 1;
  }
  return c;
}

function countTotalDissidents(roleBySeat, seatCount) {
  const n = Number(seatCount ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;

  let c = 0;
  for (let s = 1; s <= n; s += 1) {
    if (countsAsDissidentForDeputy(roleBySeat?.[s])) c += 1;
  }
  return c;
}

function rumorizeDissidentCount({ truth, roleBySeat, seatCount, pickCount }) {
  const k = Number(pickCount ?? 0);
  const n = Number(seatCount ?? 0);
  if (!Number.isFinite(k) || k <= 0) return Math.max(0, Number(truth ?? 0));
  if (!Number.isFinite(n) || n <= 0) return Math.max(0, Math.min(k, Number(truth ?? 0)));

  const totalD = countTotalDissidents(roleBySeat, n);
  const totalNonD = Math.max(0, n - totalD);

  // Hypergeometric bounds: possible dissidents among any k picked seats.
  const minPossible = Math.max(0, k - totalNonD);
  const maxPossible = Math.min(k, totalD);

  const t = Math.max(minPossible, Math.min(maxPossible, Number(truth ?? 0)));
  if (minPossible >= maxPossible) return t;

  const options = [];
  for (let i = minPossible; i <= maxPossible; i += 1) {
    if (i !== t) options.push(i);
  }
  if (options.length === 0) return t;
  return options[Math.floor(Math.random() * options.length)];
}

function formatDeputyInfoText(dissidentCount, pickedSeats) {
  const c = Number(dissidentCount ?? 0);
  const picks = Array.isArray(pickedSeats) ? pickedSeats : [];
  return `Deputy info: ${c} dissident${c === 1 ? "" : "s"} among seats ${picks.join(", ")}.`;
}

function getDeputyInfo({ roleBySeat, seatCount, pickedSeats, learningRumors }) {
  const picks = normalizePickedSeats(pickedSeats, seatCount);
  const truth = countDissidentsForDeputy(roleBySeat, picks);
  const dissidentCount = learningRumors
    ? rumorizeDissidentCount({ truth, roleBySeat, seatCount, pickCount: picks.length })
    : truth;

  return {
    pickedSeats: picks,
    dissidentCount,
    text: formatDeputyInfoText(dissidentCount, picks),
  };
}

module.exports = {
  countsAsDissidentForDeputy,
  normalizePickedSeats,
  countDissidentsForDeputy,
  countTotalDissidents,
  rumorizeDissidentCount,
  formatDeputyInfoText,
  getDeputyInfo,
};
