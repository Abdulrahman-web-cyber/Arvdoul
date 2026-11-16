// src/screens/Admin/AdminContentManagementScreen.jsx

import { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchAdminStatus, callFunction, FUNCTIONS } from '../../services/callableService.js';
import { toast } from 'sonner';
import { Search, Eye, Trash2, Flag, Image as ImageIcon, Video, FileText, CheckCircle, XCircle } from "lucide-react";
import PermissionDenied from '../../design-system/PermissionDenied.jsx';
import { LazyImage } from '../../components/Shared/LazyImage';
import AdminNavHeader from '../../components/Admin/AdminNavHeader.jsx';

const formatStat = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n.toLocaleString() : "—";
};

const AdminContentManagementScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState([]);
  const [denied, setDenied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const load = async () => {
      try {
        if (!user?.uid) { setDenied(true); setLoading(false); return; }
        if (!(await fetchAdminStatus())) { setDenied(true); setLoading(false); return; }
        const { getAdminService } = await import('../../services/adminService.js');
        const rows = await getAdminService().listContent(100);
        setContent(rows);
      } catch {
        toast.error('Could not load content.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const filteredContent = content
    .filter((c) => {
      if (filter === 'all') return true;
      return c.type === filter;
    })
    .filter((c) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return c.content?.toLowerCase().includes(q) || c.authorName?.toLowerCase().includes(q);
    });

  const handleContentAction = async (contentId, action) => {
    try {
      await callFunction(FUNCTIONS.ADMIN_MODERATE_CONTENT, {
        contentType: 'post',
        contentId,
        action,
      });
      setContent((prev) => prev.map((c) => (c.id === contentId ? { ...c, isDeleted: action === 'remove' } : c)));
      toast.success(action === 'remove' ? 'Content removed.' : 'Content updated.');
    } catch (error) {
      toast.error(error?.message || 'Action failed.');
    }
  };

  const getContentIcon = (type) => {
    switch (type) {
      case 'image':
        return <ImageIcon className="w-5 h-5 text-blue-500" />;
      case 'video':
        return <Video className="w-5 h-5 text-arvdoul-purple" />;
      default:
        return <FileText className="w-5 h-5 text-slate-500" />;
    }
  };

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
        title="Content Management"
        subtitle="Manage posts, videos, and media across the platform"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              aria-label="Search posts and media"
              type="text"
              placeholder="Search content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-arvdoul-purple"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
            {['all', 'text', 'image', 'video'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFilter(type)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition cursor-pointer ${
                  filter === type
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {type === 'all' ? 'All' : type}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {filteredContent.map((item) => (
            <div key={item.id} className="p-4 sm:p-5 flex gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
              <div className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                {item.media?.[0]?.url ? (
                  <LazyImage src={item.media[0].url} alt="" className="w-full h-full object-cover" />
                ) : (
                  getContentIcon(item.type)
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-slate-900 dark:text-white line-clamp-2">
                      {item.content || 'No content'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 tabular-nums">
                      by @{item.authorName} · {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => navigate(`/post/${item.id}`)}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                      aria-label="View post"
                      title="View"
                    >
                      <Eye className="w-4 h-4 text-slate-500" />
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/profile/${item.authorId}`)}
                      className="px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs text-slate-500 cursor-pointer"
                      aria-label={`View author ${item.authorName || item.authorId}`}
                    >
                      @{item.authorName}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleContentAction(item.id, 'hide')}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                      aria-label="Hide post"
                      title="Hide"
                    >
                      <XCircle className="w-4 h-4 text-amber-500" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleContentAction(item.id, 'delete')}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                      aria-label="Delete post"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 tabular-nums">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> {formatStat(item.stats?.views)} views
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> {formatStat(item.stats?.likes)} likes
                  </span>
                  {item.reportCount > 0 && (
                    <span className="flex items-center gap-1 text-red-500 font-medium">
                      <Flag className="w-3.5 h-3.5" /> {item.reportCount} reports
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filteredContent.length === 0 && (
            <div className="p-12 text-center">
              <FileText className="w-10 h-10 mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-500">No content found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminContentManagementScreen;
