import { RIGHT } from "./config.js";

export function createPacmanStatus({ state, clock }) {
  const { pacman } = state;

  function isPacmanGiant(now = clock.now()) {
    return now < state.giantUntil;
  }

  function pacmanCanIgnoreWalls(now = clock.now()) {
    return isPacmanGiant(now) || (state.pacmanSizeTransition && state.pacmanSizeTransition.phase === "shrink");
  }

  function isPacmanShrinking() {
    return Boolean(state.pacmanSizeTransition && state.pacmanSizeTransition.phase === "shrink");
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

  return { isPacmanGiant, pacmanCanIgnoreWalls, isPacmanShrinking, pacmanHeading };
}
