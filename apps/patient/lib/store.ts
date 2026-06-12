import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  patient_id?: string;
  organization_id: string;
  therapist_name?: string;
  avatar_url?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  expiresAt: number | null;
  setAuth: (user: User, accessToken: string, refreshToken?: string, expiresIn?: number) => void;
  updateTokens: (accessToken: string, refreshToken: string, expiresIn?: number) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      expiresAt: null,

      setAuth: (user, accessToken, refreshToken = "", expiresIn = 900) => {
        if (typeof document !== 'undefined') {
          document.cookie = 'tt_auth=1; path=/; SameSite=Lax';
        }
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          expiresAt: Date.now() + expiresIn * 1000,
        });
      },

      updateTokens: (accessToken, refreshToken, expiresIn = 900) =>
        set({
          accessToken,
          refreshToken,
          expiresAt: Date.now() + expiresIn * 1000,
        }),

      clearAuth: () => {
        if (typeof document !== 'undefined') {
          document.cookie = 'tt_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        }
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          expiresAt: null,
        });
      },
    }),
    {
      name: "24therapy-patient-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        expiresAt: state.expiresAt,
      }),
    }
  )
);
