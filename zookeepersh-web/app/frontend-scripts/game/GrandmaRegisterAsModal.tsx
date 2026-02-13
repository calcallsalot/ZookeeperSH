"use client";

import { useEffect, useState } from "react";

export type GrandmaRegisterAsModalProps = {
  open: boolean;
  onClose?: () => void;
  onSubmit?: (registerAsRoleId: string | null) => void;
};

const OPTIONS: Array<{ id: string | null; label: string }> = [
  { id: null, label: "Clear registration" },

  // Loyalists
  { id: "Bureaucrat", label: "Bureaucrat" },
  { id: "Inspector", label: "Inspector" },
  { id: "Vicar", label: "Vicar" },
  { id: "Surveyor", label: "Surveyor" },
  { id: "Nun", label: "Nun" },
  { id: "Fisherman", label: "Fisherman" },
  { id: "Organizer", label: "Organizer" },
  { id: "Deputy", label: "Deputy" },
  { id: "Journalist", label: "Journalist" },
  { id: "Monk", label: "Monk" },
  { id: "Harrier", label: "Harrier" },
  { id: "Pacifist", label: "Pacifist" },
  { id: "Governor", label: "Governor" },

  // Dissidents
  { id: "Usher", label: "Usher" },
  { id: "Rumorist", label: "Rumorist" },
  { id: "Klutz", label: "Klutz" },
];

export default function GrandmaRegisterAsModal({ open, onClose, onSubmit }: GrandmaRegisterAsModalProps) {
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const send = (id: string | null) => {
    if (submitted) return;
    setSubmitted(true);
    onSubmit?.(id);
  };

  if (!open) return null;

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
          <div style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,255,255,0.92)" }}>Grandma Registration</div>
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
          Choose how you register for role-reveal style effects. Click to submit immediately.
        </div>

        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 10,
            maxHeight: "min(58vh, 460px)",
            overflowY: "auto",
            paddingRight: 6,
          }}
        >
          {OPTIONS.map((opt) => (
            <button
              key={opt.id ?? "__clear__"}
              disabled={submitted}
              onClick={() => send(opt.id)}
              style={{
                width: "100%",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                padding: "10px 12px",
                cursor: submitted ? "not-allowed" : "pointer",
                opacity: submitted ? 0.65 : 1,
                textAlign: "left",
              }}
            >
              <div style={{ fontWeight: 900, color: "rgba(255,255,255,0.92)", fontSize: 14 }}>{opt.label}</div>
              <div style={{ marginTop: 2, fontSize: 12, color: "rgba(255,255,255,0.62)" }}>
                {opt.id ? "Register" : "Clear"}
              </div>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.60)" }}>Hotkey: Esc to close.</div>
      </div>
    </div>
  );
}
