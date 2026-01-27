import type { ElectionState, GameState, PlayerState, Vote } from "./types";
import { createInitialPolicyDeck } from "./policyDeck";

function aliveSeats(players: PlayerState[]) {
  return players.filter((p) => p.alive).map((p) => p.seat);
}

export function initGameState(players: PlayerState[]): GameState {
  const seats = aliveSeats(players);

  return {
    phase: "election_nomination",
    players,
    election: {
      presidentSeat: 1,
      nominatedChancellorSeat: null,
      votes: Object.fromEntries(seats.map((s) => [s, null])),
      revealed: false,
      passed: null,
      requiredYes: 4,

      termLockedPresidentSeat: null,
      termLockedChancellorSeat: null,
    },

    policyDeck: createInitialPolicyDeck(),
    enactedPolicies: { liberal: 0, fascist: 0 },
    legislative: null,
  };
}

export function nominateChancellor(state: GameState, chancellorSeat: number): GameState {
  if (state.phase !== "election_nomination") return state;

  const seats = aliveSeats(state.players);
  if (!seats.includes(chancellorSeat)) return state;
  if (chancellorSeat === state.election.presidentSeat) return state; // optional rule

  return {
    ...state,
    phase: "election_voting",
    election: {
      ...state.election,
      nominatedChancellorSeat: chancellorSeat,
      votes: Object.fromEntries(seats.map((s) => [s, null])),
      revealed: false,
      passed: null,
    },
  };
}

export function castVote(state: GameState, voterSeat: number, vote: Vote): GameState {
  if (state.phase !== "election_voting") return state;

  const seats = aliveSeats(state.players);
  if (!seats.includes(voterSeat)) return state;

  if (state.election.votes[voterSeat] != null) return state;

  const nextVotes = { ...state.election.votes, [voterSeat]: vote };
  const allIn = seats.every((s) => nextVotes[s] != null);

  if (!allIn) {
    return {
      ...state,
      election: { ...state.election, votes: nextVotes },
    };
  }

  const ja = seats.reduce((acc, s) => acc + (nextVotes[s] === "ja" ? 1 : 0), 0);
  const passed = ja >= state.election.requiredYes;

  return {
    ...state,
    phase: "election_reveal",
    election: {
      ...state.election,
      votes: nextVotes,
      revealed: true,
      passed,
    },
  };
}

function nextAlivePresidentSeat(players: PlayerState[], currentSeat: number) {
  const seats = players
    .filter((p) => p.alive)
    .map((p) => p.seat)
    .sort((a, b) => a - b);

  if (seats.length === 0) return currentSeat;

  for (const s of seats) if (s > currentSeat) return s;
  return seats[0];
}

export function advanceAfterReveal(state: GameState): GameState {
  if (state.phase !== "election_reveal") return state;

  const passed = state.election.passed === true;

  if (passed) {
    return {
      ...state,
      phase: "legislative_president", // stub for next phase
    };
  }

  const nextPres = nextAlivePresidentSeat(state.players, state.election.presidentSeat);
  const seats = aliveSeats(state.players);

  return {
    ...state,
    phase: "election_nomination",
    election: {
      ...state.election,
      presidentSeat: nextPres,
      nominatedChancellorSeat: null,
      votes: Object.fromEntries(seats.map((s) => [s, null])),
      revealed: false,
      passed: null,
    },
  };
}
