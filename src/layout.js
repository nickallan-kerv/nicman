export function createLayout({ rules, env, dom }) {
  const { document, window, getComputedStyle } = env;
  const { canvas, appShell, gameLayout, boardWrap, sidePanel } = dom;

  function parsePx(value) {
    const n = Number.parseFloat(value || "0");
    return Number.isFinite(n) ? n : 0;
  }

  function isStackedLayout() {
    return window.matchMedia("(max-width: 640px)").matches;
  }

  function fitBoardToViewport() {
    if (!appShell || !gameLayout || !boardWrap) {
      return;
    }

    const bodyStyle = getComputedStyle(document.body);
    const layoutStyle = getComputedStyle(gameLayout);
    const boardStyle = getComputedStyle(boardWrap);

    const bodyPadY = parsePx(bodyStyle.paddingTop) + parsePx(bodyStyle.paddingBottom);
    const bodyPadX = parsePx(bodyStyle.paddingLeft) + parsePx(bodyStyle.paddingRight);
    const layoutGap = parsePx(layoutStyle.columnGap || layoutStyle.gap);
    const boardChromeX =
      parsePx(boardStyle.paddingLeft) +
      parsePx(boardStyle.paddingRight) +
      parsePx(boardStyle.borderLeftWidth) +
      parsePx(boardStyle.borderRightWidth);
    const boardChromeY =
      parsePx(boardStyle.paddingTop) +
      parsePx(boardStyle.paddingBottom) +
      parsePx(boardStyle.borderTopWidth) +
      parsePx(boardStyle.borderBottomWidth);

    const isStacked = window.matchMedia("(max-width: 640px)").matches;
    const sideWidth = !isStacked && sidePanel ? sidePanel.offsetWidth : 0;
    const targetWidth = rules
      ? rules.computeBoardWidth({
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        bodyPadX,
        bodyPadY,
        sideWidth,
        layoutGap,
        boardChromeX,
        boardChromeY,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height
      })
      : null;

    if (!Number.isFinite(targetWidth) || targetWidth <= 0) {
      return;
    }
    boardWrap.style.width = `${targetWidth}px`;
  }

  return { isStackedLayout, fitBoardToViewport };
}
