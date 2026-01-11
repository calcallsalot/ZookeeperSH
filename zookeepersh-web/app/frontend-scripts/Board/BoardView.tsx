import { BOARD_IMAGES } from "../../gameLogic/deck";

export type BoardViewProps = {
  playerCount: number;
};

export default function BoardView({ playerCount }: BoardViewProps) {
  const boardImages = [BOARD_IMAGES.fascist, BOARD_IMAGES.liberal];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {boardImages.map((src) => (
        <img
          key={src}
          src={src}
          alt="Game board"
          style={{ width: "100%", maxWidth: 720, borderRadius: 12 }}
        />
      ))}
    </div>
  );
}
