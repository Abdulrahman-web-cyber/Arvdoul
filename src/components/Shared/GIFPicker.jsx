// src/components/Shared/GIFPicker.jsx - ARVDOUL GIF PICKER (REAL)
// Giphy-powered search with debounce, keyboard nav, and a graceful
// unconfigured state (requires VITE_GIPHY_API_KEY).
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2, X } from 'lucide-react';

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || null;
const GIPHY_ENDPOINT = 'https://api.giphy.com/v1/gifs/search';

export default function GIFPicker({ onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

  const search = useCallback(async (q) => {
    if (!GIPHY_API_KEY) { setResults([]); return; }
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${GIPHY_ENDPOINT}?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(q)}&limit=24&rating=g&lang=en`
      );
      if (!res.ok) throw new Error('GIF search failed.');
      const data = await res.json();
      setResults(data.data || []);
    } catch (err) {
      setError('Could not load GIFs. Check your connection or Giphy key.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  return (
    <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-700">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search GIFs…"
          className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-500"
        />
        <button onClick={onClose} aria-label="Close" className="p-1 rounded-full hover:bg-white/10 text-gray-400">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="h-64 overflow-y-auto p-2">
        {!GIPHY_API_KEY ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <p className="text-sm text-gray-400 mb-1">GIF search needs a Giphy API key.</p>
            <p className="text-xs text-gray-500">
              Set <code className="bg-white/10 px-1 py-0.5 rounded">VITE_GIPHY_API_KEY</code> to enable GIFs.
            </p>
          </div>
        ) : loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-400 text-center pt-8 px-4">{error}</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-gray-500 text-center pt-8 px-4">
            {query ? 'No GIFs found — try another search.' : 'Search for GIFs to add to your post.'}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {results.map((gif) => (
              <button
                key={gif.id}
                onClick={() => onSelect?.(gif.images?.fixed_width?.url || gif.images?.original?.url, gif)}
                className="aspect-square overflow-hidden rounded-lg bg-gray-800 hover:opacity-90 transition"
              >
                <img
                  src={gif.images?.fixed_width_small?.url || gif.images?.fixed_width?.url}
                  alt={gif.title || 'GIF'}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
