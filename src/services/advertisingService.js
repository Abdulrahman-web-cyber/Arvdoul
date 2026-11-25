// src/services/advertisingService.js
// Dedicated client service for the Arvdoul Advertising Center.
// Strictly separated from Virtual Coins Wallet and Creator Earnings.

import { callFunction, FUNCTIONS } from './callableService.js';

function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ad_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

class AdvertisingService {
  async getOrCreateAdAccount(currency = 'USD') {
    return callFunction(FUNCTIONS.GET_OR_CREATE_AD_ACCOUNT, { currency });
  }

  async fundAdAccount({ amountCents, currency = 'USD', paymentReference = '', idempotencyKey = null }) {
    const key = idempotencyKey || newIdempotencyKey();
    return callFunction(FUNCTIONS.FUND_AD_ACCOUNT, {
      amountCents,
      currency,
      paymentReference,
      idempotencyKey: key,
    });
  }

  async createAdCampaign(payload) {
    return callFunction(FUNCTIONS.CREATE_AD_CAMPAIGN, payload);
  }

  async updateAdCampaign(campaignId, updates) {
    return callFunction(FUNCTIONS.UPDATE_AD_CAMPAIGN, { campaignId, updates });
  }

  async setAdCampaignStatus(campaignId, status) {
    return callFunction(FUNCTIONS.SET_AD_CAMPAIGN_STATUS, { campaignId, status });
  }

  async submitAdCampaignForReview(campaignId, complianceNotes = '') {
    return callFunction(FUNCTIONS.SUBMIT_AD_CAMPAIGN_FOR_REVIEW, { campaignId, complianceNotes });
  }

  async listAdCampaigns(limit = 50) {
    return callFunction(FUNCTIONS.LIST_AD_CAMPAIGNS, { limit });
  }

  async listAdModerationQueue(status = 'pending_review') {
    return callFunction(FUNCTIONS.LIST_AD_MODERATION_QUEUE, { status });
  }

  async reviewAdCampaign({ campaignId, reviewId = null, decision, notes = '' }) {
    return callFunction(FUNCTIONS.REVIEW_AD_CAMPAIGN, { campaignId, reviewId, decision, notes });
  }

  async getAdCampaignAnalytics(campaignId) {
    return callFunction(FUNCTIONS.GET_AD_CAMPAIGN_ANALYTICS, { campaignId });
  }

  async getAdBillingLedger(limit = 50) {
    return callFunction(FUNCTIONS.GET_AD_BILLING_LEDGER, { limit });
  }

  async requestAdRefundOrDispute({ campaignId = null, reason, requestedAmountCents }) {
    return callFunction(FUNCTIONS.REQUEST_AD_REFUND_OR_DISPUTE, {
      campaignId,
      reason,
      requestedAmountCents,
    });
  }

  async adminResolveAdDispute({ disputeId, decision, resolutionNotes = '' }) {
    return callFunction(FUNCTIONS.ADMIN_RESOLVE_AD_DISPUTE, {
      disputeId,
      decision,
      resolutionNotes,
    });
  }

  async recordAdDeliveryEvent({ campaignId, eventType = 'impression', placement = 'home', idempotencyKey = null }) {
    const key = idempotencyKey || newIdempotencyKey();
    return callFunction(FUNCTIONS.RECORD_AD_DELIVERY_EVENT, {
      campaignId,
      eventType,
      placement,
      idempotencyKey: key,
    });
  }

  async trackAdConversion({ campaignId, eventType = 'click', valueCents = 0 }) {
    return callFunction(FUNCTIONS.TRACK_AD_CONVERSION, { campaignId, eventType, valueCents });
  }

  async getEligibleFeedAds(placement = 'home', limit = 5) {
    return callFunction(FUNCTIONS.GET_ELIGIBLE_FEED_ADS, { placement, limit });
  }
}

export const advertisingService = new AdvertisingService();
export default advertisingService;
