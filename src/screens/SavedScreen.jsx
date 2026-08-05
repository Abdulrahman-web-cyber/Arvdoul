import React, { useState } from 'react';
import { ArrowLeft, Bookmark, Trash2 } from 'lucide-react';

export default function SavedScreen() {
  const [items, setItems] = useState([
    { id: 's1', title: 'Mountain Sunset', type: 'image', savedAt: '2h ago' },
    { id: 's2', title: 'City Night', type: 'video', savedAt: '5h ago' },
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 text-white" aria-label="Saved screen" role="main">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <button onClick={() => window.history.back()} aria-label="Back" className="flex items-center gap-2 text-white/60 hover:text-white mb-4"><ArrowLeft className="w-5 h-5" /> Back</button>
        <h1 className="text-3xl font-bold mb-2">Saved</h1>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-4 shadow-lg" aria-label={`Saved ${item.title}`}>
              <Bookmark className="w-6 h-6 text-violet-300" />
              <div className="flex-1">
                <h3 className="font-medium">{item.title}</h3>
                <p className="text-xs text-white/40">{item.type} · {item.savedAt}</p>
              </div>
              <button onClick={() => setItems(items.filter(i => i.id !== item.id))} aria-label={`Remove ${item.title}`} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          {items.length === 0 && <p className="text-white/40 text-sm">Nothing saved yet.</p>}
        </div>
      </div>
    </div>
  );
}
