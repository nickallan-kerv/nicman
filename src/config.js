export const TILE_SIZE = 28;
export const MAP_TEMPLATE = [
  "#####################",
  "#.........#.........#",
  "#.###.###.#.###.###.#",
  "#o###.###.#.###.###o#",
  "#...................#",
  "#.###.#.#####.#.###.#",
  "#.....#...#...#.....#",
  "#####.### # ###.#####",
  "#####.#       #.#####",
  "#####.# ##-## #.#####",
  "     .  #   #  .     ",
  "#####.# ##### #.#####",
  "#####.#       #.#####",
  "#####.# ##### #.#####",
  "#.........#.........#",
  "#.###.###.#.###.###.#",
  "#o..#...........#..o#",
  "###.#.#.#####.#.#.###",
  "#.....#...#...#.....#",
  "#.#######.#.#######.#",
  "#...................#",
  "#####################"
];
export const UP = { x: 0, y: -1 };
export const DOWN = { x: 0, y: 1 };
export const LEFT = { x: -1, y: 0 };
export const RIGHT = { x: 1, y: 0 };
export const CARDINAL_DIRS = [UP, DOWN, LEFT, RIGHT];
export const TILE_CENTER_EPSILON = 0.45;
export const GHOST_GATE_TILE = { x: 10, y: 9 };
export const GHOST_EXIT_TILE = { x: 10, y: 8 };
export const widthTiles = MAP_TEMPLATE[0].length;
export const heightTiles = MAP_TEMPLATE.length;
export const BOARD_WIDTH = widthTiles * TILE_SIZE;
export const BOARD_HEIGHT = heightTiles * TILE_SIZE;
export const JOYSTICK_RADIUS_RATIO = 0.34;
export const JOYSTICK_DEADZONE = 0.28;
export const LEADERBOARD_LIMIT = 10;
export const LEADERBOARD_REFRESH_MS = 60000;
export const SUPABASE_URL = "https://wnjnbddbguunhiubcxpg.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8a42lb3cv4ilFQ91nJiSzA_uo5ij_K_";
export const PLAYER_NAME_STORAGE_KEY = "nicman.playerName";
export const SIMULATION_STEP_MS = 1000 / 60;
export const MAX_FRAME_DELTA_MS = 250;
export const MAX_SIMULATION_STEPS_PER_FRAME = 12;
export const PACMAN_DEATH_DURATION_MS = 760;
export const FRUIT_TILE = { x: 10, y: 12 };
export const FRUIT_LIFETIME_MS = 9500;
export const MODE_PHASES = [
  { mode: "scatter", durationMs: 7000 },
  { mode: "chase", durationMs: 20000 },
  { mode: "scatter", durationMs: 7000 },
  { mode: "chase", durationMs: 20000 },
  { mode: "scatter", durationMs: 5000 },
  { mode: "chase", durationMs: 20000 },
  { mode: "scatter", durationMs: 5000 },
  { mode: "chase", durationMs: Number.POSITIVE_INFINITY }
];
export const PACMAN_BASE_RADIUS = TILE_SIZE * 0.38;
export const PACMAN_GIANT_RADIUS = PACMAN_BASE_RADIUS * 3;
export const PACMAN_SIZE_TRANSITION_MS = 2000;
export const POWER_APPLE_GIANT_MS = 10000;
export const FRIGHTENED_WARNING_MS = 2000;
export const FRIGHTENED_FLASH_MS = 150;
export const POWER_APPLE_LIFETIME_MS = 14000;
export const POWER_APPLE_RESPAWN_MIN_MS = 12000;
export const POWER_APPLE_RESPAWN_MAX_MS = 24000;
export const ghostSpawn = [
  { x: 10, y: 10, color: "#ff4f5a", kind: "blinky", scatter: { x: widthTiles - 2, y: 1 } },
  { x: 9, y: 10, color: "#ff93cc", kind: "pinky", scatter: { x: 1, y: 1 } },
  { x: 11, y: 10, color: "#45d0ff", kind: "inky", scatter: { x: widthTiles - 2, y: heightTiles - 2 } },
  { x: 10, y: 9, color: "#ffb347", kind: "clyde", scatter: { x: 1, y: heightTiles - 2 } }
];
