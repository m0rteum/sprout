import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'expo-crypto';

import { isDirectUri, readPhotoBytes } from '../photos';
import { PHOTO_BUCKET } from '../supabase';
import type { CareLog, CareSchedule, GardenData, JournalEntry, Plant, Site } from '../types';
import type { DataSource } from './types';

type Row = Record<string, unknown>;

const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

function toRow(obj: object, householdId: string): Row {
  const row: Row = { household_id: householdId };
  for (const [k, v] of Object.entries(obj)) row[toSnake(k)] = v;
  return row;
}

function fromRow<T>(row: Row): T {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'household_id') continue;
    out[toCamel(k)] = v;
  }
  return out as T;
}

const TABLES = ['sites', 'plants', 'care_schedules', 'care_logs', 'journal_entries'] as const;

/** A household shared through Supabase. Row-level security limits access to members. */
export function createSupabaseDataSource(client: SupabaseClient, householdId: string): DataSource {
  async function select<T>(table: string, order: string): Promise<T[]> {
    const { data, error } = await client
      .from(table)
      .select('*')
      .eq('household_id', householdId)
      .order(order);
    if (error) throw error;
    return (data ?? []).map((r) => fromRow<T>(r as Row));
  }

  async function upsert(table: string, items: object[]) {
    if (!items.length) return;
    const { error } = await client.from(table).upsert(items.map((i) => toRow(i, householdId)));
    if (error) throw error;
  }

  async function remove(table: string, id: string) {
    const { error } = await client.from(table).delete().eq('id', id);
    if (error) throw error;
  }

  return {
    kind: 'supabase',
    async load(): Promise<GardenData> {
      const [sites, plants, schedules, logs, journal] = await Promise.all([
        select<Site>('sites', 'created_at'),
        select<Plant>('plants', 'created_at'),
        select<CareSchedule>('care_schedules', 'next_due_at'),
        select<CareLog>('care_logs', 'at'),
        select<JournalEntry>('journal_entries', 'at'),
      ]);
      return { sites, plants, schedules, logs, journal };
    },
    upsertSites: (items) => upsert('sites', items),
    deleteSite: (id) => remove('sites', id),
    upsertPlants: (items) => upsert('plants', items),
    deletePlant: (id) => remove('plants', id),
    upsertSchedules: (items) => upsert('care_schedules', items),
    addLogs: (items) => upsert('care_logs', items),
    upsertJournal: (items) => upsert('journal_entries', items),
    deleteJournal: (id) => remove('journal_entries', id),

    async storePhoto(localUri) {
      // Storage policies only allow paths that start with your household's id.
      const path = `${householdId}/${randomUUID()}.jpg`;
      const bytes = await readPhotoBytes(localUri);
      const { error } = await client.storage
        .from(PHOTO_BUCKET)
        .upload(path, bytes, { contentType: 'image/jpeg' });
      if (error) throw error;
      return path;
    },

    async resolvePhotos(values) {
      const result: Record<string, string> = {};
      const paths: string[] = [];
      for (const v of values) {
        if (isDirectUri(v)) result[v] = v;
        else paths.push(v);
      }
      if (paths.length) {
        const { data, error } = await client.storage
          .from(PHOTO_BUCKET)
          .createSignedUrls(paths, 60 * 60 * 24 * 7);
        if (error) throw error;
        for (const item of data ?? []) {
          if (item.path && item.signedUrl) result[item.path] = item.signedUrl;
        }
      }
      return result;
    },

    subscribe(onRemoteChange) {
      let channel = client.channel(`household:${householdId}`);
      for (const table of TABLES) {
        channel = channel
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table, filter: `household_id=eq.${householdId}` },
            onRemoteChange,
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table, filter: `household_id=eq.${householdId}` },
            onRemoteChange,
          )
          // Realtime can't filter DELETE events, so listen to all of them; RLS still applies.
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, onRemoteChange);
      }
      channel.subscribe();
      return () => {
        void client.removeChannel(channel);
      };
    },
  };
}
