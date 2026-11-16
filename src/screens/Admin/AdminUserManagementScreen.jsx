// src/screens/Admin/AdminUserManagementScreen.jsx

import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Search, MoreVertical, Ban, CheckCircle, Eye, User,
  ShieldCheck, XCircle, Clock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { listUsers, applyUserAdminAction, fetchAdminStatus } from '../../services/callableService.js';
import { resolveActorName } from '../../services/profileReadModel.js';
import { LazyImage } from '../../components/Shared/LazyImage';
import PermissionDenied from '../../design-system/PermissionDenied.jsx';
import AdminNavHeader from '../../components/Admin/AdminNavHeader.jsx';

const formatJoined = (createdAt) => {
  if (!createdAt) return '—';
  if (typeof createdAt?.toDate === 'function') return createdAt.toDate().toLocaleDateString();
  const seconds = createdAt?._seconds ?? (typeof createdAt === 'number' ? createdAt : null);
  const date = seconds != null ? new Date(seconds * 1000) : new Date(createdAt);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
};

const AdminUserManagementScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        if (!user?.uid || !(await fetchAdminStatus())) {
          setDenied(true);
          setLoading(false);
          return;
        }
        const res = await listUsers(100);
        setUsers(Array.isArray(res?.users) ? res.users : []);
      } catch {
        toast.error('Could not load users.');
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, [user?.uid]);

  const filteredUsers = users
    .filter((u) => {
      if (filter === 'all') return true;
      if (filter === 'verified') return u.isVerified;
      if (filter === 'suspended') return u.accountStatus === 'suspended';
      if (filter === 'banned') return u.accountStatus === 'banned';
      return true;
    })
    .filter((u) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        u.displayName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q)
      );
    });

  const handleUserAction = async (userId, action) => {
    try {
      await applyUserAdminAction(userId, action);
      const patch = action === 'verify'
        ? { isVerified: true }
        : action === 'unverify'
          ? { isVerified: false }
          : action === 'ban'
            ? { accountStatus: 'banned' }
            : action === 'suspend'
              ? { accountStatus: 'suspended' }
              : { accountStatus: 'active' };
      const labels = {
        verify: 'verified',
        unverify: 'unverified',
        ban: 'banned',
        suspend: 'suspended',
        unban: 'unbanned',
        restore: 'restored',
      };
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...patch } : u)));
      toast.success(`User ${labels[action] || action}`);
      setShowUserModal(false);
    } catch {
      toast.error('Action failed — check admin permissions.');
    }
  };

  if (denied) {
    return <PermissionDenied onGoHome={() => navigate('/')} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <AdminNavHeader
        title="User Management"
        subtitle="Manage citizen accounts, verification status, and safety interventions"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              aria-label="Search users"
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-arvdoul-purple"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
            {[
              { value: 'all', label: 'All' },
              { value: 'verified', label: 'Verified' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'banned', label: 'Banned' },
            ].map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition cursor-pointer ${
                  filter === value
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-5 py-3.5">Email</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Joined</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden shrink-0">
                          {u.photoURL ? (
                            <LazyImage src={u.photoURL} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-arvdoul-gradient flex items-center justify-center text-white text-xs font-semibold">
                              {u.displayName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-900 dark:text-white truncate">
                              {resolveActorName([u.displayName, u.username], u.id || u.uid)}
                            </span>
                            {u.isVerified && <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />}
                          </div>
                          <span className="text-xs text-slate-500">@{u.username || u.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                      {u.email || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold capitalize ${
                          u.accountStatus === 'suspended'
                            ? 'text-amber-600 dark:text-amber-400'
                            : u.accountStatus === 'banned'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {(!u.accountStatus || u.accountStatus === 'active') && <CheckCircle className="w-3.5 h-3.5" />}
                        {u.accountStatus === 'suspended' && <Clock className="w-3.5 h-3.5" />}
                        {u.accountStatus === 'banned' && <XCircle className="w-3.5 h-3.5" />}
                        {u.accountStatus || 'active'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500 tabular-nums">
                      {formatJoined(u.createdAt)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => navigate(`/profile/${u.id}`)}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                          aria-label="View Profile"
                          title="View Profile"
                        >
                          <Eye className="w-4 h-4 text-slate-500" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUser(u);
                            setShowUserModal(true);
                          }}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                          aria-label="More Actions"
                          title="More Actions"
                        >
                          <MoreVertical className="w-4 h-4 text-slate-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 mx-auto mb-3 border-2 border-slate-300 border-t-slate-900 dark:border-t-white rounded-full animate-spin" />
              <p className="text-sm text-slate-500">Loading users…</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-10 h-10 mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-500">No users found</p>
            </div>
          ) : null}
        </div>
      </div>

      {showUserModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl"
          >
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
              User Actions
            </h2>
            <p className="text-sm text-slate-500 mb-5">
              Perform administrative actions on <strong>{selectedUser.displayName || selectedUser.username || selectedUser.id}</strong>
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleUserAction(selectedUser.id, selectedUser.isVerified ? 'unverify' : 'verify')}
                className="w-full flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-950/60 rounded-lg text-left cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {selectedUser.isVerified ? 'Remove Verification' : 'Verify User'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleUserAction(selectedUser.id, 'suspend')}
                className="w-full flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-950/60 rounded-lg text-left cursor-pointer"
              >
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Suspend User</span>
              </button>

              <button
                type="button"
                onClick={() => handleUserAction(selectedUser.id, 'ban')}
                className="w-full flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/60 rounded-lg text-left cursor-pointer"
              >
                <Ban className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span className="text-sm font-medium text-red-700 dark:text-red-300">Ban User</span>
              </button>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminUserManagementScreen;
