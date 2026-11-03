export const CARE_TASKS = ['water', 'fertilize', 'mist', 'rotate', 'clean', 'repot'] as const;
export type CareTask = (typeof CARE_TASKS)[number];

export const LIGHT_LEVELS = ['low', 'medium', 'bright', 'direct'] as const;
export type LightLevel = (typeof LIGHT_LEVELS)[number];

export type Hemisphere = 'north' | 'south';

/** A place plants live: a room, a windowsill, the balcony. */
export interface Site {
  id: string;
  name: string;
  light: LightLevel;
  indoor: boolean;
  createdAt: string;
}

export interface Plant {
  id: string;
  siteId: string | null;
  nickname: string;
  /** Key into the bundled species catalog, or null for a custom plant. */
  speciesId: string | null;
  /** Display name of the species (from the catalog or typed by the user). */
  speciesName: string;
  /** Local file URI, or a storage path when synced to Supabase. */
  photo: string | null;
  potDiameterCm: number | null;
  hasDrainage: boolean;
  notes: string;
  createdAt: string;
}

export interface CareSchedule {
  id: string;
  plantId: string;
  task: CareTask;
  /** Base interval in days, before seasonal adjustment. */
  intervalDays: number;
  lastDoneAt: string | null;
  nextDueAt: string;
  enabled: boolean;
}

export type CareAction = 'done' | 'postponed' | 'skipped';

export interface CareLog {
  id: string;
  plantId: string;
  task: CareTask;
  action: CareAction;
  at: string;
  /** Display name of whoever did it. */
  by: string | null;
  note: string;
}

export interface JournalEntry {
  id: string;
  plantId: string;
  photo: string | null;
  note: string;
  at: string;
}

export interface GardenData {
  sites: Site[];
  plants: Plant[];
  schedules: CareSchedule[];
  logs: CareLog[];
  journal: JournalEntry[];
}

export interface Preferences {
  reminderHour: number;
  reminderMinute: number;
  hemisphere: Hemisphere;
  /** ISO date; while in the future, reminders are paused. */
  vacationUntil: string | null;
  displayName: string;
}

export const DEFAULT_PREFERENCES: Preferences = {
  reminderHour: 9,
  reminderMinute: 0,
  hemisphere: 'north',
  vacationUntil: null,
  displayName: '',
};

export const EMPTY_GARDEN: GardenData = {
  sites: [],
  plants: [],
  schedules: [],
  logs: [],
  journal: [],
};
