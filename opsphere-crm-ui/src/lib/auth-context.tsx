'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { api, setTokens, clearTokens } from './api';
import type { AuthUser, AuthEntity, LoginResponse } from './types';

interface AuthState {
  user: AuthUser | null;
  entity: AuthEntity | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; displayName?: string; organisationName: string; industry?: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, entity: null, loading: true });

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setState({ user: null, entity: null, loading: false });
      return;
    }
    api<{ user: AuthUser; entity: AuthEntity | null }>('/api/auth/me')
      .then((data) => setState({ user: data.user, entity: data.entity, loading: false }))
      .catch(() => {
        clearTokens();
        setState({ user: null, entity: null, loading: false });
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setTokens(data.accessToken, data.entity?.id || '');
    setState({ user: data.user, entity: data.entity, loading: false });
  }, []);

  const register = useCallback(async (data: { email: string; password: string; displayName?: string; organisationName: string; industry?: string }) => {
    const res = await api<LoginResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setTokens(res.accessToken, res.entity?.id || '');
    setState({ user: res.user, entity: res.entity, loading: false });
  }, []);

  const logout = useCallback(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003'}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {});
    clearTokens();
    setState({ user: null, entity: null, loading: false });
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
