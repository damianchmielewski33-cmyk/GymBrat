/* Minimalny loader Maps JavaScript API (bez dodatkowych zależności). */
type GMaps = typeof google.maps;

let loading: Promise<GMaps> | null = null;

export function loadGoogleMaps(key: string): Promise<GMaps> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (loading) return loading;
  loading = new Promise<GMaps>((resolve, reject) => {
    const cb = "__gymbratMapsReady";
    (window as unknown as Record<string, () => void>)[cb] = () => resolve(window.google.maps);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=${cb}&loading=async&language=pl&v=weekly`;
    s.async = true;
    s.onerror = () => {
      loading = null;
      reject(new Error("maps-load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}
