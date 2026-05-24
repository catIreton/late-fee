export interface Movie {
  title: string;
  year: number;
  genre: string;
}

export type BehaviorType = 'help-seeker' | 'browser';

export interface CustomerData {
  name: string;
  dialogue: string;
  color: number;
  genreHint: string;
  /** Exact title they name-dropped — picking it earns the +$1.50 bonus */
  wantedTitle?: string;
  /** Browser lingers at shelves before approaching; help-seeker walks straight up */
  behaviorType?: BehaviorType;
  /** Override default patience in ms */
  patience?: number;
  /** Secondary acceptable genre — correct but earns base fee only, no streak increment */
  altGenreHint?: string;
  /** Accepts any 1993+ movie regardless of genre */
  wantsNewRelease?: boolean;
}

// ── Clerk (character select) ──────────────────────────────────────────────────

export type ClerkBonus =
  | { type: 'genre_match'; multiplier: number }   // genre-match earnings ×N
  | { type: 'patience';    extraMs: number }       // +N ms customer patience
  | { type: 'speed';       reductionMs: number };  // arrival animation −N ms

export interface Clerk {
  id: string;
  name: string;
  title: string;
  description: string;
  color: number;
  bonus: ClerkBonus;
}

// ── Upgrades ──────────────────────────────────────────────────────────────────

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
}

// ── Random events ─────────────────────────────────────────────────────────────

export type EventEffect =
  | { type: 'spawn_boost';    factor: number }      // customers arrive N× faster
  | { type: 'earnings_boost'; factor: number }      // all earnings ×N
  | { type: 'patience_drain'; reductionMs: number };// patience −N ms

export interface RandomEventDef {
  id: string;
  name: string;
  banner: string;
  effect: EventEffect;
  /** Shift-wide (0) or limited duration in ms */
  durationMs: number;
}

// ── Achievements ──────────────────────────────────────────────────────────────

export interface Achievement {
  id: string;
  name: string;
  description: string;
}

// ── Shift stats (for achievement checks) ─────────────────────────────────────

export interface ShiftStats {
  rentals: number;
  misses: number;
  peakStreak: number;
  lateFeesCollected: number;
  specialRentals: number;
  genresServed: Set<string>;
  customersServed: Set<string>;
}

// ── Reputation ────────────────────────────────────────────────────────────────

export type RepTier = 'New Hire' | 'Regular' | 'Trusted' | 'Local Legend';
