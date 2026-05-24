import type { Clerk, RandomEventDef } from '../types';

export const BASE_RENTAL_FEE     = 3.00;
export const GENRE_MATCH_BONUS   = 1.50;
export const STREAK_THRESHOLD    = 3;
export const STREAK_MULTIPLIER   = 1.5;
export const LATE_FEE_AMOUNT     = 2.00;
export const DAILY_SPECIAL_BONUS = 2.00;
export const BASE_PATIENCE_MS    = 25_000;

export function isGenreMatch(movieGenre: string, genreHint: string): boolean {
  return movieGenre.toLowerCase() === genreHint.toLowerCase();
}

export function calcEarnings(genreMatch: boolean, streak: number): number {
  const base = BASE_RENTAL_FEE + (genreMatch ? GENRE_MATCH_BONUS : 0);
  const mult = streak >= STREAK_THRESHOLD ? STREAK_MULTIPLIER : 1.0;
  return parseFloat((base * mult).toFixed(2));
}

export function applyClerkBonus(
  earnings: number,
  clerk: Clerk | null,
  genreMatch: boolean,
): number {
  if (!clerk || clerk.bonus.type !== 'genre_match' || !genreMatch) return earnings;
  return parseFloat((earnings * clerk.bonus.multiplier).toFixed(2));
}

export function applyEventBonus(earnings: number, event: RandomEventDef | null): number {
  if (!event || event.effect.type !== 'earnings_boost') return earnings;
  return parseFloat((earnings * event.effect.factor).toFixed(2));
}

export function calcLateFee(collect: boolean): number {
  return collect ? LATE_FEE_AMOUNT : 0;
}

export function calcDailySpecialBonus(title: string, specials: string[]): number {
  return specials.includes(title) ? DAILY_SPECIAL_BONUS : 0;
}

export function getShiftConfig(shiftNumber: number): {
  durationSeconds: number;
  initialCheckedOut: number;
  patienceMs: number;
  spawnFactor: number;
} {
  const n = shiftNumber - 1;
  return {
    durationSeconds: 120,
    initialCheckedOut: Math.min(4 + n * 2, 12),
    patienceMs: Math.max(BASE_PATIENCE_MS - n * 3_000, 12_000),
    spawnFactor: 1 + n * 0.15,
  };
}

export function spawnDelay(timeLeft: number, spawnFactor = 1): [number, number] {
  const elapsed = 120 - timeLeft;
  let [min, max]: [number, number] =
    elapsed < 45 ? [800, 1400] :
    elapsed < 90 ? [500, 1000] :
                   [250,  650];
  min  = Math.round(min  / spawnFactor);
  max  = Math.round(max  / spawnFactor);
  return [min, max];
}
