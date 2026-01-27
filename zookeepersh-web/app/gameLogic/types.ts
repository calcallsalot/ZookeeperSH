export type Vote = "ja" | "nein";

export type PolicyType = "liberal" | "fascist";

export type GamePhase =
  | "election_nomination"
  | "election_voting"
  | "election_reveal"
  | "legislative_president"
  | "legislative_chancellor"
  | "idle";

export type PlayerState = {
  seat: number;          // recommend 1-based seats to match your “seat 1”
  name: string;
  alive: boolean;
};

export type ElectionState = {
  presidentSeat: number;
  nominatedChancellorSeat: number | null;

  // Term limits (last elected government)
  termLockedPresidentSeat?: number | null;
  termLockedChancellorSeat?: number | null;

  // Convenience for UI (public)
  eligibleChancellorSeats?: number[];

  // key = seat number
  votes: Record<number, Vote | null>;

  revealed: boolean;
  passed: boolean | null;

  requiredYes: number;   // it should be 4 but will need to add dynamic changing like if it's 10p or w/e later
};

export type GameState = {
  phase: GamePhase;
  players: PlayerState[];
  election: ElectionState;

  // policy deck + enactments
  policyDeck: {
    drawPile: PolicyType[];
    discardPile: PolicyType[];
  };
  enactedPolicies: { liberal: number; fascist: number };
  lastEnactedPolicy?: PolicyType;

  legislative: {
    presidentPolicies?: PolicyType[];
    chancellorPolicies?: PolicyType[];
  } | null;
};
