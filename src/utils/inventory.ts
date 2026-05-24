import type { Movie } from '../types';

export function getInitialCheckedOut(
  movies: Movie[],
  count: number,
  rng: () => number = Math.random,
): Set<string> {
  const shuffled = [...movies].sort(() => rng() - 0.5);
  return new Set(shuffled.slice(0, count).map(m => m.title));
}

export function pickMovie(
  movies: Movie[],
  checkedOut: Set<string>,
  genreHint: string,
  rng: () => number = Math.random,
): Movie | null {
  const available = movies.filter(m => !checkedOut.has(m.title));
  if (available.length === 0) return null;

  const genrePool = available.filter(
    m => m.genre.toLowerCase() === genreHint.toLowerCase(),
  );

  // 50/50 chance of surfacing a genre match when one exists
  const pool = genrePool.length > 0 && rng() < 0.5 ? genrePool : available;
  return pool[Math.floor(rng() * pool.length)];
}

export function availableCount(movies: Movie[], checkedOut: Set<string>): number {
  return movies.filter(m => !checkedOut.has(m.title)).length;
}
