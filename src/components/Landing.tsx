import { useState, useEffect, useRef } from "react";
import { runTunnelAnimation } from "./TunnelAnim";

const PARTICLES_COUNT = 60;

interface DustParticle {
  x: number; y: number; size: number; speed: number; opacity: number; drift: number;
}

function createParticles(): DustParticle[] {
  return Array.from({ length: PARTICLES_COUNT }, () => ({
    x: Math.random() * 100, y: Math.random() * 100,
    size: 1 + Math.random() * 3, speed: 0.1 + Math.random() * 0.3,
    opacity: 0.1 + Math.random() * 0.4, drift: (Math.random() - 0.5) * 0.1,
  }));
}

export default function Landing({ onEnter }: { onEnter: () => void }) {
  const [entering, setEntering] = useState(false);
  const [particles] = useState(createParticles);
  const [frame, setFrame] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animate particles
  useEffect(() => {
    const id = setInterval(() => setFrame(f => f + 1), 50);
    return () => clearInterval(id);
  }, []);

  // 3D Mine cart tunnel ride
  useEffect(() => {
    if (!entering) return;
    const c = canvasRef.current;
    if (!c) return;
    runTunnelAnimation(c, onEnter);
  }, [entering, onEnter]);

  const handleEnter = () => setEntering(true);

  if (entering) {
    return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, background: "#000", zIndex: 100 }} />;
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#060608", overflow: "hidden",
      fontFamily: "'Georgia', 'Times New Roman', serif",
    }}>
      {/* Animated dust particles */}
      {particles.map((p, i) => {
        const y = (p.y + frame * p.speed) % 110 - 5;
        const x = p.x + Math.sin(frame * 0.02 + i) * 2 + frame * p.drift;
        return (
          <div key={i} style={{
            position: "absolute", left: `${x}%`, top: `${y}%`,
            width: p.size, height: p.size, borderRadius: "50%",
            background: `rgba(200,168,78,${p.opacity})`,
            boxShadow: `0 0 ${p.size * 2}px rgba(200,168,78,${p.opacity * 0.5})`,
            pointerEvents: "none",
          }} />
        );
      })}

      {/* Dark gradient overlays */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse at 50% 30%, rgba(30,20,10,0.3) 0%, rgba(6,6,8,0.95) 70%)",
        pointerEvents: "none",
      }} />

      {/* Content */}
      <div style={{
        position: "relative", zIndex: 2, height: "100%",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "0 24px",
      }}>
        {/* Pickaxe icon */}
        <div style={{ fontSize: 48, marginBottom: 16, filter: "drop-shadow(0 0 20px rgba(200,168,78,0.4))" }}>⛏️</div>

        {/* Title */}
        <h1 style={{
          fontSize: "clamp(56px, 10vw, 120px)", fontWeight: 700,
          fontFamily: "'Georgia', serif",
          color: "transparent", margin: 0, lineHeight: 1,
          background: "linear-gradient(180deg, #f0e6d3 0%, #c8a84e 40%, #8a6a2e 100%)",
          WebkitBackgroundClip: "text", backgroundClip: "text",
          letterSpacing: "0.08em",
          textShadow: "0 0 60px rgba(200,168,78,0.3)",
          filter: "drop-shadow(0 4px 30px rgba(200,168,78,0.2))",
        }}>
          TRENCH
        </h1>

        {/* Decorative line */}
        <div style={{
          width: 120, height: 1, margin: "20px 0",
          background: "linear-gradient(90deg, transparent, #c8a84e, transparent)",
        }} />

        {/* Tagline */}
        <p style={{
          fontSize: "clamp(14px, 2vw, 18px)", color: "#8a7a5e",
          letterSpacing: "0.2em", textTransform: "uppercase",
          margin: "0 0 40px", fontFamily: "monospace",
        }}>
          Dig deep · Find treasure · Claim the prize
        </p>

        {/* Hidden treasure callout */}
        <div style={{
          maxWidth: 480, textAlign: "center", marginBottom: 48,
          padding: "24px 32px",
          border: "1px solid rgba(200,168,78,0.15)",
          borderRadius: 12,
          background: "rgba(200,168,78,0.03)",
          backdropFilter: "blur(10px)",
        }}>
          <div style={{
            fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase",
            color: "#c8a84e", marginBottom: 12, fontFamily: "monospace",
          }}>
            ◆ Hidden Treasure ◆
          </div>
          <p style={{
            fontSize: 15, color: "#a09080", lineHeight: 1.7, margin: 0,
            fontFamily: "'Georgia', serif",
          }}>
            Somewhere deep beneath the surface lies a legendary artifact.
            The first miner to discover it claims the{" "}
            <span style={{ color: "#c8a84e", fontWeight: 700 }}>entire creator fee prizepool</span>.
            No hints. No mercy. Only depth.
          </p>
        </div>

        {/* CTA Button */}
        <button
          onClick={handleEnter}
          style={{
            padding: "18px 56px",
            background: "linear-gradient(180deg, #c8a84e 0%, #9a7a30 100%)",
            color: "#0a0a08", border: "none", borderRadius: 8,
            fontSize: 16, fontWeight: 700, fontFamily: "monospace",
            letterSpacing: "0.15em", cursor: "pointer",
            boxShadow: "0 0 40px rgba(200,168,78,0.25), inset 0 1px 0 rgba(255,255,255,0.2)",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 0 60px rgba(200,168,78,0.4), inset 0 1px 0 rgba(255,255,255,0.2)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 0 40px rgba(200,168,78,0.25), inset 0 1px 0 rgba(255,255,255,0.2)"; }}
        >
          ENTER THE MINE SHAFT
        </button>

        {/* Subtle depth indicator */}
        <div style={{
          marginTop: 32, display: "flex", alignItems: "center", gap: 8,
          color: "#4a4030", fontSize: 11, fontFamily: "monospace", letterSpacing: "0.1em",
        }}>
          <div style={{ width: 1, height: 24, background: "linear-gradient(180deg, #c8a84e44, transparent)" }} />
          <span>Depth unknown</span>
          <div style={{ width: 1, height: 24, background: "linear-gradient(180deg, #c8a84e44, transparent)" }} />
        </div>

        {/* Bottom stats */}
        <div style={{
          position: "absolute", bottom: 32, display: "flex", gap: 48,
          color: "#3a3020", fontSize: 11, fontFamily: "monospace", letterSpacing: "0.1em",
        }}>
          <span>Solana-powered</span>
          <span>·</span>
          <span>Multiplayer</span>
          <span>·</span>
          <span>Procedural world</span>
        </div>
      </div>
    </div>
  );
}
