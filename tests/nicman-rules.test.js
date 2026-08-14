import { describe, it, expect } from "vitest";
import rules from "../nicman-rules.js";
import fs from "node:fs";
import vm from "node:vm";

describe("fruitForLevel", () => {
  it("maps early levels to expected fruit and points", () => {
    expect(rules.fruitForLevel(1)).toEqual({ kind: "cherry", points: 100 });
    expect(rules.fruitForLevel(2)).toEqual({ kind: "strawberry", points: 300 });
    expect(rules.fruitForLevel(5)).toEqual({ kind: "melon", points: 1000 });
  });

  it("caps at the highest fruit definition", () => {
    expect(rules.fruitForLevel(999)).toEqual({ kind: "key", points: 5000 });
  });

  it("normalizes invalid levels", () => {
    expect(rules.fruitForLevel(0)).toEqual({ kind: "cherry", points: 100 });
    expect(rules.fruitForLevel(-4)).toEqual({ kind: "cherry", points: 100 });
    expect(rules.fruitForLevel(Number.NaN)).toEqual({ kind: "cherry", points: 100 });
  });
});

describe("fruit spawn helpers", () => {
  it("computes expected pellet milestones", () => {
    expect(rules.fruitSpawnMilestones(240)).toEqual([69, 165]);
    expect(rules.fruitSpawnMilestones(-10)).toEqual([0, 0]);
    expect(rules.fruitSpawnMilestones(Number.NaN)).toEqual([0, 0]);
  });

  it("returns first eligible unspawned index", () => {
    const milestones = [69, 165];
    expect(rules.nextFruitSpawnIndex(240, 171, milestones, [false, false])).toBe(0);
    expect(rules.nextFruitSpawnIndex(240, 120, milestones, [true, false])).toBe(-1);
    expect(rules.nextFruitSpawnIndex(240, 70, milestones, [true, false])).toBe(1);
  });

  it("returns -1 for invalid milestone arrays", () => {
    expect(rules.nextFruitSpawnIndex(240, 100, null, [false, false])).toBe(-1);
    expect(rules.nextFruitSpawnIndex(240, 100, [69, 165], null)).toBe(-1);
    expect(rules.nextFruitSpawnIndex(Number.NaN, Number.NaN, [69, 165], [false, false])).toBe(-1);
  });
});

describe("movement and HUD helpers", () => {
  it("evaluates direction when centered or stationary", () => {
    expect(rules.shouldEvaluatePacmanDirection(true, { x: 1, y: 0 })).toBe(true);
    expect(rules.shouldEvaluatePacmanDirection(false, { x: 0, y: 0 })).toBe(true);
    expect(rules.shouldEvaluatePacmanDirection(false, { x: 1, y: 0 })).toBe(false);
    expect(rules.shouldEvaluatePacmanDirection(false, null)).toBe(true);
  });

  it("formats lives in classic UP style", () => {
    expect(rules.formatLivesUp(3)).toBe("3UP");
    expect(rules.formatLivesUp(1.9)).toBe("1UP");
    expect(rules.formatLivesUp(-5)).toBe("0UP");
    expect(rules.formatLivesUp(Number.NaN)).toBe("0UP");
  });
});

describe("computeBoardWidth", () => {
  const base = {
    viewportWidth: 903,
    viewportHeight: 445,
    bodyPadX: 8,
    bodyPadY: 8,
    sideWidth: 196,
    layoutGap: 0,
    boardChromeX: 16,
    boardChromeY: 16,
    canvasWidth: 588,
    canvasHeight: 588
  };

  it("computes a positive board width when space is available", () => {
    const width = rules.computeBoardWidth(base);
    expect(width).toBeGreaterThan(300);
    expect(width).toBeLessThanOrEqual(500);
  });

  it("adapts when side panel is hidden on narrow layouts", () => {
    const withPanel = rules.computeBoardWidth(base);
    const stacked = rules.computeBoardWidth({ ...base, sideWidth: 0 });
    expect(stacked).toBeGreaterThanOrEqual(withPanel);

    const widthLimited = {
      ...base,
      viewportWidth: 760,
      viewportHeight: 1200
    };
    const widthLimitedWithPanel = rules.computeBoardWidth(widthLimited);
    const widthLimitedStacked = rules.computeBoardWidth({ ...widthLimited, sideWidth: 0 });
    expect(widthLimitedStacked).toBeGreaterThan(widthLimitedWithPanel);
  });

  it("returns null for invalid canvas dimensions", () => {
    expect(rules.computeBoardWidth({ ...base, canvasWidth: 0 })).toBeNull();
    expect(rules.computeBoardWidth({ ...base, canvasHeight: -10 })).toBeNull();
  });

  it("returns null when viewport cannot fit the board", () => {
    expect(
      rules.computeBoardWidth({
        ...base,
        viewportWidth: 100,
        viewportHeight: 100
      })
    ).toBeNull();
  });

  it("normalizes non-finite numeric options", () => {
    expect(
      rules.computeBoardWidth({
        viewportWidth: Number.NaN,
        viewportHeight: Number.NaN,
        bodyPadX: Number.NaN,
        bodyPadY: Number.NaN,
        sideWidth: Number.NaN,
        layoutGap: Number.NaN,
        boardChromeX: Number.NaN,
        boardChromeY: Number.NaN,
        canvasWidth: Number.NaN,
        canvasHeight: Number.NaN
      })
    ).toBeNull();
  });
});

describe("module wrapper", () => {
  it("falls back to `this` when globalThis is unavailable", () => {
    const source = fs.readFileSync(new URL("../nicman-rules.js", import.meta.url), "utf8");
    const context = { console };
    vm.createContext(context);

    // Simulate an older environment where globalThis is unavailable.
    vm.runInContext(`var globalThis = undefined;\n${source}`, context);

    expect(context.NicmanRules).toBeTruthy();
    expect(context.NicmanRules.fruitForLevel(1)).toEqual({ kind: "cherry", points: 100 });
  });

  it("still attaches to global scope when module.exports is falsy", () => {
    const source = fs.readFileSync(new URL("../nicman-rules.js", import.meta.url), "utf8");
    const context = { console, module: {} };
    vm.createContext(context);

    vm.runInContext(source, context);

    expect(context.NicmanRules).toBeTruthy();
    expect(context.module.exports).toBeUndefined();
  });
});
