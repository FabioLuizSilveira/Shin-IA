import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import { storage as kv } from '@/src/utils/storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabaseConfigured = Boolean(url && anonKey);

// Native uses SecureStore; web falls back to the shared kv storage util.
const secureStorage: SupportedStorage =
  Platform.OS === 'web'
    ? {
        getItem: (k) => kv.getItem(k),
        setItem: (k, v) => kv.setItem(k, v),
        removeItem: (k) => kv.removeItem(k),
      }
    : {
        getItem: (k) => SecureStore.getItemAsync(k),
        setItem: (k, v) => SecureStore.setItemAsync(k, v),
        removeItem: (k) => SecureStore.deleteItemAsync(k),
      };

// When Supabase is not configured we still export a client-shaped stub so the
// rest of the app can import safely. Real calls are guarded by supabaseConfigured.
export const supabase = supabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        storage: secureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : (null as any);
