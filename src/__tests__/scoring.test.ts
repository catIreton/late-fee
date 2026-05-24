import { describe, it, expect } from 'vitest';
import {
  calcEarnings, isGenreMatch, spawnDelay,
  applyClerkBonus, applyEventBonus,
  calcLateFee, calcDailySpecialBonus,
  getShiftConfig,
  BASE_RENTAL_FEE, GENRE_MATCH_BONUS,
  STREAK_MULTIPLIER, STREAK_THRESHOLD,
  LATE_FEE_AMOUNT, DAILY_SPECIAL_BONUS, BASE_PATIENCE_MS,
} from '../utils/scoring';
import type { Clerk, RandomEventDef } from '../types';

// ── isGenreMatch ──────────────────────────────────────────────────────────────
describe('isGenreMatch', () => {
  it('returns true for identical genre strings', () => {
    expect(isGenreMatch('Action', 'Action')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isGenreMatch('action', 'Action')).toBe(true);
    expect(isGenreMatch('SCI-FI', 'sci-fi')).toBe(true);
  });

  it('returns false for different genres', () => {
    expect(isGenreMatch('Comedy', 'Horror')).toBe(false);
  });
});

// ── calcEarnings ──────────────────────────────────────────────────────────────
describe('calcEarnings', () => {
  it('base rental with no match, no streak', () => {
    expect(calcEarnings(false, 0)).toBe(BASE_RENTAL_FEE);
  });

  it('adds genre match bonus', () => {
    expect(calcEarnings(true, 0)).toBe(BASE_RENTAL_FEE + GENRE_MATCH_BONUS);
  });

  it('applies streak multiplier at threshold', () => {
    expect(calcEarnings(false, STREAK_THRESHOLD)).toBe(
      parseFloat((BASE_RENTAL_FEE * STREAK_MULTIPLIER).toFixed(2)),
    );
  });

  it('streak below threshold gets no multiplier', () => {
    expect(calcEarnings(false, STREAK_THRESHOLD - 1)).toBe(BASE_RENTAL_FEE);
  });

  it('genre match + streak multiplier stacks correctly', () => {
    const expected = parseFloat(
      ((BASE_RENTAL_FEE + GENRE_MATCH_BONUS) * STREAK_MULTIPLIER).toFixed(2),
    );
    expect(calcEarnings(true, STREAK_THRESHOLD)).toBe(expected);
  });

  it('returns a value rounded to 2 decimal places', () => {
    const result = calcEarnings(true, STREAK_THRESHOLD);
    expect(result.toString()).toMatch(/^\d+\.\d{2}$/);
  });
});

// ── spawnDelay ────────────────────────────────────────────────────────────────
describe('spawnDelay', () => {
  it('early shift returns slow bracket', () => {
    const [min, max] = spawnDelay(110); // 10s elapsed
    expect(min).toBe(800);
    expect(max).toBe(1400);
  });

  it('mid shift returns medium bracket', () => {
    const [min, max] = spawnDelay(60); // 60s elapsed
    expect(min).toBe(500);
    expect(max).toBe(1000);
  });

  it('late shift returns fast bracket', () => {
    const [min, max] = spawnDelay(20); // 100s elapsed
    expect(min).toBe(250);
    expect(max).toBe(650);
  });

  it('min is always less than max', () => {
    [120, 90, 60, 30, 0].forEach(t => {
      const [min, max] = spawnDelay(t);
      expect(min).toBeLessThan(max);
    });
  });

  it('spawnFactor > 1 shortens delays', () => {
    const [baseMin, baseMax] = spawnDelay(110, 1);
    const [fastMin, fastMax] = spawnDelay(110, 2);
    expect(fastMin).toBeLessThan(baseMin);
    expect(fastMax).toBeLessThan(baseMax);
  });
});

// ── applyClerkBonus ───────────────────────────────────────────────────────────
describe('applyClerkBonus', () => {
  const movieBuffClerk: Clerk = {
    id: 'alex', name: 'Alex', title: 'Movie Buff', description: '',
    color: 0x4a90d9, bonus: { type: 'genre_match', multiplier: 1.5 },
  };

  it('multiplies earnings when genreMatch and clerk is movie buff', () => {
    const base = calcEarnings(true, 0);
    expect(applyClerkBonus(base, movieBuffClerk, true)).toBe(
      parseFloat((base * 1.5).toFixed(2)),
    );
  });

  it('no bonus when genreMatch is false', () => {
    const base = calcEarnings(false, 0);
    expect(applyClerkBonus(base, movieBuffClerk, false)).toBe(base);
  });

  it('no bonus for patience/speed clerk types', () => {
    const patienceClerk: Clerk = {
      id: 'sam', name: 'Sam', title: 'People Pleaser', description: '',
      color: 0x5cb85c, bonus: { type: 'patience', extraMs: 8000 },
    };
    const base = calcEarnings(true, 0);
    expect(applyClerkBonus(base, patienceClerk, true)).toBe(base);
  });

  it('no bonus when clerk is null', () => {
    const base = calcEarnings(true, 0);
    expect(applyClerkBonus(base, null, true)).toBe(base);
  });
});

// ── applyEventBonus ───────────────────────────────────────────────────────────
describe('applyEventBonus', () => {
  const holidayEvent: RandomEventDef = {
    id: 'holiday_weekend', name: 'HOLIDAY WEEKEND', banner: '',
    effect: { type: 'earnings_boost', factor: 1.5 }, durationMs: 0,
  };

  it('multiplies earnings for earnings_boost event', () => {
    const base = 3.00;
    expect(applyEventBonus(base, holidayEvent)).toBe(
      parseFloat((base * 1.5).toFixed(2)),
    );
  });

  it('no change for non-earnings event', () => {
    const spawnEvent: RandomEventDef = {
      id: 'late_rush', name: 'LATE RUSH', banner: '',
      effect: { type: 'spawn_boost', factor: 1.8 }, durationMs: 0,
    };
    expect(applyEventBonus(3.00, spawnEvent)).toBe(3.00);
  });

  it('no change when event is null', () => {
    expect(applyEventBonus(3.00, null)).toBe(3.00);
  });
});

// ── calcLateFee ───────────────────────────────────────────────────────────────
describe('calcLateFee', () => {
  it('returns LATE_FEE_AMOUNT when collecting', () => {
    expect(calcLateFee(true)).toBe(LATE_FEE_AMOUNT);
  });

  it('returns 0 when waiving', () => {
    expect(calcLateFee(false)).toBe(0);
  });
});

// ── calcDailySpecialBonus ─────────────────────────────────────────────────────
describe('calcDailySpecialBonus', () => {
  const specials = ['Clerks', 'Speed'];

  it('returns DAILY_SPECIAL_BONUS for a special title', () => {
    expect(calcDailySpecialBonus('Clerks', specials)).toBe(DAILY_SPECIAL_BONUS);
  });

  it('returns 0 for non-special titles', () => {
    expect(calcDailySpecialBonus('Home Alone', specials)).toBe(0);
  });

  it('returns 0 for empty specials list', () => {
    expect(calcDailySpecialBonus('Clerks', [])).toBe(0);
  });
});

// ── getShiftConfig ────────────────────────────────────────────────────────────
describe('getShiftConfig', () => {
  it('shift 1 has base values', () => {
    const cfg = getShiftConfig(1);
    expect(cfg.durationSeconds).toBe(120);
    expect(cfg.initialCheckedOut).toBe(4);
    expect(cfg.patienceMs).toBe(BASE_PATIENCE_MS);
    expect(cfg.spawnFactor).toBeCloseTo(1.0);
  });

  it('later shifts have more checked out tapes', () => {
    const s1 = getShiftConfig(1);
    const s3 = getShiftConfig(3);
    expect(s3.initialCheckedOut).toBeGreaterThan(s1.initialCheckedOut);
  });

  it('later shifts have less patience', () => {
    const s1 = getShiftConfig(1);
    const s4 = getShiftConfig(4);
    expect(s4.patienceMs).toBeLessThan(s1.patienceMs);
  });

  it('patience never drops below 12000 ms', () => {
    const big = getShiftConfig(20);
    expect(big.patienceMs).toBeGreaterThanOrEqual(12_000);
  });

  it('initialCheckedOut is capped at 12', () => {
    const big = getShiftConfig(20);
    expect(big.initialCheckedOut).toBeLessThanOrEqual(12);
  });

  it('spawnFactor increases with shift number', () => {
    const s1 = getShiftConfig(1);
    const s5 = getShiftConfig(5);
    expect(s5.spawnFactor).toBeGreaterThan(s1.spawnFactor);
  });
});
