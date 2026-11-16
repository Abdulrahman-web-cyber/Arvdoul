// src/components/Admin/AdminNavHeader.jsx

import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

const ADMIN_NAV_ITEMS = [
  { label: 'Overview', path: '/admin' },
  { label: 'Users', path: '/admin/users' },
  { label: 'Moderation', path: '/admin/moderation' },
  { label: 'Content', path: '/admin/content' },
  { label: 'Economy', path: '/admin/economy' },
  { label: 'Verification', path: '/admin/verification' },
  { label: 'Communities', path: '/admin/communities' },
  { label: 'Flags', path: '/admin/flags' },
  { label: 'Health', path: '/admin/health' },
  { label: 'Audit Logs', path: '/admin/audit-logs' },
  { label: 'Tickets', path: '/admin/tickets' },
];

export default function AdminNavHeader({
  title,
  subtitle,
  backTo = '/admin',
  showBack = true,
  actions = null,
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {showBack && pathname !== '/admin' && (
            <button
              type="button"
              onClick={() => navigate(backTo)}
              aria-label="Back to Admin"
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <Shield className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Admin</span>
              <span aria-hidden="true">/</span>
              <span className="text-slate-900 dark:text-slate-200 truncate">{title}</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight truncate mt-0.5">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>

      <nav
        aria-label="Admin sections"
        className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-5 overflow-x-auto border-t border-slate-100 dark:border-slate-800/80 scrollbar-none"
      >
        {ADMIN_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.path;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className={`py-2.5 text-xs font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                isActive
                  ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-semibold'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
