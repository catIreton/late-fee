import type { ShiftStats } from '../types';
import { ACHIEVEMENTS } from '../data/achievements';

const LS_ACHIEVEMENTS = 'lateFee_achievements';

export function checkAchievements(
  stats: ShiftStats,
  earnedIds: Set<string>,
): string[] {
  return ACHIEVEMENTS
    .filter(a => !earnedIds.has(a.id) && isEarned(a.id, stats))
    .map(a => a.id);
}

function isEarned(id: string, s: ShiftStats): boolean {
  switch (id) {
    case 'hot_streak':    return s.peakStreak >= 3;
    case 'on_fire':       return s.peakStreak >= 5;
    case 'vhs_legend':    return s.peakStreak >= 10;
    case 'genre_master':  return s.genresServed.size >= 10;
    case 'clean_sheet':   return s.misses === 0 && s.rentals >= 5;
    case 'fee_collector': return s.lateFeesCollected >= 5;
    case 'special_touch': return s.specialRentals >= 1;
    default:              return false;
  }
}

export function loadEarnedAchievements(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_ACHIEVEMENTS);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}

export function saveEarnedAchievements(ids: Set<string>): void {
  try { localStorage.setItem(LS_ACHIEVEMENTS, JSON.stringify([...ids])); }
  catch { /* storage unavailable */ }
}

export function getAchievementName(id: string): string {
  return ACHIEVEMENTS.find(a => a.id === id)?.name ?? id;
}
