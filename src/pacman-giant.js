import { TILE_SIZE, UP, DOWN, LEFT, RIGHT, GHOST_GATE_TILE, heightTiles, PACMAN_BASE_RADIUS, PACMAN_GIANT_RADIUS, PACMAN_SIZE_TRANSITION_MS } from "./config.js";
import { toTile, wrapTileX, tileCenterFromCoords, isInsideGhostHome } from "./grid.js";

export function createPacmanGiant({ state, status, maze }) {
  const { pacman } = state;
  const { isPacmanGiant, pacmanHeading } = status;
  const { tileIsWall, tileBlockedForEntity, canTravelFromTile } = maze;

  function startPacmanSizeTransition(targetRadius, now, phase) {
    const from = pacman.radius;
    state.pacmanSizeTransition = {
      from,
      to: targetRadius,
      startedAt: now,
      phase
    };

    if (Math.abs(from - targetRadius) < 0.001) {
      pacman.radius = targetRadius;
      state.pacmanSizeTransition = null;
    }
  }

  function updatePacmanSizeTransition(now) {
    if (!state.pacmanSizeTransition) {
      return null;
    }

    const elapsed = now - state.pacmanSizeTransition.startedAt;
    const t = Math.max(0, Math.min(1, elapsed / PACMAN_SIZE_TRANSITION_MS));
    pacman.radius = state.pacmanSizeTransition.from + (state.pacmanSizeTransition.to - state.pacmanSizeTransition.from) * t;

    if (t >= 1) {
      const completedPhase = state.pacmanSizeTransition.phase;
      pacman.radius = state.pacmanSizeTransition.to;
      state.pacmanSizeTransition = null;
      return completedPhase;
    }

    return null;
  }

  function pacmanSizeTransitionProgress(now) {
    if (!state.pacmanSizeTransition) {
      return 1;
    }
    const elapsed = now - state.pacmanSizeTransition.startedAt;
    return Math.max(0, Math.min(1, elapsed / PACMAN_SIZE_TRANSITION_MS));
  }

  function beginPacmanShrinkRealign() {
    const centerX = (toTile(pacman.x) + 0.5) * TILE_SIZE;
    const centerY = (toTile(pacman.y) + 0.5) * TILE_SIZE;
    const preferredDir =
      (pacman.dir.x !== 0 || pacman.dir.y !== 0)
        ? { ...pacman.dir }
        : (pacman.nextDir.x !== 0 || pacman.nextDir.y !== 0)
          ? { ...pacman.nextDir }
          : { ...pacmanHeading() };

    const alignAxis = Math.abs(preferredDir.x) >= Math.abs(preferredDir.y) ? "y" : "x";
    state.pacmanShrinkRealign = {
      toX: centerX,
      toY: centerY,
      lastT: 0,
      alignAxis,
      preferredDir
    };
  }

  function applyPacmanShrinkRealign(now) {
    if (!state.pacmanShrinkRealign || !state.pacmanSizeTransition || state.pacmanSizeTransition.phase !== "shrink") {
      return;
    }

    const t = pacmanSizeTransitionProgress(now);
    const prevT = state.pacmanShrinkRealign.lastT || 0;
    const remaining = 1 - prevT;
    const blend = remaining <= 0 ? 1 : Math.max(0, Math.min(1, (t - prevT) / remaining));

    if (blend > 0) {
      if (state.pacmanShrinkRealign.alignAxis === "x") {
        pacman.x += (state.pacmanShrinkRealign.toX - pacman.x) * blend;
      } else {
        pacman.y += (state.pacmanShrinkRealign.toY - pacman.y) * blend;
      }
    }
    state.pacmanShrinkRealign.lastT = t;

    if (t >= 1) {
      state.pacmanShrinkRealign = null;
    }
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
          if (tileIsWall(nx, ny) || state.map[ny][nx] === "-") {
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
      state.pacmanGhostHomeExitLock = null;
      return;
    }

    const preferred =
      (pacman.dir.x !== 0 || pacman.dir.y !== 0)
        ? pacman.dir
        : (pacman.nextDir.x !== 0 || pacman.nextDir.y !== 0)
          ? pacman.nextDir
          : UP;

    state.pacmanGhostHomeExitLock = { ...preferred };
  }

  function canPlacePacmanOnTile(tile) {
    const tx = wrapTileX(tile.x);
    const ty = tile.y;
    if (ty < 0 || ty >= heightTiles) {
      return false;
    }
    if (tileIsWall(tx, ty) || state.map[ty][tx] === "-" || isInsideGhostHome({ x: tx, y: ty })) {
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
    if (!state.pacmanGhostHomeExitLock) {
      return false;
    }

    const tile = tileCenterFromCoords(pacman.x, pacman.y);
    if (!isInsideGhostHome(tile)) {
      state.pacmanGhostHomeExitLock = null;
      return false;
    }

    if (canTravelFromTile(pacman, state.pacmanGhostHomeExitLock)) {
      pacman.nextDir = { ...state.pacmanGhostHomeExitLock };
      pacman.dir = { ...state.pacmanGhostHomeExitLock };
      return true;
    }

    // If the preserved direction cannot progress, force upward toward gate exit.
    if (canTravelFromTile(pacman, UP)) {
      state.pacmanGhostHomeExitLock = { ...UP };
      pacman.nextDir = { ...UP };
      pacman.dir = { ...UP };
      return true;
    }

    pacman.dir = { x: 0, y: 0 };
    return true;
  }

  function syncPacmanGiantState(now) {
    if (isPacmanGiant(now)) {
      if (!state.pacmanSizeTransition || state.pacmanSizeTransition.phase !== "grow") {
        startPacmanSizeTransition(PACMAN_GIANT_RADIUS, now, "grow");
      }
      updatePacmanSizeTransition(now);
      return;
    }

    if (state.giantUntil !== 0) {
      state.giantUntil = 0;
    }

    // A shrink must run to completion even if the radius is already within rounding distance of normal.
    const shrinkInProgress = state.pacmanSizeTransition?.phase === "shrink";
    if (pacman.radius > PACMAN_BASE_RADIUS + 0.001 || shrinkInProgress) {
      if (!state.pacmanSizeTransition || state.pacmanSizeTransition.phase !== "shrink") {
        startPacmanSizeTransition(PACMAN_BASE_RADIUS, now, "shrink");
        beginPacmanShrinkRealign();
      }

      applyPacmanShrinkRealign(now);
      const completedPhase = updatePacmanSizeTransition(now);
      if (completedPhase !== "shrink") {
        return;
      }
      state.pacmanShrinkRealign = null;
    } else if (pacman.radius < PACMAN_BASE_RADIUS - 0.001) {
      pacman.radius = PACMAN_BASE_RADIUS;
    }

    if (state.pacmanShrinkFinalizePending) {
      const preferredDir = state.pacmanShrinkRealign ? state.pacmanShrinkRealign.preferredDir : null;
      state.pacmanShrinkFinalizePending = false;
      state.giantGhostCombo = 0;
      ensurePacmanOutsideWall();
      pacman.turnQueue = [];
      const movementCandidates = [
        preferredDir,
        pacman.dir,
        pacman.nextDir,
        RIGHT,
        LEFT,
        UP,
        DOWN
      ].filter((dir) => dir && (dir.x !== 0 || dir.y !== 0));

      const resolved = movementCandidates.find((dir) => canTravelFromTile(pacman, dir));
      if (resolved) {
        pacman.dir = { ...resolved };
        pacman.nextDir = { ...resolved };
      } else {
        pacman.dir = { x: 0, y: 0 };
        pacman.nextDir = { x: 0, y: 0 };
      }

      if (placePacmanOutsideGhostHomeByMomentum()) {
        state.pacmanGhostHomeExitLock = null;
      } else {
        beginPacmanGhostHomeExitLock();
      }
    }
  }

  return { startPacmanSizeTransition, updatePacmanGhostHomeExitLock, syncPacmanGiantState };
}
