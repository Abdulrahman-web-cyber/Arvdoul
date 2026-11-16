// src/screens/Admin/AdminSystemHealthScreen.jsx

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  RefreshCw,
  Database,
  Shield,
  Wifi,
  HardDrive,
  Cpu,
  Radio,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { rumService } from '../../services/rumService.js';
import { backfillPostPrivacy, fetchAdminStatus } from '../../services/callableService.js';
import PermissionDenied from '../../design-system/PermissionDenied.jsx';
import AdminNavHeader from '../../components/Admin/AdminNavHeader.jsx';

const AdminSystemHealthScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [denied, setDenied] = useState(false);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState(new Date().toLocaleTimeString());
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillResult, setBackfillResult] = useState(null);

  const [services, setServices] = useState([
    { id: 'db', name: 'Firestore Database', icon: Database, status: 'unknown', latency: null, details: 'Not probed yet — run a health check.' },
    { id: 'auth', name: 'Firebase Identity & Auth', icon: Shield, status: 'unknown', latency: null, details: 'Sign-in is validated by the current session.' },
    { id: 'storage', name: 'Cloud Media Storage', icon: HardDrive, status: 'unknown', latency: null, details: 'Upload path is exercised when a file is sent.' },
    { id: 'streaming', name: 'Live Streaming Engine', icon: Radio, status: 'unknown', latency: null, details: 'WebRTC ingest reports its own connection state.' },
    { id: 'editor', name: 'Video/Audio Rendering Engine', icon: Cpu, status: 'unknown', latency: null, details: 'Client-side WebCodecs pipeline.' },
    { id: 'cdn', name: 'Edge Cache & Reverse Proxy', icon: Wifi, status: 'unknown', latency: null, details: 'Static bundle served from the CDN edge.' },
  ]);

  const [telemetry, setTelemetry] = useState({
    avgLatency: null,
    activeConnections: null,
    memoryHeapMb: null,
    fcpMs: null,
    lcpMs: null,
    longTasks: null,
    errorRate: null,
  });

  const networkType = (() => {
    try {
      return navigator?.connection?.effectiveType || 'unknown';
    } catch {
      return 'unknown';
    }
  })();

  const readSessionTelemetry = useCallback(() => {
    let fcp = null;
    let lcp = null;
    try {
      const paints = performance.getEntriesByType('paint') || [];
      const fcpEntry = paints.find((p) => p.name === 'first-contentful-paint');
      if (fcpEntry) fcp = Math.round(fcpEntry.startTime);
      const vitals = rumService.getWebVitals();
      lcp = vitals?.lcp != null ? Math.round(vitals.lcp) : null;
      setTelemetry((prev) => ({
        ...prev,
        fcpMs: fcp,
        lcpMs: lcp,
        memoryHeapMb: typeof performance.memory?.usedJSHeapSize === 'number'
          ? Math.round(performance.memory.usedJSHeapSize / (1024 * 1024))
          : null,
        longTasks: vitals?.longTasks ?? null,
      }));
    } catch {
      // Browser APIs unavailable — leave values as unknown.
    }
  }, []);

  useEffect(() => {
    const check = async () => {
      if (!user?.uid || !(await fetchAdminStatus())) {
        setDenied(true);
        return;
      }
      readSessionTelemetry();
    };
    check();
  }, [user?.uid, readSessionTelemetry]);

  const runPrivacyBackfill = async () => {
    setBackfillRunning(true);
    setBackfillResult(null);
    toast.info('Re-syncing post privacy flags…');
    try {
      const res = await backfillPostPrivacy();
      setBackfillResult(res || { usersScanned: null, postsUpdated: null });
      toast.success(`Scanned ${res?.usersScanned ?? '—'} users; updated ${res?.postsUpdated ?? '—'} posts.`);
    } catch (err) {
      toast.error(err?.message || 'Privacy backfill could not run.');
    } finally {
      setBackfillRunning(false);
    }
  };

  const runLiveDiagnostics = async () => {
    setRunningDiagnostics(true);
    toast.info('Running live platform health probe…');

    try {
      const { getAdminService } = await import('../../services/adminService.js');
      const { status: dbStatus, latencyMs: dbLatency } = await getAdminService().probeDatabase();

      setServices((prev) =>
        prev.map((s) =>
          s.id === 'db'
            ? {
                ...s,
                latency: dbLatency,
                status: dbStatus,
                details: dbStatus === 'operational'
                  ? 'Round-trip to Firestore measured just now.'
                  : 'Last probe failed; retry to re-measure.',
              }
            : s
        )
      );

      if (dbLatency !== null) setTelemetry((prev) => ({ ...prev, avgLatency: dbLatency }));

      readSessionTelemetry();
      setLastCheckTime(new Date().toLocaleTimeString());
      if (dbStatus === 'operational') {
        toast.success('Firestore probe succeeded.');
      } else {
        toast.warning('Firestore probe did not complete.');
      }
    } catch {
      toast.error('Diagnostic probe could not run.');
    } finally {
      setRunningDiagnostics(false);
    }
  };

  if (denied) {
    return <PermissionDenied onGoHome={() => navigate('/')} />;
  }

  return (
    <div id="admin-health-screen" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <AdminNavHeader
        title="System Health & Telemetry"
        subtitle="Real-time browser vitals, database round-trip probes, and privacy maintenance"
        actions={
          <button
            id="run-diagnostics-btn"
            type="button"
            onClick={runLiveDiagnostics}
            disabled={runningDiagnostics}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 rounded-lg transition disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${runningDiagnostics ? 'animate-spin' : ''}`} />
            <span>Run Health Check</span>
          </button>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500">Firestore Round-trip</span>
            <div className="text-xl font-bold mt-1 tabular-nums">
              {telemetry.avgLatency === null ? '—' : `${telemetry.avgLatency} ms`}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500">Long Tasks</span>
            <div className="text-xl font-bold mt-1 tabular-nums">
              {telemetry.longTasks === null ? '—' : telemetry.longTasks}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500">Client Memory</span>
            <div className="text-xl font-bold mt-1 tabular-nums">
              {telemetry.memoryHeapMb === null ? '—' : `${telemetry.memoryHeapMb} MB`}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500">First Contentful Paint</span>
            <div className="text-xl font-bold mt-1 tabular-nums">
              {telemetry.fcpMs === null ? '—' : `${telemetry.fcpMs} ms`}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500">Largest Contentful Paint</span>
            <div className="text-xl font-bold mt-1 tabular-nums">
              {telemetry.lcpMs === null ? '—' : `${telemetry.lcpMs} ms`}
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-500">Network</span>
            <div className="text-xl font-bold mt-1">
              {networkType}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold">Infrastructure Components</h2>
            <span className="text-xs text-slate-500 tabular-nums">Last checked: {lastCheckTime}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((svc) => {
              const Icon = svc.icon;
              return (
                <div
                  key={svc.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">{svc.name}</h3>
                        <span
                          className={`text-xs font-medium capitalize ${
                            svc.status === 'operational'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : svc.status === 'degraded'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {svc.status}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{svc.details}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 tabular-nums">
                    <span>Latency: <strong className="text-slate-900 dark:text-white">{svc.latency === null ? '—' : `${svc.latency}ms`}</strong></span>
                    <span className="capitalize">{svc.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Maintenance Operations</h2>
            <span className="text-xs text-slate-500">Admin-only · recorded in audit log</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-sm">Re-sync post privacy flags</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Rewrites the denormalised <code>authorIsPrivate</code> flag on posts published before the field
                existed, so a private account&apos;s history is not left world-readable. Paged and resumable —
                re-run until it reports zero updates.
              </p>
              {backfillResult && (
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 tabular-nums">
                  Scanned <strong>{backfillResult.usersScanned === null ? '—' : backfillResult.usersScanned}</strong> users
                  {' · '}updated <strong>{backfillResult.postsUpdated === null ? '—' : backfillResult.postsUpdated}</strong> posts
                </p>
              )}
            </div>
            <button
              id="run-privacy-backfill-btn"
              type="button"
              onClick={runPrivacyBackfill}
              disabled={backfillRunning}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              {backfillRunning ? 'Running…' : 'Run privacy backfill'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSystemHealthScreen;
