import React from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";

export default function TrendingWidget({ items = [
  { id: 1, title: 'AI Art Trend', count: 12400 },
  { id: 2, title: 'Reels Remix', count: 9800 },
  { id: 3, title: 'Live Gifts', count: 8200 },
] }) {
  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-4 shadow-lg" aria-label="Trending widget">
      <h3 className="font-bold text-sm mb-3 text-violet-300">Trending</h3>
      <div className="space-y-2">
        {items.map((t) => (
          <a key={t.id} href="/explore" className="block text-sm text-white/90 hover:text-violet-300 transition-colors" aria-label={`Trending: ${t.title}`}>
            #{t.title} <span className="text-xs text-white/40">{t.count.toLocaleString()} views</span>
          </a>
        ))}
      </div>
    </div>
  );
}