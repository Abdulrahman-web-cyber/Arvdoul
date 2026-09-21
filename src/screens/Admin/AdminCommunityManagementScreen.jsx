// src/screens/Admin/AdminCommunityManagementScreen.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Users,
  Search,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Globe,
  Award,
  MoreVertical,
  Flag,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { auditLogger } from '../../utils/AuditLogger.js';

const AdminCommunityManagementScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [privacyFilter, setPrivacyFilter] = useState('all');

  // Communities are loaded from Firestore; no local seed data is ever shown.
  const [communities, setCommunities] = useState([]);

  // Load from Firestore
  useEffect(() => {
    const loadCommunities = async () => {
      try {
        const { collection, getDocs, query, limit } = await import('firebase/firestore');
        const { getFirestoreInstance } = await import('../../firebase/firebase.js');
        const firestore = await getFirestoreInstance();

        const snap = await getDocs(query(collection(firestore, 'communities'), limit(50)));
        setCommunities(
          snap.empty ? [] : snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        );
      } catch (e) {
        toast.error('Could not load communities.');
        setCommunities([]);
      } finally {
        setLoading(false);
      }
    };
    loadCommunities();
  }, []);

  // Toggle verified hub badge
  const handleToggleVerified = async comm => {
    const newStatus = !comm.isVerified;
    setCommunities(prev =>
      prev.map(c => (c.id === comm.id ? { ...c, isVerified: newStatus } : c))
    );

    await auditLogger.log(user?.uid || 'admin', 'COMMUNITY_VERIFICATION_TOGGLED', {
      communityId: comm.id,
      communityName: comm.name,
      newVerifiedStatus: newStatus,
      actorEmail: user?.email,
    });

    toast.success(`Community "${comm.name}" marked as ${newStatus ? 'VERIFIED' : 'UNVERIFIED'}`);
  };

  // Issue strike / warning
  const handleIssueStrike = async comm => {
    const reason = window.prompt(`Issue policy strike to "${comm.name}". Specify guideline breach:`);
    if (!reason) return;

    setCommunities(prev =>
      prev.map(c => (c.id === comm.id ? { ...c, strikesCount: (c.strikesCount || 0) + 1 } : c))
    );

    await auditLogger.log(user?.uid || 'admin', 'COMMUNITY_STRIKE_ISSUED', {
      communityId: comm.id,
      communityName: comm.name,
      reason,
      actorEmail: user?.email,
    });

    toast.warning(`Strike issued to "${comm.name}". Owner notified.`);
  };

  const filtered = communities.filter(c => {
    if (privacyFilter !== 'all' && c.privacy !== privacyFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q) ||
      c.ownerHandle.toLowerCase().includes(q)
    );
  });

  return (
    <div id="admin-communities-screen" className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Top Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              id="back-btn-communities"
              onClick={() => navigate('/admin')}
              className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              aria-label="Back to Admin"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Community Governance</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                  Directory Oversight
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Hub verification, policy adherence, member health, and community strike records
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-750 p-1 rounded-xl">
            {['all', 'public', 'private'].map(p => (
              <button
                key={p}
                onClick={() => setPrivacyFilter(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                  privacyFilter === p
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Search */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search community name, slug, or creator..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="text-xs text-gray-500 font-medium">
            {filtered.length} communities listed
          </div>
        </div>

        {/* Communities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map(comm => (
            <div
              key={comm.id}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-gray-900 dark:text-white">{comm.name}</h3>
                      {comm.isVerified && (
                        <span className="p-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
                          <CheckCircle2 className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-gray-400">c/{comm.slug}</span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      comm.privacy === 'public'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    }`}
                  >
                    {comm.privacy === 'public' ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                    <span className="capitalize">{comm.privacy}</span>
                  </span>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-4">
                  {comm.description}
                </p>

                <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 dark:bg-gray-750 rounded-xl text-xs mb-4">
                  <div>
                    <span className="text-gray-500">Members</span>
                    <div className="font-bold text-gray-900 dark:text-white">{comm.memberCount.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Posts</span>
                    <div className="font-bold text-gray-900 dark:text-white">{comm.postCount.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-gray-500">Strikes</span>
                    <div className={`font-bold ${comm.strikesCount > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                      {comm.strikesCount || 0}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                <span className="text-xs text-gray-500">
                  Lead: <b className="text-gray-800 dark:text-gray-200">{comm.ownerHandle}</b>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleVerified(comm)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                      comm.isVerified
                        ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {comm.isVerified ? 'Remove Badge' : 'Grant Verified'}
                  </button>

                  <button
                    onClick={() => handleIssueStrike(comm)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                    title="Issue Strike"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminCommunityManagementScreen;
