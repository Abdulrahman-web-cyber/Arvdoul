// src/screens/Admin/AdminDashboardScreen.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { 
  Users, FileText, Flag, AlertTriangle, Shield, TrendingUp,
  Eye, Clock, CheckCircle, XCircle, BarChart3, Settings,
  Activity, DollarSign, MessageCircle, Coins, Sliders,
  ShieldCheck, UserCheck, Zap, Radio
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const AdminDashboardScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalPosts: 0,
    totalReports: 0,
    pendingReports: 0,
    totalCommunities: 0,
    totalEvents: 0,
    revenue: 0
  });

  // Admin authz is the `admins` collection only (mirrors server-side
  // isAdmin()). No client-side role flags or email-suffix shortcuts.
  const isPermitted = Boolean(user?.uid);

  // Check admin access + load real platform stats
  useEffect(() => {
    if (!isPermitted) {
      setLoading(false);
      return;
    }
    const init = async () => {
      try {
        const { collection, getCountFromServer, query, where, getDocs, orderBy, limit } = await import('firebase/firestore');
        const { getFirestoreInstance } = await import('../../firebase/firebase.js');
        const { fetchAdminStatus } = await import('../../services/callableService.js');
        const firestore = await getFirestoreInstance();

        // The `admins` collection is not client-readable, so membership is
        // confirmed through the getAdminStatus callable (the same server check
        // the rules and AdminRoute use). Reading the doc directly would be
        // denied and would abort the whole dashboard load.
        if (!user?.uid) { navigate('/login'); return; }
        const isAdminUser = await fetchAdminStatus();
        if (!isAdminUser) {
          setError('You do not have admin access.');
          setLoading(false);
          return;
        }

        // Real platform stats via aggregate count queries.
        const count = async (path, constraints = []) => {
          try {
            const colRef = constraints.length
              ? query(collection(firestore, path), ...constraints)
              : collection(firestore, path);
            const s = await getCountFromServer(colRef);
            return s.data().count;
          } catch (e) { return 0; }
        };
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const [users, activeUsers, posts, reports, pendingReports, communities, events] = await Promise.all([
          count('users'),
          count('users', [where('lastActive', '>=', thirtyDaysAgo)]),
          count('posts'),
          count('comment_reports'),
          count('comment_reports', [where('status', '==', 'pending')]),
          count('communities'),
          count('events'),
        ]);
        // pending reports across all report collections (honest sum).
        const pendingUser = await count('user_reports', [where('status', '==', 'pending')]);
        const pendingVideo = await count('video_reports', [where('status', '==', 'pending')]);
        const pendingPost = await count('post_reports', [where('status', '==', 'pending')]);
        const pendingStory = await count('story_reports', [where('status', '==', 'pending')]);
        setStats({
          totalUsers: users,
          activeUsers,
          totalPosts: posts,
          totalReports: reports,
          pendingReports: pendingReports + pendingUser + pendingVideo + pendingPost + pendingStory,
          totalCommunities: communities,
          totalEvents: events,
          revenue: 0, // real USD revenue requires the Stripe payout pipeline; never estimated
        });

        // Recent activity is the real audit trail (server-written). No seeded rows.
        try {
          const activitySnap = await getDocs(
            query(collection(firestore, 'moderation_logs'), orderBy('createdAt', 'desc'), limit(5))
          );
          setRecentActivity(activitySnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch {
          setRecentActivity([]);
        }
      } catch (err) {
        setError('Could not load admin data.');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [user, navigate]);

  // Stat card component
  const StatCard = ({ title, value, icon: Icon, trend, trendUp, color }) => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {trend && (
            <p className={`text-sm mt-2 flex items-center gap-1 ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
              <TrendingUp className={`w-4 h-4 ${!trendUp ? 'rotate-180' : ''}`} />
              {trend}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );

  // Quick action card
  const QuickAction = ({ title, description, icon: Icon, route, color }) => (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(route)}
      className="flex items-start gap-4 p-6 bg-white/80 dark:bg-gray-800/70 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.3)] text-left w-full"
    >
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <h3 className="font-bold text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
      </div>
    </motion.button>
  );

  if (!isPermitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-400">Admin privileges required.</p>
          <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 bg-violet-600 rounded-lg">Go Home</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Admin Dashboard
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Platform overview and management
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-full">
              <Shield className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">Admin</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Users"
            value={stats.totalUsers}
            icon={Users}
            color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          />
          <StatCard
            title="Active Users"
            value={stats.activeUsers}
            icon={Activity}
            color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          />
          <StatCard
            title="Total Posts"
            value={stats.totalPosts}
            icon={FileText}
            color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
          />
          <StatCard
            title="Pending Reports"
            value={stats.pendingReports}
            icon={Flag}
            color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Communities"
            value={stats.totalCommunities}
            icon={Users}
            color="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
          />
          <StatCard
            title="Total Events"
            value={stats.totalEvents}
            icon={Clock}
            color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          />
          <StatCard
            title="Total Reports"
            value={stats.totalReports}
            icon={AlertTriangle}
            color="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
          />
          <StatCard
            title="Platform Revenue"
            value={`$${stats.revenue.toLocaleString()}`}
            icon={DollarSign}
            color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          />
        </div>

        {/* Quick Actions */}
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Platform Governance & Controls
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
          <QuickAction
            title="User Management"
            description="View and manage user accounts"
            icon={Users}
            route="/admin/users"
            color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          />
          <QuickAction
            title="Content Moderation"
            description="Review reported content and strikes"
            icon={Shield}
            route="/admin/moderation"
            color="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
          />
          <QuickAction
            title="Content Management"
            description="Manage posts, media, and comments"
            icon={FileText}
            route="/admin/content"
            color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
          />
          <QuickAction
            title="Economy Oversight"
            description="Tokenomics, treasury, and creator payouts"
            icon={Coins}
            route="/admin/economy"
            color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          />
          <QuickAction
            title="Creator Verification"
            description="Review creator badge applications"
            icon={UserCheck}
            route="/admin/verification"
            color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
          />
          <QuickAction
            title="Feature Flags"
            description="Live overrides and emergency switches"
            icon={Zap}
            route="/admin/flags"
            color="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          />
          <QuickAction
            title="System Health"
            description="Observability, SLOs, and diagnostics"
            icon={Activity}
            route="/admin/health"
            color="bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400"
          />
          <QuickAction
            title="Security Audit Logs"
            description="Forensic investigation and trails"
            icon={ShieldCheck}
            route="/admin/audit-logs"
            color="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
          />
          <QuickAction
            title="Support Tickets"
            description="AI triage and customer inquiries"
            icon={MessageCircle}
            route="/admin/tickets"
            color="bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400"
          />
          <QuickAction
            title="Community Governance"
            description="Hub verification and community strikes"
            icon={Users}
            route="/admin/communities"
            color="bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400"
          />
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Recent Activity
          </h2>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No administrative activity has been recorded yet.
            </p>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((entry) => {
                const timestamp = entry.createdAt?.toDate
                  ? entry.createdAt.toDate()
                  : entry.createdAt
                    ? new Date(entry.createdAt)
                    : null;
                return (
                  <div key={entry.id} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                      <Shield className="w-4 h-4 text-gray-500 dark:text-gray-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-white truncate">
                        {entry.action?.replace(/_/g, ' ') || 'Administrative action'}
                        {entry.targetId ? ` · ${entry.targetId}` : ''}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {timestamp ? timestamp.toLocaleString() : 'Timestamp unavailable'}
                      </p>
                    </div>
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                      {entry.actorId || entry.actorUid || 'system'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardScreen;
