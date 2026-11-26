// src/screens/PostDetails.jsx

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useParams, useNavigate } from 'react-router-dom';
import { motion, useMotionValue } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext';
import { useLayoutChrome } from '../context/LayoutChromeContext.jsx';
import firestoreService from '../services/firestoreService.js';
import { trackAnalyticsEvent } from '../services/analyticsService';
import PostCard from './PostCard.jsx';
import { useAuthorStanding } from '../hooks/useAuthorStanding';
import { ArrowLeft, Share2 } from 'lucide-react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { triggerHaptic } from '../utils/haptics';

const CommentsDrawer = React.lazy(() => import('./CommentsDrawer.jsx'));
const PostOptionsDrawer = React.lazy(() => import('./PostOptionsDrawer.jsx'));

export default function PostDetails() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { theme } = useTheme();
  const { hasTopAppBar } = useLayoutChrome();
  const isDark = theme === 'dark';
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const dragX = useMotionValue(0);
  const [exitAnimating, setExitAnimating] = useState(false);
  const winWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  const authorStanding = useAuthorStanding(post ? [post] : []);

  const loadPost = useCallback(async () => {
    setLoading(true);
    try {
      const result = await firestoreService.getPost(postId);
      if (result.success) setPost(result.post);
      else setError('Post not found');
    } catch {
      setError('Failed to load post');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => { loadPost(); }, [loadPost]);

  const handleDragEnd = (event, info) => {
    if (info.offset.x > 80 && info.velocity.x > 500) {
      setExitAnimating(true);
      setTimeout(() => navigate(-1), 300);
    } else dragX.set(0);
  };

  const handleShare = useCallback(async () => {
    triggerHaptic('light');
    let shared = false;
    if (navigator.share) {
      try {
        await navigator.share({ title: post?.content?.substring(0, 100), url: window.location.href });
        shared = true;
      } catch (err) {
        if (err?.name !== 'AbortError') {
          try {
            await navigator.clipboard?.writeText?.(window.location.href);
            toast.success('Link copied');
            shared = true;
          } catch {
            /* clipboard not available */
          }
        }
      }
    } else {
      await navigator.clipboard?.writeText?.(window.location.href);
      toast.success('Link copied');
      shared = true;
    }

    if (shared && post?.id) {
      setPost((prev) =>
        prev
          ? {
              ...prev,
              stats: {
                ...(prev.stats || {}),
                shares: (prev.stats?.shares ?? 0) + 1,
              },
            }
          : prev
      );
      if (currentUser?.uid) {
        firestoreService.sharePost?.(post.id, currentUser.uid).catch((e) => {
          console.warn('[PostDetails] share not recorded', e?.message);
        });
      }
    }
  }, [post?.id, post?.content, currentUser?.uid]);

  useEffect(() => {
    const onDetailShare = () => {
      handleShare();
    };
    window.addEventListener('arvdoul:share_detail', onDetailShare);
    return () => window.removeEventListener('arvdoul:share_detail', onDetailShare);
  }, [handleShare]);

  if (loading) {
    return (
      <div className={hasTopAppBar ? 'min-h-[60vh] flex items-center justify-center' : `min-h-screen flex items-center justify-center ${isDark ? 'bg-[#03071B]' : 'bg-[#F6F8FC]'}`}>
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (error || !post) {
    return (
      <div className={hasTopAppBar ? 'min-h-[60vh] flex items-center justify-center p-4' : `min-h-screen flex items-center justify-center p-4 ${isDark ? 'bg-[#03071B]' : 'bg-[#F6F8FC]'}`}>
        <div className="text-center max-w-md">
          <h2 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">{error || 'Post not found'}</h2>
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="px-4 py-2 rounded-xl bg-arvdoul-gradient text-white font-semibold text-sm shadow-md"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        hasTopAppBar
          ? 'flex-1 min-h-full flex flex-col'
          : `fixed inset-0 z-50 flex flex-col ${isDark ? 'bg-[#03071B]' : 'bg-[#F6F8FC]'}`
      }
    >
      {!hasTopAppBar && (
        <>
          <div className="absolute top-4 left-4 z-20">
            <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="p-2 rounded-full bg-black/50 backdrop-blur-sm text-white">
              <ArrowLeft className="w-6 h-6" />
            </button>
          </div>
          <button type="button" onClick={handleShare} aria-label="Share" className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white">
            <Share2 className="w-6 h-6" />
          </button>
        </>
      )}

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x: dragX }}
        className={`flex-1 overflow-y-auto ${exitAnimating ? 'pointer-events-none' : ''}`}
        animate={exitAnimating ? { x: winWidth } : {}}
        transition={{ duration: 0.3 }}
      >
        <div className={hasTopAppBar ? 'max-w-3xl mx-auto pt-3 sm:pt-5 pb-24 px-3 sm:px-4' : 'max-w-3xl mx-auto pt-16 pb-24 px-4'}>
          <ErrorBoundary>
            <PostCard
              post={post}
              currentUser={currentUser}
              navigate={navigate}
              onOpenComments={() => setShowComments(true)}
              onOpenOptions={() => setShowOptions(true)}
              isVisible
              authorStanding={authorStanding[post.authorId]}
            />
          </ErrorBoundary>
        </div>
      </motion.div>

      {showComments && (
        <Suspense fallback={<div className="p-4">Loading comments…</div>}>
          <CommentsDrawer
            isOpen={showComments}
            onClose={() => setShowComments(false)}
            post={post}
            currentUser={currentUser}
            theme={theme}
            onCommentAdded={() => {
              setPost((prev) =>
                prev ? { ...prev, stats: { ...(prev.stats || {}), comments: (prev.stats?.comments ?? 0) + 1 } } : prev
              );
            }}
            onCommentDeleted={() => {
              setPost((prev) =>
                prev
                  ? { ...prev, stats: { ...(prev.stats || {}), comments: Math.max(0, (prev.stats?.comments ?? 1) - 1) } }
                  : prev
              );
            }}
          />
        </Suspense>
      )}
      {showOptions && (
        <Suspense fallback={null}>
          <PostOptionsDrawer
            isOpen={showOptions}
            onClose={() => setShowOptions(false)}
            post={post}
            currentUser={currentUser}
            theme={theme}
            onPostDeleted={() => navigate('/home')}
            onPostRemoved={() => navigate('/home')}
            onPostUpdated={(_, updates) => {
              setPost((prev) => (prev ? { ...prev, ...updates } : prev));
            }}
            onAnalytics={trackAnalyticsEvent}
          />
        </Suspense>
      )}
    </div>
  );
}