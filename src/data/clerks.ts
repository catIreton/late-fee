import type { Clerk } from '../types';

export const CLERKS: Clerk[] = [
  {
    id: 'alex',
    name: 'Alex',
    title: 'The Movie Buff',
    description: 'Genre-match bonus is 50% higher',
    color: 0x4a90d9,
    bonus: { type: 'genre_match', multiplier: 1.5 },
  },
  {
    id: 'sam',
    name: 'Sam',
    title: 'The People Pleaser',
    description: 'Customers wait 8 seconds longer',
    color: 0x5cb85c,
    bonus: { type: 'patience', extraMs: 8000 },
  },
  {
    id: 'chris',
    name: 'Chris',
    title: 'The Speed Runner',
    description: 'Customers arrive 200 ms faster',
    color: 0xff6600,
    bonus: { type: 'speed', reductionMs: 200 },
  },
];
