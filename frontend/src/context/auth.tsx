import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { storage } from '@/src/utils/storage';
import { api } from '@/src/api/client';

export type Role = 'locador' | 'locatario';

export type User = {
  user_id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string | null;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: { name: string; email: string; password: string; role: Role; phone?: string }) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const persist = async (token: string, u: User) => {
    await storage.setItem('auth_token', token);
    await storage.setItem('auth_user', JSON.stringify(u));
    setUser(u);
  };

  const refresh = useCallback(async () => {
    const token = await storage.getItem('auth_token');
    if (!token) { setUser(null); return; }
    try {
      const res = await api<{ user: User }>('/auth/me');
      setUser(res.user);
      await storage.setItem('auth_user', JSON.stringify(res.user));
    } catch {
      await storage.removeItem('auth_token');
      await storage.removeItem('auth_user');
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const raw = await storage.getItem('auth_user');
      if (raw) {
        try { setUser(JSON.parse(raw)); } catch {}
      }
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const res = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST', body: { email, password }, auth: false,
    });
    await persist(res.token, res.user);
    return res.user;
  };

  const register = async (payload: { name: string; email: string; password: string; role: Role; phone?: string }) => {
    const res = await api<{ token: string; user: User }>('/auth/register', {
      method: 'POST', body: payload, auth: false,
    });
    await persist(res.token, res.user);
    return res.user;
  };

  const logout = async () => {
    await storage.removeItem('auth_token');
    await storage.removeItem('auth_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
