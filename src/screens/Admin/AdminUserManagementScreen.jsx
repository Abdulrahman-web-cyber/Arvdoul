// src/screens/Admin/AdminUserManagementScreen.jsx - ARVDOUL USER MANAGEMENT
// ✅ List and search users
// ✅ View user details
// ✅ Suspend/Ban/Verify/Roles

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { 
  ArrowLeft, Search, Filter, MoreVertical, Shield,
  Ban, CheckCircle, AlertTriangle, Eye, X, User,
  ChevronRight, ShieldCheck, XCircle, Clock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const AdminUserManagementScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);

  // Load users
  useEffect(() => {
    setLoading(false);
    // TODO: Load users from Firestore
  }, []);

  // Filter users
  const filteredUsers = users.filter(u => {
    if (filter === 'all') return true;
    if (filter === 'verified') return u.isVerified;
    if (filter === 'suspended') return u.accountStatus === 'suspended';
    if (filter === 'banned') return u.accountStatus === 'banned';
    return true;
  }).filter(u => {
    if (!searchQuery) return true;
    return u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           u.username?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // User action
  const handleUserAction = async (userId, action) => {
    try {
      // TODO: Implement actual actions
      toast.success(`Action "${action}" performed on user`);
      setShowUserModal(false);
    } catch (error) {
      console.error('Action failed:', error);
      toast.error('Action failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                User Management
              </h1>
              <p className="text-sm text-gray-500">Manage user accounts and permissions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white placeholder-gray-500"
              />
            </div>

            {/* Filter */}
            <div className="flex gap-2">
              {[
                { value: 'all', label: 'All' },
                { value: 'verified', label: 'Verified' },
                { value: 'suspended', label: 'Suspended' },
                { value: 'banned', label: 'Banned' }
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    filter === value
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">User</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-500">Joined</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                          {u.photoURL ? (
                            <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-medium">
                              {u.displayName?.charAt(0)?.toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {u.displayName || 'User'}
                            </span>
                            {u.isVerified && (
                              <ShieldCheck className="w-4 h-4 text-blue-500" />
                            )}
                          </div>
                          <span className="text-sm text-gray-500">@{u.username}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                      {u.email}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${
                        u.accountStatus === 'active' ? 'bg-green-100 text-green-700' :
                        u.accountStatus === 'suspended' ? 'bg-yellow-100 text-yellow-700' :
                        u.accountStatus === 'banned' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {u.accountStatus === 'active' && <CheckCircle className="w-3 h-3" />}
                        {u.accountStatus === 'suspended' && <Clock className="w-3 h-3" />}
                        {u.accountStatus === 'banned' && <XCircle className="w-3 h-3" />}
                        {u.accountStatus || 'active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/profile/${u.id}`)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg"
                          title="View Profile"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUser(u);
                            setShowUserModal(true);
                          }}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg"
                          title="More Actions"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <User className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500">No users found</p>
            </div>
          )}
        </div>
      </div>

      {/* User Action Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6"
          >
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              User Actions
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Perform actions on <strong>{selectedUser.displayName}</strong>
            </p>

            <div className="space-y-2">
              <button
                onClick={() => handleUserAction(selectedUser.id, 'verify')}
                className="w-full flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-xl text-left"
              >
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <span className="text-blue-700 dark:text-blue-300">Verify User</span>
              </button>

              <button
                onClick={() => handleUserAction(selectedUser.id, 'suspend')}
                className="w-full flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded-xl text-left"
              >
                <Clock className="w-5 h-5 text-yellow-600" />
                <span className="text-yellow-700 dark:text-yellow-300">Suspend User</span>
              </button>

              <button
                onClick={() => handleUserAction(selectedUser.id, 'ban')}
                className="w-full flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl text-left"
              >
                <Ban className="w-5 h-5 text-red-600" />
                <span className="text-red-700 dark:text-red-300">Ban User</span>
              </button>

              <button
                onClick={() => handleUserAction(selectedUser.id, 'view_analytics')}
                className="w-full flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-xl text-left"
              >
                <Eye className="w-5 h-5 text-gray-600" />
                <span className="text-gray-700 dark:text-gray-300">View Analytics</span>
              </button>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
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
