import type { GameChatMessage } from "../../../frontend-scripts/components/lobby/LobbySocketContext";

export function formatSeat(seat?: number | null, showSeat?: boolean) {
  if (!showSeat) return "";
  if (seat == null) return "";
  return ` {${seat}}`;
}

export function formatLine(m: GameChatMessage, showSeat: boolean) {
  if (m.kind === "system") return m.text;
  const seatStr = formatSeat(m.seat, showSeat);
  return `${m.userName ?? "anon"}${seatStr}: ${m.text}`;
}
