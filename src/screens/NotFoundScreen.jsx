import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFoundScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950 to-fuchsia-950 text-white flex flex-col items-center justify-center" aria-label="404 not found" role="main">
      <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400 mb-4">404</h1>
      <h2 className="text-2xl font-bold mb-2">Page not found</h2>
      <p className="text-white/60 mb-6">The link you followed may be broken or the page may have been removed.</p>
      <Link to="/home" className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-medium shadow-lg hover:shadow-xl transition-all" aria-label="Return to home">
        <ArrowLeft className="w-5 h-5" /> Go Home
      </Link>
    </div>
  );
}
