"use client";

import LobbyCard from "./LobbyCard";
import { useLobby } from "../components/lobby/LobbySocketContext";

export default function LobbyList() {
  const { loading, lobbies } = useLobby();

  if (loading) {
    return (
      <div style={{ fontFamily: "var(--font-comfortaa)", color: "rgba(255,255,255,0.70)" }}>
        Loading lobbies…
      </div>
    );
  }

  if (!lobbies.length) {
    return (
      <div style={{ fontFamily: "var(--font-comfortaa)", color: "rgba(255,255,255,0.70)" }}>
        No lobbies yet. Click <b>Create Game</b>.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {lobbies.map((l) => (
        <LobbyCard key={l.id} lobby={l} />
      ))}
    </div>
  );
}
