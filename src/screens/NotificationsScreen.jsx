import React from 'react';
import { Bell, Check, Filter } from 'lucide-react';

export default function NotificationsScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 text-white" aria-label="Notifications screen" role="main">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Notifications</h1>
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-lg">
          <div className="flex gap-3 mb-4 overflow-x-auto pb-2" role="tablist" aria-label="Notification filters">
            {['All', 'Likes', 'Comments', 'Follows', 'Gifts', 'Mentions'].map((f) => (
              <button key={f} className="px-3 py-1.5 rounded-full bg-white/10 text-sm whitespace-nowrap" aria-label={`${f} filter`} role="tab">{f}</button>
            ))}
          </div>
          <div className="space-y-3">
            {[
              { title: 'Maria liked your reel', time: '2m ago', unread: true },
              { title: 'New comment on your post', time: '15m ago', unread: true },
              { title: 'Ahmed started following you', time: '1h ago', unread: false },
            ].map((n) => (
              <button key={n.title} className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors" aria-label={n.title}>
                <div className={`w-2 h-2 rounded-full ${n.unread ? 'bg-violet-400' : 'bg-transparent'}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-white/40">{n.time}</p>
                </div>
                <Check className="w-4 h-4 text-white/40" aria-hidden="true" />
              </button>
            ))}
          </div>
          <button className="mt-4 w-full py-2 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-500 transition-colors" aria-label="Mark all read">Mark All Read</button>
        </div>
      </div>
    </div>
  );
}
