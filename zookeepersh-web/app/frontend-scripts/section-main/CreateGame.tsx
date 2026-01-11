"use client";

import { useEffect, useState } from "react";
import { useLobby } from "../components/lobby/LobbySocketContext";

export default function CreateGame() {
  const { connected, createLobby } = useLobby();
  const [open, setOpen] = useState(false);

  const label = connected ? "Create Game" : "Create Game (offline)";

  // ESC closes modal
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!connected) {
            console.log("[CreateGame] clicked when offline");
            return;
          }
          setOpen(true); //  open modal instead of createLobby()
        }}
        style={{
          padding: "20px 14px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.16)",
          background: connected ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.92)",
          cursor: "pointer",
          fontFamily: "var(--font-comfortaa)",
          fontWeight: 800,
          fontSize: 13,
          whiteSpace: "nowrap",
          opacity: connected ? 1 : 0.8,
        }}
        title={connected ? "Create a new lobby" : "(Offline) Socket not connected yet"}
      >
        {label}
      </button>

      {/* Modal */}
      {open && (
        <div
          onMouseDown={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.6)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: "min(520px, 100%)",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(20,20,20,0.95)",
              padding: 16,
              boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-comfortaa)",
                fontWeight: 900,
                color: "rgba(255,255,255,0.92)",
                fontSize: 14,
              }}
            >
              Create a game?
            </div>

            <div
              style={{
                marginTop: 10,
                fontFamily: "var(--font-comfortaa)",
                fontSize: 13,
                color: "rgba(255,255,255,0.75)",
                lineHeight: 1.5,
              }}
            >
              This will create a new lobby.
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.9)",
                  cursor: "pointer",
                  fontFamily: "var(--font-comfortaa)",
                  fontWeight: 900,
                  fontSize: 12,
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => {
                  createLobby();
                  setOpen(false);
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: "rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.92)",
                  cursor: "pointer",
                  fontFamily: "var(--font-comfortaa)",
                  fontWeight: 900,
                  fontSize: 12,
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
