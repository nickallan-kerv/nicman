const TILE_SIZE = 28;
const MAP_TEMPLATE = [
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

const UP = { x: 0, y: -1 };
const DOWN = { x: 0, y: 1 };
const LEFT = { x: -1, y: 0 };
const RIGHT = { x: 1, y: 0 };

const KEY_DIRS = {
  ArrowUp: UP,
  ArrowDown: DOWN,
  ArrowLeft: LEFT,
  ArrowRight: RIGHT,
  Numpad8: UP,
  Numpad2: DOWN,
  Numpad4: LEFT,
  Numpad6: RIGHT
};

const CARDINAL_DIRS = [UP, DOWN, LEFT, RIGHT];
const TILE_CENTER_EPSILON = 0.45;
const GHOST_GATE_TILE = { x: 10, y: 9 };
const GHOST_EXIT_TILE = { x: 10, y: 8 };
const RULES = globalThis.NicmanRules || null;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const appShell = document.querySelector(".app-shell");
const gameLayout = document.querySelector(".game-layout");
const boardWrap = document.querySelector(".board-wrap");
const sidePanel = document.querySelector(".side-panel");

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const actionButton = document.getElementById("actionButton");
const joystick = document.getElementById("joystick");
const joystickKnob = document.getElementById("joystickKnob");
const leaderboardList = document.getElementById("leaderboardList");
const leaderboardStatus = document.getElementById("leaderboardStatus");
const overlayLeaderboardPanel = document.getElementById("overlayLeaderboardPanel");
const overlayLeaderboardList = document.getElementById("overlayLeaderboardList");
const overlayLeaderboardStatus = document.getElementById("overlayLeaderboardStatus");
const refreshLeaderboardButton = document.getElementById("refreshLeaderboard");
const scoreSubmitForm = document.getElementById("scoreSubmitForm");
const playerNameInput = document.getElementById("playerName");
const submitScoreButton = document.getElementById("submitScoreButton");

const widthTiles = MAP_TEMPLATE[0].length;
const heightTiles = MAP_TEMPLATE.length;
canvas.width = widthTiles * TILE_SIZE;
canvas.height = heightTiles * TILE_SIZE;

const queryParams = new URLSearchParams(window.location.search);
const forceMobileControls =
  queryParams.get("mobilecontrols") === "1" || queryParams.get("mobilecontrols") === "true";
if (forceMobileControls) {
  document.body.classList.add("force-mobile-controls");
}

const JOYSTICK_RADIUS_RATIO = 0.34;
const JOYSTICK_DEADZONE = 0.28;
const LEADERBOARD_LIMIT = 10;
const LEADERBOARD_REFRESH_MS = 60000;
const SUPABASE_URL = "https://wnjnbddbguunhiubcxpg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_8a42lb3cv4ilFQ91nJiSzA_uo5ij_K_";
const SCORE_TABLE_PATH = "/rest/v1/scores";
const PLAYER_NAME_STORAGE_KEY = "nicman.playerName";
let joystickPointerId = null;
let leaderboardEntries = [];
let scoreSubmittedForCurrentGame = false;
let leaderboardRefreshTimerId = null;

function parsePx(value) {
  const n = Number.parseFloat(value || "0");
  return Number.isFinite(n) ? n : 0;
}

function sanitizePlayerName(value) {
  const trimmed = String(value || "").trim().slice(0, 16);
  const clean = trimmed.replace(/[^a-z0-9_\-\s]/gi, "");
  return clean || "PLAYER1";
}

function leaderboardHeaders(includeJsonContentType = false) {
  const headers = {
    apikey: SUPABASE_PUBLISHABLE_KEY
  };
  if (includeJsonContentType) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

function setLeaderboardStatus(message, isError = false) {
  if (leaderboardStatus) {
    leaderboardStatus.textContent = message;
    leaderboardStatus.classList.toggle("error", Boolean(isError));
  }
  if (overlayLeaderboardStatus) {
    overlayLeaderboardStatus.textContent = message;
    overlayLeaderboardStatus.classList.toggle("error", Boolean(isError));
  }
}

function renderLeaderboardList(targetList, entries, displayLimit) {
  if (!targetList) {
    return;
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    targetList.innerHTML = '<li class="leaderboard-empty">No scores yet. Be the first!</li>';
    return;
  }

  targetList.innerHTML = entries
    .slice(0, displayLimit)
    .map((entry, index) => {
      const rank = index + 1;
      const name = sanitizePlayerName(entry.player_name || "PLAYER1");
      const value = Number.isFinite(entry.score) ? entry.score : Number(entry.score) || 0;
      return `<li><span class="leaderboard-rank">#${rank}</span><span class="leaderboard-name">${name}</span><span class="leaderboard-score">${value}</span></li>`;
    })
    .join("");
}

function isStackedLayout() {
  return window.matchMedia("(max-width: 640px)").matches;
}

function renderLeaderboard() {
  const sideLimit = 10;
  const overlayLimit = 5;
  renderLeaderboardList(leaderboardList, leaderboardEntries, sideLimit);
  renderLeaderboardList(overlayLeaderboardList, leaderboardEntries, overlayLimit);
  if (overlayLeaderboardPanel) {
    overlayLeaderboardPanel.classList.toggle("hidden", !isStackedLayout() || !gameOver);
  }
}

async function fetchLeaderboard() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    setLeaderboardStatus("Leaderboard unavailable: missing configuration.", true);
    return;
  }

  try {
    const url = `${SUPABASE_URL}${SCORE_TABLE_PATH}?select=player_name,score,level,created_at&order=score.desc,created_at.asc&limit=${LEADERBOARD_LIMIT}`;
    const response = await fetch(url, {
      method: "GET",
      headers: leaderboardHeaders(false)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Request failed (${response.status}): ${errorText}`);
    }

    const rows = await response.json();
    leaderboardEntries = Array.isArray(rows) ? rows : [];
    renderLeaderboard();
    setLeaderboardStatus("");
  } catch (error) {
    renderLeaderboard();
    setLeaderboardStatus(`Could not load leaderboard. ${error.message}`, true);
  }
}

function canSubmitCurrentScore() {
  return gameOver && !scoreSubmittedForCurrentGame && Number.isFinite(score) && score > 0;
}

function updateSubmitButtonState() {
  if (!submitScoreButton) {
    return;
  }
  submitScoreButton.disabled = !canSubmitCurrentScore();
}

async function submitCurrentScore(event) {
  if (event) {
    event.preventDefault();
  }

  if (!canSubmitCurrentScore()) {
    setLeaderboardStatus("Finish a run first to submit a score.", true);
    return;
  }

  const playerName = sanitizePlayerName(playerNameInput ? playerNameInput.value : "");

  if (playerNameInput) {
    playerNameInput.value = playerName;
  }
  localStorage.setItem(PLAYER_NAME_STORAGE_KEY, playerName);

  try {
    setLeaderboardStatus("Submitting score...");
    updateSubmitButtonState();
    const payload = {
      player_name: playerName,
      score,
      level
    };

    const response = await fetch(`${SUPABASE_URL}${SCORE_TABLE_PATH}`, {
      method: "POST",
      headers: leaderboardHeaders(true),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Request failed (${response.status}): ${errorText}`);
    }

    scoreSubmittedForCurrentGame = true;
    setLeaderboardStatus("Score submitted. Nice run!");
    updateSubmitButtonState();
    await fetchLeaderboard();
  } catch (error) {
    setLeaderboardStatus(`Score submit failed. ${error.message}`, true);
    updateSubmitButtonState();
  }
}

function initializeLeaderboardUi() {
  if (playerNameInput) {
    playerNameInput.value = sanitizePlayerName(localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || "PLAYER1");
  }

  if (refreshLeaderboardButton) {
    refreshLeaderboardButton.addEventListener("click", () => {
      fetchLeaderboard();
    });
  }

  if (scoreSubmitForm) {
    scoreSubmitForm.addEventListener("submit", submitCurrentScore);
  }

  updateSubmitButtonState();
}

function stopLeaderboardAutoRefresh() {
  if (leaderboardRefreshTimerId === null) {
    return;
  }
  clearInterval(leaderboardRefreshTimerId);
  leaderboardRefreshTimerId = null;
}

function startLeaderboardAutoRefresh() {
  stopLeaderboardAutoRefresh();
  if (document.hidden) {
    return;
  }

  leaderboardRefreshTimerId = setInterval(() => {
    if (document.hidden) {
      return;
    }
    fetchLeaderboard();
  }, LEADERBOARD_REFRESH_MS);
}

function handleLeaderboardVisibilityChange() {
  if (document.hidden) {
    stopLeaderboardAutoRefresh();
    return;
  }

  fetchLeaderboard();
  startLeaderboardAutoRefresh();
}

function fitBoardToViewport() {
  if (!appShell || !gameLayout || !boardWrap) {
    return;
  }

  const bodyStyle = getComputedStyle(document.body);
  const layoutStyle = getComputedStyle(gameLayout);
  const boardStyle = getComputedStyle(boardWrap);

  const bodyPadY = parsePx(bodyStyle.paddingTop) + parsePx(bodyStyle.paddingBottom);
  const bodyPadX = parsePx(bodyStyle.paddingLeft) + parsePx(bodyStyle.paddingRight);
  const layoutGap = parsePx(layoutStyle.columnGap || layoutStyle.gap);
  const boardChromeX =
    parsePx(boardStyle.paddingLeft) +
    parsePx(boardStyle.paddingRight) +
    parsePx(boardStyle.borderLeftWidth) +
    parsePx(boardStyle.borderRightWidth);
  const boardChromeY =
    parsePx(boardStyle.paddingTop) +
    parsePx(boardStyle.paddingBottom) +
    parsePx(boardStyle.borderTopWidth) +
    parsePx(boardStyle.borderBottomWidth);

  const isStacked = window.matchMedia("(max-width: 640px)").matches;
  const sideWidth = !isStacked && sidePanel ? sidePanel.offsetWidth : 0;
  const targetWidth = RULES
    ? RULES.computeBoardWidth({
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      bodyPadX,
      bodyPadY,
      sideWidth,
      layoutGap,
      boardChromeX,
      boardChromeY,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height
    })
    : null;

  if (!Number.isFinite(targetWidth) || targetWidth <= 0) {
    return;
  }
  boardWrap.style.width = `${targetWidth}px`;
}

let resizeRaf = 0;
const SIMULATION_STEP_MS = 1000 / 60;
const MAX_FRAME_DELTA_MS = 250;
const MAX_SIMULATION_STEPS_PER_FRAME = 12;
let simulationLagMs = 0;
let lastFrameTimeMs = null;

function scheduleBoardFit() {
  if (resizeRaf) {
    cancelAnimationFrame(resizeRaf);
  }
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    fitBoardToViewport();
    fitGameOverOverlayTitle();
    renderLeaderboard();
  });
}

let map = [];
let pelletsRemaining = 0;

let score = 0;
let lives = 3;
let level = 1;
let gameRunning = false;
let gameOver = false;
let frightenedUntil = 0;
let pauseUntil = 0;
let currentGlobalMode = "scatter";
let modePhaseIndex = 0;
let modePhaseStartedAt = 0;
let frightenedCombo = 0;
let scorePopups = [];
let pacmanHiddenUntil = 0;
let totalPelletsAtLevel = 0;
let fruitSpawnMilestones = [];
let fruitMilestoneSpawned = [false, false];

const PACMAN_DEATH_DURATION_MS = 760;
const pacmanDeath = {
  active: false,
  startedAt: 0,
  facing: 0
};

const FRUIT_TILE = { x: 10, y: 12 };
const FRUIT_LIFETIME_MS = 9500;
const FRUIT_BY_LEVEL = (RULES && Array.isArray(RULES.FRUIT_BY_LEVEL)) ? RULES.FRUIT_BY_LEVEL : [
  { kind: "cherry", points: 100 },
  { kind: "strawberry", points: 300 },
  { kind: "orange", points: 500 },
  { kind: "apple", points: 700 },
  { kind: "melon", points: 1000 },
  { kind: "galaxian", points: 2000 },
  { kind: "bell", points: 3000 },
  { kind: "key", points: 5000 }
];

const fruit = {
  active: false,
  expiresAt: 0,
  kind: "cherry",
  points: 100
};

const MODE_PHASES = [
  { mode: "scatter", durationMs: 7000 },
  { mode: "chase", durationMs: 20000 },
  { mode: "scatter", durationMs: 7000 },
  { mode: "chase", durationMs: 20000 },
  { mode: "scatter", durationMs: 5000 },
  { mode: "chase", durationMs: 20000 },
  { mode: "scatter", durationMs: 5000 },
  { mode: "chase", durationMs: Number.POSITIVE_INFINITY }
];

const PACMAN_BASE_RADIUS = TILE_SIZE * 0.38;
const POWER_APPLE_GIANT_MS = 10000;
const POWER_APPLE_LIFETIME_MS = 14000;
const POWER_APPLE_RESPAWN_MIN_MS = 12000;
const POWER_APPLE_RESPAWN_MAX_MS = 24000;
const APPLE_RENDER_STYLE = {
  regular: {
    body: "#38c866",
    stem: "#7f4e2c",
    leaf: "#62d77a"
  },
  power: {
    body: "#39d66b",
    stem: "#ffdca3",
    leaf: "#66cc7a"
  }
};

const pacman = {
  x: 10 * TILE_SIZE + TILE_SIZE / 2,
  y: 16 * TILE_SIZE + TILE_SIZE / 2,
  radius: PACMAN_BASE_RADIUS,
  speed: 2.35,
  dir: { x: 0, y: 0 },
  nextDir: { x: 0, y: 0 },
  turnQueue: [],
  mouth: 0,
  mouthDelta: 0.14
};

const powerApple = {
  active: false,
  x: FRUIT_TILE.x,
  y: FRUIT_TILE.y,
  expiresAt: 0
};

let nextPowerAppleSpawnAt = 0;
let giantUntil = 0;
let giantGhostCombo = 0;
let mobileGestureLockBound = false;
let pacmanGhostHomeExitLock = null;

const ghostSpawn = [
  { x: 10, y: 10, color: "#ff4f5a", kind: "blinky", scatter: { x: widthTiles - 2, y: 1 } },
  { x: 9, y: 10, color: "#ff93cc", kind: "pinky", scatter: { x: 1, y: 1 } },
  { x: 11, y: 10, color: "#45d0ff", kind: "inky", scatter: { x: widthTiles - 2, y: heightTiles - 2 } },
  { x: 10, y: 9, color: "#ffb347", kind: "clyde", scatter: { x: 1, y: heightTiles - 2 } }
];

let ghosts = [];

function cloneMap() {
  return MAP_TEMPLATE.map((row) => row.split(""));
}

function resetMap() {
  map = cloneMap();
  pelletsRemaining = 0;
  for (let y = 0; y < heightTiles; y += 1) {
    for (let x = 0; x < widthTiles; x += 1) {
      if (map[y][x] === "." || map[y][x] === "o") {
        pelletsRemaining += 1;
      }
    }
  }

  totalPelletsAtLevel = pelletsRemaining;
  fruitSpawnMilestones = RULES
    ? RULES.fruitSpawnMilestones(totalPelletsAtLevel)
    : [Math.floor(totalPelletsAtLevel * 0.29), Math.floor(totalPelletsAtLevel * 0.69)];
  fruitMilestoneSpawned = [false, false];
  fruit.active = false;
  fruit.expiresAt = 0;
  const fruitDef = fruitForLevel();
  fruit.kind = fruitDef.kind;
  fruit.points = fruitDef.points;

  powerApple.active = false;
  powerApple.expiresAt = 0;
  giantUntil = 0;
  giantGhostCombo = 0;
  pacman.radius = PACMAN_BASE_RADIUS;
  scheduleNextPowerAppleSpawn(performance.now());
}

function toTile(value) {
  return Math.floor(value / TILE_SIZE);
}

function wrapTileX(tx) {
  if (tx < 0) {
    return widthTiles - 1;
  }
  if (tx >= widthTiles) {
    return 0;
  }
  return tx;
}

function tileAt(x, y) {
  let tx = toTile(x);
  const ty = toTile(y);
  tx = wrapTileX(tx);
  if (ty < 0 || ty >= heightTiles || tx < 0 || tx >= widthTiles) {
    return "#";
  }
  return map[ty][tx];
}

function tileIsWall(tx, ty) {
  if (ty < 0 || ty >= heightTiles) {
    return true;
  }
  const wrappedX = wrapTileX(tx);
  return map[ty][wrappedX] === "#";
}

function tileBlockedForEntity(entity, tx, ty, attemptedDir = null) {
  if (ty < 0 || ty >= heightTiles) {
    return true;
  }

  const wrappedX = wrapTileX(tx);
  const cell = map[ty][wrappedX];

  if (entity === pacman && isPacmanGiant()) {
    return false;
  }

  if (cell === "#") {
    return true;
  }

  if (cell !== "-") {
    return false;
  }

  // Pink home gate blocks Pacman unless giant-exit lock is actively moving upward.
  if (entity === pacman) {
    if (pacmanGhostHomeExitLock) {
      const dirToCheck = attemptedDir || entity.dir || { x: 0, y: 0 };
      if (dirToCheck.y === -1) {
        return false;
      }
    }
    return true;
  }

  if (!entity || !entity.kind) {
    return true;
  }

  // Eaten ghosts are allowed back into home through the gate.
  if (entity.isReturning) {
    return false;
  }

  // Normal ghosts may only pass the gate when moving upward out of home.
  const dirToCheck = attemptedDir || entity.dir || { x: 0, y: 0 };
  return dirToCheck.y !== -1;
}

function isInsideGhostHome(tile) {
  return tile.x >= 8 && tile.x <= 12 && tile.y >= 9 && tile.y <= 12;
}

function canTravelFromTile(entity, dir) {
  if (dir.x === 0 && dir.y === 0) {
    return true;
  }
  const tx = toTile(entity.x);
  const ty = toTile(entity.y);
  const nextX = tx + dir.x;
  const nextY = ty + dir.y;
  return !tileBlockedForEntity(entity, nextX, nextY, dir);
}

function tileCenterFromCoords(x, y) {
  return { x: toTile(x), y: toTile(y) };
}

function tileCenterToPixels(tile) {
  return {
    x: (tile.x + 0.5) * TILE_SIZE,
    y: (tile.y + 0.5) * TILE_SIZE
  };
}

function fruitForLevel() {
  if (RULES) {
    return RULES.fruitForLevel(level);
  }
  const idx = Math.min(level - 1, FRUIT_BY_LEVEL.length - 1);
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
    const cell = map[ty]?.[tx];
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
      const cell = map[y][x];
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
  nextPowerAppleSpawnAt = now + interval;
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

function isPacmanGiant(now = performance.now()) {
  return now < giantUntil;
}

function canPacmanStandAt(x, y) {
  const r = PACMAN_BASE_RADIUS - 1;
  const points = [
    { x: x - r, y: y - r },
    { x: x + r, y: y - r },
    { x: x - r, y: y + r },
    { x: x + r, y: y + r }
  ];

  for (const p of points) {
    const tx = toTile(p.x);
    const ty = toTile(p.y);
    if (tileBlockedForEntity(pacman, tx, ty, { x: 0, y: 0 })) {
      return false;
    }
  }

  return true;
}

function ensurePacmanOutsideWall() {
  let tx = toTile(pacman.x);
  let ty = toTile(pacman.y);
  if (!tileIsWall(tx, ty) && canPacmanStandAt(pacman.x, pacman.y)) {
    return;
  }

  for (let radius = 1; radius <= 8; radius += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const nx = wrapTileX(tx + dx);
        const ny = ty + dy;
        if (ny < 0 || ny >= heightTiles) {
          continue;
        }
        if (tileIsWall(nx, ny) || map[ny][nx] === "-") {
          continue;
        }

        const candidateX = (nx + 0.5) * TILE_SIZE;
        const candidateY = (ny + 0.5) * TILE_SIZE;
        if (!canPacmanStandAt(candidateX, candidateY)) {
          continue;
        }

        pacman.x = candidateX;
        pacman.y = candidateY;
        return;
      }
    }
  }
}

function beginPacmanGhostHomeExitLock() {
  const tile = tileCenterFromCoords(pacman.x, pacman.y);
  if (!isInsideGhostHome(tile)) {
    pacmanGhostHomeExitLock = null;
    return;
  }

  const preferred =
    (pacman.dir.x !== 0 || pacman.dir.y !== 0)
      ? pacman.dir
      : (pacman.nextDir.x !== 0 || pacman.nextDir.y !== 0)
        ? pacman.nextDir
        : UP;

  pacmanGhostHomeExitLock = { ...preferred };
}

function canPlacePacmanOnTile(tile) {
  const tx = wrapTileX(tile.x);
  const ty = tile.y;
  if (ty < 0 || ty >= heightTiles) {
    return false;
  }
  if (tileIsWall(tx, ty) || map[ty][tx] === "-" || isInsideGhostHome({ x: tx, y: ty })) {
    return false;
  }

  const px = (tx + 0.5) * TILE_SIZE;
  const py = (ty + 0.5) * TILE_SIZE;
  return canPacmanStandAt(px, py);
}

function placePacmanOnTile(tile, dir = null) {
  const tx = wrapTileX(tile.x);
  const ty = tile.y;
  pacman.x = (tx + 0.5) * TILE_SIZE;
  pacman.y = (ty + 0.5) * TILE_SIZE;
  if (dir) {
    pacman.dir = { ...dir };
    pacman.nextDir = { ...dir };
  }
}

function placePacmanOutsideGhostHomeByMomentum() {
  const tile = tileCenterFromCoords(pacman.x, pacman.y);
  if (!isInsideGhostHome(tile)) {
    return false;
  }

  const preferred =
    (pacman.dir.x !== 0 || pacman.dir.y !== 0)
      ? pacman.dir
      : (pacman.nextDir.x !== 0 || pacman.nextDir.y !== 0)
        ? pacman.nextDir
        : RIGHT;

  const movingHorizontally = preferred.x !== 0;
  if (!movingHorizontally) {
    return false;
  }

  const sideY = GHOST_GATE_TILE.y + 1;
  const leftExit = { x: GHOST_GATE_TILE.x - 3, y: sideY };
  const rightExit = { x: GHOST_GATE_TILE.x + 3, y: sideY };

  const orderedCandidates = preferred.x < 0
    ? [
      { tile: leftExit, dir: LEFT },
      { tile: { x: leftExit.x - 1, y: leftExit.y }, dir: LEFT },
      { tile: rightExit, dir: RIGHT }
    ]
    : [
      { tile: rightExit, dir: RIGHT },
      { tile: { x: rightExit.x + 1, y: rightExit.y }, dir: RIGHT },
      { tile: leftExit, dir: LEFT }
    ];

  for (const candidate of orderedCandidates) {
    if (!canPlacePacmanOnTile(candidate.tile)) {
      continue;
    }
    placePacmanOnTile(candidate.tile, candidate.dir);
    return true;
  }

  return false;
}

function updatePacmanGhostHomeExitLock() {
  if (!pacmanGhostHomeExitLock) {
    return false;
  }

  const tile = tileCenterFromCoords(pacman.x, pacman.y);
  if (!isInsideGhostHome(tile)) {
    pacmanGhostHomeExitLock = null;
    return false;
  }

  if (canTravelFromTile(pacman, pacmanGhostHomeExitLock)) {
    pacman.nextDir = { ...pacmanGhostHomeExitLock };
    pacman.dir = { ...pacmanGhostHomeExitLock };
    return true;
  }

  // If the preserved direction cannot progress, force upward toward gate exit.
  if (canTravelFromTile(pacman, UP)) {
    pacmanGhostHomeExitLock = { ...UP };
    pacman.nextDir = { ...UP };
    pacman.dir = { ...UP };
    return true;
  }

  pacman.dir = { x: 0, y: 0 };
  return true;
}

function updatePowerApple(now) {
  if (powerApple.active && now >= powerApple.expiresAt) {
    powerApple.active = false;
  }

  if (!powerApple.active && now >= nextPowerAppleSpawnAt) {
    spawnPowerApple(now);
  }

}

function syncPacmanGiantState(now) {
  if (isPacmanGiant(now)) {
    const giantRadius = PACMAN_BASE_RADIUS * 3;
    if (pacman.radius !== giantRadius) {
      pacman.radius = giantRadius;
    }
    return;
  }

  if (giantUntil !== 0) {
    giantUntil = 0;
  }

  if (pacman.radius !== PACMAN_BASE_RADIUS) {
    pacman.radius = PACMAN_BASE_RADIUS;
    giantGhostCombo = 0;
    ensurePacmanOutsideWall();
    if (placePacmanOutsideGhostHomeByMomentum()) {
      pacmanGhostHomeExitLock = null;
    } else {
      beginPacmanGhostHomeExitLock();
    }
  }
}

function updateFruit(now) {
  if (fruit.active) {
    if (now >= fruit.expiresAt) {
      fruit.active = false;
    }
    return;
  }

  if (RULES) {
    const nextIndex = RULES.nextFruitSpawnIndex(
      totalPelletsAtLevel,
      pelletsRemaining,
      fruitSpawnMilestones,
      fruitMilestoneSpawned
    );
    if (nextIndex >= 0) {
      fruitMilestoneSpawned[nextIndex] = true;
      spawnFruit(now);
    }
    return;
  }

  const pelletsEaten = totalPelletsAtLevel - pelletsRemaining;
  for (let i = 0; i < fruitSpawnMilestones.length; i += 1) {
    if (fruitMilestoneSpawned[i]) {
      continue;
    }
    if (pelletsEaten >= fruitSpawnMilestones[i]) {
      fruitMilestoneSpawned[i] = true;
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
  score += points;
  const center = tileCenterToPixels(FRUIT_TILE);
  scorePopups.push({
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

  score += 1200;
  const center = tileCenterToPixels({ x: powerApple.x, y: powerApple.y });
  scorePopups.push({
    x: center.x,
    y: center.y,
    text: "1200",
    expiresAt: now + 900
  });
  powerApple.active = false;
  giantUntil = now + POWER_APPLE_GIANT_MS;
  giantGhostCombo = 0;
  pacman.radius = PACMAN_BASE_RADIUS * 3;
}

function pacmanHeading() {
  if (pacman.dir.x !== 0 || pacman.dir.y !== 0) {
    return pacman.dir;
  }
  if (pacman.nextDir.x !== 0 || pacman.nextDir.y !== 0) {
    return pacman.nextDir;
  }
  return RIGHT;
}

function isWallAt(x, y, entity) {
  const tx = toTile(x);
  const ty = toTile(y);
  const intendedDir = entity && entity.dir ? entity.dir : null;
  return tileBlockedForEntity(entity, tx, ty, intendedDir);
}

function canMove(entity, dir) {
  if (dir.x === 0 && dir.y === 0) {
    return true;
  }
  if (entity === pacman && isPacmanGiant()) {
    return true;
  }
  const nx = entity.x + dir.x * entity.speed;
  const ny = entity.y + dir.y * entity.speed;
  const r = entity.radius - 1;
  const points = [
    { x: nx - r, y: ny - r },
    { x: nx + r, y: ny - r },
    { x: nx - r, y: ny + r },
    { x: nx + r, y: ny + r }
  ];
  return points.every((p) => !isWallAt(p.x, p.y, entity));
}

function moveEntity(entity) {
  if (canMove(entity, entity.nextDir)) {
    entity.dir = entity.nextDir;
  }
  if (canMove(entity, entity.dir)) {
    entity.x += entity.dir.x * entity.speed;
    entity.y += entity.dir.y * entity.speed;
  }

  if (entity.x < -entity.radius) {
    entity.x = canvas.width + entity.radius;
  } else if (entity.x > canvas.width + entity.radius) {
    entity.x = -entity.radius;
  }
}

function alignToGrid(entity) {
  const tileCenterX = (Math.floor(entity.x / TILE_SIZE) + 0.5) * TILE_SIZE;
  const tileCenterY = (Math.floor(entity.y / TILE_SIZE) + 0.5) * TILE_SIZE;
  if (Math.abs(entity.x - tileCenterX) < TILE_CENTER_EPSILON) {
    entity.x = tileCenterX;
  }
  if (Math.abs(entity.y - tileCenterY) < TILE_CENTER_EPSILON) {
    entity.y = tileCenterY;
  }
}

function isNearTileCenter(entity) {
  const offsetX = Math.abs((entity.x % TILE_SIZE) - TILE_SIZE / 2);
  const offsetY = Math.abs((entity.y % TILE_SIZE) - TILE_SIZE / 2);
  return offsetX < TILE_CENTER_EPSILON && offsetY < TILE_CENTER_EPSILON;
}

function snapToTileCenter(entity) {
  entity.x = (toTile(entity.x) + 0.5) * TILE_SIZE;
  entity.y = (toTile(entity.y) + 0.5) * TILE_SIZE;
}

function sameDirection(a, b) {
  return a.x === b.x && a.y === b.y;
}

function queuePacmanTurn(dir) {
  const last = pacman.turnQueue[pacman.turnQueue.length - 1];
  if (last && sameDirection(last, dir)) {
    return;
  }
  pacman.turnQueue.push({ ...dir });
  if (pacman.turnQueue.length > 6) {
    pacman.turnQueue.shift();
  }
}

function applyQueuedTurn() {
  if (pacman.turnQueue.length === 0) {
    return;
  }
  for (let i = 0; i < pacman.turnQueue.length; i += 1) {
    const candidate = pacman.turnQueue[i];
    if (!canTravelFromTile(pacman, candidate)) {
      continue;
    }

    pacman.nextDir = { ...candidate };
    // Drop stale queued intents up to and including the one we can execute now.
    pacman.turnQueue.splice(0, i + 1);
    return;
  }
}

function tryApplyImmediateReverseTurn() {
  if (pacman.turnQueue.length === 0) {
    return false;
  }

  if (pacman.dir.x === 0 && pacman.dir.y === 0) {
    return false;
  }

  for (let i = 0; i < pacman.turnQueue.length; i += 1) {
    const candidate = pacman.turnQueue[i];
    if (!opposite(candidate, pacman.dir)) {
      continue;
    }

    if (!canTravelFromTile(pacman, candidate)) {
      continue;
    }

    pacman.nextDir = { ...candidate };
    pacman.dir = { ...candidate };
    pacman.turnQueue.splice(0, i + 1);
    return true;
  }

  return false;
}

function updatePacmanDirection() {
  if (updatePacmanGhostHomeExitLock()) {
    return;
  }

  if (isPacmanGiant()) {
    applyQueuedTurn();
    if (pacman.nextDir.x !== 0 || pacman.nextDir.y !== 0) {
      pacman.dir = { ...pacman.nextDir };
    }
    return;
  }

  if (opposite(pacman.nextDir, pacman.dir) && canTravelFromTile(pacman, pacman.nextDir)) {
    pacman.dir = { ...pacman.nextDir };
    return;
  }

  if (tryApplyImmediateReverseTurn()) {
    return;
  }

  const nearCenter = isNearTileCenter(pacman);
  if (RULES && !RULES.shouldEvaluatePacmanDirection(nearCenter, pacman.dir)) {
    return;
  }
  if (!RULES && !nearCenter && !(pacman.dir.x === 0 && pacman.dir.y === 0)) {
    return;
  }

  if (nearCenter) {
    snapToTileCenter(pacman);
  }
  applyQueuedTurn();

  if (canTravelFromTile(pacman, pacman.nextDir)) {
    pacman.dir = { ...pacman.nextDir };
  }

  if (!canTravelFromTile(pacman, pacman.dir)) {
    pacman.dir = { x: 0, y: 0 };
  }
}

function stepEntity(entity) {
  if (!canMove(entity, entity.dir)) {
    entity.dir = { x: 0, y: 0 };
    return;
  }

  entity.x += entity.dir.x * entity.speed;
  entity.y += entity.dir.y * entity.speed;

  if (entity.x < -entity.radius) {
    entity.x = canvas.width + entity.radius;
  } else if (entity.x > canvas.width + entity.radius) {
    entity.x = -entity.radius;
  }

  if (entity === pacman && isPacmanGiant()) {
    if (entity.y < -entity.radius) {
      entity.y = canvas.height + entity.radius;
    } else if (entity.y > canvas.height + entity.radius) {
      entity.y = -entity.radius;
    }
  }
}

function eatPellet() {
  if (isPacmanGiant()) {
    return;
  }

  const tx = toTile(pacman.x);
  const ty = toTile(pacman.y);
  const cell = map[ty]?.[tx];
  if (cell === ".") {
    map[ty][tx] = " ";
    score += 10;
    pelletsRemaining -= 1;
  } else if (cell === "o") {
    map[ty][tx] = " ";
    score += 50;
    pelletsRemaining -= 1;
    const now = performance.now();
    frightenedUntil = Math.max(frightenedUntil, now) + 8000;
    frightenedCombo = 0;
    for (const ghost of ghosts) {
      ghost.frightened = !ghost.isReturning;
    }
    reverseGhosts();
  }
}

function resetPositions() {
  pacman.x = 10 * TILE_SIZE + TILE_SIZE / 2;
  pacman.y = 16 * TILE_SIZE + TILE_SIZE / 2;
  pacman.radius = PACMAN_BASE_RADIUS;
  pacman.dir = { x: 0, y: 0 };
  pacman.nextDir = { x: 0, y: 0 };
  pacman.turnQueue = [];
  pacman.mouth = 0;
  pacmanGhostHomeExitLock = null;

  giantUntil = 0;
  giantGhostCombo = 0;

  ghosts = ghostSpawn.map((g) => ({
    x: g.x * TILE_SIZE + TILE_SIZE / 2,
    y: g.y * TILE_SIZE + TILE_SIZE / 2,
    radius: TILE_SIZE * 0.35,
    speed: 1.8 + (level - 1) * 0.08,
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

function nextTilesFrom(tile, entity) {
  const result = [];
  for (const d of CARDINAL_DIRS) {
    const nx = tile.x + d.x;
    const ny = tile.y + d.y;
    if (!tileBlockedForEntity(entity, nx, ny, d)) {
      result.push({ x: wrapTileX(nx), y: ny, dir: d });
    }
  }
  return result;
}

function shortestPathDistance(entity, startTile, targetTile) {
  const startKey = `${startTile.x},${startTile.y}`;
  const targetKey = `${targetTile.x},${targetTile.y}`;
  if (startKey === targetKey) {
    return 0;
  }

  const queue = [{ tile: startTile, dist: 0 }];
  const visited = new Set([startKey]);

  while (queue.length > 0) {
    const current = queue.shift();
    for (const next of nextTilesFrom(current.tile, entity)) {
      const key = `${next.x},${next.y}`;
      if (visited.has(key)) {
        continue;
      }
      const nd = current.dist + 1;
      if (key === targetKey) {
        return nd;
      }
      visited.add(key);
      queue.push({ tile: { x: next.x, y: next.y }, dist: nd });
    }
  }

  return Number.POSITIVE_INFINITY;
}

function resetGhostAfterReturn(ghost) {
  ghost.x = (ghost.home.x + 0.5) * TILE_SIZE;
  ghost.y = (ghost.home.y + 0.5) * TILE_SIZE;
  ghost.isReturning = false;
  ghost.forceReverse = false;
  ghost.frightened = false;
  ghost.hasLeftHome = false;
  ghost.returnStepTarget = null;
  ghost.dir = { x: 0, y: 0 };
  ghost.nextDir = { x: 0, y: 0 };
}

function chooseShortestReturnStep(ghost) {
  const start = { x: toTile(ghost.x), y: toTile(ghost.y) };
  const target = { x: ghost.home.x, y: ghost.home.y };
  const startKey = `${start.x},${start.y}`;
  const targetKey = `${target.x},${target.y}`;
  if (startKey === targetKey) {
    return { dir: { x: 0, y: 0 }, nextTile: start };
  }

  const queue = [start];
  const visited = new Set([startKey]);
  const parent = new Map();
  const directionOrder = [UP, LEFT, DOWN, RIGHT];

  while (queue.length > 0) {
    const tile = queue.shift();
    const tileKey = `${tile.x},${tile.y}`;

    for (const d of directionOrder) {
      const nxUnwrapped = tile.x + d.x;
      const ny = tile.y + d.y;
      const nx = wrapTileX(nxUnwrapped);
      if (tileBlockedForEntity(ghost, nxUnwrapped, ny, d)) {
        continue;
      }

      const nextKey = `${nx},${ny}`;
      if (visited.has(nextKey)) {
        continue;
      }

      visited.add(nextKey);
      parent.set(nextKey, { prevKey: tileKey, dir: { ...d } });

      if (nextKey === targetKey) {
        queue.length = 0;
        break;
      }

      queue.push({ x: nx, y: ny });
    }
  }

  if (!parent.has(targetKey)) {
    const fallbackDir = chooseShortestReturnDirFallback(ghost);
    return {
      dir: fallbackDir,
      nextTile: { x: wrapTileX(start.x + fallbackDir.x), y: start.y + fallbackDir.y }
    };
  }

  let walkKey = targetKey;
  let stepKey = targetKey;
  while (true) {
    const info = parent.get(walkKey);
    if (!info) {
      break;
    }
    if (info.prevKey === startKey) {
      stepKey = walkKey;
      const [sx, sy] = stepKey.split(",").map(Number);
      return { dir: info.dir, nextTile: { x: sx, y: sy } };
    }
    walkKey = info.prevKey;
  }

  return { dir: { x: 0, y: 0 }, nextTile: start };
}

function chooseShortestReturnDirFallback(ghost) {
  const valid = CARDINAL_DIRS.filter((d) => canTravelFromTile(ghost, d));
  if (valid.length === 0) {
    return { x: 0, y: 0 };
  }

  let best = valid[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const d of valid) {
    const nx = wrapTileX(toTile(ghost.x) + d.x);
    const ny = toTile(ghost.y) + d.y;
    const dist = shortestPathDistance(
      ghost,
      { x: nx, y: ny },
      { x: ghost.home.x, y: ghost.home.y }
    );
    if (dist < bestScore) {
      bestScore = dist;
      best = d;
    }
  }
  return best;
}

function updateReturningGhost(ghost) {
  ghost.speed = 2.6 + (level - 1) * 0.06;

  const homeX = (ghost.home.x + 0.5) * TILE_SIZE;
  const homeY = (ghost.home.y + 0.5) * TILE_SIZE;
  const dxHome = ghost.x - homeX;
  const dyHome = ghost.y - homeY;
  if (dxHome * dxHome + dyHome * dyHome <= (ghost.speed + 0.5) * (ghost.speed + 0.5)) {
    resetGhostAfterReturn(ghost);
    return;
  }

  alignToGrid(ghost);
  if (isNearTileCenter(ghost) || !ghost.returnStepTarget) {
    snapToTileCenter(ghost);
    const step = chooseShortestReturnStep(ghost);
    ghost.dir = { ...step.dir };
    ghost.nextDir = { ...step.dir };
    ghost.returnStepTarget = step.nextTile;
  }

  if (!ghost.returnStepTarget || (ghost.dir.x === 0 && ghost.dir.y === 0)) {
    return;
  }

  const target = tileCenterToPixels(ghost.returnStepTarget);
  if (ghost.dir.x !== 0) {
    const dx = target.x - ghost.x;
    const stepX = Math.sign(dx) * Math.min(Math.abs(dx), ghost.speed);
    ghost.x += stepX;
    if (Math.abs(target.x - ghost.x) <= 0.001) {
      ghost.x = target.x;
      ghost.returnStepTarget = null;
    }
  } else if (ghost.dir.y !== 0) {
    const dy = target.y - ghost.y;
    const stepY = Math.sign(dy) * Math.min(Math.abs(dy), ghost.speed);
    ghost.y += stepY;
    if (Math.abs(target.y - ghost.y) <= 0.001) {
      ghost.y = target.y;
      ghost.returnStepTarget = null;
    }
  }

  if (ghost.x < -ghost.radius) {
    ghost.x = canvas.width + ghost.radius;
  } else if (ghost.x > canvas.width + ghost.radius) {
    ghost.x = -ghost.radius;
  }
}

function assistReturningGhostAtGate(ghost) {
  if (!ghost.isReturning) {
    return false;
  }

  const gateTileX = GHOST_GATE_TILE.x;
  const gateTileY = GHOST_GATE_TILE.y;
  const tx = toTile(ghost.x);
  const ty = toTile(ghost.y);
  const manhattanToGate = Math.abs(tx - gateTileX) + Math.abs(ty - gateTileY);
  if (manhattanToGate > 1 && !(tx === gateTileX && ty === gateTileY)) {
    return false;
  }

  const gateCenter = tileCenterToPixels(GHOST_GATE_TILE);
  const homeCenter = tileCenterToPixels(ghost.home);
  const speed = 2.6 + (level - 1) * 0.06;

  // First align to gate column, then move vertically through threshold toward home.
  if (Math.abs(ghost.x - gateCenter.x) > 0.2) {
    const dx = gateCenter.x - ghost.x;
    const sx = Math.sign(dx) * Math.min(Math.abs(dx), speed);
    ghost.x += sx;
    ghost.dir = { x: Math.sign(sx), y: 0 };
  } else {
    ghost.x = gateCenter.x;
    const dy = homeCenter.y - ghost.y;
    const sy = Math.sign(dy) * Math.min(Math.abs(dy), speed);
    ghost.y += sy;
    ghost.dir = { x: 0, y: Math.sign(sy) };
  }

  ghost.nextDir = { ...ghost.dir };

  const tileNow = tileCenterFromCoords(ghost.x, ghost.y);
  if (isInsideGhostHome(tileNow)) {
    resetGhostAfterReturn(ghost);
  }
  return true;
}

function setOverlay(title, text, buttonText) {
  overlayTitle.textContent = title;
  const isGameOverTitle = String(title).trim().toLowerCase() === "game over";
  document.body.classList.toggle("game-over-overlay", isGameOverTitle);
  overlayTitle.classList.toggle("overlay-title-arcade", isGameOverTitle);
  overlayText.textContent = text;
  actionButton.textContent = buttonText;
  if (scoreSubmitForm) {
    scoreSubmitForm.classList.toggle("hidden", !isGameOverTitle);
  }
  if (overlayLeaderboardPanel) {
    overlayLeaderboardPanel.classList.toggle("hidden", !isGameOverTitle || !isStackedLayout());
  }
  overlay.classList.remove("hidden");

  // Keep game-over text on one line and sized to ~80% of overlay width.
  if (isGameOverTitle) {
    requestAnimationFrame(fitGameOverOverlayTitle);
    updateSubmitButtonState();
  } else {
    overlayTitle.style.removeProperty("font-size");
  }
}

function beginPlayIfIdle() {
  if (!gameRunning && !gameOver) {
    gameRunning = true;
    hideOverlay();
  }
}

function setupMobileGestureLock() {
  if (mobileGestureLockBound || !isMobileJoystickEnabled()) {
    return;
  }

  // Prevent pull-to-refresh and page panning on touch devices while playing.
  document.addEventListener("touchmove", (event) => {
    event.preventDefault();
  }, { passive: false });

  mobileGestureLockBound = true;
}

function isMobileJoystickEnabled() {
  if (forceMobileControls) {
    return true;
  }
  return window.matchMedia("(any-pointer: coarse)").matches;
}

function setJoystickKnobOffset(dx, dy) {
  if (!joystickKnob) {
    return;
  }
  joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

function resetJoystick() {
  joystickPointerId = null;
  setJoystickKnobOffset(0, 0);
}

function joystickDirection(dx, dy, maxRadius) {
  if (!Number.isFinite(maxRadius) || maxRadius <= 0) {
    return null;
  }

  const nx = dx / maxRadius;
  const ny = dy / maxRadius;
  const magnitude = Math.hypot(nx, ny);
  if (magnitude < JOYSTICK_DEADZONE) {
    return null;
  }

  if (Math.abs(nx) >= Math.abs(ny)) {
    return nx >= 0 ? RIGHT : LEFT;
  }
  return ny >= 0 ? DOWN : UP;
}

function handleJoystickInput(clientX, clientY) {
  if (!joystick) {
    return;
  }

  const rect = joystick.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const maxRadius = rect.width * JOYSTICK_RADIUS_RATIO;

  let dx = clientX - centerX;
  let dy = clientY - centerY;
  const distance = Math.hypot(dx, dy);
  if (distance > maxRadius && distance > 0) {
    const scale = maxRadius / distance;
    dx *= scale;
    dy *= scale;
  }

  setJoystickKnobOffset(dx, dy);
  const dir = joystickDirection(dx, dy, maxRadius);
  if (!dir) {
    return;
  }

  queuePacmanTurn(dir);
  applyQueuedTurn();
  beginPlayIfIdle();
}

function fitGameOverOverlayTitle() {
  if (!overlay || !overlayTitle || !overlayTitle.classList.contains("overlay-title-arcade")) {
    return;
  }

  const targetWidth = overlay.clientWidth * 0.8;
  if (!Number.isFinite(targetWidth) || targetWidth <= 0) {
    return;
  }

  const maxFontPx = 220;
  const minFontPx = 20;

  if (document.fonts && !document.fonts.check('20px "PacfontGood"', overlayTitle.textContent || "game over")) {
    document.fonts
      .load('20px "PacfontGood"', overlayTitle.textContent || "game over")
      .then(() => requestAnimationFrame(fitGameOverOverlayTitle))
      .catch(() => {
        // Keep current sizing if the Font Loading API fails.
      });
  }

  overlayTitle.style.fontSize = `${maxFontPx}px`;

  const measuredWidth = overlayTitle.getBoundingClientRect().width;
  if (!Number.isFinite(measuredWidth) || measuredWidth <= 0) {
    return;
  }

  const fittedPx = Math.floor(maxFontPx * (targetWidth / measuredWidth));
  const clampedPx = Math.max(minFontPx, Math.min(maxFontPx, fittedPx));
  overlayTitle.style.fontSize = `${clampedPx}px`;

  const finalWidth = overlayTitle.getBoundingClientRect().width;
  if (!Number.isFinite(finalWidth) || finalWidth <= 0) {
    return;
  }

  const correctedPx = Math.floor(clampedPx * (targetWidth / finalWidth));
  const finalPx = Math.max(minFontPx, Math.min(maxFontPx, correctedPx));
  overlayTitle.style.fontSize = `${finalPx}px`;
}

function hideOverlay() {
  overlay.classList.add("hidden");
  document.body.classList.remove("game-over-overlay");
  if (scoreSubmitForm) {
    scoreSubmitForm.classList.add("hidden");
  }
  if (overlayLeaderboardPanel) {
    overlayLeaderboardPanel.classList.add("hidden");
  }
  updateSubmitButtonState();
}

function updateHud() {
  scoreEl.textContent = String(score);
  livesEl.textContent = RULES ? RULES.formatLivesUp(lives) : `${Math.max(0, lives)}UP`;
  levelEl.textContent = String(level);
  updateSubmitButtonState();
}

function opposite(dirA, dirB) {
  return dirA.x === -dirB.x && dirA.y === -dirB.y;
}

function reverseGhosts() {
  for (const ghost of ghosts) {
    // Defer reversal to the next tile center so ghosts do not clip into walls.
    ghost.forceReverse = true;
  }
}

function resetModeCycle(now) {
  currentGlobalMode = MODE_PHASES[0].mode;
  modePhaseIndex = 0;
  modePhaseStartedAt = now;
}

function updateGlobalMode(now) {
  if (now < frightenedUntil) {
    return;
  }

  while (modePhaseIndex < MODE_PHASES.length - 1) {
    const phase = MODE_PHASES[modePhaseIndex];
    if (now - modePhaseStartedAt < phase.durationMs) {
      break;
    }
    modePhaseStartedAt += phase.durationMs;
    modePhaseIndex += 1;
    const nextMode = MODE_PHASES[modePhaseIndex].mode;
    if (nextMode !== currentGlobalMode) {
      currentGlobalMode = nextMode;
      reverseGhosts();
    }
  }
}

function frightenedActive(now) {
  return now < frightenedUntil;
}

function ghostIsFrightened(ghost, now) {
  return frightenedActive(now) && ghost.frightened && !ghost.isReturning;
}

function getGhostTarget(ghost) {
  if (ghost.isReturning) {
    return ghost.home;
  }

  const ghostTile = tileCenterFromCoords(ghost.x, ghost.y);
  if (!ghost.hasLeftHome) {
    if (ghostTile.y <= GHOST_EXIT_TILE.y) {
      ghost.hasLeftHome = true;
    } else if (isInsideGhostHome(ghostTile)) {
      if (ghostTile.x !== GHOST_GATE_TILE.x || ghostTile.y > GHOST_GATE_TILE.y) {
        return GHOST_GATE_TILE;
      }
      return GHOST_EXIT_TILE;
    } else {
      ghost.hasLeftHome = true;
    }
  }

  if (currentGlobalMode === "scatter") {
    return ghost.scatterTarget;
  }

  const pacTile = tileCenterFromCoords(pacman.x, pacman.y);
  const heading = pacmanHeading();

  if (ghost.kind === "blinky") {
    return pacTile;
  }

  if (ghost.kind === "pinky") {
    return {
      x: pacTile.x + heading.x * 4,
      y: pacTile.y + heading.y * 4
    };
  }

  if (ghost.kind === "inky") {
    const blinky = ghosts.find((g) => g.kind === "blinky") || ghost;
    const blinkyTile = tileCenterFromCoords(blinky.x, blinky.y);
    const pivot = {
      x: pacTile.x + heading.x * 2,
      y: pacTile.y + heading.y * 2
    };
    return {
      x: pivot.x + (pivot.x - blinkyTile.x),
      y: pivot.y + (pivot.y - blinkyTile.y)
    };
  }

  // Clyde chases when far away, otherwise retreats to scatter corner.
  const ghostTileClyde = tileCenterFromCoords(ghost.x, ghost.y);
  const dx = pacTile.x - ghostTileClyde.x;
  const dy = pacTile.y - ghostTileClyde.y;
  const distSq = dx * dx + dy * dy;
  if (distSq > 64) {
    return pacTile;
  }
  return ghost.scatterTarget;
}

function pickGhostDirection(ghost, now) {
  const valid = CARDINAL_DIRS.filter((d) => canTravelFromTile(ghost, d));
  if (valid.length === 0) {
    ghost.nextDir = { x: 0, y: 0 };
    return;
  }

  const inHomeExitMode = !ghost.hasLeftHome && !ghost.isReturning;
  const returning = ghost.isReturning;
  let candidateSet = valid;
  if (inHomeExitMode) {
    // While leaving home, prioritize finding the gate over reversal rules.
    candidateSet = valid;
  } else if (returning) {
    // Returning eyes should avoid immediate backtracking to prevent yoyo loops.
    const nonReverse = valid.filter((d) => !opposite(d, ghost.dir));
    candidateSet = nonReverse.length > 0 ? nonReverse : valid;
  } else if (ghost.forceReverse && (ghost.dir.x !== 0 || ghost.dir.y !== 0)) {
    const reversedOnly = valid.filter((d) => opposite(d, ghost.dir));
    candidateSet = reversedOnly.length > 0 ? reversedOnly : valid;
  } else {
    const nonReverse = valid.filter((d) => !opposite(d, ghost.dir));
    candidateSet = nonReverse.length > 0 ? nonReverse : valid;
  }
  if (candidateSet.length === 0) {
    candidateSet = valid;
  }
  ghost.forceReverse = false;

  if (ghostIsFrightened(ghost, now)) {
    ghost.nextDir = candidateSet[Math.floor(Math.random() * candidateSet.length)];
    return;
  }

  const target = getGhostTarget(ghost);

  let bestDir = candidateSet[0];
  let bestDist = Infinity;
  for (const d of candidateSet) {
    const tx = toTile(ghost.x) + d.x;
    const ty = toTile(ghost.y) + d.y;
    const wx = wrapTileX(tx);
    let score;

    if (returning) {
      score = shortestPathDistance(
        ghost,
        { x: wx, y: ty },
        { x: ghost.home.x, y: ghost.home.y }
      );
    } else {
      const dx = target.x - wx;
      const dy = target.y - ty;
      score = dx * dx + dy * dy;
    }

    if (!inHomeExitMode && !returning) {
      // Prefer routes that avoid bunching with nearby ghosts.
      for (const other of ghosts) {
        if (other === ghost) {
          continue;
        }
        const ox = toTile(other.x);
        const oy = toTile(other.y);
        const ddx = wx - ox;
        const ddy = ty - oy;
        const crowdDistSq = ddx * ddx + ddy * ddy;
        if (crowdDistSq === 0) {
          score += 999;
        } else {
          score += 10 / crowdDistSq;
        }
      }
    }

    if (score < bestDist) {
      bestDist = score;
      bestDir = d;
    }
  }
  ghost.nextDir = bestDir;
}

function updateGhosts() {
  const now = performance.now();

  if (!frightenedActive(now)) {
    frightenedCombo = 0;
    for (const ghost of ghosts) {
      ghost.frightened = false;
    }
  }

  for (const ghost of ghosts) {
    if (ghost.isReturning) {
      updateReturningGhost(ghost);
      continue;
    }

    if (!ghost.hasLeftHome && !ghost.isReturning) {
      ghost.speed = 2.2;
      const gateCenterX = (GHOST_GATE_TILE.x + 0.5) * TILE_SIZE;
      const exitCenterY = (GHOST_EXIT_TILE.y + 0.5) * TILE_SIZE;

      // Phase 1: slide to the gate column without overshooting wall boundaries.
      if (Math.abs(ghost.x - gateCenterX) > 0.2) {
        const dx = gateCenterX - ghost.x;
        const stepX = Math.sign(dx) * Math.min(Math.abs(dx), ghost.speed);
        ghost.x += stepX;
        ghost.dir = { x: Math.sign(stepX), y: 0 };
      } else {
        // Phase 2: move upward through the gate once aligned.
        ghost.x = gateCenterX;
        const dy = exitCenterY - ghost.y;
        const stepY = Math.sign(dy) * Math.min(Math.abs(dy), ghost.speed);
        ghost.y += stepY;
        ghost.dir = { x: 0, y: Math.sign(stepY) };
      }

      ghost.nextDir = { ...ghost.dir };

      if (ghost.y <= exitCenterY + 0.05) {
        ghost.y = exitCenterY;
        ghost.hasLeftHome = true;
        ghost.dir = { ...UP };
        ghost.nextDir = { ...UP };
      }
      continue;
    }

    alignToGrid(ghost);
    const needsRecovery = ghost.dir.x === 0 && ghost.dir.y === 0;
    if (isNearTileCenter(ghost) || needsRecovery) {
      snapToTileCenter(ghost);
      pickGhostDirection(ghost, now);
      if (canTravelFromTile(ghost, ghost.nextDir)) {
        ghost.dir = { ...ghost.nextDir };
      }
      if (!canTravelFromTile(ghost, ghost.dir)) {
        const fallback = CARDINAL_DIRS.find((d) => canTravelFromTile(ghost, d));
        ghost.dir = fallback ? { ...fallback } : { x: 0, y: 0 };
      }
    }

    if (ghost.dir.x === 0 && ghost.dir.y === 0) {
      const fallback = CARDINAL_DIRS.find((d) => canTravelFromTile(ghost, d));
      if (fallback) {
        ghost.dir = { ...fallback };
      }
    }

    if (ghost.isReturning) {
      ghost.speed = 2.6 + (level - 1) * 0.06;
    } else if (!ghost.hasLeftHome) {
      ghost.speed = 2.2;
    } else {
      ghost.speed = ghostIsFrightened(ghost, now) ? 1.2 + (level - 1) * 0.03 : 1.8 + (level - 1) * 0.08;
    }
    stepEntity(ghost);

    if (ghost.isReturning) {
      const homeX = (ghost.home.x + 0.5) * TILE_SIZE;
      const homeY = (ghost.home.y + 0.5) * TILE_SIZE;
      const dx = ghost.x - homeX;
      const dy = ghost.y - homeY;
      const reachedHome = dx * dx + dy * dy <= (ghost.speed + 0.5) * (ghost.speed + 0.5);
      if (reachedHome) {
        resetGhostAfterReturn(ghost);
      }
    }
  }
}

function circleHit(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const sum = a.radius + b.radius - 2;
  return dx * dx + dy * dy <= sum * sum;
}

function onPlayerCaught() {
  if (pacmanDeath.active) {
    return;
  }

  pacmanDeath.active = true;
  pacmanDeath.startedAt = performance.now();
  pacmanDeath.facing = Math.PI / 2;
}

function finishPlayerCaught() {
  lives -= 1;
  updateHud();
  if (lives <= 0) {
    pacmanHiddenUntil = Number.POSITIVE_INFINITY;
    gameOver = true;
    gameRunning = false;
    setOverlay("game over", "The maze wins this round.", "Play Again");
    return;
  }
  pauseUntil = performance.now() + 1200;
  pacmanHiddenUntil = 0;
  resetPositions();
}

function updatePacmanDeath(now) {
  if (!pacmanDeath.active) {
    return;
  }

  const elapsed = now - pacmanDeath.startedAt;
  if (elapsed < PACMAN_DEATH_DURATION_MS) {
    return;
  }

  pacmanDeath.active = false;
  pacmanDeath.startedAt = 0;
  finishPlayerCaught();
}

function onLevelComplete() {
  level += 1;
  pacman.speed += 0.18;
  resetMap();
  resetPositions();
  resetModeCycle(performance.now());
  updateHud();
  pauseUntil = performance.now() + 1200;
}

function consumeGhost(ghost, now, points) {
  score += points;
  scorePopups.push({
    x: ghost.x,
    y: ghost.y,
    text: String(points),
    expiresAt: now + 900
  });
  ghost.forceReverse = false;
  ghost.isReturning = true;
  ghost.frightened = false;
  ghost.hasLeftHome = true;
  ghost.returnStepTarget = null;
  updateHud();
}

function updateCollisions() {
  const now = performance.now();
  const giantActive = isPacmanGiant(now);
  for (const ghost of ghosts) {
    if (ghost.isReturning) {
      continue;
    }

    if (!circleHit(pacman, ghost)) {
      continue;
    }

    if (giantActive) {
      giantGhostCombo += 1;
      const ghostScore = 300 * 2 ** Math.min(giantGhostCombo - 1, 3);
      consumeGhost(ghost, now, ghostScore);
    } else if (ghostIsFrightened(ghost, now)) {
      frightenedCombo += 1;
      const ghostScore = 200 * 2 ** Math.min(frightenedCombo - 1, 3);
      consumeGhost(ghost, now, ghostScore);
    } else {
      onPlayerCaught();
    }
    break;
  }
}

function drawScorePopups(now) {
  scorePopups = scorePopups.filter((p) => p.expiresAt > now);
  ctx.font = "bold 16px 'Chakra Petch', sans-serif";
  ctx.textAlign = "center";
  for (const popup of scorePopups) {
    const life = Math.max(0, (popup.expiresAt - now) / 900);
    const rise = (1 - life) * 16;
    ctx.globalAlpha = Math.max(0.2, life);
    ctx.fillStyle = "#ffe27a";
    ctx.fillText(popup.text, popup.x, popup.y - rise);
  }
  ctx.globalAlpha = 1;
}

function drawAppleStemAndLeaf(center, options) {
  const {
    stemColor,
    leafColor,
    lineWidth,
    stemStart,
    stemControl,
    stemEnd,
    leafCenter,
    leafRadius,
    leafRotation
  } = options;

  ctx.strokeStyle = stemColor;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(center.x + stemStart.x, center.y + stemStart.y);
  ctx.quadraticCurveTo(
    center.x + stemControl.x,
    center.y + stemControl.y,
    center.x + stemEnd.x,
    center.y + stemEnd.y
  );
  ctx.stroke();

  ctx.fillStyle = leafColor;
  ctx.beginPath();
  ctx.ellipse(
    center.x + leafCenter.x,
    center.y + leafCenter.y,
    leafRadius.x,
    leafRadius.y,
    leafRotation,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function drawFruit() {
  if (!fruit.active) {
    return;
  }

  const center = tileCenterToPixels(FRUIT_TILE);
  const pulse = 1 + Math.sin(performance.now() * 0.01) * 0.08;

  if (fruit.kind === "cherry") {
    ctx.fillStyle = "#d92d43";
    ctx.beginPath();
    ctx.arc(center.x - 4, center.y + 2, 5 * pulse, 0, Math.PI * 2);
    ctx.arc(center.x + 4, center.y + 2, 5 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ffe59a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(center.x - 4, center.y - 2);
    ctx.quadraticCurveTo(center.x - 1, center.y - 10, center.x + 2, center.y - 8);
    ctx.moveTo(center.x + 4, center.y - 2);
    ctx.quadraticCurveTo(center.x + 6, center.y - 10, center.x + 2, center.y - 8);
    ctx.stroke();

    ctx.fillStyle = "#5dcf72";
    ctx.beginPath();
    ctx.ellipse(center.x + 6, center.y - 10, 4, 2.4, -0.35, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (fruit.kind === "strawberry") {
    ctx.fillStyle = "#e83b56";
    ctx.beginPath();
    ctx.ellipse(center.x, center.y + 1, 8 * pulse, 9.5 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd86b";
    for (let i = 0; i < 9; i += 1) {
      const a = (i / 9) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(center.x + Math.cos(a) * 4, center.y + 2 + Math.sin(a) * 4, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#5dcf72";
    ctx.beginPath();
    ctx.moveTo(center.x - 5, center.y - 7);
    ctx.lineTo(center.x, center.y - 12);
    ctx.lineTo(center.x + 5, center.y - 7);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (fruit.kind === "orange") {
    ctx.fillStyle = "#ff9a28";
    ctx.beginPath();
    ctx.arc(center.x, center.y + 1, 8 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffc56a";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(center.x, center.y + 1, 5.6 * pulse, -0.6, 0.9);
    ctx.stroke();
    return;
  }

  if (fruit.kind === "apple") {
    ctx.fillStyle = APPLE_RENDER_STYLE.regular.body;
    ctx.beginPath();
    ctx.arc(center.x, center.y + 2, 8.2 * pulse, 0, Math.PI * 2);
    ctx.fill();
    drawAppleStemAndLeaf(center, {
      stemColor: APPLE_RENDER_STYLE.regular.stem,
      leafColor: APPLE_RENDER_STYLE.regular.leaf,
      lineWidth: 2,
      stemStart: { x: 0, y: -7 },
      stemControl: { x: 1, y: -11 },
      stemEnd: { x: 3, y: -10 },
      leafCenter: { x: 5, y: -8 },
      leafRadius: { x: 3.8, y: 2.4 },
      leafRotation: -0.4
    });
    return;
  }

  if (fruit.kind === "melon") {
    ctx.fillStyle = "#4cc66a";
    ctx.beginPath();
    ctx.arc(center.x, center.y + 1, 8.3 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2f8f47";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(center.x, center.y + 1, 5.4 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  if (fruit.kind === "galaxian") {
    ctx.fillStyle = "#6de6ff";
    ctx.beginPath();
    ctx.moveTo(center.x, center.y - 9);
    ctx.lineTo(center.x + 9, center.y + 4);
    ctx.lineTo(center.x + 2, center.y + 9);
    ctx.lineTo(center.x - 2, center.y + 9);
    ctx.lineTo(center.x - 9, center.y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff5f8a";
    ctx.beginPath();
    ctx.arc(center.x, center.y + 2, 2.2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (fruit.kind === "bell") {
    ctx.fillStyle = "#ffd74f";
    ctx.beginPath();
    ctx.moveTo(center.x - 7, center.y + 5);
    ctx.quadraticCurveTo(center.x - 7, center.y - 7, center.x, center.y - 8);
    ctx.quadraticCurveTo(center.x + 7, center.y - 7, center.x + 7, center.y + 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#6da8ff";
    ctx.beginPath();
    ctx.arc(center.x, center.y + 6, 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // Key (default/fallback for highest levels)
  ctx.strokeStyle = "#ffe27a";
  ctx.fillStyle = "#ffe27a";
  ctx.lineWidth = 2.3;
  ctx.beginPath();
  ctx.arc(center.x - 3, center.y - 1, 4.2 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(center.x + 1, center.y - 1);
  ctx.lineTo(center.x + 10, center.y - 1);
  ctx.lineTo(center.x + 10, center.y + 2);
  ctx.lineTo(center.x + 7, center.y + 2);
  ctx.lineTo(center.x + 7, center.y + 5);
  ctx.lineTo(center.x + 5, center.y + 5);
  ctx.lineTo(center.x + 5, center.y + 2);
  ctx.lineTo(center.x + 1, center.y + 2);
  ctx.closePath();
  ctx.fill();

  // Cherry-style fruit with stem and leaf.
  ctx.fillStyle = "#d92d43";
  ctx.beginPath();
  ctx.arc(center.x - 4, center.y + 2, 5 * pulse, 0, Math.PI * 2);
  ctx.arc(center.x + 4, center.y + 2, 5 * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#ffe59a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(center.x - 4, center.y - 2);
  ctx.quadraticCurveTo(center.x - 1, center.y - 10, center.x + 2, center.y - 8);
  ctx.moveTo(center.x + 4, center.y - 2);
  ctx.quadraticCurveTo(center.x + 6, center.y - 10, center.x + 2, center.y - 8);
  ctx.stroke();

  ctx.fillStyle = "#5dcf72";
  ctx.beginPath();
  ctx.ellipse(center.x + 6, center.y - 10, 4, 2.4, -0.35, 0, Math.PI * 2);
  ctx.fill();
}

function drawPowerApple() {
  if (!powerApple.active) {
    return;
  }

  const center = tileCenterToPixels({ x: powerApple.x, y: powerApple.y });
  const pulse = 0.92 + Math.sin(performance.now() / 140) * 0.08;
  const radius = 8.2 * pulse;

  ctx.fillStyle = APPLE_RENDER_STYLE.power.body;
  ctx.beginPath();
  ctx.arc(center.x - 4, center.y + 1.5, radius * 0.8, 0, Math.PI * 2);
  ctx.arc(center.x + 4, center.y + 1.5, radius * 0.8, 0, Math.PI * 2);
  ctx.fill();

  drawAppleStemAndLeaf(center, {
    stemColor: APPLE_RENDER_STYLE.power.stem,
    leafColor: APPLE_RENDER_STYLE.power.leaf,
    lineWidth: 1.8,
    stemStart: { x: 0, y: -1 },
    stemControl: { x: 1, y: -11 },
    stemEnd: { x: 5, y: -10 },
    leafCenter: { x: 7, y: -10 },
    leafRadius: { x: 3.8, y: 2.2 },
    leafRotation: -0.45
  });
}

function isWallCell(x, y) {
  if (x < 0 || x >= widthTiles || y < 0 || y >= heightTiles) {
    return false;
  }
  return map[y][x] === "#";
}

function drawWalls() {
  const inset = 2.5;
  const overlap = 1.2;
  const cornerRadius = 11;

  ctx.fillStyle = "#020816";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const segmentPath = new Path2D();
  const cornerPath = new Path2D();

  for (let y = 0; y < heightTiles; y += 1) {
    for (let x = 0; x < widthTiles; x += 1) {
      if (!isWallCell(x, y)) {
        continue;
      }

      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;

      if (!isWallCell(x, y - 1)) {
        segmentPath.moveTo(px + inset - overlap, py + inset);
        segmentPath.lineTo(px + TILE_SIZE - inset + overlap, py + inset);
      }
      if (!isWallCell(x, y + 1)) {
        segmentPath.moveTo(px + inset - overlap, py + TILE_SIZE - inset);
        segmentPath.lineTo(px + TILE_SIZE - inset + overlap, py + TILE_SIZE - inset);
      }
      if (!isWallCell(x - 1, y)) {
        segmentPath.moveTo(px + inset, py + inset - overlap);
        segmentPath.lineTo(px + inset, py + TILE_SIZE - inset + overlap);
      }
      if (!isWallCell(x + 1, y)) {
        segmentPath.moveTo(px + TILE_SIZE - inset, py + inset - overlap);
        segmentPath.lineTo(px + TILE_SIZE - inset, py + TILE_SIZE - inset + overlap);
      }

      if (!isWallCell(x, y - 1) && !isWallCell(x - 1, y)) {
        cornerPath.moveTo(px + inset + cornerRadius, py + inset);
        cornerPath.arc(
          px + inset + cornerRadius,
          py + inset + cornerRadius,
          cornerRadius,
          -Math.PI / 2,
          Math.PI,
          true
        );
      }
      if (!isWallCell(x, y - 1) && !isWallCell(x + 1, y)) {
        cornerPath.moveTo(px + TILE_SIZE - inset - cornerRadius, py + inset);
        cornerPath.arc(
          px + TILE_SIZE - inset - cornerRadius,
          py + inset + cornerRadius,
          cornerRadius,
          -Math.PI / 2,
          0,
          false
        );
      }
      if (!isWallCell(x, y + 1) && !isWallCell(x - 1, y)) {
        cornerPath.moveTo(px + inset + cornerRadius, py + TILE_SIZE - inset);
        cornerPath.arc(
          px + inset + cornerRadius,
          py + TILE_SIZE - inset - cornerRadius,
          cornerRadius,
          Math.PI / 2,
          Math.PI,
          false
        );
      }
      if (!isWallCell(x, y + 1) && !isWallCell(x + 1, y)) {
        cornerPath.moveTo(px + TILE_SIZE - inset - cornerRadius, py + TILE_SIZE - inset);
        cornerPath.arc(
          px + TILE_SIZE - inset - cornerRadius,
          py + TILE_SIZE - inset - cornerRadius,
          cornerRadius,
          Math.PI / 2,
          0,
          true
        );
      }
    }
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "rgba(42, 165, 255, 0.35)";
  ctx.lineWidth = 8;
  ctx.shadowColor = "rgba(42, 165, 255, 0.9)";
  ctx.shadowBlur = 16;
  ctx.stroke(segmentPath);
  ctx.stroke(cornerPath);

  ctx.strokeStyle = "#34b7ff";
  ctx.lineWidth = 3.5;
  ctx.shadowColor = "rgba(122, 217, 255, 0.8)";
  ctx.shadowBlur = 6;
  ctx.stroke(segmentPath);
  ctx.stroke(cornerPath);

  const gateLeft = (GHOST_GATE_TILE.x + 0.05) * TILE_SIZE;
  const gateY = (GHOST_GATE_TILE.y + 0.5) * TILE_SIZE;
  const gateWidth = TILE_SIZE * 0.9;
  ctx.strokeStyle = "#ff66cc";
  ctx.lineWidth = 4;
  ctx.shadowColor = "rgba(255, 102, 204, 0.8)";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(gateLeft, gateY);
  ctx.lineTo(gateLeft + gateWidth, gateY);
  ctx.stroke();

  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
  ctx.shadowBlur = 0;
}

function drawPellets() {
  for (let y = 0; y < heightTiles; y += 1) {
    for (let x = 0; x < widthTiles; x += 1) {
      const cell = map[y][x];
      if (cell !== "." && cell !== "o") {
        continue;
      }
      const cx = x * TILE_SIZE + TILE_SIZE / 2;
      const cy = y * TILE_SIZE + TILE_SIZE / 2;
      ctx.fillStyle = "#f8f3d4";
      const radius = cell === "o" ? 6 : 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPacman() {
  if (performance.now() < pacmanHiddenUntil) {
    return;
  }

  if (pacmanDeath.active) {
    drawPacmanDeath(performance.now());
    return;
  }

  const moving = pacman.dir.x !== 0 || pacman.dir.y !== 0;
  const angle = moving ? Math.abs(Math.sin(pacman.mouth)) * 0.9 : 0.22;
  const heading = pacmanHeading();
  let facing = 0;
  if (heading.x === -1) {
    facing = Math.PI;
  } else if (heading.y === -1) {
    facing = -Math.PI / 2;
  } else if (heading.y === 1) {
    facing = Math.PI / 2;
  }

  ctx.fillStyle = "#ffd447";
  ctx.beginPath();
  ctx.moveTo(pacman.x, pacman.y);
  ctx.arc(
    pacman.x,
    pacman.y,
    pacman.radius,
    facing + angle,
    facing + Math.PI * 2 - angle
  );
  ctx.closePath();
  ctx.fill();
}

function drawPacmanDeath(now) {
  const elapsed = Math.max(0, now - pacmanDeath.startedAt);
  const t = Math.min(1, elapsed / PACMAN_DEATH_DURATION_MS);
  const bodyPhaseEnd = 0.8;

  if (t < bodyPhaseEnd) {
    const bodyT = t / bodyPhaseEnd;
    const mouthHalfAngle = bodyT * Math.PI;
    const sweepStart = pacmanDeath.facing + mouthHalfAngle;
    const sweepEnd = pacmanDeath.facing + Math.PI * 2 - mouthHalfAngle;

    ctx.fillStyle = "#ffd447";
    ctx.beginPath();
    ctx.moveTo(pacman.x, pacman.y);
    ctx.arc(
      pacman.x,
      pacman.y,
      pacman.radius,
      sweepStart,
      sweepEnd,
      true
    );
    ctx.closePath();
    ctx.fill();
    return;
  }

  {
    const burstT = (t - bodyPhaseEnd) / (1 - bodyPhaseEnd);
    const rayCount = 12;
    const outerRadius = pacman.radius;
    const innerRadius = outerRadius * 0.5;

    ctx.strokeStyle = `rgba(255, 228, 120, ${Math.max(0, 0.95 - burstT)})`;
    ctx.lineWidth = Math.max(1, 3 - burstT * 2);
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i < rayCount; i += 1) {
      const a = (i / rayCount) * Math.PI * 2;
      const x1 = pacman.x + Math.cos(a) * innerRadius;
      const y1 = pacman.y + Math.sin(a) * innerRadius;
      const x2 = pacman.x + Math.cos(a) * outerRadius;
      const y2 = pacman.y + Math.sin(a) * outerRadius;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    ctx.lineCap = "butt";
  }
}

function drawGhostEyes(ghost, look = null) {
  const eyeOffsetX = 6;
  const eyeOffsetY = -3;
  const pupilTravel = 1.8;
  let lookX = Math.max(-1, Math.min(1, ghost.dir.x));
  let lookY = Math.max(-1, Math.min(1, ghost.dir.y));

  if (look) {
    const len = Math.hypot(look.x, look.y);
    if (len > 0.001) {
      lookX = look.x / len;
      lookY = look.y / len;
    }
  }

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(ghost.x - eyeOffsetX, ghost.y + eyeOffsetY, 4.4, 0, Math.PI * 2);
  ctx.arc(ghost.x + eyeOffsetX, ghost.y + eyeOffsetY, 4.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#112244";
  ctx.beginPath();
  ctx.arc(
    ghost.x - eyeOffsetX + lookX * pupilTravel,
    ghost.y + eyeOffsetY + lookY * pupilTravel,
    1.8,
    0,
    Math.PI * 2
  );
  ctx.arc(
    ghost.x + eyeOffsetX + lookX * pupilTravel,
    ghost.y + eyeOffsetY + lookY * pupilTravel,
    1.8,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

function drawGhost(ghost) {
  if (ghost.isReturning) {
    drawGhostEyes(ghost);
    return;
  }

  const now = performance.now();
  const giantActive = isPacmanGiant(now);
  const frightened = ghostIsFrightened(ghost, now);
  const color = giantActive ? "#37d65f" : frightened ? "#3b68ff" : ghost.color;
  const bodyW = ghost.radius * 1.9;
  const bodyH = ghost.radius * 2;
  const frame = Math.floor(now / 130) % 2;
  const skirtA = [0, 6, 0, 6, 0];
  const skirtB = [6, 0, 6, 0, 6];
  const skirt = frame === 0 ? skirtA : skirtB;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(ghost.x, ghost.y - ghost.radius * 0.25, ghost.radius, Math.PI, 0);
  ctx.lineTo(ghost.x + bodyW / 2, ghost.y + bodyH / 2);

  const waveCount = 4;
  for (let i = waveCount; i >= 0; i -= 1) {
    const wx = ghost.x - bodyW / 2 + (i * bodyW) / waveCount;
    const wy = ghost.y + bodyH / 2 - skirt[i];
    ctx.lineTo(wx, wy);
  }

  ctx.closePath();
  ctx.fill();

  if (frightened) {
    drawGhostEyes(ghost, { x: pacman.x - ghost.x, y: pacman.y - ghost.y });
  } else {
    drawGhostEyes(ghost);
  }
}

function render() {
  const now = performance.now();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawWalls();
  drawPellets();
  drawFruit();
  drawPowerApple();
  drawPacman();
  ghosts.forEach(drawGhost);
  drawScorePopups(now);
}

function runSimulationStep(now) {
  syncPacmanGiantState(now);
  updateGlobalMode(now);
  updateFruit(now);
  updatePowerApple(now);

  alignToGrid(pacman);
  updatePacmanDirection();
  const basePacmanSpeed = pacman.speed;
  if (isPacmanGiant(now)) {
    pacman.speed = basePacmanSpeed * 2;
  }
  stepEntity(pacman);
  pacman.speed = basePacmanSpeed;
  eatPellet();
  collectFruitIfTouched(now);
  collectPowerAppleIfTouched(now);
  updateGhosts();
  updateCollisions();

  if (pacman.dir.x !== 0 || pacman.dir.y !== 0) {
    pacman.mouth += pacman.mouthDelta;
  }

  if (pelletsRemaining <= 0) {
    onLevelComplete();
  }
}

function update(now) {
  const frameNow = Number.isFinite(now) ? now : performance.now();
  if (lastFrameTimeMs === null) {
    lastFrameTimeMs = frameNow;
  }

  let frameDelta = frameNow - lastFrameTimeMs;
  lastFrameTimeMs = frameNow;

  if (!Number.isFinite(frameDelta) || frameDelta < 0) {
    frameDelta = SIMULATION_STEP_MS;
  }
  frameDelta = Math.min(frameDelta, MAX_FRAME_DELTA_MS);
  simulationLagMs += frameDelta;

  if (!gameRunning) {
    simulationLagMs = 0;
    render();
    requestAnimationFrame(update);
    return;
  }

  if (frameNow < pauseUntil) {
    simulationLagMs = 0;
    render();
    requestAnimationFrame(update);
    return;
  }

  if (pacmanDeath.active) {
    updatePacmanDeath(frameNow);
    simulationLagMs = 0;
    render();
    requestAnimationFrame(update);
    return;
  }

  let steps = 0;
  while (simulationLagMs >= SIMULATION_STEP_MS && steps < MAX_SIMULATION_STEPS_PER_FRAME) {
    const stepNow = frameNow - simulationLagMs + SIMULATION_STEP_MS;
    runSimulationStep(stepNow);
    simulationLagMs -= SIMULATION_STEP_MS;
    steps += 1;
  }

  if (steps === MAX_SIMULATION_STEPS_PER_FRAME && simulationLagMs >= SIMULATION_STEP_MS) {
    simulationLagMs = 0;
  }

  updateHud();
  render();
  requestAnimationFrame(update);
}

function newGame() {
  score = 0;
  lives = 3;
  level = 1;
  pacman.speed = 2.35;
  frightenedUntil = 0;
  frightenedCombo = 0;
  scorePopups = [];
  giantUntil = 0;
  giantGhostCombo = 0;
  nextPowerAppleSpawnAt = 0;
  pacmanHiddenUntil = 0;
  pacmanDeath.active = false;
  pacmanDeath.startedAt = 0;
  gameOver = false;
  scoreSubmittedForCurrentGame = false;
  simulationLagMs = 0;
  lastFrameTimeMs = null;
  resetMap();
  resetPositions();
  resetModeCycle(performance.now());
  updateHud();
  setLeaderboardStatus("");
  pauseUntil = performance.now() + 350;
}

document.addEventListener("keydown", (event) => {
  const dir = KEY_DIRS[event.key] || KEY_DIRS[event.code];
  if (!dir) {
    return;
  }
  event.preventDefault();
  queuePacmanTurn(dir);
  applyQueuedTurn();
  beginPlayIfIdle();
});

actionButton.addEventListener("click", () => {
  if (gameOver || !gameRunning) {
    newGame();
  }
  gameRunning = true;
  hideOverlay();
});

if (joystick) {
  joystick.addEventListener("pointerdown", (event) => {
    if (!isMobileJoystickEnabled()) {
      return;
    }
    event.preventDefault();
    joystickPointerId = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    handleJoystickInput(event.clientX, event.clientY);
  });

  joystick.addEventListener("pointermove", (event) => {
    if (event.pointerId !== joystickPointerId) {
      return;
    }
    event.preventDefault();
    handleJoystickInput(event.clientX, event.clientY);
  });

  const finishJoystickPointer = (event) => {
    if (event.pointerId !== joystickPointerId) {
      return;
    }
    event.preventDefault();
    resetJoystick();
  };

  joystick.addEventListener("pointerup", finishJoystickPointer);
  joystick.addEventListener("pointercancel", finishJoystickPointer);
  joystick.addEventListener("lostpointercapture", resetJoystick);
}

window.addEventListener("resize", scheduleBoardFit);
document.addEventListener("visibilitychange", handleLeaderboardVisibilityChange);

newGame();
initializeLeaderboardUi();
fetchLeaderboard();
startLeaderboardAutoRefresh();
setupMobileGestureLock();
fitBoardToViewport();
setOverlay("Ready?", "Use cursor keys. Numpad 8, 4, 2, 6 also work.", "Start Game");
requestAnimationFrame(update);
