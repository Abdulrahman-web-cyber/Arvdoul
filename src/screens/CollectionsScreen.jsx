import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderOpen, Plus, Trash2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function CollectionsScreen() {
  const { user } = useAuth();
  const [collections, setCollections] = useState([
    { id: 'c1', title: 'Design Ideas', count: 12, cover: '/assets/default-profile.png' },
    { id: 'c2', title: 'Travel', count: 8, cover: '/assets/default-profile.png' },
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950 to-fuchsia-950 text-white" aria-label="Collections screen" role="main">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <button onClick={() => window.history.back()} aria-label="Back" className="flex items-center gap-2 text-white/60 hover:text-white mb-4">
          <ArrowLeft className="w-5 h-5" /> Back
        </button>
        <h1 className="text-3xl font-bold mb-2 tracking-tight">Collections</h1>
        <p className="text-white/50 text-sm mb-6">Organize your saved posts into folders.</p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {collections.map((c) => (
            <button key={c.id} aria-label={`Collection ${c.title}`} className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 text-left hover:bg-white/10 transition-colors shadow-lg">
              <div className="flex justify-between items-start mb-3">
                <FolderOpen className="w-6 h-6 text-violet-300" />
                <button onClick={() => setCollections(collections.filter(x => x.id !== c.id))} aria-label={`Delete collection ${c.title}`} className="text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
              </div>
              <h3 className="font-semibold">{c.title}</h3>
              <p className="text-xs text-white/40">{c.count} items</p>
            </button>
          ))}
          <button onClick={() => setCollections([...collections, { id: Date.now().toString(), title: 'New Collection', count: 0, cover: '/assets/default-profile.png' }])} aria-label="Create new collection" className="backdrop-blur-xl bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 border border-dashed border-white/30 rounded-2xl p-4 flex flex-col items-center justify-center hover:border-white/60 transition-colors min-h-[140px]">
            <Plus className="w-8 h-8 text-violet-300 mb-2" />
            <span className="text-sm font-medium">New Collection</span>
          </button>
        </div>
      </div>
    </div>
  );
}
