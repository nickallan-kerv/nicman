import { PACMAN_DEATH_DURATION_MS } from "./config.js";
import { circleHit } from "./grid.js";

export function createCollisions({ state, clock, status, mode, stage, overlayView, hud }) {
  const { pacman, pacmanDeath } = state;
  const { isPacmanGiant, isPacmanShrinking } = status;
  const { ghostIsFrightened } = mode;
  const { resetPositions } = stage;
  const { setOverlay } = overlayView;
  const { updateHud } = hud;

  function onPlayerCaught() {
    if (pacmanDeath.active) {
      return;
    }

    pacmanDeath.active = true;
    pacmanDeath.startedAt = clock.now();
    pacmanDeath.facing = Math.PI / 2;
  }

  function finishPlayerCaught() {
    state.lives -= 1;
    updateHud();
    if (state.lives <= 0) {
      state.pacmanHiddenUntil = Number.POSITIVE_INFINITY;
      state.gameOver = true;
      state.gameRunning = false;
      setOverlay("game over", "The maze wins this round.", "Play Again");
      return;
    }
    state.pauseUntil = clock.now() + 1200;
    state.pacmanHiddenUntil = 0;
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

  function consumeGhost(ghost, now, points) {
    state.score += points;
    state.scorePopups.push({
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
    const now = clock.now();
    const giantActive = isPacmanGiant(now);
    const shrinking = isPacmanShrinking();
    for (const ghost of state.ghosts) {
      if (ghost.isReturning) {
        continue;
      }

      if (!circleHit(pacman, ghost)) {
        continue;
      }

      // During shrink animation, Pac-Man is temporarily immune to ghost contact.
      if (shrinking) {
        continue;
      }

      if (giantActive) {
        state.giantGhostCombo += 1;
        const ghostScore = 300 * 2 ** Math.min(state.giantGhostCombo - 1, 3);
        consumeGhost(ghost, now, ghostScore);
      } else if (ghostIsFrightened(ghost, now)) {
        state.frightenedCombo += 1;
        const ghostScore = 200 * 2 ** Math.min(state.frightenedCombo - 1, 3);
        consumeGhost(ghost, now, ghostScore);
      } else {
        onPlayerCaught();
      }
      break;
    }
  }

  return { updatePacmanDeath, updateCollisions };
}
