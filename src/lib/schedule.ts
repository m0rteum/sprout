import type { Species } from '../data/species';
import type { CareSchedule, CareTask, Hemisphere, LightLevel, Site } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);
}

/** Dormant season: Nov–Feb in the north, May–Aug in the south. */
export function isDormantSeason(d: Date, hemisphere: Hemisphere): boolean {
  const m = d.getMonth();
  return hemisphere === 'north' ? m >= 10 || m <= 1 : m >= 4 && m <= 7;
}

/** First day of the next growing season after `d`. */
export function nextGrowingSeasonStart(d: Date, hemisphere: Hemisphere): Date {
  const startMonth = hemisphere === 'north' ? 2 : 8; // March or September
  const candidate = new Date(d.getFullYear(), startMonth, 1);
  return candidate.getTime() > d.getTime()
    ? candidate
    : new Date(d.getFullYear() + 1, startMonth, 1);
}

/** Plants drink less while dormant, so stretch moisture tasks in winter. */
export function seasonalInterval(
  task: CareTask,
  intervalDays: number,
  at: Date,
  hemisphere: Hemisphere,
): number {
  const dormant = isDormantSeason(at, hemisphere);
  const factor = dormant && (task === 'water' || task === 'mist') ? 1.4 : 1;
  return Math.max(1, Math.round(intervalDays * factor));
}

/** When a task should next happen, counting from `from`. */
export function computeNextDue(
  task: CareTask,
  intervalDays: number,
  from: Date,
  hemisphere: Hemisphere,
): Date {
  const due = startOfDay(addDays(from, seasonalInterval(task, intervalDays, from, hemisphere)));
  // No feeding while the plant is dormant.
  if (task === 'fertilize' && isDormantSeason(due, hemisphere)) {
    return nextGrowingSeasonStart(due, hemisphere);
  }
  return due;
}

const LIGHT_WATER_FACTOR: Record<LightLevel, number> = {
  low: 1.3,
  medium: 1,
  bright: 0.85,
  direct: 0.75,
};

export interface SuggestInput {
  species?: Species;
  site?: Pick<Site, 'light' | 'indoor'>;
  potDiameterCm?: number | null;
  hasDrainage?: boolean;
}

export interface SuggestedTask {
  task: CareTask;
  intervalDays: number;
}

/** Starting intervals for a new plant, tuned to where it lives and its pot. */
export function suggestIntervals({
  species,
  site,
  potDiameterCm,
  hasDrainage = true,
}: SuggestInput): SuggestedTask[] {
  const indoor = site?.indoor ?? true;
  let waterFactor = LIGHT_WATER_FACTOR[site?.light ?? 'medium'];
  if (!indoor) waterFactor *= 0.8;
  if (potDiameterCm != null && potDiameterCm > 0) {
    if (potDiameterCm < 12) waterFactor *= 0.8;
    else if (potDiameterCm > 30) waterFactor *= 1.25;
  }
  if (!hasDrainage) waterFactor *= 1.2;

  const base = species ?? {
    waterDays: 7,
    fertilizeDays: 30,
    mistDays: null,
    repotDays: 540,
  };

  const tasks: SuggestedTask[] = [
    { task: 'water', intervalDays: Math.max(1, Math.round(base.waterDays * waterFactor)) },
    { task: 'fertilize', intervalDays: base.fertilizeDays },
  ];
  if (base.mistDays && indoor) tasks.push({ task: 'mist', intervalDays: base.mistDays });
  if (indoor) {
    tasks.push({ task: 'rotate', intervalDays: 14 });
    tasks.push({ task: 'clean', intervalDays: 30 });
  }
  tasks.push({ task: 'repot', intervalDays: base.repotDays });
  return tasks;
}

/** Mark a task done: it's due again one (seasonal) interval from now. */
export function completeSchedule(
  schedule: CareSchedule,
  at: Date,
  hemisphere: Hemisphere,
): CareSchedule {
  return {
    ...schedule,
    lastDoneAt: at.toISOString(),
    nextDueAt: computeNextDue(schedule.task, schedule.intervalDays, at, hemisphere).toISOString(),
  };
}

export const MAX_INTERVAL_DAYS = 120;

/**
 * Push a task back. When `learn` is set (the soil was still wet), also
 * lengthen the watering interval a little so future reminders fit the plant.
 */
export function postponeSchedule(
  schedule: CareSchedule,
  now: Date,
  days: number,
  learn: boolean,
): CareSchedule {
  const intervalDays =
    learn && (schedule.task === 'water' || schedule.task === 'mist')
      ? Math.min(MAX_INTERVAL_DAYS, schedule.intervalDays + 1)
      : schedule.intervalDays;
  return {
    ...schedule,
    intervalDays,
    nextDueAt: startOfDay(addDays(now, days)).toISOString(),
  };
}

export type DueStatus = 'overdue' | 'today' | 'upcoming';

export function dueStatus(schedule: CareSchedule, now: Date): { status: DueStatus; days: number } {
  const days = daysBetween(now, new Date(schedule.nextDueAt));
  return { status: days < 0 ? 'overdue' : days === 0 ? 'today' : 'upcoming', days };
}

/** Enabled schedules due today or earlier. */
export function dueNow(schedules: CareSchedule[], now: Date): CareSchedule[] {
  return schedules
    .filter((s) => s.enabled && daysBetween(now, new Date(s.nextDueAt)) <= 0)
    .sort((a, b) => a.nextDueAt.localeCompare(b.nextDueAt));
}

/**
 * How many tasks fall on each of the next `days` days, if nothing gets done.
 * Day 0 includes everything overdue. Used to word daily reminders.
 */
export function dueCountsByDay(schedules: CareSchedule[], now: Date, days: number): number[] {
  const counts = new Array<number>(days).fill(0);
  for (const s of schedules) {
    if (!s.enabled) continue;
    const d = Math.max(0, daysBetween(now, new Date(s.nextDueAt)));
    if (d < days) counts[d] += 1;
  }
  // Undone tasks carry forward to the next day's reminder.
  for (let i = 1; i < days; i++) counts[i] += counts[i - 1];
  return counts;
}

export function describeDue(schedule: CareSchedule, now: Date): string {
  const { status, days } = dueStatus(schedule, now);
  if (status === 'today') return 'Today';
  if (status === 'overdue') return days === -1 ? '1 day late' : `${-days} days late`;
  if (days === 1) return 'Tomorrow';
  if (days < 14) return `In ${days} days`;
  if (days < 60) return `In ${Math.round(days / 7)} weeks`;
  return `In ${Math.round(days / 30)} months`;
}
