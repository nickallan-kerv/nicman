import { TILE_SIZE, MAP_TEMPLATE, widthTiles, heightTiles, PACMAN_BASE_RADIUS, ghostSpawn } from "./config.js";

export function createStage({ state, clock, rules, items }) {
  const { pacman, fruit, powerApple } = state;
  const { fruitForLevel, scheduleNextPowerAppleSpawn } = items;

  function cloneMap() {
    return MAP_TEMPLATE.map((row) => row.split(""));
  }

  function resetMap() {
    state.map = cloneMap();
    state.pelletsRemaining = 0;
    for (let y = 0; y < heightTiles; y += 1) {
      for (let x = 0; x < widthTiles; x += 1) {
        if (state.map[y][x] === "." || state.map[y][x] === "o") {
          state.pelletsRemaining += 1;
        }
      }
    }

    state.totalPelletsAtLevel = state.pelletsRemaining;
    state.fruitSpawnMilestones = rules
      ? rules.fruitSpawnMilestones(state.totalPelletsAtLevel)
      : [Math.floor(state.totalPelletsAtLevel * 0.29), Math.floor(state.totalPelletsAtLevel * 0.69)];
    state.fruitMilestoneSpawned = [false, false];
    fruit.active = false;
    fruit.expiresAt = 0;
    const fruitDef = fruitForLevel();
    fruit.kind = fruitDef.kind;
    fruit.points = fruitDef.points;

    powerApple.active = false;
    powerApple.expiresAt = 0;
    state.giantUntil = 0;
    state.giantGhostCombo = 0;
    pacman.radius = PACMAN_BASE_RADIUS;
    state.pacmanSizeTransition = null;
    state.pacmanShrinkFinalizePending = false;
    state.pacmanShrinkRealign = null;
    scheduleNextPowerAppleSpawn(clock.now());
  }

  function resetPositions() {
    pacman.x = 10 * TILE_SIZE + TILE_SIZE / 2;
    pacman.y = 16 * TILE_SIZE + TILE_SIZE / 2;
    pacman.radius = PACMAN_BASE_RADIUS;
    pacman.dir = { x: 0, y: 0 };
    pacman.nextDir = { x: 0, y: 0 };
    pacman.turnQueue = [];
    pacman.mouth = 0;
    state.pacmanGhostHomeExitLock = null;
    state.pacmanSizeTransition = null;
    state.pacmanShrinkFinalizePending = false;
    state.pacmanShrinkRealign = null;

    state.giantUntil = 0;
    state.giantGhostCombo = 0;

    state.ghosts = ghostSpawn.map((g) => ({
      x: g.x * TILE_SIZE + TILE_SIZE / 2,
      y: g.y * TILE_SIZE + TILE_SIZE / 2,
      radius: TILE_SIZE * 0.35,
      speed: 1.8 + (state.level - 1) * 0.08,
      dir: { x: 0, y: -1 },
      nextDir: { x: 0, y: -1 },
      color: g.color,
      kind: g.kind,
      scatterTarget: g.scatter,
      forceReverse: false,
      isReturning: false,
      frightened: false,
      hasLeftHome: false,
      returnStepTarget: null,
      home: { x: g.x, y: g.y }
    }));
  }

  return { resetMap, resetPositions };
}
