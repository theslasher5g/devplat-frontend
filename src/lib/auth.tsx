import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, type Me } from './api';

interface AuthState {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<Me | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  me: null,
  loading: true,
  refresh: async () => null,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<Me | null> => {
    try {
      const data = await api<Me>('/auth/me');
      setMe(data);
      return data;
    } catch {
      setMe(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST', body: {} });
    } finally {
      setMe(null);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return <AuthContext.Provider value={{ me, loading, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

function FullScreenLoader() {
  return (
    <div className="min-h-screen bg-[--dark] grid place-items-center">
      <p className="font-mono2 text-xs text-[--dark-muted]"><span className="pulse-dot text-[--green]">●</span> Loading …</p>
    </div>
  );
}

export function RequireAuth({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const { me, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!me) return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  if (admin && !me.user.isPlatformAdmin) return <Navigate to="/app" replace />;
  return <>{children}</>;
}
