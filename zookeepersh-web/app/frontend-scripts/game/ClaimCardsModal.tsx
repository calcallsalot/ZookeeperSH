"use client";

import { useEffect, useState } from "react";

export type ClaimCardsModalMode = "president" | "chancellor";

export type ClaimCardsModalProps = {
  open: boolean;
  mode: ClaimCardsModalMode;
  onClose?: () => void;
  onSubmit?: (cards: string) => void;
};

type PolicyType = "liberal" | "fascist";

type ClaimOption = {
  cards: string; // canonical (RRR/RRB/RBB/BBB or RR/RB/BB)
  label: string;
  display: PolicyType[];
};

const POLICY_IMAGES: Record<PolicyType, string> = {
  liberal: "/images/cards/liberal-policy.png",
  fascist: "/images/cards/fascist-policy.png",
};

const OPTIONS_BY_MODE: Record<ClaimCardsModalMode, ClaimOption[]> = {
  president: [
    { cards: "BBB", label: "3 liberal policies", display: ["liberal", "liberal", "liberal"] },
    { cards: "RBB", label: "2 liberal + 1 fascist", display: ["liberal", "liberal", "fascist"] },
    { cards: "RRB", label: "2 fascist + 1 liberal", display: ["fascist", "fascist", "liberal"] },
    { cards: "RRR", label: "3 fascist policies", display: ["fascist", "fascist", "fascist"] },
  ],
  chancellor: [
    { cards: "BB", label: "2 liberal policies", display: ["liberal", "liberal"] },
    { cards: "RB", label: "1 liberal + 1 fascist", display: ["liberal", "fascist"] },
    { cards: "RR", label: "2 fascist policies", display: ["fascist", "fascist"] },
  ],
};

function PolicyCard({ policy, w, h }: { policy: PolicyType; w: number; h: number }) {
  return (
    <img
      src={POLICY_IMAGES[policy]}
      alt={policy}
      draggable={false}
      style={{ width: w, height: h, borderRadius: 10, display: "block" }}
    />
  );
}

export default function ClaimCardsModal({ open, mode, onClose, onSubmit }: ClaimCardsModalProps) {
  const [submitted, setSubmitted] = useState(false);
  const options = OPTIONS_BY_MODE[mode] ?? [];

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
  }, [open, mode]);

  const send = (cards: string) => {
    if (submitted) return;
    setSubmitted(true);
    onSubmit?.(cards);
  };

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose?.();
        return;
      }

      const n = Number(e.key);
      if (!Number.isFinite(n)) return;
      const idx = n - 1;
      if (idx < 0 || idx >= options.length) return;
      const cards = options[idx]?.cards;
      if (!cards) return;
      send(cards);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, onSubmit, options, submitted]);

  if (!open) return null;

  const title = mode === "president" ? "Claim Cards (President)" : "Claim Cards (Chancellor)";
  const subtitle = "Click an option to immediately send /claim cards.";

  const cardW = 92;
  const cardH = 126;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(3px)",
        padding: 12,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 720,
          maxWidth: "94vw",
          borderRadius: 18,
          padding: 18,
          background: "rgba(20,20,20,0.92)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,255,255,0.92)" }}>{title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{subtitle}</div>
            <button
              onClick={() => onClose?.()}
              style={{
                height: 30,
                padding: "0 10px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.9)",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          {options.map((opt, idx) => {
            return (
              <button
                key={`${opt.cards}-${idx}`}
                disabled={submitted}
                onClick={() => send(opt.cards)}
                style={{
                  width: "100%",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  padding: 12,
                  cursor: submitted ? "not-allowed" : "pointer",
                  opacity: submitted ? 0.65 : 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 10,
                        display: "grid",
                        placeItems: "center",
                        border: "1px solid rgba(255,255,255,0.14)",
                        background: "rgba(0,0,0,0.25)",
                        color: "rgba(255,255,255,0.9)",
                        fontWeight: 900,
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {opt.display.map((p, i) => (
                        <PolicyCard key={`${opt.cards}-${i}`} policy={p} w={cardW} h={cardH} />
                      ))}
                    </div>

                    <div style={{ textAlign: "left", minWidth: 0 }}>
                      <div style={{ fontWeight: 900, color: "rgba(255,255,255,0.92)", fontSize: 14 }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                        Sends {" "}
                        <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontWeight: 900 }}>
                          /claim cards {opt.cards}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      fontWeight: 900,
                      color: "rgba(255,255,255,0.8)",
                      padding: "6px 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(0,0,0,0.18)",
                      flexShrink: 0,
                    }}
                  >
                    {opt.cards}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.60)" }}>
          Hotkeys: 1-{options.length} to pick, Esc to close. No confirmation.
        </div>
      </div>
    </div>
  );
}
