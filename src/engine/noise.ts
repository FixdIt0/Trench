// Simple seeded Perlin-like noise for world generation
export function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function hashCoord(x: number, y: number, seed: number): number {
  let h = seed;
  h = ((h << 5) - h + x) | 0;
  h = ((h << 5) - h + y) | 0;
  h = ((h << 5) - h + (x * 374761393)) | 0;
  h = ((h << 5) - h + (y * 668265263)) | 0;
  return (((h ^ (h >> 13)) * 1274126177) >>> 0) / 4294967296;
}

export function smoothNoise(x: number, y: number, seed: number, scale: number): number {
  const sx = x / scale, sy = y / scale;
  const ix = Math.floor(sx), iy = Math.floor(sy);
  const fx = sx - ix, fy = sy - iy;
  const a = hashCoord(ix, iy, seed);
  const b = hashCoord(ix + 1, iy, seed);
  const c = hashCoord(ix, iy + 1, seed);
  const d = hashCoord(ix + 1, iy + 1, seed);
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}

export function fractalNoise(x: number, y: number, seed: number, octaves = 4, scale = 32): number {
  let val = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    val += smoothNoise(x * freq, y * freq, seed + i * 1000, scale) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return val / max;
}
