import { useEffect, useRef, useState, useCallback } from "react";
import { createGameState, render, tryMove, tryDig, updateParticles, spawnAmbientParticles, updateAI, attackAI, buyUpgrade, UPGRADE_DEFS, type GameState, type InventoryItem, type Buffs, type Upgrades } from "../engine/game";
import { revealAround, TILE, getTile, TileType, WORLD_W } from "../engine/world";
import { useMultiplayer } from "../hooks/useMultiplayer";
import type { PlayerState } from "../engine/protocol";

const RARITY_COLORS: Record<string, string> = {
  common: "#aaa", uncommon: "#ffd700", rare: "#e0115f", epic: "#b9f2ff", legendary: "#ff6ec7",
};

const SLIDES = [
  { src: "/Start_game.mp4", label: "Dig & Explore", zoom: 0.5, startAt: 2 },
  { src: "/LIGHT.mp4", label: "Find Powerups", zoom: 0.7, startAt: 2 },
  { src: "/BOOM.mp4", label: "Blow Stuff Up", zoom: 0.7, startAt: 0 },
];

function GifCarousel() {
  const [idx, setIdx] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Cycle when video ends
  const onEnded = useCallback(() => setIdx(i => (i + 1) % SLIDES.length), []);
  const s = SLIDES[idx];

  useEffect(() => {
    const v = videoRef.current;
    if (v) { v.currentTime = s.startAt; v.play(); }
  }, [idx, s.startAt]);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ width: "100%", maxWidth: 420, height: 240, margin: "0 auto", borderRadius: 10, border: "1px solid #2a2a3e", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <video ref={videoRef} key={s.src} muted playsInline onEnded={onEnded} style={{ transform: `scale(${s.zoom})` }}>
          <source src={s.src} type="video/mp4" />
        </video>
      </div>
      <div style={{ fontSize: 13, color: "#c8a84e", marginTop: 8, fontWeight: 700 }}>{s.label}</div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
        {SLIDES.map((_, i) => (
          <div key={i} onClick={() => setIdx(i)} style={{
            width: 10, height: 10, borderRadius: "50%", cursor: "pointer",
            background: i === idx ? "#c8a84e" : "#333",
            transition: "background 0.2s",
          }} />
        ))}
      </div>
    </div>
  );
}

function renderOtherPlayers(ctx: CanvasRenderingContext2D, state: GameState, players: PlayerState[]) {
  for (const p of players) {
    const sx = Math.floor(p.x * TILE - state.camX);
    const sy = Math.floor(p.y * TILE - state.camY);

    // Only render if on screen
    if (sx < -TILE * 2 || sx > ctx.canvas.width + TILE || sy < -TILE * 2 || sy > ctx.canvas.height + TILE) continue;

    // Distance from local player for visibility
    const dist = Math.sqrt((p.x - state.px) ** 2 + (p.y - state.py) ** 2);
    if (dist > state.lightRadius + 2) continue;

    const alpha = Math.max(0.3, 1 - dist / (state.lightRadius + 2));
    ctx.globalAlpha = alpha;

    // Body (different color from local player)
    ctx.fillStyle = "#a0c4e8";
    ctx.fillRect(sx + 6, sy + 2, 12, 20);
    // Helmet
    ctx.fillStyle = "#6688aa";
    ctx.fillRect(sx + 4, sy + 1, 16, 8);
    // Headlamp
    ctx.fillStyle = "#88bbff";
    ctx.fillRect(sx + 9, sy + 2, 6, 4);

    // Sword indicator
    if (p.swordTier > 0) {
      ctx.strokeStyle = p.swordTier >= 3 ? "#b9f2ff" : p.swordTier >= 2 ? "#aaa" : "#8B7355";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx + 20, sy + 4);
      ctx.lineTo(sx + 26, sy + 16);
      ctx.stroke();
    }

    // Name label
    const label = p.id.slice(0, 4) + "..";
    ctx.font = "bold 9px monospace";
    ctx.fillStyle = "#88bbff";
    ctx.textAlign = "center";
    ctx.fillText(label, sx + TILE / 2, sy - 4);

    // HP bar
    const hpPct = p.hp / p.maxHp;
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(sx + 2, sy - 8, TILE - 4, 3);
    ctx.fillStyle = hpPct > 0.6 ? "#50c878" : hpPct > 0.3 ? "#ffa500" : "#ff4444";
    ctx.fillRect(sx + 2, sy - 8, (TILE - 4) * hpPct, 3);

    ctx.globalAlpha = 1;
  }
}

function BuffBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 11, color, marginBottom: 2 }}>{label} ({Math.ceil(value / 30)}s)</div>
      <div style={{ width: 120, height: 6, background: "#1a1a2e", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${(value / max) * 100}%`, height: "100%", borderRadius: 3, background: color }} />
      </div>
    </div>
  );
}

export default function Game({ walletAddr }: { walletAddr?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createGameState());
  const keysRef = useRef<Set<string>>(new Set());
  const [depth, setDepth] = useState(0);
  const [balance, setBalance] = useState(0);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [showInv, setShowInv] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const [showShop, setShowShop] = useState(false);
  const [light, setLight] = useState(6);
  const [hp, setHp] = useState(10);
  const [invincible, setInvincible] = useState(0);
  const [buffs, setBuffs] = useState<Buffs>({ speed: 0, shield: 0, magnet: 0 });
  const [upgrades, setUpgrades] = useState<Upgrades>({ pickaxe: 0, sword: 0, lamp: 0, armor: 0 });
  const [showLB, setShowLB] = useState(false);
  const [lbSort, setLbSort] = useState<"points" | "kills">("points");
  const tickRef = useRef(0);
  const { otherPlayers, allPlayers, killFeed, sendMove, sendAttack } = useMultiplayer(walletAddr);
  const otherPlayersRef = useRef<PlayerState[]>([]);

  useEffect(() => { otherPlayersRef.current = otherPlayers; }, [otherPlayers]);

  const resize = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize]);

  useEffect(() => {
    const s = stateRef.current;
    revealAround(s.px, s.py, s.lightRadius);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Tab") { e.preventDefault(); setShowInv(v => !v); setShowShop(false); return; }
      if (e.key === "e" || e.key === "E") { setShowShop(v => !v); setShowInv(false); return; }
      keysRef.current.add(e.key.toLowerCase());
    };
    const offKey = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", offKey);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", offKey); };
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    let raf = 0;

    const loop = () => {
      const s = stateRef.current;
      const keys = keysRef.current;
      tickRef.current++;

      // AI update every 2 frames
      if (tickRef.current % 2 === 0) updateAI(s);

      // Movement — every 15 frames (~4/sec)
      if (tickRef.current % 15 === 0) {
        let dx = 0, dy = 0;
        if (keys.has("a") || keys.has("arrowleft")) dx = -1;
        else if (keys.has("d") || keys.has("arrowright")) dx = 1;
        else if (keys.has("s") || keys.has("arrowdown")) dy = 1;
        else if (keys.has("w") || keys.has("arrowup")) dy = -1;

        if (dx !== 0 || dy !== 0) {
          if (!tryMove(s, dx, dy)) tryDig(s, dx, dy);
        }

        if (keys.has(" ")) {
          if (!tryMove(s, 0, 1)) tryDig(s, 0, 1);
        }

        if (s.lightRadius > s.baseLightRadius) s.lightRadius = Math.max(s.baseLightRadius, s.lightRadius - 0.01);
      }

      setDepth(s.maxDepth);
      setBalance(s.balance);
      setHp(s.hp);
      setInvincible(s.invincible);
      setInventory([...s.inventory.values()]);
      setLight(s.lightRadius);
      setBuffs({ ...s.buffs });
      setUpgrades({ ...s.upgrades });

      // Send position to server every 10 frames
      if (tickRef.current % 10 === 0) {
        sendMove(s.px, s.py, s.hp, false, s.upgrades.sword, s.totalEarned, s.maxDepth);
      }

      updateParticles(s);
      spawnAmbientParticles(s);
      render(ctx, s, c.width, c.height);

      // Render other players
      renderOtherPlayers(ctx, s, otherPlayersRef.current);

      // Minimap
      const mc = minimapRef.current;
      if (mc && tickRef.current % 10 === 0) {
        const mctx = mc.getContext("2d")!;
        mctx.fillStyle = "#0a0a12";
        mctx.fillRect(0, 0, 120, 120);
        const mR = 30; // tiles radius
        for (let dy = -mR; dy <= mR; dy++) {
          for (let dx = -mR; dx <= mR; dx++) {
            const tx = s.px + dx, ty = s.py + dy;
            const t = getTile(tx, ty);
            if (!t.revealed) continue;
            const mx = 60 + dx * 2, my = 60 + dy * 2;
            if (mx < 0 || mx >= 120 || my < 0 || my >= 120) continue;
            if (t.type === TileType.Air) { mctx.fillStyle = "#111"; }
            else if (t.type === TileType.Lava) { mctx.fillStyle = "#ff4500"; }
            else if (t.type === TileType.Water) { mctx.fillStyle = "#1a5276"; }
            else if (t.type === TileType.SpikeTrap) { mctx.fillStyle = "#888"; }
            else { mctx.fillStyle = "#333"; }
            mctx.fillRect(mx, my, 2, 2);
          }
        }
        // Player dot
        mctx.fillStyle = "#ffd700";
        mctx.fillRect(59, 59, 3, 3);
        // AI entities
        for (const e of s.aiEntities) {
          if (e.dead) continue;
          const edx = e.x - s.px, edy = e.y - s.py;
          if (Math.abs(edx) > mR || Math.abs(edy) > mR) continue;
          mctx.fillStyle = e.type === "fighter" ? "#ff4444" : e.type === "miner" ? "#4488ff" : "#44cc44";
          mctx.fillRect(60 + edx * 2, 60 + edy * 2, 2, 2);
        }
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sendMove]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const s = stateRef.current;
    const worldX = Math.floor((e.clientX + s.camX) / TILE);
    const worldY = Math.floor((e.clientY + s.camY) / TILE);
    const dx = worldX - s.px, dy = worldY - s.py;
    const adx = Math.abs(dx), ady = Math.abs(dy);
    if ((adx + ady === 1) && adx <= 1 && ady <= 1) {
      // Attack AI entity?
      if (attackAI(s, worldX, worldY)) return;
      // Attack other player?
      if (s.upgrades.sword > 0) {
        const target = otherPlayersRef.current.find(p => p.x === worldX && p.y === worldY);
        if (target) { sendAttack(target.id); return; }
      }
      if (!tryMove(s, dx, dy)) tryDig(s, dx, dy);
    }
  }, [sendAttack]);

  const depthLabel = depth < 25 ? "Surface" : depth < 70 ? "Stone Layer" :
    depth < 130 ? "Deep Stone" : depth < 200 ? "Crystal Caverns" :
    depth < 280 ? "Obsidian Depths" : "Ancient Ruins";

  const depthColor = depth < 25 ? "#8B7355" : depth < 70 ? "#6b6b7b" :
    depth < 130 ? "#4a4a5e" : depth < 200 ? "#9966cc" :
    depth < 280 ? "#1a1a2e" : "#ff6ec7";

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#000", cursor: "crosshair" }}>
      <canvas ref={canvasRef} onClick={handleClick} style={{ display: "block" }} />

      {/* HUD */}
      <div style={{ position: "absolute", top: 16, left: 16, color: "#fff", fontFamily: "monospace", pointerEvents: "none" }}>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 2 }}>TRENCH</div>
        <div style={{ fontSize: 14, color: depthColor, marginTop: 4 }}>{depthLabel}</div>
        <div style={{ fontSize: 20, marginTop: 8 }}>
          <span style={{ color: "#888" }}>Depth:</span>{" "}
          <span style={{ color: "#f0e6d3" }}>{depth}m</span>
        </div>
        <div style={{ fontSize: 16, marginTop: 4 }}>
          <span style={{ color: "#888" }}>Balance:</span>{" "}
          <span style={{ color: "#ffd700" }}>{balance}</span>
        </div>
        {/* HP bar */}
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: invincible > 0 ? "#4488ff" : "#888", marginBottom: 3 }}>
            {invincible > 0 ? "🛡️ INVINCIBLE" : "HP"} {hp.toFixed(1)}/{10}
          </div>
          <div style={{ width: 120, height: 8, background: "#1a1a2e", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              width: `${(hp / 10) * 100}%`, height: "100%", borderRadius: 4,
              background: hp > 6 ? "#50c878" : hp > 3 ? "#ffa500" : "#ff4444",
              transition: "width 0.15s",
            }} />
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 3 }}>Light</div>
          <div style={{ width: 120, height: 8, background: "#1a1a2e", borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              width: `${((light - 5) / 7) * 100}%`, height: "100%", borderRadius: 4,
              background: light > 9 ? "#ffe066" : light > 7 ? "#c8a84e" : "#665530",
              transition: "width 0.3s",
            }} />
          </div>
        </div>
        {buffs.speed > 0 && <BuffBar label="Speed 2x" value={buffs.speed} max={600} color="#33ffaa" />}
        {buffs.shield > 0 && <BuffBar label="Shield" value={buffs.shield} max={600} color="#4488ff" />}
        {buffs.magnet > 0 && <BuffBar label="Magnet" value={buffs.magnet} max={600} color="#ff8800" />}
      </div>

      {/* Leaderboard toggle */}
      <button
        onClick={() => setShowLB(v => !v)}
        style={{
          position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
          padding: "6px 16px", background: showLB ? "#c8a84e" : "rgba(200,168,78,0.15)",
          color: showLB ? "#0d0d18" : "#c8a84e", border: "1px solid #c8a84e33",
          borderRadius: 6, fontSize: 11, fontFamily: "monospace", fontWeight: 700, cursor: "pointer", zIndex: 5,
        }}
      >
        🏆 LEADERBOARD
      </button>

      {/* Leaderboard panel */}
      {showLB && (
        <div style={{
          position: "absolute", top: 44, left: "50%", transform: "translateX(-50%)",
          background: "rgba(10,10,20,0.95)", border: "1px solid #333", borderRadius: 10,
          padding: 16, minWidth: 300, fontFamily: "monospace", color: "#ccc", fontSize: 12, zIndex: 5,
        }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {(["points", "kills"] as const).map(s => (
              <button key={s} onClick={() => setLbSort(s)} style={{
                padding: "4px 12px", borderRadius: 4, border: "none", fontFamily: "monospace", fontSize: 11,
                background: lbSort === s ? "#c8a84e" : "#222", color: lbSort === s ? "#0d0d18" : "#888", cursor: "pointer",
              }}>{s === "points" ? "Points" : "Kills"}</button>
            ))}
          </div>
          {[...allPlayers].sort((a, b) => lbSort === "kills" ? b.kills - a.kills : b.totalEarned - a.totalEarned).map((p, i) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #1a1a2e", color: p.id === walletAddr ? "#c8a84e" : "#aaa" }}>
              <span>{i + 1}. {p.id.slice(0, 4)}..{p.id.slice(-4)}</span>
              <span>{lbSort === "kills" ? `${p.kills} kills` : `${p.totalEarned} pts`} · {p.depth}m</span>
            </div>
          ))}
          {allPlayers.length === 0 && <div style={{ color: "#555" }}>No players online</div>}
        </div>
      )}

      {/* Kill feed */}
      {killFeed.length > 0 && (
        <div style={{ position: "absolute", top: 16, right: 16, fontFamily: "monospace", fontSize: 11, pointerEvents: "none", zIndex: 5 }}>
          {killFeed.map((e, i) => (
            <div key={i} style={{ color: e.text.includes("☠") ? "#ff4444" : "#ffa500", marginBottom: 4, opacity: 1 - i * 0.15 }}>
              {e.text}
            </div>
          ))}
        </div>
      )}

      {/* Shop button */}
      <button
        onClick={() => { setShowShop(v => !v); setShowInv(false); }}
        style={{
          position: "absolute", bottom: 50, right: 16, padding: "8px 16px",
          background: showShop ? "#c8a84e" : "rgba(200,168,78,0.15)", color: showShop ? "#0d0d18" : "#c8a84e",
          border: "1px solid #c8a84e", borderRadius: 8, fontFamily: "monospace", fontSize: 13,
          fontWeight: 700, cursor: "pointer", letterSpacing: 1,
        }}
      >
        ⛏️ SHOP
      </button>

      {/* Minimap */}
      <canvas
        ref={minimapRef}
        width={120} height={120}
        style={{
          position: "absolute", bottom: 50, left: 16,
          border: "1px solid #333", borderRadius: 6,
          background: "rgba(0,0,0,0.8)", imageRendering: "pixelated",
        }}
      />

      {/* Controls hint */}
      <div style={{ position: "absolute", bottom: 16, left: 150, color: "#555", fontFamily: "monospace", fontSize: 12, pointerEvents: "none" }}>
        WASD to move & dig · Space to dig down · Click adjacent tiles · Tab inventory · E shop
      </div>

      {/* Mini inventory bar */}
      {inventory.length > 0 && !showInv && (
        <div style={{ position: "absolute", top: 52, right: 16, display: "flex", gap: 6, pointerEvents: "none" }}>
          {inventory.slice(-5).map(item => (
            <div key={item.name} style={{
              background: "rgba(0,0,0,0.7)", border: `1px solid ${item.color}`, borderRadius: 6,
              padding: "4px 8px", fontFamily: "monospace", fontSize: 12, color: item.color,
            }}>
              {item.count}× {item.name}
            </div>
          ))}
        </div>
      )}

      {/* Full inventory */}
      {showInv && (
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          background: "rgba(10,10,20,0.95)", border: "1px solid #333", borderRadius: 12,
          padding: 24, minWidth: 300, fontFamily: "monospace", color: "#fff",
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, borderBottom: "1px solid #333", paddingBottom: 8 }}>
            Inventory
          </div>
          {inventory.length === 0 && <div style={{ color: "#555" }}>Empty — start digging!</div>}
          {inventory.map(item => (
            <div key={item.name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1a1a2e" }}>
              <span style={{ color: RARITY_COLORS[item.rarity] || "#aaa" }}>
                {item.name} <span style={{ color: "#555", fontSize: 11 }}>({item.rarity})</span>
              </span>
              <span style={{ color: item.color }}>×{item.count} <span style={{ color: "#ffd700", fontSize: 11 }}>({item.count * item.value})</span></span>
            </div>
          ))}
          <div style={{ marginTop: 12, textAlign: "right", color: "#ffd700", fontSize: 16 }}>
            Balance: {balance}
          </div>
          <div style={{ marginTop: 8, color: "#555", fontSize: 11, textAlign: "center" }}>Press Tab to close</div>
        </div>
      )}

      {/* Shop */}
      {showShop && (
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          background: "rgba(10,10,20,0.95)", border: "1px solid #333", borderRadius: 12,
          padding: 24, minWidth: 340, fontFamily: "monospace", color: "#fff",
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, borderBottom: "1px solid #333", paddingBottom: 8 }}>
            Upgrades
          </div>
          <div style={{ fontSize: 12, color: "#ffd700", marginBottom: 16 }}>Balance: {balance}</div>
          {(Object.keys(UPGRADE_DEFS) as (keyof Upgrades)[]).map(key => {
            const def = UPGRADE_DEFS[key];
            const tier = upgrades[key];
            const next = tier + 1 < def.tiers.length ? def.tiers[tier + 1] : null;
            const current = def.tiers[tier];
            return (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1a1a2e" }}>
                <div>
                  <div style={{ fontSize: 13 }}>{current.icon} {current.name}</div>
                  {next && <div style={{ fontSize: 11, color: "#666" }}>Next: {next.name}</div>}
                </div>
                {next ? (
                  <button
                    onClick={() => {
                      if (buyUpgrade(stateRef.current, key)) {
                        setBalance(stateRef.current.balance);
                        setUpgrades({ ...stateRef.current.upgrades });
                        setLight(stateRef.current.lightRadius);
                      }
                    }}
                    style={{
                      padding: "6px 14px", borderRadius: 6, border: "none", fontFamily: "monospace",
                      fontSize: 12, fontWeight: 700, cursor: balance >= next.cost ? "pointer" : "not-allowed",
                      background: balance >= next.cost ? "#c8a84e" : "#333",
                      color: balance >= next.cost ? "#0d0d18" : "#666",
                    }}
                  >
                    {next.cost}
                  </button>
                ) : (
                  <span style={{ color: "#50c878", fontSize: 11 }}>MAX</span>
                )}
              </div>
            );
          })}
          <div style={{ marginTop: 8, color: "#555", fontSize: 11, textAlign: "center" }}>Press E to close</div>
        </div>
      )}

      {/* How to play */}
      {showHelp && (
        <div style={{
          position: "absolute", inset: 0, background: "rgba(0,0,0,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10,
        }}>
          <div style={{
            background: "#0d0d18", border: "1px solid #2a2a3e", borderRadius: 16,
            padding: "36px 40px", maxWidth: 560, fontFamily: "monospace", color: "#ccc", textAlign: "center",
          }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#f0e6d3", letterSpacing: 3, marginBottom: 8 }}>TRENCH</div>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>Dig deep. Find treasure. How far can you go?</div>

            {/* GIF carousel */}
            <GifCarousel />

            <div style={{ textAlign: "left", lineHeight: 2, fontSize: 13 }}>
              <div><span style={{ color: "#c8a84e" }}>W A S D</span> — Move & dig</div>
              <div><span style={{ color: "#c8a84e" }}>Space</span> — Dig straight down</div>
              <div><span style={{ color: "#c8a84e" }}>Tab</span> — Inventory · <span style={{ color: "#c8a84e" }}>E</span> — Shop</div>
              <div style={{ marginTop: 8, borderTop: "1px solid #1a1a2e", paddingTop: 8, fontSize: 12, color: "#666" }}>
                Glowing tiles = valuable · Mushrooms boost light · Collect loot to buy upgrades
              </div>
            </div>
            <button
              onClick={() => setShowHelp(false)}
              style={{
                marginTop: 24, padding: "12px 36px", background: "#c8a84e", color: "#0d0d18",
                border: "none", borderRadius: 8, fontSize: 16, fontWeight: 700, fontFamily: "monospace",
                cursor: "pointer", letterSpacing: 1,
              }}
            >
              START DIGGING
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
