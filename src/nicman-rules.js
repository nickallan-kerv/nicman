(function initNicmanRules(globalScope) {
  const FRUIT_BY_LEVEL = [
    { kind: "cherry", points: 100 },
    { kind: "strawberry", points: 300 },
    { kind: "orange", points: 500 },
    { kind: "apple", points: 700 },
    { kind: "melon", points: 1000 },
    { kind: "galaxian", points: 2000 },
    { kind: "bell", points: 3000 },
    { kind: "key", points: 5000 }
  ];

  function normalizeLevel(level) {
    const safeLevel = Number.isFinite(level) ? Math.floor(level) : 1;
    return Math.max(1, safeLevel);
  }

  function fruitForLevel(level) {
    const normalized = normalizeLevel(level);
    const idx = Math.min(normalized - 1, FRUIT_BY_LEVEL.length - 1);
    return FRUIT_BY_LEVEL[idx];
  }

  function fruitSpawnMilestones(totalPellets) {
    const safeTotal = Number.isFinite(totalPellets) ? Math.max(0, totalPellets) : 0;
    return [Math.floor(safeTotal * 0.29), Math.floor(safeTotal * 0.69)];
  }

  function nextFruitSpawnIndex(totalPellets, pelletsRemaining, milestones, spawnedFlags) {
    if (!Array.isArray(milestones) || !Array.isArray(spawnedFlags)) {
      return -1;
    }

    const safeTotal = Number.isFinite(totalPellets) ? Math.max(0, totalPellets) : 0;
    const safeRemaining = Number.isFinite(pelletsRemaining) ? Math.max(0, pelletsRemaining) : 0;
    const pelletsEaten = safeTotal - safeRemaining;

    for (let i = 0; i < milestones.length; i += 1) {
      if (spawnedFlags[i]) {
        continue;
      }
      if (pelletsEaten >= milestones[i]) {
        return i;
      }
    }

    return -1;
  }

  function shouldEvaluatePacmanDirection(nearCenter, dir) {
    const stationary = !dir || (dir.x === 0 && dir.y === 0);
    return Boolean(nearCenter) || stationary;
  }

  function formatLivesUp(lives) {
    const safeLives = Number.isFinite(lives) ? Math.max(0, Math.floor(lives)) : 0;
    return `${safeLives}UP`;
  }

  function computeBoardWidth(options) {
    const {
      viewportWidth,
      viewportHeight,
      bodyPadX,
      bodyPadY,
      sideWidth,
      layoutGap,
      boardChromeX,
      boardChromeY,
      canvasWidth,
      canvasHeight
    } = options;

    const safeViewportWidth = Number.isFinite(viewportWidth) ? viewportWidth : 0;
    const safeViewportHeight = Number.isFinite(viewportHeight) ? viewportHeight : 0;
    const safeBodyPadX = Number.isFinite(bodyPadX) ? bodyPadX : 0;
    const safeBodyPadY = Number.isFinite(bodyPadY) ? bodyPadY : 0;
    const safeSideWidth = Number.isFinite(sideWidth) ? sideWidth : 0;
    const safeLayoutGap = Number.isFinite(layoutGap) ? layoutGap : 0;
    const safeBoardChromeX = Number.isFinite(boardChromeX) ? boardChromeX : 0;
    const safeBoardChromeY = Number.isFinite(boardChromeY) ? boardChromeY : 0;
    const safeCanvasWidth = Number.isFinite(canvasWidth) ? canvasWidth : 0;
    const safeCanvasHeight = Number.isFinite(canvasHeight) ? canvasHeight : 0;

    if (safeCanvasWidth <= 0 || safeCanvasHeight <= 0) {
      return null;
    }

    const availableHeight = safeViewportHeight - safeBodyPadY - 2;
    const availableWidth = safeViewportWidth - safeBodyPadX - safeSideWidth - (safeSideWidth > 0 ? safeLayoutGap : 0);
    const scaleByHeight = (availableHeight - safeBoardChromeY) / safeCanvasHeight;
    const scaleByWidth = (availableWidth - safeBoardChromeX) / safeCanvasWidth;
    const scale = Math.min(scaleByHeight, scaleByWidth);

    if (!Number.isFinite(scale) || scale <= 0) {
      return null;
    }

    return Math.floor(safeCanvasWidth * scale + safeBoardChromeX);
  }

  const api = {
    FRUIT_BY_LEVEL,
    fruitForLevel,
    fruitSpawnMilestones,
    nextFruitSpawnIndex,
    shouldEvaluatePacmanDirection,
    formatLivesUp,
    computeBoardWidth
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  globalScope.NicmanRules = api;
  /* c8 ignore next */
})(typeof globalThis !== "undefined" ? globalThis : this);
