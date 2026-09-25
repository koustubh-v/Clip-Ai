import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { FIREBASE_CONFIGURED } from "../lib/firebase";
import { api } from "../lib/api";

interface AuthState {
  user: User | null;
  profile: any | null;
  loading: boolean;
  error: string | null;
  setUser: (u: User | null) => void;
  setProfile: (p: any) => void;
  setLoading: (b: boolean) => void;
  setError: (e: string | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      loading: true,
      error: null,
      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      signIn: async (email, password) => {
        set({ error: null });
        try {
          await signInWithEmailAndPassword(auth, email, password);
          await get().refreshProfile();
        } catch (e: any) {
          set({ error: e.message });
          throw e;
        }
      },

      signUp: async (email, password, displayName) => {
        set({ error: null });
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          await api.onboard(displayName);
          await get().refreshProfile();
        } catch (e: any) {
          set({ error: e.message });
          throw e;
        }
      },

      signInGoogle: async () => {
        set({ error: null });
        try {
          const provider = new GoogleAuthProvider();
          const result = await signInWithPopup(auth, provider);
          // Onboard if first time (will no-op if already exists)
          await api.onboard(result.user.displayName || result.user.email || "User");
          await get().refreshProfile();
        } catch (e: any) {
          set({ error: e.message });
          throw e;
        }
      },

      logout: async () => {
        await signOut(auth);
        set({ user: null, profile: null });
      },

      refreshProfile: async () => {
        try {
          const profile = await api.me();
          set({ profile });
        } catch {
          // profile may not exist yet
        }
      },
    }),
    {
      name: "clipmind-auth",
      partialize: (state) => ({ profile: state.profile }),
    }
  )
);

// Listen to Firebase auth state changes only when configured
if (FIREBASE_CONFIGURED) {
  onAuthStateChanged(auth, async (user) => {
    const store = useAuthStore.getState();
    store.setUser(user);
    store.setLoading(false);
    if (user) {
      await store.refreshProfile();
    }
  });
} else {
  // Set loading false immediately so the app doesn't hang
  setTimeout(() => useAuthStore.getState().setLoading(false), 0);
}
