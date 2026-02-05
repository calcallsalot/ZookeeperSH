
function countsAsFascistForBureaucrat(role) {
  if (!role || typeof role !== "object") return false;

  // Grandma registers as Liberal for investigations/info.
  if (role.id === "Grandma") return false;

  return role.alignment === "fascist";
}

function countFascistsForBureaucrat(roleBySeat, seatCount) {
  const n = Number(seatCount ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;

  let c = 0;
  for (let s = 1; s <= n; s += 1) {
    if (countsAsFascistForBureaucrat(roleBySeat?.[s])) c += 1;
  }
  return c;
}

// Seats are a ring: (1-2, 2-3, ..., N-1–N, N-1)
function countAdjacentFascistPairsForBureaucrat(roleBySeat, seatCount) {
  const n = Number(seatCount ?? 0);
  if (!Number.isFinite(n) || n <= 1) return 0;

  let pairs = 0;
  for (let s = 1; s <= n; s += 1) {
    const next = s === n ? 1 : s + 1;
    if (countsAsFascistForBureaucrat(roleBySeat?.[s]) && countsAsFascistForBureaucrat(roleBySeat?.[next])) {
      pairs += 1;
    }
  }
  return pairs;
}

function rumorizePairs({ truth, roleBySeat, seatCount }) {
  const f = countFascistsForBureaucrat(roleBySeat, seatCount);
  const n = Number(seatCount ?? 0);
  const maxPairs = f >= n ? n : Math.max(0, f - 1);
  const minPairs = 0;

  const t = Math.max(minPairs, Math.min(maxPairs, Number(truth ?? 0)));
  if (maxPairs <= minPairs) return t;

  const options = [];
  for (let i = minPairs; i <= maxPairs; i += 1) {
    if (i !== t) options.push(i);
  }
  if (options.length === 0) return t;
  return options[Math.floor(Math.random() * options.length)];
}

function getStartingFascistPairs({ roleBySeat, seatCount, learningRumors }) {
  const truth = countAdjacentFascistPairsForBureaucrat(roleBySeat, seatCount);
  if (!learningRumors) return truth;
  return rumorizePairs({ truth, roleBySeat, seatCount });
}

module.exports = {
  countsAsFascistForBureaucrat,
  countAdjacentFascistPairsForBureaucrat,
  getStartingFascistPairs,
};
