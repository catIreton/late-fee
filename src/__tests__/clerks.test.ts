import { describe, it, expect } from 'vitest';
import { CLERKS } from '../data/clerks';

describe('CLERKS roster', () => {
  it('has exactly 3 clerks', () => {
    expect(CLERKS).toHaveLength(3);
  });

  it('every clerk has a non-empty id', () => {
    CLERKS.forEach(c => expect(c.id.trim().length).toBeGreaterThan(0));
  });

  it('every clerk has a non-empty name', () => {
    CLERKS.forEach(c => expect(c.name.trim().length).toBeGreaterThan(0));
  });

  it('every clerk has a non-empty title and description', () => {
    CLERKS.forEach(c => {
      expect(c.title.trim().length).toBeGreaterThan(0);
      expect(c.description.trim().length).toBeGreaterThan(0);
    });
  });

  it('every clerk has a valid hex color', () => {
    CLERKS.forEach(c => {
      expect(c.color).toBeGreaterThanOrEqual(0);
      expect(c.color).toBeLessThanOrEqual(0xffffff);
    });
  });

  it('clerk ids are unique', () => {
    const ids = CLERKS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers all three bonus types', () => {
    const bonusTypes = new Set(CLERKS.map(c => c.bonus.type));
    expect(bonusTypes.has('genre_match')).toBe(true);
    expect(bonusTypes.has('patience')).toBe(true);
    expect(bonusTypes.has('speed')).toBe(true);
  });

  it('genre_match multiplier is > 1', () => {
    const buff = CLERKS.find(c => c.bonus.type === 'genre_match')!;
    const b = buff.bonus as Extract<typeof buff.bonus, { type: 'genre_match' }>;
    expect(b.multiplier).toBeGreaterThan(1);
  });

  it('patience extraMs is positive', () => {
    const pleaser = CLERKS.find(c => c.bonus.type === 'patience')!;
    const b = pleaser.bonus as Extract<typeof pleaser.bonus, { type: 'patience' }>;
    expect(b.extraMs).toBeGreaterThan(0);
  });

  it('speed reductionMs is positive', () => {
    const runner = CLERKS.find(c => c.bonus.type === 'speed')!;
    const b = runner.bonus as Extract<typeof runner.bonus, { type: 'speed' }>;
    expect(b.reductionMs).toBeGreaterThan(0);
  });
});
