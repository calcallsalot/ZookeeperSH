function ensureExileState(gs) {
  if (!gs || typeof gs !== "object") return;

  if (!gs.exile || typeof gs.exile !== "object") {
    gs.exile = {
      exiledBySeat: {},
      claimExileUsedDeckBySeat: {},
    };
    return;
  }

  if (!gs.exile.exiledBySeat || typeof gs.exile.exiledBySeat !== "object") {
    gs.exile.exiledBySeat = {};
  }
  if (!gs.exile.claimExileUsedDeckBySeat || typeof gs.exile.claimExileUsedDeckBySeat !== "object") {
    gs.exile.claimExileUsedDeckBySeat = {};
  }
}

function isSeatExiled(gs, seat) {
  const s = Number(seat);
  if (!Number.isFinite(s)) return false;
  ensureExileState(gs);
  return gs?.exile?.exiledBySeat?.[s] === true;
}

function canExileSeat(gs, seat) {
  const s = Number(seat);
  if (!Number.isFinite(s)) return { ok: false, reason: "invalid_seat" };

  const p = (gs?.players ?? []).find((x) => x?.seat === s) ?? null;
  if (!p) return { ok: false, reason: "unknown_seat" };
  if (p.alive === false) return { ok: false, reason: "dead" };

  // Exile allows any player NOT currently elected to gain an exile token.
  const pres = Number(gs?.election?.presidentSeat);
  const chan = gs?.election?.nominatedChancellorSeat;
  if (Number.isFinite(pres) && s === pres) return { ok: false, reason: "in_office" };
  if (typeof chan === "number" && Number.isFinite(chan) && s === chan) return { ok: false, reason: "in_office" };

  return { ok: true, reason: null };
}

function exileSeat(gs, seat) {
  ensureExileState(gs);
  const check = canExileSeat(gs, seat);
  if (!check.ok) return check;

  const s = Number(seat);
  gs.exile.exiledBySeat[s] = true;
  return { ok: true, reason: null };
}

function clearAllExiles(gs) {
  ensureExileState(gs);
  gs.exile.exiledBySeat = {};
}

function clearAllClaimExileUses(gs) {
  ensureExileState(gs);
  gs.exile.claimExileUsedDeckBySeat = {};
}

function filterOfficeEligibleSeats(gs, seats) {
  ensureExileState(gs);
  const list = Array.isArray(seats) ? seats : [];
  return list.filter((s) => !isSeatExiled(gs, s));
}

module.exports = {
  ensureExileState,
  isSeatExiled,
  canExileSeat,
  exileSeat,
  clearAllExiles,
  clearAllClaimExileUses,
  filterOfficeEligibleSeats,
};
