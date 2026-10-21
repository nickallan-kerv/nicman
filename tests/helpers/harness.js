import { createRequire } from "node:module";
import { createGame } from "../../src/game.js";
import { createDom, createEnv, createRepository } from "./stubs.js";

const require = createRequire(import.meta.url);
export const rules = require("../../src/nicman-rules.js");

export function createTestGame(rulesImpl = null) {
  const { env, frame } = createEnv();
  const dom = createDom();
  const clock = { t: 0, now: () => clock.t };
  const game = createGame({ env, dom, repository: createRepository(), rules: rulesImpl, clock });
  game.start();

  return {
    state: game.state,
    press: game.handleTurn,
    setClock: (now) => { clock.t = now; },
    frame: (now) => frame.callback(now)
  };
}
