// src/services/callableService.js
//
// Canonical entry point for invoking Firebase Cloud Functions callables from client.
// Ensures consistent error handling, app instance binding, and admin status retrieval.

import { getFunctionsInstance } from '../firebase/firebase.js';

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
  GET_MUX_PLAYBACK_URL: 'getMuxPlaybackUrl',
  GENERATE_AI_CAPTION: 'generateAICaption',
  GENERATE_AI_HASHTAGS: 'generateAIHashtags',
  MODERATE_POST: 'moderatePost',
  PREDICT_POST_PERFORMANCE: 'predictPostPerformance',
  SCRAPE_LINK: 'scrapeLink',

  // Social graph
  GET_MUTUAL_FRIENDS: 'getMutualFriends',
  GENERATE_FRIEND_RECOMMENDATIONS: 'generateFriendRecommendations',

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

  // Video
  CREATE_MUX_UPLOAD: 'createMuxUpload',
  LIKE_VIDEO: 'likeVideo',
  SHARE_VIDEO: 'shareVideo',
  RECORD_VIDEO_VIEW: 'recordVideoView',
  PAY_PER_VIEW: 'payPerView',
  SEND_TIP: 'sendTip',
  SET_VIDEO_CHAPTERS: 'setVideoChapters',
  CREATE_DUET: 'createDuet',
  CREATE_STITCH: 'createStitch',
  REPORT_VIDEO: 'reportVideo',
  GET_VIDEO_RECOMMENDATIONS: 'getVideoRecommendations',
  PROCESS_VIDEO_EVENT: 'processVideoEvent',
  WATERMARK_VIDEO: 'watermarkVideo',
  MODERATE_VIDEO: 'moderateVideo',

  // Stories
  GENERATE_CAPTION_FOR_IMAGE: 'generateCaptionForImage',

  // Feed
  GET_PERSONALIZED_FEED_ML: 'getPersonalizedFeedML',

  // Monetization / ads / wallet
  ADD_COINS: 'addCoins',
  SPEND_COINS: 'spendCoins',
  TRANSFER_COINS: 'transferCoins',
  SEND_GIFT: 'sendGift',
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
    console.error(`[callableService] Error calling ${functionName}:`, error);
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

/**
 * Query current user's admin status from the server
 * @returns {Promise<boolean>}
 */
export async function fetchAdminStatus() {
  try {
    const res = await callFunction(FUNCTIONS.GET_ADMIN_STATUS);
    return Boolean(res?.isAdmin);
  } catch (err) {
    // If not configured or unauthenticated, default to false without crashing
    console.warn('[callableService] fetchAdminStatus fallback: false', err?.message);
    return false;
  }
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
};
