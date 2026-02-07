
function listUniqueRoleIds({ roleBySeat, seatCount }) {
  const n = Number(seatCount ?? 0);
  if (!Number.isFinite(n) || n <= 0) return [];

  /** @type {Set<string>} */
  const ids = new Set();
  for (let s = 1; s <= n; s += 1) {
    const id = roleBySeat?.[s]?.id;
    if (typeof id === "string" && id.trim()) ids.add(id);
  }
  return [...ids];
}

function rumorizeRoleId({ truthRoleId, roleBySeat, seatCount }) {
  const truth = typeof truthRoleId === "string" && truthRoleId.trim() ? truthRoleId : null;
  if (!truth) return null;

  const pool = listUniqueRoleIds({ roleBySeat, seatCount });
  const options = pool.filter((id) => id !== truth);
  if (options.length === 0) return truth;

  return options[Math.floor(Math.random() * options.length)];
}

function getHarrierLearnedRoleId({ targetRole, roleBySeat, seatCount, learningRumors }) {
  const truth = typeof targetRole?.id === "string" && targetRole.id.trim() ? targetRole.id : null;
  if (!truth) return null;
  if (!learningRumors) return truth;
  return rumorizeRoleId({ truthRoleId: truth, roleBySeat, seatCount });
}

function getHarrierInfoText({ targetSeat, learnedRoleId }) {
  const s = Number(targetSeat);
  const seatStr = Number.isFinite(s) ? String(s) : "?";
  const id = typeof learnedRoleId === "string" && learnedRoleId.trim() ? learnedRoleId : null;
  if (!id) return `Harrier info: Seat ${seatStr} role unknown.`;
  return `Harrier info: Seat ${seatStr} is the ${id}.`;
}

function resolveHarrierPick({
  actorSeat,
  targetSeat,
  targetRole,
  roleBySeat,
  seatCount,
  learningRumors,
}) {
  const learnedRoleId = getHarrierLearnedRoleId({
    targetRole,
    roleBySeat,
    seatCount,
    learningRumors,
  });

  return {
    actorSeat: Number(actorSeat),
    targetSeat: Number(targetSeat),
    learnedRoleId,
    text: getHarrierInfoText({ targetSeat, learnedRoleId }),
  };
}

function buildHarrierDeathPower({ actorSeat, eligibleSeats, resumePhase }) {
  const s = Number(actorSeat);
  if (!Number.isFinite(s)) return null;

  const seats = Array.isArray(eligibleSeats) ? eligibleSeats.map((x) => Number(x)).filter(Number.isFinite) : [];
  seats.sort((a, b) => a - b);

  return {
    type: "role_pick",
    kind: "harrier",
    actorSeat: s,
    pickCount: 1,
    pickedSeats: [],
    eligibleSeats: seats,
    resumePhase: typeof resumePhase === "string" && resumePhase ? resumePhase : "election_nomination",

    // Harrier chooses upon dying (actor may be dead).
    allowDeadActor: true,
  };
}

module.exports = {
  listUniqueRoleIds,
  rumorizeRoleId,
  getHarrierLearnedRoleId,
  getHarrierInfoText,
  resolveHarrierPick,
  buildHarrierDeathPower,
};
