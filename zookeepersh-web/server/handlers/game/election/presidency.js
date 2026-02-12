function nextAlivePresidentSeat(players, currentSeat, exiledBySeat) {
  const curRaw = Number(currentSeat);
  const cur = Number.isFinite(curRaw) ? curRaw : 0;

  const alive = (players ?? [])
    .filter((p) => p?.alive && exiledBySeat?.[p.seat] !== true)
    .map((p) => p.seat)
    .sort((a, b) => a - b);

  if (alive.length === 0) return cur;
  for (const s of alive) if (s > cur) return s;
  return alive[0];
}

function nextPresidentSeatAfterRound(gameState) {
  const gs = gameState;
  const ret = gs?.election?.specialElectionReturnSeat;
  if (ret != null && Number.isFinite(Number(ret))) {
    gs.election.specialElectionReturnSeat = null;
    return nextAlivePresidentSeat(gs.players, Number(ret) - 1, gs?.exile?.exiledBySeat);
  }

  return nextAlivePresidentSeat(gs.players, gs.election.presidentSeat, gs?.exile?.exiledBySeat);
}

module.exports = {
  nextAlivePresidentSeat,
  nextPresidentSeatAfterRound,
};
