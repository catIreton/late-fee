import { describe, it, expect } from 'vitest';
import { MOVIES } from '../data/movies';

const VALID_GENRES = new Set([
  'Action', 'Comedy', 'Drama', 'Crime', 'Sci-Fi',
  'Animation', 'Horror', 'Thriller', 'Romance', 'Western',
]);

describe('MOVIES catalog', () => {
  it('has at least 40 entries', () => {
    expect(MOVIES.length).toBeGreaterThanOrEqual(40);
  });

  it('every entry has a non-empty title', () => {
    MOVIES.forEach(m => expect(m.title.trim().length).toBeGreaterThan(0));
  });

  it('every entry has a valid year (1985–1999)', () => {
    MOVIES.forEach(m => {
      expect(m.year).toBeGreaterThanOrEqual(1985);
      expect(m.year).toBeLessThanOrEqual(1999);
    });
  });

  it('every entry has a recognised genre', () => {
    MOVIES.forEach(m => {
      expect(VALID_GENRES.has(m.genre), `"${m.title}" has unknown genre "${m.genre}"`).toBe(true);
    });
  });

  it('no duplicate titles', () => {
    const titles = MOVIES.map(m => m.title);
    const unique = new Set(titles);
    expect(unique.size).toBe(titles.length);
  });

  it('has multiple genres represented', () => {
    const genres = new Set(MOVIES.map(m => m.genre));
    expect(genres.size).toBeGreaterThanOrEqual(6);
  });
});
