import type { Achievement } from '../types';

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'hot_streak',
    name: 'Hot Streak',
    description: 'Reach a 3× streak',
  },
  {
    id: 'on_fire',
    name: 'On Fire!',
    description: 'Reach a 5× streak',
  },
  {
    id: 'vhs_legend',
    name: 'VHS Legend',
    description: 'Reach a 10× streak',
  },
  {
    id: 'genre_master',
    name: 'Genre Master',
    description: 'Serve all 10 genres in one shift',
  },
  {
    id: 'clean_sheet',
    name: 'Clean Sheet',
    description: 'Complete a shift with 5+ rentals and zero misses',
  },
  {
    id: 'fee_collector',
    name: 'Late Fee King',
    description: 'Collect 5 late fees across your career',
  },
  {
    id: 'special_touch',
    name: 'Daily Special',
    description: "Rent today's featured title to a customer",
  },
  {
    id: 'regular_hero',
    name: 'Regular Hero',
    description: 'Serve the same customer on 3 separate visits',
  },
];
