import { BOARD_WIDTH, BOARD_HEIGHT, SIMULATION_STEP_MS, MAX_FRAME_DELTA_MS, MAX_SIMULATION_STEPS_PER_FRAME } from "./config.js";
import { createPacmanStatus } from "./pacman-status.js";
import { createWallPolicy } from "./wall-policy.js";
import { createMaze } from "./maze.js";
import { createPacmanGiant } from "./pacman-giant.js";
import { createPacmanMotion } from "./pacman-motion.js";
import { createGhostMode } from "./ghost-mode.js";
import { createGhostReturn } from "./ghost-return.js";
import { createGhosts } from "./ghosts.js";
import { createItems } from "./items.js";
import { createStage } from "./stage.js";
import { createLayout } from "./layout.js";
import { createLeaderboardUi } from "./leaderboard-ui.js";
import { createOverlay } from "./overlay.js";
import { createHud } from "./hud.js";
import { createCollisions } from "./collisions.js";
import { createFruitRenderer } from "./fruit-renderer.js";
import { createRenderer } from "./renderer.js";
import { createInput } from "./input.js";
import { alignToGrid } from "./grid.js";
import { createGameState } from "./state.js";

export function createGame({ env, dom, repository, rules, clock: realClock }) {
  // Inside a simulation step every module sees the step's time, not the (later) wall-clock time.
  let stepTime = null;
  const clock = { now: () => (stepTime === null ? realClock.now() : stepTime) };

  const queryParams = new URLSearchParams(env.window.location.search);
  const forceMobileControls =
    queryParams.get("mobilecontrols") === "1" || queryParams.get("mobilecontrols") === "true";
  if (forceMobileControls) {
    env.document.body.classList.add("force-mobile-controls");
  }
  dom.canvas.width = BOARD_WIDTH;
  dom.canvas.height = BOARD_HEIGHT;

  const state = createGameState();

  function onTurn(dir) {
    queuePacmanTurn(dir);
    applyQueuedTurn();
    beginPlayIfIdle();
  }

  const status = createPacmanStatus({ state, clock });
  const policy = createWallPolicy({ state, status });
  const maze = createMaze({ state, policy });
  const giant = createPacmanGiant({ state, status, maze });
  const pacmanMotion = createPacmanMotion({ state, rules, status, maze, giant });
  const mode = createGhostMode({ state });
  const ghostReturn = createGhostReturn({ state, maze });
  const ghostAi = createGhosts({ state, clock, status, maze, mode, ghostReturn });
  const items = createItems({ state, clock, rules, status, giant, mode });
  const stage = createStage({ state, clock, rules, items });
  const layout = createLayout({ rules, env, dom });
  const leaderboard = createLeaderboardUi({ state, repository, env, dom, layout });
  const overlayView = createOverlay({ env, dom, layout, leaderboard });
  const hud = createHud({ state, rules, dom, leaderboard });
  const collisions = createCollisions({ state, clock, status, mode, stage, overlayView, hud });
  const fruitRenderer = createFruitRenderer({ state, clock, dom });
  const renderer = createRenderer({ state, clock, dom, status, mode, fruitRenderer });
  const input = createInput({ forceMobileControls, onTurn, env, dom });

  const { isPacmanGiant } = status;
  const { stepEntity } = maze;
  const { syncPacmanGiantState } = giant;
  const { updatePacmanDirection, queuePacmanTurn, applyQueuedTurn } = pacmanMotion;
  const { resetModeCycle, updateGlobalMode } = mode;
  const { updateGhosts } = ghostAi;
  const { updatePowerApple, updateFruit, collectFruitIfTouched, collectPowerAppleIfTouched, eatPellet } = items;
  const { resetMap, resetPositions } = stage;
  const { fitBoardToViewport } = layout;
  const { setLeaderboardStatus, renderLeaderboard, fetchLeaderboard, initializeLeaderboardUi, startLeaderboardAutoRefresh, handleLeaderboardVisibilityChange } = leaderboard;
  const { setOverlay, hideOverlay, fitGameOverOverlayTitle } = overlayView;
  const { updateHud } = hud;
  const { updatePacmanDeath, updateCollisions } = collisions;
  const { render } = renderer;
  const { setupMobileGestureLock } = input;

  const { requestAnimationFrame, cancelAnimationFrame } = env;
  const { pacman, pacmanDeath } = state;

  let resizeRaf = 0;

  let simulationLagMs = 0;

  let lastFrameTimeMs = null;

  function beginPlayIfIdle() {
    if (!state.gameRunning && !state.gameOver) {
      state.gameRunning = true;
      hideOverlay();
    }
  }

  function onLevelComplete() {
    state.level += 1;
    pacman.speed += 0.18;
    resetMap();
    resetPositions();
    resetModeCycle(clock.now());
    updateHud();
    state.pauseUntil = clock.now() + 1200;
  }

  function runSimulationStep(now) {
    stepTime = now;
    try {
      advanceSimulation(now);
    } finally {
      stepTime = null;
    }
  }

  function advanceSimulation(now) {
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

    if (state.pelletsRemaining <= 0) {
      onLevelComplete();
    }
  }

  function update(now) {
    const frameNow = Number.isFinite(now) ? now : clock.now();
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

    if (!state.gameRunning) {
      simulationLagMs = 0;
      render();
      requestAnimationFrame(update);
      return;
    }

    if (frameNow < state.pauseUntil) {
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
    state.score = 0;
    state.lives = 3;
    state.level = 1;
    pacman.speed = 2.35;
    state.frightenedUntil = 0;
    state.frightenedCombo = 0;
    state.scorePopups = [];
    state.giantUntil = 0;
    state.giantGhostCombo = 0;
    state.pacmanSizeTransition = null;
    state.pacmanShrinkFinalizePending = false;
    state.pacmanShrinkRealign = null;
    state.nextPowerAppleSpawnAt = 0;
    state.pacmanHiddenUntil = 0;
    pacmanDeath.active = false;
    pacmanDeath.startedAt = 0;
    state.gameOver = false;
    state.scoreSubmittedForCurrentGame = false;
    simulationLagMs = 0;
    lastFrameTimeMs = null;
    resetMap();
    resetPositions();
    resetModeCycle(clock.now());
    updateHud();
    setLeaderboardStatus("");
    state.pauseUntil = clock.now() + 350;
  }

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

  function bindEvents() {
      input.bind();

      dom.actionButton.addEventListener("click", () => {
        if (state.gameOver || !state.gameRunning) {
          newGame();
        }
        state.gameRunning = true;
        hideOverlay();
      });

      env.window.addEventListener("resize", scheduleBoardFit);
      env.document.addEventListener("visibilitychange", handleLeaderboardVisibilityChange);
    }

    function start() {
      bindEvents();
      newGame();
      initializeLeaderboardUi();
      fetchLeaderboard();
      startLeaderboardAutoRefresh();
      setupMobileGestureLock();
      fitBoardToViewport();
      setOverlay("Ready?", "Use cursor keys. Numpad 8, 4, 2, 6 also work.", "Start Game");
      requestAnimationFrame(update);
    }

    return { state, start, handleTurn: onTurn };
}
