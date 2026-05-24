import type { Upgrade } from '../types';

export const UPGRADES: Upgrade[] = [
  {
    id: 'speed',
    name: 'Speedy Service',
    description: 'Transaction animations 200 ms faster',
    cost: 8,
  },
  {
    id: 'genre_guide',
    name: 'Genre Guide',
    description: "Customer cards show their genre preference",
    cost: 10,
  },
  {
    id: 'stocked_shelves',
    name: 'Stocked Shelves',
    description: 'Start each shift with 2 fewer tapes checked out',
    cost: 12,
  },
];
