import { useState, useEffect } from 'react';

interface UserLocation {
  lat: number;
  lng: number;
  zoom: number;
  loading: boolean;
}

const US_CENTER: UserLocation = { lat: 39.8283, lng: -98.5795, zoom: 4, loading: false };

export function useUserLocation(): UserLocation {
  const [location, setLocation] = useState<UserLocation>({ ...US_CENTER, loading: true });

  useEffect(() => {
    if (!navigator.geolocation) {
      fallbackToIp();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          zoom: 13,
          loading: false,
        });
      },
      () => fallbackToIp(),
      { timeout: 8000 },
    );
  }, []);

  async function fallbackToIp() {
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (!res.ok) throw new Error('ip fetch failed');
      const data = await res.json();
      if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
        throw new Error('bad ip data');
      }
      setLocation({ lat: data.latitude, lng: data.longitude, zoom: 11, loading: false });
    } catch {
      setLocation(US_CENTER);
    }
  }

  return location;
}
