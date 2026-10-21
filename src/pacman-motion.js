import { isNearTileCenter, snapToTileCenter, sameDirection, opposite } from "./grid.js";

export function createPacmanMotion({ state, rules, status, maze, giant }) {
  const { pacman } = state;
  const { isPacmanGiant } = status;
  const { canTravelFromTile } = maze;
  const { updatePacmanGhostHomeExitLock } = giant;

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
    for (let i = pacman.turnQueue.length - 1; i >= 0; i -= 1) {
      const candidate = pacman.turnQueue[i];
      if (!canTravelFromTile(pacman, candidate)) {
        continue;
      }

      pacman.nextDir = { ...candidate };
      // Drop all stale queued intents once the newest valid input is chosen.
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

    applyQueuedTurn();

    if (opposite(pacman.nextDir, pacman.dir) && canTravelFromTile(pacman, pacman.nextDir)) {
      pacman.dir = { ...pacman.nextDir };
      return;
    }

    if (tryApplyImmediateReverseTurn()) {
      return;
    }

    const nearCenter = isNearTileCenter(pacman);
    if (rules && !rules.shouldEvaluatePacmanDirection(nearCenter, pacman.dir)) {
      return;
    }
    if (!rules && !nearCenter && !(pacman.dir.x === 0 && pacman.dir.y === 0)) {
      return;
    }

    if (nearCenter) {
      snapToTileCenter(pacman);
    }

    if (canTravelFromTile(pacman, pacman.nextDir)) {
      pacman.dir = { ...pacman.nextDir };
    }

    if (!canTravelFromTile(pacman, pacman.dir)) {
      pacman.dir = { x: 0, y: 0 };
    }
  }

  return { queuePacmanTurn, applyQueuedTurn, updatePacmanDirection };
}
