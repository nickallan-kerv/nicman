import { describe, expect, it } from "vitest";
import { BOARD_HEIGHT, LEFT, MAP_TEMPLATE, TILE_SIZE } from "../src/config.js";
import { createMaze } from "../src/maze.js";
import { createPacmanStatus } from "../src/pacman-status.js";
import { createGameState } from "../src/state.js";
import { createWallPolicy } from "../src/wall-policy.js";

function setup({ giant }) {
  const state = createGameState();
  state.map = MAP_TEMPLATE.map((row) => row.split(""));
  state.giantUntil = giant ? 60000 : 0;

  const status = createPacmanStatus({ state, clock: { now: () => 0 } });
  const maze = createMaze({ state, policy: createWallPolicy({ state, status }) });
  return { state, maze };
}

describe("giant Pacman beyond the top/bottom edge", () => {
  it.each([
    ["above the maze", -10],
    ["below the maze", BOARD_HEIGHT + 10]
  ])("can still turn sideways while centred %s", (_label, y) => {
    const { state, maze } = setup({ giant: true });
    state.pacman.x = 10.5 * TILE_SIZE;
    state.pacman.y = y;

    expect(maze.canTravelFromTile(state.pacman, LEFT)).toBe(true);
  });

  it("keeps regular Pacman out of walls", () => {
    const { state, maze } = setup({ giant: false });
    state.pacman.x = 1.5 * TILE_SIZE;
    state.pacman.y = 1.5 * TILE_SIZE;

    expect(maze.canTravelFromTile(state.pacman, LEFT)).toBe(false);
  });

  it("keeps regular Pacman inside the maze vertically", () => {
    const { state, maze } = setup({ giant: false });
    state.pacman.x = 10.5 * TILE_SIZE;
    state.pacman.y = 0.5 * TILE_SIZE;

    expect(maze.tileBlockedForEntity(state.pacman, 10, -1, { x: 0, y: -1 })).toBe(true);
  });
});
