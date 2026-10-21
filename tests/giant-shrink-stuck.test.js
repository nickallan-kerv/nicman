import { describe, expect, it } from "vitest";
import { PACMAN_BASE_RADIUS, PACMAN_GIANT_RADIUS } from "../src/config.js";
import { createTestGame } from "./helpers/harness.js";

const STEP_MS = 1000 / 60;
const START = 1000;

describe("shrink back to normal size always completes", () => {
  // A step can land a hair before the shrink's end, leaving the radius within rounding distance of normal.
  it.each([
    ["radius a hair above normal", PACMAN_BASE_RADIUS + 0.0005],
    ["radius exactly normal", PACMAN_BASE_RADIUS]
  ])("clears the shrink transition when the %s", (_label, radius) => {
    const game = createTestGame();
    const { state } = game;
    state.gameRunning = true;
    state.pauseUntil = 0;
    game.setClock(START);
    game.frame(START);

    state.giantUntil = 0;
    state.pacman.radius = radius;
    state.pacmanShrinkFinalizePending = true;
    state.pacmanSizeTransition = { from: PACMAN_GIANT_RADIUS, to: PACMAN_BASE_RADIUS, startedAt: START - 1999.99, phase: "shrink" };

    let now = START;
    for (let i = 0; i < 5; i += 1) {
      now += STEP_MS;
      game.setClock(now);
      game.frame(now);
    }

    expect(state.pacmanSizeTransition).toBeNull();
    expect(state.pacman.radius).toBe(PACMAN_BASE_RADIUS);
    expect(state.pacmanShrinkFinalizePending).toBe(false);
  });
});
