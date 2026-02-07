function isGovernorRole(role) {
  return Boolean(role && typeof role === "object" && role.id === "Governor");
}

function normalizeSeat(seat) {
  const s = Number(seat);
  return Number.isFinite(s) ? s : null;
}

function isSeatAlive(players, seat) {
  const s = normalizeSeat(seat);
  if (s == null) return false;
  const p = Array.isArray(players) ? players.find((x) => x?.seat === s) : null;
  return Boolean(p?.alive);
}

function getGovernorSeats({ roleBySeat, seatCount, players, requireAlive }) {
  const n = Number(seatCount ?? (Array.isArray(players) ? players.length : 0));
  if (!Number.isFinite(n) || n <= 0) return [];

  const out = [];
  for (let s = 1; s <= n; s += 1) {
    const r = roleBySeat?.[s] ?? null;
    if (!isGovernorRole(r)) continue;
    if (requireAlive === true && !isSeatAlive(players, s)) continue;
    out.push(s);
  }
  return out;
}

function getEligibleChancellorSeatsFromGameState(gameState) {
  const gs = gameState;
  const players = Array.isArray(gs?.players) ? gs.players : [];
  const aliveSeats = players.filter((p) => p?.alive).map((p) => p.seat);

  const pres = normalizeSeat(gs?.election?.presidentSeat);
  const tlp = normalizeSeat(gs?.election?.termLockedPresidentSeat);
  const tlc = normalizeSeat(gs?.election?.termLockedChancellorSeat);
  const exiledBySeat = gs?.exile?.exiledBySeat ?? null;

  return aliveSeats.filter((s) => {
    if (pres != null && s === pres) return false;
    if (tlp != null && s === tlp) return false;
    if (tlc != null && s === tlc) return false;
    if (exiledBySeat && exiledBySeat?.[s] === true) return false;
    return true;
  });
}

function getGovernorWinIfChancellorCannotBeNominated(gameState, opts = {}) {
  const gs = gameState;
  if (!gs || typeof gs !== "object") return null;

  const eligible = getEligibleChancellorSeatsFromGameState(gs);
  if (eligible.length > 0) return null;

  const players = Array.isArray(gs.players) ? gs.players : [];
  const seatCount = players.length;
  const roleBySeat = gs?.secret?.roleBySeat ?? null;
  const governorSeats = getGovernorSeats({
    roleBySeat,
    seatCount,
    players,
    requireAlive: opts.requireAliveGovernor === true,
  });

  if (governorSeats.length === 0) return null;

  // Determine the Governor's team.
  const teams = new Set();
  for (const s of governorSeats) {
    const a = roleBySeat?.[s]?.alignment;
    if (a === "liberal" || a === "fascist") teams.add(a);
  }

  if (teams.size !== 1) return null;
  const winner = [...teams][0];

  return {
    winner,
    reason: "Chancellor cannot be nominated. The Governor's team wins immediately.",
    governorSeats,
  };
}

module.exports = {
  isGovernorRole,
  getGovernorSeats,
  getEligibleChancellorSeatsFromGameState,
  getGovernorWinIfChancellorCannotBeNominated,
};
