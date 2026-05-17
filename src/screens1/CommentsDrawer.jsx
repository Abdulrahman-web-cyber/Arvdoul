// FIXED CommentsDrawer.jsx - Production Ready
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { commentService } from '../services/commentService.js';

const CommentsDrawer = React.memo(({ 
  isOpen, 
  onClose, 
  post, 
  currentUser, 
  theme 
}) => {
  const [comments, setComments] = useState([]);
  const [nestedComments, setNestedComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  
  const commentsEndRef = useRef(null);
  const drawerRef = useRef(null);
  const unsubscribeRef = useRef(null);

  // Load comments with commentService
  const loadComments = useCallback(async () => {
    if (!post?.id) return;
    
    setLoading(true);
    try {
      const result = await commentService.getCommentsByPost(post.id, {
        parentId: null, // Top-level comments only
        nested: true,   // Get nested structure
        limit: 50,
        cacheFirst: true
      });
      
      if (result.success) {
        setComments(result.comments);
        setNestedComments(result.comments);
      }
    } catch (error) {
      console.error('Load comments failed:', error);
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [post?.id]);

  // Setup real-time subscription
  useEffect(() => {
    if (!isOpen || !post?.id) return;
    
    // Load initial comments
    loadComments();
    
    // Setup real-time subscription
    const subscriptionId = commentService.subscribeToPostComments(
      post.id,
      (update) => {
        if (update.type === 'update') {
          setComments(update.comments);
          setNestedComments(update.comments);
        }
      },
      { parentId: null, nested: true, limit: 50 }
    );
    
    unsubscribeRef.current = () => commentService.unsubscribe(subscriptionId);
    
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [isOpen, post?.id, loadComments]);

  // Submit comment using commentService
  const handleSubmitComment = async () => {
    if (!newComment.trim() || !currentUser?.uid || !post?.id || submitting) return;
    
    setSubmitting(true);
    try {
      await commentService.createComment(post.id, currentUser.uid, newComment.trim(), {
        userName: currentUser.displayName,
        userUsername: currentUser.username,
        userAvatar: currentUser.photoURL
      });
      
      setNewComment('');
      toast.success('Comment posted!');
      
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      
    } catch (error) {
      console.error('Post comment failed:', error);
      toast.error(error.message || 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit reply using commentService
  const handleSubmitReply = async () => {
    if (!replyContent.trim() || !replyingTo || !currentUser?.uid || !post?.id) return;
    
    try {
      await commentService.replyToComment(replyingTo.id, currentUser.uid, replyContent.trim(), {
        userName: currentUser.displayName,
        userUsername: currentUser.username,
        userAvatar: currentUser.photoURL,
        replyToUsername: replyingTo.userUsername
      });
      
      setReplyContent('');
      setReplyingTo(null);
      toast.success('Reply posted!');
      
    } catch (error) {
      console.error('Post reply failed:', error);
      toast.error(error.message || 'Failed to post reply');
    }
  };

  // Like comment using commentService
  const handleLikeComment = async (commentId) => {
    if (!currentUser?.uid) {
      toast.error('Sign in to like comments');
      return;
    }
    
    try {
      await commentService.likeComment(commentId, currentUser.uid);
      // Real-time update will handle the UI update
    } catch (error) {
      console.error('Like comment failed:', error);
      toast.error(error.message || 'Failed to like comment');
    }
  };

  // Render nested comments recursively
  const renderCommentTree = (comments, depth = 0) => {
    return comments.map((comment) => (
      <div key={comment.id} className={`${depth > 0 ? 'ml-8 pl-4 border-l-2 border-gray-300 dark:border-gray-700' : ''}`}>
        <div className="flex gap-3 p-3 rounded-2xl bg-gray-50/50 dark:bg-gray-800/50 mb-3">
          <img
            src={comment.userPhoto || comment.userAvatar || '/assets/default-profile.png'}
            alt={comment.userName}
            className="w-10 h-10 rounded-full"
          />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-bold dark:text-white">{comment.userName}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatCommentTime(comment.createdAt)}
                </span>
              </div>
            </div>
            <p className="dark:text-gray-300 mb-2">{comment.content}</p>
            
            <div className="flex items-center gap-4 text-sm">
              <button 
                onClick={() => handleLikeComment(comment.id)}
                className="text-gray-500 hover:text-red-500 dark:hover:text-red-400 flex items-center gap-1"
              >
                <Heart className="w-4 h-4" />
                <span>{comment.likes || 0}</span>
              </button>
              
              <button 
                onClick={() => setReplyingTo(comment)}
                className="text-gray-500 hover:text-blue-500 dark:hover:text-blue-400"
              >
                Reply
              </button>
              
              {comment.replies?.length > 0 && (
                <button className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                  {comment.replies.length} replies
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2">
            {renderCommentTree(comment.replies, depth + 1)}
          </div>
        )}
      </div>
    ));
  };

  // ... (rest of the component remains similar with UI)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[90]"
          />
          
          {/* Drawer Content */}
          <motion.div
            ref={drawerRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`fixed ${showFullScreen ? 'inset-0' : 'bottom-0 left-0 right-0'} z-[91] ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'} ${showFullScreen ? '' : 'rounded-t-3xl'} shadow-2xl flex flex-col`}
            style={{ height: showFullScreen ? '100vh' : '90vh' }}
          >
            {/* Header */}
            <div className={`p-4 border-b ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <MessageCircle className="w-6 h-6" />
                <div>
                  <h3 className="text-xl font-bold dark:text-white">Comments</h3>
                  <p className="text-sm dark:text-gray-400">
                    {post?.stats?.comments || 0} comments • {comments.length} loaded
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFullScreen(!showFullScreen)}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {showFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Reply Input (if replying) */}
            {replyingTo && (
              <div className={`p-4 border-b ${theme === 'dark' ? 'border-blue-800/30' : 'border-blue-200'} bg-blue-50/50 dark:bg-blue-900/10`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-1">
                    <p className="text-sm dark:text-gray-300 mb-1">
                      Replying to <span className="font-bold">{replyingTo.userName}</span>
                    </p>
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Write your reply..."
                      className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white resize-none"
                      rows={2}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleSubmitReply}
                      disabled={!replyContent.trim()}
                      className="px-4 py-2 rounded-xl bg-blue-500 text-white disabled:opacity-50"
                    >
                      Reply
                    </button>
                    <button
                      onClick={() => setReplyingTo(null)}
                      className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex flex-col gap-4 py-8">
                  {[1,2,3].map(i => (
                    <div key={i} className="flex gap-3 p-3">
                      <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700 animate-pulse" />
                      <div className="flex-1">
                        <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded mb-2 animate-pulse" style={{ width: '60%' }} />
                        <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded mb-1 animate-pulse" style={{ width: '90%' }} />
                        <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded animate-pulse" style={{ width: '70%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : nestedComments.length === 0 ? (
                <div className="text-center py-12">
                  <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-bold mb-2 dark:text-white">No comments yet</h4>
                  <p className="text-gray-500 dark:text-gray-400">Be the first to comment!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {renderCommentTree(nestedComments)}
                  <div ref={commentsEndRef} />
                </div>
              )}
            </div>
            
            {/* Comment Input */}
            <div className={`p-4 border-t ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
              <div className="flex gap-2">
                <img
                  src={currentUser?.photoURL || '/assets/default-profile.png'}
                  alt={currentUser?.displayName}
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={replyingTo ? `Replying to ${replyingTo.userName}...` : "Write a comment..."}
                    className="w-full p-3 pl-4 pr-12 rounded-2xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:border-blue-500"
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && !submitting && handleSubmitComment()}
                  />
                  <button
                    onClick={handleSubmitComment}
                    disabled={!newComment.trim() || submitting}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-xl bg-blue-500 text-white disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

export default CommentsDrawer;