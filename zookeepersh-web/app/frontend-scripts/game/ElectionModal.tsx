"use client";

import { useEffect, useMemo, useState } from "react";

export type Vote = "ja" | "nein";

export type ElectionUIState = {
  phase: "election_nomination" | "election_voting" | "election_reveal" | string;
  presidentSeat: number;
  nominatedChancellorSeat: number | null;
  votes: Record<number, Vote | null>; // key = seat
};

export default function ElectionModal({
  open,
  election,
  mySeat,
  onVote,
}: {
  open: boolean;
  election: ElectionUIState;
  mySeat: number | null;
  onVote: (vote: Vote) => void;
}) {
  const [sent, setSent] = useState<Vote | null>(null);

  useEffect(() => {
    if (!open) return;
    setSent(null);
  }, [open]);

  const alreadyVoted = useMemo(() => {
    if (!mySeat) return false;
    return election.votes?.[mySeat] != null;
  }, [election.votes, mySeat]);

  if (!open) return null;

  const disabled = !mySeat || alreadyVoted || sent != null;

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
          width: 560,
          maxWidth: "92vw",
          borderRadius: 18,
          padding: 18,
          background: "rgba(20,20,20,0.92)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.92)" }}>
            Vote on the government
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
            {alreadyVoted ? "Vote submitted" : "Choose Ja / Nein"}
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 14, color: "rgba(255,255,255,0.78)" }}>
          President: <b>Seat {election.presidentSeat}</b> • Nominee:{" "}
          <b>{election.nominatedChancellorSeat ? `Seat ${election.nominatedChancellorSeat}` : "—"}</b>
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 14, justifyContent: "center" }}>
          <button
            disabled={disabled}
            onClick={() => {
              setSent("ja");
              onVote("ja");
            }}
            style={{
              cursor: disabled ? "not-allowed" : "pointer",
              border: "none",
              background: "transparent",
              padding: 0,
              opacity: disabled ? 0.55 : 1,
            }}
          >
            <img
              src="/images/election_cards/ja.png"
              alt="Ja"
              style={{ width: 190, height: 260, borderRadius: 10 }}
            />
          </button>

          <button
            disabled={disabled}
            onClick={() => {
              setSent("nein");
              onVote("nein");
            }}
            style={{
              cursor: disabled ? "not-allowed" : "pointer",
              border: "none",
              background: "transparent",
              padding: 0,
              opacity: disabled ? 0.55 : 1,
            }}
          >
            <img
              src="/images/election_cards/nein.png"
              alt="Nein"
              style={{ width: 190, height: 260, borderRadius: 10 }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
