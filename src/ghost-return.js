import { TILE_SIZE, UP, DOWN, LEFT, RIGHT, CARDINAL_DIRS, BOARD_WIDTH } from "./config.js";
import { toTile, wrapTileX, tileCenterToPixels, alignToGrid, isNearTileCenter, snapToTileCenter } from "./grid.js";

export function createGhostReturn({ state, maze }) {
  const { tileBlockedForEntity, canTravelFromTile, shortestPathDistance } = maze;

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
    ghost.speed = 2.6 + (state.level - 1) * 0.06;

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
      ghost.x = BOARD_WIDTH + ghost.radius;
    } else if (ghost.x > BOARD_WIDTH + ghost.radius) {
      ghost.x = -ghost.radius;
    }
  }

  return { resetGhostAfterReturn, updateReturningGhost };
}
