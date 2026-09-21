// src/screens/Admin/AdminAuditLogsScreen.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft,
  FileText,
  Search,
  Filter,
  Download,
  ShieldCheck,
  AlertTriangle,
  Clock,
  User,
  ChevronDown,
  ChevronRight,
  Code,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const AdminAuditLogsScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Logs are read from the server-written audit collections only. There is no
  // seeded/fallback content: an empty trail renders the empty state rather
  // than inventing administrative events that never happened.
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');
  const [expandedLogId, setExpandedLogId] = useState(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const { collection, getDocs, query, orderBy, limit } = await import('firebase/firestore');
      const { getFirestoreInstance } = await import('../../firebase/firebase.js');
      const firestore = await getFirestoreInstance();

      const readCollection = async (name, orderField) => {
        const snap = await getDocs(
          query(collection(firestore, name), orderBy(orderField, 'desc'), limit(100))
        );
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      };

      const [auditDocs, moderationDocs] = await Promise.all([
        readCollection('audit_logs', 'timestamp'),
        readCollection('moderation_logs', 'createdAt'),
      ]);

      // moderation_logs store createdAt as a Firestore Timestamp; normalise to
      // the ISO shape the table renders so both sources sort together.
      const normalise = (entry) => ({
        ...entry,
        timestamp: entry.timestamp
          || (entry.createdAt?.toDate ? entry.createdAt.toDate().toISOString() : entry.createdAt),
      });

      const merged = [...auditDocs, ...moderationDocs.map(normalise)]
        .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
        .slice(0, 100);

      setLogs(merged);
    } catch (e) {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Export audit trail
  const handleExport = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(logs, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `arvdoul-audit-log-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success('Audit trail exported to JSON.');
  };

  const filteredLogs = logs.filter(l => {
    if (selectedAction !== 'all' && l.category?.toLowerCase() !== selectedAction.toLowerCase()) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      l.action?.toLowerCase().includes(q) ||
      l.actor?.toLowerCase().includes(q) ||
      l.actorEmail?.toLowerCase().includes(q) ||
      l.id?.toLowerCase().includes(q)
    );
  });

  return (
    <div id="admin-audit-logs-screen" className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Top Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              id="back-btn-audit"
              onClick={() => navigate('/admin')}
              className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              aria-label="Back to Admin"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Security Audit Logs</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Append-Only Trail
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Immutable record of administrative interventions, financial mutations, and security events
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="refresh-logs-btn"
              onClick={fetchLogs}
              className="p-2 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              aria-label="Refresh Logs"
            >
              <RefreshCw className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
            <button
              id="export-audit-btn"
              onClick={handleExport}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 rounded-xl transition shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Trail</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search action, actor, or ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
            {['all', 'security', 'economy', 'moderation', 'system', 'governance'].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedAction(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
                  selectedAction === cat
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Logs Table / List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredLogs.map(log => {
              const isExpanded = expandedLogId === log.id;
              return (
                <div key={log.id} className="p-4 sm:p-5 hover:bg-gray-50/60 dark:hover:bg-gray-750 transition">
                  <div
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <button className="text-gray-400">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900 dark:text-white font-mono">{log.action}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              log.severity === 'critical'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                                : log.severity === 'warning'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                            }`}
                          >
                            {log.severity || 'info'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1.5">
                          <User className="w-3 h-3 text-gray-400" />
                          <span>{log.actorEmail || log.actor}</span>
                          <span>•</span>
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {log.category || 'General'}
                      </span>
                    </div>
                  </div>

                  {/* Expanded JSON Inspector */}
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700"
                    >
                      <div className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                        <Code className="w-3.5 h-3.5" />
                        <span>Forensic Payload Data</span>
                      </div>
                      <pre className="p-3 bg-gray-900 text-gray-100 rounded-xl text-xs font-mono overflow-x-auto">
                        {JSON.stringify(log.metadata || {}, null, 2)}
                      </pre>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAuditLogsScreen;
