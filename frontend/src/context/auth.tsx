import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { supabase, supabaseConfigured } from '@/src/lib/supabase';
import { storage } from '@/src/utils/storage';

WebBrowser.maybeCompleteAuthSession();

export type ShinaUser = {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  provider: 'google' | 'apple' | 'demo';
};

type AuthState = {
  user: ShinaUser | null;
  loading: boolean;
  supabaseReady: boolean;
  signInWith: (provider: 'google' | 'apple') => Promise<void>;
  signInDemo: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const redirectTo = makeRedirectUri({ scheme: 'frontend', path: 'auth/callback' });

function fromSupabase(session: any): ShinaUser | null {
  const u = session?.user;
  if (!u) return null;
  return {
    id: u.id,
    name: u.user_metadata?.full_name || u.user_metadata?.name || (u.email || '').split('@')[0],
    email: u.email || '',
    avatar: u.user_metadata?.avatar_url || null,
    provider: (u.app_metadata?.provider as any) || 'google',
  };
}

const DEMO_USER: ShinaUser = {
  id: 'demo-op-001',
  name: 'Comandante Shinã',
  email: 'ops@shinaia.com.br',
  provider: 'demo',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ShinaUser | null>(null);
  const [loading, setLoading] = useState(true);

  const completeUrl = useCallback(async (url: string) => {
    if (!supabaseConfigured || !supabase) return;
    const { params, errorCode } = QueryParams.getQueryParams(url);
    if (errorCode || !params.access_token) return;
    const { data, error } = await supabase.auth.setSession({
      access_token: String(params.access_token),
      refresh_token: String(params.refresh_token ?? ''),
    });
    if (!error) setUser(fromSupabase(data.session));
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // Demo session persisted locally
      const demo = await storage.getItem('demo_session');
      if (demo === '1') {
        if (mounted) { setUser(DEMO_USER); setLoading(false); }
        return;
      }
      if (supabaseConfigured && supabase) {
        const { data } = await supabase.auth.getSession();
        if (mounted) setUser(fromSupabase(data.session));
        supabase.auth.onAuthStateChange((_e: any, s: any) => {
          if (mounted) setUser(fromSupabase(s));
        });
      }
      if (mounted) setLoading(false);
    })();

    const sub = Linking.addEventListener('url', ({ url }) => { void completeUrl(url); });
    return () => { mounted = false; sub.remove(); };
  }, [completeUrl]);

  const signInWith = async (provider: 'google' | 'apple') => {
    if (!supabaseConfigured || !supabase) {
      throw new Error('Supabase não configurado. Use o modo demonstração ou informe as chaves.');
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data.url) throw new Error('OAuth URL ausente');
    if (Platform.OS === 'web') {
      window.location.href = data.url;
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success') await completeUrl(result.url);
  };

  const signInDemo = async () => {
    await storage.setItem('demo_session', '1');
    setUser(DEMO_USER);
  };

  const signOut = async () => {
    await storage.removeItem('demo_session');
    if (supabaseConfigured && supabase) {
      try { await supabase.auth.signOut(); } catch {}
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, supabaseReady: supabaseConfigured, signInWith, signInDemo, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
