import { CARDINAL_DIRS, heightTiles, BOARD_WIDTH, BOARD_HEIGHT } from "./config.js";
import { toTile, wrapTileX } from "./grid.js";

export function createMaze({ state, policy }) {
  function tileIsWall(tx, ty) {
    if (ty < 0 || ty >= heightTiles) {
      return true;
    }
    const wrappedX = wrapTileX(tx);
    return state.map[ty][wrappedX] === "#";
  }

  function tileBlockedForEntity(entity, tx, ty, attemptedDir = null) {
    if (policy.ignoresWalls(entity)) {
      return false;
    }

    if (ty < 0 || ty >= heightTiles) {
      return true;
    }

    const cell = state.map[ty][wrapTileX(tx)];
    if (cell === "#") {
      return true;
    }

    if (cell !== "-") {
      return false;
    }

    return !policy.canPassGate(entity, attemptedDir);
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
    if (policy.ignoresWalls(entity)) {
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

  function stepEntity(entity) {
    if (!canMove(entity, entity.dir)) {
      entity.dir = { x: 0, y: 0 };
      return;
    }

    entity.x += entity.dir.x * entity.speed;
    entity.y += entity.dir.y * entity.speed;

    if (entity.x < -entity.radius) {
      entity.x = BOARD_WIDTH + entity.radius;
    } else if (entity.x > BOARD_WIDTH + entity.radius) {
      entity.x = -entity.radius;
    }

    if (policy.ignoresWalls(entity)) {
      if (entity.y < -entity.radius) {
        entity.y = BOARD_HEIGHT + entity.radius;
      } else if (entity.y > BOARD_HEIGHT + entity.radius) {
        entity.y = -entity.radius;
      }
    }
  }

  return { tileIsWall, tileBlockedForEntity, canTravelFromTile, canMove, nextTilesFrom, shortestPathDistance, stepEntity };
}
