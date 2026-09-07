import { create } from "zustand";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
  status?: string;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isChecked: boolean;
  setUser: (user: AuthUser | null) => void;
  checkAuth: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  isChecked: false,

  setUser: (user) => set({ user }),

  checkAuth: async () => {
    if (get().isChecked) return get().user;
    set({ isLoading: true });
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      set({ user: data.user ?? null, isLoading: false, isChecked: true });
      return data.user ?? null;
    } catch {
      set({ user: null, isLoading: false, isChecked: true });
      return null;
    }
  },

  logout: async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    set({ user: null, isChecked: false });
  },
}));
