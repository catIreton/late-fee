import { describe, it, expect } from 'vitest';
import { pickMovie, getInitialCheckedOut, availableCount } from '../utils/inventory';
import { MOVIES } from '../data/movies';
import type { Movie } from '../types';

// Deterministic RNG helpers
const always0  = () => 0;      // always picks first element / always < 0.5 (genre branch)
const always1  = () => 0.9999; // always >= 0.5 (skip genre branch) + picks last element

describe('getInitialCheckedOut', () => {
  it('returns a Set of the requested size', () => {
    const co = getInitialCheckedOut(MOVIES, 4, always0);
    expect(co.size).toBe(4);
  });

  it('returns only titles that exist in the movie list', () => {
    const co = getInitialCheckedOut(MOVIES, 5, always0);
    co.forEach(title => {
      expect(MOVIES.some(m => m.title === title)).toBe(true);
    });
  });

  it('handles count = 0', () => {
    expect(getInitialCheckedOut(MOVIES, 0, always0).size).toBe(0);
  });

  it('does not exceed the number of movies', () => {
    const co = getInitialCheckedOut(MOVIES, 9999, always0);
    expect(co.size).toBe(MOVIES.length);
  });
});

describe('pickMovie', () => {
  it('returns null when all movies are checked out', () => {
    const allOut = new Set(MOVIES.map(m => m.title));
    expect(pickMovie(MOVIES, allOut, 'Action', always0)).toBeNull();
  });

  it('returns a Movie when movies are available', () => {
    const result = pickMovie(MOVIES, new Set(), 'Action', always0);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('title');
    expect(result).toHaveProperty('genre');
    expect(result).toHaveProperty('year');
  });

  it('result is always from the available (non-checked-out) pool', () => {
    const checkedOut = new Set(['Speed', 'Terminator 2: Judgment Day']);
    for (let i = 0; i < 20; i++) {
      const result = pickMovie(MOVIES, checkedOut, 'Action', Math.random);
      expect(checkedOut.has(result!.title)).toBe(false);
    }
  });

  it('prefers genre match when rng < 0.5', () => {
    // always0 makes rng() return 0 → genre branch taken
    const result = pickMovie(MOVIES, new Set(), 'Action', always0);
    expect(result!.genre).toBe('Action');
  });

  it('can return non-genre movie when rng >= 0.5', () => {
    // always1 makes rng() return ~1 → genre branch skipped
    // runs many times; at least one result should be non-Action
    const results = Array.from({ length: 50 }, () =>
      pickMovie(MOVIES, new Set(), 'Action', always1),
    );
    const hasNonAction = results.some(m => m?.genre !== 'Action');
    expect(hasNonAction).toBe(true);
  });

  it('falls back to any available movie when genre has no matches', () => {
    const rareGenreHint = 'NonExistentGenre';
    const result = pickMovie(MOVIES, new Set(), rareGenreHint, always0);
    expect(result).not.toBeNull();
  });
});

describe('availableCount', () => {
  it('returns total when nothing checked out', () => {
    expect(availableCount(MOVIES, new Set())).toBe(MOVIES.length);
  });

  it('decreases by the number checked out', () => {
    const checkedOut = new Set(['Speed', 'Home Alone', 'Clerks']);
    expect(availableCount(MOVIES, checkedOut)).toBe(MOVIES.length - 3);
  });

  it('returns 0 when everything is checked out', () => {
    const allOut = new Set(MOVIES.map(m => m.title));
    expect(availableCount(MOVIES, allOut)).toBe(0);
  });
});
