// Re-records tests/fixtures/golden-simulation.json; run only after an intentional behaviour change.
import { writeFileSync } from "node:fs";
import { createTestGame } from "../tests/helpers/harness.js";
import { RANDOM_SEED, runScenario } from "../tests/helpers/scenario.js";
import { mulberry32 } from "../tests/helpers/stubs.js";

const record = () => {
  Math.random = mulberry32(RANDOM_SEED);
  return runScenario(createTestGame(null));
};

const samples = record();
if (JSON.stringify(samples) !== JSON.stringify(record())) {
  throw new Error("Scenario is not deterministic; refusing to record");
}

const file = new URL("../tests/fixtures/golden-simulation.json", import.meta.url);
writeFileSync(file, `[\n${samples.map((s) => JSON.stringify(s)).join(",\n")}\n]\n`);
console.log(`Recorded ${samples.length} samples to tests/fixtures/golden-simulation.json`);
