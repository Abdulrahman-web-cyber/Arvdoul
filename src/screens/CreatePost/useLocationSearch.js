// src/screens/CreatePost/useLocationSearch.js
import { useEffect, useRef, useState } from 'react';

export function useLocationSearch(query, { debounceMs = 350, limit = 5, enabled = true } = {}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const abortRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    clearTimeout(timerRef.current);
    abortRef.current?.abort();

    const trimmed = typeof query === 'string' ? query.trim() : '';
    if (!enabled || trimmed.length < 2) {
      setSuggestions([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&limit=${limit}`,
          {
            headers: { 'User-Agent': 'ArvdoulApp/1.0' },
            signal: controller.signal,
          }
        );
        if (!res.ok) {
          throw new Error(`Location service returned ${res.status}`);
        }
        const data = await res.json();
        if (!controller.signal.aborted) {
          const mapped = (Array.isArray(data) ? data : []).map((d) => ({
            displayName: d.display_name,
            lat: parseFloat(d.lat),
            lon: parseFloat(d.lon),
          }));
          setSuggestions(mapped);
          setOpen(true);
        }
      } catch (err) {
        if (controller.signal.aborted || err?.name === 'AbortError') return;
        console.warn('[useLocationSearch] Lookup failed:', err?.message);
        setSuggestions([]);
        setError('Location lookup unavailable');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      clearTimeout(timerRef.current);
      controller.abort();
    };
  }, [query, debounceMs, limit, enabled]);

  return { suggestions, loading, error, open, setOpen };
}
