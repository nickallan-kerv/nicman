import { TILE_SIZE, TILE_CENTER_EPSILON, widthTiles } from "./config.js";

export function toTile(value) {
  return Math.floor(value / TILE_SIZE);
}

export function wrapTileX(tx) {
  if (tx < 0) {
    return widthTiles - 1;
  }
  if (tx >= widthTiles) {
    return 0;
  }
  return tx;
}

export function tileCenterFromCoords(x, y) {
  return { x: toTile(x), y: toTile(y) };
}

export function tileCenterToPixels(tile) {
  return {
    x: (tile.x + 0.5) * TILE_SIZE,
    y: (tile.y + 0.5) * TILE_SIZE
  };
}

export function isInsideGhostHome(tile) {
  return tile.x >= 8 && tile.x <= 12 && tile.y >= 9 && tile.y <= 12;
}

export function alignToGrid(entity) {
  const tileCenterX = (Math.floor(entity.x / TILE_SIZE) + 0.5) * TILE_SIZE;
  const tileCenterY = (Math.floor(entity.y / TILE_SIZE) + 0.5) * TILE_SIZE;
  if (Math.abs(entity.x - tileCenterX) < TILE_CENTER_EPSILON) {
    entity.x = tileCenterX;
  }
  if (Math.abs(entity.y - tileCenterY) < TILE_CENTER_EPSILON) {
    entity.y = tileCenterY;
  }
}

export function isNearTileCenter(entity) {
  const offsetX = Math.abs((entity.x % TILE_SIZE) - TILE_SIZE / 2);
  const offsetY = Math.abs((entity.y % TILE_SIZE) - TILE_SIZE / 2);
  return offsetX < TILE_CENTER_EPSILON && offsetY < TILE_CENTER_EPSILON;
}

export function snapToTileCenter(entity) {
  entity.x = (toTile(entity.x) + 0.5) * TILE_SIZE;
  entity.y = (toTile(entity.y) + 0.5) * TILE_SIZE;
}

export function sameDirection(a, b) {
  return a.x === b.x && a.y === b.y;
}

export function opposite(dirA, dirB) {
  if ((dirA.x === 0 && dirA.y === 0) || (dirB.x === 0 && dirB.y === 0)) {
    return false;
  }
  return dirA.x === -dirB.x && dirA.y === -dirB.y;
}

export function circleHit(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const sum = a.radius + b.radius - 2;
  return dx * dx + dy * dy <= sum * sum;
}
