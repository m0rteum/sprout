import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getSpecies } from '@/data/species';
import { notify } from '@/lib/confirm';
import type { DataSource } from '@/lib/datasource/types';
import { syncReminders } from '@/lib/notifications';
import {
  addDays,
  completeSchedule,
  computeNextDue,
  postponeSchedule,
  startOfDay,
  suggestIntervals,
} from '@/lib/schedule';
import {
  DEFAULT_PREFERENCES,
  EMPTY_GARDEN,
  type CareAction,
  type CareLog,
  type CareSchedule,
  type GardenData,
  type JournalEntry,
  type LightLevel,
  type Plant,
  type Preferences,
  type Site,
} from '@/lib/types';

const PREFS_KEY = 'sprout.prefs.v1';

export interface NewPlantInput {
  nickname: string;
  speciesId: string | null;
  speciesName: string;
  siteId: string | null;
  potDiameterCm: number | null;
  hasDrainage: boolean;
  notes: string;
  photoUri: string | null;
  /** How long ago it was last watered; 0 means today. */
  lastWateredDaysAgo: number;
}

interface GardenState {
  ready: boolean;
  sourceKind: DataSource['kind'] | null;
  data: GardenData;
  prefs: Preferences;
  photoUrl(value: string | null): string | null;
  refresh(): Promise<void>;
  setPrefs(patch: Partial<Preferences>): Promise<void>;
  addSite(name: string, light: LightLevel, indoor: boolean): Promise<Site>;
  updateSite(site: Site): Promise<void>;
  removeSite(id: string): Promise<void>;
  addPlant(input: NewPlantInput): Promise<Plant>;
  updatePlant(plant: Plant, newPhotoUri?: string | null): Promise<void>;
  removePlant(id: string): Promise<void>;
  completeTasks(scheduleIds: string[]): Promise<void>;
  postponeTask(scheduleId: string, days: number, soilStillWet: boolean): Promise<void>;
  updateSchedule(schedule: CareSchedule): Promise<void>;
  addJournalEntry(plantId: string, note: string, photoUri: string | null): Promise<void>;
  removeJournalEntry(id: string): Promise<void>;
}

const GardenContext = createContext<GardenState | null>(null);

export function GardenProvider({
  source,
  children,
}: {
  source: DataSource | null;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<GardenData>(EMPTY_GARDEN);
  const [prefs, setPrefsState] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  // Latest garden, readable from async actions that run before the next render
  // (e.g. a place created a moment ago while adding a plant).
  const latest = useRef<GardenData>(EMPTY_GARDEN);
  const commit = useCallback((next: GardenData | ((d: GardenData) => GardenData)) => {
    const value = typeof next === 'function' ? next(latest.current) : next;
    latest.current = value;
    setData(value);
  }, []);

  const resolvePhotos = useCallback(
    async (d: GardenData) => {
      if (!source) return;
      const values = [
        ...d.plants.map((p) => p.photo),
        ...d.journal.map((j) => j.photo),
      ].filter((v): v is string => Boolean(v));
      try {
        const urls = await source.resolvePhotos(values);
        setPhotoUrls((prev) => ({ ...prev, ...urls }));
      } catch (e) {
        console.warn('Could not load photos', e);
      }
    },
    [source],
  );

  const refresh = useCallback(async () => {
    if (!source) return;
    try {
      const d = await source.load();
      commit(d);
      void resolvePhotos(d);
    } catch (e) {
      console.warn('Could not load garden', e);
    }
  }, [source, resolvePhotos, commit]);

  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY).then((raw) => {
      if (raw) setPrefsState({ ...DEFAULT_PREFERENCES, ...JSON.parse(raw) });
    });
  }, []);

  useEffect(() => {
    if (!source) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    source
      .load()
      .then((d) => {
        if (cancelled) return;
        commit(d);
        void resolvePhotos(d);
      })
      .catch((e) => console.warn('Could not load garden', e))
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    const unsubscribe = source.subscribe(() => {
      // Bursts of changes (one task done = schedule + log) → one reload.
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 400);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe();
    };
  }, [source, refresh, resolvePhotos, commit]);

  // Keep the phone's reminders in step with the garden.
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      syncReminders(data.schedules, data.plants, prefs).catch((e) =>
        console.warn('Could not schedule reminders', e),
      );
    }, 800);
    return () => clearTimeout(t);
  }, [ready, data.schedules, data.plants, prefs]);

  /** Apply a change on screen right away, then save it; reload if saving fails. */
  const mutate = useCallback(
    async (local: (d: GardenData) => GardenData, save: () => Promise<void>) => {
      commit(local);
      try {
        await save();
      } catch (e) {
        notify('Could not save', e instanceof Error ? e.message : String(e));
        await refresh();
      }
    },
    [refresh, commit],
  );

  const storePhoto = useCallback(
    async (uri: string | null | undefined): Promise<string | null> => {
      if (!uri || !source) return null;
      const stored = await source.storePhoto(uri);
      setPhotoUrls((prev) => ({ ...prev, [stored]: uri }));
      return stored;
    },
    [source],
  );

  const value = useMemo<GardenState>(() => {
    const need = () => {
      if (!source) throw new Error('Garden is not ready yet');
      return source;
    };

    const logsFor = (schedules: CareSchedule[], action: CareAction, at: Date): CareLog[] =>
      schedules.map((s) => ({
        id: randomUUID(),
        plantId: s.plantId,
        task: s.task,
        action,
        at: at.toISOString(),
        by: prefs.displayName || null,
        note: '',
      }));

    const replace = <T extends { id: string }>(list: T[], items: T[]) => {
      const byId = new Map(items.map((i) => [i.id, i]));
      const seen = new Set<string>();
      const out = list.map((x) => {
        seen.add(x.id);
        return byId.get(x.id) ?? x;
      });
      return [...out, ...items.filter((i) => !seen.has(i.id))];
    };

    return {
      ready,
      sourceKind: source?.kind ?? null,
      data,
      prefs,
      photoUrl: (v) => (v ? (photoUrls[v] ?? null) : null),
      refresh,

      async setPrefs(patch) {
        const next = { ...prefs, ...patch };
        setPrefsState(next);
        await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
      },

      async addSite(name, light, indoor) {
        const site: Site = {
          id: randomUUID(),
          name: name.trim(),
          light,
          indoor,
          createdAt: new Date().toISOString(),
        };
        await mutate(
          (d) => ({ ...d, sites: [...d.sites, site] }),
          () => need().upsertSites([site]),
        );
        return site;
      },

      updateSite: (site) =>
        mutate(
          (d) => ({ ...d, sites: replace(d.sites, [site]) }),
          () => need().upsertSites([site]),
        ),

      removeSite: (id) =>
        mutate(
          (d) => ({
            ...d,
            sites: d.sites.filter((s) => s.id !== id),
            plants: d.plants.map((p) => (p.siteId === id ? { ...p, siteId: null } : p)),
          }),
          () => need().deleteSite(id),
        ),

      async addPlant(input) {
        const src = need();
        const now = new Date();
        const photo = await storePhoto(input.photoUri);
        const plant: Plant = {
          id: randomUUID(),
          siteId: input.siteId,
          nickname: input.nickname.trim() || input.speciesName || 'New plant',
          speciesId: input.speciesId,
          speciesName: input.speciesName,
          photo,
          potDiameterCm: input.potDiameterCm,
          hasDrainage: input.hasDrainage,
          notes: input.notes,
          createdAt: now.toISOString(),
        };
        const site = latest.current.sites.find((s) => s.id === input.siteId);
        const suggestions = suggestIntervals({
          species: getSpecies(input.speciesId),
          site,
          potDiameterCm: input.potDiameterCm,
          hasDrainage: input.hasDrainage,
        });
        const schedules: CareSchedule[] = suggestions.map(({ task, intervalDays }) => {
          const lastDone =
            task === 'water' ? startOfDay(addDays(now, -input.lastWateredDaysAgo)) : now;
          let next = computeNextDue(task, intervalDays, lastDone, prefs.hemisphere);
          if (next < startOfDay(now)) next = startOfDay(now);
          return {
            id: randomUUID(),
            plantId: plant.id,
            task,
            intervalDays,
            lastDoneAt: task === 'water' ? lastDone.toISOString() : null,
            nextDueAt: next.toISOString(),
            enabled: true,
          };
        });
        await mutate(
          (d) => ({
            ...d,
            plants: [...d.plants, plant],
            schedules: [...d.schedules, ...schedules],
          }),
          async () => {
            await src.upsertPlants([plant]);
            await src.upsertSchedules(schedules);
          },
        );
        return plant;
      },

      async updatePlant(plant, newPhotoUri) {
        const next =
          newPhotoUri !== undefined
            ? { ...plant, photo: newPhotoUri ? await storePhoto(newPhotoUri) : null }
            : plant;
        await mutate(
          (d) => ({ ...d, plants: replace(d.plants, [next]) }),
          () => need().upsertPlants([next]),
        );
      },

      removePlant: (id) =>
        mutate(
          (d) => ({
            ...d,
            plants: d.plants.filter((p) => p.id !== id),
            schedules: d.schedules.filter((s) => s.plantId !== id),
            logs: d.logs.filter((l) => l.plantId !== id),
            journal: d.journal.filter((j) => j.plantId !== id),
          }),
          () => need().deletePlant(id),
        ),

      async completeTasks(ids) {
        const now = new Date();
        const done = latest.current.schedules
          .filter((s) => ids.includes(s.id))
          .map((s) => completeSchedule(s, now, prefs.hemisphere));
        const logs = logsFor(done, 'done', now);
        await mutate(
          (d) => ({ ...d, schedules: replace(d.schedules, done), logs: [...d.logs, ...logs] }),
          async () => {
            await need().upsertSchedules(done);
            await need().addLogs(logs);
          },
        );
      },

      async postponeTask(id, days, soilStillWet) {
        const s = latest.current.schedules.find((x) => x.id === id);
        if (!s) return;
        const now = new Date();
        const next = postponeSchedule(s, now, days, soilStillWet);
        const logs = logsFor([next], 'postponed', now);
        await mutate(
          (d) => ({ ...d, schedules: replace(d.schedules, [next]), logs: [...d.logs, ...logs] }),
          async () => {
            await need().upsertSchedules([next]);
            await need().addLogs(logs);
          },
        );
      },

      updateSchedule: (schedule) =>
        mutate(
          (d) => ({ ...d, schedules: replace(d.schedules, [schedule]) }),
          () => need().upsertSchedules([schedule]),
        ),

      async addJournalEntry(plantId, note, photoUri) {
        const entry: JournalEntry = {
          id: randomUUID(),
          plantId,
          photo: await storePhoto(photoUri),
          note: note.trim(),
          at: new Date().toISOString(),
        };
        await mutate(
          (d) => ({ ...d, journal: [...d.journal, entry] }),
          () => need().upsertJournal([entry]),
        );
      },

      removeJournalEntry: (id) =>
        mutate(
          (d) => ({ ...d, journal: d.journal.filter((j) => j.id !== id) }),
          () => need().deleteJournal(id),
        ),
    };
  }, [ready, source, data, prefs, photoUrls, refresh, mutate, storePhoto]);

  return <GardenContext.Provider value={value}>{children}</GardenContext.Provider>;
}

export function useGarden(): GardenState {
  const ctx = useContext(GardenContext);
  if (!ctx) throw new Error('useGarden must be used inside GardenProvider');
  return ctx;
}
