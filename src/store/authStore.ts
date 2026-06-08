import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthStore {
  user: User | null;
  displayName: string | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setDisplayName: (name: string | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  displayName: null,
  loading: true,
  setUser: (user) => set({ user }),
  setDisplayName: (displayName) => set({ displayName }),
  setLoading: (loading) => set({ loading }),
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, displayName: null });
  },
}));
