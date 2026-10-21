export function createHud({ state, rules, dom, leaderboard }) {
  const { scoreEl, livesEl, levelEl } = dom;
  const { updateSubmitButtonState } = leaderboard;

  function updateHud() {
    scoreEl.textContent = String(state.score);
    livesEl.textContent = rules ? rules.formatLivesUp(state.lives) : `${Math.max(0, state.lives)}UP`;
    levelEl.textContent = String(state.level);
    updateSubmitButtonState();
  }

  return { updateHud };
}
