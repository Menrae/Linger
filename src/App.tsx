import { useEffect } from 'react';
import { MapView } from './components/map/MapView';
import { useAuthStore } from './store/authStore';
import { supabase } from './lib/supabase';
import { useFilterSync } from './hooks/useFilterSync';

async function fetchDisplayName(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();
  return (data as { display_name: string | null } | null)?.display_name ?? null;
}

function App() {
  useFilterSync(); // keeps URL query params in sync with filterStore for the app lifetime
  const setUser = useAuthStore((s) => s.setUser);
  const setDisplayName = useAuthStore((s) => s.setDisplayName);
  const setLoading = useAuthStore((s) => s.setLoading);
  const loading = useAuthStore((s) => s.loading);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setDisplayName(await fetchDisplayName(session.user.id));
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        void fetchDisplayName(session.user.id).then(setDisplayName);
      } else {
        setDisplayName(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, setDisplayName, setLoading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-gray-900">
        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <MapView />;
}

export default App;
