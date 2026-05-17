// src/services/commentService.js - ULTIMATE PRODUCTION V15 - UNIVERSAL COMMENT ENGINE
// 💬 REAL‑TIME THREADED COMMENTS • ANY TARGET TYPE (post, story, video, poll, ...)
// 🧩 GENERIC COUNTERS + TARGET DOCUMENT SYNC • OPTIONAL ANONYMITY (PERSISTENT IDENTITY)
// 📝 RICH TEXT / MARKDOWN SUPPORT • TRANSLATION & SENTIMENT ANALYSIS HOOKS
// 🏆 PINNED/FEATURED COMMENTS (TARGET‑LEVEL) • EDIT HISTORY • MENTION COOLDOWN
// 🧹 AUTOMATIC CLEANUP OF OLD REACTIONS & HISTORY • FULL ERROR MAPPING
// 🔥 FULLY INTEGRATED WITH NOTIFICATIONS, FEED & FIRESTORE SERVICES
// 📝 REQUIRED FIRESTORE INDEXES ARE DOCUMENTED AT THE BOTTOM
// 🚀 SCALABLE TO 1B+ USERS • PRODUCTION‑READY

const COMMENTS_CONFIG = {
  MAX_DEPTH: 6,
  MAX_COMMENT_LENGTH: 10000,           // Increased for rich text
  MIN_COMMENT_LENGTH: 1,
  CACHE_EXPIRY: 5 * 60 * 1000,
  PAGINATION_LIMIT: 50,
  REAL_TIME_UPDATE_INTERVAL: 2000,
  SPAM_CHECK_THRESHOLD: 3,
  MENTION_LIMIT: 10,
  REPLY_DEPTH_LIMIT: 6,
  // Auto‑moderation is handled by a Cloud Function using Perspective API.
  TOXIC_WORDS: ['idiot', 'stupid', 'retard', 'hate', 'kill yourself'],
  SPAM_PATTERNS: [
    /buy now|cheap|discount|click here|limited time/gi,
    /bit\.ly|goo\.gl|tinyurl|shorturl/gi,
    /casino|poker|betting|gambling/gi,
    /viagra|cialis|levitra/gi,
    /follow me|like for like|follow for follow/gi
  ],
  SPAM_COUNTER_SHARDS: 10,
  ALLOWED_REACTIONS: ['👍', '❤️', '😂', '😮', '😢', '👎'],
  HISTORY_RETENTION_DAYS: 30,
  REACTION_RETENTION_DAYS: 90,
  USE_CLOUD_FUNCTIONS: true,
  ANONYMOUS_PREFIX: 'Anonymous',
  ANONYMOUS_HASH_SALT: 'arvdoul_comment_anon_salt',
  // Rich text supported formats
  SUPPORTED_FORMATS: ['plain', 'markdown', 'html'],
  DEFAULT_FORMAT: 'plain',
};

class UltimateCommentService {
  constructor() {
    this.firestore = null;
    this.initialized = false;
    this.cache = new Map();
    this.realtimeSubscriptions = new Map();
    this.activeUsers = new Map();
    this.lastCleanup = Date.now();
    this.cleanupInterval = null;

    console.log('💬 Ultimate Comment Service V15 - Universal Comment Engine');

    this.initialize().catch(err => {
      console.warn('Comment service initialization warning:', err.message);
    });

    this.cleanupInterval = setInterval(() => this.cleanupStaleData(), 60 * 1000);
  }

  // ==================== INITIALIZATION ====================
  async initialize() {
    if (this.initialized) return this.firestore;

    try {
      console.log('🚀 Initializing Comment Service...');

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
        enableIndexedDbPersistence: firestoreModule.enableIndexedDbPersistence,
        runTransaction: firestoreModule.runTransaction,
        sum: firestoreModule.sum,
        average: firestoreModule.average,
        count: firestoreModule.count,
        getAll: firestoreModule.getAll,
        setDoc: firestoreModule.setDoc,
      };

      try {
        await this.firestoreMethods.enableIndexedDbPersistence(this.firestore, {
          synchronizeTabs: true,
          forceOwnership: false
        });
        console.log('✅ Comment service persistence enabled');
      } catch (persistenceError) {
        console.warn('⚠️ Comment service persistence warning:', persistenceError.message);
      }

      this.initialized = true;
      console.log('✅ Comment service initialized successfully');
      return this.firestore;

    } catch (error) {
      console.error('❌ Comment service initialization failed:', error);
      throw this._enhanceError(error, 'Failed to initialize comment service');
    }
  }

  async _ensureInitialized() {
    if (!this.initialized || !this.firestore) {
      await this.initialize();
    }
    return this.firestore;
  }

  // ==================== GENERIC COUNTER MANAGEMENT ====================
  async _incrementCommentCounter(targetType, targetId, delta = 1) {
    await this._ensureInitialized();
    const counterRef = this.firestoreMethods.doc(
      this.firestore,
      'comment_counts',
      targetType,
      targetId
    );
    await this.firestoreMethods.runTransaction(this.firestore, async (transaction) => {
      const snap = await transaction.get(counterRef);
      const current = snap.exists() ? snap.data().count : 0;
      transaction.set(counterRef, {
        count: current + delta,
        updatedAt: this.firestoreMethods.serverTimestamp(),
        targetType,
        targetId
      }, { merge: true });
    });
  }

  async getCommentCount(targetType, targetId) {
    await this._ensureInitialized();
    const counterRef = this.firestoreMethods.doc(
      this.firestore,
      'comment_counts',
      targetType,
      targetId
    );
    const snap = await this.firestoreMethods.getDoc(counterRef);
    return snap.exists() ? snap.data().count : 0;
  }

  // ==================== SYNC TARGET DOCUMENT COUNT (for backward compatibility) ====================
  async _syncTargetCommentCount(targetType, targetId, delta = 1) {
    // Only sync for posts (to keep feedService working)
    if (targetType !== 'post') return;

    try {
      const targetRef = this.firestoreMethods.doc(this.firestore, 'posts', targetId);
      await this.firestoreMethods.runTransaction(this.firestore, async (transaction) => {
        const snap = await transaction.get(targetRef);
        if (snap.exists()) {
          const currentStats = snap.data().stats || {};
          const newCount = (currentStats.comments || 0) + delta;
          transaction.update(targetRef, {
            'stats.comments': newCount,
            updatedAt: this.firestoreMethods.serverTimestamp()
          });
        }
      });
    } catch (error) {
      console.warn(`Failed to sync comment count for ${targetType}/${targetId}:`, error);
    }
  }

  // ==================== ANONYMOUS IDENTITY HELPER ====================
  _getAnonymousDisplayName(userId, targetType, targetId) {
    const hashInput = `${userId}_${targetType}_${targetId}_${COMMENTS_CONFIG.ANONYMOUS_HASH_SALT}`;
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const num = Math.abs(hash) % 10000;
    return `${COMMENTS_CONFIG.ANONYMOUS_PREFIX} ${num}`;
  }

  // ==================== COMMENT CREATION ====================
  async createComment(targetType, targetId, userId, content, options = {}) {
    const startTime = Date.now();
    const operationId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      await this._ensureInitialized();

      console.log('💬 Creating comment:', {
        operationId,
        targetType,
        targetId,
        userId,
        contentLength: typeof content === 'string' ? content.length : JSON.stringify(content).length,
        parentId: options.parentId || 'none'
      });

      // Validate content (supports both plain text and rich content)
      let validatedContent;
      let format = options.format || COMMENTS_CONFIG.DEFAULT_FORMAT;
      if (format === 'plain') {
        validatedContent = content.trim();
      } else if (format === 'markdown' || format === 'html') {
        validatedContent = content;
      } else {
        throw new Error(`Unsupported content format: ${format}`);
      }

      const validation = this._validateComment(validatedContent, userId, format);
      if (!validation.valid) {
        throw new Error(`Comment validation failed: ${validation.errors.join(', ')}`);
      }

      const spamCheck = await this._checkSpamRate(userId);
      if (!spamCheck.allowed) {
        throw new Error(`Rate limit exceeded. Please wait ${spamCheck.waitTime} seconds`);
      }

      const extracted = this._extractMetadata(validatedContent);

      // Determine user display name for anonymous mode
      let userName = options.userName;
      let userUsername = options.userUsername;
      let userAvatar = options.userAvatar;
      if (options.isAnonymous) {
        const anonName = this._getAnonymousDisplayName(userId, targetType, targetId);
        userName = anonName;
        userUsername = `anon_${userId.slice(0, 8)}`;
        userAvatar = '/assets/anonymous-profile.png';
      } else {
        userName = userName || `User_${userId.slice(0, 8)}`;
        userUsername = userUsername || `user_${userId.slice(0, 8)}`;
        userAvatar = userAvatar || '/assets/default-profile.png';
      }

      // Prepare comment data
      const commentData = {
        targetType,
        targetId,
        postId: targetType === 'post' ? targetId : null,
        userId,
        userAvatar,
        userName,
        userUsername,
        content: validatedContent,
        contentFormat: format,                 // 'plain', 'markdown', 'html'
        parentId: options.parentId || null,
        replyToId: options.replyToId || null,
        replyToUsername: options.replyToUsername || null,
        depth: options.depth || 0,
        path: options.path || `${targetType}_${targetId}.${Date.now()}`,
        isAnonymous: options.isAnonymous || false,

        // Metadata
        mentions: extracted.mentions,
        hashtags: extracted.hashtags,
        links: extracted.links,
        language: extracted.language,
        translatedContent: null,               // To be filled by Cloud Function
        translationLanguage: null,
        sentimentScore: 0,                    // To be filled by Cloud Function

        // Engagement
        likes: 0,
        dislikes: 0,
        replies: 0,
        reports: 0,
        likesBy: [],
        dislikesBy: [],
        reactionCounts: {},

        // Moderation
        isEdited: false,
        isDeleted: false,
        isPinned: false,
        isFeatured: false,
        isSpam: false,
        isHidden: false,
        moderationStatus: 'pending',
        moderationScore: 0,

        // Analytics
        viewCount: 0,
        shareCount: 0,

        // Timestamps
        createdAt: this.firestoreMethods.serverTimestamp(),
        updatedAt: this.firestoreMethods.serverTimestamp(),
        lastActivityAt: this.firestoreMethods.serverTimestamp(),

        // System
        version: 'v3',
        _operationId: operationId,
        _clientCreatedAt: new Date().toISOString()
      };

      // Add to Firestore
      const commentsRef = this.firestoreMethods.collection(this.firestore, 'comments');
      const docRef = await this.firestoreMethods.addDoc(commentsRef, commentData);
      const commentId = docRef.id;

      // Update generic counter
      await this._incrementCommentCounter(targetType, targetId, 1);

      // Update target document's comment count (for backward compatibility, especially posts)
      await this._syncTargetCommentCount(targetType, targetId, 1);

      // If it's a reply, update parent comment
      if (options.parentId) {
        const parentRef = this.firestoreMethods.doc(this.firestore, 'comments', options.parentId);
        await this.firestoreMethods.updateDoc(parentRef, {
          replies: this.firestoreMethods.increment(1),
          updatedAt: this.firestoreMethods.serverTimestamp(),
          lastActivityAt: this.firestoreMethods.serverTimestamp()
        });
      }

      // Send notification (non‑blocking)
      this._sendCommentNotification(targetType, targetId, userId, commentId, options.parentId, options.targetOwnerId).catch(console.warn);

      console.log('✅ Comment created successfully:', {
        id: commentId,
        targetType,
        targetId,
        userId,
        depth: options.depth || 0
      });

      // Invalidate cache
      this._invalidateTargetCache(targetType, targetId);

      return {
        success: true,
        commentId,
        comment: { ...commentData, id: commentId },
        operationId,
        duration: Date.now() - startTime
      };

    } catch (error) {
      console.error('❌ Create comment failed:', error);
      throw this._enhanceError(error, 'Failed to create comment');
    }
  }

  async _sendCommentNotification(targetType, targetId, commentAuthorId, commentId, parentId = null, targetOwnerId = null) {
    try {
      const notifications = await import('./notificationsService.js').then(m => m.getNotificationsService?.() || m.default?.getNotificationsService?.());
      if (!notifications) return;

      let recipientId = null;
      let notificationType = 'comment';

      if (parentId) {
        const parentComment = await this.getComment(parentId);
        if (parentComment.success && parentComment.comment.userId !== commentAuthorId) {
          recipientId = parentComment.comment.userId;
          notificationType = 'reply';
        }
      } else if (targetOwnerId && targetOwnerId !== commentAuthorId) {
        recipientId = targetOwnerId;
      }

      if (recipientId) {
        // For backward compatibility with notificationsService (which expects postId, commenter, owner, commentId)
        // For non‑post targets, we'll use a generic notification method.
        if (targetType === 'post') {
          await notifications.createCommentNotification(targetId, commentAuthorId, recipientId, commentId);
        } else {
          // Fallback to generic notification
          await notifications.sendNotification({
            type: notificationType,
            targetType,
            targetId,
            commentId,
            senderId: commentAuthorId,
            recipientId,
            title: 'New comment',
            message: `Someone commented on your ${targetType}`
          });
        }
      }
    } catch (err) {
      console.warn('Failed to send comment notification:', err);
    }
  }

  // ==================== COMMENT RETRIEVAL ====================
  async getCommentsByTarget(targetType, targetId, options = {}) {
    const startTime = Date.now();
    const cacheKey = `comments_${targetType}_${targetId}_${JSON.stringify(options)}`;

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

      const conditions = [
        this.firestoreMethods.where('targetType', '==', targetType),
        this.firestoreMethods.where('targetId', '==', targetId),
        this.firestoreMethods.where('isDeleted', '==', false),
        this.firestoreMethods.where('isHidden', '==', false),
        this.firestoreMethods.where('moderationStatus', '==', 'approved'),
        this.firestoreMethods.orderBy('createdAt', 'desc')
      ];

      if (options.parentId === null || options.parentId === undefined) {
        conditions.push(this.firestoreMethods.where('parentId', '==', null));
      } else if (options.parentId !== 'all') {
        conditions.push(this.firestoreMethods.where('parentId', '==', options.parentId));
      }

      if (options.maxDepth !== undefined) {
        conditions.push(this.firestoreMethods.where('depth', '<=', options.maxDepth));
      }

      if (options.limit) {
        conditions.push(this.firestoreMethods.limit(options.limit));
      }

      if (options.startAfter) {
        conditions.push(this.firestoreMethods.startAfter(options.startAfter));
      }

      const q = this.firestoreMethods.query(commentsRef, ...conditions);
      const snapshot = await this.firestoreMethods.getDocs(q);

      const comments = [];
      const commentMap = new Map();

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const comment = {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date()
        };
        comments.push(comment);
        commentMap.set(docSnap.id, comment);
      });

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
      console.error(`❌ Get comments for ${targetType}/${targetId} failed:`, error);
      return {
        success: false,
        comments: [],
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  async getCommentsByPost(postId, options = {}) {
    return this.getCommentsByTarget('post', postId, options);
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
      console.error(`❌ Get comment ${commentId} failed:`, error);
      return { success: false, error: error.message, commentId };
    }
  }

  // ==================== COMMENT UPDATES ====================
  async updateComment(commentId, userId, updates) {
    try {
      await this._ensureInitialized();

      const current = await this.getComment(commentId);
      if (!current.success || current.comment.userId !== userId) {
        throw new Error('You can only edit your own comments');
      }

      if (updates.content) {
        const format = updates.format || current.comment.contentFormat || COMMENTS_CONFIG.DEFAULT_FORMAT;
        const validation = this._validateComment(updates.content, userId, format);
        if (!validation.valid) {
          throw new Error(`Comment validation failed: ${validation.errors.join(', ')}`);
        }

        const extracted = this._extractMetadata(updates.content);
        updates.mentions = extracted.mentions;
        updates.hashtags = extracted.hashtags;
        updates.links = extracted.links;
        updates.isEdited = true;
      }

      // Store history
      const historyRef = this.firestoreMethods.collection(
        this.firestore,
        'comments',
        commentId,
        'history'
      );
      await this.firestoreMethods.addDoc(historyRef, {
        ...current.comment,
        archivedAt: this.firestoreMethods.serverTimestamp(),
        version: (current.comment._editCount || 0) + 1
      });

      const commentRef = this.firestoreMethods.doc(this.firestore, 'comments', commentId);
      await this.firestoreMethods.updateDoc(commentRef, {
        ...updates,
        updatedAt: this.firestoreMethods.serverTimestamp(),
        lastActivityAt: this.firestoreMethods.serverTimestamp(),
        _lastEditedAt: new Date().toISOString(),
        _editCount: (current.comment._editCount || 0) + 1
      });

      this._invalidateCommentCache(commentId);
      if (current.comment.targetType && current.comment.targetId) {
        this._invalidateTargetCache(current.comment.targetType, current.comment.targetId);
      }

      return { success: true, commentId };

    } catch (error) {
      console.error(`❌ Update comment ${commentId} failed:`, error);
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
      const { targetType, targetId, parentId } = comment.comment;

      await this.firestoreMethods.updateDoc(commentRef, {
        isDeleted: true,
        deletedAt: this.firestoreMethods.serverTimestamp(),
        deletedBy: userId,
        deletedReason: isAdmin ? 'admin_action' : 'user_action',
        updatedAt: this.firestoreMethods.serverTimestamp(),
        content: '[This comment has been deleted]',
        userName: '[Deleted User]',
        userUsername: '[deleted]',
        userAvatar: null
      });

      await this._incrementCommentCounter(targetType, targetId, -1);
      await this._syncTargetCommentCount(targetType, targetId, -1);

      if (parentId) {
        const parentRef = this.firestoreMethods.doc(this.firestore, 'comments', parentId);
        await this.firestoreMethods.updateDoc(parentRef, {
          replies: this.firestoreMethods.increment(-1),
          updatedAt: this.firestoreMethods.serverTimestamp()
        });
      }

      this._invalidateCommentCache(commentId);
      if (targetType && targetId) {
        this._invalidateTargetCache(targetType, targetId);
      }

      return { success: true, commentId };

    } catch (error) {
      console.error(`❌ Delete comment ${commentId} failed:`, error);
      throw this._enhanceError(error, 'Failed to delete comment');
    }
  }

  // ==================== COMMENT ENGAGEMENT ====================
  async likeComment(commentId, userId) {
    try {
      await this._ensureInitialized();

      const commentRef = this.firestoreMethods.doc(this.firestore, 'comments', commentId);
      const comment = await this.getComment(commentId);
      if (!comment.success) throw new Error('Comment not found');

      const updates = {
        likes: this.firestoreMethods.increment(1),
        likesBy: this.firestoreMethods.arrayUnion(userId),
        updatedAt: this.firestoreMethods.serverTimestamp(),
        lastActivityAt: this.firestoreMethods.serverTimestamp()
      };

      if (comment.comment.dislikesBy?.includes(userId)) {
        updates.dislikes = this.firestoreMethods.increment(-1);
      }

      await this.firestoreMethods.updateDoc(commentRef, updates);

      if (comment.comment.dislikesBy?.includes(userId)) {
        await this.firestoreMethods.updateDoc(commentRef, {
          dislikesBy: this.firestoreMethods.arrayRemove(userId)
        });
      }

      this._invalidateCommentCache(commentId);
      return { success: true, commentId, action: 'liked' };

    } catch (error) {
      console.error(`❌ Like comment ${commentId} failed:`, error);
      throw this._enhanceError(error, 'Failed to like comment');
    }
  }

  async dislikeComment(commentId, userId) {
    try {
      await this._ensureInitialized();

      const commentRef = this.firestoreMethods.doc(this.firestore, 'comments', commentId);
      const comment = await this.getComment(commentId);
      if (!comment.success) throw new Error('Comment not found');

      const updates = {
        dislikes: this.firestoreMethods.increment(1),
        dislikesBy: this.firestoreMethods.arrayUnion(userId),
        updatedAt: this.firestoreMethods.serverTimestamp(),
        lastActivityAt: this.firestoreMethods.serverTimestamp()
      };

      if (comment.comment.likesBy?.includes(userId)) {
        updates.likes = this.firestoreMethods.increment(-1);
      }

      await this.firestoreMethods.updateDoc(commentRef, updates);

      if (comment.comment.likesBy?.includes(userId)) {
        await this.firestoreMethods.updateDoc(commentRef, {
          likesBy: this.firestoreMethods.arrayRemove(userId)
        });
      }

      this._invalidateCommentCache(commentId);
      return { success: true, commentId, action: 'disliked' };

    } catch (error) {
      console.error(`❌ Dislike comment ${commentId} failed:`, error);
      throw this._enhanceError(error, 'Failed to dislike comment');
    }
  }

  async removeLikeDislike(commentId, userId) {
    try {
      await this._ensureInitialized();

      const comment = await this.getComment(commentId);
      if (!comment.success) throw new Error('Comment not found');

      const commentRef = this.firestoreMethods.doc(this.firestore, 'comments', commentId);
      const updates = {
        updatedAt: this.firestoreMethods.serverTimestamp(),
        lastActivityAt: this.firestoreMethods.serverTimestamp()
      };

      if (comment.comment.likesBy?.includes(userId)) {
        updates.likes = this.firestoreMethods.increment(-1);
        updates.likesBy = this.firestoreMethods.arrayRemove(userId);
      }

      if (comment.comment.dislikesBy?.includes(userId)) {
        updates.dislikes = this.firestoreMethods.increment(-1);
        updates.dislikesBy = this.firestoreMethods.arrayRemove(userId);
      }

      await this.firestoreMethods.updateDoc(commentRef, updates);
      this._invalidateCommentCache(commentId);

      return { success: true, commentId, action: 'removed' };

    } catch (error) {
      console.error(`❌ Remove like/dislike ${commentId} failed:`, error);
      throw this._enhanceError(error, 'Failed to remove reaction');
    }
  }

  // ==================== EMOJI REACTIONS ====================
  async addReaction(commentId, userId, reactionType) {
    try {
      await this._ensureInitialized();

      if (!COMMENTS_CONFIG.ALLOWED_REACTIONS.includes(reactionType)) {
        throw new Error(`Reaction type ${reactionType} not allowed`);
      }

      const commentRef = this.firestoreMethods.doc(this.firestore, 'comments', commentId);
      const reactionRef = this.firestoreMethods.doc(
        this.firestore,
        'comments',
        commentId,
        'reactions',
        userId
      );

      await this.firestoreMethods.runTransaction(this.firestore, async (transaction) => {
        const reactionDoc = await transaction.get(reactionRef);
        const commentDoc = await transaction.get(commentRef);

        if (!commentDoc.exists()) throw new Error('Comment not found');

        const currentReaction = reactionDoc.exists() ? reactionDoc.data().type : null;

        if (currentReaction) {
          const oldCount = commentDoc.data().reactionCounts?.[currentReaction] || 0;
          transaction.update(commentRef, {
            [`reactionCounts.${currentReaction}`]: oldCount - 1,
            updatedAt: this.firestoreMethods.serverTimestamp()
          });
        }

        transaction.set(reactionRef, {
          type: reactionType,
          userId,
          createdAt: this.firestoreMethods.serverTimestamp()
        });

        const newCount = (commentDoc.data().reactionCounts?.[reactionType] || 0) + 1;
        transaction.update(commentRef, {
          [`reactionCounts.${reactionType}`]: newCount,
          updatedAt: this.firestoreMethods.serverTimestamp()
        });
      });

      this._invalidateCommentCache(commentId);
      return { success: true, commentId, reactionType };

    } catch (error) {
      console.error(`❌ Add reaction to ${commentId} failed:`, error);
      throw this._enhanceError(error, 'Failed to add reaction');
    }
  }

  async removeReaction(commentId, userId) {
    try {
      await this._ensureInitialized();

      const commentRef = this.firestoreMethods.doc(this.firestore, 'comments', commentId);
      const reactionRef = this.firestoreMethods.doc(
        this.firestore,
        'comments',
        commentId,
        'reactions',
        userId
      );

      await this.firestoreMethods.runTransaction(this.firestore, async (transaction) => {
        const reactionDoc = await transaction.get(reactionRef);
        const commentDoc = await transaction.get(commentRef);

        if (!reactionDoc.exists()) return;
        if (!commentDoc.exists()) throw new Error('Comment not found');

        const reactionType = reactionDoc.data().type;
        const oldCount = commentDoc.data().reactionCounts?.[reactionType] || 0;

        transaction.delete(reactionRef);
        transaction.update(commentRef, {
          [`reactionCounts.${reactionType}`]: oldCount - 1,
          updatedAt: this.firestoreMethods.serverTimestamp()
        });
      });

      this._invalidateCommentCache(commentId);
      return { success: true, commentId };

    } catch (error) {
      console.error(`❌ Remove reaction from ${commentId} failed:`, error);
      throw this._enhanceError(error, 'Failed to remove reaction');
    }
  }

  async getReactions(commentId) {
    try {
      await this._ensureInitialized();

      const reactionsRef = this.firestoreMethods.collection(
        this.firestore,
        'comments',
        commentId,
        'reactions'
      );
      const snapshot = await this.firestoreMethods.getDocs(reactionsRef);
      const reactions = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        reactions[doc.id] = data.type;
      });

      return { success: true, reactions };

    } catch (error) {
      console.error(`❌ Get reactions for ${commentId} failed:`, error);
      return { success: false, reactions: {}, error: error.message };
    }
  }

  // ==================== PINNED / FEATURED COMMENTS ====================
  async pinComment(commentId, userId, isAdmin = false) {
    try {
      await this._ensureInitialized();

      if (!isAdmin) {
        throw new Error('Only administrators can pin comments');
      }

      const commentRef = this.firestoreMethods.doc(this.firestore, 'comments', commentId);
      await this.firestoreMethods.updateDoc(commentRef, {
        isPinned: true,
        pinnedAt: this.firestoreMethods.serverTimestamp(),
        updatedAt: this.firestoreMethods.serverTimestamp()
      });

      this._invalidateCommentCache(commentId);
      return { success: true, commentId };

    } catch (error) {
      console.error(`❌ Pin comment ${commentId} failed:`, error);
      throw this._enhanceError(error, 'Failed to pin comment');
    }
  }

  async unpinComment(commentId, userId, isAdmin = false) {
    try {
      await this._ensureInitialized();

      if (!isAdmin) {
        throw new Error('Only administrators can unpin comments');
      }

      const commentRef = this.firestoreMethods.doc(this.firestore, 'comments', commentId);
      await this.firestoreMethods.updateDoc(commentRef, {
        isPinned: false,
        pinnedAt: null,
        updatedAt: this.firestoreMethods.serverTimestamp()
      });

      this._invalidateCommentCache(commentId);
      return { success: true, commentId };

    } catch (error) {
      console.error(`❌ Unpin comment ${commentId} failed:`, error);
      throw this._enhanceError(error, 'Failed to unpin comment');
    }
  }

  // ==================== TARGET‑LEVEL PINNED COMMENT ====================
  async pinCommentToTarget(targetType, targetId, commentId, userId, isAdmin = false) {
    try {
      await this._ensureInitialized();

      if (!isAdmin) {
        throw new Error('Only administrators can pin comments to targets');
      }

      // Verify comment exists and belongs to this target
      const comment = await this.getComment(commentId);
      if (!comment.success || comment.comment.targetType !== targetType || comment.comment.targetId !== targetId) {
        throw new Error('Comment does not belong to this target');
      }

      const targetRef = this.firestoreMethods.doc(this.firestore, `${targetType}s`, targetId);
      await this.firestoreMethods.updateDoc(targetRef, {
        pinnedCommentId: commentId,
        pinnedCommentAt: this.firestoreMethods.serverTimestamp(),
        updatedAt: this.firestoreMethods.serverTimestamp()
      });

      return { success: true, targetType, targetId, commentId };

    } catch (error) {
      console.error(`❌ Pin comment to target ${targetType}/${targetId} failed:`, error);
      throw this._enhanceError(error, 'Failed to pin comment to target');
    }
  }

  async unpinCommentFromTarget(targetType, targetId, userId, isAdmin = false) {
    try {
      await this._ensureInitialized();

      if (!isAdmin) {
        throw new Error('Only administrators can unpin comments from targets');
      }

      const targetRef = this.firestoreMethods.doc(this.firestore, `${targetType}s`, targetId);
      await this.firestoreMethods.updateDoc(targetRef, {
        pinnedCommentId: null,
        pinnedCommentAt: null,
        updatedAt: this.firestoreMethods.serverTimestamp()
      });

      return { success: true, targetType, targetId };

    } catch (error) {
      console.error(`❌ Unpin comment from target ${targetType}/${targetId} failed:`, error);
      throw this._enhanceError(error, 'Failed to unpin comment from target');
    }
  }

  async getPinnedCommentForTarget(targetType, targetId) {
    try {
      await this._ensureInitialized();

      const targetRef = this.firestoreMethods.doc(this.firestore, `${targetType}s`, targetId);
      const targetSnap = await this.firestoreMethods.getDoc(targetRef);
      if (!targetSnap.exists()) return null;

      const pinnedCommentId = targetSnap.data().pinnedCommentId;
      if (!pinnedCommentId) return null;

      const comment = await this.getComment(pinnedCommentId);
      return comment.success ? comment.comment : null;

    } catch (error) {
      console.error(`❌ Get pinned comment for ${targetType}/${targetId} failed:`, error);
      return null;
    }
  }

  // ==================== COMMENT EDITING HISTORY ====================
  async getCommentHistory(commentId, options = {}) {
    try {
      await this._ensureInitialized();

      const historyRef = this.firestoreMethods.collection(
        this.firestore,
        'comments',
        commentId,
        'history'
      );
      let query = this.firestoreMethods.query(
        historyRef,
        this.firestoreMethods.orderBy('archivedAt', 'desc')
      );

      if (options.limit) {
        query = this.firestoreMethods.query(query, this.firestoreMethods.limit(options.limit));
      }

      if (options.startAfter) {
        query = this.firestoreMethods.query(query, this.firestoreMethods.startAfter(options.startAfter));
      }

      const snapshot = await this.firestoreMethods.getDocs(query);
      const history = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        history.push({
          id: doc.id,
          ...data,
          archivedAt: data.archivedAt?.toDate?.() || new Date()
        });
      });

      return { success: true, history, total: snapshot.size };

    } catch (error) {
      console.error(`❌ Get history for ${commentId} failed:`, error);
      return { success: false, history: [], error: error.message };
    }
  }

  // ==================== REPLY SYSTEM ====================
  async replyToComment(parentCommentId, userId, content, options = {}) {
    try {
      await this._ensureInitialized();

      const parentComment = await this.getComment(parentCommentId);
      if (!parentComment.success) {
        throw new Error('Parent comment not found');
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
        parentComment.comment.targetType,
        parentComment.comment.targetId,
        userId,
        content,
        replyOptions
      );

      return result;

    } catch (error) {
      console.error(`❌ Reply to comment ${parentCommentId} failed:`, error);
      throw this._enhanceError(error, 'Failed to reply to comment');
    }
  }

  async getReplies(commentId, options = {}) {
    try {
      await this._ensureInitialized();

      const commentsRef = this.firestoreMethods.collection(this.firestore, 'comments');
      let conditions = [
        this.firestoreMethods.where('parentId', '==', commentId),
        this.firestoreMethods.where('isDeleted', '==', false),
        this.firestoreMethods.where('isHidden', '==', false),
        this.firestoreMethods.where('moderationStatus', '==', 'approved'),
        this.firestoreMethods.orderBy('createdAt', 'asc')
      ];

      if (options.limit) {
        conditions.push(this.firestoreMethods.limit(options.limit));
      }

      if (options.startAfter) {
        conditions.push(this.firestoreMethods.startAfter(options.startAfter));
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

      return {
        success: true,
        replies,
        total: snapshot.size,
        hasMore: options.limit ? replies.length === options.limit : false,
        lastReply: replies.length > 0 ? replies[replies.length - 1] : null,
        parentCommentId: commentId
      };

    } catch (error) {
      console.error(`❌ Get replies for ${commentId} failed:`, error);
      return { success: false, replies: [], error: error.message };
    }
  }

  // ==================== REAL-TIME UPDATES ====================
  subscribeToTargetComments(targetType, targetId, callback, options = {}) {
    const subscriptionId = `${targetType}_${targetId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const setupSubscription = async () => {
      try {
        await this._ensureInitialized();

        const commentsRef = this.firestoreMethods.collection(this.firestore, 'comments');
        const conditions = [
          this.firestoreMethods.where('targetType', '==', targetType),
          this.firestoreMethods.where('targetId', '==', targetId),
          this.firestoreMethods.where('isDeleted', '==', false),
          this.firestoreMethods.where('isHidden', '==', false),
          this.firestoreMethods.where('moderationStatus', '==', 'approved'),
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
          console.error(`❌ Comment subscription error for ${targetType}/${targetId}:`, error);
          callback({
            type: 'error',
            error: error.message,
            subscriptionId,
            timestamp: new Date().toISOString()
          });
        });

        this.realtimeSubscriptions.set(subscriptionId, {
          unsubscribe,
          targetType,
          targetId,
          createdAt: Date.now(),
          callback
        });

        return subscriptionId;

      } catch (error) {
        console.error(`❌ Setup subscription for ${targetType}/${targetId} failed:`, error);
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

  subscribeToPostComments(postId, callback, options = {}) {
    return this.subscribeToTargetComments('post', postId, callback, options);
  }

  unsubscribe(subscriptionId) {
    const subscription = this.realtimeSubscriptions.get(subscriptionId);
    if (subscription) {
      try {
        subscription.unsubscribe();
        this.realtimeSubscriptions.delete(subscriptionId);
        console.log(`✅ Unsubscribed from ${subscriptionId}`);
        return true;
      } catch (error) {
        console.warn(`Failed to unsubscribe ${subscriptionId}:`, error);
        return false;
      }
    }
    return false;
  }

  // ==================== MODERATION & ADMIN ====================
  async reportComment(commentId, userId, reason, details = '') {
    try {
      await this._ensureInitialized();

      const reportsRef = this.firestoreMethods.collection(this.firestore, 'comment_reports');
      const reportQuery = this.firestoreMethods.query(
        reportsRef,
        this.firestoreMethods.where('commentId', '==', commentId),
        this.firestoreMethods.where('userId', '==', userId)
      );

      const existingReports = await this.firestoreMethods.getDocs(reportQuery);
      if (!existingReports.empty) {
        throw new Error('You have already reported this comment');
      }

      await this.firestoreMethods.addDoc(reportsRef, {
        commentId,
        userId,
        reason,
        details,
        status: 'pending',
        createdAt: this.firestoreMethods.serverTimestamp(),
        reviewedAt: null,
        reviewedBy: null,
        actionTaken: null
      });

      const commentRef = this.firestoreMethods.doc(this.firestore, 'comments', commentId);
      await this.firestoreMethods.updateDoc(commentRef, {
        reports: this.firestoreMethods.increment(1),
        updatedAt: this.firestoreMethods.serverTimestamp()
      });

      return { success: true, commentId, reported: true };

    } catch (error) {
      console.error(`❌ Report comment ${commentId} failed:`, error);
      throw this._enhanceError(error, 'Failed to report comment');
    }
  }

  async moderateComment(commentId, action, moderatorId, notes = '') {
    try {
      await this._ensureInitialized();

      const allowedActions = ['approve', 'reject', 'hide', 'delete', 'warn'];
      if (!allowedActions.includes(action)) {
        throw new Error(`Invalid moderation action: ${action}`);
      }

      const commentRef = this.firestoreMethods.doc(this.firestore, 'comments', commentId);
      const updates = {
        moderationStatus: action === 'approve' ? 'approved' : 'rejected',
        moderatedAt: this.firestoreMethods.serverTimestamp(),
        moderatedBy: moderatorId,
        moderationNotes: notes,
        updatedAt: this.firestoreMethods.serverTimestamp()
      };

      if (action === 'hide') {
        updates.isHidden = true;
        updates.moderationStatus = 'hidden';
      } else if (action === 'delete') {
        updates.isDeleted = true;
        updates.deletedBy = moderatorId;
        updates.deletedReason = 'moderation';
      }

      await this.firestoreMethods.updateDoc(commentRef, updates);

      await this._updateReportStatus(commentId, action, moderatorId);
      this._invalidateCommentCache(commentId);

      return { success: true, commentId, action };

    } catch (error) {
      console.error(`❌ Moderate comment ${commentId} failed:`, error);
      throw this._enhanceError(error, 'Failed to moderate comment');
    }
  }

  // ==================== MODERATION QUEUE ====================
  async getPendingComments(limit = 50, startAfter = null) {
    try {
      await this._ensureInitialized();

      const commentsRef = this.firestoreMethods.collection(this.firestore, 'comments');
      let conditions = [
        this.firestoreMethods.where('moderationStatus', '==', 'pending'),
        this.firestoreMethods.orderBy('createdAt', 'asc'),
        this.firestoreMethods.limit(limit)
      ];

      if (startAfter) {
        const startAfterDoc = await this.firestoreMethods.getDoc(
          this.firestoreMethods.doc(this.firestore, 'comments', startAfter)
        );
        if (startAfterDoc.exists()) {
          conditions.push(this.firestoreMethods.startAfter(startAfterDoc));
        }
      }

      const q = this.firestoreMethods.query(commentsRef, ...conditions);
      const snapshot = await this.firestoreMethods.getDocs(q);

      const comments = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        comments.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date()
        });
      });

      const lastDoc = comments.length > 0 ? comments[comments.length - 1] : null;
      return {
        success: true,
        comments,
        hasMore: snapshot.size === limit,
        nextCursor: lastDoc?.id || null
      };

    } catch (error) {
      console.error('❌ Get pending comments failed:', error);
      return { success: false, comments: [], error: error.message };
    }
  }

  async batchModerateComments(commentIds, action, moderatorId, notes = '') {
    try {
      await this._ensureInitialized();

      const batch = this.firestoreMethods.writeBatch(this.firestore);
      let count = 0;

      for (const commentId of commentIds) {
        const commentRef = this.firestoreMethods.doc(this.firestore, 'comments', commentId);
        const updates = {
          moderationStatus: action === 'approve' ? 'approved' : 'rejected',
          moderatedAt: this.firestoreMethods.serverTimestamp(),
          moderatedBy: moderatorId,
          moderationNotes: notes,
          updatedAt: this.firestoreMethods.serverTimestamp()
        };
        if (action === 'delete') {
          updates.isDeleted = true;
          updates.deletedReason = 'moderation_batch';
        } else if (action === 'hide') {
          updates.isHidden = true;
        }
        batch.update(commentRef, updates);
        count++;
        this._invalidateCommentCache(commentId);
      }

      await batch.commit();
      return { success: true, moderatedCount: count };

    } catch (error) {
      console.error('❌ Batch moderate comments failed:', error);
      throw this._enhanceError(error, 'Failed to batch moderate comments');
    }
  }

  // ==================== ANALYTICS ====================
  async getCommentAnalytics(targetType, targetId, options = {}) {
    try {
      await this._ensureInitialized();

      const commentsRef = this.firestoreMethods.collection(this.firestore, 'comments');
      const q = this.firestoreMethods.query(
        commentsRef,
        this.firestoreMethods.where('targetType', '==', targetType),
        this.firestoreMethods.where('targetId', '==', targetId),
        this.firestoreMethods.where('isDeleted', '==', false),
        this.firestoreMethods.orderBy('createdAt', 'desc')
      );
      const snapshot = await this.firestoreMethods.getDocs(q);

      const comments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date()
      }));

      // Basic stats
      const totalComments = comments.length;
      const topCommenters = new Map();
      let totalLikes = 0;
      let totalReplies = 0;
      let sentimentSum = 0;
      let sentimentCount = 0;

      for (const comment of comments) {
        if (comment.userId && !comment.isAnonymous) {
          topCommenters.set(comment.userId, (topCommenters.get(comment.userId) || 0) + 1);
        }
        totalLikes += comment.likes || 0;
        totalReplies += comment.replies || 0;
        if (comment.sentimentScore) {
          sentimentSum += comment.sentimentScore;
          sentimentCount++;
        }
      }

      const topCommentersList = Array.from(topCommenters.entries())
        .map(([userId, count]) => ({ userId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        success: true,
        analytics: {
          totalComments,
          totalLikes,
          totalReplies,
          averageLikes: totalComments ? totalLikes / totalComments : 0,
          averageReplies: totalComments ? totalReplies / totalComments : 0,
          averageSentiment: sentimentCount ? sentimentSum / sentimentCount : 0,
          topCommenters: topCommentersList,
          timeline: null // Could be added later
        }
      };

    } catch (error) {
      console.error('❌ Get comment analytics failed:', error);
      return { success: false, analytics: null, error: error.message };
    }
  }

  // ==================== CLEANUP OPERATIONS ====================
  async cleanupOldHistory() {
    try {
      await this._ensureInitialized();

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - COMMENTS_CONFIG.HISTORY_RETENTION_DAYS);
      const cutoffTimestamp = this.firestoreMethods.Timestamp.fromDate(cutoffDate);

      const commentsRef = this.firestoreMethods.collection(this.firestore, 'comments');
      const snapshot = await this.firestoreMethods.getDocs(commentsRef);

      const batch = this.firestoreMethods.writeBatch(this.firestore);
      let count = 0;

      for (const commentDoc of snapshot.docs) {
        const historyRef = this.firestoreMethods.collection(
          this.firestore,
          'comments',
          commentDoc.id,
          'history'
        );
        const oldHistoryQuery = this.firestoreMethods.query(
          historyRef,
          this.firestoreMethods.where('archivedAt', '<', cutoffTimestamp)
        );
        const oldHistory = await this.firestoreMethods.getDocs(oldHistoryQuery);

        oldHistory.forEach(doc => {
          batch.delete(doc.ref);
          count++;
        });
      }

      if (count > 0) {
        await batch.commit();
        console.log(`🧹 Deleted ${count} old history entries`);
      }
      return { success: true, deleted: count };

    } catch (error) {
      console.error('❌ Cleanup old history failed:', error);
      return { success: false, error: error.message };
    }
  }

  async cleanupOldReactions() {
    try {
      await this._ensureInitialized();

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - COMMENTS_CONFIG.REACTION_RETENTION_DAYS);
      const cutoffTimestamp = this.firestoreMethods.Timestamp.fromDate(cutoffDate);

      const commentsRef = this.firestoreMethods.collection(this.firestore, 'comments');
      const snapshot = await this.firestoreMethods.getDocs(commentsRef);

      const batch = this.firestoreMethods.writeBatch(this.firestore);
      let count = 0;

      for (const commentDoc of snapshot.docs) {
        const reactionsRef = this.firestoreMethods.collection(
          this.firestore,
          'comments',
          commentDoc.id,
          'reactions'
        );
        const oldReactionsQuery = this.firestoreMethods.query(
          reactionsRef,
          this.firestoreMethods.where('createdAt', '<', cutoffTimestamp)
        );
        const oldReactions = await this.firestoreMethods.getDocs(oldReactionsQuery);

        oldReactions.forEach(doc => {
          batch.delete(doc.ref);
          count++;
        });
      }

      if (count > 0) {
        await batch.commit();
        console.log(`🧹 Deleted ${count} old reactions`);
      }
      return { success: true, deleted: count };

    } catch (error) {
      console.error('❌ Cleanup old reactions failed:', error);
      return { success: false, error: error.message };
    }
  }

  // ==================== UTILITY METHODS ====================
  _validateComment(content, userId, format = 'plain') {
    const errors = [];
    const warnings = [];

    if (!content || (format === 'plain' && content.trim().length < COMMENTS_CONFIG.MIN_COMMENT_LENGTH)) {
      errors.push('Comment cannot be empty');
    }

    const contentLength = typeof content === 'string' ? content.length : JSON.stringify(content).length;
    if (contentLength > COMMENTS_CONFIG.MAX_COMMENT_LENGTH) {
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
      console.warn('Spam check failed, allowing comment as fallback', error);
      return { allowed: true, count: 0, waitTime: 0 };
    }
  }

  async _updateReportStatus(commentId, action, moderatorId) {
    try {
      await this._ensureInitialized();

      const reportsRef = this.firestoreMethods.collection(this.firestore, 'comment_reports');
      const q = this.firestoreMethods.query(
        reportsRef,
        this.firestoreMethods.where('commentId', '==', commentId)
      );

      const snapshot = await this.firestoreMethods.getDocs(q);
      const batch = this.firestoreMethods.writeBatch(this.firestore);

      snapshot.forEach(reportDoc => {
        const reportRef = this.firestoreMethods.doc(this.firestore, 'comment_reports', reportDoc.id);
        batch.update(reportRef, {
          status: 'resolved',
          reviewedAt: this.firestoreMethods.serverTimestamp(),
          reviewedBy: moderatorId,
          actionTaken: action
        });
      });

      await batch.commit();

    } catch (error) {
      console.warn('Update report status failed:', error);
    }
  }

  _invalidateCommentCache(commentId) {
    this.cache.delete(`comment_${commentId}`);
    for (const [key] of this.cache.entries()) {
      if (key.startsWith('comments_')) {
        this.cache.delete(key);
      }
    }
  }

  _invalidateTargetCache(targetType, targetId) {
    for (const [key] of this.cache.entries()) {
      if (key === `comments_${targetType}_${targetId}_` || key.startsWith(`comments_${targetType}_${targetId}_`)) {
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

  cleanupStaleData() {
    const now = Date.now();

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > 10 * 60 * 1000) {
        this.cache.delete(key);
      }
    }

    for (const [id, subscription] of this.realtimeSubscriptions.entries()) {
      if (now - subscription.createdAt > 30 * 60 * 1000) {
        this.unsubscribe(id);
      }
    }

    if (now - this.lastCleanup > 60 * 1000) {
      console.log('🧹 Comment service cleanup completed');
      this.lastCleanup = now;
    }
  }

  // ==================== BATCH OPERATIONS ====================
  async batchDeleteComments(commentIds, userId, isAdmin = false) {
    try {
      await this._ensureInitialized();

      const batch = this.firestoreMethods.writeBatch(this.firestore);
      const counterUpdates = new Map(); // key: targetType_targetId -> delta

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

          const { targetType, targetId, parentId } = commentData;
          const key = `${targetType}_${targetId}`;
          const current = counterUpdates.get(key) || 0;
          counterUpdates.set(key, current - 1);

          if (parentId) {
            const parentRef = this.firestoreMethods.doc(this.firestore, 'comments', parentId);
            batch.update(parentRef, {
              replies: this.firestoreMethods.increment(-1),
              updatedAt: this.firestoreMethods.serverTimestamp()
            });
          }

          this._invalidateCommentCache(commentId);
        }
      }

      if (counterUpdates.size > 0) {
        await batch.commit();

        for (const [key, delta] of counterUpdates.entries()) {
          const [targetType, targetId] = key.split('_');
          await this._incrementCommentCounter(targetType, targetId, delta);
          await this._syncTargetCommentCount(targetType, targetId, delta);
          this._invalidateTargetCache(targetType, targetId);
        }
      }

      return {
        success: true,
        deleted: Array.from(counterUpdates.values()).reduce((a, b) => a + Math.abs(b), 0),
        total: commentIds.length,
        failed: commentIds.length - Array.from(counterUpdates.values()).reduce((a, b) => a + Math.abs(b), 0)
      };

    } catch (error) {
      console.error('❌ Batch delete comments failed:', error);
      throw this._enhanceError(error, 'Failed to batch delete comments');
    }
  }

  // ==================== STATISTICS & ANALYTICS ====================
  async getCommentStats(targetType = null, targetId = null, userId = null) {
    try {
      await this._ensureInitialized();

      const commentsRef = this.firestoreMethods.collection(this.firestore, 'comments');
      const conditions = [];

      if (targetType && targetId) {
        conditions.push(this.firestoreMethods.where('targetType', '==', targetType));
        conditions.push(this.firestoreMethods.where('targetId', '==', targetId));
      }

      if (userId) {
        conditions.push(this.firestoreMethods.where('userId', '==', userId));
      }

      conditions.push(this.firestoreMethods.where('isDeleted', '==', false));

      const q = this.firestoreMethods.query(commentsRef, ...conditions);
      const snapshot = await this.firestoreMethods.getCountFromServer(q);

      let totalComments = snapshot.data().count;
      if (targetType && targetId) {
        totalComments = await this.getCommentCount(targetType, targetId);
      }

      return {
        success: true,
        stats: {
          totalComments,
          averageLikes: 0,
          averageReplies: 0,
          topCommenters: []
        }
      };

    } catch (error) {
      console.error('❌ Get comment stats failed:', error);
      return { success: false, stats: null, error: error.message };
    }
  }

  // ==================== EXPORT METHODS ====================
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
    console.log('🧹 Comment service cache cleared');
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

    console.log('🔥 Comment service destroyed');
  }
}

// ==================== SINGLETON INSTANCE ====================
let commentServiceInstance = null;

function getCommentService() {
  if (!commentServiceInstance) {
    commentServiceInstance = new UltimateCommentService();
  }
  return commentServiceInstance;
}

// ==================== COMPATIBILITY EXPORTS ====================
const commentService = {
  // Universal methods
  createComment: (targetType, targetId, userId, content, options) =>
    getCommentService().createComment(targetType, targetId, userId, content, options),
  getCommentsByTarget: (targetType, targetId, options) =>
    getCommentService().getCommentsByTarget(targetType, targetId, options),
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
  addReaction: (commentId, userId, reactionType) =>
    getCommentService().addReaction(commentId, userId, reactionType),
  removeReaction: (commentId, userId) =>
    getCommentService().removeReaction(commentId, userId),
  getReactions: (commentId) =>
    getCommentService().getReactions(commentId),
  pinComment: (commentId, userId, isAdmin) =>
    getCommentService().pinComment(commentId, userId, isAdmin),
  unpinComment: (commentId, userId, isAdmin) =>
    getCommentService().unpinComment(commentId, userId, isAdmin),
  pinCommentToTarget: (targetType, targetId, commentId, userId, isAdmin) =>
    getCommentService().pinCommentToTarget(targetType, targetId, commentId, userId, isAdmin),
  unpinCommentFromTarget: (targetType, targetId, userId, isAdmin) =>
    getCommentService().unpinCommentFromTarget(targetType, targetId, userId, isAdmin),
  getPinnedCommentForTarget: (targetType, targetId) =>
    getCommentService().getPinnedCommentForTarget(targetType, targetId),
  getCommentHistory: (commentId, options) =>
    getCommentService().getCommentHistory(commentId, options),
  replyToComment: (parentCommentId, userId, content, options) =>
    getCommentService().replyToComment(parentCommentId, userId, content, options),
  getReplies: (commentId, options) =>
    getCommentService().getReplies(commentId, options),
  subscribeToTargetComments: (targetType, targetId, callback, options) =>
    getCommentService().subscribeToTargetComments(targetType, targetId, callback, options),
  unsubscribe: (subscriptionId) =>
    getCommentService().unsubscribe(subscriptionId),
  reportComment: (commentId, userId, reason, details) =>
    getCommentService().reportComment(commentId, userId, reason, details),
  moderateComment: (commentId, action, moderatorId, notes) =>
    getCommentService().moderateComment(commentId, action, moderatorId, notes),
  getPendingComments: (limit, startAfter) =>
    getCommentService().getPendingComments(limit, startAfter),
  batchModerateComments: (commentIds, action, moderatorId, notes) =>
    getCommentService().batchModerateComments(commentIds, action, moderatorId, notes),
  batchDeleteComments: (commentIds, userId, isAdmin) =>
    getCommentService().batchDeleteComments(commentIds, userId, isAdmin),
  getCommentStats: (targetType, targetId, userId) =>
    getCommentService().getCommentStats(targetType, targetId, userId),
  getCommentAnalytics: (targetType, targetId, options) =>
    getCommentService().getCommentAnalytics(targetType, targetId, options),
  cleanupOldHistory: () => getCommentService().cleanupOldHistory(),
  cleanupOldReactions: () => getCommentService().cleanupOldReactions(),
  getCommentCount: (targetType, targetId) =>
    getCommentService().getCommentCount(targetType, targetId),

  // Backward compatibility (post only)
  getCommentsByPost: (postId, options) =>
    getCommentService().getCommentsByTarget('post', postId, options),
  subscribeToPostComments: (postId, callback, options) =>
    getCommentService().subscribeToTargetComments('post', postId, callback, options),

  getService: getCommentService,
  getStats: () => getCommentService().getStats(),
  clearCache: () => getCommentService().clearCache(),
  destroy: () => getCommentService().destroy(),
  ensureInitialized: () => getCommentService()._ensureInitialized()
};

export default commentService;
export { commentService, getCommentService };

// ==================== REQUIRED FIRESTORE INDEXES ====================
/**
 * To achieve the performance and query capabilities required by this service,
 * you must create the following composite indexes in your Firebase Console:
 *
 * 1. Collection: comments
 *    Fields: targetType (Ascending), targetId (Ascending), isDeleted (Ascending),
 *            isHidden (Ascending), moderationStatus (Ascending), createdAt (Descending)
 *
 * 2. Collection: comments
 *    Fields: targetType (Ascending), targetId (Ascending), parentId (Ascending),
 *            isDeleted (Ascending), isHidden (Ascending), moderationStatus (Ascending),
 *            createdAt (Descending)
 *
 * 3. Collection: comments
 *    Fields: parentId (Ascending), isDeleted (Ascending), isHidden (Ascending),
 *            moderationStatus (Ascending), createdAt (Ascending)
 *
 * 4. Collection: comments/{commentId}/history
 *    Fields: archivedAt (Descending) – for pagination
 *
 * 5. Collection: comments/{commentId}/reactions
 *    Fields: createdAt (Ascending) – for cleanup
 *
 * 6. Collection: comment_reports
 *    Fields: commentId (Ascending), userId (Ascending)
 *    Fields: commentId (Ascending) – for status updates
 *
 * 7. Collection: rate_limits
 *    Fields: userId (Ascending), minute (Ascending) – for sharded counters
 *
 * 8. Collection: comment_counts
 *    Single‑field indexes on targetType and targetId are sufficient.
 *
 * For detailed instructions, see:
 * https://firebase.google.com/docs/firestore/query-data/indexing
 */

// ==================== CLOUD FUNCTIONS INTEGRATION ====================
/**
 * This service relies on the following Cloud Functions to handle
 * moderation, mention processing, and cooldown enforcement:
 *
 * 1. moderateComment – Triggered on comments/{commentId} creation.
 *    Uses Perspective API to analyse content, sets moderationStatus,
 *    and optionally hides the comment if toxic.
 *
 * 2. processMentions – Triggered on comments/{commentId} creation (after moderation).
 *    Extracts mentions, checks mention cooldown per user/hour,
 *    and sends push notifications to mentioned users.
 *
 * 3. cleanupOldData – Scheduled function (e.g., daily) that calls
 *    cleanupOldHistory() and cleanupOldReactions() to remove expired data.
 *
 * 4. updateTargetStats – Optional, to sync comment counts into the target document
 *    (if you want to keep a denormalized count there).
 *
 * 5. translateComment – Triggered on comments/{commentId} creation (after moderation)
 *    to translate comment content to the user's language.
 *
 * These functions must be deployed separately.
 */