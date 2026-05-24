import { describe, it, expect } from 'vitest';
import { rollShiftEvent, applySpawnBoost, applyPatienceDrain } from '../utils/events';
import { RANDOM_EVENTS } from '../data/events';
import type { RandomEventDef } from '../types';

describe('rollShiftEvent', () => {
  it('returns null when rng >= 0.40', () => {
    expect(rollShiftEvent(() => 0.40)).toBeNull();
    expect(rollShiftEvent(() => 0.99)).toBeNull();
  });

  it('returns an event when rng < 0.40', () => {
    const event = rollShiftEvent(() => 0.0);
    expect(event).not.toBeNull();
    expect(RANDOM_EVENTS.map(e => e.id)).toContain(event!.id);
  });

  it('returns a valid event from the catalog', () => {
    const event = rollShiftEvent(() => 0.39);
    expect(event).not.toBeNull();
    expect(event!.name.length).toBeGreaterThan(0);
    expect(event!.banner.length).toBeGreaterThan(0);
  });

  it('selects different events based on rng index', () => {
    // rng = 0 → always picks index 0
    const first = rollShiftEvent(() => 0);
    // rng alternates — second call selects event index
    let callCount = 0;
    const event = rollShiftEvent(() => {
      callCount++;
      // First call (threshold check) = 0.0 (< 0.40), second (index) = 0.5
      return callCount === 1 ? 0.0 : 0.5;
    });
    expect(first).not.toBeNull();
    expect(event).not.toBeNull();
  });
});

describe('applySpawnBoost', () => {
  const spawnEvent: RandomEventDef = {
    id: 'late_rush', name: 'LATE RUSH', banner: '',
    effect: { type: 'spawn_boost', factor: 2.0 }, durationMs: 0,
  };

  it('halves delay when factor is 2', () => {
    const [min, max] = applySpawnBoost([800, 1400], spawnEvent);
    expect(min).toBe(400);
    expect(max).toBe(700);
  });

  it('no change when event is null', () => {
    const [min, max] = applySpawnBoost([800, 1400], null);
    expect(min).toBe(800);
    expect(max).toBe(1400);
  });

  it('no change for non-spawn event', () => {
    const earningsEvent: RandomEventDef = {
      id: 'holiday_weekend', name: '', banner: '',
      effect: { type: 'earnings_boost', factor: 1.5 }, durationMs: 0,
    };
    const [min, max] = applySpawnBoost([800, 1400], earningsEvent);
    expect(min).toBe(800);
    expect(max).toBe(1400);
  });

  it('min remains less than max after boost', () => {
    const [min, max] = applySpawnBoost([500, 1000], spawnEvent);
    expect(min).toBeLessThan(max);
  });
});

describe('applyPatienceDrain', () => {
  const drainEvent: RandomEventDef = {
    id: 'difficult_customer', name: 'DIFFICULT CUSTOMER', banner: '',
    effect: { type: 'patience_drain', reductionMs: 14000 }, durationMs: 0,
  };

  it('reduces patience by the drain amount', () => {
    expect(applyPatienceDrain(25000, drainEvent)).toBe(11000);
  });

  it('clamps patience to minimum 5000 ms', () => {
    expect(applyPatienceDrain(10000, drainEvent)).toBe(5000);
  });

  it('no change when event is null', () => {
    expect(applyPatienceDrain(25000, null)).toBe(25000);
  });

  it('no change for non-patience event', () => {
    const spawnEvent: RandomEventDef = {
      id: 'late_rush', name: '', banner: '',
      effect: { type: 'spawn_boost', factor: 1.8 }, durationMs: 0,
    };
    expect(applyPatienceDrain(25000, spawnEvent)).toBe(25000);
  });
});
