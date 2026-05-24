import type { RandomEventDef } from '../types';
import { RANDOM_EVENTS } from '../data/events';

/**
 * Optionally roll a random event for the shift (40% chance).
 * Accepts an rng so it's deterministic in tests.
 */
export function rollShiftEvent(rng: () => number = Math.random): RandomEventDef | null {
  if (rng() >= 0.40) return null;
  return RANDOM_EVENTS[Math.floor(rng() * RANDOM_EVENTS.length)];
}

/** Apply a spawn_boost event to a spawn delay range. */
export function applySpawnBoost(
  delay: [number, number],
  event: RandomEventDef | null,
): [number, number] {
  if (!event || event.effect.type !== 'spawn_boost') return delay;
  const f = event.effect.factor;
  return [
    Math.round(delay[0] / f),
    Math.round(delay[1] / f),
  ];
}

/** Apply a patience_drain event to a base patience value (ms). */
export function applyPatienceDrain(
  patienceMs: number,
  event: RandomEventDef | null,
): number {
  if (!event || event.effect.type !== 'patience_drain') return patienceMs;
  return Math.max(5_000, patienceMs - event.effect.reductionMs);
}
