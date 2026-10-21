import { TILE_SIZE, UP, CARDINAL_DIRS, GHOST_GATE_TILE, GHOST_EXIT_TILE } from "./config.js";
import { toTile, wrapTileX, tileCenterFromCoords, isInsideGhostHome, alignToGrid, isNearTileCenter, snapToTileCenter, opposite } from "./grid.js";

export function createGhosts({ state, clock, status, maze, mode, ghostReturn }) {
  const { pacman } = state;
  const { pacmanHeading } = status;
  const { canTravelFromTile, shortestPathDistance, stepEntity } = maze;
  const { frightenedActive, ghostIsFrightened } = mode;
  const { resetGhostAfterReturn, updateReturningGhost } = ghostReturn;

  const CHASE_TARGETS = {
    blinky: (ghost, pacTile) => pacTile,
    pinky: (ghost, pacTile, heading) => ({
      x: pacTile.x + heading.x * 4,
      y: pacTile.y + heading.y * 4
    }),
    inky: (ghost, pacTile, heading) => {
      const blinky = state.ghosts.find((g) => g.kind === "blinky") || ghost;
      const blinkyTile = tileCenterFromCoords(blinky.x, blinky.y);
      const pivot = {
        x: pacTile.x + heading.x * 2,
        y: pacTile.y + heading.y * 2
      };
      return {
        x: pivot.x + (pivot.x - blinkyTile.x),
        y: pivot.y + (pivot.y - blinkyTile.y)
      };
    },
    // Clyde chases when far away, otherwise retreats to scatter corner.
    clyde: (ghost, pacTile) => {
      const ghostTile = tileCenterFromCoords(ghost.x, ghost.y);
      const dx = pacTile.x - ghostTile.x;
      const dy = pacTile.y - ghostTile.y;
      const distSq = dx * dx + dy * dy;
      return distSq > 64 ? pacTile : ghost.scatterTarget;
    }
  };

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

    if (state.currentGlobalMode === "scatter") {
      return ghost.scatterTarget;
    }

    const pacTile = tileCenterFromCoords(pacman.x, pacman.y);
    const heading = pacmanHeading();
    const chase = CHASE_TARGETS[ghost.kind] || CHASE_TARGETS.clyde;
    return chase(ghost, pacTile, heading);
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
        for (const other of state.ghosts) {
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
    const now = clock.now();

    if (!frightenedActive(now)) {
      state.frightenedCombo = 0;
      for (const ghost of state.ghosts) {
        ghost.frightened = false;
      }
    }

    for (const ghost of state.ghosts) {
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
        ghost.speed = 2.6 + (state.level - 1) * 0.06;
      } else if (!ghost.hasLeftHome) {
        ghost.speed = 2.2;
      } else {
        ghost.speed = ghostIsFrightened(ghost, now) ? 1.2 + (state.level - 1) * 0.03 : 1.8 + (state.level - 1) * 0.08;
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

  return { updateGhosts };
}
