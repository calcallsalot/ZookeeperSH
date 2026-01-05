"use client";

import PlayerRow from "./PlayerRow";
import { useLobby } from "../components/lobby/LobbySocketContext";

export default function OnlinePlayers() {
  const { onlinePlayers, loading, connected } = useLobby();

  return (
    <aside
      style={{
        borderRadius: 16,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-comfortaa)",
            fontSize: 14,
            fontWeight: 900,
            color: "rgba(255,255,255,0.92)",
          }}
        >
          Players Online
        </h2>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontFamily: "var(--font-comfortaa)",
              fontSize: 12,
              fontWeight: 900,
              color: connected ? "rgba(120,255,170,0.95)" : "rgba(255,255,255,0.55)",
            }}
            title={connected ? "Socket connected" : "Socket disconnected"}
          >
            {connected ? "LIVE" : "OFF"}
          </span>

          <span
            style={{
              fontFamily: "var(--font-comfortaa)",
              fontSize: 12,
              fontWeight: 900,
              color: "rgba(255,255,255,0.65)",
            }}
            title="Online player count"
          >
            {loading ? "…" : onlinePlayers.length}
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 10,
          padding: "8px 10px",
          borderRadius: 12,
          background: "rgba(0,0,0,0.22)",
          border: "1px solid rgba(255,255,255,0.06)",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-comfortaa)",
            fontSize: 12,
            fontWeight: 900,
            color: "rgba(255,255,255,0.70)",
          }}
        >
          Username
        </div>
        <div
          style={{
            fontFamily: "var(--font-comfortaa)",
            fontSize: 12,
            fontWeight: 900,
            color: "rgba(255,255,255,0.70)",
          }}
        >
          ELO
        </div>
      </div>

      {loading ? (
        <div style={{ fontFamily: "var(--font-comfortaa)", fontSize: 13, color: "rgba(255,255,255,0.70)", padding: 10 }}>
          Loading players…
        </div>
      ) : onlinePlayers.length === 0 ? (
        <div style={{ fontFamily: "var(--font-comfortaa)", fontSize: 13, color: "rgba(255,255,255,0.70)", padding: 10 }}>
          No one is online yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {onlinePlayers.map((p, idx) => (
            <PlayerRow key={p.id ?? `${p.name}-${idx}`} player={p} />
          ))}
        </div>
      )}
    </aside>
  );
}
