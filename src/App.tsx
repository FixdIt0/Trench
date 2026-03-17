import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Game from "./components/Game";
import Landing from "./components/Landing";

export default function App() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const [entered, setEntered] = useState(false);

  // Landing page — before anything
  if (!entered) return <Landing onEnter={() => { setEntered(true); login(); }} />;

  if (!ready) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#000", color: "#555", fontFamily: "monospace" }}>
      Loading...
    </div>
  );

  if (!authenticated) return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      height: "100vh", background: "#0a0a12", fontFamily: "monospace", color: "#ccc",
    }}>
      <div style={{ fontSize: 48, fontWeight: 700, color: "#f0e6d3", letterSpacing: 4, marginBottom: 12 }}>TRENCH</div>
      <div style={{ fontSize: 14, color: "#666", marginBottom: 32 }}>Connect your wallet to enter the mine</div>
      <button
        onClick={login}
        style={{
          padding: "14px 40px", background: "#c8a84e", color: "#0d0d18", border: "none",
          borderRadius: 8, fontSize: 16, fontWeight: 700, fontFamily: "monospace",
          cursor: "pointer", letterSpacing: 1,
        }}
      >
        CONNECT & PLAY
      </button>
    </div>
  );

  const walletAddr = user?.wallet?.address;
  const truncAddr = walletAddr ? walletAddr.slice(0, 4) + ".." + walletAddr.slice(-4) : null;

  return (
    <>
      <Game walletAddr={walletAddr} />
      <div style={{
        position: "fixed", bottom: 16, right: 16, display: "flex", gap: 8,
        alignItems: "center", fontFamily: "monospace", fontSize: 12, zIndex: 20,
      }}>
        {truncAddr && <span style={{ color: "#888" }}>{truncAddr}</span>}
        <button
          onClick={logout}
          style={{
            padding: "6px 12px", background: "rgba(200,168,78,0.15)", color: "#c8a84e",
            border: "1px solid #c8a84e33", borderRadius: 6, fontSize: 11, fontFamily: "monospace",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>
    </>
  );
}
