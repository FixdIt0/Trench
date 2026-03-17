// Audio manager — preload, pool, play by event name
const SFX: Record<string, { src: string; vol: number; pool: number }> = {
  dig:      { src: "/sfx/dig.mp3",     vol: 0.3, pool: 3 },
  dig2:     { src: "/sfx/dig2.mp3",    vol: 0.3, pool: 3 },
  break:    { src: "/sfx/break.mp3",   vol: 0.4, pool: 2 },
  collect:  { src: "/sfx/collect.mp3", vol: 0.5, pool: 2 },
  chest:    { src: "/sfx/chest.mp3",   vol: 0.6, pool: 1 },
  explode:  { src: "/sfx/explode.mp3", vol: 0.5, pool: 2 },
  powerup:  { src: "/sfx/powerup.mp3", vol: 0.5, pool: 1 },
  lava:     { src: "/sfx/lava.mp3",    vol: 0.4, pool: 2 },
  damage:   { src: "/sfx/damage.mp3",  vol: 0.5, pool: 2 },
  death:    { src: "/sfx/death.mp3",   vol: 0.6, pool: 1 },
  step1:    { src: "/sfx/step1.mp3",   vol: 0.15, pool: 3 },
  step2:    { src: "/sfx/step2.mp3",   vol: 0.15, pool: 3 },
  sword:    { src: "/sfx/sword.mp3",   vol: 0.4, pool: 2 },
  bat:      { src: "/sfx/bat.mp3",     vol: 0.3, pool: 2 },
  slime:    { src: "/sfx/slime.mp3",   vol: 0.3, pool: 2 },
  spider:   { src: "/sfx/spider.mp3",  vol: 0.3, pool: 2 },
  minecart: { src: "/sfx/minecart.mp3", vol: 0.5, pool: 1 },
  ambient:  { src: "/sfx/ambient.mp3", vol: 0.15, pool: 1 },
};

const pools: Record<string, HTMLAudioElement[]> = {};
let loaded = false;

export function preloadAudio() {
  if (loaded) return;
  loaded = true;
  for (const [key, def] of Object.entries(SFX)) {
    pools[key] = [];
    for (let i = 0; i < def.pool; i++) {
      const a = new Audio(def.src);
      a.volume = def.vol;
      a.preload = "auto";
      pools[key].push(a);
    }
  }
}

export function play(name: string) {
  const pool = pools[name];
  if (!pool) return;
  const a = pool.find(a => a.paused || a.ended) || pool[0];
  a.currentTime = 0;
  a.play().catch(() => {});
}

export function playRandom(...names: string[]) {
  play(names[Math.floor(Math.random() * names.length)]);
}

let ambientPlaying = false;
export function startAmbient() {
  if (ambientPlaying) return;
  ambientPlaying = true;
  const a = pools.ambient?.[0];
  if (!a) return;
  a.loop = true;
  a.play().catch(() => {});
}

export function playMinecart() {
  play("minecart");
}
