import { fractalNoise, hashCoord } from "./noise";

export const TILE = 24;
export const CHUNK = 32;
export const WORLD_W = 200; // tiles wide

export enum TileType {
  Air = 0, Dirt, Stone, DeepStone, Crystal, Obsidian, Lava, Ruins, Bedrock,
  // Ores
  Coal, Iron, Gold, Ruby, Diamond, Emerald, Amethyst,
  // Loot
  Chest, Artifact,
  // Special
  Water, Moss, Mushroom,
  // Powerups
  Dynamite, SpeedPotion, Shield, Magnet,
  // Traps
  SpikeTrap, BoulderTrap
}

export interface Tile { type: TileType; revealed: boolean; hp: number; glow?: number; lootValue?: number; }

export interface LootDrop { name: string; value: number; color: string; rarity: string; }

const LAYER_COLORS: Record<TileType, string> = {
  [TileType.Air]: "#0a0a12",
  [TileType.Dirt]: "#5c3d2e",
  [TileType.Stone]: "#6b6b7b",
  [TileType.DeepStone]: "#4a4a5e",
  [TileType.Crystal]: "#7b4fbf",
  [TileType.Obsidian]: "#1a1a2e",
  [TileType.Lava]: "#ff4500",
  [TileType.Ruins]: "#3d3d50",
  [TileType.Bedrock]: "#111118",
  [TileType.Coal]: "#2a2a2a",
  [TileType.Iron]: "#a0785a",
  [TileType.Gold]: "#ffd700",
  [TileType.Ruby]: "#e0115f",
  [TileType.Diamond]: "#b9f2ff",
  [TileType.Emerald]: "#50c878",
  [TileType.Amethyst]: "#9966cc",
  [TileType.Chest]: "#c8a84e",
  [TileType.Artifact]: "#ff6ec7",
  [TileType.Water]: "#1a5276",
  [TileType.Moss]: "#4a7a3d",
  [TileType.Mushroom]: "#8b5e83",
  [TileType.Dynamite]: "#ff3333",
  [TileType.SpeedPotion]: "#33ffaa",
  [TileType.Shield]: "#4488ff",
  [TileType.Magnet]: "#ff8800",
  [TileType.SpikeTrap]: "#8a8a8a",
  [TileType.BoulderTrap]: "#6b5b4b",
};

const TILE_HP: Partial<Record<TileType, number>> = {
  [TileType.Dirt]: 1, [TileType.Stone]: 3, [TileType.DeepStone]: 5,
  [TileType.Crystal]: 8, [TileType.Obsidian]: 12, [TileType.Ruins]: 6,
  [TileType.Coal]: 2, [TileType.Iron]: 4, [TileType.Gold]: 7,
  [TileType.Ruby]: 10, [TileType.Diamond]: 15, [TileType.Emerald]: 10,
  [TileType.Amethyst]: 6, [TileType.Chest]: 5, [TileType.Artifact]: 12,
  [TileType.Moss]: 1, [TileType.Mushroom]: 1, [TileType.Bedrock]: 999,
  [TileType.Dynamite]: 1, [TileType.SpeedPotion]: 1, [TileType.Shield]: 1, [TileType.Magnet]: 1,
  [TileType.SpikeTrap]: 1, [TileType.BoulderTrap]: 3,
};

export function getTileColor(type: TileType): string {
  return LAYER_COLORS[type] || "#333";
}

export function getTileHP(type: TileType): number {
  return TILE_HP[type] ?? 1;
}

export function isMineable(type: TileType): boolean {
  return type !== TileType.Air && type !== TileType.Lava && type !== TileType.Water && type !== TileType.Bedrock && type !== TileType.SpikeTrap;
}

export function isLoot(type: TileType): boolean {
  return type === TileType.Chest || type === TileType.Artifact ||
    type === TileType.Coal || type === TileType.Iron || type === TileType.Gold ||
    type === TileType.Ruby || type === TileType.Diamond || type === TileType.Emerald ||
    type === TileType.Amethyst;
}

export function getLootDrop(type: TileType): LootDrop | null {
  switch (type) {
    case TileType.Coal: return { name: "Coal", value: 1, color: "#555", rarity: "common" };
    case TileType.Iron: return { name: "Iron Ore", value: 3, color: "#a0785a", rarity: "common" };
    case TileType.Gold: return { name: "Gold Nugget", value: 10, color: "#ffd700", rarity: "uncommon" };
    case TileType.Ruby: return { name: "Ruby", value: 25, color: "#e0115f", rarity: "rare" };
    case TileType.Emerald: return { name: "Emerald", value: 30, color: "#50c878", rarity: "rare" };
    case TileType.Amethyst: return { name: "Amethyst", value: 20, color: "#9966cc", rarity: "uncommon" };
    case TileType.Diamond: return { name: "Diamond", value: 50, color: "#b9f2ff", rarity: "epic" };
    case TileType.Chest: return { name: "Treasure Chest", value: 100, color: "#c8a84e", rarity: "epic" };
    case TileType.Artifact: return { name: "Ancient Artifact", value: 250, color: "#ff6ec7", rarity: "legendary" };
    default: return null;
  }
}

export function getLayerBg(depth: number): string {
  if (depth < 20) return "#1a120d";
  if (depth < 60) return "#12101a";
  if (depth < 120) return "#0d0a18";
  if (depth < 200) return "#180a0a";
  return "#0a0a10";
}

// World generation
const SEED = 42069;

function getBaseType(depth: number): TileType {
  if (depth < 0) return TileType.Air;
  if (depth < 25) return TileType.Dirt;
  if (depth < 70) return TileType.Stone;
  if (depth < 130) return TileType.DeepStone;
  if (depth < 200) return TileType.Crystal;
  if (depth < 280) return TileType.Obsidian;
  return TileType.Ruins;
}

function getOreType(depth: number, rng: number): TileType | null {
  if (depth < 10) return null;
  if (depth < 40 && rng < 0.06) return TileType.Coal;
  if (depth > 25 && depth < 80 && rng < 0.04) return TileType.Iron;
  if (depth > 50 && depth < 140 && rng < 0.025) return TileType.Gold;
  if (depth > 80 && depth < 180 && rng < 0.015) return TileType.Amethyst;
  if (depth > 100 && depth < 220 && rng < 0.012) return TileType.Ruby;
  if (depth > 120 && depth < 250 && rng < 0.01) return TileType.Emerald;
  if (depth > 160 && rng < 0.006) return TileType.Diamond;
  if (depth > 60 && rng < 0.003) return TileType.Chest;
  if (depth > 150 && rng < 0.001) return TileType.Artifact;
  return null;
}

export function generateTile(x: number, y: number): Tile {
  const depth = y;
  if (depth < 0) return { type: TileType.Air, revealed: true, hp: 0 };

  // Pre-dug holes at surface — random shafts showing previous miners
  if (depth >= 0 && depth < 12) {
    const holeHash = hashCoord(Math.floor(x / 3), 0, SEED + 1100);
    if (holeHash < 0.04 && (x % 3 === 1)) {
      const holeDepth = 3 + Math.floor(holeHash * 200);
      if (depth < holeDepth) return { type: TileType.Air, revealed: true, hp: 0 };
    }
  }

  // Cave generation
  const cave = fractalNoise(x, y, SEED, 4, 24);
  const bigCave = fractalNoise(x, y, SEED + 500, 2, 60);
  const isCave = cave > 0.62 || (bigCave > 0.72 && depth > 30);

  if (isCave) {
    // Water pools in caves
    if (depth > 40 && depth < 150) {
      const waterNoise = fractalNoise(x, y, SEED + 200, 2, 16);
      if (waterNoise > 0.7) return { type: TileType.Water, revealed: false, hp: 0, glow: 0.15 };
    }
    // Lava pools deep down
    if (depth > 180) {
      const lavaNoise = fractalNoise(x, y, SEED + 300, 2, 12);
      if (lavaNoise > 0.72) return { type: TileType.Lava, revealed: false, hp: 0, glow: 0.8 };
    }
    // Mushrooms in caves — all depths
    const mush = hashCoord(x, y, SEED + 400);
    if (depth > 5 && mush < 0.06) return { type: TileType.Mushroom, revealed: false, hp: 1, glow: 0.7 };

    // Powerups in caves — consistent at ALL depths, no depth gating
    const pu = hashCoord(x, y, SEED + 700);
    if (depth > 5 && pu < 0.010) return { type: TileType.Dynamite, revealed: false, hp: 1, glow: 1.0 };
    if (depth > 5 && pu > 0.010 && pu < 0.018) return { type: TileType.SpeedPotion, revealed: false, hp: 1, glow: 1.0 };
    if (depth > 5 && pu > 0.018 && pu < 0.025) return { type: TileType.Shield, revealed: false, hp: 1, glow: 1.0 };
    if (depth > 5 && pu > 0.025 && pu < 0.032) return { type: TileType.Magnet, revealed: false, hp: 1, glow: 1.0 };
    return { type: TileType.Air, revealed: false, hp: 0 };
  }

  // Moss near cave edges
  if (depth > 10 && depth < 80) {
    const nearCave = fractalNoise(x, y, SEED, 4, 24);
    if (nearCave > 0.55 && nearCave < 0.62) {
      const mossChance = hashCoord(x, y, SEED + 600);
      if (mossChance < 0.3) return { type: TileType.Moss, revealed: false, hp: 1 };
    }
  }

  // Ore placement — vein-based: use noise to cluster same ore
  const oreRng = hashCoord(x, y, SEED + 100);
  const veinNoise = fractalNoise(x * 2, y * 2, SEED + 150, 2, 10);
  const ore = getOreType(depth, oreRng);
  if (ore) {
    // Veins: if nearby noise is high, boost chance of same ore in cluster
    const glow = ore === TileType.Diamond ? 0.6 : ore === TileType.Ruby ? 0.4 :
      ore === TileType.Emerald ? 0.4 : ore === TileType.Gold ? 0.3 :
      ore === TileType.Amethyst ? 0.35 : ore === TileType.Chest ? 0.5 :
      ore === TileType.Artifact ? 0.8 : 0;
    return { type: ore, revealed: false, hp: getTileHP(ore), glow };
  }
  // Vein extension: if no ore rolled but vein noise is high, check neighbors conceptually
  if (veinNoise > 0.7 && depth > 15) {
    const neighborOre = getOreType(depth, hashCoord(x + 1, y, SEED + 100)) ||
      getOreType(depth, hashCoord(x - 1, y, SEED + 100)) ||
      getOreType(depth, hashCoord(x, y + 1, SEED + 100)) ||
      getOreType(depth, hashCoord(x, y - 1, SEED + 100));
    if (neighborOre) {
      const glow = neighborOre === TileType.Diamond ? 0.6 : neighborOre === TileType.Gold ? 0.3 : 0.2;
      return { type: neighborOre, revealed: false, hp: getTileHP(neighborOre), glow };
    }
  }

  // Traps in deeper layers
  if (depth > 50) {
    const trapRng = hashCoord(x, y, SEED + 800);
    if (depth > 100 && trapRng < 0.008) return { type: TileType.SpikeTrap, revealed: false, hp: 1, glow: 0.15 };
    if (depth > 70 && trapRng > 0.008 && trapRng < 0.014) return { type: TileType.BoulderTrap, revealed: false, hp: 3, glow: 0.1 };
  }

  // Underground structures — mineshafts (horizontal tunnels)
  const shaftNoise = fractalNoise(x * 0.5, y * 0.5, SEED + 900, 1, 40);
  if (depth > 30 && depth < 250 && shaftNoise > 0.78) {
    // Horizontal shaft: thin band
    const shaftY = Math.floor(y / 20) * 20 + 10;
    if (Math.abs(y - shaftY) <= 1 && hashCoord(x, shaftY, SEED + 901) < 0.4) {
      return { type: TileType.Air, revealed: false, hp: 0 };
    }
  }
  // Treasure rooms — rare large open spaces with loot
  const roomNoise = hashCoord(Math.floor(x / 8), Math.floor(y / 8), SEED + 950);
  if (depth > 80 && roomNoise < 0.005) {
    const rx = x % 8, ry = y % 8;
    if (rx >= 1 && rx <= 6 && ry >= 1 && ry <= 6) {
      // Walls have chests
      if (rx === 1 || rx === 6 || ry === 1 || ry === 6) {
        if (hashCoord(x, y, SEED + 951) < 0.3) return { type: TileType.Chest, revealed: false, hp: 5, glow: 0.5 };
      }
      return { type: TileType.Air, revealed: false, hp: 0 };
    }
  }

  const base = getBaseType(depth);
  return { type: base, revealed: false, hp: getTileHP(base) };
}

// Chunk-based world storage
const worldCache = new Map<string, Tile>();

export function getKey(x: number, y: number) { return `${x},${y}`; }

export function getTile(x: number, y: number): Tile {
  const k = getKey(x, y);
  let t = worldCache.get(k);
  if (!t) { t = generateTile(x, y); worldCache.set(k, t); }
  return t;
}

export function setTile(x: number, y: number, tile: Tile) {
  worldCache.set(getKey(x, y), tile);
}

export function revealAround(px: number, py: number, radius: number) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= radius * radius) {
        const t = getTile(px + dx, py + dy);
        if (!t.revealed) { t.revealed = true; setTile(px + dx, py + dy, t); }
      }
    }
  }
}
