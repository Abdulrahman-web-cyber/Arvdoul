// src/screens/Admin/AdminModerationQueueScreen.jsx

import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchAdminStatus, callFunction, FUNCTIONS } from '../../services/callableService.js';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Flag, AlertTriangle, User, MessageSquare, Image as ImageIcon, ChevronRight } from "lucide-react";
import PermissionDenied from '../../design-system/PermissionDenied.jsx';
import AdminNavHeader from '../../components/Admin/AdminNavHeader.jsx';

const AdminModerationQueueScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [denied, setDenied] = useState(false);
  const [filter, setFilter] = useState('pending');
  const [selectedReport, setSelectedReport] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        if (!user?.uid || !(await fetchAdminStatus())) {
          setDenied(true);
          setLoading(false);
          return;
        }
        const res = await callFunction(FUNCTIONS.ADMIN_LIST_MODERATION_REPORTS, { limit: 100 });
        setReports(Array.isArray(res?.reports) ? res.reports : []);
      } catch {
        toast.error('Could not load moderation queue.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.uid]);

  const filteredReports = reports.filter((r) => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  const handleReportAction = async (reportId, action) => {
    const report = reports.find((r) => r.id === reportId);
    try {
      const decision = { resolve: 'resolved', dismiss: 'dismissed', warn: 'warned', remove: 'removed' }[action] || 'escalated';
      await callFunction(FUNCTIONS.RESOLVE_USER_REPORT, {
        reportId,
        action: decision,
        reportType: report?.type || 'user',
      });
      setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status: decision } : r)));
      toast.success(`Report ${action}ed successfully`);
      setShowDetailModal(false);
    } catch {
      toast.error(`Failed to ${action} report`);
    }
  };

  const getReportTypeIcon = (type) => {
    switch (type) {
      case 'user':
        return <User className="w-4 h-4 text-red-500" />;
      case 'post':
        return <MessageSquare className="w-4 h-4 text-orange-500" />;
      case 'comment':
        return <MessageSquare className="w-4 h-4 text-amber-500" />;
      case 'video':
        return <ImageIcon className="w-4 h-4 text-arvdoul-purple" />;
      default:
        return <Flag className="w-4 h-4 text-slate-500" />;
    }
  };

  const getPriorityText = (priority) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 dark:text-red-400';
      case 'medium':
        return 'text-amber-600 dark:text-amber-400';
      case 'low':
        return 'text-emerald-600 dark:text-emerald-400';
      default:
        return 'text-slate-500';
    }
  };

  const reporterLabel = (report) => report?.reporterName || report?.reporterId || null;
  const reportedItemLabel = (report) =>
    report?.reportedItemName
    || report?.postId || report?.videoId || report?.commentId || report?.storyId
    || report?.messageId || report?.reportedUserId || report?.adId || null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-10 h-10 border-4 border-slate-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (denied) {
    return <PermissionDenied onGoHome={() => navigate('/')} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <AdminNavHeader
        title="Moderation Queue"
        subtitle="Review reported posts, users, videos, comments, and safety escalations"
        actions={
          <span className="text-xs font-semibold text-red-600 dark:text-red-400 tabular-nums whitespace-nowrap shrink-0">
            {reports.filter((r) => r.status === 'pending').length} Pending
          </span>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-fit">
          {['pending', 'reviewing', 'resolved', 'all'].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition cursor-pointer ${
                filter === status
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {filteredReports.map((report) => (
            <div key={report.id} className="p-4 sm:p-5 flex items-start gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
              <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
                {getReportTypeIcon(report.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs mb-1">
                      <span className={`font-semibold capitalize ${getPriorityText(report.priority)}`}>
                        {report.priority || 'normal'} priority
                      </span>
                      <span aria-hidden="true" className="text-slate-400">·</span>
                      <span className="text-slate-500 capitalize">{report.type} report</span>
                    </div>
                    <p className="font-medium text-sm text-slate-900 dark:text-white line-clamp-2">
                      {report.reason || 'No reason provided'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 tabular-nums">
                      Reported by {reporterLabel(report) ? `@${reporterLabel(report)}` : 'unknown'} · {new Date(report.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReport(report);
                      setShowDetailModal(true);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    Review <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {report.content && (
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {report.content}
                  </p>
                )}
              </div>
            </div>
          ))}

          {filteredReports.length === 0 && (
            <div className="p-12 text-center">
              <CheckCircle className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
              <p className="text-sm text-slate-500">No reports to review</p>
            </div>
          )}
        </div>
      </div>

      {showDetailModal && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl"
          >
            <h2 className="text-lg font-semibold mb-4">Report Details</h2>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-xs text-slate-500">Report ID</span>
                  <p className="font-mono text-xs font-medium mt-0.5">{selectedReport.id}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Type</span>
                  <p className="font-medium capitalize mt-0.5">{selectedReport.type}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Priority</span>
                  <p className={`font-semibold capitalize mt-0.5 ${getPriorityText(selectedReport.priority)}`}>
                    {selectedReport.priority}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Status</span>
                  <p className="font-medium capitalize mt-0.5">{selectedReport.status}</p>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-medium text-slate-500 mb-1">Reason</h3>
                <p>{selectedReport.reason}</p>
              </div>

              {selectedReport.content && (
                <div>
                  <h3 className="text-xs font-medium text-slate-500 mb-1">Reported Content</h3>
                  <p className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm">{selectedReport.content}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <h3 className="text-xs font-medium text-slate-500 mb-1">Reported By</h3>
                  <p className="font-medium text-xs">{reporterLabel(selectedReport) ? `@${reporterLabel(selectedReport)}` : 'unknown'}</p>
                </div>
                <div>
                  <h3 className="text-xs font-medium text-slate-500 mb-1">Reported Item</h3>
                  <p className="font-medium text-xs">{reportedItemLabel(selectedReport) ? `@${reportedItemLabel(selectedReport)}` : '—'}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleReportAction(selectedReport.id, 'dismiss')}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                <XCircle className="w-4 h-4" /> Dismiss
              </button>
              <button
                type="button"
                onClick={() => handleReportAction(selectedReport.id, 'warn')}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 rounded-lg text-xs font-semibold text-amber-700 dark:text-amber-300 cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4" /> Warn
              </button>
              <button
                type="button"
                onClick={() => handleReportAction(selectedReport.id, 'remove')}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 rounded-lg text-xs font-semibold text-red-700 dark:text-red-300 cursor-pointer"
              >
                <XCircle className="w-4 h-4" /> Remove
              </button>
              <button
                type="button"
                onClick={() => handleReportAction(selectedReport.id, 'resolve')}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-300 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" /> Resolve
              </button>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminModerationQueueScreen;
