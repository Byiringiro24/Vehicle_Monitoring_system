import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  roles?: string[];
  pendingRoles?: string[];
  phone?: string;
  intendedRole?: string;
  organization: { id: string; name: string; slug: string; status?: string };
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  /** The role the user is currently operating as — may differ from user.role when multi-role */
  activeRole: string | null;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  switchOrganization: (organization: User['organization'], accessToken: string, refreshToken: string) => void;
  updateToken: (accessToken: string) => void;
  /** Switch the active operating role (must be one of user.roles) */
  switchRole: (role: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      activeRole: null,

      setAuth: (user, accessToken, refreshToken) =>
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          // Default active role = primary role from JWT
          activeRole: user.role,
        }),

      switchOrganization: (organization, accessToken, refreshToken) =>
        set((state) => ({
          user: state.user ? { ...state.user, organization } : state.user,
          accessToken,
          refreshToken,
          isAuthenticated: !!state.user,
        })),

      updateToken: (accessToken) => set({ accessToken }),

      switchRole: (role: string) => {
        const { user } = get();
        if (!user) return;
        const allRoles = Array.from(new Set([user.role, ...(user.roles ?? [])]));
        if (!allRoles.includes(role)) return; // guard: only own roles
        set({ activeRole: role });
      },

      logout: () => set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        activeRole: null,
      }),
    }),
    {
      name: 'artic-auth',
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        isAuthenticated: s.isAuthenticated,
        activeRole: s.activeRole,
      }),
    }
  )
);
