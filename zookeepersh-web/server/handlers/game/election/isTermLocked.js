const { isSeatExiled } = require("../../../game/exile");
const { isSeatAlive } = require("../guards");

function normalizeSeat(seat) {
  const s = Number(seat);
  return Number.isFinite(s) ? s : null;
}

function isTermLockedChancellor(gs, seat) {
  const s = normalizeSeat(seat);
  if (s == null) return false;

  const tlp = normalizeSeat(gs?.election?.termLockedPresidentSeat);
  const tlc = normalizeSeat(gs?.election?.termLockedChancellorSeat);
  if (tlp != null && s === tlp) return true;
  if (tlc != null && s === tlc) return true;
  return false;
}

function isEligibleChancellorSeat(gs, seat) {
  const s = normalizeSeat(seat);
  if (s == null) return false;

  const pres = normalizeSeat(gs?.election?.presidentSeat);
  if (pres != null && s === pres) return false;

  if (!isSeatAlive(gs, s)) return false;
  if (isTermLockedChancellor(gs, s)) return false;
  if (isSeatExiled(gs, s)) return false;

  return true;
}

module.exports = {
  normalizeSeat,
  isTermLockedChancellor,
  isEligibleChancellorSeat,
};
