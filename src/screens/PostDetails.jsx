// src/screens/PostDetails.jsx – Full post view with swipe to go back, all types work
import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, useMotionValue } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext';
import firestoreService from '../services/firestoreService.js';
import PostCard, { MediaGallery, PostHeader, PostContent, PostActions } from './PostCard.jsx';
import { ArrowLeft, Share2 } from 'lucide-react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { triggerHaptic } from '../utils/haptics';

const CommentsDrawer = React.lazy(() => import('./CommentsDrawer.jsx'));

const cn = (...classes) => classes.filter(Boolean).join(' ');

export default function PostDetails() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const dragX = useMotionValue(0);
  const [exitAnimating, setExitAnimating] = useState(false);
  const winWidth = typeof window !== 'undefined' ? window.innerWidth : 0;

  const loadPost = useCallback(async () => {
    setLoading(true);
    try {
      const result = await firestoreService.getPost(postId);
      if (result.success) setPost(result.post);
      else setError('Post not found');
    } catch (err) { setError('Failed to load post'); }
    finally { setLoading(false); }
  }, [postId]);

  useEffect(() => { loadPost(); }, [loadPost]);

  const handleDragEnd = (event, info) => {
    if (info.offset.x > 80 && info.velocity.x > 500) {
      setExitAnimating(true);
      setTimeout(() => navigate(-1), 300);
    } else dragX.set(0);
  };

  const handleShare = async () => {
    triggerHaptic('light');
    if (navigator.share) { try { await navigator.share({ title: post?.content?.substring(0, 100), url: window.location.href }); } catch {} }
    else { navigator.clipboard.writeText(window.location.href); toast.success('Link copied'); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center dark:bg-black"><div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (error || !post) return (
    <div className="min-h-screen flex items-center justify-center p-4 dark:bg-black">
      <div className="text-center max-w-md"><h2 className="text-xl font-bold mb-2 dark:text-white">{error || 'Post not found'}</h2><button onClick={() => navigate('/home')} className="px-4 py-2 rounded-xl bg-indigo-500 text-white">Back to Home</button></div>
    </div>
  );

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${theme === 'dark' ? 'bg-black' : 'bg-white'}`}>
      <div className="absolute top-4 left-4 z-20"><button onClick={() => navigate(-1)} className="p-2 rounded-full bg-black/50 backdrop-blur-sm text-white"><ArrowLeft className="w-6 h-6" /></button></div>
      <button onClick={handleShare} className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white"><Share2 className="w-6 h-6" /></button>

      <motion.div drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.1} onDragEnd={handleDragEnd} style={{ x: dragX }} className={`flex-1 overflow-y-auto ${exitAnimating ? 'pointer-events-none' : ''}`} animate={exitAnimating ? { x: winWidth } : {}} transition={{ duration: 0.3 }}>
        <div className="max-w-3xl mx-auto pt-16 pb-24 px-4">
          <ErrorBoundary><PostHeader post={post} currentUser={currentUser} navigate={navigate} onShowOptions={() => {}} /></ErrorBoundary>
          {post.media?.length > 0 && <MediaGallery media={post.media} type={post.type} onDoubleTap={() => {}} theme={theme} isVisible={true} />}
          <ErrorBoundary><PostContent post={post} /></ErrorBoundary>
          <ErrorBoundary><PostActions post={post} currentUser={currentUser} onComment={() => setShowComments(true)} theme={theme} /></ErrorBoundary>
        </div>
      </motion.div>

      {showComments && <Suspense fallback={<div className="p-4">Loading comments…</div>}><CommentsDrawer isOpen={showComments} onClose={() => setShowComments(false)} post={post} currentUser={currentUser} theme={theme} /></Suspense>}
    </div>
  );
}