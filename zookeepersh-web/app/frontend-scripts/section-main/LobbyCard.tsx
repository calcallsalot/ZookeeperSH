"use client";

import { useMemo } from "react";
import { useLobby } from "../components/lobby/LobbySocketContext";
import type { Lobby } from "../components/lobby/types";

export default function LobbyCard({ lobby }: { lobby: Lobby }) {
  const { joinLobby } = useLobby();

  const title = useMemo(() => lobby.name ?? `Lobby ${lobby.id.slice(0, 6)}`, [lobby.id, lobby.name]);
  const count = lobby.players?.length ?? 0;

  return (
    <div
      style={{
        borderRadius: 16,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: "var(--font-comfortaa)",
              fontSize: 14,
              fontWeight: 900,
              color: "rgba(255,255,255,0.92)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={title}
          >
            {title}
          </div>

          <div
            style={{
              marginTop: 6,
              fontFamily: "var(--font-comfortaa)",
              fontSize: 12,
              color: "rgba(255,255,255,0.70)",
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span>Host: {lobby.hostName ?? "—"}</span>
            <span>Players: {count}</span>
            <span>Status: {lobby.status ?? "open"}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => joinLobby(lobby.id)}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.16)",
            background: "rgba(255,255,255,0.10)",
            color: "rgba(255,255,255,0.92)",
            cursor: "pointer",
            fontFamily: "var(--font-comfortaa)",
            fontWeight: 900,
            fontSize: 12,
            whiteSpace: "nowrap",
          }}
          title="Join this lobby"
        >
          Join
        </button>
      </div>
    </div>
  );
}
