function countsAsAgentForInspector(role) {
  if (!role || typeof role !== "object") return false;

  // Grandma registers as Liberal for investigations/info.
  if (role.id === "Grandma") return false;

  return role.group === "agent";
}

function listAgentSeatsForInspector(roleBySeat, seatCount) {
  const n = Number(seatCount ?? 0);
  if (!Number.isFinite(n) || n <= 0) return [];

  const out = [];
  for (let s = 1; s <= n; s += 1) {
    if (countsAsAgentForInspector(roleBySeat?.[s])) out.push(s);
  }
  return out;
}

function shuffleCopy(arr) {
  const a = Array.isArray(arr) ? arr.slice() : [];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Inspector starting clue.
 *
 * Returns an object like:
 *   { agentRoleId: "Noble", candidateSeats: [2, 5, 7] }
 * Meaning: exactly one of those seats is that Agent role.
 */
function getStartingAgentClue({ roleBySeat, seatCount, inspectorSeat, learningRumors }) {
  const n = Number(seatCount ?? 0);
  if (!Number.isFinite(n) || n <= 0) return null;

  const ins = Number(inspectorSeat);
  const hasInspectorSeat = Number.isFinite(ins) && ins >= 1 && ins <= n;

  const agentSeats = listAgentSeatsForInspector(roleBySeat, n).filter((s) => !hasInspectorSeat || s !== ins);
  if (agentSeats.length === 0) return null;

  const targetSeat = agentSeats[Math.floor(Math.random() * agentSeats.length)];
  const agentRoleId = roleBySeat?.[targetSeat]?.id ? String(roleBySeat[targetSeat].id) : null;
  if (!agentRoleId) return null;

  const poolWithoutTarget = [];
  for (let s = 1; s <= n; s += 1) {
    if (s === targetSeat) continue;
    poolWithoutTarget.push(s);
  }

  // Prefer not to include the Inspector themself in their own list (keeps it 3 unknowns).
  let decoyPool = hasInspectorSeat ? poolWithoutTarget.filter((s) => s !== ins) : poolWithoutTarget;
  if (decoyPool.length < 2) decoyPool = poolWithoutTarget;

  const decoys = shuffleCopy(decoyPool).slice(0, 2);
  const truth = {
    agentRoleId,
    candidateSeats: [targetSeat, ...decoys].sort((a, b) => a - b),
  };

  if (!learningRumors) return truth;

  // Rumorize by (if possible) returning a plausible 3-seat set that does NOT contain the real Agent.
  let rumorPool = hasInspectorSeat ? poolWithoutTarget.filter((s) => s !== ins) : poolWithoutTarget;
  if (rumorPool.length < 3) rumorPool = poolWithoutTarget;
  if (rumorPool.length < 3) return truth;

  return {
    agentRoleId,
    candidateSeats: shuffleCopy(rumorPool).slice(0, 3).sort((a, b) => a - b),
  };
}

module.exports = {
  countsAsAgentForInspector,
  listAgentSeatsForInspector,
  getStartingAgentClue,
};
