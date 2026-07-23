// src/screens/Admin/AdminDashboardScreen.jsx - ARVDOUL ADMIN DASHBOARD
// ✅ Platform overview and stats
// ✅ Quick access to admin functions

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { 
  Users, FileText, Flag, AlertTriangle, Shield, TrendingUp,
  Eye, Clock, CheckCircle, XCircle, BarChart3, Settings,
  Activity, DollarSign, MessageCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const AdminDashboardScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
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

  // Check admin access
  useEffect(() => {
    const checkAdminAccess = async () => {
      // TODO: Implement admin role check
      // For now, allow access for demonstration
      setLoading(false);
    };
    checkAdminAccess();
  }, []);

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
      className="flex items-start gap-4 p-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 text-left w-full"
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
            trend="+12% this week"
            trendUp={true}
            color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          />
          <StatCard
            title="Active Users"
            value={stats.activeUsers}
            icon={Activity}
            trend="+8% today"
            trendUp={true}
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
            trend="+24% this month"
            trendUp={true}
            color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          />
        </div>

        {/* Quick Actions */}
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <QuickAction
            title="User Management"
            description="View and manage user accounts"
            icon={Users}
            route="/admin/users"
            color="bg-blue-100 text-blue-600"
          />
          <QuickAction
            title="Content Moderation"
            description="Review reported content"
            icon={Shield}
            route="/admin/moderation"
            color="bg-red-100 text-red-600"
          />
          <QuickAction
            title="Content Management"
            description="Manage posts and media"
            icon={FileText}
            route="/admin/content"
            color="bg-purple-100 text-purple-600"
          />
          <QuickAction
            title="Analytics"
            description="View platform analytics"
            icon={BarChart3}
            route="/admin/analytics"
            color="bg-green-100 text-green-600"
          />
          <QuickAction
            title="Settings"
            description="Configure platform settings"
            icon={Settings}
            route="/admin/settings"
            color="bg-gray-100 text-gray-600"
          />
          <QuickAction
            title="Support Tickets"
            description="Handle user support requests"
            icon={MessageCircle}
            route="/admin/tickets"
            color="bg-amber-100 text-amber-600"
          />
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            Recent Activity
          </h2>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-gray-200" />
                <div className="flex-1">
                  <p className="text-sm text-gray-900 dark:text-white">
                    User action description here
                  </p>
                  <p className="text-xs text-gray-500">
                    {i} hours ago
                  </p>
                </div>
                <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                  Action
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardScreen;
