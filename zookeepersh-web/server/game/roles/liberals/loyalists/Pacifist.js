function isPacifistRole(role) {
  return Boolean(role && typeof role === "object" && role.id === "Pacifist");
}

function buildPacifistReprisalExecutePower(actorSeat, aliveSeats) {
  const actor = Number(actorSeat);
  if (!Number.isFinite(actor)) return null;

  const seats = Array.isArray(aliveSeats) ? aliveSeats : [];
  const eligibleSeats = seats
    .map((s) => Number(s))
    .filter((s) => Number.isFinite(s) && s !== actor);

  eligibleSeats.sort((a, b) => a - b);

  return {
    type: "execute",
    presidentSeat: actor,
    eligibleSeats,
  };
}

module.exports = {
  isPacifistRole,
  buildPacifistReprisalExecutePower,
};
