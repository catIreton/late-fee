import { describe, it, expect } from 'vitest';
import { checkAchievements, getAchievementName } from '../utils/achievements';
import type { ShiftStats } from '../types';

function blankStats(): ShiftStats {
  return {
    rentals: 0, misses: 0, peakStreak: 0,
    lateFeesCollected: 0, specialRentals: 0,
    genresServed: new Set(), customersServed: new Set(),
  };
}

describe('checkAchievements', () => {
  it('returns hot_streak when peakStreak >= 3', () => {
    const stats = { ...blankStats(), peakStreak: 3 };
    const ids = checkAchievements(stats, new Set());
    expect(ids).toContain('hot_streak');
  });

  it('does not return hot_streak when already earned', () => {
    const stats = { ...blankStats(), peakStreak: 3 };
    const ids = checkAchievements(stats, new Set(['hot_streak']));
    expect(ids).not.toContain('hot_streak');
  });

  it('returns on_fire at streak 5', () => {
    const stats = { ...blankStats(), peakStreak: 5 };
    const ids = checkAchievements(stats, new Set());
    expect(ids).toContain('on_fire');
    expect(ids).toContain('hot_streak');
  });

  it('returns vhs_legend at streak 10', () => {
    const stats = { ...blankStats(), peakStreak: 10 };
    const ids = checkAchievements(stats, new Set());
    expect(ids).toContain('vhs_legend');
  });

  it('returns genre_master when all 10 genres served', () => {
    const stats = {
      ...blankStats(),
      genresServed: new Set(['Action', 'Comedy', 'Drama', 'Crime', 'Sci-Fi',
        'Animation', 'Horror', 'Thriller', 'Romance', 'Western']),
    };
    const ids = checkAchievements(stats, new Set());
    expect(ids).toContain('genre_master');
  });

  it('does not return genre_master with only 9 genres', () => {
    const stats = {
      ...blankStats(),
      genresServed: new Set(['Action', 'Comedy', 'Drama', 'Crime', 'Sci-Fi',
        'Animation', 'Horror', 'Thriller', 'Romance']),
    };
    const ids = checkAchievements(stats, new Set());
    expect(ids).not.toContain('genre_master');
  });

  it('returns clean_sheet with 5+ rentals and 0 misses', () => {
    const stats = { ...blankStats(), rentals: 5, misses: 0 };
    const ids = checkAchievements(stats, new Set());
    expect(ids).toContain('clean_sheet');
  });

  it('does not return clean_sheet with a miss', () => {
    const stats = { ...blankStats(), rentals: 5, misses: 1 };
    expect(checkAchievements(stats, new Set())).not.toContain('clean_sheet');
  });

  it('does not return clean_sheet with fewer than 5 rentals', () => {
    const stats = { ...blankStats(), rentals: 4, misses: 0 };
    expect(checkAchievements(stats, new Set())).not.toContain('clean_sheet');
  });

  it('returns fee_collector with 5+ late fees collected', () => {
    const stats = { ...blankStats(), lateFeesCollected: 5 };
    const ids = checkAchievements(stats, new Set());
    expect(ids).toContain('fee_collector');
  });

  it('does not return fee_collector below 5', () => {
    const stats = { ...blankStats(), lateFeesCollected: 4 };
    expect(checkAchievements(stats, new Set())).not.toContain('fee_collector');
  });

  it('returns special_touch after 1 daily special rental', () => {
    const stats = { ...blankStats(), specialRentals: 1 };
    const ids = checkAchievements(stats, new Set());
    expect(ids).toContain('special_touch');
  });

  it('returns empty array when no achievements earned', () => {
    expect(checkAchievements(blankStats(), new Set())).toHaveLength(0);
  });

  it('does not duplicate ids already in earned set', () => {
    const all = new Set([
      'hot_streak', 'on_fire', 'vhs_legend', 'genre_master',
      'clean_sheet', 'fee_collector', 'special_touch',
    ]);
    const stats = {
      rentals: 10, misses: 0, peakStreak: 10, lateFeesCollected: 5,
      specialRentals: 1,
      genresServed: new Set(['Action', 'Comedy', 'Drama', 'Crime', 'Sci-Fi',
        'Animation', 'Horror', 'Thriller', 'Romance', 'Western']),
      customersServed: new Set<string>(),
    };
    expect(checkAchievements(stats, all)).toHaveLength(0);
  });
});

describe('getAchievementName', () => {
  it('returns name for known id', () => {
    expect(getAchievementName('hot_streak')).toBe('Hot Streak');
  });

  it('returns id as fallback for unknown id', () => {
    expect(getAchievementName('unknown_id')).toBe('unknown_id');
  });
});
