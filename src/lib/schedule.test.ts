import { describe, expect, it } from 'vitest';

import { getSpecies } from '../data/species';
import {
  completeSchedule,
  computeNextDue,
  daysBetween,
  dueCountsByDay,
  dueNow,
  isDormantSeason,
  postponeSchedule,
  suggestIntervals,
} from './schedule';
import type { CareSchedule } from './types';

const schedule = (over: Partial<CareSchedule> = {}): CareSchedule => ({
  id: 's1',
  plantId: 'p1',
  task: 'water',
  intervalDays: 7,
  lastDoneAt: null,
  nextDueAt: new Date(2026, 5, 10).toISOString(),
  enabled: true,
  ...over,
});

describe('seasons', () => {
  it('knows dormant months per hemisphere', () => {
    expect(isDormantSeason(new Date(2026, 0, 15), 'north')).toBe(true);
    expect(isDormantSeason(new Date(2026, 5, 15), 'north')).toBe(false);
    expect(isDormantSeason(new Date(2026, 5, 15), 'south')).toBe(true);
  });

  it('stretches watering in winter', () => {
    const summer = computeNextDue('water', 10, new Date(2026, 6, 1), 'north');
    const winter = computeNextDue('water', 10, new Date(2026, 11, 1), 'north');
    expect(daysBetween(new Date(2026, 6, 1), summer)).toBe(10);
    expect(daysBetween(new Date(2026, 11, 1), winter)).toBe(14);
  });

  it('holds fertilizer until spring', () => {
    const due = computeNextDue('fertilize', 30, new Date(2026, 10, 20), 'north');
    expect(due.getFullYear()).toBe(2027);
    expect(due.getMonth()).toBe(2);
    expect(due.getDate()).toBe(1);
  });
});

describe('suggestIntervals', () => {
  it('waters a pothos in bright light more often than in low light', () => {
    const pothos = getSpecies('pothos');
    const water = (light: 'low' | 'bright') =>
      suggestIntervals({ species: pothos, site: { light, indoor: true } }).find(
        (t) => t.task === 'water',
      )!.intervalDays;
    expect(water('bright')).toBeLessThan(water('low'));
  });

  it('only suggests misting for species that want it', () => {
    const tasks = (id: string) =>
      suggestIntervals({ species: getSpecies(id) }).map((t) => t.task);
    expect(tasks('calathea')).toContain('mist');
    expect(tasks('snake-plant')).not.toContain('mist');
  });

  it('falls back to sensible defaults for unknown plants', () => {
    const water = suggestIntervals({}).find((t) => t.task === 'water');
    expect(water?.intervalDays).toBe(7);
  });
});

describe('completing and postponing', () => {
  it('schedules the next watering one interval out', () => {
    const at = new Date(2026, 5, 10, 18, 30);
    const next = completeSchedule(schedule(), at, 'north');
    expect(next.lastDoneAt).toBe(at.toISOString());
    expect(daysBetween(at, new Date(next.nextDueAt))).toBe(7);
  });

  it('learns from "soil still wet"', () => {
    const now = new Date(2026, 5, 10);
    const learned = postponeSchedule(schedule(), now, 2, true);
    expect(learned.intervalDays).toBe(8);
    expect(daysBetween(now, new Date(learned.nextDueAt))).toBe(2);
    expect(postponeSchedule(schedule(), now, 2, false).intervalDays).toBe(7);
  });
});

describe('due lists', () => {
  const now = new Date(2026, 5, 10, 12);
  const list = [
    schedule({ id: 'late', nextDueAt: new Date(2026, 5, 8).toISOString() }),
    schedule({ id: 'today', nextDueAt: new Date(2026, 5, 10).toISOString() }),
    schedule({ id: 'soon', nextDueAt: new Date(2026, 5, 12).toISOString() }),
    schedule({ id: 'off', enabled: false, nextDueAt: new Date(2026, 5, 1).toISOString() }),
  ];

  it('lists overdue and today, oldest first, skipping disabled', () => {
    expect(dueNow(list, now).map((s) => s.id)).toEqual(['late', 'today']);
  });

  it('carries undone tasks forward in daily counts', () => {
    expect(dueCountsByDay(list, now, 4)).toEqual([2, 2, 3, 3]);
  });
});
