"use client";

import { useEffect, useMemo, useState } from "react";

export type PolicyType = "liberal" | "fascist";

export type LegislativeUIState = {
  phase: "legislative_president" | "legislative_chancellor" | string;
  presidentSeat: number;
  chancellorSeat: number | null;

  presidentPolicies?: PolicyType[] | null;
  chancellorPolicies?: PolicyType[] | null;
};

const POLICY_IMAGES: Record<PolicyType, string> = {
  liberal: "/images/cards/liberal-policy.png",
  fascist: "/images/cards/fascist-policy.png",
};

function PolicyCard({
  policy,
  w,
  h,
}: {
  policy: PolicyType;
  w: number;
  h: number;
}) {
  return (
    <img
      src={POLICY_IMAGES[policy]}
      alt={policy}
      draggable={false}
      style={{ width: w, height: h, borderRadius: 10, display: "block" }}
    />
  );
}

export default function PolicyModal({
  open,
  mode,
  policies,
  onPick,
}: {
  open: boolean;
  mode: "president" | "chancellor";
  policies: PolicyType[];
  onPick: (index: number) => void;
}) {
  const [sentIndex, setSentIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setSentIndex(null);
  }, [open]);

  const title = mode === "president" ? "President: Discard 1" : "Chancellor: Enact 1";
  const subtitle = mode === "president" ? "Click a policy to discard." : "Click a policy to enact.";

  const disabled = sentIndex != null;
  const safePolicies = useMemo(() => (Array.isArray(policies) ? policies : []), [policies]);

  if (!open) return null;
  if (safePolicies.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(3px)",
      }}
    >
      <div
        style={{
          width: 620,
          maxWidth: "94vw",
          borderRadius: 18,
          padding: 18,
          background: "rgba(20,20,20,0.92)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,255,255,0.92)" }}>{title}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{subtitle}</div>
        </div>

        <div
          style={{
            marginTop: 16,
            display: "flex",
            gap: 14,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {(mode === "president" ? safePolicies.slice(0, 3) : safePolicies.slice(0, 2)).map((p, i) => (
            <button
              key={`${p}-${i}`}
              disabled={disabled}
              onClick={() => {
                setSentIndex(i);
                onPick(i);
              }}
              style={{
                cursor: disabled ? "not-allowed" : "pointer",
                border: "none",
                background: "transparent",
                padding: 0,
                opacity: disabled ? 0.65 : 1,
              }}
            >
              <PolicyCard policy={p} w={120} h={164} /> {/* the ratio is w 190 and h 260 so w * (260/190)^-1 = h*/} 
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
