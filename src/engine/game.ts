import { TILE, TileType, getTile, getTileColor, isMineable, isLoot, getLootDrop, setTile, revealAround, getLayerBg, WORLD_W, type LootDrop } from "./world";
import { fractalNoise, hashCoord } from "./noise";

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number;
}

export interface FloatingText {
  x: number; y: number; text: string; color: string; life: number; vy: number;
}

export interface InventoryItem { name: string; count: number; color: string; rarity: string; value: number; }

export interface Buffs {
  speed: number;
  shield: number;
  magnet: number;
}

// AI Entities
export interface AIEntity {
  id: string;
  x: number; y: number;
  type: "miner" | "fighter" | "bat" | "slime" | "spider";
  hp: number; maxHp: number;
  name: string;
  dir: { dx: number; dy: number };
  cooldown: number; // ticks until next action
  swordTier: number;
  dead: boolean;
}

export interface GameState {
  px: number; py: number;
  camX: number; camY: number;
  particles: Particle[];
  floatingTexts: FloatingText[];
  inventory: Map<string, InventoryItem>;
  balance: number;
  totalEarned: number;
  maxDepth: number;
  hp: number;
  maxHp: number;
  digPower: number;
  lightRadius: number;
  baseLightRadius: number;
  digging: { x: number; y: number; progress: number; maxHp: number } | null;
  swing: { angle: number; timer: number; dirX: number; dirY: number };
  buffs: Buffs;
  upgrades: Upgrades;
  gameTime: number;
  ambientParticles: Particle[];
  aiEntities: AIEntity[];
  shakeTimer: number;
  shakeIntensity: number;
  invincible: number; // ticks of respawn invincibility
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

// Random wallet-like names for AI
const AI_NAMES = ["0xDe4d..b33f","0xCa5h..m1n3","0xG0ld..d1g","0xR0ck..br3k","0xD33p..m1n0","0xOr3s..hunt","0xP1ck..axe1","0xD1am..0nd5","0xRuby..f1nd","0xCav3..cr4w","0xSw0r..d99","0xBl4d..3xx","0xSl4y..3r01","0xH4ck..sl4h"];

function spawnAIEntities(): AIEntity[] {
  const entities: AIEntity[] = [];
  // Miners scattered underground
  for (let i = 0; i < 8; i++) {
    const x = 20 + Math.floor(Math.random() * (WORLD_W - 40));
    const y = 5 + Math.floor(Math.random() * 120);
    entities.push({ id: `miner-${i}`, x, y, type: "miner", hp: 10, maxHp: 10, name: AI_NAMES[i % AI_NAMES.length], dir: { dx: 0, dy: 1 }, cooldown: 0, swordTier: 0, dead: false });
  }
  // Sword fighters
  for (let i = 0; i < 4; i++) {
    const x = 30 + Math.floor(Math.random() * (WORLD_W - 60));
    const y = 20 + Math.floor(Math.random() * 100);
    entities.push({ id: `fighter-${i}`, x, y, type: "fighter", hp: 15, maxHp: 15, name: AI_NAMES[(i + 8) % AI_NAMES.length], dir: { dx: 1, dy: 0 }, cooldown: 0, swordTier: 1 + (i % 3), dead: false });
  }
  // Mobs
  for (let i = 0; i < 6; i++) {
    const types: ("bat" | "slime" | "spider")[] = ["bat", "slime", "spider"];
    const t = types[i % 3];
    const x = 10 + Math.floor(Math.random() * (WORLD_W - 20));
    const y = t === "bat" ? 15 + Math.floor(Math.random() * 80) : 40 + Math.floor(Math.random() * 150);
    const mobHp = t === "bat" ? 3 : t === "slime" ? 5 : 8;
    entities.push({ id: `mob-${i}`, x, y, type: t, hp: mobHp, maxHp: mobHp, name: t.toUpperCase(), dir: { dx: 0, dy: 0 }, cooldown: 0, swordTier: 0, dead: false });
  }
  return entities;
}

export function createGameState(): GameState {
  return {
    px: Math.floor(WORLD_W / 2), py: -1,
    camX: Math.floor(WORLD_W / 2) * TILE, camY: -TILE,
    particles: [], floatingTexts: [],
    inventory: new Map(), balance: 0, totalEarned: 0, maxDepth: 0,
    hp: 10, maxHp: 10,
    digPower: 1, lightRadius: 6, baseLightRadius: 6, digging: null,
    swing: { angle: 0, timer: 0, dirX: 1, dirY: 1 },
    buffs: { speed: 0, shield: 0, magnet: 0 },
    upgrades: { pickaxe: 0, sword: 0, lamp: 0, armor: 0 },
    gameTime: 0, ambientParticles: [],
    aiEntities: spawnAIEntities(),
    shakeTimer: 0, shakeIntensity: 0,
    invincible: 0,
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
  state.totalEarned += drop.value;
}

export function tryMove(state: GameState, dx: number, dy: number): boolean {
  const nx = state.px + dx, ny = state.py + dy;
  if (nx < 0 || nx >= WORLD_W) return false;
  const tile = getTile(nx, ny);
  const walkable = tile.type === TileType.Air || tile.type === TileType.Water ||
    tile.type === TileType.Lava || tile.type === TileType.SpikeTrap ||
    tile.type === TileType.Mushroom || tile.type === TileType.Dynamite ||
    tile.type === TileType.SpeedPotion || tile.type === TileType.Shield || tile.type === TileType.Magnet;
  if (!walkable) return false;

  // Lava damage
  if (tile.type === TileType.Lava && state.buffs.shield <= 0) {
    state.hp = Math.round((state.hp - 2) * 100) / 100;
    addFloatingText(state, nx, ny, "-2 HP LAVA!", "#ff4500");
    if (state.hp <= 0) { killPlayer(state); return false; }
  }

  // Spike trap damage
  if (tile.type === TileType.SpikeTrap) {
    state.hp = Math.round((state.hp - 1.5) * 100) / 100;
    addFloatingText(state, nx, ny, "-1.5 SPIKE!", "#8a8a8a");
    state.shakeTimer = 8; state.shakeIntensity = 3;
    if (state.hp <= 0) { killPlayer(state); return false; }
  }

  // Pickup powerups
  if (tile.type === TileType.Mushroom) {
    addFloatingText(state, nx, ny, "+Light", "#8b5e83");
    spawnLootParticles(state, nx, ny, "#8b5e83");
    state.lightRadius = Math.min(12, state.lightRadius + 1.5);
  } else if (tile.type === TileType.Dynamite) {
    addFloatingText(state, nx, ny, "BOOM!", "#ff3333");
    state.shakeTimer = 15; state.shakeIntensity = 8;
    blastRadius(state, nx, ny, 3);
  } else if (tile.type === TileType.SpeedPotion) {
    addFloatingText(state, nx, ny, "2x Dig Speed!", "#33ffaa");
    spawnLootParticles(state, nx, ny, "#33ffaa");
    state.buffs.speed = Math.min(600, state.buffs.speed + 300);
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
  if (tile.type !== TileType.Air && tile.type !== TileType.Water && tile.type !== TileType.Lava && tile.type !== TileType.SpikeTrap) {
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

// Death: lose 20% balance, respawn with invincibility
export function killPlayer(state: GameState) {
  const lost = Math.floor(state.balance * 0.2);
  state.balance -= lost;
  if (lost > 0) addFloatingText(state, state.px, state.py, `-${lost} balance!`, "#ff4444");
  respawn(state);
}

export function respawn(state: GameState) {
  state.px = Math.floor(WORLD_W / 2);
  state.py = -1;
  state.hp = state.maxHp;
  state.digging = null;
  state.invincible = 180; // 3 sec at 60fps
  addFloatingText(state, state.px, state.py, "Respawned!", "#ff6666");
  revealAround(state.px, state.py, state.lightRadius);
}

// AI entity update — called every ~20 ticks
const DIRS = [{ dx: 0, dy: 1 }, { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: -1, dy: 0 }];

export function updateAI(state: GameState) {
  for (const e of state.aiEntities) {
    if (e.dead) continue;
    if (e.cooldown > 0) { e.cooldown--; continue; }

    const distToPlayer = Math.abs(e.x - state.px) + Math.abs(e.y - state.py);

    if (e.type === "miner") {
      // Miners wander and dig
      if (Math.random() < 0.3) e.dir = DIRS[Math.floor(Math.random() * 4)];
      const nx = e.x + e.dir.dx, ny = e.y + e.dir.dy;
      if (nx >= 0 && nx < WORLD_W && ny >= -5) {
        const t = getTile(nx, ny);
        if (t.type === TileType.Air || t.type === TileType.Water) {
          e.x = nx; e.y = ny;
        } else if (isMineable(t.type)) {
          setTile(nx, ny, { type: TileType.Air, revealed: true, hp: 0 });
          spawnDigParticles(state, nx, ny, getTileColor(t.type));
          e.x = nx; e.y = ny;
        }
      }
      e.cooldown = 12 + Math.floor(Math.random() * 8);
    } else if (e.type === "fighter") {
      // Fighters chase player if close, otherwise wander
      if (distToPlayer < 15 && distToPlayer > 1) {
        const ddx = state.px > e.x ? 1 : state.px < e.x ? -1 : 0;
        const ddy = state.py > e.y ? 1 : state.py < e.y ? -1 : 0;
        e.dir = Math.abs(state.px - e.x) > Math.abs(state.py - e.y) ? { dx: ddx, dy: 0 } : { dx: 0, dy: ddy };
      } else if (Math.random() < 0.4) {
        e.dir = DIRS[Math.floor(Math.random() * 4)];
      }
      // Attack player if adjacent
      if (distToPlayer === 1 && state.invincible <= 0) {
        const dmg = e.swordTier;
        state.hp = Math.round((state.hp - dmg) * 100) / 100;
        addFloatingText(state, state.px, state.py, `-${dmg} HP`, "#ff4444");
        state.shakeTimer = 6; state.shakeIntensity = 4;
        if (state.hp <= 0) killPlayer(state);
        e.cooldown = 30;
        continue;
      }
      const nx = e.x + e.dir.dx, ny = e.y + e.dir.dy;
      if (nx >= 0 && nx < WORLD_W && ny >= -5) {
        const t = getTile(nx, ny);
        if (t.type === TileType.Air || t.type === TileType.Water) { e.x = nx; e.y = ny; }
        else if (isMineable(t.type)) { setTile(nx, ny, { type: TileType.Air, revealed: true, hp: 0 }); e.x = nx; e.y = ny; }
      }
      e.cooldown = 8 + Math.floor(Math.random() * 6);
    } else {
      // Mobs: bats fly erratically, slimes hop, spiders chase
      if (e.type === "bat") {
        e.dir = DIRS[Math.floor(Math.random() * 4)];
        const nx = e.x + e.dir.dx, ny = e.y + e.dir.dy;
        if (nx >= 0 && nx < WORLD_W) {
          const t = getTile(nx, ny);
          if (t.type === TileType.Air || t.type === TileType.Water) { e.x = nx; e.y = ny; }
        }
        if (distToPlayer === 1 && state.invincible <= 0) {
          state.hp = Math.round((state.hp - 0.5) * 100) / 100;
          addFloatingText(state, state.px, state.py, "-0.5 BAT!", "#884488");
          if (state.hp <= 0) killPlayer(state);
        }
        e.cooldown = 4 + Math.floor(Math.random() * 4);
      } else if (e.type === "slime") {
        if (distToPlayer < 10) {
          const ddx = state.px > e.x ? 1 : state.px < e.x ? -1 : 0;
          const ddy = state.py > e.y ? 1 : state.py < e.y ? -1 : 0;
          e.dir = Math.random() < 0.5 ? { dx: ddx, dy: 0 } : { dx: 0, dy: ddy };
        } else {
          e.dir = DIRS[Math.floor(Math.random() * 4)];
        }
        const nx = e.x + e.dir.dx, ny = e.y + e.dir.dy;
        if (nx >= 0 && nx < WORLD_W) {
          const t = getTile(nx, ny);
          if (t.type === TileType.Air || t.type === TileType.Water) { e.x = nx; e.y = ny; }
        }
        if (distToPlayer === 1 && state.invincible <= 0) {
          state.hp = Math.round((state.hp - 1) * 100) / 100;
          addFloatingText(state, state.px, state.py, "-1 SLIME!", "#44cc44");
          if (state.hp <= 0) killPlayer(state);
        }
        e.cooldown = 15 + Math.floor(Math.random() * 10);
      } else if (e.type === "spider") {
        if (distToPlayer < 12) {
          const ddx = state.px > e.x ? 1 : state.px < e.x ? -1 : 0;
          const ddy = state.py > e.y ? 1 : state.py < e.y ? -1 : 0;
          e.dir = Math.abs(state.px - e.x) > Math.abs(state.py - e.y) ? { dx: ddx, dy: 0 } : { dx: 0, dy: ddy };
        } else {
          e.dir = DIRS[Math.floor(Math.random() * 4)];
        }
        const nx = e.x + e.dir.dx, ny = e.y + e.dir.dy;
        if (nx >= 0 && nx < WORLD_W) {
          const t = getTile(nx, ny);
          if (t.type === TileType.Air || t.type === TileType.Water) { e.x = nx; e.y = ny; }
          else if (isMineable(t.type)) { setTile(nx, ny, { type: TileType.Air, revealed: true, hp: 0 }); e.x = nx; e.y = ny; }
        }
        if (distToPlayer === 1 && state.invincible <= 0) {
          state.hp = Math.round((state.hp - 1.5) * 100) / 100;
          addFloatingText(state, state.px, state.py, "-1.5 SPIDER!", "#884444");
          state.shakeTimer = 5; state.shakeIntensity = 3;
          if (state.hp <= 0) killPlayer(state);
        }
        e.cooldown = 6 + Math.floor(Math.random() * 6);
      }
    }
  }
}

// Player attacks an AI entity at tile
export function attackAI(state: GameState, tx: number, ty: number): boolean {
  if (state.upgrades.sword <= 0) return false;
  const dmg = state.upgrades.sword + 1;
  const target = state.aiEntities.find(e => !e.dead && e.x === tx && e.y === ty);
  if (!target) return false;
  target.hp -= dmg;
  addFloatingText(state, tx, ty, `-${dmg}`, "#ff6666");
  spawnDigParticles(state, tx, ty, "#ff4444");
  state.swing = { angle: 0, timer: 12, dirX: tx - state.px, dirY: ty - state.py };
  if (target.hp <= 0) {
    target.dead = true;
    const reward = target.type === "fighter" ? 25 : target.type === "spider" ? 15 : target.type === "slime" ? 10 : 5;
    state.balance += reward; state.totalEarned += reward;
    addFloatingText(state, tx, ty, `+${reward} KILL!`, "#ffd700");
    spawnLootParticles(state, tx, ty, "#ff4444");
  }
  return true;
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
  if (state.buffs.speed > 0) state.buffs.speed--;
  if (state.buffs.shield > 0) state.buffs.shield--;
  if (state.buffs.magnet > 0) state.buffs.magnet--;
  if (state.shakeTimer > 0) state.shakeTimer--;
  if (state.invincible > 0) state.invincible--;
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

// Billboard
function renderBillboard(ctx: CanvasRenderingContext2D, state: GameState) {
  const bx = Math.floor(WORLD_W / 2);
  const by = -12; // high above surface
  const W = 600, H = 160; // massive
  const sx = Math.floor(bx * TILE - state.camX) - W / 2;
  const sy = Math.floor(by * TILE - state.camY);
  const groundY = Math.floor(0 * TILE - state.camY); // y=0 is surface

  if (sy > ctx.canvas.height + 200 || sy < -500) return;

  const t = state.gameTime;

  // Support posts — go all the way to ground
  ctx.fillStyle = "#3d2510";
  ctx.fillRect(sx + 40, sy + H, 14, groundY - sy - H);
  ctx.fillRect(sx + W - 54, sy + H, 14, groundY - sy - H);
  // Post highlights
  ctx.fillStyle = "#5c3d2e";
  ctx.fillRect(sx + 42, sy + H, 10, groundY - sy - H);
  ctx.fillRect(sx + W - 52, sy + H, 10, groundY - sy - H);

  // 3D board — multiple depth layers
  for (let d = 8; d > 0; d--) {
    const shade = 10 + d * 4;
    ctx.fillStyle = `rgb(${shade}, ${Math.floor(shade * 0.6)}, ${Math.floor(shade * 0.2)})`;
    ctx.fillRect(sx + d, sy + d, W, H);
  }
  // Front face
  const boardGrad = ctx.createLinearGradient(sx, sy, sx, sy + H);
  boardGrad.addColorStop(0, "#4a3015");
  boardGrad.addColorStop(0.5, "#3d2810");
  boardGrad.addColorStop(1, "#2a1a08");
  ctx.fillStyle = boardGrad;
  ctx.fillRect(sx, sy, W, H);

  // Gold border with corner bolts
  ctx.strokeStyle = "#c8a84e";
  ctx.lineWidth = 3;
  ctx.strokeRect(sx, sy, W, H);
  ctx.strokeStyle = "#a08030";
  ctx.lineWidth = 1;
  ctx.strokeRect(sx + 6, sy + 6, W - 12, H - 12);

  // Corner bolts
  for (const [cx, cy] of [[sx + 12, sy + 12], [sx + W - 12, sy + 12], [sx + 12, sy + H - 12], [sx + W - 12, sy + H - 12]]) {
    ctx.fillStyle = "#c8a84e";
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a08030";
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bulb lights along top — more of them, bigger
  for (let i = 0; i < 16; i++) {
    const lx = sx + 25 + i * (W - 50) / 15;
    const pulse = Math.sin(t * 0.08 + i * 0.9) * 0.3 + 0.7;
    const colors = ["#ffdc64", "#ff9632", "#ff6464", "#64ff96"];
    const color = colors[i % 4];
    ctx.fillStyle = color;
    ctx.globalAlpha = pulse;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14 * pulse;
    ctx.beginPath();
    ctx.arc(lx, sy - 4, 5, 0, Math.PI * 2);
    ctx.fill();
    // Wire
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(lx, sy - 4);
    ctx.lineTo(lx, sy);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  // "TRENCH" text — huge, deep 3D extrusion
  ctx.font = "bold 90px monospace";
  ctx.textAlign = "center";
  // Deep extrusion
  for (let d = 10; d > 0; d--) {
    const r = 30 + d * 6, g = 18 + d * 3, b = 5 + d * 2;
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillText("TRENCH", sx + W / 2 + d, sy + H / 2 + 32 + d);
  }
  // Main text with glow
  const textGlow = Math.sin(t * 0.04) * 0.15 + 0.85;
  ctx.fillStyle = `rgba(240,230,211,${textGlow})`;
  ctx.shadowColor = "#ffe066";
  ctx.shadowBlur = 25 * textGlow;
  ctx.fillText("TRENCH", sx + W / 2, sy + H / 2 + 32);
  ctx.shadowBlur = 0;

  // Pickaxes — bigger, on each side
  const drawPickaxe = (px: number, py: number, flip: number) => {
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(flip * 2, 2);
    ctx.strokeStyle = "#8B4513";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(22, -22);
    ctx.stroke();
    ctx.strokeStyle = "#b0b0b8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(17, -27);
    ctx.lineTo(24, -20);
    ctx.lineTo(27, -24);
    ctx.stroke();
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(19, -25);
    ctx.lineTo(23, -21);
    ctx.stroke();
    ctx.restore();
  };
  drawPickaxe(sx - 15, sy + H - 20, 1);
  drawPickaxe(sx + W + 15, sy + H - 20, -1);
}

// Rendering
export function render(ctx: CanvasRenderingContext2D, state: GameState, W: number, H: number) {
  // Target camera
  const targetCamX = state.px * TILE + TILE / 2 - W / 2;
  const targetCamY = state.py * TILE + TILE / 2 - H / 2;
  state.camX += (targetCamX - state.camX) * 0.12;
  state.camY += (targetCamY - state.camY) * 0.12;

  // Screen shake offset
  let shakeX = 0, shakeY = 0;
  if (state.shakeTimer > 0) {
    shakeX = (Math.random() - 0.5) * state.shakeIntensity * 2;
    shakeY = (Math.random() - 0.5) * state.shakeIntensity * 2;
  }

  ctx.save();
  ctx.translate(shakeX, shakeY);

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

  // Billboard at surface
  renderBillboard(ctx, state);

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

  // Invincibility flash
  if (state.invincible > 0 && Math.floor(state.invincible / 6) % 2 === 0) {
    ctx.fillStyle = "rgba(100,180,255,0.3)";
    ctx.fillRect(playerSX, playerSY, TILE, TILE);
  }

  // Render AI entities
  for (const e of state.aiEntities) {
    if (e.dead) continue;
    const ex = Math.floor(e.x * TILE - state.camX);
    const ey = Math.floor(e.y * TILE - state.camY);
    if (ex < -TILE * 2 || ex > W + TILE || ey < -TILE * 2 || ey > H + TILE) continue;
    const dist = Math.sqrt((e.x - state.px) ** 2 + (e.y - state.py) ** 2);
    if (dist > state.lightRadius + 2) continue;
    const alpha = Math.max(0.3, 1 - dist / (state.lightRadius + 2));
    ctx.globalAlpha = alpha;

    if (e.type === "miner") {
      ctx.fillStyle = "#e8c4a0"; ctx.fillRect(ex + 6, ey + 2, 12, 20);
      ctx.fillStyle = "#aa8844"; ctx.fillRect(ex + 4, ey + 1, 16, 8);
      ctx.fillStyle = "#ffcc44"; ctx.fillRect(ex + 9, ey + 2, 6, 4);
    } else if (e.type === "fighter") {
      ctx.fillStyle = "#cc4444"; ctx.fillRect(ex + 6, ey + 2, 12, 20);
      ctx.fillStyle = "#882222"; ctx.fillRect(ex + 4, ey + 1, 16, 8);
      // Sword
      ctx.strokeStyle = e.swordTier >= 3 ? "#b9f2ff" : e.swordTier >= 2 ? "#aaa" : "#8B7355";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ex + 20, ey + 4); ctx.lineTo(ex + 26, ey + 16); ctx.stroke();
    } else if (e.type === "bat") {
      ctx.fillStyle = "#6644aa";
      ctx.beginPath(); ctx.arc(ex + TILE / 2, ey + TILE / 2, 6, 0, Math.PI * 2); ctx.fill();
      // Wings
      const wing = Math.sin(state.gameTime * 0.3) * 4;
      ctx.fillRect(ex + 2, ey + 8 + wing, 6, 3);
      ctx.fillRect(ex + 16, ey + 8 - wing, 6, 3);
    } else if (e.type === "slime") {
      ctx.fillStyle = "#44cc44";
      const bounce = Math.abs(Math.sin(state.gameTime * 0.05 + e.x)) * 3;
      ctx.beginPath();
      ctx.ellipse(ex + TILE / 2, ey + TILE - 4 - bounce, 10, 8 + bounce, 0, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = "#fff"; ctx.fillRect(ex + 8, ey + 10 - bounce, 3, 3); ctx.fillRect(ex + 14, ey + 10 - bounce, 3, 3);
    } else if (e.type === "spider") {
      ctx.fillStyle = "#884444";
      ctx.beginPath(); ctx.arc(ex + TILE / 2, ey + TILE / 2, 7, 0, Math.PI * 2); ctx.fill();
      // Legs
      ctx.strokeStyle = "#663333"; ctx.lineWidth = 1;
      for (let l = 0; l < 4; l++) {
        const lx = ex + 6 + l * 4, ly = ey + TILE / 2;
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx - 4, ly + 8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 4, ly + 8); ctx.stroke();
      }
      ctx.fillStyle = "#ff0000"; ctx.fillRect(ex + 9, ey + 9, 2, 2); ctx.fillRect(ex + 14, ey + 9, 2, 2);
    }

    // Name label
    ctx.font = "bold 8px monospace";
    ctx.fillStyle = e.type === "fighter" ? "#ff6666" : e.type === "miner" ? "#88bbff" : "#aaa";
    ctx.textAlign = "center";
    ctx.fillText(e.name, ex + TILE / 2, ey - 10);

    // HP bar
    if (e.hp < e.maxHp) {
      const hpPct = e.hp / e.maxHp;
      ctx.fillStyle = "#1a1a2e"; ctx.fillRect(ex + 2, ey - 6, TILE - 4, 3);
      ctx.fillStyle = hpPct > 0.5 ? "#50c878" : "#ff4444";
      ctx.fillRect(ex + 2, ey - 6, (TILE - 4) * hpPct, 3);
    }
    ctx.globalAlpha = 1;
  }

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

  // Depth fog overlay
  if (state.py > 50) {
    const fogAlpha = Math.min(0.35, (state.py - 50) / 600);
    ctx.fillStyle = `rgba(0,0,0,${fogAlpha})`;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.restore(); // end shake transform
  state.gameTime++;
}
