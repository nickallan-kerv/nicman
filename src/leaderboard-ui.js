import { LEADERBOARD_LIMIT, LEADERBOARD_REFRESH_MS, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, PLAYER_NAME_STORAGE_KEY } from "./config.js";

export function createLeaderboardUi({ state, repository, env, dom, layout }) {
  const { document, localStorage, setInterval, clearInterval } = env;
  const { leaderboardList, leaderboardStatus, overlayLeaderboardPanel, overlayLeaderboardList, overlayLeaderboardStatus, refreshLeaderboardButton, scoreSubmitForm, playerNameInput, submitScoreButton } = dom;
  const { isStackedLayout } = layout;

  let leaderboardEntries = [];

  let leaderboardRefreshTimerId = null;

  function sanitizePlayerName(value) {
    const trimmed = String(value || "").trim().slice(0, 16);
    const clean = trimmed.replace(/[^a-z0-9_\-\s]/gi, "");
    return clean || "PLAYER1";
  }

  function setLeaderboardStatus(message, isError = false) {
    if (leaderboardStatus) {
      leaderboardStatus.textContent = message;
      leaderboardStatus.classList.toggle("error", Boolean(isError));
    }
    if (overlayLeaderboardStatus) {
      overlayLeaderboardStatus.textContent = message;
      overlayLeaderboardStatus.classList.toggle("error", Boolean(isError));
    }
  }

  function renderLeaderboardList(targetList, entries, displayLimit) {
    if (!targetList) {
      return;
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      targetList.innerHTML = '<li class="leaderboard-empty">No scores yet. Be the first!</li>';
      return;
    }

    targetList.innerHTML = entries
      .slice(0, displayLimit)
      .map((entry, index) => {
        const rank = index + 1;
        const name = sanitizePlayerName(entry.player_name || "PLAYER1");
        const value = Number.isFinite(entry.score) ? entry.score : Number(entry.score) || 0;
        return `<li><span class="leaderboard-rank">#${rank}</span><span class="leaderboard-name">${name}</span><span class="leaderboard-score">${value}</span></li>`;
      })
      .join("");
  }

  function renderLeaderboard() {
    const sideLimit = 10;
    const overlayLimit = 5;
    renderLeaderboardList(leaderboardList, leaderboardEntries, sideLimit);
    renderLeaderboardList(overlayLeaderboardList, leaderboardEntries, overlayLimit);
    if (overlayLeaderboardPanel) {
      overlayLeaderboardPanel.classList.toggle("hidden", !isStackedLayout() || !state.gameOver);
    }
  }

  async function fetchLeaderboard() {
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      setLeaderboardStatus("Leaderboard unavailable: missing configuration.", true);
      return;
    }

    try {
      const rows = await repository.listTop(LEADERBOARD_LIMIT);
      leaderboardEntries = Array.isArray(rows) ? rows : [];
      renderLeaderboard();
      setLeaderboardStatus("");
    } catch (error) {
      renderLeaderboard();
      setLeaderboardStatus(`Could not load leaderboard. ${error.message}`, true);
    }
  }

  function canSubmitCurrentScore() {
    return state.gameOver && !state.scoreSubmittedForCurrentGame && Number.isFinite(state.score) && state.score > 0;
  }

  function updateSubmitButtonState() {
    if (!submitScoreButton) {
      return;
    }
    submitScoreButton.disabled = !canSubmitCurrentScore();
  }

  async function submitCurrentScore(event) {
    if (event) {
      event.preventDefault();
    }

    if (!canSubmitCurrentScore()) {
      setLeaderboardStatus("Finish a run first to submit a score.", true);
      return;
    }

    const playerName = sanitizePlayerName(playerNameInput ? playerNameInput.value : "");

    if (playerNameInput) {
      playerNameInput.value = playerName;
    }
    localStorage.setItem(PLAYER_NAME_STORAGE_KEY, playerName);

    try {
      setLeaderboardStatus("Submitting score...");
      updateSubmitButtonState();
      const payload = {
        player_name: playerName,
        score: state.score,
        level: state.level
      };

      await repository.addScore(payload);
      state.scoreSubmittedForCurrentGame = true;
      setLeaderboardStatus("Score submitted. Nice run!");
      updateSubmitButtonState();
      await fetchLeaderboard();
    } catch (error) {
      setLeaderboardStatus(`Score submit failed. ${error.message}`, true);
      updateSubmitButtonState();
    }
  }

  function initializeLeaderboardUi() {
    if (playerNameInput) {
      playerNameInput.value = sanitizePlayerName(localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || "PLAYER1");
    }

    if (refreshLeaderboardButton) {
      refreshLeaderboardButton.addEventListener("click", () => {
        fetchLeaderboard();
      });
    }

    if (scoreSubmitForm) {
      scoreSubmitForm.addEventListener("submit", submitCurrentScore);
    }

    updateSubmitButtonState();
  }

  function stopLeaderboardAutoRefresh() {
    if (leaderboardRefreshTimerId === null) {
      return;
    }
    clearInterval(leaderboardRefreshTimerId);
    leaderboardRefreshTimerId = null;
  }

  function startLeaderboardAutoRefresh() {
    stopLeaderboardAutoRefresh();
    if (document.hidden) {
      return;
    }

    leaderboardRefreshTimerId = setInterval(() => {
      if (document.hidden) {
        return;
      }
      fetchLeaderboard();
    }, LEADERBOARD_REFRESH_MS);
  }

  function handleLeaderboardVisibilityChange() {
    if (document.hidden) {
      stopLeaderboardAutoRefresh();
      return;
    }

    fetchLeaderboard();
    startLeaderboardAutoRefresh();
  }

  return { setLeaderboardStatus, renderLeaderboard, fetchLeaderboard, updateSubmitButtonState, initializeLeaderboardUi, startLeaderboardAutoRefresh, handleLeaderboardVisibilityChange };
}
