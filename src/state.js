import { FRUIT_TILE, PACMAN_BASE_RADIUS, TILE_SIZE } from "./config.js";

export function createGameState() {
  return {
    map: [],
    pelletsRemaining: 0,
    score: 0,
    lives: 3,
    level: 1,
    gameRunning: false,
    gameOver: false,
    frightenedUntil: 0,
    pauseUntil: 0,
    currentGlobalMode: "scatter",
    modePhaseIndex: 0,
    modePhaseStartedAt: 0,
    frightenedCombo: 0,
    scorePopups: [],
    pacmanHiddenUntil: 0,
    totalPelletsAtLevel: 0,
    fruitSpawnMilestones: [],
    fruitMilestoneSpawned: [false, false],
    nextPowerAppleSpawnAt: 0,
    giantUntil: 0,
    giantGhostCombo: 0,
    pacmanSizeTransition: null,
    pacmanShrinkFinalizePending: false,
    pacmanShrinkRealign: null,
    pacmanGhostHomeExitLock: null,
    scoreSubmittedForCurrentGame: false,
    ghosts: [],

    pacmanDeath: {
      active: false,
      startedAt: 0,
      facing: 0
    },

    fruit: {
      active: false,
      expiresAt: 0,
      kind: "cherry",
      points: 100
    },

    powerApple: {
      active: false,
      x: FRUIT_TILE.x,
      y: FRUIT_TILE.y,
      expiresAt: 0
    },

    pacman: {
      x: 10 * TILE_SIZE + TILE_SIZE / 2,
      y: 16 * TILE_SIZE + TILE_SIZE / 2,
      radius: PACMAN_BASE_RADIUS,
      speed: 2.35,
      dir: { x: 0, y: 0 },
      nextDir: { x: 0, y: 0 },
      turnQueue: [],
      mouth: 0,
      mouthDelta: 0.14
    }
  };
}
