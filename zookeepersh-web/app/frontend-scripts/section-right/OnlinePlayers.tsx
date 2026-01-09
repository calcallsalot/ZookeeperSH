"use client";

import { useEffect, useMemo } from "react";
import PlayerRow from "./PlayerRow";
import { useLobby } from "../components/lobby/LobbySocketContext";

export default function OnlinePlayers() {
  const { onlinePlayers, loadingOnlinePlayers, connected } = useLobby();

  const sortedPlayers = useMemo(() => {
  return onlinePlayers
    .map((p, idx) => ({ p, idx }))
    .sort((a, b) => {
      const ea = a.p.elo ?? 1600;
      const eb = b.p.elo ?? 1600;

      if (eb !== ea) return eb - ea;      // highest elo first
      return a.idx - b.idx;              // tie => original order (join order)
    })
    .map(({ p }) => p);
}, [onlinePlayers]);

  useEffect(() => {
    console.log("[OnlinePlayers] connected:", connected);
  }, [connected]);

  useEffect(() => {
    console.log("[OnlinePlayers] onlinePlayers:", onlinePlayers.length);
    if (onlinePlayers.length >= 0) {
      console.table(
        onlinePlayers.map((p) => ({
          id: p.id,
          userName: p.name,
          elo: p.elo,
        }))
      );
    }
  }, [onlinePlayers]);

  return (
    <aside style={{ borderRadius: 16, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", padding: 14 }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-comfortaa)", fontSize: 14, fontWeight: 900, color: "rgba(255,255,255,0.92)" }}>
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

          <span style={{ fontFamily: "var(--font-comfortaa)", fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.65)" }}>
            {loadingOnlinePlayers ? "…" : onlinePlayers.length}
          </span>
        </div>
      </div>

      {/* column headers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, padding: "8px 10px", borderRadius: 12, background: "rgba(0,0,0,0.22)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 8 }}>
        <div style={{ fontFamily: "var(--font-comfortaa)", fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.70)" }}>Username</div>
        <div style={{ fontFamily: "var(--font-comfortaa)", fontSize: 12, fontWeight: 900, color: "rgba(255,255,255,0.70)" }}>ELO</div>
      </div>

      {/* body */}
      {loadingOnlinePlayers ? (
        <div style={{ fontFamily: "var(--font-comfortaa)", fontSize: 13, color: "rgba(255,255,255,0.70)", padding: 10 }}>
          Loading players…
        </div>
      ) : onlinePlayers.length === 0 ? (
        <div style={{ fontFamily: "var(--font-comfortaa)", fontSize: 13, color: "rgba(255,255,255,0.70)", padding: 10 }}>
          No one is online yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {sortedPlayers.map((p, idx) => (
            <PlayerRow key={p.id ?? `${p.name}-${idx}`} player={p} />
          ))}
        </div>
      )}
    </aside>
  );
}
