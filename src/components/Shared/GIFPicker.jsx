// src/components/Shared/GIFPicker.jsx - ARVDOUL DUAL-MODE GIF PICKER
// Supports live Giphy API searches when VITE_GIPHY_API_KEY is configured,
// and features a rich curated set of categorized animated reaction GIFs
// so users can always pick and insert GIFs without any setup.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2, X, Sparkles, Flame, Heart, Smile, ThumbsUp, PartyPopper } from 'lucide-react';
import { cn } from '../../lib/utils';

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || null;
const GIPHY_ENDPOINT = 'https://api.giphy.com/v1/gifs/search';

// High-quality reliable curated animated reaction GIFs & stickers with tags
const CURATED_CATEGORIES = [
  { id: 'all', label: 'Trending', icon: Flame },
  { id: 'reactions', label: 'Reactions', icon: Smile },
  { id: 'love', label: 'Love', icon: Heart },
  { id: 'cheers', label: 'Celebrate', icon: PartyPopper },
  { id: 'hype', label: 'Hype', icon: ThumbsUp },
];

const CURATED_GIFS = [
  {
    id: 'c-1',
    title: 'Clapping Bravo',
    category: 'reactions',
    tags: ['clap', 'applause', 'bravo', 'congrats', 'good'],
    url: 'https://media.giphy.com/media/l3q2XhfQ8oCkm1GhO/giphy.gif',
    thumb: 'https://media.giphy.com/media/l3q2XhfQ8oCkm1GhO/200w.gif',
  },
  {
    id: 'c-2',
    title: 'Mind Blown',
    category: 'reactions',
    tags: ['mind', 'blown', 'wow', 'omg', 'shock', 'amazing'],
    url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
    thumb: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/200w.gif',
  },
  {
    id: 'c-3',
    title: 'Party Confetti Celebration',
    category: 'cheers',
    tags: ['party', 'celebrate', 'cheers', 'confetti', 'yay', 'birthday'],
    url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
    thumb: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/200w.gif',
  },
  {
    id: 'c-4',
    title: 'Big Heart Love',
    category: 'love',
    tags: ['heart', 'love', 'sweet', 'cute', 'kiss', 'adore'],
    url: 'https://media.giphy.com/media/M90mJvfWfd5mbUuULX/giphy.gif',
    thumb: 'https://media.giphy.com/media/M90mJvfWfd5mbUuULX/200w.gif',
  },
  {
    id: 'c-5',
    title: 'Thumbs Up Approval',
    category: 'hype',
    tags: ['thumbs', 'up', 'yes', 'agree', 'cool', 'nice'],
    url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
    thumb: 'https://media.giphy.com/media/111ebonMs90YLu/200w.gif',
  },
  {
    id: 'c-6',
    title: 'Dancing Happy Celebration',
    category: 'cheers',
    tags: ['dance', 'happy', 'groove', 'vibe', 'fun', 'music'],
    url: 'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif',
    thumb: 'https://media.giphy.com/media/blSTtZehjAZ8I/200w.gif',
  },
  {
    id: 'c-7',
    title: 'Fire Flame Lit',
    category: 'hype',
    tags: ['fire', 'flame', 'lit', 'hype', 'awesome', 'hot'],
    url: 'https://media.giphy.com/media/Lopx9eUi34rbq/giphy.gif',
    thumb: 'https://media.giphy.com/media/Lopx9eUi34rbq/200w.gif',
  },
  {
    id: 'c-8',
    title: 'Laughing Out Loud',
    category: 'reactions',
    tags: ['lol', 'laugh', 'haha', 'funny', 'joke', 'rofl'],
    url: 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif',
    thumb: 'https://media.giphy.com/media/10JhviFuU2gWD6/200w.gif',
  },
  {
    id: 'c-9',
    title: 'Sending Hugs',
    category: 'love',
    tags: ['hug', 'warm', 'care', 'friend', 'cuddle', 'love'],
    url: 'https://media.giphy.com/media/3oEdv4hwWTzBhWvaU0/giphy.gif',
    thumb: 'https://media.giphy.com/media/3oEdv4hwWTzBhWvaU0/200w.gif',
  },
  {
    id: 'c-10',
    title: 'Popcorn Watching Drama',
    category: 'reactions',
    tags: ['popcorn', 'drama', 'watch', 'tea', 'entertaining', 'ready'],
    url: 'https://media.giphy.com/media/gl0mkIZOW6Nwc/giphy.gif',
    thumb: 'https://media.giphy.com/media/gl0mkIZOW6Nwc/200w.gif',
  },
  {
    id: 'c-11',
    title: 'Cheers Toast Champagne',
    category: 'cheers',
    tags: ['cheers', 'toast', 'drink', 'wine', 'champagne', 'celebration'],
    url: 'https://media.giphy.com/media/Zw3oBUuIg23EWvdvWK/giphy.gif',
    thumb: 'https://media.giphy.com/media/Zw3oBUuIg23EWvdvWK/200w.gif',
  },
  {
    id: 'c-12',
    title: 'Let\'s Go / Hype Fist Pump',
    category: 'hype',
    tags: ['letsgo', 'hype', 'victory', 'win', 'fistpump', 'yes'],
    url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
    thumb: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/200w.gif',
  },
];

export default function GIFPicker({ onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [apiResults, setApiResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

  const searchGiphy = useCallback(async (q) => {
    if (!GIPHY_API_KEY || !q.trim()) {
      setApiResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${GIPHY_ENDPOINT}?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(q)}&limit=24&rating=g&lang=en`
      );
      if (!res.ok) throw new Error('GIF search failed.');
      const data = await res.json();
      setApiResults(data.data || []);
    } catch (err) {
      console.warn('Giphy fetch error:', err);
      // Fallback silently to curated items matching query
      setApiResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (GIPHY_API_KEY && query.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => searchGiphy(query), 400);
      return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }
  }, [query, searchGiphy]);

  // Filter curated GIFs
  const filteredCurated = CURATED_GIFS.filter((gif) => {
    const matchesCat = selectedCategory === 'all' || gif.category === selectedCategory;
    if (!query.trim()) return matchesCat;
    const q = query.toLowerCase().trim();
    const matchesQuery =
      gif.title.toLowerCase().includes(q) ||
      gif.tags.some((t) => t.toLowerCase().includes(q));
    return matchesCat && matchesQuery;
  });

  const hasLiveApiResults = GIPHY_API_KEY && apiResults.length > 0;

  return (
    <div className="w-full max-w-md bg-gray-900 border border-gray-700/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
      {/* Header with Search */}
      <div className="flex items-center gap-2 px-3.5 py-3 border-b border-gray-800 bg-gray-950/60">
        <Search className="w-4 h-4 text-purple-400 shrink-0" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search GIFs & reactions…"
          className="flex-1 bg-transparent outline-none text-xs sm:text-sm text-white placeholder-gray-500"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="text-gray-400 hover:text-white p-1 text-xs"
          >
            Clear
          </button>
        )}
        <button
          onClick={onClose}
          aria-label="Close"
          className="p-1.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-800/60 overflow-x-auto scrollbar-hide bg-gray-900/80">
        {CURATED_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap flex items-center gap-1 transition",
                isActive
                  ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                  : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
              )}
            >
              <Icon className="w-3 h-3" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Body: Results Grid */}
      <div className="h-72 overflow-y-auto p-2.5 scrollbar-thin">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
          </div>
        ) : hasLiveApiResults ? (
          <div className="grid grid-cols-3 gap-1.5">
            {apiResults.map((gif) => (
              <button
                key={gif.id}
                onClick={() => onSelect?.(gif.images?.fixed_width?.url || gif.images?.original?.url, gif)}
                className="aspect-square overflow-hidden rounded-xl bg-gray-800 hover:scale-105 active:scale-95 transition group relative"
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
        ) : filteredCurated.length > 0 ? (
          <div className="grid grid-cols-3 gap-1.5">
            {filteredCurated.map((gif) => (
              <button
                key={gif.id}
                onClick={() => onSelect?.(gif.url, gif)}
                className="aspect-square overflow-hidden rounded-xl bg-gray-800 hover:scale-105 active:scale-95 transition group relative"
                title={gif.title}
              >
                <img
                  src={gif.thumb || gif.url}
                  alt={gif.title}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                  <span className="text-[10px] text-white font-medium truncate drop-shadow">{gif.title}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <Sparkles className="w-8 h-8 text-purple-400 mb-2 opacity-60" />
            <p className="text-xs text-gray-400">No matching GIFs found</p>
            <p className="text-[11px] text-gray-500 mt-0.5">Try searching for &apos;party&apos;, &apos;love&apos;, &apos;clap&apos;, or select another category</p>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <div className="px-3 py-1.5 bg-gray-950/80 border-t border-gray-800 text-[10px] text-gray-500 flex items-center justify-between">
        <span>Arvdoul Instant Reactions</span>
        <span className="text-purple-400 font-semibold">Ready to share</span>
      </div>
    </div>
  );
}
