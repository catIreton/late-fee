import { describe, it, expect } from 'vitest';
import {
  getRepTier, repPatienceBonus, addRep,
  REP_SERVE, REP_WAIVE_FEE, REP_COLLECT, REP_MISS,
} from '../utils/reputation';

describe('getRepTier', () => {
  it('returns New Hire for 0 rep', () => {
    expect(getRepTier(0)).toBe('New Hire');
  });

  it('returns New Hire below 5', () => {
    expect(getRepTier(4)).toBe('New Hire');
  });

  it('returns Regular at 5', () => {
    expect(getRepTier(5)).toBe('Regular');
  });

  it('returns Trusted at 15', () => {
    expect(getRepTier(15)).toBe('Trusted');
  });

  it('returns Local Legend at 30', () => {
    expect(getRepTier(30)).toBe('Local Legend');
  });

  it('returns Local Legend above 30', () => {
    expect(getRepTier(100)).toBe('Local Legend');
  });
});

describe('repPatienceBonus', () => {
  it('returns 0 for New Hire tier', () => {
    expect(repPatienceBonus(0)).toBe(0);
  });

  it('returns > 0 for Regular tier', () => {
    expect(repPatienceBonus(5)).toBeGreaterThan(0);
  });

  it('increases with tier', () => {
    expect(repPatienceBonus(15)).toBeGreaterThan(repPatienceBonus(5));
    expect(repPatienceBonus(30)).toBeGreaterThan(repPatienceBonus(15));
  });
});

describe('addRep', () => {
  it('adds positive delta', () => {
    expect(addRep(10, REP_SERVE)).toBe(10 + REP_SERVE);
  });

  it('applies waive-fee bonus', () => {
    expect(addRep(0, REP_WAIVE_FEE)).toBe(REP_WAIVE_FEE);
  });

  it('collect-fee gives smaller rep than waiving', () => {
    expect(REP_COLLECT).toBeLessThan(REP_WAIVE_FEE);
  });

  it('subtracts miss penalty', () => {
    const before = 10;
    const after  = addRep(before, REP_MISS);
    expect(after).toBeLessThan(before);
  });

  it('clamps to 0 — never negative', () => {
    expect(addRep(0, -100)).toBe(0);
    expect(addRep(0, REP_MISS)).toBe(0);
  });

  it('chaining multiple serves increases reputation', () => {
    let rep = 0;
    for (let i = 0; i < 5; i++) rep = addRep(rep, REP_SERVE);
    expect(rep).toBe(5 * REP_SERVE);
  });
});
