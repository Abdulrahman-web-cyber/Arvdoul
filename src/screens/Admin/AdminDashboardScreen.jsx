// src/screens/Admin/AdminDashboardScreen.jsx

import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import {
  Users, FileText, Flag, AlertTriangle, Shield, TrendingUp,
  Clock, Activity, DollarSign, MessageCircle, Coins,
  ShieldCheck, UserCheck, Zap, ArrowUpRight,
} from "lucide-react";
import { useAuth } from '../../context/AuthContext';
import { fetchAdminStatus } from '../../services/callableService.js';
import PermissionDenied from '../../design-system/PermissionDenied.jsx';
import AdminNavHeader from '../../components/Admin/AdminNavHeader.jsx';

const formatLogTime = (value) => {
  if (!value) return 'Unknown time';
  const date = typeof value?.toDate === 'function'
    ? value.toDate()
    : value?.seconds != null
      ? new Date(value.seconds * 1000)
      : new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString();
};

const AdminDashboardScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: null,
    activeUsers: null,
    totalPosts: null,
    totalReports: null,
    pendingReports: null,
    totalCommunities: null,
    totalEvents: null,
    revenue: null,
  });

  // Admin authz is the `admins` collection only (mirrors server-side
  // isAdmin()). No client-side role flags or email-suffix shortcuts.
  const isPermitted = Boolean(user?.uid);

  // Check admin access + load real platform stats & audit trail
  useEffect(() => {
    if (!isPermitted) {
      setLoading(false);
      return;
    }
    const init = async () => {
      try {
        if (!user?.uid) {
          setDenied(true);
          setLoading(false);
          return;
        }
        const isAdmin = await fetchAdminStatus();
        if (!isAdmin) {
          setDenied(true);
          setError('You do not have admin access.');
          setLoading(false);
          return;
        }

        const { getAdminService } = await import('../../services/adminService.js');
        const admin = getAdminService();
        const count = (path, constraints = []) => admin.count(path, constraints);
        const where = (field, op, value) => admin.where(field, op, value);
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const [
          users,
          activeUsers,
          posts,
          reports,
          pendingReports,
          communities,
          events,
          pendingUser,
          pendingVideo,
          auditRows,
        ] = await Promise.all([
          count('users'),
          count('user_presence', [await where('lastActive', '>=', thirtyDaysAgo)]),
          count('posts'),
          count('comment_reports'),
          count('comment_reports', [await where('status', '==', 'pending')]),
          count('communities'),
          count('events'),
          count('user_reports', [await where('status', '==', 'pending')]),
          count('video_reports', [await where('status', '==', 'pending')]),
          admin.listAuditLogs(8).catch(() => []),
        ]);

        const pendingParts = [pendingReports, pendingUser, pendingVideo];
        const pendingTotal = pendingParts.every((n) => n === null)
          ? null
          : pendingParts.some((n) => n === null)
            ? null
            : pendingParts.reduce((a, b) => a + b, 0);

        setStats({
          totalUsers: users,
          activeUsers,
          totalPosts: posts,
          totalReports: reports,
          pendingReports: pendingTotal,
          totalCommunities: communities,
          totalEvents: events,
          revenue: null,
        });
        setRecentLogs(Array.isArray(auditRows) ? auditRows : []);
      } catch {
        setError('Could not load admin data.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [user, isPermitted]);

  const StatCard = ({ title, value, icon: Icon, trend, trendUp, color }) => (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            {value === null || value === undefined
              ? '—'
              : typeof value === 'number'
                ? value.toLocaleString()
                : value}
          </p>
          {trend && (
            <p className={`text-xs mt-2 flex items-center gap-1 tabular-nums ${trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
              <TrendingUp className={`w-3.5 h-3.5 ${!trendUp ? 'rotate-180' : ''}`} />
              {trend}
            </p>
          )}
        </div>
        <div className={`p-2.5 rounded-lg shrink-0 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );

  const QuickAction = ({ title, description, icon: Icon, route, color }) => (
    <button
      type="button"
      onClick={() => navigate(route)}
      className="flex items-start gap-3.5 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors text-left w-full cursor-pointer"
    >
      <div className={`p-2.5 rounded-lg shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">{title}</h3>
          <ArrowUpRight className="w-4 h-4 text-slate-400 shrink-0" />
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{description}</p>
      </div>
    </button>
  );

  if (!isPermitted || denied) {
    return (
      <PermissionDenied onGoHome={() => navigate('/')} />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-slate-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center p-8 max-w-sm">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <h2 className="text-2xl font-bold mb-2">Dashboard unavailable</h2>
          <p className="text-slate-400 text-sm">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium cursor-pointer"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <AdminNavHeader
        title="Platform Overview"
        subtitle="Aggregate telemetry, governance controls, and server-written audit activity"
        showBack={false}
        actions={
          <button
            type="button"
            onClick={() => navigate('/admin/audit-logs')}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            Inspect Audit Trail
          </button>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <StatCard
              title="Total Users"
              value={stats.totalUsers}
              icon={Users}
              color="bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
            />
            <StatCard
              title="Active Users (30d)"
              value={stats.activeUsers}
              icon={Activity}
              color="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
            />
            <StatCard
              title="Total Posts"
              value={stats.totalPosts}
              icon={FileText}
              color="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            />
            <StatCard
              title="Pending Reports"
              value={stats.pendingReports}
              icon={Flag}
              color="bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Communities"
              value={stats.totalCommunities}
              icon={Users}
              color="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            />
            <StatCard
              title="Total Events"
              value={stats.totalEvents}
              icon={Clock}
              color="bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
            />
            <StatCard
              title="Comment Reports"
              value={stats.totalReports}
              icon={AlertTriangle}
              color="bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400"
            />
            <StatCard
              title="Platform Revenue"
              value={stats.revenue === null ? 'Unavailable' : `$${Number(stats.revenue).toLocaleString()}`}
              icon={DollarSign}
              color="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
            />
          </div>
        </section>

        <section>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">
            Platform Governance &amp; Controls
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <QuickAction
              title="User Management"
              description="View and manage user accounts"
              icon={Users}
              route="/admin/users"
              color="bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
            />
            <QuickAction
              title="Content Moderation"
              description="Review reported content and strikes"
              icon={Shield}
              route="/admin/moderation"
              color="bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400"
            />
            <QuickAction
              title="Content Management"
              description="Manage posts, media, and comments"
              icon={FileText}
              route="/admin/content"
              color="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            />
            <QuickAction
              title="Economy Oversight"
              description="Tokenomics, treasury, and creator payouts"
              icon={Coins}
              route="/admin/economy"
              color="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
            />
            <QuickAction
              title="Creator Verification"
              description="Review creator badge applications"
              icon={UserCheck}
              route="/admin/verification"
              color="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            />
            <QuickAction
              title="Feature Flags"
              description="Live overrides and emergency switches"
              icon={Zap}
              route="/admin/flags"
              color="bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
            />
            <QuickAction
              title="System Health"
              description="Observability, SLOs, and diagnostics"
              icon={Activity}
              route="/admin/health"
              color="bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400"
            />
            <QuickAction
              title="Security Audit Logs"
              description="Forensic investigation and trails"
              icon={ShieldCheck}
              route="/admin/audit-logs"
              color="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            />
            <QuickAction
              title="Support Tickets"
              description="AI triage and customer inquiries"
              icon={MessageCircle}
              route="/admin/tickets"
              color="bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
            />
            <QuickAction
              title="Community Governance"
              description="Hub verification and community strikes"
              icon={Users}
              route="/admin/communities"
              color="bg-cyan-50 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-400"
            />
          </div>
        </section>

        {/* Live Audit Activity */}
        <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Recent Audit Activity
            </h2>
            <button
              type="button"
              onClick={() => navigate('/admin/audit-logs')}
              className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              View full log
            </button>
          </div>

          {recentLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No administrative interventions have been recorded in the audit log yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentLogs.map((entry) => (
                <div
                  key={entry.id}
                  className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                      <span className="font-mono text-xs">{entry.action || 'admin_action'}</span>
                      {entry.targetType && (
                        <>
                          <span aria-hidden="true" className="text-slate-400">·</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">{entry.targetType}</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate tabular-nums">
                      Actor {entry.actorId || entry.actorUid || 'system'}
                      <span aria-hidden="true"> · </span>
                      {formatLogTime(entry.createdAt)}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                    {entry.targetId || entry.id}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default AdminDashboardScreen;
