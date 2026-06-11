'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AdminUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  role: 'super_admin' | 'admin';
  organization_id?: string;
}

interface AdminAuthState {
  user: AdminUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  expiresAt: number | null; // Unix timestamp ms
  // Actions
  login: (user: AdminUser, accessToken: string, refreshToken: string, expiresIn?: number) => void;
  updateTokens: (accessToken: string, refreshToken: string, expiresIn?: number) => void;
  logout: () => void;
  // Legacy compat
  token: string | null;
}

export const useAdminAuth = create<AdminAuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      expiresAt: null,
      token: null, // legacy compat

      login: (user, accessToken, refreshToken, expiresIn = 900) => {
        if (typeof document !== 'undefined') {
          document.cookie = 'tt_auth=1; path=/; SameSite=Lax';
        }
        set({
          user,
          accessToken,
          refreshToken,
          token: accessToken, // legacy compat
          isAuthenticated: true,
          expiresAt: Date.now() + expiresIn * 1000,
        });
      },

      updateTokens: (accessToken, refreshToken, expiresIn = 900) =>
        set({
          accessToken,
          refreshToken,
          token: accessToken,
          expiresAt: Date.now() + expiresIn * 1000,
        }),

      logout: () => {
        if (typeof document !== 'undefined') {
          document.cookie = 'tt_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        }
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          token: null,
          isAuthenticated: false,
          expiresAt: null,
        });
      },
    }),
    {
      name: 'admin-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        expiresAt: state.expiresAt,
      }),
    }
  )
);
