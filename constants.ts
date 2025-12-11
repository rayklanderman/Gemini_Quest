import { UserProfile } from "./types";

export const INITIAL_PROFILE: UserProfile = {
  xp: 0,
  level: 1,
  badges: ['Novice Explorer'],
  streak: 1,
};

export const LEVELS = [
  { level: 1, xp: 0, title: 'Novice Explorer' },
  { level: 2, xp: 100, title: 'Lab Assistant' },
  { level: 3, xp: 300, title: 'Field Researcher' },
  { level: 4, xp: 600, title: 'Science Officer' },
  { level: 5, xp: 1000, title: 'Grand Archivist' },
];

export const MOCK_CHART_DATA = [
  { label: 'A', value: 10 },
  { label: 'B', value: 20 },
];
