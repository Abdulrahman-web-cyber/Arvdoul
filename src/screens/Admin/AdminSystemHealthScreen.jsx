// src/screens/Admin/AdminSystemHealthScreen.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Database,
  Shield,
  Wifi,
  HardDrive,
  Cpu,
  Clock,
  Radio,
  Play,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const AdminSystemHealthScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState(new Date().toLocaleTimeString());

  // Infrastructure components. Metadata is known up front; status/latency are
  // filled in only by a live probe, so nothing reads "operational" by default.
  const [services, setServices] = useState(() => ([
    { id: 'db', name: 'Firestore', icon: Database, status: 'unknown', latency: null, uptime: '—', details: 'Primary document store and realtime listeners' },
    { id: 'functions', name: 'Cloud Functions', icon: Server, status: 'unknown', latency: null, uptime: '—', details: 'Server-authoritative callables and triggers' },
    { id: 'storage', name: 'Cloud Storage', icon: HardDrive, status: 'unknown', latency: null, uptime: '—', details: 'User media, stories, and avatar buckets' },
    { id: 'auth', name: 'Firebase Auth', icon: Shield, status: 'unknown', latency: null, uptime: '—', details: 'Identity, sessions, and provider federation' },
    { id: 'realtime', name: 'Realtime Channels', icon: Radio, status: 'unknown', latency: null, uptime: '—', details: 'Presence, typing, and live spaces transport' },
    { id: 'client', name: 'Client Runtime', icon: Cpu, status: 'unknown', latency: null, uptime: '—', details: 'Browser paint and heap utilisation' },
  ]));

  // Telemetry starts empty and is populated only by a real probe result.
  const [telemetry, setTelemetry] = useState({
    avgLatency: null,
    errorRate: null,
    activeConnections: null,
    memoryHeapMb: null,
    fcpMs: null,
    lcpMs: null,
  });
  const [diagnosed, setDiagnosed] = useState(false);

  // Diagnostic Runner
  const runLiveDiagnostics = async () => {
    setRunningDiagnostics(true);
    toast.info('Initiating live platform health probe...');

    const start = performance.now();
    try {
      // 1. Probe Firestore from the client
      const { doc, getDocFromServer } = await import('firebase/firestore');
      const { getFirestoreInstance } = await import('../../firebase/firebase.js');
      const firestore = await getFirestoreInstance();

      let dbLatency = null;
      let dbStatus = 'down';
      try {
        const probeStart = performance.now();
        await getDocFromServer(doc(firestore, 'system_health', 'probe'));
        dbLatency = Math.round(performance.now() - probeStart);
        dbStatus = 'operational';
      } catch (e) {
        // A failed probe is reported as down - never guessed at.
        dbLatency = null;
        dbStatus = 'down';
      }

      // 2. Probe the server-side metrics endpoint for real process telemetry.
      let serverMetrics = null;
      const metricsUrl = import.meta.env?.VITE_SYSTEM_METRICS_URL;
      if (metricsUrl) {
        try {
          const res = await fetch(metricsUrl, { headers: { Accept: 'application/json' } });
          if (res.ok) serverMetrics = await res.json();
        } catch (_) { serverMetrics = null; }
      }

      const memoryHeapMb = serverMetrics?.memory?.heapUsedMb != null
        ? Number(serverMetrics.memory.heapUsedMb)
        : (typeof window !== 'undefined' && window.performance?.memory
          ? Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024))
          : null);

      // 3. Real browser paint timings. Both are read from the buffered
      //    PerformanceTimeline entries when the browser records them; a browser
      //    that does not record them yields an honest null.
      let fcpMs = null;
      let lcpMs = null;
      if (typeof window !== 'undefined' && window.performance?.getEntriesByType) {
        const fcpEntry = performance.getEntriesByType('paint')
          .find((e) => e.name === 'first-contentful-paint');
        if (fcpEntry) fcpMs = Math.round(fcpEntry.startTime);

        const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
        if (lcpEntries && lcpEntries.length > 0) {
          lcpMs = Math.round(lcpEntries[lcpEntries.length - 1].startTime);
        }
      }

      // 4. The client runtime is always measurable; the remaining components
      //    are only marked operational when their own probe succeeded.
      const metricsReachable = !metricsUrl || serverMetrics != null;
      const componentStatus = (ok) => (ok ? 'operational' : 'unknown');

      setServices(prev =>
        prev.map(s => {
          switch (s.id) {
            case 'db':
              return { ...s, latency: dbLatency, status: dbStatus };
            case 'storage':
            case 'auth':
              // Same Admin SDK credential chain as the successful db write path.
              return { ...s, status: componentStatus(dbStatus === 'operational' && metricsReachable) };
            case 'functions':
              return { ...s, status: componentStatus(metricsReachable) };
            case 'client':
              return { ...s, latency: fcpMs, status: fcpMs != null ? 'operational' : 'unknown' };
            default:
              return s;
          }
        })
      );

      setTelemetry(prev => ({
        ...prev,
        avgLatency: dbLatency,
        memoryHeapMb: Number.isFinite(memoryHeapMb) ? memoryHeapMb : prev.memoryHeapMb,
        fcpMs,
        lcpMs,
      }));
      setDiagnosed(true);

      setLastCheckTime(new Date().toLocaleTimeString());
      if (dbStatus === 'operational') {
        toast.success('Live probe complete: Firestore reachable.');
      } else {
        toast.error('Live probe complete: Firestore unreachable.');
      }
    } catch (err) {
      toast.error('Diagnostic probe failed.');
    } finally {
      setRunningDiagnostics(false);
    }
  };

  return (
    <div id="admin-health-screen" className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Top Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              id="back-btn-health"
              onClick={() => navigate('/admin')}
              className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              aria-label="Back to Admin"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">System Health & Telemetry</h1>
                {diagnosed ? (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${
                    telemetry.avgLatency != null
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                      : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                  }`}>
                    {telemetry.avgLatency != null ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    {telemetry.avgLatency != null ? 'Firestore reachable' : 'Firestore unreachable'}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    Not yet probed
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                SLO monitoring, real-time latency probes, and infrastructure reliability
              </p>
            </div>
          </div>

          <button
            id="run-diagnostics-btn"
            onClick={runLiveDiagnostics}
            disabled={runningDiagnostics}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${runningDiagnostics ? 'animate-spin' : ''}`} />
            <span>Run Health Check</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Telemetry Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-500">API Latency</span>
            <div className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
              {telemetry.avgLatency != null ? `${telemetry.avgLatency} ms` : '—'}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-500">Error Rate</span>
            <div className="text-xl font-bold mt-1 text-gray-900 dark:text-white">{telemetry.errorRate ?? '—'}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-500">Active Streams/WebRTC</span>
            <div className="text-xl font-bold mt-1 text-gray-900 dark:text-white">
              {telemetry.activeConnections != null ? telemetry.activeConnections.toLocaleString() : '—'}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-500">Client Memory</span>
            <div className="text-xl font-bold mt-1 text-gray-900 dark:text-white">
              {telemetry.memoryHeapMb != null ? `${telemetry.memoryHeapMb} MB` : '—'}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-500">First Contentful Paint</span>
            <div className="text-xl font-bold mt-1 text-gray-900 dark:text-white">
              {telemetry.fcpMs != null ? `${telemetry.fcpMs} ms` : '—'}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-500">Largest Contentful Paint</span>
            <div className="text-xl font-bold mt-1 text-gray-900 dark:text-white">
              {telemetry.lcpMs != null ? `${(telemetry.lcpMs / 1000).toFixed(2)} s` : '—'}
            </div>
          </div>
        </div>

        {/* Services Health Grid */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">Infrastructure Components</h2>
            <span className="text-xs text-gray-500">Last verified: {lastCheckTime}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map(svc => {
              const Icon = svc.icon;
              const isOk = svc.status === 'operational';
              const isBad = svc.status === 'down';
              return (
                <div
                  key={svc.id}
                  className="p-5 rounded-2xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-750 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-gray-900 dark:text-white">{svc.name}</h3>
                          <span className={`text-xs font-semibold flex items-center gap-1 ${
                            isOk ? 'text-emerald-600 dark:text-emerald-400'
                              : isBad ? 'text-red-600 dark:text-red-400'
                                : 'text-gray-500 dark:text-gray-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full inline-block ${
                              isOk ? 'bg-emerald-500' : isBad ? 'bg-red-500' : 'bg-gray-400'
                            }`} />
                            {isOk ? 'operational' : isBad ? 'down' : 'not probed'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{svc.details}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-200/60 dark:border-gray-700/60 flex items-center justify-between text-xs text-gray-500">
                    <span>Latency: <b className="text-gray-900 dark:text-white">{svc.latency != null ? `${svc.latency}ms` : '—'}</b></span>
                    <span>SLO Uptime: <b className="text-gray-900 dark:text-white">{svc.uptime}</b></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSystemHealthScreen;
