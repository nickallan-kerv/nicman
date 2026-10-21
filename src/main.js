import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config.js";
import { createGame } from "./game.js";
import { createScoresRepository } from "./scores-repository.js";

const canvas = document.getElementById("game");

const dom = {
  canvas,
  ctx: canvas.getContext("2d"),
  appShell: document.querySelector(".app-shell"),
  gameLayout: document.querySelector(".game-layout"),
  boardWrap: document.querySelector(".board-wrap"),
  sidePanel: document.querySelector(".side-panel"),
  scoreEl: document.getElementById("score"),
  livesEl: document.getElementById("lives"),
  levelEl: document.getElementById("level"),
  overlay: document.getElementById("overlay"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayText: document.getElementById("overlayText"),
  actionButton: document.getElementById("actionButton"),
  joystick: document.getElementById("joystick"),
  joystickKnob: document.getElementById("joystickKnob"),
  leaderboardList: document.getElementById("leaderboardList"),
  leaderboardStatus: document.getElementById("leaderboardStatus"),
  overlayLeaderboardPanel: document.getElementById("overlayLeaderboardPanel"),
  overlayLeaderboardList: document.getElementById("overlayLeaderboardList"),
  overlayLeaderboardStatus: document.getElementById("overlayLeaderboardStatus"),
  refreshLeaderboardButton: document.getElementById("refreshLeaderboard"),
  scoreSubmitForm: document.getElementById("scoreSubmitForm"),
  playerNameInput: document.getElementById("playerName"),
  submitScoreButton: document.getElementById("submitScoreButton")
};

// Wrapped so the injected functions keep their browser `this` binding.
const env = {
  document,
  window,
  localStorage: window.localStorage,
  getComputedStyle: (...args) => window.getComputedStyle(...args),
  requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
  cancelAnimationFrame: (id) => window.cancelAnimationFrame(id),
  setInterval: (...args) => window.setInterval(...args),
  clearInterval: (id) => window.clearInterval(id)
};

createGame({
  env,
  dom,
  repository: createScoresRepository({
    supabaseUrl: SUPABASE_URL,
    publishableKey: SUPABASE_PUBLISHABLE_KEY
  }),
  rules: globalThis.NicmanRules || null,
  clock: { now: () => performance.now() }
}).start();
