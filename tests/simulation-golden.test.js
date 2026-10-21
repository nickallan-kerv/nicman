import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestGame, rules } from "./helpers/harness.js";
import { RANDOM_SEED, runScenario } from "./helpers/scenario.js";
import { mulberry32 } from "./helpers/stubs.js";

const golden = JSON.parse(readFileSync(new URL("./fixtures/golden-simulation.json", import.meta.url), "utf8"));

describe("simulation matches the recorded run", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockImplementation(mulberry32(RANDOM_SEED));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Re-record with `npm run record:golden` after intentional behaviour changes.
  it.each([
    ["built-in fallbacks", null],
    ["NicmanRules", rules]
  ])("replays the same run with %s", (_label, rulesImpl) => {
    const samples = runScenario(createTestGame(rulesImpl));
    const first = samples.findIndex((s, i) => JSON.stringify(s) !== JSON.stringify(golden[i]));
    if (first !== -1) {
      expect(samples[first], `first difference at frame ${samples[first].frame}`).toEqual(golden[first]);
    }
    expect(samples).toHaveLength(golden.length);
  });
});
