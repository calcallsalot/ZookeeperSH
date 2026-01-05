"use client";

import type { OnlinePlayer } from "../components/lobby/types";

export default function PlayerRow({ player }: { player: OnlinePlayer }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 10,
        alignItems: "center",
        padding: "10px 10px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "rgba(120, 255, 170, 0.95)",
            boxShadow: "0 0 10px rgba(120, 255, 170, 0.35)",
            flex: "0 0 auto",
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-comfortaa)",
            fontSize: 13,
            fontWeight: 800,
            color: "rgba(255,255,255,0.92)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={player.name}
        >
          {player.name}
        </span>
      </div>

      <div
        style={{
          fontFamily: "var(--font-comfortaa)",
          fontSize: 13,
          fontWeight: 800,
          color: "rgba(255,255,255,0.75)",
        }}
      >
        {player.elo == null ? "—" : player.elo}
      </div>
    </div>
  );
}
