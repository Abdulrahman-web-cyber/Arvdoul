// src/screens/Admin/AdminAuditLogsScreen.jsx

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Search, Download, ShieldCheck, Clock, User, ChevronDown, ChevronRight, Code, RefreshCw } from "lucide-react";
import { useAuth } from '../../context/AuthContext';
import { fetchAdminStatus } from '../../services/callableService.js';
import PermissionDenied from '../../design-system/PermissionDenied.jsx';
import AdminNavHeader from '../../components/Admin/AdminNavHeader.jsx';

const formatTimestamp = (value) => {
  if (!value) return 'unknown time';
  const date = typeof value?.toDate === 'function'
    ? value.toDate()
    : value?.seconds != null
      ? new Date(value.seconds * 1000)
      : new Date(value);
  return Number.isNaN(date.getTime()) ? 'unknown time' : date.toLocaleString();
};

const AdminAuditLogsScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [logs, setLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');
  const [expandedLogId, setExpandedLogId] = useState(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      if (!user?.uid || !(await fetchAdminStatus())) {
        setDenied(true);
        setLoading(false);
        return;
      }
      const { getAdminService } = await import('../../services/adminService.js');
      const rows = await getAdminService().listAuditLogs(100);
      setLogs(rows);
    } catch {
      toast.error('Could not load the audit trail.');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

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

  const filteredLogs = logs.filter((l) => {
    if (selectedAction !== 'all') {
      const action = String(l.action || '').toLowerCase();
      const target = String(l.targetType || '').toLowerCase();
      if (!action.includes(selectedAction) && !target.includes(selectedAction)) return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(l.action || '').toLowerCase().includes(q) ||
      String(l.actorId || l.actorUid || '').toLowerCase().includes(q) ||
      String(l.targetId || '').toLowerCase().includes(q) ||
      String(l.id || '').toLowerCase().includes(q)
    );
  });

  if (denied) {
    return <PermissionDenied onGoHome={() => navigate('/')} />;
  }

  return (
    <div id="admin-audit-logs-screen" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <AdminNavHeader
        title="Security Audit Logs"
        subtitle="Immutable record of administrative interventions, financial mutations, and security events"
        actions={
          <div className="flex items-center gap-2">
            <button
              id="refresh-logs-btn"
              type="button"
              onClick={fetchLogs}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              aria-label="Refresh Logs"
            >
              <RefreshCw className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </button>
            <button
              id="export-audit-btn"
              type="button"
              onClick={handleExport}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 rounded-lg transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Trail</span>
            </button>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              aria-label="Search audit logs"
              type="text"
              placeholder="Search action, actor, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-arvdoul-purple"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
            {['all', 'withdrawal', 'community', 'verification', 'report', 'user'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedAction(cat)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize whitespace-nowrap shrink-0 transition cursor-pointer ${
                  selectedAction === cat
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading && (
              <div className="p-10 text-center text-sm text-slate-500">Loading audit logs…</div>
            )}
            {!loading && filteredLogs.length === 0 && (
              <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">
                <ShieldCheck className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                {logs.length === 0
                  ? 'No administrative actions have been recorded yet.'
                  : 'No log entries match this filter.'}
              </div>
            )}
            {filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              return (
                <div key={log.id} className="p-4 sm:p-5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                  <button
                    type="button"
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    aria-expanded={isExpanded}
                    className="w-full text-left flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-slate-400 shrink-0" aria-hidden="true">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-slate-900 dark:text-white font-mono">
                            {log.action || 'unknown_action'}
                          </span>
                          {log.targetType && (
                            <>
                              <span aria-hidden="true" className="text-slate-400">·</span>
                              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                {log.targetType}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap tabular-nums">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{log.actorId || log.actorUid || 'unknown actor'}</span>
                          <span aria-hidden="true">·</span>
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{formatTimestamp(log.createdAt)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                        {log.targetId || log.id}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800"
                    >
                      <div className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                        <Code className="w-3.5 h-3.5" />
                        <span>Forensic Payload Data</span>
                      </div>
                      <pre className="p-3 bg-slate-950 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto">
                        {JSON.stringify(log.details || {}, null, 2)}
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
