/** Wall-clock source for the game. Growth and production use timestamps so they continue while the tab is closed. */
export const clock = { now: (): number => Date.now() };
export const now = () => clock.now();
