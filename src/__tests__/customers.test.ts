import { describe, it, expect } from 'vitest';
import { CUSTOMERS } from '../data/customers';
import { MOVIES } from '../data/movies';

const MOVIE_GENRES = new Set(MOVIES.map(m => m.genre));

describe('CUSTOMERS roster', () => {
  it('has at least 20 entries', () => {
    expect(CUSTOMERS.length).toBeGreaterThanOrEqual(20);
  });

  it('every entry has a non-empty name', () => {
    CUSTOMERS.forEach(c => expect(c.name.trim().length).toBeGreaterThan(0));
  });

  it('every entry has a non-empty dialogue', () => {
    CUSTOMERS.forEach(c => expect(c.dialogue.trim().length).toBeGreaterThan(0));
  });

  it('every entry has a valid hex color', () => {
    CUSTOMERS.forEach(c => {
      expect(c.color).toBeGreaterThanOrEqual(0);
      expect(c.color).toBeLessThanOrEqual(0xffffff);
    });
  });

  it('every genreHint maps to a genre in the movie catalog', () => {
    CUSTOMERS.forEach(c => {
      expect(
        MOVIE_GENRES.has(c.genreHint),
        `${c.name} has genreHint "${c.genreHint}" with no matching movies`,
      ).toBe(true);
    });
  });

  it('wantedTitle (when present) matches an actual movie title', () => {
    const titles = new Set(MOVIES.map(m => m.title));
    CUSTOMERS.filter(c => c.wantedTitle !== undefined).forEach(c => {
      expect(
        titles.has(c.wantedTitle!),
        `${c.name}.wantedTitle "${c.wantedTitle}" not found in movie catalog`,
      ).toBe(true);
    });
  });

  it('wantedTitle (when present) is in the correct genre for that customer', () => {
    CUSTOMERS.filter(c => c.wantedTitle !== undefined).forEach(c => {
      const movie = MOVIES.find(m => m.title === c.wantedTitle)!;
      expect(
        movie.genre.toLowerCase(),
        `${c.name}.wantedTitle "${c.wantedTitle}" genre mismatch`,
      ).toBe(c.genreHint.toLowerCase());
    });
  });

  it('no duplicate names', () => {
    const names = CUSTOMERS.map(c => c.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('covers at least 6 distinct genre hints', () => {
    const hints = new Set(CUSTOMERS.map(c => c.genreHint));
    expect(hints.size).toBeGreaterThanOrEqual(6);
  });
});
