import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { publicApi, api, refreshSession, tokens, type Session } from '../api/http';

type User = Session['user'];
interface Ctx {
  user: User | null;
  /** true until we know whether a saved session exists */
  restoring: boolean;
  login(identifier: string, password: string): Promise<User>;
  register(input: Record<string, unknown>): Promise<User>;
  logout(): Promise<void>;
}
const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let live = true;
    void (tokens.refresh ? refreshSession() : Promise.resolve(null)).then((s) => {
      if (!live) return;
      setUser(s?.user ?? null);
      setRestoring(false);
    });
    return () => {
      live = false;
    };
  }, []);

  const accept = useCallback((s: Session) => {
    tokens.set(s.accessToken, s.refreshToken);
    setUser(s.user);
    return s.user;
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      user,
      restoring,
      login: async (identifier, password) =>
        accept(await publicApi<Session>('POST', '/auth/login', { identifier, password })),
      register: async (input) => accept(await publicApi<Session>('POST', '/auth/register', input)),
      logout: async () => {
        const refreshToken = tokens.refresh;
        try {
          await api('POST', '/auth/logout', refreshToken ? { refreshToken } : {});
        } catch {
          /* the local session ends either way */
        }
        tokens.clear();
        setUser(null);
      },
    }),
    [user, restoring, accept],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Ctx {
  const c = useContext(SessionContext);
  if (!c) throw new Error('useSession outside SessionProvider');
  return c;
}

export const homeFor = (role: User['role']): string =>
  role === 'ENGINEER' ? '/engineer' : role === 'ADMIN' ? '/admin/engineers' : '/customer';
