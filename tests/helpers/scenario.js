import { mulberry32 } from "./stubs.js";

const DIRS = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 }
];
const TILE_SIZE = 28;
const FRAME_MS = 1000 / 60;
export const RANDOM_SEED = 987654321;
const FRAMES = 9000;
const SAMPLE_EVERY = 150;
const GIANT_AT_FRAMES = [1200, 4200];

const round = (n) => (typeof n === "number" ? Math.round(n * 1e6) / 1e6 : n);

// adapter: { state, press(dir), frame(now), setClock(now) } where state exposes the live game state.
export function runScenario(adapter) {
  const rng = mulberry32(12345);
  const samples = [];

  adapter.state.gameRunning = true;
  adapter.state.pauseUntil = 0;
  adapter.state.lives = 99;

  for (let i = 1; i <= FRAMES; i += 1) {
    const now = 1000 + i * FRAME_MS;
    adapter.setClock(now);

    if (i % 7 === 0) {
      adapter.press(DIRS[Math.floor(rng() * DIRS.length)]);
    }
    if (GIANT_AT_FRAMES.includes(i)) {
      const { pacman, powerApple } = adapter.state;
      powerApple.active = true;
      powerApple.x = Math.floor(pacman.x / TILE_SIZE);
      powerApple.y = Math.floor(pacman.y / TILE_SIZE);
      powerApple.expiresAt = now + 60000;
    }

    adapter.frame(now);

    if (i % SAMPLE_EVERY === 0) {
      const s = adapter.state;
      samples.push({
        frame: i,
        score: s.score,
        lives: s.lives,
        level: s.level,
        gameOver: s.gameOver,
        pellets: s.pelletsRemaining,
        giant: s.giantUntil > 0,
        pacman: [round(s.pacman.x), round(s.pacman.y), s.pacman.dir.x, s.pacman.dir.y, round(s.pacman.radius)],
        ghosts: s.ghosts.map((g) => [round(g.x), round(g.y), g.dir.x, g.dir.y, g.frightened, g.isReturning])
      });
    }
  }

  return samples;
}
