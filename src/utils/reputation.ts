import type { RepTier } from '../types';

const LS_REP        = 'lateFee_reputation';
const LS_REP_MAP    = 'lateFee_repMap';
const LS_FEES_TOTAL = 'lateFee_totalFees';

export const REP_SERVE     =  1;
export const REP_WAIVE_FEE =  3;
export const REP_COLLECT   =  1;
export const REP_MISS      = -1;

export function getRepTier(rep: number): RepTier {
  if (rep >= 30) return 'Local Legend';
  if (rep >= 15) return 'Trusted';
  if (rep >= 5)  return 'Regular';
  return 'New Hire';
}

/** Rep tier bonus: extra patience ms awarded to the player */
export function repPatienceBonus(rep: number): number {
  const tier = getRepTier(rep);
  if (tier === 'Local Legend') return 5_000;
  if (tier === 'Trusted')      return 3_000;
  if (tier === 'Regular')      return 2_000;
  return 0;
}

export function addRep(current: number, delta: number): number {
  return Math.max(0, current + delta);
}

export function loadReputation(): number {
  try { return parseInt(localStorage.getItem(LS_REP) ?? '0', 10) || 0; }
  catch { return 0; }
}

export function saveReputation(rep: number): void {
  try { localStorage.setItem(LS_REP, rep.toString()); }
  catch { /* storage unavailable */ }
}

export function loadCustomerVisits(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LS_REP_MAP);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch { return {}; }
}

export function saveCustomerVisits(map: Record<string, number>): void {
  try { localStorage.setItem(LS_REP_MAP, JSON.stringify(map)); }
  catch { /* storage unavailable */ }
}

export function loadTotalFeesCollected(): number {
  try { return parseInt(localStorage.getItem(LS_FEES_TOTAL) ?? '0', 10) || 0; }
  catch { return 0; }
}

export function saveTotalFeesCollected(n: number): void {
  try { localStorage.setItem(LS_FEES_TOTAL, n.toString()); }
  catch { /* storage unavailable */ }
}
