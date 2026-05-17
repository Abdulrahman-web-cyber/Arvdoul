// src/screens/PostOptionsDrawer.jsx – Fully Fixed, Optimistic, No Overlap
import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { X, Trash2, Flag, Ban, Edit, Zap, BarChart2, Share2, Copy, Bookmark, AlertCircle } from 'lucide-react';
import firestoreService from '../services/firestoreService.js';
import * as userService from '../services/userService.js';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { triggerHaptic } from '../utils/haptics';

const cn = (...classes) => classes.filter(Boolean).join(' ');

export default function PostOptionsDrawer({ isOpen, onClose, post, currentUser, navigate, theme }) {
  const [modal, setModal] = useState(null); // 'delete', 'report', 'block'
  const [reportReason, setReportReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const isAuthor = currentUser?.uid === post?.authorId;
  const isDark = theme === 'dark';

  if (!post) return null;

  const handleDelete = async () => {
    if (!currentUser) return toast.error('Sign in');
    setDeleting(true);
    try {
      await firestoreService.deletePost(post.id, currentUser.uid);
      toast.success('Post deleted');
      onClose();
      navigate('/home', { replace: true });
    } catch (err) {
      toast.error('Delete failed');
    } finally {
      setDeleting(false);
      setModal(null);
    }
  };

  const handleBlock = async () => {
    if (!currentUser) return toast.error('Sign in');
    try {
      await userService.blockUser(currentUser.uid, post.authorId);
      toast.success('User blocked');
      onClose();
    } catch (err) {
      toast.error('Block failed');
    }
    setModal(null);
  };

  const handleReport = async () => {
    if (!reportReason) return toast.error('Select a reason');
    try {
      const reportFn = httpsCallable(getFunctions(), 'reportPost');
      await reportFn({ postId: post.id, reporterId: currentUser.uid, reason: reportReason });
      toast.success('Report submitted');
      onClose();
    } catch (err) {
      toast.error('Report failed');
    }
    setModal(null);
    setReportReason('');
  };

  const handleShare = async () => {
    triggerHaptic('light');
    if (navigator.share) {
      try { await navigator.share({ title: post.content?.substring(0, 100), url: `${window.location.origin}/post/${post.id}` }); } catch {}
    } else {
      navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
      toast.success('Link copied');
    }
    onClose();
  };

  const handleSave = async () => {
    if (!currentUser) return toast.error('Sign in');
    triggerHaptic('light');
    try {
      await firestoreService.savePost(post.id, currentUser.uid);
      toast.success('Saved to bookmarks');
    } catch (err) {
      toast.error('Save failed');
    }
    onClose();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
    toast.success('Link copied');
    onClose();
  };

  const handleEdit = () => {
    navigate(`/edit/${post.id}`);
    onClose();
  };

  const options = [
    { icon: Share2, label: 'Share', onClick: handleShare, visible: true },
    { icon: Bookmark, label: 'Save', onClick: handleSave, visible: true },
    { icon: Copy, label: 'Copy link', onClick: handleCopyLink, visible: true },
    { icon: Edit, label: 'Edit', onClick: handleEdit, visible: isAuthor },
    { icon: Zap, label: 'Boost', onClick: () => toast.info('Boost coming soon'), visible: isAuthor },
    { icon: BarChart2, label: 'Analytics', onClick: () => toast.info('Analytics coming soon'), visible: isAuthor },
    { icon: Trash2, label: 'Delete', onClick: () => setModal('delete'), visible: isAuthor, danger: true },
    { icon: Flag, label: 'Report', onClick: () => setModal('report'), visible: !isAuthor, danger: true },
    { icon: Ban, label: 'Block User', onClick: () => setModal('block'), visible: !isAuthor, danger: true },
  ].filter(opt => opt.visible);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/70 backdrop-blur-xl z-[90]" />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            className={cn("fixed bottom-0 left-0 right-0 z-[91] rounded-t-3xl shadow-2xl max-h-[85vh] overflow-hidden", isDark ? 'bg-gray-900' : 'bg-white')}
          >
            <div className="p-6 border-b flex justify-between items-center">
              <div className="flex items-center gap-3">
                <img src={userService.getAvatarUrl(post.authorId, post.authorName, post.authorPhoto)} alt="" className="w-12 h-12 rounded-full object-cover" />
                <div>
                  <h3 className="font-bold dark:text-white">{post.authorName}</h3>
                  <p className="text-sm dark:text-gray-400">@{post.authorUsername}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(85vh-120px)]">
              <div className="grid grid-cols-4 gap-3">
                {options.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={opt.onClick}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-2xl transition",
                      opt.danger ? 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20' : 'bg-gray-100/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
                    )}
                  >
                    <opt.icon className={cn("w-6 h-6 mb-2", opt.danger ? 'text-red-500' : '')} />
                    <span className="text-xs text-center">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* DELETE MODAL */}
          {modal === 'delete' && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setModal(null)} />
              <motion.div className={cn("relative w-full max-w-md p-6 rounded-3xl shadow-2xl", isDark ? 'bg-gray-900' : 'bg-white')}>
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-3 text-center dark:text-white">Delete Post?</h3>
                <p className="text-center dark:text-gray-300 mb-6">This cannot be undone.</p>
                <div className="flex gap-3">
                  <button onClick={() => setModal(null)} className="flex-1 py-3 rounded-xl border dark:border-gray-700 dark:text-white">Cancel</button>
                  <button onClick={handleDelete} disabled={deleting} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-500 to-pink-500 text-white font-medium">
                    {deleting ? 'Deleting...' : 'Delete Forever'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* REPORT MODAL */}
          {modal === 'report' && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setModal(null)} />
              <motion.div className={cn("relative w-full max-w-md p-6 rounded-3xl shadow-2xl", isDark ? 'bg-gray-900' : 'bg-white')}>
                <h3 className="text-2xl font-bold mb-4 text-center dark:text-white">Report Post</h3>
                <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full p-3 rounded-xl border dark:border-gray-700 dark:bg-gray-800 mb-4">
                  <option value="">Select reason...</option>
                  <option value="spam">Spam</option>
                  <option value="harassment">Harassment</option>
                  <option value="inappropriate">Inappropriate</option>
                  <option value="violence">Violence</option>
                </select>
                <div className="flex gap-3">
                  <button onClick={() => setModal(null)} className="flex-1 py-3 rounded-xl border dark:border-gray-700">Cancel</button>
                  <button onClick={handleReport} disabled={!reportReason} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium">Submit</button>
                </div>
              </motion.div>
            </div>
          )}

          {/* BLOCK MODAL */}
          {modal === 'block' && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={() => setModal(null)} />
              <motion.div className={cn("relative w-full max-w-md p-6 rounded-3xl shadow-2xl", isDark ? 'bg-gray-900' : 'bg-white')}>
                <h3 className="text-2xl font-bold mb-3 text-center dark:text-white">Block @{post.authorUsername}?</h3>
                <p className="text-center dark:text-gray-300 mb-6">They won't be able to interact with you.</p>
                <div className="flex gap-3">
                  <button onClick={() => setModal(null)} className="flex-1 py-3 rounded-xl border dark:border-gray-700">Cancel</button>
                  <button onClick={handleBlock} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium">Block</button>
                </div>
              </motion.div>
            </div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}