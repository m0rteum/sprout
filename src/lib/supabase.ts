import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** True when the app was built with Supabase settings, so it can sync a shared household. */
export const isCloudConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isCloudConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        // On web, supabase-js uses localStorage by default; AsyncStorage on native.
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export const PHOTO_BUCKET = 'plant-photos';
