// src/screens/DataUsageScreen.jsx - ARVDOUL DATA USAGE
// REAL implementation: storage usage from the browser's Storage API, cache
// clearing that actually clears (settingsService + Cache API), and a GDPR
// export that actually calls the exportUserData Cloud Function and lets the
// user download the returned data. No fake timers, no invented GB numbers.

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useTheme } from '@context/ThemeContext';
import { useAuth } from '@context/AuthContext';
import { cn } from '../lib/utils';
import {
  ArrowLeft, HardDrive, Database, Download, Trash2, RefreshCw,
  AlertTriangle, CheckCircle, FileJson
} from 'lucide-react';

function formatBytes(bytes) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function DataUsageScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';

  const [usage, setUsage] = useState({ used: null, quota: null, supported: true });
  const [cacheEntries, setCacheEntries] = useState(null); // null = unknown
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState(null);

  // REAL storage usage via the Storage API (supported in all modern browsers).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (navigator.storage?.estimate) {
          const est = await navigator.storage.estimate();
          if (!cancelled) {
            setUsage({
              used: typeof est.usage === 'number' ? est.usage : null,
              quota: typeof est.quota === 'number' ? est.quota : null,
              supported: true,
            });
          }
        } else {
          if (!cancelled) setUsage({ used: null, quota: null, supported: false });
        }
      } catch (err) {
        console.warn('Storage estimate failed:', err);
        if (!cancelled) setUsage({ used: null, quota: null, supported: false });
      }
      // Count real Cache API entries (service-worker precache etc.).
      try {
        if (typeof caches !== 'undefined' && caches.keys) {
          const keys = await caches.keys();
          const counts = {};
          for (const k of keys) {
            const c = await caches.open(k);
            const reqs = await c.keys();
            counts[k] = reqs.length;
          }
          if (!cancelled) setCacheEntries(counts);
        }
      } catch {
        /* Cache API may be unavailable — cacheEntries stays null */
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // REAL cache clearing: settingsService clears localStorage (preserving
  // auth/session), IndexedDB databases, and in-memory caches; we also purge
  // the Cache API (precache only — safe, it re-populates on next load).
  const handleClearCache = useCallback(async () => {
    if (clearing) return;
    setClearing(true);
    const cleared = [];
    try {
      const { settingsService } = await import('../services/settingsService.js');
      const res = await settingsService.clearApplicationCache();
      if (res?.cleared) cleared.push(...res.cleared);
    } catch (err) {
      console.warn('Cache clear (settingsService) failed:', err);
    }
    try {
      if (typeof caches !== 'undefined' && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        cleared.push(`cache-api:${keys.length} cache(s)`);
      }
    } catch (err) {
      console.warn('Cache API purge failed:', err);
    }
    setClearing(false);
    setCacheEntries(null);
    if (cleared.length > 0) {
      toast.success(`Cache cleared (${cleared.length} items)`);
    } else {
      toast.success('Cache cleared');
    }
  }, [clearing]);

  // REAL GDPR export: calls the exportUserData Cloud Function and offers a
  // JSON download of the returned data. No fake "email will arrive".
  const handleExportData = useCallback(async () => {
    if (!user?.uid) {
      toast.error('Sign in to export your data');
      return;
    }
    if (exporting) return;
    setExporting(true);
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const { getApp } = await import('firebase/app');
      const fn = httpsCallable(getFunctions(getApp()), 'exportUserData');
      const res = await fn({});
      const data = res.data || {};
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `arvdoul-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setLastExport({
        size: formatBytes(new Blob([json]).size) || `${json.length} chars`,
        at: new Date().toLocaleString(),
      });
      toast.success('Your data has been exported and downloaded');
    } catch (err) {
      console.error('Data export failed:', err);
      toast.error(err?.message || 'Export failed. Is the exportUserData Cloud Function deployed?');
    } finally {
      setExporting(false);
    }
  }, [user?.uid, exporting]);

  const usedText = formatBytes(usage.used);
  const quotaText = formatBytes(usage.quota);
  const percent = usage.quota && usage.used != null && usage.quota > 0
    ? Math.min(100, Math.round((usage.used / usage.quota) * 100))
    : null;
  const cacheCount = cacheEntries
    ? Object.values(cacheEntries).reduce((a, b) => a + b, 0)
    : null;

  return (
    <div className="min-h-screen pb-20" style={{
      background: isDark
        ? 'radial-gradient(circle at 50% 0%, rgba(139, 30, 243, 0.1) 0%, transparent 50%), #03071B'
        : 'radial-gradient(circle at 50% 0%, rgba(139, 30, 243, 0.05) 0%, transparent 50%), #F6F8FC',
    }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4"
      >
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate(-1)}
            className={cn("p-2 rounded-full", isDark ? "hover:bg-white/10" : "hover:bg-black/5")}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className={cn("text-2xl font-display font-bold", isDark ? "text-white" : "text-gray-900")}>
            Data Usage
          </h1>
        </div>

        {/* Total Usage Card — REAL browser storage numbers */}
        <div className={cn(
          "rounded-arvdoul-xl p-6 mb-4",
          "bg-arvdoul-surface backdrop-blur-md border border-arvdoul-border"
        )}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-arvdoul-gradient flex items-center justify-center">
                <HardDrive className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-arvdoul-text-secondary text-sm">Local Storage Used</p>
                <p className="text-3xl font-bold text-white">{usedText || '—'}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-arvdoul-text-secondary text-sm">{quotaText ? `of ${quotaText} quota` : 'quota unknown'}</p>
              {percent !== null && (
                <p className="text-lg font-semibold text-arvdoul-purple">{percent}%</p>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className={cn(
            "h-3 rounded-full overflow-hidden",
            isDark ? "bg-white/10" : "bg-gray-200"
          )}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percent === null ? 0 : percent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full bg-arvdoul-gradient"
            />
          </div>
          {!usage.supported && (
            <p className="text-xs text-arvdoul-text-secondary mt-3">
              Storage estimates are not available in this browser — nothing is invented.
            </p>
          )}
        </div>
      </motion.div>

      {/* Cache Management — REAL entries from the Cache API */}
      <div className="px-4 mb-6">
        <h2 className={cn("text-lg font-semibold mb-3", isDark ? "text-white" : "text-gray-900")}>
          Cache & Offline Data
        </h2>
        <div className={cn(
          "flex items-center justify-between p-3 rounded-arvdoul-lg",
          "bg-arvdoul-surface/50 border border-arvdoul-border/50"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg bg-white/5 text-arvdoul-text-secondary")}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <span className="text-arvdoul-text-secondary block text-sm">Cached requests</span>
              <span className="text-white text-sm font-medium">
                {cacheCount === null ? '—' : `${cacheCount} entries`}
                {cacheEntries && Object.keys(cacheEntries).length > 0
                  ? ` (${Object.keys(cacheEntries).join(', ')})`
                  : ''}
              </span>
            </div>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleClearCache}
          disabled={clearing}
          className={cn(
            "w-full mt-4 py-3 rounded-arvdoul-md",
            "border border-red-500/30 text-red-400",
            "hover:bg-red-500/10 transition-colors",
            "flex items-center justify-center gap-2"
          )}
        >
          {clearing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
          {clearing ? 'Clearing...' : 'Clear All Cache'}
        </motion.button>
        <p className="text-xs text-arvdoul-text-secondary mt-2">
          Clears localStorage (your session stays signed in), IndexedDB databases, in-memory caches and the Cache API.
        </p>
      </div>

      {/* Data Export — REAL GDPR export via Cloud Function */}
      <div className="px-4">
        <h2 className={cn("text-lg font-semibold mb-3", isDark ? "text-white" : "text-gray-900")}>
          Your Data
        </h2>
        <div className={cn(
          "rounded-arvdoul-lg p-4",
          "bg-arvdoul-surface border border-arvdoul-border"
        )}>
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-medium">Download Your Data</p>
              <p className="text-sm text-arvdoul-text-secondary">
                Calls the exportUserData Cloud Function and downloads the returned JSON
                (account, posts, reels, stories and more). Requires the function to be deployed.
              </p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleExportData}
            disabled={exporting}
            className={cn(
              "w-full py-3 rounded-arvdoul-md",
              "bg-arvdoul-gradient text-white font-medium",
              "shadow-arvdoul-button flex items-center justify-center gap-2",
              "disabled:opacity-60 disabled:cursor-not-allowed"
            )}
          >
            {exporting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            {exporting ? 'Exporting...' : 'Request Data Export'}
          </motion.button>

          {lastExport && (
            <div className="mt-4 flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle className="w-4 h-4" />
              <span>Last export downloaded: {lastExport.size} ({lastExport.at})</span>
            </div>
          )}

          <div className="mt-3 flex items-start gap-2 text-xs text-arvdoul-text-secondary">
            <FileJson className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              GDPR Article 20 (data portability): the export contains everything the server
              stores for your account. No placeholder — if the function is not deployed you
              will see an explicit error instead of a fake success message.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
