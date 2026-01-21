import type { Lobby } from "../frontend-scripts/components/lobby/types";

export function isGameStarted(lobby: Lobby | undefined | null): boolean {
  return (lobby?.status ?? "open") === "in_game";
}

export function shouldShowSeat(lobby: Lobby | undefined | null): boolean {
  return isGameStarted(lobby);
}
  