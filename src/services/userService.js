// src/services/userService.js - ENTERPRISE PRODUCTION V8 - FIXED AVATAR GENERATION
// ✅ PERFECT AVATAR SYSTEM • UNIQUE USERNAME • COMPLETE SOCIAL FEATURES • PRODUCTION READY
// 🔥 FIXED DEFAULT AVATAR • REAL-TIME GENERATION • ALL SOCIAL PLATFORM COMPATIBLE

const USER_CONFIG = {
  MAX_USERNAME_ATTEMPTS: 10,
  DEFAULT_USERNAME_LENGTH: 20,
  CACHE_EXPIRY: 5 * 60 * 1000,
  DEFAULT_COINS: 100,
  DEFAULT_LEVEL: 1,
  CREATOR_THRESHOLD: 5,
  AVATAR_COLORS: [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
  ],
  AVATAR_PATTERNS: [
    'diagonal', 'circles', 'triangles', 'waves', 'grid',
    'dots', 'stripes', 'chevron', 'zigzag', 'hexagon'
  ]
};

class UltimateUserService {
  constructor() {
    this.firestore = null;
    this.initialized = false;
    this.cache = new Map();
    this.usernameCache = new Map();
    this.notificationCache = new Map();
    this.followCache = new Map();
    this.avatarCache = new Map(); // Cache generated avatars
    console.log('👤 Ultimate User Service V8 - Perfect Avatar System');
  }

  // ==================== INITIALIZATION ====================
  async initialize() {
    if (this.initialized) return this.firestore;
    
    try {
      console.log('🔄 Initializing Firestore for user service...');
      const firebase = await import('../firebase/firebase.js');
      this.firestore = await firebase.getFirestoreInstance();
      
      const { enableIndexedDbPersistence } = await import('firebase/firestore');
      try {
        await enableIndexedDbPersistence(this.firestore);
        console.log('✅ Firestore persistence enabled');
      } catch (persistenceError) {
        console.warn('⚠️ Firestore persistence failed:', persistenceError.message);
      }
      
      this.initialized = true;
      console.log('✅ User service initialized successfully');
      return this.firestore;
      
    } catch (error) {
      console.error('❌ User service initialization failed:', error);
      throw new Error(`Firestore init failed: ${error.message}`);
    }
  }

  async _ensureInitialized() {
    if (!this.initialized || !this.firestore) {
      await this.initialize();
    }
    return this.firestore;
  }

  // ==================== ENHANCED AVATAR GENERATION (FIXED) ====================
  generateDefaultAvatar(userId, displayName = 'User') {
    try {
      // Generate consistent hash from userId
      let hash = 0;
      for (let i = 0; i < userId.length; i++) {
        hash = ((hash << 5) - hash) + userId.charCodeAt(i);
        hash = hash & hash;
      }
      hash = Math.abs(hash);
      
      // Get first letter (handle Unicode)
      const firstLetter = displayName 
        ? Array.from(displayName)[0].toUpperCase() 
        : 'U';
      
      // Consistent color selection based on userId hash
      const colorIndex = hash % USER_CONFIG.AVATAR_COLORS.length;
      const backgroundColor = USER_CONFIG.AVATAR_COLORS[colorIndex];
      
      // Generate contrasting text color
      const rgb = this.hexToRgb(backgroundColor);
      const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
      const textColor = luminance > 0.5 ? '#000000' : '#FFFFFF';
      
      // Get pattern based on hash
      const patternIndex = (hash >> 4) % USER_CONFIG.AVATAR_PATTERNS.length;
      const pattern = USER_CONFIG.AVATAR_PATTERNS[patternIndex];
      
      // Create enhanced SVG with gradient and pattern
      const svg = this._createAvatarSVG(firstLetter, backgroundColor, textColor, pattern);
      
      // Optimize SVG string
      const optimizedSVG = svg.replace(/\s+/g, ' ').trim();
      
      // Convert to base64
      const base64SVG = btoa(unescape(encodeURIComponent(optimizedSVG)));
      
      return `data:image/svg+xml;base64,${base64SVG}`;
      
    } catch (error) {
      console.warn('Avatar generation failed, using fallback:', error);
      return 'https://via.placeholder.com/200/667eea/ffffff?text=U';
    }
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  _createAvatarSVG(firstLetter, bgColor, textColor, pattern) {
    const size = 200;
    const fontSize = 80;
    const letterY = size / 2 + fontSize / 3;
    
    let patternElements = '';
    
    switch (pattern) {
      case 'diagonal':
        patternElements = `<line x1="0" y1="0" x2="${size}" y2="${size}" stroke="${this.adjustColor(bgColor, -30)}" stroke-width="2" opacity="0.3"/>
                           <line x1="${size}" y1="0" x2="0" y2="${size}" stroke="${this.adjustColor(bgColor, -30)}" stroke-width="2" opacity="0.3"/>`;
        break;
      case 'circles':
        patternElements = `<circle cx="${size/3}" cy="${size/3}" r="${size/10}" fill="${this.adjustColor(bgColor, 20)}" opacity="0.3"/>
                           <circle cx="${2*size/3}" cy="${2*size/3}" r="${size/8}" fill="${this.adjustColor(bgColor, 20)}" opacity="0.3"/>`;
        break;
      case 'dots':
        patternElements = `<circle cx="${size/4}" cy="${size/4}" r="8" fill="${this.adjustColor(bgColor, 20)}" opacity="0.4"/>
                           <circle cx="${3*size/4}" cy="${size/4}" r="8" fill="${this.adjustColor(bgColor, 20)}" opacity="0.4"/>
                           <circle cx="${size/4}" cy="${3*size/4}" r="8" fill="${this.adjustColor(bgColor, 20)}" opacity="0.4"/>
                           <circle cx="${3*size/4}" cy="${3*size/4}" r="8" fill="${this.adjustColor(bgColor, 20)}" opacity="0.4"/>`;
        break;
      default:
        // No pattern
        patternElements = '';
    }
    
    return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
      <!-- Background with subtle gradient -->
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${bgColor}" />
          <stop offset="100%" stop-color="${this.adjustColor(bgColor, -20)}" />
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.3"/>
        </filter>
      </defs>
      
      <!-- Main circle -->
      <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="url(#gradient)" stroke="${this.adjustColor(bgColor, -40)}" stroke-width="2" filter="url(#shadow)"/>
      
      <!-- Pattern overlay -->
      ${patternElements}
      
      <!-- Letter -->
      <text x="${size/2}" y="${letterY}" font-family="Arial, Helvetica, sans-serif" 
            font-size="${fontSize}" font-weight="bold" fill="${textColor}" 
            text-anchor="middle" dominant-baseline="middle" 
            style="user-select: none; pointer-events: none;">
        ${firstLetter}
      </text>
    </svg>`;
  }

  adjustColor(hex, amount) {
    const rgb = this.hexToRgb(hex);
    const adjust = (value) => Math.max(0, Math.min(255, value + amount));
    
    return `#${[adjust(rgb.r), adjust(rgb.g), adjust(rgb.b)]
      .map(x => Math.round(x).toString(16).padStart(2, '0'))
      .join('')}`;
  }

  getAvatarUrl(userId, displayName, existingPhotoURL = null) {
    // Return existing photo URL if it's not a default placeholder
    if (existingPhotoURL && 
        !existingPhotoURL.includes('default-profile') &&
        !existingPhotoURL.includes('via.placeholder.com') &&
        !existingPhotoURL.includes('data:image/svg+xml')) {
      return existingPhotoURL;
    }
    
    // Check cache first
    const cacheKey = `avatar_${userId}`;
    if (this.avatarCache.has(cacheKey)) {
      return this.avatarCache.get(cacheKey);
    }
    
    // Generate new avatar
    const avatarUrl = this.generateDefaultAvatar(userId, displayName);
    
    // Cache for performance
    this.avatarCache.set(cacheKey, avatarUrl);
    
    return avatarUrl;
  }

  // ==================== USER PROFILE MANAGEMENT (UPDATED) ====================
  async getUserProfile(userId) {
    try {
      await this._ensureInitialized();
      
      // Cache check
      const cached = this.cache.get(userId);
      if (cached && (Date.now() - cached.timestamp) < USER_CONFIG.CACHE_EXPIRY) {
        // Ensure cached profile has proper avatar
        if (!cached.data.photoURL || 
            cached.data.photoURL.includes('default-profile') ||
            cached.data.photoURL.includes('via.placeholder.com')) {
          cached.data.photoURL = this.getAvatarUrl(
            userId, 
            cached.data.displayName || cached.data.username,
            cached.data.photoURL
          );
        }
        return cached.data;
      }
      
      const { doc, getDoc } = await import('firebase/firestore');
      
      const userDoc = doc(this.firestore, 'users', userId);
      const docSnap = await getDoc(userDoc);
      
      if (docSnap.exists()) {
        const profile = { id: docSnap.id, ...docSnap.data() };
        
        // CRITICAL: Ensure profile has proper avatar
        profile.photoURL = this.getAvatarUrl(
          userId, 
          profile.displayName || profile.username || 'User',
          profile.photoURL
        );
        
        // Cache the profile with proper avatar
        this.cache.set(userId, { data: profile, timestamp: Date.now() });
        return profile;
      }
      
      return null;
      
    } catch (error) {
      console.error(`Get user profile failed for ${userId}:`, error);
      throw error;
    }
  }

  async createUserProfile(userId, profileData) {
    try {
      await this._ensureInitialized();
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      
      // Generate unique username
      let username = profileData.username;
      if (!username) {
        const baseName = profileData.displayName?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
        username = await this._generateUniqueUsername(baseName, userId);
      }
      
      // Check username availability
      const usernameCheck = await this.checkUsernameAvailability(username, userId);
      if (!usernameCheck.available) {
        throw new Error(`Username "${username}" is already taken`);
      }
      
      // Generate perfect avatar
      const defaultAvatar = this.generateDefaultAvatar(userId, profileData.displayName || username);
      
      // Complete profile object
      const profile = {
        uid: userId,
        username: username.toLowerCase(),
        email: profileData.email || '',
        displayName: profileData.displayName || '',
        firstName: profileData.firstName || '',
        lastName: profileData.lastName || '',
        phoneNumber: profileData.phoneNumber || '',
        photoURL: profileData.photoURL || defaultAvatar,
        bio: profileData.bio || '',
        website: profileData.website || '',
        location: profileData.location || '',
        gender: profileData.gender || '',
        birthDate: profileData.birthDate || '',
        
        // Social stats
        followerCount: 0,
        followingCount: 0,
        postCount: 0,
        videoCount: 0,
        savedCount: 0,
        commentCount: 0,
        likeCount: 0,
        shareCount: 0,
        
        // Monetization
        coins: USER_CONFIG.DEFAULT_COINS,
        totalEarned: 0,
        totalWithdrawn: 0,
        pendingWithdrawal: 0,
        walletAddress: profileData.walletAddress || '',
        
        // Level system
        level: USER_CONFIG.DEFAULT_LEVEL,
        experience: 0,
        experienceToNextLevel: 100,
        isCreator: false,
        creatorCategory: profileData.creatorCategory || '',
        
        // Account status
        authProvider: profileData.authProvider || 'email',
        isProfileComplete: false,
        accountStatus: 'active',
        isVerified: false,
        isPrivate: false,
        isOnline: true,
        lastActive: serverTimestamp(),
        
        // Preferences
        preferences: {
          theme: 'system',
          language: 'en',
          notificationEmail: true,
          notificationPush: true,
          notificationSMS: false,
          privacyProfile: 'public',
          privacyMessages: 'everyone',
          contentFilter: 'standard'
        },
        
        // Social links
        socialLinks: {
          twitter: profileData.twitter || '',
          instagram: profileData.instagram || '',
          youtube: profileData.youtube || '',
          tiktok: profileData.tiktok || '',
          facebook: profileData.facebook || '',
          linkedin: profileData.linkedin || '',
          website: profileData.website || ''
        },
        
        // Analytics
        analytics: {
          totalViews: 0,
          engagementRate: 0,
          topPosts: [],
          peakHours: [],
          audienceDemographics: {}
        },
        
        // Metadata
        metadata: {
          hasCustomAvatar: !!profileData.photoURL,
          avatarGeneratedAt: serverTimestamp(),
          avatarVersion: 'v2'
        },
        
        // Timestamps
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        profileCompletedAt: null,
        emailVerified: profileData.emailVerified || false,
        phoneVerified: profileData.phoneVerified || false
      };
      
      const userDoc = doc(this.firestore, 'users', userId);
      await setDoc(userDoc, profile);
      
      // Create user settings document
      const settingsDoc = doc(this.firestore, 'user_settings', userId);
      await setDoc(settingsDoc, {
        userId,
        notifications: {
          likes: true,
          comments: true,
          follows: true,
          mentions: true,
          gifts: true,
          messages: true,
          announcements: true
        },
        privacy: {
          showOnline: true,
          showLastSeen: true,
          allowMessages: 'everyone',
          allowComments: 'everyone',
          allowTags: true,
          showActivity: true
        },
        security: {
          twoFactor: false,
          loginAlerts: true,
          deviceLogging: true,
          sessionTimeout: 30
        },
        appearance: {
          theme: 'system',
          fontSize: 'medium',
          reduceMotion: false,
          highContrast: false
        },
        content: {
          autoplay: true,
          videoQuality: 'auto',
          dataSaver: false,
          downloadQuality: 'high'
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Cache avatar and profile
      this.avatarCache.set(`avatar_${userId}`, profile.photoURL);
      this.cache.set(userId, { data: profile, timestamp: Date.now() });
      
      console.log(`✅ User profile created: ${userId} (${username}) with ${profileData.photoURL ? 'custom' : 'default'} avatar`);
      return { success: true, profile, username };
      
    } catch (error) {
      console.error('Create user profile failed:', error);
      throw error;
    }
  }

  async updateUserProfile(userId, updates) {
    try {
      await this._ensureInitialized();
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      
      // Username change validation
      if (updates.username) {
        const { available, error } = await this.checkUsernameAvailability(updates.username, userId);
        if (!available) {
          throw new Error(error || 'Username unavailable');
        }
        updates.username = updates.username.toLowerCase();
      }
      
      // Handle avatar changes
      if (updates.photoURL) {
        updates.metadata = {
          hasCustomAvatar: true,
          avatarUpdatedAt: serverTimestamp()
        };
        
        // Clear avatar cache
        this.avatarCache.delete(`avatar_${userId}`);
      }
      
      // If display name changes and user has default avatar, update avatar too
      if (updates.displayName && !updates.photoURL) {
        const currentProfile = await this.getUserProfile(userId);
        if (currentProfile?.metadata?.hasCustomAvatar === false) {
          const newAvatar = this.generateDefaultAvatar(userId, updates.displayName);
          updates.photoURL = newAvatar;
          updates.metadata = {
            hasCustomAvatar: false,
            avatarGeneratedAt: serverTimestamp()
          };
          this.avatarCache.set(`avatar_${userId}`, newAvatar);
        }
      }
      
      const userDoc = doc(this.firestore, 'users', userId);
      await updateDoc(userDoc, {
        ...updates,
        updatedAt: serverTimestamp(),
        lastActive: serverTimestamp()
      });
      
      // Clear cache
      this.cache.delete(userId);
      
      return { success: true };
      
    } catch (error) {
      console.error('Update user profile failed:', error);
      throw error;
    }
  }

  // ==================== USERNAME MANAGEMENT ====================
  async checkUsernameAvailability(username, excludeUserId = null) {
    try {
      if (!username || username.length < 3) {
        return { available: false, error: 'Username must be at least 3 characters' };
      }
      
      const normalized = username.toLowerCase().trim();
      
      // Validation
      if (normalized.length > USER_CONFIG.DEFAULT_USERNAME_LENGTH) {
        return { available: false, error: 'Username too long' };
      }
      
      if (!/^[a-z0-9._]+$/.test(normalized)) {
        return { available: false, error: 'Invalid characters' };
      }
      
      // Cache check
      const cacheKey = `username_${normalized}_${excludeUserId}`;
      const cached = this.usernameCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < USER_CONFIG.CACHE_EXPIRY) {
        return cached.result;
      }
      
      await this._ensureInitialized();
      
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      
      const usersRef = collection(this.firestore, 'users');
      const q = query(usersRef, where('username', '==', normalized));
      const snapshot = await getDocs(q);
      
      let exists = false;
      let existingUser = null;
      
      snapshot.forEach(doc => {
        const userData = doc.data();
        if (excludeUserId && doc.id === excludeUserId) return;
        if (userData.username === normalized) {
          exists = true;
          existingUser = { id: doc.id, ...userData };
        }
      });
      
      const result = {
        available: !exists,
        exists,
        username: normalized,
        count: snapshot.size,
        existingUser
      };
      
      this.usernameCache.set(cacheKey, { result, timestamp: Date.now() });
      
      return result;
      
    } catch (error) {
      console.error('Username check failed:', error);
      return { available: false, error: 'Check failed', exists: false };
    }
  }

  async _generateUniqueUsername(baseName, excludeUserId = null) {
    try {
      let username = baseName.toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, USER_CONFIG.DEFAULT_USERNAME_LENGTH);
      
      if (username.length < 3) {
        username = 'user' + Date.now().toString(36).slice(-6);
      }
      
      // Try base name
      const check = await this.checkUsernameAvailability(username, excludeUserId);
      if (check.available) return username;
      
      // Try variations
      for (let i = 1; i <= USER_CONFIG.MAX_USERNAME_ATTEMPTS; i++) {
        const suffix = Math.random().toString(36).substring(2, 6);
        const candidate = `${username}${suffix}`;
        
        const candidateCheck = await this.checkUsernameAvailability(candidate, excludeUserId);
        if (candidateCheck.available) return candidate;
      }
      
      // Fallback
      return `${username}${Date.now().toString(36).slice(-6)}`;
      
    } catch (error) {
      console.error('Generate username failed:', error);
      return 'user' + Date.now().toString(36).slice(-8);
    }
  }

  // ==================== COIN & ECONOMY SYSTEM ====================
  async getCoinBalance(userId) {
    try {
      const profile = await this.getUserProfile(userId);
      return profile?.coins || 0;
    } catch (error) {
      console.error('Get coin balance failed:', error);
      return 0;
    }
  }

  async addCoins(userId, amount, reason = 'reward', metadata = {}) {
    try {
      await this._ensureInitialized();
      const { doc, updateDoc, increment, serverTimestamp } = await import('firebase/firestore');
      
      const userDoc = doc(this.firestore, 'users', userId);
      
      await updateDoc(userDoc, {
        coins: increment(amount),
        totalEarned: increment(amount),
        updatedAt: serverTimestamp()
      });
      
      // Log transaction
      await this._logTransaction(userId, amount, 'credit', reason, metadata);
      
      // Check for level up
      await this._checkLevelUp(userId);
      
      this.cache.delete(userId);
      
      return { success: true };
      
    } catch (error) {
      console.error('Add coins failed:', error);
      throw error;
    }
  }

  async deductCoins(userId, amount, reason = 'purchase', metadata = {}) {
    try {
      const balance = await this.getCoinBalance(userId);
      if (balance < amount) {
        throw new Error('Insufficient coins');
      }
      
      await this._ensureInitialized();
      const { doc, updateDoc, increment, serverTimestamp } = await import('firebase/firestore');
      
      const userDoc = doc(this.firestore, 'users', userId);
      
      await updateDoc(userDoc, {
        coins: increment(-amount),
        updatedAt: serverTimestamp()
      });
      
      // Log transaction
      await this._logTransaction(userId, amount, 'debit', reason, metadata);
      
      this.cache.delete(userId);
      
      return { success: true };
      
    } catch (error) {
      console.error('Deduct coins failed:', error);
      throw error;
    }
  }

  async transferCoins(senderId, receiverId, amount, reason = 'transfer') {
    try {
      // Deduct from sender
      await this.deductCoins(senderId, amount, `transfer_to_${receiverId}`);
      
      // Add to receiver
      await this.addCoins(receiverId, amount, `transfer_from_${senderId}`);
      
      // Log transfer
      await this._logTransfer(senderId, receiverId, amount, reason);
      
      return { success: true };
      
    } catch (error) {
      console.error('Transfer coins failed:', error);
      throw error;
    }
  }

  // ==================== LEVEL & EXPERIENCE SYSTEM ====================
  async addExperience(userId, amount, source = 'activity') {
    try {
      await this._ensureInitialized();
      const { doc, updateDoc, increment, serverTimestamp } = await import('firebase/firestore');
      
      const userDoc = doc(this.firestore, 'users', userId);
      
      await updateDoc(userDoc, {
        experience: increment(amount),
        updatedAt: serverTimestamp()
      });
      
      // Check for level up
      await this._checkLevelUp(userId);
      
      return { success: true };
      
    } catch (error) {
      console.error('Add experience failed:', error);
      throw error;
    }
  }

  async _checkLevelUp(userId) {
    try {
      const profile = await this.getUserProfile(userId);
      if (!profile) return;
      
      const { level, experience, experienceToNextLevel } = profile;
      
      if (experience >= experienceToNextLevel) {
        const newLevel = level + 1;
        const newExpRequired = Math.round(experienceToNextLevel * 1.5);
        
        await this._ensureInitialized();
        const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
        
        const userDoc = doc(this.firestore, 'users', userId);
        
        await updateDoc(userDoc, {
          level: newLevel,
          experience: 0,
          experienceToNextLevel: newExpRequired,
          isCreator: newLevel >= USER_CONFIG.CREATOR_THRESHOLD,
          updatedAt: serverTimestamp()
        });
        
        // Level up rewards
        const coinReward = newLevel * 100;
        await this.addCoins(userId, coinReward, 'level_up', { newLevel });
        
        // Notification
        await this.createNotification(userId, {
          type: 'level_up',
          title: '🎉 Level Up!',
          message: `Congratulations! You've reached Level ${newLevel}`,
          data: { newLevel, coinReward }
        });
        
        return { leveledUp: true, newLevel, reward: coinReward };
      }
      
      return { leveledUp: false };
      
    } catch (error) {
      console.error('Level check failed:', error);
      throw error;
    }
  }

  // ==================== CREATOR & WITHDRAWAL SYSTEM ====================
  async requestWithdrawal(userId, amount, method = 'bank_transfer', details = {}) {
    try {
      const profile = await this.getUserProfile(userId);
      
      // Validation
      if (!profile.isCreator) {
        throw new Error('Only creators (level 5+) can withdraw');
      }
      
      if (profile.coins < amount) {
        throw new Error('Insufficient coins');
      }
      
      const minWithdrawal = 1000;
      if (amount < minWithdrawal) {
        throw new Error(`Minimum withdrawal: ${minWithdrawal} coins`);
      }
      
      await this._ensureInitialized();
      const { collection, addDoc, serverTimestamp, doc, updateDoc, increment } = await import('firebase/firestore');
      
      // Create withdrawal request
      const withdrawalsRef = collection(this.firestore, 'withdrawals');
      const withdrawal = await addDoc(withdrawalsRef, {
        userId,
        username: profile.username,
        amount,
        method,
        details,
        status: 'pending',
        fee: Math.round(amount * 0.05), // 5% fee
        netAmount: Math.round(amount * 0.95),
        conversionRate: 100, // 100 coins = $1
        usdAmount: (amount / 100).toFixed(2),
        createdAt: serverTimestamp(),
        processedAt: null,
        completedAt: null
      });
      
      // Deduct coins
      const userDoc = doc(this.firestore, 'users', userId);
      await updateDoc(userDoc, {
        coins: increment(-amount),
        pendingWithdrawal: increment(amount),
        updatedAt: serverTimestamp()
      });
      
      // Notify admin
      await this.createNotification('admin', {
        type: 'withdrawal_request',
        title: '💰 New Withdrawal Request',
        message: `${profile.username} requested $${(amount/100).toFixed(2)} withdrawal`,
        data: { userId, amount, withdrawalId: withdrawal.id }
      });
      
      return {
        success: true,
        withdrawalId: withdrawal.id,
        amount,
        fee: Math.round(amount * 0.05),
        netAmount: Math.round(amount * 0.95),
        usdAmount: (amount / 100).toFixed(2),
        status: 'pending'
      };
      
    } catch (error) {
      console.error('Withdrawal request failed:', error);
      throw error;
    }
  }

  // ==================== SOCIAL FEATURES ====================
  async followUser(followerId, followingId) {
    try {
      await this._ensureInitialized();
      const { collection, addDoc, serverTimestamp, doc, updateDoc, increment, getDoc } = await import('firebase/firestore');
      
      // Check if already following
      const followsRef = collection(this.firestore, 'follows');
      const followCheck = await this.getFollowStatus(followerId, followingId);
      if (followCheck.isFollowing) {
        throw new Error('Already following this user');
      }
      
      // Create follow relationship
      await addDoc(followsRef, {
        followerId,
        followingId,
        createdAt: serverTimestamp(),
        notifications: true
      });
      
      // Update follower counts
      const followingUserDoc = doc(this.firestore, 'users', followingId);
      await updateDoc(followingUserDoc, {
        followerCount: increment(1),
        updatedAt: serverTimestamp()
      });
      
      const followerUserDoc = doc(this.firestore, 'users', followerId);
      await updateDoc(followerUserDoc, {
        followingCount: increment(1),
        updatedAt: serverTimestamp()
      });
      
      // Clear caches
      this.cache.delete(followerId);
      this.cache.delete(followingId);
      this.followCache.delete(`${followerId}_${followingId}`);
      
      // Award experience
      await this.addExperience(followerId, 10, 'follow_user');
      await this.addExperience(followingId, 5, 'gained_follower');
      
      // Create notification
      await this.createNotification(followingId, {
        type: 'new_follower',
        title: '👤 New Follower',
        message: `Started following you`,
        data: { followerId }
      });
      
      return { success: true, message: 'Followed successfully' };
      
    } catch (error) {
      console.error('Follow user failed:', error);
      throw error;
    }
  }

  async unfollowUser(followerId, followingId) {
    try {
      await this._ensureInitialized();
      const { collection, query, where, getDocs, doc, updateDoc, increment, deleteDoc } = await import('firebase/firestore');
      
      // Find follow relationship
      const followsRef = collection(this.firestore, 'follows');
      const q = query(followsRef, 
        where('followerId', '==', followerId),
        where('followingId', '==', followingId)
      );
      
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        snapshot.forEach(async (followDoc) => {
          await deleteDoc(followDoc.ref);
        });
      }
      
      // Update counts
      const followingUserDoc = doc(this.firestore, 'users', followingId);
      await updateDoc(followingUserDoc, {
        followerCount: increment(-1),
        updatedAt: serverTimestamp()
      });
      
      const followerUserDoc = doc(this.firestore, 'users', followerId);
      await updateDoc(followerUserDoc, {
        followingCount: increment(-1),
        updatedAt: serverTimestamp()
      });
      
      // Clear caches
      this.cache.delete(followerId);
      this.cache.delete(followingId);
      this.followCache.delete(`${followerId}_${followingId}`);
      
      return { success: true, message: 'Unfollowed successfully' };
      
    } catch (error) {
      console.error('Unfollow user failed:', error);
      throw error;
    }
  }

  async getFollowStatus(followerId, followingId) {
    try {
      const cacheKey = `follow_${followerId}_${followingId}`;
      const cached = this.followCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < 60000) {
        return cached.data;
      }
      
      await this._ensureInitialized();
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      
      const followsRef = collection(this.firestore, 'follows');
      const q = query(followsRef, 
        where('followerId', '==', followerId),
        where('followingId', '==', followingId)
      );
      
      const snapshot = await getDocs(q);
      const isFollowing = !snapshot.empty;
      
      const result = { isFollowing, followCount: snapshot.size };
      
      this.followCache.set(cacheKey, { data: result, timestamp: Date.now() });
      
      return result;
      
    } catch (error) {
      console.error('Get follow status failed:', error);
      return { isFollowing: false, error: error.message };
    }
  }

  async getFollowers(userId, limit = 50) {
    try {
      await this._ensureInitialized();
      const { collection, query, where, orderBy, limit: firestoreLimit, getDocs } = await import('firebase/firestore');
      
      const followsRef = collection(this.firestore, 'follows');
      const q = query(
        followsRef,
        where('followingId', '==', userId),
        orderBy('createdAt', 'desc'),
        firestoreLimit(limit)
      );
      
      const snapshot = await getDocs(q);
      const followers = [];
      
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const userProfile = await this.getUserProfile(data.followerId);
        if (userProfile) {
          followers.push({
            ...data,
            id: doc.id,
            user: userProfile
          });
        }
      }
      
      return { success: true, followers };
      
    } catch (error) {
      console.error('Get followers failed:', error);
      return { success: false, followers: [] };
    }
  }

  async getFollowing(userId, limit = 50) {
    try {
      await this._ensureInitialized();
      const { collection, query, where, orderBy, limit: firestoreLimit, getDocs } = await import('firebase/firestore');
      
      const followsRef = collection(this.firestore, 'follows');
      const q = query(
        followsRef,
        where('followerId', '==', userId),
        orderBy('createdAt', 'desc'),
        firestoreLimit(limit)
      );
      
      const snapshot = await getDocs(q);
      const following = [];
      
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const userProfile = await this.getUserProfile(data.followingId);
        if (userProfile) {
          following.push({
            ...data,
            id: doc.id,
            user: userProfile
          });
        }
      }
      
      return { success: true, following };
      
    } catch (error) {
      console.error('Get following failed:', error);
      return { success: false, following: [] };
    }
  }

  // ==================== NOTIFICATION SYSTEM ====================
  async createNotification(userId, notification) {
    try {
      await this._ensureInitialized();
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      
      const notificationsRef = collection(this.firestore, 'notifications');
      
      const notificationDoc = {
        userId,
        type: notification.type || 'info',
        title: notification.title || '',
        message: notification.message || '',
        data: notification.data || {},
        isRead: false,
        priority: notification.priority || 'normal',
        expiresAt: notification.expiresAt || null,
        createdAt: serverTimestamp(),
        deliveredAt: null,
        readAt: null
      };
      
      const docRef = await addDoc(notificationsRef, notificationDoc);
      
      // Invalidate notification cache
      this.notificationCache.delete(userId);
      
      return { success: true, notificationId: docRef.id };
      
    } catch (error) {
      console.error('Create notification failed:', error);
      return { success: false, error: error.message };
    }
  }

  async getUserNotifications(userId, options = {}) {
    try {
      const cacheKey = `notifications_${userId}_${JSON.stringify(options)}`;
      const cached = this.notificationCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < 30000) {
        return cached.data;
      }
      
      await this._ensureInitialized();
      const { collection, query, where, orderBy, limit: firestoreLimit, getDocs } = await import('firebase/firestore');
      
      const notificationsRef = collection(this.firestore, 'notifications');
      
      const conditions = [
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      ];
      
      if (options.unreadOnly) {
        conditions.push(where('isRead', '==', false));
      }
      
      if (options.limit) {
        conditions.push(firestoreLimit(options.limit));
      }
      
      const q = query(notificationsRef, ...conditions);
      const snapshot = await getDocs(q);
      
      const notifications = [];
      snapshot.forEach(doc => {
        notifications.push({ id: doc.id, ...doc.data() });
      });
      
      const result = { success: true, notifications, total: snapshot.size };
      
      this.notificationCache.set(cacheKey, { data: result, timestamp: Date.now() });
      
      return result;
      
    } catch (error) {
      console.error('Get notifications failed:', error);
      return { success: false, notifications: [] };
    }
  }

  async markNotificationAsRead(notificationId, userId) {
    try {
      await this._ensureInitialized();
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      
      const notificationDoc = doc(this.firestore, 'notifications', notificationId);
      
      await updateDoc(notificationDoc, {
        isRead: true,
        readAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Invalidate cache
      this.notificationCache.delete(userId);
      
      return { success: true };
      
    } catch (error) {
      console.error('Mark notification as read failed:', error);
      throw error;
    }
  }

  async markAllNotificationsAsRead(userId) {
    try {
      const notifications = await this.getUserNotifications(userId);
      
      if (notifications.success && notifications.notifications.length > 0) {
        const batchPromises = notifications.notifications
          .filter(n => !n.isRead)
          .map(n => this.markNotificationAsRead(n.id, userId));
        
        await Promise.all(batchPromises);
      }
      
      this.notificationCache.delete(userId);
      
      return { success: true, marked: notifications.notifications.filter(n => !n.isRead).length };
      
    } catch (error) {
      console.error('Mark all notifications as read failed:', error);
      throw error;
    }
  }

  // ==================== USER SEARCH & DISCOVERY ====================
  async searchUsers(query, options = {}) {
    try {
      await this._ensureInitialized();
      const { collection, query: firestoreQuery, where, orderBy, limit, getDocs } = await import('firebase/firestore');
      
      const usersRef = collection(this.firestore, 'users');
      const searchTerm = query.toLowerCase();
      
      // For production, you'd use Algolia or similar for full-text search
      // This is a basic implementation
      const q = firestoreQuery(
        usersRef,
        where('username', '>=', searchTerm),
        where('username', '<=', searchTerm + '\uf8ff'),
        orderBy('username'),
        limit(options.limit || 20)
      );
      
      const snapshot = await getDocs(q);
      const users = [];
      
      snapshot.forEach(doc => {
        const userData = doc.data();
        // Ensure proper avatar
        if (!userData.photoURL || userData.photoURL.includes('default-profile')) {
          userData.photoURL = this.getAvatarUrl(doc.id, userData.displayName || userData.username, userData.photoURL);
        }
        users.push({ id: doc.id, ...userData });
      });
      
      // Also search display names
      const displayNameQuery = firestoreQuery(
        usersRef,
        where('displayName', '>=', searchTerm),
        where('displayName', '<=', searchTerm + '\uf8ff'),
        orderBy('displayName'),
        limit(options.limit || 20)
      );
      
      const displayNameSnapshot = await getDocs(displayNameQuery);
      
      displayNameSnapshot.forEach(doc => {
        const userData = doc.data();
        // Avoid duplicates
        if (!users.find(u => u.id === doc.id)) {
          // Ensure proper avatar
          if (!userData.photoURL || userData.photoURL.includes('default-profile')) {
            userData.photoURL = this.getAvatarUrl(doc.id, userData.displayName || userData.username, userData.photoURL);
          }
          users.push({ id: doc.id, ...userData });
        }
      });
      
      // Sort by relevance
      users.sort((a, b) => {
        const aScore = this._calculateRelevanceScore(a, searchTerm);
        const bScore = this._calculateRelevanceScore(b, searchTerm);
        return bScore - aScore;
      });
      
      return { success: true, users: users.slice(0, options.limit || 20) };
      
    } catch (error) {
      console.error('Search users failed:', error);
      return { success: false, users: [] };
    }
  }

  _calculateRelevanceScore(user, searchTerm) {
    let score = 0;
    
    if (user.username?.toLowerCase().startsWith(searchTerm)) {
      score += 10;
    }
    
    if (user.username?.toLowerCase().includes(searchTerm)) {
      score += 5;
    }
    
    if (user.displayName?.toLowerCase().includes(searchTerm)) {
      score += 3;
    }
    
    if (user.bio?.toLowerCase().includes(searchTerm)) {
      score += 1;
    }
    
    // Boost active users
    if (user.isOnline) {
      score += 2;
    }
    
    // Boost verified users
    if (user.isVerified) {
      score += 3;
    }
    
    return score;
  }

  async getSuggestedUsers(userId, limit = 10) {
    try {
      // Get users with similar interests or popular users
      await this._ensureInitialized();
      const { collection, query, orderBy, limit: firestoreLimit, getDocs } = await import('firebase/firestore');
      
      const usersRef = collection(this.firestore, 'users');
      const q = query(
        usersRef,
        orderBy('followerCount', 'desc'),
        firestoreLimit(limit * 3) // Get more than needed to filter
      );
      
      const snapshot = await getDocs(q);
      const suggestions = [];
      
      // Get current user's following
      const following = await this.getFollowing(userId);
      const followingIds = following.following?.map(f => f.followingId) || [];
      
      snapshot.forEach(doc => {
        const userData = doc.data();
        
        // Don't suggest self or already following
        if (doc.id !== userId && !followingIds.includes(doc.id)) {
          // Ensure proper avatar
          if (!userData.photoURL || userData.photoURL.includes('default-profile')) {
            userData.photoURL = this.getAvatarUrl(doc.id, userData.displayName || userData.username, userData.photoURL);
          }
          suggestions.push({ id: doc.id, ...userData });
        }
      });
      
      // Return limited results
      return { success: true, suggestions: suggestions.slice(0, limit) };
      
    } catch (error) {
      console.error('Get suggested users failed:', error);
      return { success: false, suggestions: [] };
    }
  }

  // ==================== USER ACTIVITY & ANALYTICS ====================
  async updateLastActive(userId) {
    try {
      await this._ensureInitialized();
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      
      const userDoc = doc(this.firestore, 'users', userId);
      
      await updateDoc(userDoc, {
        isOnline: true,
        lastActive: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Log activity
      await this._logActivity(userId, 'active');
      
    } catch (error) {
      console.warn('Update last active failed:', error);
    }
  }

  async markProfileComplete(userId) {
    try {
      await this._ensureInitialized();
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      
      const userDoc = doc(this.firestore, 'users', userId);
      
      await updateDoc(userDoc, {
        isProfileComplete: true,
        profileCompletedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Reward for completing profile
      await this.addCoins(userId, 100, 'profile_completion');
      await this.addExperience(userId, 50, 'profile_completion');
      
      this.cache.delete(userId);
      
      return { success: true };
      
    } catch (error) {
      console.error('Mark profile complete failed:', error);
      throw error;
    }
  }

  // ==================== ACCOUNT MANAGEMENT ====================
  async deleteUserAccount(userId, reason = 'user_request') {
    try {
      await this._ensureInitialized();
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      
      const userDoc = doc(this.firestore, 'users', userId);
      
      // Soft delete
      await updateDoc(userDoc, {
        accountStatus: 'deleted',
        deletedAt: serverTimestamp(),
        deleteReason: reason,
        isActive: false,
        updatedAt: serverTimestamp()
      });
      
      // Create deletion request (for admin processing)
      const { collection, addDoc } = await import('firebase/firestore');
      const deletionsRef = collection(this.firestore, 'account_deletions');
      
      await addDoc(deletionsRef, {
        userId,
        username: (await this.getUserProfile(userId))?.username || 'unknown',
        reason,
        requestedAt: serverTimestamp(),
        status: 'pending',
        scheduledDeletion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      });
      
      // Clear all caches
      this.cache.delete(userId);
      this.avatarCache.delete(`avatar_${userId}`);
      
      return { success: true, message: 'Account deletion scheduled' };
      
    } catch (error) {
      console.error('Delete account failed:', error);
      throw error;
    }
  }

  async deactivateUser(userId, reason = 'violation', durationDays = null) {
    try {
      await this._ensureInitialized();
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      
      const userDoc = doc(this.firestore, 'users', userId);
      
      const updateData = {
        accountStatus: 'suspended',
        suspensionReason: reason,
        suspendedAt: serverTimestamp(),
        isActive: false,
        updatedAt: serverTimestamp()
      };
      
      if (durationDays) {
        const suspensionEnd = new Date();
        suspensionEnd.setDate(suspensionEnd.getDate() + durationDays);
        updateData.suspensionEnd = suspensionEnd.toISOString();
      }
      
      await updateDoc(userDoc, updateData);
      
      this.cache.delete(userId);
      
      return { success: true };
      
    } catch (error) {
      console.error('Deactivate user failed:', error);
      throw error;
    }
  }

  // ==================== UTILITY METHODS ====================
  async _logTransaction(userId, amount, type, reason, metadata = {}) {
    try {
      await this._ensureInitialized();
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      
      const transactionsRef = collection(this.firestore, 'coin_transactions');
      
      await addDoc(transactionsRef, {
        userId,
        amount,
        type,
        reason,
        metadata,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      
    } catch (error) {
      console.warn('Log transaction failed:', error);
    }
  }

  async _logTransfer(senderId, receiverId, amount, reason) {
    try {
      await this._ensureInitialized();
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      
      const transfersRef = collection(this.firestore, 'coin_transfers');
      
      await addDoc(transfersRef, {
        senderId,
        receiverId,
        amount,
        reason,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      
    } catch (error) {
      console.warn('Log transfer failed:', error);
    }
  }

  async _logActivity(userId, activityType, metadata = {}) {
    try {
      await this._ensureInitialized();
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      
      const activitiesRef = collection(this.firestore, 'user_activities');
      
      await addDoc(activitiesRef, {
        userId,
        activityType,
        metadata,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      
    } catch (error) {
      console.warn('Log activity failed:', error);
    }
  }

  // ==================== CACHE MANAGEMENT ====================
  clearCache(userId = null) {
    if (userId) {
      this.cache.delete(userId);
      this.notificationCache.delete(userId);
      this.avatarCache.delete(`avatar_${userId}`);
      
      // Clear follow caches involving this user
      for (const key of this.followCache.keys()) {
        if (key.includes(userId)) {
          this.followCache.delete(key);
        }
      }
      
      // Clear username caches
      for (const key of this.usernameCache.keys()) {
        if (key.includes(`_${userId}`) || key.includes(`${userId}_`)) {
          this.usernameCache.delete(key);
        }
      }
    } else {
      this.cache.clear();
      this.usernameCache.clear();
      this.notificationCache.clear();
      this.followCache.clear();
      this.avatarCache.clear();
    }
    
    console.log('✅ User service cache cleared');
  }

  getCacheStats() {
    return {
      userCache: this.cache.size,
      usernameCache: this.usernameCache.size,
      notificationCache: this.notificationCache.size,
      followCache: this.followCache.size,
      avatarCache: this.avatarCache.size,
      memoryUsage: process.memoryUsage?.() || 'N/A'
    };
  }

  // ==================== BULK OPERATIONS ====================
  async batchUpdateUserStats(userIds, updates) {
    try {
      await this._ensureInitialized();
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const { writeBatch } = await import('firebase/firestore');
      
      const batch = writeBatch(this.firestore);
      let operationCount = 0;
      
      for (const userId of userIds) {
        if (operationCount >= 500) break; // Firestore batch limit
        
        const userDoc = doc(this.firestore, 'users', userId);
        batch.update(userDoc, {
          ...updates,
          updatedAt: serverTimestamp()
        });
        
        operationCount++;
        this.cache.delete(userId);
      }
      
      await batch.commit();
      
      return { success: true, updated: operationCount };
      
    } catch (error) {
      console.error('Batch update failed:', error);
      throw error;
    }
  }

  // ==================== AVATAR UTILITIES ====================
  async updateUserAvatar(userId, photoURL) {
    try {
      await this.updateUserProfile(userId, { photoURL });
      
      // Clear avatar cache
      this.avatarCache.delete(`avatar_${userId}`);
      
      return { success: true };
    } catch (error) {
      console.error('Update user avatar failed:', error);
      throw error;
    }
  }

  async resetToDefaultAvatar(userId) {
    try {
      const profile = await this.getUserProfile(userId);
      const defaultAvatar = this.generateDefaultAvatar(userId, profile.displayName || profile.username);
      
      await this.updateUserProfile(userId, { 
        photoURL: defaultAvatar,
        metadata: {
          hasCustomAvatar: false,
          avatarResetAt: new Date().toISOString()
        }
      });
      
      // Update cache
      this.avatarCache.set(`avatar_${userId}`, defaultAvatar);
      
      return { success: true, avatar: defaultAvatar };
    } catch (error) {
      console.error('Reset to default avatar failed:', error);
      throw error;
    }
  }
}

// ==================== SINGLETON INSTANCE ====================
let userServiceInstance = null;

export function getUserService() {
  if (!userServiceInstance) {
    userServiceInstance = new UltimateUserService();
  }
  return userServiceInstance;
}

// ==================== NAMED EXPORTS FOR ALL METHODS ====================
// Profile Management
export async function getUserProfile(userId) {
  const service = getUserService();
  return await service.getUserProfile(userId);
}

export async function createUserProfile(userId, profileData) {
  const service = getUserService();
  return await service.createUserProfile(userId, profileData);
}

export async function updateUserProfile(userId, updates) {
  const service = getUserService();
  return await service.updateUserProfile(userId, updates);
}

// Avatar Management
export function generateDefaultAvatar(userId, displayName) {
  const service = getUserService();
  return service.generateDefaultAvatar(userId, displayName);
}

export async function updateUserAvatar(userId, photoURL) {
  const service = getUserService();
  return await service.updateUserAvatar(userId, photoURL);
}

export async function resetToDefaultAvatar(userId) {
  const service = getUserService();
  return await service.resetToDefaultAvatar(userId);
}

// Username Management
export async function checkUsernameAvailability(username, excludeUserId = null) {
  const service = getUserService();
  return await service.checkUsernameAvailability(username, excludeUserId);
}

export async function generateUniqueUsername(baseName, excludeUserId = null) {
  const service = getUserService();
  return await service._generateUniqueUsername(baseName, excludeUserId);
}

// Coin & Economy
export async function getCoinBalance(userId) {
  const service = getUserService();
  return await service.getCoinBalance(userId);
}

export async function addCoins(userId, amount, reason = 'reward', metadata = {}) {
  const service = getUserService();
  return await service.addCoins(userId, amount, reason, metadata);
}

export async function deductCoins(userId, amount, reason = 'purchase', metadata = {}) {
  const service = getUserService();
  return await service.deductCoins(userId, amount, reason, metadata);
}

export async function transferCoins(senderId, receiverId, amount, reason = 'transfer') {
  const service = getUserService();
  return await service.transferCoins(senderId, receiverId, amount, reason);
}

// Level & Experience
export async function addExperience(userId, amount, source = 'activity') {
  const service = getUserService();
  return await service.addExperience(userId, amount, source);
}

export async function getUserLevel(userId) {
  const service = getUserService();
  const profile = await service.getUserProfile(userId);
  return profile?.level || 1;
}

// Withdrawals
export async function requestWithdrawal(userId, amount, method = 'bank_transfer', details = {}) {
  const service = getUserService();
  return await service.requestWithdrawal(userId, amount, method, details);
}

// Social Features
export async function followUser(followerId, followingId) {
  const service = getUserService();
  return await service.followUser(followerId, followingId);
}

export async function unfollowUser(followerId, followingId) {
  const service = getUserService();
  return await service.unfollowUser(followerId, followingId);
}

export async function getFollowStatus(followerId, followingId) {
  const service = getUserService();
  return await service.getFollowStatus(followerId, followingId);
}

export async function getFollowers(userId, limit = 50) {
  const service = getUserService();
  return await service.getFollowers(userId, limit);
}

export async function getFollowing(userId, limit = 50) {
  const service = getUserService();
  return await service.getFollowing(userId, limit);
}

// Notifications
export async function createNotification(userId, notification) {
  const service = getUserService();
  return await service.createNotification(userId, notification);
}

export async function getUserNotifications(userId, options = {}) {
  const service = getUserService();
  return await service.getUserNotifications(userId, options);
}

export async function markNotificationAsRead(notificationId, userId) {
  const service = getUserService();
  return await service.markNotificationAsRead(notificationId, userId);
}

export async function markAllNotificationsAsRead(userId) {
  const service = getUserService();
  return await service.markAllNotificationsAsRead(userId);
}

// Search & Discovery
export async function searchUsers(query, options = {}) {
  const service = getUserService();
  return await service.searchUsers(query, options);
}

export async function getSuggestedUsers(userId, limit = 10) {
  const service = getUserService();
  return await service.getSuggestedUsers(userId, limit);
}

// Account Management
export async function deleteUserAccount(userId, reason = 'user_request') {
  const service = getUserService();
  return await service.deleteUserAccount(userId, reason);
}

export async function deactivateUser(userId, reason = 'violation', durationDays = null) {
  const service = getUserService();
  return await service.deactivateUser(userId, reason, durationDays);
}

// Activity
export async function updateLastActive(userId) {
  const service = getUserService();
  return await service.updateLastActive(userId);
}

export async function markProfileComplete(userId) {
  const service = getUserService();
  return await service.markProfileComplete(userId);
}

// Utility
export function clearUserCache(userId = null) {
  const service = getUserService();
  return service.clearCache(userId);
}

export function getUserCacheStats() {
  const service = getUserService();
  return service.getCacheStats();
}

// ==================== DEFAULT EXPORT ====================
export default getUserService;