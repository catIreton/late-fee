import { describe, it, expect } from 'vitest';
import { UPGRADES } from '../data/upgrades';

const EXPECTED_IDS = ['speed', 'genre_guide', 'stocked_shelves'] as const;

describe('UPGRADES catalog', () => {
  it('has exactly 3 upgrades', () => {
    expect(UPGRADES).toHaveLength(3);
  });

  it('every upgrade has a non-empty id, name, and description', () => {
    UPGRADES.forEach(u => {
      expect(u.id.trim().length).toBeGreaterThan(0);
      expect(u.name.trim().length).toBeGreaterThan(0);
      expect(u.description.trim().length).toBeGreaterThan(0);
    });
  });

  it('every upgrade has a positive cost', () => {
    UPGRADES.forEach(u => expect(u.cost).toBeGreaterThan(0));
  });

  it('upgrade ids are unique', () => {
    const ids = UPGRADES.map(u => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contains the expected ids that GameScene references by string', () => {
    const ids = new Set(UPGRADES.map(u => u.id));
    EXPECTED_IDS.forEach(id => {
      expect(ids.has(id), `upgrade id "${id}" missing from catalog`).toBe(true);
    });
  });
});
