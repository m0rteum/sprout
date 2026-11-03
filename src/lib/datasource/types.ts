import type { CareLog, CareSchedule, GardenData, JournalEntry, Plant, Site } from '../types';

/**
 * Where the garden lives. `local` keeps everything on this device; `supabase`
 * syncs a household shared between people.
 */
export interface DataSource {
  kind: 'local' | 'supabase';
  load(): Promise<GardenData>;
  upsertSites(sites: Site[]): Promise<void>;
  deleteSite(id: string): Promise<void>;
  upsertPlants(plants: Plant[]): Promise<void>;
  deletePlant(id: string): Promise<void>;
  upsertSchedules(schedules: CareSchedule[]): Promise<void>;
  addLogs(logs: CareLog[]): Promise<void>;
  upsertJournal(entries: JournalEntry[]): Promise<void>;
  deleteJournal(id: string): Promise<void>;
  /** Store a photo picked on this device; returns the value to save on the record. */
  storePhoto(localUri: string): Promise<string>;
  /** Turn stored photo values into displayable URLs. */
  resolvePhotos(values: string[]): Promise<Record<string, string>>;
  /** Called when someone else changes the garden. Returns an unsubscribe function. */
  subscribe(onRemoteChange: () => void): () => void;
}
