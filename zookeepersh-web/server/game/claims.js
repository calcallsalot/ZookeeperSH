function ensureClaimsState(gs) {
  if (!gs || typeof gs !== "object") return;

  if (!gs.claims || typeof gs.claims !== "object") {
    gs.claims = {};
  }

  if (!gs.claims.cards || typeof gs.claims.cards !== "object") {
    gs.claims.cards = {
      presidentSeat: null,
      chancellorSeat: null,
      usedBySeat: {},
    };
  }

  if (!gs.claims.cards.usedBySeat || typeof gs.claims.cards.usedBySeat !== "object") {
    gs.claims.cards.usedBySeat = {};
  }

  if (!gs.claims.inv2 || typeof gs.claims.inv2 !== "object") {
    gs.claims.inv2 = {
      presidentSeat: null,
      targetSeat: null,
      ready: false,
      used: false,
    };
  }

  // Public /claim role <role> messages (used by certain role powers).
  if (!gs.claims.role || typeof gs.claims.role !== "object") {
    gs.claims.role = {
      lastBySeat: {},
      lastDeckBySeat: {},
      lastTsBySeat: {},
    };
  }

  if (!gs.claims.role.lastBySeat || typeof gs.claims.role.lastBySeat !== "object") {
    gs.claims.role.lastBySeat = {};
  }
  if (!gs.claims.role.lastDeckBySeat || typeof gs.claims.role.lastDeckBySeat !== "object") {
    gs.claims.role.lastDeckBySeat = {};
  }
  if (!gs.claims.role.lastTsBySeat || typeof gs.claims.role.lastTsBySeat !== "object") {
    gs.claims.role.lastTsBySeat = {};
  }
}

function setCardsClaimGovernment(gs, presidentSeat, chancellorSeat) {
  ensureClaimsState(gs);

  const pres = Number(presidentSeat);
  const chan = Number(chancellorSeat);

  gs.claims.cards.presidentSeat = Number.isFinite(pres) ? pres : null;
  gs.claims.cards.chancellorSeat = Number.isFinite(chan) ? chan : null;
  gs.claims.cards.usedBySeat = {};
}

function initInv2Claim(gs, presidentSeat) {
  ensureClaimsState(gs);
  const pres = Number(presidentSeat);
  gs.claims.inv2 = {
    presidentSeat: Number.isFinite(pres) ? pres : null,
    targetSeat: null,
    ready: false,
    used: false,
  };
}

function markInv2InvestigationComplete(gs, presidentSeat, targetSeat) {
  ensureClaimsState(gs);
  const pres = Number(presidentSeat);
  if (!Number.isFinite(pres)) return;
  if (gs.claims.inv2?.presidentSeat !== pres) return;

  const target = Number(targetSeat);
  gs.claims.inv2.targetSeat = Number.isFinite(target) ? target : null;
  gs.claims.inv2.ready = gs.claims.inv2.targetSeat != null;
}

module.exports = {
  ensureClaimsState,
  setCardsClaimGovernment,
  initInv2Claim,
  markInv2InvestigationComplete,
};
