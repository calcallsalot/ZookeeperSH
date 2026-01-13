"use client";

import { useMemo } from "react";
import { useLobby } from "../components/lobby/LobbySocketContext";
import type { Lobby } from "../components/lobby/types";

const MAX_PLAYERS = 7;
const BLANK_PROFILE_SRC = "/images/playerBackgrounds/blank_profile.png";

export default function LobbyCard({ lobby }: { lobby: Lobby }) {
  const { joinLobby } = useLobby();

  const title = useMemo(
    () => lobby.name ?? `Lobby ${lobby.id.slice(0, 6)}`,
    [lobby.id, lobby.name]
  );

  const players = lobby.players ?? [];
  const count = players.length;
  const statusToShow: "open" | "in_game" | "closed" = count === 7 ? "closed" : (lobby.status ?? "open");

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
            <span>Players: {count}/{MAX_PLAYERS}</span>
            <span>Status: {statusToShow}</span>
          </div>

          {/*  7 player slots */}
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Array.from({ length: MAX_PLAYERS }).map((_, i) => {
              const name = players[i]; 
              const filled = Boolean(name);

              return (
                <div
                  key={i}
                  title={filled ? name : "Empty slot"}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border: filled
                      ? "1px solid rgba(255,255,255,0.20)"
                      : "1px dashed rgba(255,255,255,0.18)",
                    background: filled ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
                    position: "relative",
                    overflow: "hidden",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  {filled ? (
                    <>
                      <img
                        src={BLANK_PROFILE_SRC}
                        alt=""
                        draggable={false}
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          opacity: 0.95,
                        }}
                      />
                      <div
                        style={{
                          position: "relative",
                          zIndex: 1,
                          fontFamily: "var(--font-comfortaa)",
                          fontSize: 12,
                          fontWeight: 900,
                          color: "rgba(0,0,0,0.75)",
                          background: "rgba(255,255,255,0.65)",
                          padding: "2px 6px",
                          borderRadius: 999,
                          lineHeight: 1.1,
                        }}
                      >
                        {String(name).trim().slice(0, 1).toUpperCase()}
                      </div>
                    </>
                  ) : (
                    <div
                      style={{
                        fontFamily: "var(--font-comfortaa)",
                        fontSize: 14,
                        fontWeight: 900,
                        color: "rgba(255,255,255,0.25)",
                        lineHeight: 1,
                      }}
                    >
                      +
                    </div>
                  )}
                </div>
              );
            })}
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
