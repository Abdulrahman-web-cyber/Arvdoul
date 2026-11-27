// src/services/callableService.js
//
// Canonical entry point for invoking Firebase Cloud Functions callables from client.
// Ensures consistent error handling, app instance binding, and admin status retrieval.

import { getFunctionsInstance } from '../firebase/firebase.js';
import { logger } from '../utils/Logger.js';

export function isCallableUnavailableError(error) {
  const code = String(error?.code || '').toLowerCase();
  const msg = String(error?.message || '').toLowerCase();
  return (
    code === 'functions/internal' ||
    code === 'functions/unavailable' ||
    code === 'functions/not-found' ||
    code === 'internal' ||
    code === 'unavailable' ||
    code === 'not-found' ||
    msg === 'internal' ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed')
  );
}

export const FUNCTIONS = {
  GET_ADMIN_STATUS: 'getAdminStatus',
  BOOTSTRAP_OWNER: 'bootstrapOwner',
  GRANT_ADMIN: 'grantAdmin',
  REVOKE_ADMIN: 'revokeAdmin',
  LIST_ADMINS: 'listAdmins',
  LIST_USERS: 'listUsers',
  APPLY_USER_ADMIN_ACTION: 'applyUserAdminAction',
  RESOLVE_USER_REPORT: 'resolveUserReport',
  DELETE_USER_DATA: 'deleteUserData',
  AWARD_EXPERIENCE: 'awardExperience',
  RECORD_ACTIVE_DAY: 'recordActiveDay',
  EVALUATE_ACHIEVEMENTS: 'evaluateAchievements',
  CLAIM_TITLE: 'claimTitle',
  SET_ACTIVE_TITLE: 'setActiveTitle',
  APPLY_FOR_CREATOR: 'applyForCreator',
  APPLY_VERIFICATION_DECISION: 'applyVerificationDecision',
  GET_ECONOMY_SUMMARY: 'getEconomySummary',
  ADMIN_DECIDE_WITHDRAWAL: 'adminDecideWithdrawal',
  ADMIN_LIST_COMMUNITIES: 'adminListCommunities',
  ADMIN_SET_COMMUNITY_VERIFIED: 'adminSetCommunityVerified',
  ADMIN_ISSUE_COMMUNITY_STRIKE: 'adminIssueCommunityStrike',

  // Communities (server-authoritative mutations; see functions/communities.js)
  CREATE_COMMUNITY: 'createCommunity',
  UPDATE_COMMUNITY_SETTINGS: 'updateCommunitySettings',
  DELETE_COMMUNITY: 'deleteCommunity',
  JOIN_COMMUNITY: 'joinCommunity',
  LEAVE_COMMUNITY: 'leaveCommunity',
  REQUEST_TO_JOIN: 'requestToJoin',
  APPROVE_JOIN_REQUEST: 'approveJoinRequest',
  REJECT_JOIN_REQUEST: 'rejectJoinRequest',
  ASSIGN_COMMUNITY_ROLE: 'assignCommunityRole',
  UPDATE_MEMBER_PERMISSIONS: 'updateMemberPermissions',
  ADD_COMMUNITY_SPACE: 'addCommunitySpace',
  REMOVE_COMMUNITY_SPACE: 'removeCommunitySpace',
  COMMUNITY_MODERATE: 'communityModerate',
  CREATE_COMMUNITY_POST: 'createCommunityPost',
  GET_MY_COMMUNITIES: 'getMyCommunities',
  GET_COMMUNITY_CHANNELS: 'getCommunityChannels',
  CREATE_COMMUNITY_CHANNEL: 'createCommunityChannel',
  UPDATE_COMMUNITY_CHANNEL: 'updateCommunityChannel',
  DELETE_COMMUNITY_CHANNEL: 'deleteCommunityChannel',
  GET_CHANNEL_MESSAGES: 'getChannelMessages',
  SEND_CHANNEL_MESSAGE: 'sendChannelMessage',
  MODERATE_CHANNEL_MESSAGE: 'moderateChannelMessage',
  // Events (server-authoritative participation; see functions/events.js)
  REGISTER_FOR_EVENT: 'registerForEvent',
  CANCEL_EVENT_REGISTRATION: 'cancelEventRegistration',
  CHECK_IN_EVENT_ATTENDEE: 'checkInEventAttendee',
  PROMOTE_EVENT_WAITLIST: 'promoteEventWaitlist',
  SUBMIT_EVENT_FEEDBACK: 'submitEventFeedback',
  GET_EVENT_ATTENDEES: 'getEventAttendees',
  GET_USER_EVENT_REGISTRATIONS: 'getUserEventRegistrations',
  // Collaboration projects (server-authoritative; see functions/collaboration.js)
  CREATE_COLLAB_PROJECT: 'createCollaborationProject',
  UPDATE_COLLAB_PROJECT: 'updateCollaborationProject',
  DELETE_COLLAB_PROJECT: 'deleteCollaborationProject',
  ADD_COLLAB_TEAM_MEMBER: 'addCollaborationTeamMember',
  UPDATE_COLLAB_MEMBER_ROLE: 'updateCollaborationMemberRole',
  REMOVE_COLLAB_TEAM_MEMBER: 'removeCollaborationTeamMember',
  CREATE_COLLAB_INVITE: 'createCollaborationInvite',
  ACCEPT_COLLAB_INVITE: 'acceptCollaborationInvite',
  DECLINE_COLLAB_INVITE: 'declineCollaborationInvite',
  CREATE_COLLAB_CONTENT: 'createCollaborationContent',
  SUBMIT_COLLAB_CONTENT: 'submitCollaborationContentForReview',
  REVIEW_COLLAB_CONTENT: 'reviewCollaborationContent',
  PUBLISH_COLLAB_CONTENT: 'publishCollaborationContent',
  ADMIN_MODERATE_CONTENT: 'adminModerateContent',
  ADMIN_LIST_MODERATION_REPORTS: 'adminListModerationReports',
  ADMIN_LIST_SUPPORT_TICKETS: 'adminListSupportTickets',
  ADMIN_RESOLVE_SUPPORT_TICKET: 'adminResolveSupportTicket',
  GET_FEATURE_FLAG_OVERRIDES: 'getFeatureFlagOverrides',
  SET_FEATURE_FLAG_OVERRIDE: 'setFeatureFlagOverride',
  TRACK_PROFILE_VIEW: 'trackProfileView',
  RECORD_POST_VIEW: 'recordPostView',
  EXPORT_USER_DATA: 'exportUserData',
  REPORT_COMMENT: 'reportComment',
  REPORT_POST: 'reportPost',
  REPORT_GROUP: 'reportGroup',
  REPORT_COMMUNITY: 'reportCommunity',
  REPORT_CHANNEL: 'reportChannel',
  REPORT_CALL: 'reportCall',
  GET_MUX_PLAYBACK_URL: 'getMuxPlaybackUrl',
  MODERATE_POST: 'moderatePost',
  PREDICT_POST_PERFORMANCE: 'predictPostPerformance',
  SCRAPE_LINK: 'scrapeLink',

  // Social graph & multi-device sessions
  GET_MUTUAL_FRIENDS: 'getMutualFriends',
  GENERATE_FRIEND_RECOMMENDATIONS: 'generateFriendRecommendations',
  REGISTER_DEVICE_SESSION: 'registerDeviceSession',
  LIST_DEVICE_SESSIONS: 'listDeviceSessions',
  REVOKE_DEVICE_SESSION: 'revokeDeviceSession',

  // Privacy: rewrite the denormalised posts.authorIsPrivate flag when the
  // owner toggles privacy (and one-off backfill for legacy posts).
  PROPAGATE_POST_PRIVACY: 'propagatePostPrivacy',
  BACKFILL_POST_PRIVACY: 'backfillPostPrivacy',

  // Moderation / reporting
  REPORT_USER: 'reportUser',

  // Polls
  VOTE_POLL: 'votePoll',
  VOTE_POST_POLL: 'votePostPoll',

  // Q&A (post-embedded questions)
  ADD_ANSWER: 'addAnswer',
  EDIT_ANSWER: 'editAnswer',
  DELETE_ANSWER: 'deleteAnswer',
  CAST_ANSWER_VOTE: 'castAnswerVote',
  ACCEPT_ANSWER: 'acceptAnswer',

  // Marketplace
  PURCHASE_MARKETPLACE_ITEM: 'purchaseMarketplaceItem',

  // Notifications
  SEND_NOTIFICATION: 'sendNotification',
  MARK_NOTIFICATION_READ: 'markNotificationRead',
  MARK_ALL_NOTIFICATIONS_READ: 'markAllNotificationsRead',
  DELETE_NOTIFICATION: 'deleteNotification',
  GET_USER_NOTIFICATIONS: 'getUserNotifications',
  GET_NOTIFICATION_STATS: 'getNotificationStats',
  CREATE_BULK_NOTIFICATION_JOB: 'createBulkNotificationJob',

  // Messaging
  SEARCH_MESSAGES: 'searchMessages',
  JOIN_GROUP_VIA_INVITE: 'joinGroupViaInvite',
  CREATE_GROUP_CONVERSATION: 'createGroupConversation',
  MANAGE_GROUP_MEMBER: 'manageGroupMember',
  UPDATE_GROUP_SETTINGS: 'updateGroupSettings',
  CREATE_GROUP_INVITE: 'createGroupInvite',
  REVOKE_GROUP_INVITE: 'revokeGroupInvite',
  RESPOND_GROUP_JOIN_REQUEST: 'respondGroupJoinRequest',
  SEND_MENTION_NOTIFICATIONS: 'sendMentionNotifications',

  // Voice & video calls (see functions/calls.js)
  INITIATE_CALL: 'initiateCall',
  RESPOND_TO_CALL: 'respondToCall',
  UPDATE_CALL_SESSION_STATE: 'updateCallSessionState',
  GET_CALL_HISTORY: 'getCallHistory',

  // Video
  CREATE_MUX_UPLOAD: 'createMuxUpload',
  LIKE_VIDEO: 'likeVideo',
  SHARE_VIDEO: 'shareVideo',
  TOGGLE_VIDEO_SAVE: 'toggleVideoSave',
  RECORD_VIDEO_VIEW: 'recordVideoView',
  PAY_PER_VIEW: 'payPerView',
  SEND_TIP: 'sendTip',
  SET_VIDEO_CHAPTERS: 'setVideoChapters',
  CREATE_DUET: 'createDuet',
  CREATE_STITCH: 'createStitch',
  REPORT_VIDEO: 'reportVideo',
  REPORT_MESSAGE: 'reportMessage',
  GET_VIDEO_RECOMMENDATIONS: 'getVideoRecommendations',
  PROCESS_VIDEO_EVENT: 'processVideoEvent',
  WATERMARK_VIDEO: 'watermarkVideo',
  MODERATE_VIDEO: 'moderateVideo',
  DELETE_VIDEO: 'deleteVideo',
  MIGRATE_LEGACY_VIDEOS_TO_POSTS: 'migrateLegacyVideosToPosts',
  ROLLBACK_LEGACY_VIDEO_MIGRATION: 'rollbackLegacyVideoMigration',

  // Stories / Vibes
  GENERATE_CAPTION_FOR_IMAGE: 'generateCaptionForImage',
  PUBLISH_VIBE: 'publishVibe',
  DELETE_VIBE: 'deleteVibe',
  REACT_TO_VIBE: 'reactToVibe',
  REPLY_TO_VIBE: 'replyToVibe',
  SHARE_VIBE: 'shareVibe',
  RECORD_VIBE_ENGAGEMENT: 'recordVibeEngagement',
  GET_VIBE_INSIGHTS: 'getVibeInsights',
  REORDER_HIGHLIGHTS: 'reorderHighlights',
  REPORT_STORY: 'reportStory',
  REPORT_VIBE_REPLY: 'reportVibeReply',

  // Feed
  GET_PERSONALIZED_FEED_ML: 'getPersonalizedFeedML',

  // Monetization / ads / wallet
  ADD_COINS: 'addCoins',
  SPEND_COINS: 'spendCoins',
  TRANSFER_COINS: 'transferCoins',
  SEND_GIFT: 'sendGift',
  SEND_MESSAGE_GIFT: 'sendMessageGift',
  SEND_VIBE_GIFT: 'sendVibeGift',
  SEND_LIVE_GIFT: 'sendLiveGift',
  SEND_LIVE_TIP: 'sendLiveTip',
  BOOST_POST: 'boostPost',
  REQUEST_WITHDRAWAL: 'requestWithdrawal',
  RECORD_AD_IMPRESSION: 'recordAdImpression',
  GET_SPONSORED_SEARCH_RESULT: 'getSponsoredSearchResult',
  GET_AD: 'getAd',
  WATCH_AD: 'watchAd',
  REPORT_AD: 'reportAd',
  PURCHASE_COINS: 'purchaseCoins',
  GET_SUBSCRIPTION_STATUS: 'getSubscriptionStatus',
  CREATE_SUBSCRIPTION: 'createSubscription',
  CANCEL_SUBSCRIPTION: 'cancelSubscription',
  GET_PAYOUT_SETTINGS: 'getPayoutSettings',
  CREATE_PAYOUT_ACCOUNT: 'createPayoutAccount',

  // Advertising Center (functions/advertising.js)
  GET_OR_CREATE_AD_ACCOUNT: 'getOrCreateAdAccount',
  FUND_AD_ACCOUNT: 'fundAdAccount',
  CREATE_AD_CAMPAIGN: 'createAdCampaign',
  UPDATE_AD_CAMPAIGN: 'updateAdCampaign',
  SET_AD_CAMPAIGN_STATUS: 'setAdCampaignStatus',
  LIST_AD_CAMPAIGNS: 'listAdCampaigns',
  SUBMIT_AD_CAMPAIGN_FOR_REVIEW: 'submitAdCampaignForReview',
  REVIEW_AD_CAMPAIGN: 'reviewAdCampaign',
  LIST_AD_MODERATION_QUEUE: 'listAdModerationQueue',
  GET_AD_CAMPAIGN_ANALYTICS: 'getAdCampaignAnalytics',
  GET_AD_BILLING_LEDGER: 'getAdBillingLedger',
  REQUEST_AD_REFUND_OR_DISPUTE: 'requestAdRefundOrDispute',
  ADMIN_RESOLVE_AD_DISPUTE: 'adminResolveAdDispute',
  RECORD_AD_DELIVERY_EVENT: 'recordAdDeliveryEvent',
  TRACK_AD_CONVERSION: 'trackAdConversion',
  GET_ELIGIBLE_FEED_ADS: 'getEligibleFeedAds',

  // Brand Partnerships & Ad Authorizations (functions/collaboration.js)
  CREATE_BRAND_PARTNERSHIP: 'createBrandPartnership',
  RESPOND_BRAND_PARTNERSHIP: 'respondBrandPartnership',
  UPDATE_PARTNERSHIP_DELIVERABLE: 'updatePartnershipDeliverable',
  LIST_BRAND_PARTNERSHIPS: 'listBrandPartnerships',
  GRANT_AD_AUTHORIZATION: 'grantAdAuthorization',
  REVOKE_AD_AUTHORIZATION: 'revokeAdAuthorization',
  LIST_AD_AUTHORIZATIONS: 'listAdAuthorizations',
  GET_PARTNERSHIP_ANALYTICS: 'getPartnershipAnalytics',

  // Post Separated Analytics & Creator Earnings / Affiliates (functions/analytics.js, functions/monetization.js)
  GET_POST_SEPARATED_ANALYTICS: 'getPostSeparatedAnalytics',
  GET_CREATOR_EARNINGS_LEDGER: 'getCreatorEarningsLedger',
  CREATE_AFFILIATE_LINK: 'createAffiliateLink',
  CREATE_PROMO_CODE: 'createPromoCode',
  LIST_CREATOR_AFFILIATE_ASSETS: 'listCreatorAffiliateAssets',
  TRACK_AFFILIATE_CONVERSION: 'trackAffiliateConversion',
};

/**
 * Invoke a Firebase callable function by name
 * @param {string} functionName
 * @param {object} [data={}]
 * @returns {Promise<any>} the callable's `data` payload
 */
export async function callFunction(functionName, data = {}) {
  try {
    const { httpsCallable } = await import('firebase/functions');
    const functions = await getFunctionsInstance();
    const callable = httpsCallable(functions, functionName);
    const result = await callable(data);
    return result?.data;
  } catch (error) {
    if (isCallableUnavailableError(error)) {
      logger.warn(`[callableService] Function ${functionName} unavailable`, {
        code: error?.code || null,
        error: error?.message,
      });
    } else {
      logger.error(`[callableService] Error calling ${functionName}`, { error: error?.message });
    }
    throw error;
  }
}

/**
 * Build a bound invoker that mirrors the Firebase `httpsCallable` return shape
 * (`{ data }`), so services that destructure `res.data` keep working without
 * importing `firebase/functions` directly.
 * @param {string} functionName
 * @returns {(data?: object) => Promise<{ data: any }>}
 */
export function makeCallable(functionName) {
  return async (data = {}) => ({ data: await callFunction(functionName, data) });
}

const ADMIN_STATUS_CACHE_TTL_MS = 60_000;
let _adminStatusCache = { uid: null, value: false, expiresAt: 0 };
let _adminStatusInFlight = { uid: null, promise: null };

/**
 * Query current user's admin status from the server (deduplicated per uid)
 * @returns {Promise<boolean>}
 */
export async function fetchAdminStatus() {
  const browserAuth = typeof window !== 'undefined' ? window._arvdoul_auth : null;
  if (browserAuth && !browserAuth.currentUser?.uid) return false;
  const uid = browserAuth?.currentUser?.uid || '__default__';

  const now = Date.now();
  if (_adminStatusCache.uid === uid && now < _adminStatusCache.expiresAt) {
    return _adminStatusCache.value;
  }
  if (_adminStatusInFlight.uid === uid && _adminStatusInFlight.promise) {
    return _adminStatusInFlight.promise;
  }

  const promise = (async () => {
    try {
      const res = await callFunction(FUNCTIONS.GET_ADMIN_STATUS);
      const isAdmin = Boolean(res?.isAdmin);
      _adminStatusCache = { uid, value: isAdmin, expiresAt: Date.now() + ADMIN_STATUS_CACHE_TTL_MS };
      return isAdmin;
    } catch (err) {
      // If not configured or unauthenticated, default to false without crashing
      logger.warn('[callableService] fetchAdminStatus fallback: false', { error: err?.message });
      _adminStatusCache = { uid, value: false, expiresAt: Date.now() + 15_000 };
      return false;
    } finally {
      if (_adminStatusInFlight.uid === uid) {
        _adminStatusInFlight = { uid: null, promise: null };
      }
    }
  })();

  _adminStatusInFlight = { uid, promise };
  return promise;
}

/**
 * Claim ownership bootstrap for configured OWNER_EMAILS
 */
export async function bootstrapOwner() {
  return callFunction(FUNCTIONS.BOOTSTRAP_OWNER);
}

/**
 * Grant admin access to a user
 */
export async function grantAdmin(userId, reason = '') {
  return callFunction(FUNCTIONS.GRANT_ADMIN, { userId, reason });
}

/**
 * Revoke admin access for a user
 */
export async function revokeAdmin(userId) {
  return callFunction(FUNCTIONS.REVOKE_ADMIN, { userId });
}

/**
 * List all current admins
 */
export async function listAdmins() {
  return callFunction(FUNCTIONS.LIST_ADMINS);
}

/**
 * Admin directory: users with contact email merged from users_private.
 */
export async function listUsers(limit = 50) {
  return callFunction(FUNCTIONS.LIST_USERS, { limit });
}

/**
 * Admin moderation: ban / suspend / unban / restore / verify / unverify.
 * Server-authoritative and audit-logged; never a direct Firestore write.
 */
export async function applyUserAdminAction(userId, action) {
  return callFunction(FUNCTIONS.APPLY_USER_ADMIN_ACTION, { userId, action });
}

/**
 * Admin maintenance: re-sync the denormalised `authorIsPrivate` flag on legacy
 * posts (published before the field existed). Admin-gated and audit-logged
 * server-side; paged/resumable, so it can be re-run until it reports 0 updates.
 */
export async function backfillPostPrivacy(limit = 500) {
  return callFunction(FUNCTIONS.BACKFILL_POST_PRIVACY, { limit });
}

export default {
  FUNCTIONS,
  callFunction,
  makeCallable,
  fetchAdminStatus,
  bootstrapOwner,
  grantAdmin,
  revokeAdmin,
  listAdmins,
  listUsers,
  applyUserAdminAction,
  backfillPostPrivacy,
};
