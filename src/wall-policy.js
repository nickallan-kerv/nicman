// Entity-specific movement exceptions, kept out of the maze geometry so the maze stays entity-agnostic.
export function createWallPolicy({ state, status }) {
  return {
    ignoresWalls(entity) {
      return entity === state.pacman && status.pacmanCanIgnoreWalls();
    },

    canPassGate(entity, attemptedDir = null) {
      const dir = attemptedDir || (entity && entity.dir) || { x: 0, y: 0 };

      // Pink home gate blocks Pacman unless giant-exit lock is actively moving upward.
      if (entity === state.pacman) {
        return Boolean(state.pacmanGhostHomeExitLock) && dir.y === -1;
      }

      if (!entity || !entity.kind) {
        return false;
      }

      // Eaten ghosts are allowed back into home through the gate.
      if (entity.isReturning) {
        return true;
      }

      // Normal ghosts may only pass the gate when moving upward out of home.
      return dir.y === -1;
    }
  };
}
