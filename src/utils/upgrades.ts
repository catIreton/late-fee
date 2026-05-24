const LS_UPGRADES = 'lateFee_upgrades';

export function loadUpgrades(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_UPGRADES);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

export function saveUpgrades(ids: Set<string>): void {
  try { localStorage.setItem(LS_UPGRADES, JSON.stringify([...ids])); }
  catch { /* storage unavailable */ }
}
