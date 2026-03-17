import { TILE, TileType, getTile, getTileColor, isMineable, isLoot, getLootDrop, setTile, revealAround, getLayerBg, WORLD_W, type LootDrop } from "./world";
import { fractalNoise } from "./noise";

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number;
}

export interface FloatingText {
  x: number; y: number; text: string; color: string; life: number; vy: number;
}

export interface InventoryItem { name: string; count: number; color: string; rarity: string; value: number; }

export interface Buffs {
  speed: number;   // ticks remaining for 2x dig power
  shield: number;  // ticks remaining for lava immunity
  magnet: number;  // ticks remaining for ore reveal
}

export interface GameState {
  px: number; py: number;
  camX: number; camY: number;
  particles: Particle[];
  floatingTexts: FloatingText[];
  inventory: Map<string, InventoryItem>;
  balance: number;
  maxDepth: number;
  hp: number;
  maxHp: number;
  falling: boolean;
  fallCount: number;
  digPower: number;
  lightRadius: number;
  baseLightRadius: number;
  digging: { x: number; y: number; progress: number; maxHp: number } | null;
  swing: { angle: number; timer: number; dirX: number; dirY: number };
  buffs: Buffs;
  upgrades: Upgrades;
  gameTime: number;
  ambientParticles: Particle[];
}

export interface Upgrade {
  name: string; tiers: { name: string; cost: number; icon: string }[];
}

export interface Upgrades {
  pickaxe: number; // tier index
  sword: number;
  lamp: number;
  armor: number;
}

export const UPGRADE_DEFS: Record<keyof Upgrades, Upgrade> = {
  pickaxe: { name: "Pickaxe", tiers: [
    { name: "Wooden Pickaxe", cost: 0, icon: "⛏️" },
    { name: "Stone Pickaxe", cost: 50, icon: "⛏️" },
    { name: "Iron Pickaxe", cost: 200, icon: "⛏️" },
    { name: "Gold Pickaxe", cost: 500, icon: "⛏️" },
    { name: "Diamond Pickaxe", cost: 1200, icon: "⛏️" },
    { name: "Crystal Pickaxe", cost: 3000, icon: "⛏️" },
  ]},
  sword: { name: "Sword", tiers: [
    { name: "No Sword", cost: 0, icon: "🗡️" },
    { name: "Stone Sword", cost: 100, icon: "🗡️" },
    { name: "Iron Sword", cost: 350, icon: "🗡️" },
    { name: "Diamond Sword", cost: 900, icon: "🗡️" },
  ]},
  lamp: { name: "Lamp", tiers: [
    { name: "Candle", cost: 0, icon: "🔦" },
    { name: "Lantern", cost: 150, icon: "🔦" },
    { name: "Miner's Lamp", cost: 500, icon: "🔦" },
    { name: "Floodlight", cost: 1500, icon: "🔦" },
  ]},
  armor: { name: "Armor", tiers: [
    { name: "No Armor", cost: 0, icon: "🛡️" },
    { name: "Leather Armor", cost: 120, icon: "🛡️" },
    { name: "Iron Armor", cost: 400, icon: "🛡️" },
    { name: "Diamond Armor", cost: 1000, icon: "🛡️" },
  ]},
};

export function buyUpgrade(state: GameState, key: keyof Upgrades): boolean {
  const def = UPGRADE_DEFS[key];
  const next = state.upgrades[key] + 1;
  if (next >= def.tiers.length) return false;
  const cost = def.tiers[next].cost;
  if (state.balance < cost) return false;
  state.balance -= cost;
  state.upgrades[key] = next;
  // Apply effects
  if (key === "pickaxe") state.digPower = 1 + next;
  if (key === "lamp") { state.baseLightRadius = 6 + next * 2; state.lightRadius = Math.max(state.lightRadius, state.baseLightRadius); }
  return true;
}

export function createGameState(): GameState {
  return {
    px: Math.floor(WORLD_W / 2), py: -1,
    camX: Math.floor(WORLD_W / 2) * TILE, camY: -TILE,
    particles: [], floatingTexts: [],
    inventory: new Map(), balance: 0, maxDepth: 0,
    hp: 10, maxHp: 10, falling: false, fallCount: 0,
    digPower: 1, lightRadius: 6, baseLightRadius: 6, digging: null,
    swing: { angle: 0, timer: 0, dirX: 1, dirY: 1 },
    buffs: { speed: 0, shield: 0, magnet: 0 },
    upgrades: { pickaxe: 0, sword: 0, lamp: 0, armor: 0 },
    gameTime: 0, ambientParticles: [],
  };
}

export function spawnDigParticles(state: GameState, wx: number, wy: number, color: string) {
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    state.particles.push({
      x: wx * TILE + TILE / 2, y: wy * TILE + TILE / 2,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2,
      life: 30 + Math.random() * 20, maxLife: 50, color, size: 2 + Math.random() * 3,
    });
  }
}

export function spawnLootParticles(state: GameState, wx: number, wy: number, color: string) {
  for (let i = 0; i < 16; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    state.particles.push({
      x: wx * TILE + TILE / 2, y: wy * TILE + TILE / 2,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 3,
      life: 40 + Math.random() * 30, maxLife: 70, color, size: 3 + Math.random() * 4,
    });
  }
}

export function addFloatingText(state: GameState, wx: number, wy: number, text: string, color: string) {
  state.floatingTexts.push({ x: wx * TILE + TILE / 2, y: wy * TILE, text, color, life: 60, vy: -1.5 });
}

export function collectLoot(state: GameState, drop: LootDrop) {
  const existing = state.inventory.get(drop.name);
  if (existing) existing.count++;
  else state.inventory.set(drop.name, { name: drop.name, count: 1, color: drop.color, rarity: drop.rarity, value: drop.value });
  state.balance += drop.value;
}

export function tryMove(state: GameState, dx: number, dy: number): boolean {
  const nx = state.px + dx, ny = state.py + dy;
  if (nx < 0 || nx >= WORLD_W) return false;
  const tile = getTile(nx, ny);
  const walkable = tile.type === TileType.Air || tile.type === TileType.Water ||
    tile.type === TileType.Mushroom || tile.type === TileType.Dynamite ||
    tile.type === TileType.SpeedPotion || tile.type === TileType.Shield || tile.type === TileType.Magnet;
  if (!walkable) return false;

  // Pickup powerups
  if (tile.type === TileType.Mushroom) {
    addFloatingText(state, nx, ny, "+Light", "#8b5e83");
    spawnLootParticles(state, nx, ny, "#8b5e83");
    state.lightRadius = Math.min(12, state.lightRadius + 1.5);
  } else if (tile.type === TileType.Dynamite) {
    addFloatingText(state, nx, ny, "BOOM!", "#ff3333");
    blastRadius(state, nx, ny, 3);
  } else if (tile.type === TileType.SpeedPotion) {
    addFloatingText(state, nx, ny, "2x Dig Speed!", "#33ffaa");
    spawnLootParticles(state, nx, ny, "#33ffaa");
    state.buffs.speed = Math.min(600, state.buffs.speed + 300); // ~10 sec
  } else if (tile.type === TileType.Shield) {
    addFloatingText(state, nx, ny, "Lava Shield!", "#4488ff");
    spawnLootParticles(state, nx, ny, "#4488ff");
    state.buffs.shield = Math.min(600, state.buffs.shield + 300);
  } else if (tile.type === TileType.Magnet) {
    addFloatingText(state, nx, ny, "Ore Magnet!", "#ff8800");
    spawnLootParticles(state, nx, ny, "#ff8800");
    state.buffs.magnet = Math.min(600, state.buffs.magnet + 300);
    revealOresNearby(state, nx, ny, 8);
  }
  if (tile.type !== TileType.Air && tile.type !== TileType.Water) {
    setTile(nx, ny, { type: TileType.Air, revealed: true, hp: 0 });
  }

  state.px = nx; state.py = ny;
  if (ny > state.maxDepth) state.maxDepth = ny;
  revealAround(nx, ny, state.lightRadius);
  return true;
}

function blastRadius(state: GameState, cx: number, cy: number, r: number) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const t = getTile(cx + dx, cy + dy);
      if (isMineable(t.type)) {
        if (isLoot(t.type)) {
          const drop = getLootDrop(t.type);
          if (drop) { collectLoot(state, drop); addFloatingText(state, cx + dx, cy + dy, `+${drop.value}`, drop.color); }
        }
        spawnDigParticles(state, cx + dx, cy + dy, getTileColor(t.type));
        setTile(cx + dx, cy + dy, { type: TileType.Air, revealed: true, hp: 0 });
      }
    }
  }
  // Big explosion particles
  for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 5;
    state.particles.push({
      x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2,
      life: 40 + Math.random() * 30, maxLife: 70, color: "#ff3333", size: 3 + Math.random() * 5,
    });
  }
}

function revealOresNearby(state: GameState, cx: number, cy: number, r: number) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const t = getTile(cx + dx, cy + dy);
      if (isLoot(t.type) && !t.revealed) {
        t.revealed = true;
        t.glow = Math.max(t.glow || 0, 0.8);
        setTile(cx + dx, cy + dy, t);
        spawnLootParticles(state, cx + dx, cy + dy, getTileColor(t.type));
      }
    }
  }
}

const CHEST_LOOT_TABLE: { drop: LootDrop; weight: number }[] = [
  { drop: { name: "Gold Pile", value: 30, color: "#ffd700", rarity: "uncommon" }, weight: 30 },
  { drop: { name: "Ruby Cluster", value: 50, color: "#e0115f", rarity: "rare" }, weight: 15 },
  { drop: { name: "Diamond Cache", value: 100, color: "#b9f2ff", rarity: "epic" }, weight: 8 },
  { drop: { name: "Ancient Relic", value: 200, color: "#ff6ec7", rarity: "legendary" }, weight: 3 },
  { drop: { name: "Emerald Stash", value: 60, color: "#50c878", rarity: "rare" }, weight: 12 },
  { drop: { name: "Coal Heap", value: 5, color: "#555", rarity: "common" }, weight: 32 },
];

function rollChestLoot(): LootDrop {
  const total = CHEST_LOOT_TABLE.reduce((s, e) => s + e.weight, 0);
  let roll = Math.random() * total;
  for (const entry of CHEST_LOOT_TABLE) {
    roll -= entry.weight;
    if (roll <= 0) return entry.drop;
  }
  return CHEST_LOOT_TABLE[0].drop;
}

export function tryDig(state: GameState, dx: number, dy: number): boolean {
  const tx = state.px + dx, ty = state.py + dy;
  if (tx < 0 || tx >= WORLD_W) return false;
  const tile = getTile(tx, ty);
  if (!isMineable(tile.type)) return false;

  if (!state.digging || state.digging.x !== tx || state.digging.y !== ty) {
    state.digging = { x: tx, y: ty, progress: 0, maxHp: tile.hp };
  }

  state.digging.progress += state.buffs.speed > 0 ? state.digPower * 2 : state.digPower;
  // Trigger swing animation
  state.swing = { angle: 0, timer: 12, dirX: dx, dirY: dy };
  spawnDigParticles(state, tx, ty, getTileColor(tile.type));

  if (state.digging.progress >= tile.hp) {
    // Mined!
    if (tile.type === TileType.Chest) {
      // Random chest loot
      const drop = rollChestLoot();
      collectLoot(state, drop);
      spawnLootParticles(state, tx, ty, drop.color);
      addFloatingText(state, tx, ty, `${drop.name}!`, drop.color);
    } else if (isLoot(tile.type)) {
      const drop = getLootDrop(tile.type);
      if (drop) {
        collectLoot(state, drop);
        spawnLootParticles(state, tx, ty, drop.color);
        addFloatingText(state, tx, ty, `+${drop.value} ${drop.name}`, drop.color);
      }
    }
    setTile(tx, ty, { type: TileType.Air, revealed: true, hp: 0 });
    state.digging = null;
    return true;
  }
  return false;
}

// Tick-based gravity: call each frame, moves 1 tile per call
export function applyGravity(state: GameState): boolean {
  const below = getTile(state.px, state.py + 1);
  if (below.type === TileType.Air || below.type === TileType.Water) {
    state.py++;
    state.falling = true;
    state.fallCount++;
    if (state.py > state.maxDepth) state.maxDepth = state.py;
    revealAround(state.px, state.py, state.lightRadius);
    // Fall damage: 0.1 per block
    state.hp = Math.round((state.hp - 0.1) * 100) / 100;
    if (state.hp <= 0) respawn(state);
    return true; // still falling
  }
  // Landed
  if (state.falling) {
    state.falling = false;
    if (state.fallCount > 3) addFloatingText(state, state.px, state.py, `-${(state.fallCount * 0.1).toFixed(1)} HP`, "#ff4444");
    state.fallCount = 0;
  }
  return false;
}

export function respawn(state: GameState) {
  state.px = Math.floor(WORLD_W / 2);
  state.py = -1;
  state.hp = state.maxHp;
  state.falling = false;
  state.fallCount = 0;
  state.digging = null;
  addFloatingText(state, state.px, state.py, "Respawned!", "#ff6666");
  revealAround(state.px, state.py, state.lightRadius);
}

export function updateParticles(state: GameState) {
  state.particles = state.particles.filter(p => {
    p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--;
    return p.life > 0;
  });
  state.floatingTexts = state.floatingTexts.filter(f => {
    f.y += f.vy; f.life--;
    return f.life > 0;
  });
  if (state.swing.timer > 0) state.swing.timer--;
  // Tick buffs
  if (state.buffs.speed > 0) state.buffs.speed--;
  if (state.buffs.shield > 0) state.buffs.shield--;
  if (state.buffs.magnet > 0) state.buffs.magnet--;
}

export function spawnAmbientParticles(state: GameState) {
  if (state.py > 30 && Math.random() < 0.1) {
    const ox = (Math.random() - 0.5) * state.lightRadius * TILE * 2;
    state.ambientParticles.push({
      x: state.px * TILE + TILE / 2 + ox,
      y: state.py * TILE - state.lightRadius * TILE,
      vx: (Math.random() - 0.5) * 0.3, vy: 0.3 + Math.random() * 0.5,
      life: 120, maxLife: 120, color: state.py > 180 ? "#ff450033" : "#ffffff11", size: 1 + Math.random() * 2,
    });
  }
  state.ambientParticles = state.ambientParticles.filter(p => {
    p.x += p.vx; p.y += p.vy; p.life--;
    return p.life > 0;
  });
}

// Rendering
export function render(ctx: CanvasRenderingContext2D, state: GameState, W: number, H: number) {
  // Target camera
  const targetCamX = state.px * TILE + TILE / 2 - W / 2;
  const targetCamY = state.py * TILE + TILE / 2 - H / 2;
  state.camX += (targetCamX - state.camX) * 0.12;
  state.camY += (targetCamY - state.camY) * 0.12;

  // Background
  ctx.fillStyle = getLayerBg(state.py);
  ctx.fillRect(0, 0, W, H);

  const startTX = Math.floor(state.camX / TILE) - 1;
  const startTY = Math.floor(state.camY / TILE) - 1;
  const endTX = startTX + Math.ceil(W / TILE) + 2;
  const endTY = startTY + Math.ceil(H / TILE) + 2;

  // Draw tiles
  for (let ty = startTY; ty <= endTY; ty++) {
    for (let tx = startTX; tx <= endTX; tx++) {
      const tile = getTile(tx, ty);
      const sx = Math.floor(tx * TILE - state.camX);
      const sy = Math.floor(ty * TILE - state.camY);

      if (!tile.revealed) {
        // Glow through unrevealed tiles
        if (tile.glow && tile.glow > 0) {
          const dist = Math.sqrt((tx - state.px) ** 2 + (ty - state.py) ** 2);
          if (dist < state.lightRadius + 3) {
            ctx.fillStyle = getTileColor(tile.type);
            ctx.globalAlpha = tile.glow * Math.max(0, 1 - dist / (state.lightRadius + 3));
            ctx.fillRect(sx, sy, TILE, TILE);
            ctx.globalAlpha = 1;
          }
        }
        continue;
      }

      if (tile.type === TileType.Air) {
        // Sky above ground
        if (ty < 0) {
          const skyGrad = Math.max(0, Math.min(1, (0 - ty) / 20));
          ctx.fillStyle = `rgb(${15 + skyGrad * 30}, ${15 + skyGrad * 40}, ${30 + skyGrad * 60})`;
          ctx.fillRect(sx, sy, TILE, TILE);
        }
        continue;
      }

      // Distance-based lighting
      const dist = Math.sqrt((tx - state.px) ** 2 + (ty - state.py) ** 2);
      const lightFalloff = Math.max(0.03, 1 - (dist * dist) / ((state.lightRadius + 1) * (state.lightRadius + 1)));

      ctx.fillStyle = getTileColor(tile.type);
      ctx.globalAlpha = lightFalloff;
      ctx.fillRect(sx, sy, TILE, TILE);

      // Texture variation
      const texNoise = fractalNoise(tx * 3, ty * 3, 999, 2, 8);
      ctx.fillStyle = texNoise > 0.5 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
      ctx.fillRect(sx, sy, TILE, TILE);

      // Ore glow
      if (tile.glow && tile.glow > 0) {
        const glowColor = getTileColor(tile.type);
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = tile.glow * 15 * lightFalloff;
        ctx.fillStyle = glowColor;
        ctx.globalAlpha = tile.glow * 0.5 * lightFalloff;
        ctx.fillRect(sx + 4, sy + 4, TILE - 8, TILE - 8);
        ctx.shadowBlur = 0;
      }

      ctx.globalAlpha = 1;

      // Tile borders (subtle)
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(sx, sy, TILE, TILE);

      // Dig progress
      if (state.digging && state.digging.x === tx && state.digging.y === ty) {
        const pct = state.digging.progress / state.digging.maxHp;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        // Crack lines
        const cracks = Math.floor(pct * 4);
        for (let c = 0; c < cracks; c++) {
          const cx = sx + TILE * (0.2 + c * 0.2);
          ctx.beginPath();
          ctx.moveTo(cx, sy + 2);
          ctx.lineTo(cx + (Math.random() - 0.5) * 8, sy + TILE - 2);
          ctx.stroke();
        }
      }

      // Water shimmer
      if (tile.type === TileType.Water) {
        const shimmer = Math.sin(state.gameTime * 0.05 + tx * 0.5) * 0.15 + 0.1;
        ctx.fillStyle = `rgba(100,180,255,${shimmer * lightFalloff})`;
        ctx.fillRect(sx, sy, TILE, TILE);
      }

      // Lava animation
      if (tile.type === TileType.Lava) {
        const pulse = Math.sin(state.gameTime * 0.08 + tx + ty) * 0.2 + 0.3;
        ctx.fillStyle = `rgba(255,200,0,${pulse * lightFalloff})`;
        ctx.fillRect(sx, sy, TILE, TILE);
      }
    }
  }

  // Ambient particles
  for (const p of state.ambientParticles) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.beginPath();
    ctx.arc(p.x - state.camX, p.y - state.camY, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Player
  const playerSX = Math.floor(state.px * TILE - state.camX);
  const playerSY = Math.floor(state.py * TILE - state.camY);

  // Player light glow
  const grad = ctx.createRadialGradient(
    playerSX + TILE / 2, playerSY + TILE / 2, 0,
    playerSX + TILE / 2, playerSY + TILE / 2, state.lightRadius * TILE
  );
  grad.addColorStop(0, "rgba(255,200,100,0.06)");
  grad.addColorStop(0.5, "rgba(255,150,50,0.02)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(playerSX - state.lightRadius * TILE, playerSY - state.lightRadius * TILE,
    state.lightRadius * TILE * 2, state.lightRadius * TILE * 2);

  // Player body
  ctx.fillStyle = "#f0e6d3";
  ctx.fillRect(playerSX + 6, playerSY + 2, 12, 20);
  // Helmet
  ctx.fillStyle = "#c8a84e";
  ctx.fillRect(playerSX + 4, playerSY + 1, 16, 8);
  // Headlamp
  ctx.fillStyle = "#ffe066";
  ctx.shadowColor = "#ffe066";
  ctx.shadowBlur = 10;
  ctx.fillRect(playerSX + 9, playerSY + 2, 6, 4);
  ctx.shadowBlur = 0;

  // Animated Pickaxe
  const pcx = playerSX + TILE / 2;
  const pcy = playerSY + TILE / 2;
  ctx.save();
  ctx.translate(pcx, pcy);

  // Determine base angle from swing direction
  const sw = state.swing;
  let baseAngle = 0.4; // default resting angle (slightly forward)
  if (sw.dirX < 0) baseAngle = Math.PI - 0.4;
  else if (sw.dirY > 0 && sw.dirX === 0) baseAngle = Math.PI / 2 + 0.3;
  else if (sw.dirY < 0 && sw.dirX === 0) baseAngle = -Math.PI / 2 - 0.3;

  // Swing arc: ease-out sine curve
  let swingOffset = 0;
  if (sw.timer > 0) {
    const t = 1 - sw.timer / 12;
    // Swing forward then back: sin curve with overshoot
    swingOffset = Math.sin(t * Math.PI) * 1.4;
  }
  ctx.rotate(baseAngle + swingOffset);

  // Handle (wooden stick)
  ctx.strokeStyle = "#8B4513";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(18, 0);
  ctx.stroke();

  // Pickaxe head
  ctx.strokeStyle = "#b0b0b8";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(15, -7);
  ctx.lineTo(20, 0);
  ctx.lineTo(15, 7);
  ctx.stroke();

  // Metallic shine on head
  ctx.strokeStyle = "#ddd";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(16, -5);
  ctx.lineTo(19, 0);
  ctx.stroke();

  ctx.restore();

  // Particles
  for (const p of state.particles) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillRect(p.x - state.camX - p.size / 2, p.y - state.camY - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // Floating texts
  for (const f of state.floatingTexts) {
    ctx.font = "bold 14px monospace";
    ctx.fillStyle = f.color;
    ctx.globalAlpha = Math.min(1, f.life / 20);
    ctx.textAlign = "center";
    ctx.fillText(f.text, f.x - state.camX, f.y - state.camY);
  }
  ctx.globalAlpha = 1;
  state.gameTime++;
}
