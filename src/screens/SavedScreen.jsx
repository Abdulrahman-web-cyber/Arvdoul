// src/screens/SavedScreen.jsx - ARVDOUL SAVED POSTS (REAL)
// Cursor-paginated saved posts from firestoreService with unsave actions.
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '@context/ThemeContext';
import { cn } from '../lib/utils';
import { ArrowLeft, Bookmark, Heart, MessageCircle, Share2, Loader2 } from 'lucide-react';

export default function SavedScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef(null);
  const loadingMoreRef = useRef(false);

  const colors = {
    bg: isDark ? 'bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a]' : 'bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8]',
    card: isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-white/90 border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    secondary: isDark ? 'text-gray-400' : 'text-gray-600',
  };

  const loadPage = useCallback(async (next = false) => {
    if (!user?.uid || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    if (!next) setLoading(true);
    try {
      const { getFirestoreService } = await import('../services/firestoreService.js');
      const res = await getFirestoreService().getSavedPosts(user.uid, {
        limit: 20,
        startAfter: next ? cursorRef.current : undefined,
      });
      if (res?.success) {
        setPosts((p) => (next ? [...p, ...res.posts] : res.posts));
        setHasMore(res.hasMore);
        cursorRef.current = res.nextCursor;
      }
    } catch (err) {
      toast.error('Could not load saved posts.');
    } finally {
      loadingMoreRef.current = false;
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => { loadPage(false); }, [loadPage]);

  const handleUnsave = async (postId) => {
    if (!user?.uid) return;
    try {
      const { getFirestoreService } = await import('../services/firestoreService.js');
      await getFirestoreService().unsavePost(postId, user.uid);
      setPosts((p) => p.filter((x) => x.id !== postId));
      toast.success('Removed from saved.');
    } catch (err) {
      toast.error('Could not unsave.');
    }
  };

  const openPost = (post) => {
    if (post?.id) navigate(`/post/${post.id}`);
    else navigate('/home');
  };

  return (
    <div className={cn("min-h-screen pb-16", colors.bg)}>
      <div className={cn("sticky top-0 z-50 border-b backdrop-blur-xl", colors.card, "border")}>
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label="Go back" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className={cn("text-xl font-bold", colors.text)}>Saved</h1>
          <button
            onClick={() => navigate('/collections')}
            className={cn("ml-auto px-3 py-1.5 rounded-xl text-sm font-semibold transition", "bg-violet-500/15 text-violet-500 hover:bg-violet-500/25")}
          >
            Collections
          </button>
          <span className={cn("text-sm ml-2", colors.secondary)}>{posts.length} saved</span>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 text-violet-500 animate-spin" /></div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <Bookmark className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className={cn("font-semibold", colors.text)}>Nothing saved yet</p>
            <p className={cn("text-sm mt-1", colors.secondary)}>Tap the bookmark icon on any post to save it here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((post, i) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4) }}
                className={cn("rounded-2xl overflow-hidden cursor-pointer group", colors.card, "border")}
                onClick={() => openPost(post)}
              >
                {post.media?.[0]?.url || post.image ? (
                  <div className="aspect-square w-full overflow-hidden">
                    <img
                      src={post.media?.[0]?.url || post.image}
                      alt={post.content?.slice(0, 60) || 'Saved post'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="aspect-square w-full flex items-center justify-center p-4 bg-gradient-to-br from-violet-500/10 to-cyan-500/10">
                    <p className={cn("text-sm line-clamp-4", colors.text)}>{post.content || 'Post'}</p>
                  </div>
                )}
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={cn("text-xs flex items-center gap-1", colors.secondary)}><Heart className="w-3.5 h-3.5" />{post.stats?.likes || 0}</span>
                      <span className={cn("text-xs flex items-center gap-1", colors.secondary)}><MessageCircle className="w-3.5 h-3.5" />{post.stats?.comments || 0}</span>
                      <span className={cn("text-xs flex items-center gap-1", colors.secondary)}><Share2 className="w-3.5 h-3.5" />{post.stats?.shares || 0}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleUnsave(post.id); }}
                      aria-label="Unsave"
                      className="p-1.5 rounded-full bg-violet-500/15 text-violet-500 hover:bg-violet-500/25"
                    >
                      <Bookmark className="w-4 h-4 fill-current" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {hasMore && !loading && (
          <div className="text-center py-6">
            <button
              onClick={() => loadPage(true)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold"
            >
              Load More
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
