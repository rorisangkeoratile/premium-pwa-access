import { useEffect, useState } from "react";

export type GeoFix = { lat: number; lng: number; accuracy: number };

function describe(error: GeolocationPositionError | Error): string {
  if ("code" in error) {
    if (error.code === error.PERMISSION_DENIED) return "Location permission was denied. Allow location access in your browser, or drop the pin on the map.";
    if (error.code === error.POSITION_UNAVAILABLE) return "Your location is unavailable right now. Drop the pin on the map instead.";
    if (error.code === error.TIMEOUT) return "Finding your location took too long. Try again, or drop the pin on the map.";
  }
  return error.message;
}

const options: PositionOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };
const toFix = (p: GeolocationPosition): GeoFix => ({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });

export function detectPosition(): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("This device or browser does not support location detection."));
      return;
    }
    navigator.geolocation.getCurrentPosition((p) => resolve(toFix(p)), (e) => reject(new Error(describe(e))), options);
  });
}

/** Continuous GPS tracking while `enabled`. */
export function useWatchPosition(enabled: boolean) {
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("GPS is not supported on this device.");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setFix(toFix(p));
        setError(null);
      },
      (e) => setError(describe(e)),
      { ...options, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return { fix, error };
}

/** Best-effort street address for a pin, from OpenStreetMap's Nominatim service. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}`);
    if (!response.ok) return null;
    const data = (await response.json()) as { display_name?: string };
    return data.display_name ?? null;
  } catch {
    return null;
  }
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
