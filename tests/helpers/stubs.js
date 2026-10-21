// Deep stub for DOM-ish objects: any property is another stub, calls return the stub itself.
export function createStub() {
  const cache = new Map();
  const target = function stub() {};
  const proxy = new Proxy(target, {
    get(t, prop) {
      if (prop in t && prop !== "name" && prop !== "length") {
        return t[prop];
      }
      if (typeof prop === "symbol") {
        return undefined;
      }
      if (prop === "toString" || prop === "valueOf") {
        return () => "0";
      }
      if (!cache.has(prop)) {
        cache.set(prop, createStub());
      }
      return cache.get(prop);
    },
    set(t, prop, value) {
      t[prop] = value;
      return true;
    },
    apply() {
      return proxy;
    }
  });
  return proxy;
}

export const DOM_ELEMENT_NAMES = [
  "canvas", "ctx", "appShell", "gameLayout", "boardWrap", "sidePanel",
  "scoreEl", "livesEl", "levelEl", "overlay", "overlayTitle", "overlayText", "actionButton",
  "joystick", "joystickKnob", "leaderboardList", "leaderboardStatus",
  "overlayLeaderboardPanel", "overlayLeaderboardList", "overlayLeaderboardStatus",
  "refreshLeaderboardButton", "scoreSubmitForm", "playerNameInput", "submitScoreButton"
];

export function createDom() {
  globalThis.Path2D ??= function Path2D() {
    return createStub();
  };
  return Object.fromEntries(DOM_ELEMENT_NAMES.map((name) => [name, createStub()]));
}

export function createEnv() {
  const documentStub = createStub();
  documentStub.hidden = false;
  documentStub.addEventListener = () => {};
  const windowStub = {
    location: { search: "" },
    matchMedia: () => ({ matches: false }),
    addEventListener: () => {},
    innerWidth: 1000,
    innerHeight: 800
  };

  const frame = { callback: null };
  return {
    frame,
    env: {
      document: documentStub,
      window: windowStub,
      localStorage: { getItem: () => "PLAYER1", setItem: () => {} },
      getComputedStyle: () => ({}),
      requestAnimationFrame: (callback) => {
        frame.callback = callback;
        return 1;
      },
      cancelAnimationFrame: () => {},
      setInterval: () => 0,
      clearInterval: () => {}
    }
  };
}

export function createRepository() {
  return { listTop: async () => [], addScore: async () => {} };
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
