export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "black",
        display: "grid",
        placeItems: "center",
      }}
    >
      <h1
        style={{
          color: "white",
          margin: 0,
          fontSize: "clamp(56px, 10vw, 120px)",
          fontFamily: "var(--font-eskapade-fraktur)",
          letterSpacing: "0.02em",
        }}
      >
        ZooKeeperSH
      </h1>
    </main>
  );
}
