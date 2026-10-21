import { widthTiles, heightTiles, FRUIT_TILE, FRUIT_LIFETIME_MS, PACMAN_GIANT_RADIUS, POWER_APPLE_GIANT_MS, POWER_APPLE_LIFETIME_MS, POWER_APPLE_RESPAWN_MIN_MS, POWER_APPLE_RESPAWN_MAX_MS } from "./config.js";
import { toTile, tileCenterToPixels, isInsideGhostHome } from "./grid.js";

export function createItems({ state, clock, rules, status, giant, mode }) {
  const { pacman, fruit, powerApple } = state;
  const { isPacmanGiant } = status;
  const { startPacmanSizeTransition } = giant;
  const { reverseGhosts } = mode;

  const FRUIT_BY_LEVEL = (rules && Array.isArray(rules.FRUIT_BY_LEVEL)) ? rules.FRUIT_BY_LEVEL : [
    { kind: "cherry", points: 100 },
    { kind: "strawberry", points: 300 },
    { kind: "orange", points: 500 },
    { kind: "apple", points: 700 },
    { kind: "melon", points: 1000 },
    { kind: "galaxian", points: 2000 },
    { kind: "bell", points: 3000 },
    { kind: "key", points: 5000 }
  ];

  function fruitForLevel() {
    if (rules) {
      return rules.fruitForLevel(state.level);
    }
    const idx = Math.min(state.level - 1, FRUIT_BY_LEVEL.length - 1);
    return FRUIT_BY_LEVEL[idx];
  }

  function spawnFruit(now) {
    const fruitDef = fruitForLevel();
    fruit.active = true;
    fruit.expiresAt = now + FRUIT_LIFETIME_MS;
    fruit.kind = fruitDef.kind;
    fruit.points = fruitDef.points;
  }

  function randomPowerAppleTile() {
    const pacTileX = toTile(pacman.x);
    const pacTileY = toTile(pacman.y);

    for (let i = 0; i < 240; i += 1) {
      const tx = Math.floor(Math.random() * widthTiles);
      const ty = Math.floor(Math.random() * heightTiles);
      const cell = state.map[ty]?.[tx];
      if (cell === "#" || cell === "-") {
        continue;
      }
      if (tx === FRUIT_TILE.x && ty === FRUIT_TILE.y) {
        continue;
      }
      if (tx === pacTileX && ty === pacTileY) {
        continue;
      }
      if (isInsideGhostHome({ x: tx, y: ty })) {
        continue;
      }
      return { x: tx, y: ty };
    }

    for (let y = 0; y < heightTiles; y += 1) {
      for (let x = 0; x < widthTiles; x += 1) {
        const cell = state.map[y][x];
        if (cell === "#" || cell === "-") {
          continue;
        }
        if (x === FRUIT_TILE.x && y === FRUIT_TILE.y) {
          continue;
        }
        if (isInsideGhostHome({ x, y })) {
          continue;
        }
        return { x, y };
      }
    }

    return { x: FRUIT_TILE.x, y: FRUIT_TILE.y };
  }

  function scheduleNextPowerAppleSpawn(now) {
    const interval =
      POWER_APPLE_RESPAWN_MIN_MS +
      Math.random() * (POWER_APPLE_RESPAWN_MAX_MS - POWER_APPLE_RESPAWN_MIN_MS);
    state.nextPowerAppleSpawnAt = now + interval;
  }

  function spawnPowerApple(now, forced = false) {
    if (powerApple.active && !forced) {
      return false;
    }
    const tile = randomPowerAppleTile();
    powerApple.active = true;
    powerApple.x = tile.x;
    powerApple.y = tile.y;
    powerApple.expiresAt = now + POWER_APPLE_LIFETIME_MS;
    scheduleNextPowerAppleSpawn(now);
    return true;
  }

  function updatePowerApple(now) {
    if (powerApple.active && now >= powerApple.expiresAt) {
      powerApple.active = false;
    }

    if (!powerApple.active && now >= state.nextPowerAppleSpawnAt) {
      spawnPowerApple(now);
    }

  }

  function updateFruit(now) {
    if (fruit.active) {
      if (now >= fruit.expiresAt) {
        fruit.active = false;
      }
      return;
    }

    if (rules) {
      const nextIndex = rules.nextFruitSpawnIndex(
        state.totalPelletsAtLevel,
        state.pelletsRemaining,
        state.fruitSpawnMilestones,
        state.fruitMilestoneSpawned
      );
      if (nextIndex >= 0) {
        state.fruitMilestoneSpawned[nextIndex] = true;
        spawnFruit(now);
      }
      return;
    }

    const pelletsEaten = state.totalPelletsAtLevel - state.pelletsRemaining;
    for (let i = 0; i < state.fruitSpawnMilestones.length; i += 1) {
      if (state.fruitMilestoneSpawned[i]) {
        continue;
      }
      if (pelletsEaten >= state.fruitSpawnMilestones[i]) {
        state.fruitMilestoneSpawned[i] = true;
        spawnFruit(now);
        break;
      }
    }
  }

  function collectFruitIfTouched(now) {
    if (!fruit.active) {
      return;
    }

    const tx = toTile(pacman.x);
    const ty = toTile(pacman.y);
    if (tx !== FRUIT_TILE.x || ty !== FRUIT_TILE.y) {
      return;
    }

    const points = fruit.points;
    state.score += points;
    const center = tileCenterToPixels(FRUIT_TILE);
    state.scorePopups.push({
      x: center.x,
      y: center.y,
      text: String(points),
      expiresAt: now + 900
    });
    fruit.active = false;
  }

  function collectPowerAppleIfTouched(now) {
    if (!powerApple.active) {
      return;
    }

    const tx = toTile(pacman.x);
    const ty = toTile(pacman.y);
    if (tx !== powerApple.x || ty !== powerApple.y) {
      return;
    }

    state.score += 1200;
    const activationNow = clock.now();
    const center = tileCenterToPixels({ x: powerApple.x, y: powerApple.y });
    state.scorePopups.push({
      x: center.x,
      y: center.y,
      text: "1200",
      expiresAt: activationNow + 900
    });
    powerApple.active = false;
    state.giantUntil = activationNow + POWER_APPLE_GIANT_MS;
    state.giantGhostCombo = 0;
    state.pacmanShrinkFinalizePending = true;
    state.pacmanShrinkRealign = null;
    startPacmanSizeTransition(PACMAN_GIANT_RADIUS, activationNow, "grow");
  }

  function eatPellet() {
    if (isPacmanGiant()) {
      return;
    }

    const tx = toTile(pacman.x);
    const ty = toTile(pacman.y);
    const cell = state.map[ty]?.[tx];
    if (cell === ".") {
      state.map[ty][tx] = " ";
      state.score += 10;
      state.pelletsRemaining -= 1;
    } else if (cell === "o") {
      state.map[ty][tx] = " ";
      state.score += 50;
      state.pelletsRemaining -= 1;
      const now = clock.now();
      state.frightenedUntil = Math.max(state.frightenedUntil, now) + 8000;
      state.frightenedCombo = 0;
      for (const ghost of state.ghosts) {
        ghost.frightened = !ghost.isReturning;
      }
      reverseGhosts();
    }
  }

  return { fruitForLevel, scheduleNextPowerAppleSpawn, updatePowerApple, updateFruit, collectFruitIfTouched, collectPowerAppleIfTouched, eatPellet };
}
