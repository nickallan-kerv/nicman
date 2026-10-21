import { MODE_PHASES, FRIGHTENED_WARNING_MS, FRIGHTENED_FLASH_MS } from "./config.js";

export function createGhostMode({ state }) {
  function reverseGhosts() {
    for (const ghost of state.ghosts) {
      // Defer reversal to the next tile center so ghosts do not clip into walls.
      ghost.forceReverse = true;
    }
  }

  function resetModeCycle(now) {
    state.currentGlobalMode = MODE_PHASES[0].mode;
    state.modePhaseIndex = 0;
    state.modePhaseStartedAt = now;
  }

  function updateGlobalMode(now) {
    if (now < state.frightenedUntil) {
      return;
    }

    while (state.modePhaseIndex < MODE_PHASES.length - 1) {
      const phase = MODE_PHASES[state.modePhaseIndex];
      if (now - state.modePhaseStartedAt < phase.durationMs) {
        break;
      }
      state.modePhaseStartedAt += phase.durationMs;
      state.modePhaseIndex += 1;
      const nextMode = MODE_PHASES[state.modePhaseIndex].mode;
      if (nextMode !== state.currentGlobalMode) {
        state.currentGlobalMode = nextMode;
        reverseGhosts();
      }
    }
  }

  function frightenedActive(now) {
    return now < state.frightenedUntil;
  }

  function ghostIsFrightened(ghost, now) {
    return frightenedActive(now) && ghost.frightened && !ghost.isReturning;
  }

  function frightenedWarningActive(now) {
    const remaining = state.frightenedUntil - now;
    return remaining > 0 && remaining <= FRIGHTENED_WARNING_MS;
  }

  function frightenedFlashOn(now) {
    const remaining = state.frightenedUntil - now;
    if (remaining <= 0) {
      return false;
    }
    return Math.floor(remaining / FRIGHTENED_FLASH_MS) % 2 === 0;
  }

  return { reverseGhosts, resetModeCycle, updateGlobalMode, frightenedActive, ghostIsFrightened, frightenedWarningActive, frightenedFlashOn };
}
