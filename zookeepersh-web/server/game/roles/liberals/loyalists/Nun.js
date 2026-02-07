function countsAsFascistForNun(role) {
  if (!role || typeof role !== "object") return false;

  // Grandma registers as Liberal for investigations/info.
  if (role.id === "Grandma") return false;

  return role.alignment === "fascist";
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

function isSeatAlive(players, seat) {
  const s = Number(seat);
  if (!Number.isFinite(s)) return false;
  const p = (players ?? []).find((x) => x?.seat === s) ?? null;
  return p?.alive !== false;
}

function countLivingFascistNeighborsForNun({ roleBySeat, players, seatCount, targetSeat }) {
  const n = Number(seatCount ?? (Array.isArray(players) ? players.length : 0));
  const t = Number(targetSeat);
  if (!Number.isFinite(n) || n <= 1) return { fascist: 0, livingNeighbors: 0 };
  if (!Number.isFinite(t) || t < 1 || t > n) return { fascist: 0, livingNeighbors: 0 };

  const neighbors = neighborSeatsForSeat(t, n);
  let livingNeighbors = 0;
  let fascist = 0;

  for (const s of neighbors) {
    if (!isSeatAlive(players, s)) continue;
    livingNeighbors += 1;
    if (countsAsFascistForNun(roleBySeat?.[s])) fascist += 1;
  }

  return { fascist, livingNeighbors };
}

function rumorizeNunNeighborCount({ truth, livingNeighbors }) {
  const t = Number(truth ?? 0);
  const max = Math.max(0, Math.min(2, Number(livingNeighbors ?? 0)));
  const clampedTruth = Math.max(0, Math.min(max, t));

  if (max <= 0) return clampedTruth;

  const options = [];
  for (let i = 0; i <= max; i += 1) {
    if (i !== clampedTruth) options.push(i);
  }
  if (options.length === 0) return clampedTruth;
  return options[Math.floor(Math.random() * options.length)];
}

function getNunLivingFascistNeighborCount({ roleBySeat, players, seatCount, targetSeat, learningRumors }) {
  const { fascist: truth, livingNeighbors } = countLivingFascistNeighborsForNun({
    roleBySeat,
    players,
    seatCount,
    targetSeat,
  });

  if (!learningRumors) return truth;
  return rumorizeNunNeighborCount({ truth, livingNeighbors });
}

function buildNunInfoText({ targetSeat, fascistNeighborCount }) {
  const seat = Number(targetSeat);
  const c = Number(fascistNeighborCount ?? 0);
  const s = Number.isFinite(seat) ? seat : "?";
  const n = Number.isFinite(c) ? c : 0;
  return `Nun info: Seat ${s} has ${n} living fascist neighbor${n === 1 ? "" : "s"}.`;
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
  return p !== "liberal";
}

module.exports = {
  countsAsFascistForNun,
  neighborSeatsForSeat,
  countLivingFascistNeighborsForNun,
  getNunLivingFascistNeighborCount,
  buildNunInfoText,
  buildNunInvestigation,
  shouldNunTriggerOnPolicy,
};
