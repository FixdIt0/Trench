import { useState, useEffect, useRef } from "react";
import { runTunnelAnimation } from "./TunnelAnim";
import { preloadAudio, playMinecart } from "../engine/audio";

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
  const [copied, setCopied] = useState(false);
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

  const handleEnter = () => { preloadAudio(); playMinecart(); setEntering(true); };

  // Flickering lantern cursor
  const lanternRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (entering) return;
    const lc = lanternRef.current;
    if (!lc) return;
    const lctx = lc.getContext("2d")!;
    let mx = -100, my = -100, af = 0;
    const onMove = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; };
    window.addEventListener("mousemove", onMove);
    const draw = () => {
      af++;
      lc.width = window.innerWidth;
      lc.height = window.innerHeight;
      lctx.clearRect(0, 0, lc.width, lc.height);
      if (mx < 0) { requestAnimationFrame(draw); return; }
      const flicker = 0.8 + Math.sin(af * 0.15) * 0.1 + Math.sin(af * 0.37) * 0.1;
      const r = 90 * flicker;
      // Glow
      const g = lctx.createRadialGradient(mx, my, 0, mx, my, r);
      g.addColorStop(0, `rgba(255,180,60,${0.12 * flicker})`);
      g.addColorStop(0.5, `rgba(255,140,30,${0.05 * flicker})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      lctx.fillStyle = g;
      lctx.beginPath(); lctx.arc(mx, my, r, 0, Math.PI * 2); lctx.fill();
      // Lantern body
      lctx.fillStyle = "#8a6a30";
      lctx.fillRect(mx - 3, my - 2, 6, 10);
      // Handle
      lctx.strokeStyle = "#6a5020";
      lctx.lineWidth = 1.5;
      lctx.beginPath(); lctx.arc(mx, my - 5, 4, Math.PI, 0); lctx.stroke();
      // Flame
      const fh = (4 + Math.sin(af * 0.2) * 1.5) * flicker;
      lctx.fillStyle = `rgba(255,200,60,${0.9 * flicker})`;
      lctx.beginPath(); lctx.ellipse(mx, my - 1 - fh * 0.3, 2, fh, 0, 0, Math.PI * 2); lctx.fill();
      lctx.fillStyle = `rgba(255,240,150,${0.7 * flicker})`;
      lctx.beginPath(); lctx.ellipse(mx, my - 1 - fh * 0.2, 1, fh * 0.5, 0, 0, Math.PI * 2); lctx.fill();
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
    return () => window.removeEventListener("mousemove", onMove);
  }, [entering]);

  if (entering) {
    return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, background: "#000", zIndex: 100 }} />;
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#060608", overflow: "hidden",
      fontFamily: "'Georgia', 'Times New Roman', serif",
      cursor: "none",
    }}>
      {/* Lantern cursor overlay */}
      <canvas ref={lanternRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 50 }} />
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
        {/* Logo — big, centered, full viewport width */}
        <img src="/logo.png" alt="TRENCH" style={{
          width: "clamp(300px, 70vw, 900px)", maxHeight: "30vh",
          objectFit: "contain",
          filter: "drop-shadow(0 0 40px rgba(200,168,78,0.3))",
          marginBottom: 16,
        }} />

        {/* Tagline */}
        <p style={{
          fontSize: "clamp(14px, 2vw, 18px)", color: "#8a7a5e",
          letterSpacing: "0.2em", textTransform: "uppercase",
          margin: "0 0 36px", fontFamily: "monospace",
        }}>
          Dig deep · Find treasure · Claim the prize
        </p>

        {/* Hidden treasure callout */}
        <div style={{
          maxWidth: 480, textAlign: "center", marginBottom: 40,
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
            50% of creator fees fuel{" "}
            <span style={{ color: "#c8a84e", fontWeight: 700 }}>agent buybacks</span>.
            The other 50% fills the{" "}
            <span style={{ color: "#c8a84e", fontWeight: 700 }}>prize pool</span>
            {" "}— and the first miner to unearth it claims it all.
            No hints. No mercy. Only depth.
          </p>
        </div>

        {/* Features grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12,
          maxWidth: 560, width: "100%", marginBottom: 40,
        }}>
          {[
            { icon: "⛏️", title: "Upgrade Tools", desc: "6 pickaxe tiers. Mine faster, dig deeper." },
            { icon: "🗡️", title: "Sword Combat", desc: "Attack miners. Steal their glory." },
            { icon: "🛡️", title: "Find Shields", desc: "Walk through lava. Survive the depths." },
            { icon: "💎", title: "Rare Ores", desc: "Diamond, Ruby, Emerald. Sell for upgrades." },
            { icon: "💣", title: "Dynamite", desc: "Blast 3-tile radius. Clear entire caves." },
            { icon: "🕷️", title: "Fight Mobs", desc: "Bats, slimes, spiders. They hunt you." },
          ].map((f, i) => (
            <div key={i} style={{
              padding: "16px 12px", textAlign: "center",
              border: "1px solid rgba(200,168,78,0.08)", borderRadius: 8,
              background: "rgba(200,168,78,0.02)",
            }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{f.icon}</div>
              <div style={{ fontSize: 11, color: "#c8a84e", fontFamily: "monospace", letterSpacing: "0.05em", marginBottom: 4 }}>{f.title}</div>
              <div style={{ fontSize: 11, color: "#6a5a4a", fontFamily: "'Georgia', serif", lineHeight: 1.4 }}>{f.desc}</div>
            </div>
          ))}
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

        {/* CA + X link */}
        <div style={{
          marginTop: 28, display: "flex", alignItems: "center", gap: 20,
          fontFamily: "monospace", fontSize: 12,
        }}>
          <span
            onClick={() => { navigator.clipboard.writeText("F8KqRqh1SWRDPcvDnTWvjFS87bEjzvf4C1e94ofKpump"); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            style={{
              color: "#6a5a3a", cursor: "pointer", padding: "6px 14px",
              border: "1px solid rgba(200,168,78,0.15)", borderRadius: 6,
              background: "rgba(200,168,78,0.03)",
              transition: "color 0.2s",
            }}
            onMouseEnter={e => e.currentTarget.style.color = "#c8a84e"}
            onMouseLeave={e => e.currentTarget.style.color = "#6a5a3a"}
          >
            CA: F8Kq...pump {copied ? "✓ Copied" : "📋"}
          </span>
          <a href="https://x.com/TrenchTreasures" target="_blank" rel="noopener noreferrer" style={{
            color: "#6a5a3a", textDecoration: "none", padding: "6px 14px",
            border: "1px solid rgba(200,168,78,0.15)", borderRadius: 6,
            background: "rgba(200,168,78,0.03)",
            transition: "color 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.color = "#c8a84e"}
            onMouseLeave={e => e.currentTarget.style.color = "#6a5a3a"}
          >
            𝕏
          </a>
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
