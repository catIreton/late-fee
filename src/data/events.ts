import type { RandomEventDef } from '../types';

export const RANDOM_EVENTS: RandomEventDef[] = [
  {
    id: 'late_rush',
    name: 'LATE RUSH',
    banner: 'Friday night rush — customers pouring in!',
    effect: { type: 'spawn_boost', factor: 1.8 },
    durationMs: 0, // whole shift
  },
  {
    id: 'holiday_weekend',
    name: 'HOLIDAY WEEKEND',
    banner: 'Holiday weekend — everyone wants a movie!',
    effect: { type: 'earnings_boost', factor: 1.5 },
    durationMs: 0, // whole shift
  },
  {
    id: 'difficult_customer',
    name: 'DIFFICULT CUSTOMER',
    banner: '"The Arguer" is in — next customer has very little patience.',
    effect: { type: 'patience_drain', reductionMs: 14000 },
    durationMs: 0, // consumed on next customer spawn
  },
  {
    id: 'summer_rush',
    name: 'SUMMER RUSH',
    banner: "School's out — it's a packed house tonight!",
    effect: { type: 'spawn_boost', factor: 1.4 },
    durationMs: 0,
  },
];
