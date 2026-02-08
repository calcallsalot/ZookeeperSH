"use client";

import { useEffect, useState } from "react";

export type InvestigationResultClaim = "liberal" | "fascist";

export type ClaimInvestigationResultModalProps = {
  open: boolean;
  onClose?: () => void;
  onSubmit?: (result: InvestigationResultClaim) => void;
};

export default function ClaimInvestigationResultModal({
  open,
  onClose,
  onSubmit,
}: ClaimInvestigationResultModalProps) {
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
  }, [open]);

  const send = (r: InvestigationResultClaim) => {
    if (submitted) return;
    setSubmitted(true);
    onSubmit?.(r);
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose?.();
        return;
      }

      const k = e.key.toLowerCase();
      if (k === "1" || k === "l") send("liberal");
      if (k === "2" || k === "f") send("fascist");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, onSubmit, submitted]);

  if (!open) return null;

  // Next.js serves `public/` at `/`.
  const LIBERAL_IMG = "/images/public_roles/liberal3.png";
  const FASCIST_IMG = "/images/public_roles/fascist0.png";

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
          width: 640,
          maxWidth: "94vw",
          borderRadius: 18,
          padding: 18,
          background: "rgba(20,20,20,0.92)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,255,255,0.92)" }}>
            Claim Investigation Result
          </div>
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

        <div style={{ marginTop: 10, fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
          Click an option to immediately send <span style={{ fontWeight: 900 }}>/claim inv</span>. No confirmation.
        </div>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <button
            disabled={submitted}
            onClick={() => send("liberal")}
            style={{
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              padding: 14,
              cursor: submitted ? "not-allowed" : "pointer",
              opacity: submitted ? 0.65 : 1,
            }}
          >
            <img
              src={LIBERAL_IMG}
              alt="liberal"
              draggable={false}
              style={{ width: "100%", height: 190, objectFit: "contain", display: "block" }}
            />
            <div style={{ marginTop: 10, fontWeight: 900, color: "rgba(255,255,255,0.92)" }}>Liberal (1 / L)</div>
          </button>

          <button
            disabled={submitted}
            onClick={() => send("fascist")}
            style={{
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              padding: 14,
              cursor: submitted ? "not-allowed" : "pointer",
              opacity: submitted ? 0.65 : 1,
            }}
          >
            <img
              src={FASCIST_IMG}
              alt="fascist"
              draggable={false}
              style={{ width: "100%", height: 190, objectFit: "contain", display: "block" }}
            />
            <div style={{ marginTop: 10, fontWeight: 900, color: "rgba(255,255,255,0.92)" }}>Fascist (2 / F)</div>
          </button>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.60)" }}>
          Hotkeys: 1/L for Liberal, 2/F for Fascist, Esc to close.
        </div>
      </div>
    </div>
  );
}
