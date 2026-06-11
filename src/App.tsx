import { useEffect } from 'react';
import { MapView } from './components/map/MapView';
import { useAuthStore } from './store/authStore';
import { supabase } from './lib/supabase';
import { useFilterSync } from './hooks/useFilterSync';
import { ToastContainer } from './components/ui/Toast';

type ProfileRow = { display_name: string | null; avatar_url: string | null };

async function fetchProfile(userId: string): Promise<ProfileRow> {
  const { data } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', userId)
    .maybeSingle();
  const row = data as ProfileRow | null;
  return { display_name: row?.display_name ?? null, avatar_url: row?.avatar_url ?? null };
}

function App() {
  useFilterSync(); // keeps URL query params in sync with filterStore for the app lifetime
  const setUser = useAuthStore((s) => s.setUser);
  const setDisplayName = useAuthStore((s) => s.setDisplayName);
  const setAvatarUrl = useAuthStore((s) => s.setAvatarUrl);
  const setLoading = useAuthStore((s) => s.setLoading);
  const loading = useAuthStore((s) => s.loading);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setDisplayName(profile.display_name);
        setAvatarUrl(profile.avatar_url);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        void fetchProfile(session.user.id).then((profile) => {
          setDisplayName(profile.display_name);
          setAvatarUrl(profile.avatar_url);
        });
      } else {
        setDisplayName(null);
        setAvatarUrl(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, setDisplayName, setAvatarUrl, setLoading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-gray-900">
        <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <MapView />
      <ToastContainer />
    </>
  );
}

export default App;
