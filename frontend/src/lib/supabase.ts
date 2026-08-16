import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabaseConfigured = Boolean(url && anonKey);

// Native uses SecureStore; on web we let supabase-js use its default localStorage
// (critical for the PKCE code_verifier to survive the full-page OAuth redirect).
const secureStorage: SupportedStorage | undefined =
  Platform.OS === 'web'
    ? undefined
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
        ...(secureStorage ? { storage: secureStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        // On web let supabase-js auto-exchange the ?code= on the callback page.
        // On native we exchange manually after the WebBrowser returns.
        detectSessionInUrl: Platform.OS === 'web',
        flowType: 'pkce',
      },
    })
  : (null as any);
