import AsyncStorage from '@react-native-async-storage/async-storage';

import { persistPhoto } from '../photos';
import { EMPTY_GARDEN, type GardenData } from '../types';
import type { DataSource } from './types';

const KEY = 'sprout.garden.v1';

function upsert<T extends { id: string }>(list: T[], items: T[]): T[] {
  const byId = new Map(list.map((x) => [x.id, x]));
  for (const item of items) byId.set(item.id, item);
  return [...byId.values()];
}

/** Everything in AsyncStorage on this device. No account needed. */
export function createLocalDataSource(): DataSource {
  let data: GardenData | null = null;

  async function get(): Promise<GardenData> {
    if (!data) {
      const raw = await AsyncStorage.getItem(KEY);
      data = raw ? { ...EMPTY_GARDEN, ...(JSON.parse(raw) as GardenData) } : { ...EMPTY_GARDEN };
    }
    return data;
  }

  async function update(fn: (d: GardenData) => GardenData) {
    data = fn(await get());
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
  }

  return {
    kind: 'local',
    load: async () => structuredClone(await get()),
    upsertSites: (sites) => update((d) => ({ ...d, sites: upsert(d.sites, sites) })),
    deleteSite: (id) =>
      update((d) => ({
        ...d,
        sites: d.sites.filter((s) => s.id !== id),
        plants: d.plants.map((p) => (p.siteId === id ? { ...p, siteId: null } : p)),
      })),
    upsertPlants: (plants) => update((d) => ({ ...d, plants: upsert(d.plants, plants) })),
    deletePlant: (id) =>
      update((d) => ({
        ...d,
        plants: d.plants.filter((p) => p.id !== id),
        schedules: d.schedules.filter((s) => s.plantId !== id),
        logs: d.logs.filter((l) => l.plantId !== id),
        journal: d.journal.filter((j) => j.plantId !== id),
      })),
    upsertSchedules: (schedules) =>
      update((d) => ({ ...d, schedules: upsert(d.schedules, schedules) })),
    addLogs: (logs) => update((d) => ({ ...d, logs: upsert(d.logs, logs) })),
    upsertJournal: (entries) => update((d) => ({ ...d, journal: upsert(d.journal, entries) })),
    deleteJournal: (id) =>
      update((d) => ({ ...d, journal: d.journal.filter((j) => j.id !== id) })),
    storePhoto: async (uri) => persistPhoto(uri),
    resolvePhotos: async (values) => Object.fromEntries(values.map((v) => [v, v])),
    subscribe: () => () => {},
  };
}
