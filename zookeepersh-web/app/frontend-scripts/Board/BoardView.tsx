"use client";

import ElectionModal, { type ElectionUIState, type Vote } from "../game/ElectionModal";

export const BOARD_IMAGES = {
  liberal: "/images/cards/liberal_board.png",
  fascist: "/images/cards/fascist_board.png",
};

export type BoardViewProps = {
  playerCount: number;

  // NEW (optional)
  election?: ElectionUIState;
  mySeat?: number | null;
  onVote?: (vote: Vote) => void;
};

export default function BoardView({ playerCount, election, mySeat = null, onVote }: BoardViewProps) {
  const boardImages = [BOARD_IMAGES.liberal, BOARD_IMAGES.fascist];
  const showElectionModal = election?.phase === "election_voting";

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "grid" }}>
        {boardImages.map((src) => (
          <img
            key={src}
            src={src}
            alt="Game board"
            style={{ width: "100%", maxWidth: 720, borderRadius: 12 }}
          />
        ))}
      </div>

      {election && onVote ? (
        <ElectionModal open={!!showElectionModal} election={election} mySeat={mySeat} onVote={onVote} />
      ) : null}
    </div>
  );
}
