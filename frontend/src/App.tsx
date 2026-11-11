import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, advanceSession } from './lib/api';
import type { User } from './lib/types';
import { AppShell, type View } from './components/AppShell';
import { ErrorState, Loading } from './components/Feedback';
import { AuthPage } from './features/auth/AuthPage';
import { DailyPage } from './features/readings/DailyPage';
import { ReportsPage } from './features/reports/ReportsPage';

function announceSessionChange() {
  advanceSession();
  try {
    localStorage.setItem('sweety-session-change', crypto.randomUUID());
  } catch {
    /* Storage can be disabled by the browser. */
  }
}

export default function App() {
  const client = useQueryClient();
  const [view, setView] = useState<View>('daily');
  const [expired, setExpired] = useState(false);
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api.me();
      } catch (error) {
        // Being logged out is a normal state, not a failed query to retry on focus.
        if (error instanceof ApiError && error.status === 401) return { user: null };
        throw error;
      }
    },
    retry: false,
    staleTime: Infinity,
  });
  const meta = useQuery({
    queryKey: ['meta'],
    queryFn: api.meta,
    enabled: Boolean(me.data?.user),
    staleTime: 30000,
    refetchInterval: 60000,
  });
  useEffect(() => {
    function synchronize(event: StorageEvent) {
      if (event.key !== 'sweety-session-change') return;
      advanceSession();
      void client.cancelQueries().then(() => {
        client.removeQueries({
          predicate: (query) => !['me', 'meta'].includes(String(query.queryKey[0])),
        });
        client.setQueryData(['me'], null);
        setView('daily');
        void client.invalidateQueries({ queryKey: ['me'] });
      });
    }
    window.addEventListener('storage', synchronize);
    function expire() {
      void client.cancelQueries().then(() => {
        client.removeQueries({
          predicate: (query) => !['me', 'meta'].includes(String(query.queryKey[0])),
        });
        setExpired(true);
        client.setQueryData(['me'], null);
      });
    }
    window.addEventListener('session-expired', expire);
    return () => {
      window.removeEventListener('session-expired', expire);
      window.removeEventListener('storage', synchronize);
    };
  }, [client]);
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: async () => {
      announceSessionChange();
      await client.cancelQueries();
      client.removeQueries({
        predicate: (query) => !['me', 'meta'].includes(String(query.queryKey[0])),
      });
      setExpired(false);
      setView('daily');
      client.setQueryData(['me'], null);
    },
  });
  function login(user: User) {
    announceSessionChange();
    client.removeQueries({
      predicate: (query) => !['me', 'meta'].includes(String(query.queryKey[0])),
    });
    client.setQueryData(['me'], { user });
    setExpired(false);
    setView('daily');
  }
  if (me.isPending)
    return (
      <div className="app-loading">
        <Loading label="Opening your journal…" />
      </div>
    );
  if (me.isError)
    return (
      <div className="app-loading">
        <ErrorState error={me.error} retry={() => void me.refetch()} />
      </div>
    );
  if (!me.data?.user) return <AuthPage onSuccess={login} expired={expired} />;
  return (
    <AppShell
      user={me.data.user}
      view={view}
      onView={setView}
      onLogout={() => logout.mutate()}
      loggingOut={logout.isPending}
    >
      {logout.isError && <ErrorState error={logout.error} />}
      {!meta.data && meta.isPending ? (
        <Loading label="Checking the date…" />
      ) : !meta.data && meta.isError ? (
        <ErrorState error={meta.error} retry={() => void meta.refetch()} />
      ) : (
        <>
          {view === 'daily' ? (
            <DailyPage
              user={me.data.user}
              today={meta.data.today}
              onReports={() => setView('reports')}
            />
          ) : (
            <ReportsPage today={meta.data.today} onLog={() => setView('daily')} />
          )}
          <p className="timezone-note">
            Dates follow {meta.data.timezone.replaceAll('_', ' ')} time.
          </p>
        </>
      )}
    </AppShell>
  );
}
