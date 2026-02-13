const { shuffle } = require("./shuffle");

const {
  getStartingFascistPairs: getBureaucratStartingFascistPairs,
} = require("../../server/game/roles/liberals/loyalists/Bureaucrat");

const {
  getStartingAgentClue: getInspectorStartingAgentClue,
} = require("../../server/game/roles/liberals/loyalists/Inspector");

const {
  getStartingFascistClue: getVicarStartingFascistClue,
} = require("../../server/game/roles/liberals/loyalists/Vicar");

const {
  buildRumoristBelievedRoleIdBySeat: buildRumoristBelievedRoleIdBySeatFromRumoristModule,
} = require("../../server/game/roles/liberals/dissidents/Rumorist");

// Role groups (docs/roles.txt)
const ROLE_GROUPS = {
  loyalist: [
    "Bureaucrat",
    "Inspector",
    "Vicar",
    "Surveyor",
    "Nun",
    "Fisherman",
    "Organizer",
    "Deputy",
    "Journalist",
    "Monk",
    "Harrier",
    "Pacifist",
    "Governor",
  ],
  dissident: ["Usher", "Rumorist", "Klutz"], // will add conformist later [.., "Conformist"],
  agent: ["Insurrectionary", "Noble", "Grandma"], // will add jester later [.., "Jester"],
  dictator: ["Hitler"],
};

const ROLE_GROUP_TO_ALIGNMENT = {
  loyalist: "liberal",
  dissident: "liberal",
  agent: "fascist",
  dictator: "fascist",
};

// UI colors by group
const ROLE_GROUP_TO_COLOR = {
  loyalist: "#76E4FF", // light cyan-blue
  dissident: "#1E40AF", // dark blue
  agent: "#F59E0B", // orange
  dictator: "#991B1B", // dark red
};

function buildRole(roleId, group) {
  return {
    id: roleId,
    group,
    alignment: ROLE_GROUP_TO_ALIGNMENT[group] ?? "liberal",
    color: ROLE_GROUP_TO_COLOR[group] ?? "rgba(255,255,255,0.9)",
  };
}

function groupForRoleId(roleId) {
  const id = String(roleId ?? "");
  if (ROLE_GROUPS.loyalist.includes(id)) return "loyalist";
  if (ROLE_GROUPS.dissident.includes(id)) return "dissident";
  if (ROLE_GROUPS.agent.includes(id)) return "agent";
  if (ROLE_GROUPS.dictator.includes(id)) return "dictator";
  return null;
}

function buildCoverRoleBySeat({ roleBySeat, seatCount }) {
  const n = Number(seatCount ?? 0);
  if (!Number.isFinite(n) || n <= 0) return {};

  /** @type {Set<string>} */
  const takenRoleIds = new Set();
  for (let s = 1; s <= n; s += 1) {
    const r = roleBySeat?.[s];
    if (r?.id) takenRoleIds.add(String(r.id));
  }

  // Cover roles are liberal roles not used by any real role this game.
  // Exclude Rumorist: it's a special dissident role and should not be used as a fascist cover.
  const liberalRoleIds = [...ROLE_GROUPS.loyalist, ...ROLE_GROUPS.dissident].filter((id) => id !== "Rumorist");
  const coverPool = shuffle(liberalRoleIds.filter((id) => !takenRoleIds.has(String(id))));

  /** @type {Record<number, any>} */
  const coverRoleBySeat = {};
  let i = 0;

  for (let s = 1; s <= n; s += 1) {
    if (!isFascistRole(roleBySeat?.[s])) continue;

    let coverId = coverPool.length > 0 ? coverPool[i % coverPool.length] : null;
    i += 1;

    if (!coverId) {
      // Extremely unlikely for normal player counts; fallback to any liberal role.
      coverId = liberalRoleIds[Math.floor(Math.random() * liberalRoleIds.length)] ?? "Inspector";
    }

    const g = groupForRoleId(coverId) ?? "loyalist";
    coverRoleBySeat[s] = buildRole(coverId, g);
  }

  return coverRoleBySeat;
}

function buildRumoristBelievedRoleIdBySeat({ roleBySeat, coverRoleBySeat, seatCount }) {
  if (typeof buildRumoristBelievedRoleIdBySeatFromRumoristModule !== "function") return {};
  return buildRumoristBelievedRoleIdBySeatFromRumoristModule({ roleBySeat, coverRoleBySeat, seatCount });
}

function assignRolesFor7() {
  // 7-player baseline: 4 Liberals (2 loyalist + 2 dissident), 3 Fascists (2 agent + Hitler)
  // Guarantee Bureaucrat exists for its starting info.
  const loyalistPool = [...ROLE_GROUPS.loyalist].filter((r) => r !== "Bureaucrat");
  shuffle(loyalistPool);
  const loyalistRoles = ["Bureaucrat", loyalistPool[0] ?? "Inspector"];

  const dissidentRoles = shuffle([...ROLE_GROUPS.dissident]).slice(0, 2);
  const agentRoles = shuffle([...ROLE_GROUPS.agent]).slice(0, 2);

  const roles = [
    ...loyalistRoles.map((r) => buildRole(r, "loyalist")),
    ...dissidentRoles.map((r) => buildRole(r, "dissident")),
    ...agentRoles.map((r) => buildRole(r, "agent")),
    buildRole("Hitler", "dictator"),
  ];

  shuffle(roles);
  return roles;
}

function assignRolesFallback(playerCount) {
  const n = Number(playerCount ?? 0);
  if (!Number.isFinite(n) || n <= 0) return [];

  // Minimal fallback: 1 Hitler + fill with Loyalist roles.
  const roles = [buildRole("Hitler", "dictator")];
  const loyalistPool = shuffle([...ROLE_GROUPS.loyalist]);
  let i = 0;
  while (roles.length < n) {
    const r = loyalistPool[i % loyalistPool.length] ?? "Inspector";
    roles.push(buildRole(r, "loyalist"));
    i += 1;
  }
  shuffle(roles);
  return roles.slice(0, n);
}

function assignRolesForPlayerCount(playerCount) {
  const n = Number(playerCount ?? 0);
  if (!Number.isFinite(n) || n <= 0) return [];
  if (n === 7) return assignRolesFor7();
  return assignRolesFallback(n);
}

function isFascistRole(role) {
  return role?.alignment === "fascist";
}

// Seats are a ring: (1-2, 2-3, ..., N-1–N, N-1)
function countAdjacentFascistPairs(roleBySeat, seatCount) {
  const n = Number(seatCount ?? 0);
  if (!Number.isFinite(n) || n <= 1) return 0;

  let pairs = 0;
  for (let s = 1; s <= n; s += 1) {
    const next = s === n ? 1 : s + 1;
    if (isFascistRole(roleBySeat?.[s]) && isFascistRole(roleBySeat?.[next])) pairs += 1;
  }
  return pairs;
}

function buildPrivateRoleState(seatCount) {
  const roles = assignRolesForPlayerCount(seatCount);
  /** @type {Record<number, any>} */
  const roleBySeat = {};
  for (let i = 0; i < seatCount; i += 1) {
    roleBySeat[i + 1] = roles[i] ?? buildRole("Inspector", "loyalist");
  }

  // Fascists receive a private "cover" liberal role that is not used in this game.
  const coverRoleBySeat = buildCoverRoleBySeat({ roleBySeat, seatCount });

  // Rumorist privately believes they are a Loyalist role.
  const rumoristBelievedRoleIdBySeat = buildRumoristBelievedRoleIdBySeat({
    roleBySeat,
    coverRoleBySeat,
    seatCount,
  });

  /** @type {Record<number, any>} */
  const cluesBySeat = {};

  /** @type {Record<number, boolean>} */
  const learningRumorsBySeat = {};
  for (let s = 1; s <= seatCount; s += 1) {
    // Baseline: Rumorist always learns rumors.
    learningRumorsBySeat[s] = roleBySeat?.[s]?.id === "Rumorist";
  }

  const ensureClueBucket = (seat) => {
    const s = Number(seat);
    if (!Number.isFinite(s) || s <= 0) return null;
    if (!cluesBySeat[s] || typeof cluesBySeat[s] !== "object") cluesBySeat[s] = {};
    return cluesBySeat[s];
  };

  const effectiveRoleIdForSeat = (seat) => {
    const s = Number(seat);
    if (!Number.isFinite(s) || s <= 0) return null;
    const realId = roleBySeat?.[s]?.id ?? null;
    if (realId !== "Rumorist") return typeof realId === "string" ? realId : null;
    const believedRaw = rumoristBelievedRoleIdBySeat?.[s] ?? null;
    const believed = typeof believedRaw === "string" && believedRaw.trim() ? believedRaw.trim() : null;
    return believed ?? "Rumorist";
  };

  // Starting clues (private). Rumorist uses the believed role's power.
  for (let s = 1; s <= seatCount; s += 1) {
    const effectiveId = effectiveRoleIdForSeat(s);
    const learningRumors = learningRumorsBySeat[s] === true;
    if (!effectiveId) continue;

    if (effectiveId === "Bureaucrat") {
      const b = ensureClueBucket(s);
      if (b) {
        b.bureaucratFascistPairs = getBureaucratStartingFascistPairs({
          roleBySeat,
          seatCount,
          learningRumors,
        });
      }
    }

    if (effectiveId === "Inspector") {
      const clue = getInspectorStartingAgentClue({
        roleBySeat,
        seatCount,
        inspectorSeat: s,
        learningRumors,
      });
      if (clue) {
        const b = ensureClueBucket(s);
        if (b) b.inspectorAgentClue = clue;
      }
    }

    if (effectiveId === "Vicar") {
      const clue = getVicarStartingFascistClue({
        roleBySeat,
        seatCount,
        vicarSeat: s,
        learningRumors,
      });
      if (clue) {
        const b = ensureClueBucket(s);
        if (b) b.vicarFascistClue = clue;
      }
    }
  }

  // Dictator knows the Rumorist.
  let dictatorSeat = null;
  let rumoristSeat = null;
  for (let s = 1; s <= seatCount; s += 1) {
    const r = roleBySeat?.[s] ?? null;
    if (r?.id === "Rumorist" && rumoristSeat == null) rumoristSeat = s;
    if ((r?.group === "dictator" || r?.id === "Hitler") && dictatorSeat == null) dictatorSeat = s;
  }
  if (dictatorSeat != null && rumoristSeat != null) {
    const b = ensureClueBucket(dictatorSeat);
    if (b) b.dictatorRumoristSeat = rumoristSeat;
  }

  return { roleBySeat, coverRoleBySeat, cluesBySeat, learningRumorsBySeat, rumoristBelievedRoleIdBySeat };
}

module.exports = {
  ROLE_GROUPS,
  ROLE_GROUP_TO_ALIGNMENT,
  ROLE_GROUP_TO_COLOR,
  buildRole,
  groupForRoleId,
  buildCoverRoleBySeat,
  buildRumoristBelievedRoleIdBySeat,
  assignRolesForPlayerCount,
  countAdjacentFascistPairs,
  buildPrivateRoleState,
};
