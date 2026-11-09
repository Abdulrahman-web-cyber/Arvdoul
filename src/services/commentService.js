// src/services/commentService.js

const COMMENTS_CONFIG = {
  MAX_DEPTH: 6,
  MAX_COMMENT_LENGTH: 1000,
  MIN_COMMENT_LENGTH: 1,
  CACHE_EXPIRY: 5 * 60 * 1000,
  PAGINATION_LIMIT: 50,
  MAX_FETCH_LIMIT: 200,
  REAL_TIME_UPDATE_INTERVAL: 2000,
  SPAM_CHECK_THRESHOLD: 3,
  MENTION_LIMIT: 10,
  REPLY_DEPTH_LIMIT: 4,
  SPAM_COUNTER_SHARDS: 10,
  REACTION_ARRAY_CAP: 200,
};

import { cacheManager } from '../utils/CacheManager.js';
import { LOCAL_COMMENTS_PREFIX } from '../utils/localContentCache.js';
import { getSafeAvatarUrl } from '../utils/avatarUtils.js';
import { countersManager } from '../utils/CountersManager.js';
import { offlineQueue } from '../utils/OfflineQueue.js';
import { logger } from '../utils/Logger.js';
import { auditLogger } from '../utils/AuditLogger.js';
import { rateLimiter } from '../utils/RateLimiter.js';
import { errorHandler } from '../utils/ErrorHandler.js';

// Moderation states a reader may still see. `pending` is the pre-scan state and
// `pending_manual_review` is "flagged but shown until a human decides" (written
// with isHidden=false). Only `rejected`/`removed` hide, and those are always
// written together with isHidden=true. Excluding `pending_manual_review` here
// made a mildly-flagged comment vanish from the thread the moment the async
// moderation trigger flipped it off `pending` — a comment-reliability bug.
const VISIBLE_COMMENT_MODERATION_STATUSES = ['approved', 'pending', 'pending_manual_review'];

const COMMENT_REACTION_ARRAY_CAP = COMMENTS_CONFIG.REACTION_ARRAY_CAP;

class UltimateCommentService {
  constructor() {
    this.firestore = null;
    this.initialized = false;
    this.cache = cacheManager.namespace('comments', COMMENTS_CONFIG.CACHE_EXPIRY);
    this.realtimeSubscriptions = new Map();
    this.activeUsers = new Map();
    this.batchOperations = [];
    this.lastCleanup = Date.now();
    this.cleanupInterval = null;

    logger.warn('// Ultimate Comment Service V10 - Billion‑User Scale');

    // Auto-initialize
    this.initialize().catch(err => {
    });

    // Periodic cleanup
    this.cleanupInterval = setInterval(() => this.cleanupStaleData(), 60 * 1000);
  }

  async initialize() {
    if (this.initialized) return this.firestore;

    try {
      logger.warn('// Initializing Comment Service...');

      // Load Firebase
      const firebase = await import('../firebase/firebase.js');
      this.firestore = await firebase.getFirestoreInstance();

      if (!this.firestore) {
        throw new Error('Failed to get Firestore instance');
      }

      const firestoreModule = await import('firebase/firestore');
      this.firestoreModule = firestoreModule;

      this.firestoreMethods = {
        collection: firestoreModule.collection,
        addDoc: firestoreModule.addDoc,
        getDoc: firestoreModule.getDoc,
        getDocs: firestoreModule.getDocs,
        updateDoc: firestoreModule.updateDoc,
        deleteDoc: firestoreModule.deleteDoc,
        query: firestoreModule.query,
        where: firestoreModule.where,
        orderBy: firestoreModule.orderBy,
        limit: firestoreModule.limit,
        startAfter: firestoreModule.startAfter,
        startAt: firestoreModule.startAt,
        endAt: firestoreModule.endAt,
        serverTimestamp: firestoreModule.serverTimestamp,
        increment: firestoreModule.increment,
        arrayUnion: firestoreModule.arrayUnion,
        arrayRemove: firestoreModule.arrayRemove,
        doc: firestoreModule.doc,
        writeBatch: firestoreModule.writeBatch,
        onSnapshot: firestoreModule.onSnapshot,
        getCountFromServer: firestoreModule.getCountFromServer,
        disableNetwork: firestoreModule.disableNetwork,
        enableNetwork: firestoreModule.enableNetwork,
        runTransaction: firestoreModule.runTransaction,
        sum: firestoreModule.sum,
        average: firestoreModule.average,
        count: firestoreModule.count
      };

      this.initialized = true;
      logger.warn('// Comment service initialized successfully');
      return this.firestore;

    } catch (error) {
      logger.error('❌ Comment service initialization failed:', error);
      throw this._enhanceError(error, 'Failed to initialize comment service');
    }
  }

  async _ensureInitialized() {
    if (!this.initialized || !this.firestore) {
      await this.initialize();
    }
    return this.firestore;
  }

  async createComment(postId, userId, content, options = {}) {
    const startTime = Date.now();
    const operationId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      await this._ensureInitialized();

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await offlineQueue.enqueue({
          type: 'comment.create',
          payload: { postId, userId, content, options },
          idempotencyKey: operationId,
        });
        return { success: true, offlineQueued: true, operationId };
      }

      logger.debug('Creating comment', {
        operationId,
        postId,
        userId,
        contentLength: content.length,
        parentId: options.parentId || 'none'
      });

      const validation = this._validateComment(content, userId);
      if (!validation.valid) {
        throw new Error(`Comment validation failed: ${validation.errors.join(', ')}`);
      }

      const spamCheck = await this._checkSpamRate(userId);
      if (!spamCheck.allowed) {
        throw new Error(`Rate limit exceeded. Please wait ${spamCheck.waitTime} seconds`);
      }

      const extracted = this._extractMetadata(content);

      const commentData = {
        postId,
        userId,
        userAvatar: getSafeAvatarUrl(options.userAvatar, options.userName || `User_${userId.slice(0, 8)}`, userId),
        userName: options.userName || `User_${userId.slice(0, 8)}`,
        userUsername: options.userUsername || `user_${userId.slice(0, 8)}`,
        content: content.trim(),
        parentId: options.parentId || null,
        replyToId: options.replyToId || null,
        replyToUsername: options.replyToUsername || null,
        depth: options.depth || 0,
        path: options.path || `${postId}.${Date.now()}`,

        mentions: extracted.mentions,
        hashtags: extracted.hashtags,
        links: extracted.links,
        language: extracted.language,

        likes: 0,
        dislikes: 0,
        replies: 0,
        reports: 0,
        likesBy: [],
        dislikesBy: [],

        isEdited: false,
        isDeleted: false,
        isPinned: false,
        isFeatured: false,
        isSpam: false,
        isHidden: false,
        isLocked: false,
        moderationStatus: 'pending',
        moderationScore: 0,

        viewCount: 0,
        shareCount: 0,
        sentimentScore: 0,

        createdAt: this.firestoreMethods.serverTimestamp(),
        updatedAt: this.firestoreMethods.serverTimestamp(),
        lastActivityAt: this.firestoreMethods.serverTimestamp(),

        version: 'v2',
        _operationId: operationId,
        _clientCreatedAt: new Date().toISOString()
      };

      const commentsRef = this.firestoreMethods.collection(this.firestore, 'comments');
      const docRef = await this.firestoreMethods.addDoc(commentsRef, commentData);
      const commentId = docRef.id;

      await countersManager.increment({ docPath: `posts/${postId}`, field: 'comments' });

      if (options.parentId) {
        await countersManager.increment({ docPath: `comments/${options.parentId}`, field: 'replies' });
        const parentRef = this.firestoreMethods.doc(this.firestore, 'comments', options.parentId);
        await this.firestoreMethods.updateDoc(parentRef, {
          updatedAt: this.firestoreMethods.serverTimestamp(),
          lastActivityAt: this.firestoreMethods.serverTimestamp()
        });
      }

      if (extracted.mentions.length > 0) {
        this._processMentions(extracted.mentions, {
          commentId,
          postId,
          userId,
          userName: options.userName,
          content: content.substring(0, 100)
        }).catch((e) => logger.warn('Comment mentions processing failed', { commentId, error: e?.message }));
      }

      // Social loop: notify the post author (top-level comments only - replies
      // have their own _notifyReply) + award comment_created XP to the author.
      // Both are best-effort and never break the comment write.
      if (!options.parentId) {
        this._notifyPostAuthor(postId, userId, commentId).catch((e) =>
          logger.warn('Comment author notification failed', { commentId, error: e?.message }));
      }
      this._awardCommentXp(userId, commentId).catch((e) =>
        logger.warn('comment_created XP award failed', { commentId, error: e?.message }));

      this._invalidatePostCache(postId);

      if (typeof window !== 'undefined') {
        try {
          const key = `${LOCAL_COMMENTS_PREFIX}${postId}`;
          const current = JSON.parse(localStorage.getItem(key) || '[]');
          current.unshift({ ...commentData, id: commentId, createdAt: new Date().toISOString() });
          localStorage.setItem(key, JSON.stringify(current.slice(0, 50)));
        } catch {}
      }

      auditLogger.log('content.comment', { userId, meta: { commentId, postId, parentId: options.parentId || null } });

      return {
        success: true,
        commentId,
        comment: { ...commentData, id: commentId },
        operationId,
        duration: Date.now() - startTime
      };

    } catch (error) {
      logger.error('Create comment failed', { error: error.message, postId, userId });
      throw this._enhanceError(error, 'Failed to create comment');
    }
  }

  async getCommentsByPost(postId, options = {}) {
    const startTime = Date.now();
    const cacheKey = `post_comments_${postId}_${JSON.stringify(options)}`;

    try {
      await this._ensureInitialized();

      if (options.cacheFirst !== false) {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < COMMENTS_CONFIG.CACHE_EXPIRY) {
          return {
            success: true,
            comments: cached.comments,
            cached: true,
            duration: Date.now() - startTime
          };
        }
      }

      const commentsRef = this.firestoreMethods.collection(this.firestore, 'comments');

      let snapshot;
      try {
        const conditions = [
          this.firestoreMethods.where('postId', '==', postId),
          this.firestoreMethods.where('isDeleted', '==', false),
          this.firestoreMethods.where('isHidden', '==', false),
          this.firestoreMethods.where('moderationStatus', 'in', VISIBLE_COMMENT_MODERATION_STATUSES),
          this.firestoreMethods.orderBy('createdAt', 'desc')
        ];
        conditions.push(this.firestoreMethods.limit(
          Math.min(Number(options.limit) || COMMENTS_CONFIG.PAGINATION_LIMIT, COMMENTS_CONFIG.MAX_FETCH_LIMIT)
        ));
        const q = this.firestoreMethods.query(commentsRef, ...conditions);
        snapshot = await this.firestoreMethods.getDocs(q);
      } catch (indexErr) {
        logger.warn('Compound index query failed, using resilient simple query:', indexErr.message);
        try {
          const simpleQ = this.firestoreMethods.query(
            commentsRef,
            this.firestoreMethods.where('postId', '==', postId),
            this.firestoreMethods.limit(COMMENTS_CONFIG.MAX_FETCH_LIMIT)
          );
          snapshot = await this.firestoreMethods.getDocs(simpleQ);
        } catch (innerErr) {
          logger.warn('Simple query error, continuing to local cache:', innerErr.message);
          snapshot = { forEach: () => {}, size: 0, empty: true };
        }
      }

      const comments = [];
      const commentMap = new Map();

      if (snapshot && !snapshot.empty) {
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.isDeleted || data.isHidden) return;
          if (options.parentId === null || options.parentId === undefined) {
            if (data.parentId) return;
          } else if (options.parentId !== 'all') {
            if (data.parentId !== options.parentId) return;
          }
          const comment = {
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : new Date()),
            updatedAt: data.updatedAt?.toDate?.() || new Date()
          };

          comments.push(comment);
          commentMap.set(docSnap.id, comment);
        });
      }

      // Merge local-first persistent comments from localStorage
      if (typeof window !== 'undefined') {
        try {
          const localStored = JSON.parse(localStorage.getItem(`${LOCAL_COMMENTS_PREFIX}${postId}`) || '[]');
          if (Array.isArray(localStored)) {
            localStored.forEach(lc => {
              if (lc && lc.id && !commentMap.has(lc.id)) {
                const comment = {
                  ...lc,
                  createdAt: lc.createdAt ? new Date(lc.createdAt) : new Date(),
                  updatedAt: lc.updatedAt ? new Date(lc.updatedAt) : new Date()
                };
                comments.push(comment);
                commentMap.set(lc.id, comment);
              }
            });
          }
        } catch {}
      }

      let processedComments = comments;
      if (options.nested === true && options.parentId === null) {
        processedComments = this._buildNestedComments(comments);
      }

      if (options.sortBy) {
        processedComments = this._sortComments(processedComments, options.sortBy);
      }

      this.cache.set(cacheKey, {
        comments: processedComments,
        timestamp: Date.now(),
        count: processedComments.length
      });

      return {
        success: true,
        comments: processedComments,
        total: snapshot.size,
        hasMore: options.limit ? comments.length === options.limit : false,
        lastComment: comments.length > 0 ? comments[comments.length - 1] : null,
        cached: false,
        duration: Date.now() - startTime
      };

    } catch (error) {
      logger.error(`❌ Get comments for post ${postId} failed:`, error);
      return {
        success: false,
        comments: [],
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  async getComment(commentId, options = {}) {
    try {
      await this._ensureInitialized();

      const cacheKey = `comment_${commentId}`;
      if (options.cacheFirst !== false) {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < COMMENTS_CONFIG.CACHE_EXPIRY) {
          return { success: true, comment: cached.comment, cached: true };
        }
      }

      const commentRef = this.firestoreMethods.doc(this.firestore, 'comments', commentId);
      const commentSnap = await this.firestoreMethods.getDoc(commentRef);

      if (!commentSnap.exists()) {
        return { success: false, error: 'Comment not found', commentId };
      }

      const commentData = commentSnap.data();
      const comment = {
        id: commentSnap.id,
        ...commentData,
        createdAt: commentData.createdAt?.toDate?.() || new Date(),
        updatedAt: commentData.updatedAt?.toDate?.() || new Date()
      };

      this.cache.set(cacheKey, { comment, timestamp: Date.now() });

      return { success: true, comment, cached: false };

    } catch (error) {
      logger.error(`❌ Get comment ${commentId} failed:`, error);
      return { success: false, error: error.message, commentId };
    }
  }

  async updateComment(commentId, userId, updates) {
    try {
      await this._ensureInitialized();

      const comment = await this.getComment(commentId);
      if (!comment.success || comment.comment.userId !== userId) {
        throw new Error('You can only edit your own comments');
      }

      if (comment.comment.isLocked) {
        throw new Error('This comment thread has been locked');
      }

      if (updates.content) {
        const validation = this._validateComment(updates.content, userId);
        if (!validation.valid) {
          throw new Error(`Comment validation failed: ${validation.errors.join(', ')}`);
        }

        // Store comment edit history subcollection record (v8.0)
        const historyRef = this.firestoreMethods.collection(this.firestore, 'comments', commentId, 'history');
        await this.firestoreMethods.addDoc(historyRef, {
          previousContent: comment.comment.content,
          editedAt: this.firestoreMethods.serverTimestamp(),
          editedBy: userId
        }).catch((e) => logger.warn('Comment edit-history record failed', { commentId, error: e?.message }));

        const extracted = this._extractMetadata(updates.content);
        updates.mentions = extracted.mentions;
        updates.hashtags = extracted.hashtags;
        updates.links = extracted.links;
        updates.isEdited = true;
      }

      const commentRef = this.firestoreMethods.doc(this.firestore, 'comments', commentId);

      await this.firestoreMethods.updateDoc(commentRef, {
        ...updates,
        updatedAt: this.firestoreMethods.serverTimestamp(),
        lastActivityAt: this.firestoreMethods.serverTimestamp(),
        _lastEditedAt: new Date().toISOString(),
        _editCount: (comment.comment._editCount || 0) + 1
      });

      this._invalidateCommentCache(commentId);
      if (comment.comment.postId) {
        this._invalidatePostCache(comment.comment.postId);
      }

      return { success: true, commentId };

    } catch (error) {
      logger.error(`❌ Update comment ${commentId} failed:`, error);
      throw this._enhanceError(error, 'Failed to update comment');
    }
  }

  async deleteComment(commentId, userId, isAdmin = false) {
    try {
      await this._ensureInitialized();

      const comment = await this.getComment(commentId);
      if (!comment.success) {
        throw new Error('Comment not found');
      }

      if (!isAdmin && comment.comment.userId !== userId) {
        throw new Error('You can only delete your own comments');
      }

      const commentRef = this.firestoreMethods.doc(this.firestore, 'comments', commentId);
      const postId = comment.comment.postId;

      await this.firestoreMethods.updateDoc(commentRef, {
        isDeleted: true,
        deletedAt: this.firestoreMethods.serverTimestamp(),
        deletedBy: userId,
        deletedReason: isAdmin ? 'moderation' : 'user',
        updatedAt: this.firestoreMethods.serverTimestamp(),
        content: '[This comment has been deleted]',
        userName: '[Deleted User]',
        userUsername: '[deleted]',
        userAvatar: null
      });

      if (postId) {
        await countersManager.increment({ docPath: `posts/${postId}`, field: 'comments', amount: -1 });
      }

      if (comment.comment.parentId) {
        await countersManager.increment({ docPath: `comments/${comment.comment.parentId}`, field: 'replies', amount: -1 });
      }

      this._invalidateCommentCache(commentId);
      if (postId) {
        this._invalidatePostCache(postId);
      }

      return { success: true, commentId };

    } catch (error) {
      logger.error(`❌ Delete comment ${commentId} failed:`, error);
      throw this._enhanceError(error, 'Failed to delete comment');
    }
  }

  async likeComment(commentId, userId) {
    try {
      await this._ensureInitialized();

      const rl = rateLimiter.checkAndHit(`comment:react:${userId}`, { max: 120, windowMs: 60000 });
      if (!rl.allowed) {
        throw errorHandler.enhance(new Error('Too many reactions. Please slow down.'), { code: 5001, defaultMessage: 'Too many reactions. Please slow down.' });
      }

      const commentRef = this.firestoreMethods.doc(this.firestore, 'comments', commentId);
      const likeRef = this.firestoreMethods.doc(this.firestore, 'comments', commentId, 'likes', userId);

      const likeSnap = await this.firestoreMethods.getDoc(likeRef);
      const alreadyLiked = likeSnap.exists();

      if (alreadyLiked) {
        throw new Error('You have already liked this comment');
      }

      const comment = await this.getComment(commentId);
      const hadDislike = comment.success && comment.comment.dislikesBy?.includes(userId);

      await countersManager.increment({ docPath: `comments/${commentId}`, field: 'likes' });
      await this.firestoreMethods.setDoc(likeRef, {
        userId,
        likedAt: this.firestoreMethods.serverTimestamp(),
      }, { merge: true });

      const updates = {
        likesBy: this.firestoreMethods.arrayUnion(userId),
        updatedAt: this.firestoreMethods.serverTimestamp(),
        lastActivityAt: this.firestoreMethods.serverTimestamp()
      };
      if (hadDislike) {
        updates.dislikesBy = this.firestoreMethods.arrayRemove(userId);
        await countersManager.increment({ docPath: `comments/${commentId}`, field: 'dislikes', amount: -1 });
        await this.firestoreMethods.deleteDoc(this.firestoreMethods.doc(this.firestore, 'comments', commentId, 'dislikes', userId));
      }
      await this.firestoreMethods.updateDoc(commentRef, updates);
      await this._trimReactionArray(commentId, 'likesBy', COMMENT_REACTION_ARRAY_CAP);

      this._invalidateCommentCache(commentId);
      countersManager.invalidate({ docPath: `comments/${commentId}`, field: 'likes' });

      return { success: true, commentId, action: 'liked' };

    } catch (error) {
      logger.error('Like comment failed', { error: error.message, commentId, userId });
      throw this._enhanceError(error, 'Failed to like comment');
    }
  }

  async dislikeComment(commentId, userId) {
    try {
      await this._ensureInitialized();

      const commentRef = this.firestoreMethods.doc(this.firestore, 'comments', commentId);
      const dislikeRef = this.firestoreMethods.doc(this.firestore, 'comments', commentId, 'dislikes', userId);

      const dislikeSnap = await this.firestoreMethods.getDoc(dislikeRef);
      if (dislikeSnap.exists()) {
        throw new Error('You have already disliked this comment');
      }

      const comment = await this.getComment(commentId);
      const hadLike = comment.success && comment.comment.likesBy?.includes(userId);

      await countersManager.increment({ docPath: `comments/${commentId}`, field: 'dislikes' });
      await this.firestoreMethods.setDoc(dislikeRef, {
        userId,
        dislikedAt: this.firestoreMethods.serverTimestamp(),
      }, { merge: true });

      const updates = {
        dislikesBy: this.firestoreMethods.arrayUnion(userId),
        updatedAt: this.firestoreMethods.serverTimestamp(),
        lastActivityAt: this.firestoreMethods.serverTimestamp()
      };
      if (hadLike) {
        updates.likesBy = this.firestoreMethods.arrayRemove(userId);
        await countersManager.increment({ docPath: `comments/${commentId}`, field: 'likes', amount: -1 });
        await this.firestoreMethods.deleteDoc(this.firestoreMethods.doc(this.firestore, 'comments', commentId, 'likes', userId));
      }
      await this.firestoreMethods.updateDoc(commentRef, updates);
      await this._trimReactionArray(commentId, 'dislikesBy', COMMENT_REACTION_ARRAY_CAP);

      this._invalidateCommentCache(commentId);
      countersManager.invalidate({ docPath: `comments/${commentId}`, field: 'dislikes' });

      return { success: true, commentId, action: 'disliked' };

    } catch (error) {
      logger.error('Dislike comment failed', { error: error.message, commentId, userId });
      throw this._enhanceError(error, 'Failed to dislike comment');
    }
  }

  async removeLikeDislike(commentId, userId) {
    try {
      await this._ensureInitialized();

      const comment = await this.getComment(commentId);
      if (!comment.success) {
        throw new Error('Comment not found');
      }

      const commentRef = this.firestoreMethods.doc(this.firestore, 'comments', commentId);
      const updates = {
        updatedAt: this.firestoreMethods.serverTimestamp(),
        lastActivityAt: this.firestoreMethods.serverTimestamp()
      };

      if (comment.comment.likesBy?.includes(userId)) {
        await countersManager.increment({ docPath: `comments/${commentId}`, field: 'likes', amount: -1 });
        updates.likesBy = this.firestoreMethods.arrayRemove(userId);
        await this.firestoreMethods.deleteDoc(this.firestoreMethods.doc(this.firestore, 'comments', commentId, 'likes', userId));
      }

      if (comment.comment.dislikesBy?.includes(userId)) {
        await countersManager.increment({ docPath: `comments/${commentId}`, field: 'dislikes', amount: -1 });
        updates.dislikesBy = this.firestoreMethods.arrayRemove(userId);
        await this.firestoreMethods.deleteDoc(this.firestoreMethods.doc(this.firestore, 'comments', commentId, 'dislikes', userId));
      }

      await this.firestoreMethods.updateDoc(commentRef, updates);

      this._invalidateCommentCache(commentId);
      countersManager.invalidate({ docPath: `comments/${commentId}`, field: 'likes' });
      countersManager.invalidate({ docPath: `comments/${commentId}`, field: 'dislikes' });

      return { success: true, commentId, action: 'removed' };

    } catch (error) {
      logger.error('Remove like/dislike failed', { error: error.message, commentId, userId });
      throw this._enhanceError(error, 'Failed to remove reaction');
    }
  }

  /**
   * Persist an emoji reaction on a comment. The per-user choice lives in the
   * `reactions/{userId}` subcollection (mirroring post reactions) and the
   * aggregate `reactionCounts` map lives on the comment doc. Selecting the
   * same emoji again removes it. `CommentsDrawer` had called a
   * `commentService.addReaction` that did not exist, so every emoji tap was
   * dropped after the optimistic local update.
   */
  async addReaction(commentId, userId, emoji) {
    if (!commentId || !userId) throw new Error('commentId and userId are required');
    if (!emoji || typeof emoji !== 'string') throw new Error('A reaction emoji is required');
    try {
      await this._ensureInitialized();

      const rl = rateLimiter.checkAndHit(`comment:react:${userId}`, { max: 120, windowMs: 60000 });
      if (!rl.allowed) {
        throw errorHandler.enhance(new Error('Too many reactions. Please slow down.'), { code: 5001, defaultMessage: 'Too many reactions. Please slow down.' });
      }

      const { doc, runTransaction, serverTimestamp } = this.firestoreMethods;
      const commentRef = doc(this.firestore, 'comments', commentId);
      const reactionRef = doc(this.firestore, 'comments', commentId, 'reactions', userId);

      let action = 'added';
      let previous = null;
      await runTransaction(this.firestore, async (transaction) => {
        const reactionSnap = await transaction.get(reactionRef);
        previous = reactionSnap.exists() ? reactionSnap.data().emoji : null;
        const commentSnap = await transaction.get(commentRef);
        if (!commentSnap.exists()) throw new Error('Comment not found');

        const counts = { ...(commentSnap.data().reactionCounts || {}) };
        if (previous) counts[previous] = Math.max(0, (counts[previous] || 0) - 1);
        if (previous === emoji) {
          transaction.delete(reactionRef);
          action = 'removed';
        } else {
          transaction.set(reactionRef, { userId, emoji, updatedAt: serverTimestamp() }, { merge: true });
          counts[emoji] = (counts[emoji] || 0) + 1;
          action = previous ? 'changed' : 'added';
        }
        transaction.update(commentRef, {
          reactionCounts: counts,
          updatedAt: serverTimestamp(),
          lastActivityAt: serverTimestamp(),
        });
      });

      this._invalidateCommentCache(commentId);
      return { success: true, commentId, action, emoji };
    } catch (error) {
      logger.error('Add comment reaction failed', { error: error.message, commentId, userId });
      throw this._enhanceError(error, 'Failed to react to comment');
    }
  }

  /**
   * Read the edit-history subcollection written by `updateComment`.
   * `CommentsDrawer`'s edit-history modal called a
   * `commentService.getCommentHistoryUI` that did not exist, so the modal
   * always showed an empty list.
   */
  async getCommentHistoryUI(commentId) {
    try {
      await this._ensureInitialized();
      const { collection, query, orderBy, limit, getDocs } = this.firestoreMethods;
      const historyRef = collection(this.firestore, 'comments', commentId, 'history');
      let snapshot;
      try {
        snapshot = await getDocs(query(historyRef, orderBy('editedAt', 'desc'), limit(20)));
      } catch {
        snapshot = await getDocs(query(historyRef, limit(20)));
      }
      const edits = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          editedAt: data.editedAt?.toDate?.() || (data.editedAt ? new Date(data.editedAt) : null),
        };
      });
      return { success: true, edits };
    } catch (error) {
      logger.error('Get comment history failed', { error: error.message, commentId });
      // Fail closed: an empty edit list reported as success would render as
      // "never edited" and hide the failure.
      return { success: false, edits: [], error: error?.message || 'comment-history-failed' };
    }
  }

  /**
   * Pin/unpin a comment on its parent target. The pin marker is stored on the
   * TARGET document (`pinnedCommentId`) rather than on the comment, because a
   * post author pinning another user's comment is denied by the comment update
   * rule (non-authors may only touch reaction fields). The drawer had called a
   * `commentService.pinCommentToTarget` that did not exist, so pins were
   * local-only and vanished on reload.
   */
  async pinCommentToTarget(targetType, targetId, commentId, userId, pinned = true) {
    if (targetType !== 'post') throw new Error('Only post comments can be pinned');
    try {
      await this._ensureInitialized();
      const { doc, updateDoc, serverTimestamp } = this.firestoreMethods;
      const targetRef = doc(this.firestore, 'posts', targetId);
      await updateDoc(targetRef, {
        pinnedCommentId: pinned ? commentId : null,
        updatedAt: serverTimestamp(),
      });
      this.cache.delete(targetId);
      this._invalidatePostCache(targetId);
      return { success: true, targetId, commentId, pinned };
    } catch (error) {
      logger.error('Pin comment failed', { error: error.message, targetId, commentId });
      throw this._enhanceError(error, 'Failed to pin comment');
    }
  }

  /**
   * Comment read aliased to a generic target. The feed's inline comment
   * preview (`PostCard`) called `commentService.getCommentsByTarget`, which did
   * not exist, so the preview silently never rendered.
   */
  async getCommentsByTarget(targetType, targetId, options = {}, extra = {}) {
    if (targetType !== 'post') return { success: true, comments: [] };
    if (extra?.signal?.aborted) return { success: true, comments: [] };
    return this.getCommentsByPost(targetId, options);
  }

  async replyToComment(parentCommentId, userId, content, options = {}) {
    try {
      await this._ensureInitialized();

      const parentComment = await this.getComment(parentCommentId);
      if (!parentComment.success) {
        throw new Error('Parent comment not found');
      }

      if (parentComment.comment.isLocked) {
        throw new Error('This comment thread has been locked');
      }

      if (parentComment.comment.depth >= COMMENTS_CONFIG.REPLY_DEPTH_LIMIT) {
        throw new Error('Maximum reply depth reached');
      }

      const replyOptions = {
        parentId: parentCommentId,
        replyToId: parentComment.comment.userId,
        replyToUsername: parentComment.comment.userUsername,
        depth: parentComment.comment.depth + 1,
        path: `${parentComment.comment.path}.${Date.now()}`,
        ...options
      };

      const result = await this.createComment(
        parentComment.comment.postId,
        userId,
        content,
        replyOptions
      );

      if (parentComment.comment.userId !== userId) {
        this._notifyReply({
          commentId: result.commentId,
          parentCommentId,
          replyAuthorId: userId,
          replyAuthorName: options.userName || `User_${userId.slice(0, 8)}`,
          postId: parentComment.comment.postId,
          content: content.substring(0, 100)
        }).catch((e) => logger.warn('Reply notification failed', { parentCommentId, error: e?.message }));
      }

      return result;

    } catch (error) {
      logger.error(`❌ Reply to comment ${parentCommentId} failed:`, error);
      throw this._enhanceError(error, 'Failed to reply to comment');
    }
  }

  async getReplies(commentId, options = {}) {
    try {
      await this._ensureInitialized();

      const commentsRef = this.firestoreMethods.collection(this.firestore, 'comments');
      const conditions = [
        this.firestoreMethods.where('parentId', '==', commentId),
        this.firestoreMethods.where('isDeleted', '==', false),
        this.firestoreMethods.where('isHidden', '==', false),
        this.firestoreMethods.orderBy('createdAt', 'asc')
      ];

      const pageSize = options.limit || COMMENTS_CONFIG.PAGINATION_LIMIT;
      conditions.push(this.firestoreMethods.limit(pageSize));

      // Callers pass the cursor as `startAfter` (the drawer's name); accept
      // `cursor` too. Reading only `cursor` meant the "load more replies"
      // control re-fetched page 1 forever (deduped, so nothing new appeared).
      const afterId = options.startAfter || options.cursor;
      if (afterId) {
        const cursorRef = this.firestoreMethods.doc(this.firestore, 'comments', afterId);
        const cursorSnap = await this.firestoreMethods.getDoc(cursorRef);
        if (cursorSnap.exists()) {
          conditions.push(this.firestoreMethods.startAfter(cursorSnap));
        }
      }

      const q = this.firestoreMethods.query(commentsRef, ...conditions);
      const snapshot = await this.firestoreMethods.getDocs(q);

      const replies = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        replies.push({
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date()
        });
      });

      const hasMore = snapshot.size === pageSize;
      const nextCursor = hasMore && snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1].id : null;

      return {
        success: true,
        replies,
        total: snapshot.size,
        parentCommentId: commentId,
        hasMore,
        nextCursor
      };

    } catch (error) {
      logger.error('Get replies failed', { error: error.message, commentId });
      return { success: false, replies: [], error: error.message };
    }
  }

  subscribeToPostComments(postId, callback, options = {}) {
    const subscriptionId = `post_${postId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const setupSubscription = async () => {
      try {
        await this._ensureInitialized();

        const commentsRef = this.firestoreMethods.collection(this.firestore, 'comments');
        const conditions = [
          this.firestoreMethods.where('postId', '==', postId),
          this.firestoreMethods.where('isDeleted', '==', false),
          this.firestoreMethods.where('isHidden', '==', false),
          this.firestoreMethods.orderBy('createdAt', 'desc')
        ];

        if (options.parentId === null || options.parentId === undefined) {
          conditions.push(this.firestoreMethods.where('parentId', '==', null));
        }

        if (options.limit) {
          conditions.push(this.firestoreMethods.limit(options.limit));
        }

        const q = this.firestoreMethods.query(commentsRef, ...conditions);

        const unsubscribe = this.firestoreMethods.onSnapshot(q, (snapshot) => {
          const comments = [];
          snapshot.forEach(docSnap => {
            const data = docSnap.data();
            comments.push({
              id: docSnap.id,
              ...data,
              createdAt: data.createdAt?.toDate?.() || new Date(),
              updatedAt: data.updatedAt?.toDate?.() || new Date()
            });
          });

          let processedComments = comments;
          if (options.nested === true) {
            processedComments = this._buildNestedComments(comments);
          }

          callback({
            type: 'update',
            comments: processedComments,
            count: snapshot.size,
            subscriptionId,
            timestamp: new Date().toISOString()
          });
        }, (error) => {
          logger.error(`❌ Comment subscription error for post ${postId}:`, error);
          callback({
            type: 'error',
            error: error.message,
            subscriptionId,
            timestamp: new Date().toISOString()
          });
        });

        this.realtimeSubscriptions.set(subscriptionId, {
          unsubscribe,
          postId,
          createdAt: Date.now(),
          callback
        });

        return subscriptionId;

      } catch (error) {
        logger.error(`❌ Setup subscription for post ${postId} failed:`, error);
        callback({
          type: 'error',
          error: error.message,
          subscriptionId,
          timestamp: new Date().toISOString()
        });
        return null;
      }
    };

    setupSubscription();
    return subscriptionId;
  }

  unsubscribe(subscriptionId) {
    const subscription = this.realtimeSubscriptions.get(subscriptionId);
    if (subscription) {
      try {
        subscription.unsubscribe();
        this.realtimeSubscriptions.delete(subscriptionId);
        return true;
      } catch (error) {
        return false;
      }
    }
    return false;
  }

  async reportComment(commentId, userId, reason, details = '') {
    await this._ensureInitialized();
    // Route through the reportContent callable like every other report type.
    // The direct write stamped `userId`, but firestore.rules authorises
    // `comment_reports` create/read on `reporterId`, so the write was denied and
    // the report never reached the moderator queue. The callable rate-limits,
    // de-duplicates and writes the queue-compatible record.
    const { callFunction, FUNCTIONS } = await import('./callableService.js');
    const data = await callFunction(FUNCTIONS.REPORT_COMMENT, {
      targetId: commentId,
      reason,
      details,
    });
    return { success: true, commentId, reported: true, ...(data || {}) };
  }


  _validateComment(content, userId) {
    const errors = [];
    const warnings = [];

    if (!content || content.trim().length < COMMENTS_CONFIG.MIN_COMMENT_LENGTH) {
      errors.push('Comment cannot be empty');
    }

    if (content.length > COMMENTS_CONFIG.MAX_COMMENT_LENGTH) {
      errors.push(`Comment too long (max ${COMMENTS_CONFIG.MAX_COMMENT_LENGTH} characters)`);
    }

    const spamPatterns = [
      /(http|https):\/\/[^\s]+/g,
      /[A-Z]{5,}/g,
      /!{3,}/g,
      /\?{3,}/g,
      /\.{4,}/g
    ];

    let spamScore = 0;
    spamPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) spamScore += matches.length;
    });

    if (spamScore > 3) {
      warnings.push('Comment contains spam-like patterns');
    }

    const mentions = content.match(/@(\w+)/g) || [];
    if (mentions.length > COMMENTS_CONFIG.MENTION_LIMIT) {
      errors.push(`Too many mentions (max ${COMMENTS_CONFIG.MENTION_LIMIT})`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      spamScore,
      mentionCount: mentions.length
    };
  }

  _extractMetadata(content) {
    const mentionMatches = content.match(/@(\w+)/g) || [];
    const mentions = [...new Set(mentionMatches.map(m => m.substring(1).toLowerCase()))];

    const hashtagMatches = content.match(/#(\w+)/g) || [];
    const hashtags = [...new Set(hashtagMatches.map(h => h.substring(1).toLowerCase()))];

    const linkMatches = content.match(/(https?:\/\/[^\s]+)/g) || [];
    const links = [...new Set(linkMatches)];

    return {
      mentions,
      hashtags,
      links,
      language: 'en'
    };
  }

  _buildNestedComments(comments) {
    const commentMap = new Map();
    const rootComments = [];

    comments.forEach(comment => {
      comment.replies = [];
      commentMap.set(comment.id, comment);
    });

    comments.forEach(comment => {
      if (comment.parentId && commentMap.has(comment.parentId)) {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.replies.push(comment);
          parent.replies.sort((a, b) => a.createdAt - b.createdAt);
        }
      } else {
        rootComments.push(comment);
      }
    });

    rootComments.sort((a, b) => b.createdAt - a.createdAt);

    return rootComments;
  }

  _sortComments(comments, sortBy) {
    const sorted = [...comments];

    switch (sortBy) {
      case 'newest':
        sorted.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'oldest':
        sorted.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case 'popular':
        sorted.sort((a, b) => {
          const aScore = (a.likes || 0) - (a.dislikes || 0);
          const bScore = (b.likes || 0) - (b.dislikes || 0);
          return bScore - aScore;
        });
        break;
      case 'controversial':
        sorted.sort((a, b) => {
          const aTotal = (a.likes || 0) + (a.dislikes || 0);
          const bTotal = (b.likes || 0) + (b.dislikes || 0);
          return bTotal - aTotal;
        });
        break;
    }

    return sorted;
  }

  async _checkSpamRate(userId) {
    await this._ensureInitialized();
    const minuteTimestamp = Math.floor(Date.now() / 60000);
    const threshold = COMMENTS_CONFIG.SPAM_CHECK_THRESHOLD;
    const shards = COMMENTS_CONFIG.SPAM_COUNTER_SHARDS;

    const shardIndex = Math.floor(Math.random() * shards);
    const shardId = `comment_${userId}_${minuteTimestamp}_shard_${shardIndex}`;
    const shardRef = this.firestoreMethods.doc(this.firestore, 'rate_limits', shardId);

    const shardReads = [];
    for (let i = 0; i < shards; i++) {
      const readId = `comment_${userId}_${minuteTimestamp}_shard_${i}`;
      const ref = this.firestoreMethods.doc(this.firestore, 'rate_limits', readId);
      shardReads.push(this.firestoreMethods.getDoc(ref).then(snap => snap.exists() ? snap.data().count : 0));
    }

    try {
      const shardCounts = await Promise.all(shardReads);
      const totalCount = shardCounts.reduce((sum, c) => sum + c, 0);

      if (totalCount >= threshold) {
        const waitTime = 60 - Math.floor((Date.now() % 60000) / 1000);
        return { allowed: false, count: totalCount, waitTime };
      }

      await this.firestoreMethods.updateDoc(shardRef, {
        count: this.firestoreMethods.increment(1),
        updatedAt: this.firestoreMethods.serverTimestamp()
      }).catch(async (err) => {
        if (err.code === 'not-found') {
          await this.firestoreMethods.setDoc(shardRef, {
            userId,
            minute: minuteTimestamp,
            shard: shardIndex,
            count: 1,
            updatedAt: this.firestoreMethods.serverTimestamp()
          });
        } else {
          throw err;
        }
      });

      return { allowed: true, count: totalCount + 1, waitTime: 0 };
    } catch (error) {
      // Client-side spam counting is advisory (the server enforces the real
      // limit); never block a comment on a counter-write failure — but log it so
      // a persistent rules/index failure is observable instead of silent.
      logger.warn('_checkSpamRate counter update failed; allowing comment', { userId, error: error?.message });
      return { allowed: true, count: 0, waitTime: 0 };
    }
  }

  async _processMentions(mentions, context) {
    if (!mentions.length) return;

    try {
      await this._ensureInitialized();

      const usersRef = this.firestoreMethods.collection(this.firestore, 'users');
      const { getNotificationsService } = await import('./notificationsService.js');
      const notifications = getNotificationsService();

      const chunkSize = 10;
      for (let i = 0; i < mentions.length; i += chunkSize) {
        const chunk = mentions.slice(i, i + chunkSize);
        const userQuery = this.firestoreMethods.query(
          usersRef,
          this.firestoreMethods.where('username', 'in', chunk)
        );
        const userSnapshot = await this.firestoreMethods.getDocs(userQuery);

        // Route through the server `sendNotification` callable. The previous
        // code wrote a top-level `notifications` document from the client, but
        // that collection is `allow create: if false` — the write was denied
        // and the empty catch swallowed it, so mentions notified nobody.
        for (const docSnap of userSnapshot.docs) {
          try {
            await notifications.sendNotification({
              type: 'mention',
              recipientId: docSnap.id,
              senderId: context.userId,
              title: 'You were mentioned in a comment',
              message: `${context.userName || 'Someone'} mentioned you in a comment`,
              data: {
                commentId: context.commentId,
                postId: context.postId,
                authorId: context.userId,
                authorName: context.userName,
                preview: context.content
              }
            });
          } catch (err) {
            logger.warn('Mention notification failed', { error: err.message });
          }
        }
      }
    } catch (error) {
      logger.warn('Mention processing failed', { error: error.message });
    }
  }

  /** Notifies the post author when a top-level comment is created. */
  async _notifyPostAuthor(postId, userId, commentId) {
    try {
      await this._ensureInitialized();
      const postSnap = await this.firestoreMethods.getDoc(
        this.firestoreMethods.doc(this.firestore, 'posts', postId)
      );
      const authorId = postSnap.exists() ? (postSnap.data().authorId || postSnap.data().userId) : null;
      if (!authorId || authorId === userId) return;

      const { getNotificationsService } = await import('./notificationsService.js');
      await getNotificationsService().createCommentNotification(postId, userId, authorId, commentId);
    } catch (err) {
      logger.warn('Post-author comment notification failed', { error: err.message });
    }
  }

  /** Best-effort comment_created XP award for the commenter. */
  async _awardCommentXp(userId, commentId) {
    try {
      const { levelSystemService } = await import('./levelSystemService.js');
      await levelSystemService.awardExperience({ userId, action: 'comment_created', source: commentId });
    } catch (err) {
      logger.debug('Comment XP award skipped', { error: err.message });
    }
  }

  async _notifyReply(context) {
    try {
      const { getNotificationsService } = await import('./notificationsService.js');
      const notifications = getNotificationsService();
      await notifications.sendNotification({
        type: 'reply',
        recipientId: context.replyToId,
        senderId: context.replyAuthorId,
        title: 'New reply to your comment',
        message: `${context.replyAuthorName} replied to your comment`,
        data: {
          commentId: context.commentId,
          parentCommentId: context.parentCommentId,
          postId: context.postId,
          authorId: context.replyAuthorId,
          authorName: context.replyAuthorName,
          preview: context.content
        }
      });
    } catch (err) {
      logger.warn('Reply notification failed', { error: err.message });
    }
  }




  _invalidateCommentCache(commentId) {
    this.cache.delete(`comment_${commentId}`);

    for (const [key] of this.cache.entries()) {
      if (key.includes('post_comments_')) {
        this.cache.delete(key);
      }
    }
  }

  _invalidatePostCache(postId) {
    for (const [key] of this.cache.entries()) {
      if (key.includes(`post_comments_${postId}`)) {
        this.cache.delete(key);
      }
    }
  }

  _enhanceError(error, defaultMessage) {
    const errorMap = {
      'permission-denied': 'You do not have permission to perform this action.',
      'unauthenticated': 'Please sign in to comment.',
      'not-found': 'Comment not found.',
      'already-exists': 'Comment already exists.',
      'failed-precondition': 'Operation failed. Please refresh.',
      'resource-exhausted': 'Rate limit exceeded. Please wait.',
      'deadline-exceeded': 'Request timeout. Please try again.',
      'aborted': 'Operation aborted.',
      'unavailable': 'Service temporarily unavailable.',
      'invalid-argument': 'Invalid comment data.',
      'cancelled': 'Operation was cancelled.',
      'data-loss': 'Unrecoverable data loss or corruption.',
      'out-of-range': 'Operation was attempted past the valid range.',
      'internal': 'Internal server error.',
      'unknown': 'An unknown error occurred.'
    };

    const enhanced = new Error(errorMap[error.code] || defaultMessage || 'Comment operation failed');
    enhanced.code = error.code || 'unknown';
    enhanced.originalError = error;
    enhanced.timestamp = new Date().toISOString();

    return enhanced;
  }

  async _trimReactionArray(commentId, field, cap) {
    try {
      const commentRef = this.firestoreMethods.doc(this.firestore, 'comments', commentId);
      const snap = await this.firestoreMethods.getDoc(commentRef);
      if (!snap.exists()) return;
      const arr = snap.data()[field] || [];
      if (arr.length <= cap) return;
      const trimmed = arr.slice(-cap);
      await this.firestoreMethods.updateDoc(commentRef, { [field]: trimmed });
    } catch (err) {
      logger.debug('Reaction array trim skipped', { error: err.message, commentId });
    }
  }

  cleanupStaleData() {
    const now = Date.now();

    cacheManager.purgeExpired();

    for (const [id, subscription] of this.realtimeSubscriptions.entries()) {
      if (now - subscription.createdAt > 30 * 60 * 1000) {
        this.unsubscribe(id);
      }
    }

    if (now - this.lastCleanup > 60 * 1000) {
      logger.warn('// Comment service cleanup completed');
      this.lastCleanup = now;
    }
  }

  async batchDeleteComments(commentIds, userId, isAdmin = false) {
    try {
      await this._ensureInitialized();

      const batch = this.firestoreMethods.writeBatch(this.firestore);
      const postUpdates = new Map();

      const chunkSize = 10;
      for (let i = 0; i < commentIds.length; i += chunkSize) {
        const chunk = commentIds.slice(i, i + chunkSize);

        const commentRefs = chunk.map(id => 
          this.firestoreMethods.doc(this.firestore, 'comments', id)
        );

        const snapshots = await this.firestoreMethods.getAll(...commentRefs);

        for (const snap of snapshots) {
          if (!snap.exists()) continue;

          const commentData = snap.data();
          const commentId = snap.id;

          if (!isAdmin && commentData.userId !== userId) {
            continue;
          }

          const commentRef = snap.ref;
          batch.update(commentRef, {
            isDeleted: true,
            deletedAt: this.firestoreMethods.serverTimestamp(),
            deletedBy: userId,
            deletedReason: isAdmin ? 'admin_batch_delete' : 'user_batch_delete',
            updatedAt: this.firestoreMethods.serverTimestamp(),
            content: '[This comment has been deleted]'
          });

          const postId = commentData.postId;
          if (postId) {
            const current = postUpdates.get(postId) || 0;
            postUpdates.set(postId, current + 1);
          }

          this._invalidateCommentCache(commentId);
        }
      }

      if (postUpdates.size > 0) {
        await batch.commit();

        for (const [postId, count] of postUpdates.entries()) {
          await countersManager.increment({ docPath: `posts/${postId}`, field: 'comments', amount: -count });
          this._invalidatePostCache(postId);
        }
      }

      return {
        success: true,
        deleted: Array.from(postUpdates.values()).reduce((a, b) => a + b, 0),
        total: commentIds.length,
        failed: commentIds.length - Array.from(postUpdates.values()).reduce((a, b) => a + b, 0)
      };

    } catch (error) {
      logger.error('❌ Batch delete comments failed:', error);
      throw this._enhanceError(error, 'Failed to batch delete comments');
    }
  }

  async getCommentStats(postId = null, userId = null) {
    try {
      await this._ensureInitialized();

      const commentsRef = this.firestoreMethods.collection(this.firestore, 'comments');
      const conditions = [];

      if (postId) {
        conditions.push(this.firestoreMethods.where('postId', '==', postId));
      }

      if (userId) {
        conditions.push(this.firestoreMethods.where('userId', '==', userId));
      }

      conditions.push(this.firestoreMethods.where('isDeleted', '==', false));

      const q = this.firestoreMethods.query(commentsRef, ...conditions);

      const snapshot = await this.firestoreMethods.getCountFromServer(q);

      return {
        success: true,
        stats: {
          totalComments: snapshot.data().count,
          averageLikes: 0,
          averageReplies: 0,
          topCommenters: []
        }
      };

    } catch (error) {
      logger.error('Get comment stats failed', { error: error.message });
      return { success: false, stats: null, error: error.message };
    }
  }

  getStats() {
    return {
      cacheSize: this.cache.size,
      subscriptions: this.realtimeSubscriptions.size,
      initialized: this.initialized,
      activeUsers: this.activeUsers.size
    };
  }

  clearCache() {
    this.cache.clear();
    logger.info('Comment service cache cleared');
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    for (const subscriptionId of this.realtimeSubscriptions.keys()) {
      this.unsubscribe(subscriptionId);
    }

    this.clearCache();
    this.activeUsers.clear();

    this.initialized = false;
    this.firestore = null;
    this.firestoreMethods = null;
    this.firestoreModule = null;

    logger.warn('// Comment service destroyed');
  }
}

let commentServiceInstance = null;

function getCommentService() {
  if (!commentServiceInstance) {
    commentServiceInstance = new UltimateCommentService();
  }
  return commentServiceInstance;
}

const commentService = {
  initialize: () => getCommentService().initialize(),
  createComment: (postId, userId, content, options) =>
    getCommentService().createComment(postId, userId, content, options),
  getCommentsByPost: (postId, options) =>
    getCommentService().getCommentsByPost(postId, options),
  getComment: (commentId, options) =>
    getCommentService().getComment(commentId, options),
  updateComment: (commentId, userId, updates) =>
    getCommentService().updateComment(commentId, userId, updates),
  deleteComment: (commentId, userId, isAdmin) =>
    getCommentService().deleteComment(commentId, userId, isAdmin),
  likeComment: (commentId, userId) =>
    getCommentService().likeComment(commentId, userId),
  dislikeComment: (commentId, userId) =>
    getCommentService().dislikeComment(commentId, userId),
  removeLikeDislike: (commentId, userId) =>
    getCommentService().removeLikeDislike(commentId, userId),
  addReaction: (commentId, userId, emoji) =>
    getCommentService().addReaction(commentId, userId, emoji),
  getCommentHistoryUI: (commentId) =>
    getCommentService().getCommentHistoryUI(commentId),
  pinCommentToTarget: (targetType, targetId, commentId, userId, pinned) =>
    getCommentService().pinCommentToTarget(targetType, targetId, commentId, userId, pinned),
  getCommentsByTarget: (targetType, targetId, options, extra) =>
    getCommentService().getCommentsByTarget(targetType, targetId, options, extra),
  replyToComment: (parentCommentId, userId, content, options) =>
    getCommentService().replyToComment(parentCommentId, userId, content, options),
  getReplies: (commentId, options) =>
    getCommentService().getReplies(commentId, options),
  subscribeToPostComments: (postId, callback, options) =>
    getCommentService().subscribeToPostComments(postId, callback, options),
  unsubscribe: (subscriptionId) =>
    getCommentService().unsubscribe(subscriptionId),
  reportComment: (commentId, userId, reason, details) =>
    getCommentService().reportComment(commentId, userId, reason, details),
  batchDeleteComments: (commentIds, userId, isAdmin) =>
    getCommentService().batchDeleteComments(commentIds, userId, isAdmin),
  getCommentStats: (postId, userId) =>
    getCommentService().getCommentStats(postId, userId),
  getService: getCommentService,
  getStats: () => getCommentService().getStats(),
  clearCache: () => getCommentService().clearCache(),
  destroy: () => getCommentService().destroy(),
  ensureInitialized: () => getCommentService()._ensureInitialized()
};

export default commentService;
export { commentService, getCommentService };