import { useState, useEffect, useRef } from "react";

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
    const ctx = c.getContext("2d")!;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    let t = 0;
    const speed = 0.016;
    const duration = 4; // seconds

    // Project 3D point to 2D screen
    const project = (x: number, y: number, z: number, W: number, H: number) => {
      const fov = 300;
      const scale = fov / (z + fov);
      return { x: W / 2 + x * scale, y: H / 2 + y * scale, s: scale };
    };

    // Pre-generate torch positions (alternating left/right)
    const torches = Array.from({ length: 12 }, (_, i) => ({
      z: i * 200, side: i % 2 === 0 ? -1 : 1,
    }));

    // Pre-generate rock cracks
    const cracks = Array.from({ length: 30 }, () => ({
      x: (Math.random() - 0.5) * 500,
      y: (Math.random() - 0.5) * 400,
      z: Math.random() * 2400,
      len: 10 + Math.random() * 30,
      angle: Math.random() * Math.PI,
    }));

    const draw = () => {
      t += speed;
      const W = c.width, H = c.height;
      const cx = W / 2, cy = H / 2;
      const zOffset = t * 800; // how far we've traveled

      // Camera shake — bumpy mine cart
      const shakeX = Math.sin(t * 47) * 3 + Math.sin(t * 23) * 2;
      const shakeY = Math.abs(Math.sin(t * 31)) * 4;

      ctx.save();
      ctx.translate(shakeX, shakeY);

      // Dark background
      ctx.fillStyle = "#080604";
      ctx.fillRect(-10, -10, W + 20, H + 20);

      // Tunnel walls — draw back to front
      const segments = 24;
      const segLen = 120;
      for (let i = segments; i >= 0; i--) {
        const z = (i * segLen - (zOffset % segLen));
        if (z < 10) continue;
        const zNext = z + segLen;

        const tunnelW = 220, tunnelH = 180;

        // Four corners at this depth
        const tl = project(-tunnelW, -tunnelH, z, cx, cy);
        const tr = project(tunnelW, -tunnelH, z, cx, cy);
        const bl = project(-tunnelW, tunnelH, z, cx, cy);
        const br = project(tunnelW, tunnelH, z, cx, cy);
        // Four corners at next depth
        const tl2 = project(-tunnelW, -tunnelH, zNext, cx, cy);
        const tr2 = project(tunnelW, -tunnelH, zNext, cx, cy);
        const bl2 = project(-tunnelW, tunnelH, zNext, cx, cy);
        const br2 = project(tunnelW, tunnelH, zNext, cx, cy);

        const brightness = Math.max(0, 1 - z / (segments * segLen));
        const b = Math.floor(brightness * 40);

        // Ceiling
        ctx.fillStyle = `rgb(${b + 15},${b + 10},${b + 5})`;
        ctx.beginPath();
        ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y);
        ctx.lineTo(tr2.x, tr2.y); ctx.lineTo(tl2.x, tl2.y);
        ctx.fill();

        // Floor (slightly lighter — rail bed)
        ctx.fillStyle = `rgb(${b + 25},${b + 18},${b + 10})`;
        ctx.beginPath();
        ctx.moveTo(bl.x, bl.y); ctx.lineTo(br.x, br.y);
        ctx.lineTo(br2.x, br2.y); ctx.lineTo(bl2.x, bl2.y);
        ctx.fill();

        // Left wall
        ctx.fillStyle = `rgb(${b + 18},${b + 12},${b + 6})`;
        ctx.beginPath();
        ctx.moveTo(tl.x, tl.y); ctx.lineTo(bl.x, bl.y);
        ctx.lineTo(bl2.x, bl2.y); ctx.lineTo(tl2.x, tl2.y);
        ctx.fill();

        // Right wall
        ctx.fillStyle = `rgb(${b + 20},${b + 14},${b + 8})`;
        ctx.beginPath();
        ctx.moveTo(tr.x, tr.y); ctx.lineTo(br.x, br.y);
        ctx.lineTo(br2.x, br2.y); ctx.lineTo(tr2.x, tr2.y);
        ctx.fill();

        // Wooden support beams every other segment
        if (i % 3 === 0 && brightness > 0.05) {
          ctx.strokeStyle = `rgba(139,90,43,${brightness})`;
          ctx.lineWidth = Math.max(1, 6 * tl.s);
          // Left post
          ctx.beginPath(); ctx.moveTo(tl.x, tl.y); ctx.lineTo(bl.x, bl.y); ctx.stroke();
          // Right post
          ctx.beginPath(); ctx.moveTo(tr.x, tr.y); ctx.lineTo(br.x, br.y); ctx.stroke();
          // Top beam
          ctx.lineWidth = Math.max(1, 8 * tl.s);
          ctx.beginPath(); ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y); ctx.stroke();
          // Beam highlight
          ctx.strokeStyle = `rgba(180,130,70,${brightness * 0.4})`;
          ctx.lineWidth = Math.max(1, 2 * tl.s);
          ctx.beginPath(); ctx.moveTo(tl.x + 1, tl.y + 1); ctx.lineTo(tr.x - 1, tr.y + 1); ctx.stroke();
        }

        // Rails on floor
        if (brightness > 0.03) {
          const railL1 = project(-60, tunnelH - 10, z, cx, cy);
          const railL2 = project(-60, tunnelH - 10, zNext, cx, cy);
          const railR1 = project(60, tunnelH - 10, z, cx, cy);
          const railR2 = project(60, tunnelH - 10, zNext, cx, cy);
          ctx.strokeStyle = `rgba(160,160,170,${brightness * 0.7})`;
          ctx.lineWidth = Math.max(1, 3 * railL1.s);
          ctx.beginPath(); ctx.moveTo(railL1.x, railL1.y); ctx.lineTo(railL2.x, railL2.y); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(railR1.x, railR1.y); ctx.lineTo(railR2.x, railR2.y); ctx.stroke();
          // Rail ties (cross beams)
          if (i % 2 === 0) {
            ctx.strokeStyle = `rgba(100,70,40,${brightness * 0.6})`;
            ctx.lineWidth = Math.max(1, 4 * railL1.s);
            ctx.beginPath(); ctx.moveTo(railL1.x, railL1.y); ctx.lineTo(railR1.x, railR1.y); ctx.stroke();
          }
        }
      }

      // Torches on walls
      for (const torch of torches) {
        const tz = ((torch.z - zOffset) % 2400 + 2400) % 2400;
        if (tz < 20 || tz > 2200) continue;
        const tx = torch.side * 200;
        const p = project(tx, -40, tz, cx, cy);
        const brightness = Math.max(0, 1 - tz / 2400);
        if (brightness < 0.05) continue;

        // Torch stick
        ctx.fillStyle = `rgba(100,60,20,${brightness})`;
        const stickW = Math.max(1, 3 * p.s);
        ctx.fillRect(p.x - stickW / 2, p.y, stickW, 20 * p.s);

        // Flame
        const flicker = Math.sin(t * 12 + torch.z) * 3 * p.s;
        const flameSize = (4 + Math.sin(t * 8 + torch.z * 0.1) * 2) * p.s;
        ctx.fillStyle = `rgba(255,150,30,${brightness * 0.9})`;
        ctx.beginPath();
        ctx.ellipse(p.x + flicker, p.y - flameSize, flameSize * 0.7, flameSize, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,220,80,${brightness * 0.7})`;
        ctx.beginPath();
        ctx.ellipse(p.x + flicker * 0.5, p.y - flameSize * 0.8, flameSize * 0.3, flameSize * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Light glow on wall
        ctx.fillStyle = `rgba(255,150,50,${brightness * 0.08})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 60 * p.s, 0, Math.PI * 2);
        ctx.fill();
      }

      // Rock cracks / texture
      for (const crack of cracks) {
        const cz = ((crack.z - zOffset) % 2400 + 2400) % 2400;
        if (cz < 20) continue;
        const p = project(crack.x, crack.y, cz, cx, cy);
        const brightness = Math.max(0, 1 - cz / 2400);
        if (brightness < 0.1) continue;
        ctx.strokeStyle = `rgba(40,30,20,${brightness * 0.5})`;
        ctx.lineWidth = Math.max(0.5, 1.5 * p.s);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(crack.angle) * crack.len * p.s, p.y + Math.sin(crack.angle) * crack.len * p.s);
        ctx.stroke();
      }

      // Speed lines at edges
      ctx.strokeStyle = "rgba(200,168,78,0.15)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2;
        const r1 = Math.min(W, H) * 0.35;
        const r2 = Math.min(W, H) * 0.6;
        const x1 = cx + Math.cos(angle) * r1;
        const y1 = cy + Math.sin(angle) * r1;
        const x2 = cx + Math.cos(angle) * r2;
        const y2 = cy + Math.sin(angle) * r2;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }

      // Mine cart nose at bottom of screen
      const cartY = H - 80;
      // Cart body
      ctx.fillStyle = "#4a3520";
      ctx.beginPath();
      ctx.moveTo(cx - 120, cartY);
      ctx.lineTo(cx - 100, H);
      ctx.lineTo(cx + 100, H);
      ctx.lineTo(cx + 120, cartY);
      ctx.fill();
      // Cart rim
      ctx.strokeStyle = "#8a6a40";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 125, cartY - 2);
      ctx.lineTo(cx + 125, cartY - 2);
      ctx.stroke();
      // Metal bands
      ctx.strokeStyle = "#666";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 110, cartY + 10);
      ctx.lineTo(cx - 95, H - 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 110, cartY + 10);
      ctx.lineTo(cx + 95, H - 5);
      ctx.stroke();
      // Player hands gripping the cart
      ctx.fillStyle = "#f0d6b3";
      ctx.fillRect(cx - 80, cartY - 8, 14, 10);
      ctx.fillRect(cx + 66, cartY - 8, 14, 10);
      // Gloves
      ctx.fillStyle = "#8B6914";
      ctx.fillRect(cx - 82, cartY - 4, 18, 6);
      ctx.fillRect(cx + 64, cartY - 4, 18, 6);

      // Light at end of tunnel (grows as we approach)
      const endGlow = Math.min(1, t / duration);
      const glowR = 20 + endGlow * 200;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      grad.addColorStop(0, `rgba(255,224,102,${endGlow * 0.4})`);
      grad.addColorStop(0.5, `rgba(255,200,80,${endGlow * 0.1})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Vignette
      const vig = ctx.createRadialGradient(cx, cy, W * 0.2, cx, cy, W * 0.7);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.6)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      ctx.restore();

      if (t < duration) requestAnimationFrame(draw);
      else onEnter();
    };
    requestAnimationFrame(draw);
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
