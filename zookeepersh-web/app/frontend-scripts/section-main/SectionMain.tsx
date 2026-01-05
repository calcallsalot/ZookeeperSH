"use client";

import CreateGame from "./CreateGame";
import LobbyList from "./LobbyList";

export default function SectionMain() {
  return (
    <section style={{ minWidth: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",          
          overflow: "visible",
          //border: "1px solid lime", t o see if it's loading game lobby header
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-comfortaa)",
            fontSize: 18,
            margin: 0,
            color: "white",
            flex: "1 1 auto",
            minWidth: 220,
          }}
        >
          Game Lobby
        </h1>

        <div style={{ flex: "0 0 auto" }}>
          <CreateGame />
        </div>
        {/*<div style={{ flex: "0 0 auto", border: "1px dashed cyan", padding: 4 }}>
          <span style={{ color: "white", marginRight: 8 }}>CreateGame mount </span>
          <CreateGame />
        </div>*/}

      </div>

      <div style={{ marginTop: 14 }}>
        <LobbyList />
      </div>
    </section>
  );
}
/*export default function SectionMain() {
  return (
    <div style={{ color: "white", padding: 20, border: "2px solid lime" }}>
      SectionMain is rendering 
    </div>
  );
}*/ 