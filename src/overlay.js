export function createOverlay({ env, dom, layout, leaderboard }) {
  const { document, requestAnimationFrame } = env;
  const { overlay, overlayTitle, overlayText, actionButton, overlayLeaderboardPanel, scoreSubmitForm } = dom;
  const { isStackedLayout } = layout;
  const { updateSubmitButtonState } = leaderboard;

  function setOverlay(title, text, buttonText) {
    overlayTitle.textContent = title;
    const isGameOverTitle = String(title).trim().toLowerCase() === "game over";
    document.body.classList.toggle("game-over-overlay", isGameOverTitle);
    overlayTitle.classList.toggle("overlay-title-arcade", isGameOverTitle);
    overlayText.textContent = text;
    actionButton.textContent = buttonText;
    if (scoreSubmitForm) {
      scoreSubmitForm.classList.toggle("hidden", !isGameOverTitle);
    }
    if (overlayLeaderboardPanel) {
      overlayLeaderboardPanel.classList.toggle("hidden", !isGameOverTitle || !isStackedLayout());
    }
    overlay.classList.remove("hidden");

    // Keep game-over text on one line and sized to ~80% of overlay width.
    if (isGameOverTitle) {
      requestAnimationFrame(fitGameOverOverlayTitle);
      updateSubmitButtonState();
    } else {
      overlayTitle.style.removeProperty("font-size");
    }
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
    document.body.classList.remove("game-over-overlay");
    if (scoreSubmitForm) {
      scoreSubmitForm.classList.add("hidden");
    }
    if (overlayLeaderboardPanel) {
      overlayLeaderboardPanel.classList.add("hidden");
    }
    updateSubmitButtonState();
  }

  function fitGameOverOverlayTitle() {
    if (!overlay || !overlayTitle || !overlayTitle.classList.contains("overlay-title-arcade")) {
      return;
    }

    const targetWidth = overlay.clientWidth * 0.8;
    if (!Number.isFinite(targetWidth) || targetWidth <= 0) {
      return;
    }

    const maxFontPx = 220;
    const minFontPx = 20;

    if (document.fonts && !document.fonts.check('20px "PacfontGood"', overlayTitle.textContent || "game over")) {
      document.fonts
        .load('20px "PacfontGood"', overlayTitle.textContent || "game over")
        .then(() => requestAnimationFrame(fitGameOverOverlayTitle))
        .catch(() => {
          // Keep current sizing if the Font Loading API fails.
        });
    }

    overlayTitle.style.fontSize = `${maxFontPx}px`;

    const measuredWidth = overlayTitle.getBoundingClientRect().width;
    if (!Number.isFinite(measuredWidth) || measuredWidth <= 0) {
      return;
    }

    const fittedPx = Math.floor(maxFontPx * (targetWidth / measuredWidth));
    const clampedPx = Math.max(minFontPx, Math.min(maxFontPx, fittedPx));
    overlayTitle.style.fontSize = `${clampedPx}px`;

    const finalWidth = overlayTitle.getBoundingClientRect().width;
    if (!Number.isFinite(finalWidth) || finalWidth <= 0) {
      return;
    }

    const correctedPx = Math.floor(clampedPx * (targetWidth / finalWidth));
    const finalPx = Math.max(minFontPx, Math.min(maxFontPx, correctedPx));
    overlayTitle.style.fontSize = `${finalPx}px`;
  }

  return { setOverlay, hideOverlay, fitGameOverOverlayTitle };
}
