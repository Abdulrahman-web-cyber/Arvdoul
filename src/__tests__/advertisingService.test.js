/**
 * Unit tests for Phase B client services:
 * - advertisingService
 * - collaborationService (brand partnerships & ad authorizations)
 * - creatorEarningsService
 * - postAnalyticsService
 *
 * Verifies each method delegates to the expected Cloud Function callable key and payload.
 */

import { jest } from '@jest/globals';

const callFunctionMock = jest.fn(async () => ({ success: true }));

const ACTUAL_FUNCTIONS = {
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

  CREATE_BRAND_PARTNERSHIP: 'createBrandPartnership',
  RESPOND_BRAND_PARTNERSHIP: 'respondBrandPartnership',
  UPDATE_PARTNERSHIP_DELIVERABLE: 'updatePartnershipDeliverable',
  LIST_BRAND_PARTNERSHIPS: 'listBrandPartnerships',
  GRANT_AD_AUTHORIZATION: 'grantAdAuthorization',
  REVOKE_AD_AUTHORIZATION: 'revokeAdAuthorization',
  LIST_AD_AUTHORIZATIONS: 'listAdAuthorizations',
  GET_PARTNERSHIP_ANALYTICS: 'getPartnershipAnalytics',

  GET_POST_SEPARATED_ANALYTICS: 'getPostSeparatedAnalytics',
  GET_CREATOR_EARNINGS_LEDGER: 'getCreatorEarningsLedger',
  CREATE_AFFILIATE_LINK: 'createAffiliateLink',
  CREATE_PROMO_CODE: 'createPromoCode',
  LIST_CREATOR_AFFILIATE_ASSETS: 'listCreatorAffiliateAssets',
  TRACK_AFFILIATE_CONVERSION: 'trackAffiliateConversion',
};

jest.unstable_mockModule('../services/callableService.js', () => ({
  FUNCTIONS: ACTUAL_FUNCTIONS,
  callFunction: callFunctionMock,
  makeCallable: (name) => async (data) => ({ data: await callFunctionMock(name, data) }),
  fetchAdminStatus: jest.fn(async () => false),
  default: {
    FUNCTIONS: ACTUAL_FUNCTIONS,
    callFunction: callFunctionMock,
  },
}));

jest.unstable_mockModule('../firebase/firebase.js', () => ({
  getFirestoreInstance: jest.fn(async () => ({})),
  getFunctionsInstance: jest.fn(async () => ({})),
}));

const { advertisingService } = await import('../services/advertisingService.js');
const { collaborationService } = await import('../services/collaborationService.js');
const { creatorEarningsService } = await import('../services/creatorEarningsService.js');
const { postAnalyticsService } = await import('../services/postAnalyticsService.js');

describe('advertisingService callable delegation', () => {
  beforeEach(() => {
    callFunctionMock.mockClear();
  });

  test('account and funding methods pass expected callable names and idempotency keys', async () => {
    await advertisingService.getOrCreateAdAccount('EUR');
    expect(callFunctionMock).toHaveBeenCalledWith('getOrCreateAdAccount', { currency: 'EUR' });

    await advertisingService.fundAdAccount({
      amountCents: 5000,
      currency: 'USD',
      paymentReference: 'card_last4_4242',
      idempotencyKey: 'idem_fund_1',
    });
    expect(callFunctionMock).toHaveBeenCalledWith('fundAdAccount', {
      amountCents: 5000,
      currency: 'USD',
      paymentReference: 'card_last4_4242',
      idempotencyKey: 'idem_fund_1',
    });
  });

  test('campaign lifecycle, review, and analytics methods delegate cleanly', async () => {
    await advertisingService.createAdCampaign({
      title: 'Spring Spark',
      promotionKind: 'spark_video',
      sourcePostId: 'post_99',
      budgetCents: 2500,
    });
    expect(callFunctionMock).toHaveBeenCalledWith('createAdCampaign', {
      title: 'Spring Spark',
      promotionKind: 'spark_video',
      sourcePostId: 'post_99',
      budgetCents: 2500,
    });

    await advertisingService.updateAdCampaign('camp_1', { dailyBudgetCents: 3000 });
    expect(callFunctionMock).toHaveBeenCalledWith('updateAdCampaign', {
      campaignId: 'camp_1',
      updates: { dailyBudgetCents: 3000 },
    });

    await advertisingService.setAdCampaignStatus('camp_1', 'paused');
    expect(callFunctionMock).toHaveBeenCalledWith('setAdCampaignStatus', {
      campaignId: 'camp_1',
      status: 'paused',
    });

    await advertisingService.submitAdCampaignForReview('camp_1', 'All disclosures verified');
    expect(callFunctionMock).toHaveBeenCalledWith('submitAdCampaignForReview', {
      campaignId: 'camp_1',
      complianceNotes: 'All disclosures verified',
    });

    await advertisingService.listAdCampaigns(25);
    expect(callFunctionMock).toHaveBeenCalledWith('listAdCampaigns', { limit: 25 });

    await advertisingService.listAdModerationQueue('pending_review');
    expect(callFunctionMock).toHaveBeenCalledWith('listAdModerationQueue', { status: 'pending_review' });

    await advertisingService.reviewAdCampaign({
      campaignId: 'camp_1',
      reviewId: 'rev_1',
      decision: 'approved',
      notes: 'Compliant',
    });
    expect(callFunctionMock).toHaveBeenCalledWith('reviewAdCampaign', {
      campaignId: 'camp_1',
      reviewId: 'rev_1',
      decision: 'approved',
      notes: 'Compliant',
    });

    await advertisingService.getAdCampaignAnalytics('camp_1');
    expect(callFunctionMock).toHaveBeenCalledWith('getAdCampaignAnalytics', { campaignId: 'camp_1' });

    await advertisingService.getAdBillingLedger(30);
    expect(callFunctionMock).toHaveBeenCalledWith('getAdBillingLedger', { limit: 30 });

    await advertisingService.requestAdRefundOrDispute({
      campaignId: 'camp_1',
      reason: 'Duplicate delivery spike',
      requestedAmountCents: 500,
    });
    expect(callFunctionMock).toHaveBeenCalledWith('requestAdRefundOrDispute', {
      campaignId: 'camp_1',
      reason: 'Duplicate delivery spike',
      requestedAmountCents: 500,
    });

    await advertisingService.adminResolveAdDispute({
      disputeId: 'disp_1',
      decision: 'approved',
      resolutionNotes: 'Refund issued',
    });
    expect(callFunctionMock).toHaveBeenCalledWith('adminResolveAdDispute', {
      disputeId: 'disp_1',
      decision: 'approved',
      resolutionNotes: 'Refund issued',
    });
  });

  test('ad delivery, conversion, and eligible feed ads use expected contracts', async () => {
    await advertisingService.recordAdDeliveryEvent({
      campaignId: 'camp_2',
      eventType: 'impression',
      placement: 'home',
      idempotencyKey: 'imp_1',
    });
    expect(callFunctionMock).toHaveBeenCalledWith('recordAdDeliveryEvent', {
      campaignId: 'camp_2',
      eventType: 'impression',
      placement: 'home',
      idempotencyKey: 'imp_1',
    });

    await advertisingService.trackAdConversion({
      campaignId: 'camp_2',
      eventType: 'purchase',
      valueCents: 1999,
    });
    expect(callFunctionMock).toHaveBeenCalledWith('trackAdConversion', {
      campaignId: 'camp_2',
      eventType: 'purchase',
      valueCents: 1999,
    });

    await advertisingService.getEligibleFeedAds('sparks', 4);
    expect(callFunctionMock).toHaveBeenCalledWith('getEligibleFeedAds', {
      placement: 'sparks',
      limit: 4,
    });
  });
});

describe('collaborationService brand partnerships & ad authorizations', () => {
  beforeEach(() => {
    callFunctionMock.mockClear();
  });

  test('brand partnership methods invoke expected server callables', async () => {
    await collaborationService.createBrandPartnership({
      brandName: 'Lumia Gear',
      compensationCents: 150000,
    });
    expect(callFunctionMock).toHaveBeenCalledWith('createBrandPartnership', {
      brandName: 'Lumia Gear',
      compensationCents: 150000,
    });

    await collaborationService.respondBrandPartnership('part_1', 'accept');
    expect(callFunctionMock).toHaveBeenCalledWith('respondBrandPartnership', {
      partnershipId: 'part_1',
      decision: 'accept',
    });

    await collaborationService.updatePartnershipDeliverable('part_1', 'deliv_1', true, 'post_77');
    expect(callFunctionMock).toHaveBeenCalledWith('updatePartnershipDeliverable', {
      partnershipId: 'part_1',
      deliverableId: 'deliv_1',
      completed: true,
      postId: 'post_77',
    });

    await collaborationService.listBrandPartnerships();
    expect(callFunctionMock).toHaveBeenCalledWith('listBrandPartnerships', {});

    await collaborationService.getPartnershipAnalytics('part_1');
    expect(callFunctionMock).toHaveBeenCalledWith('getPartnershipAnalytics', { partnershipId: 'part_1' });
  });

  test('ad authorization methods grant, revoke, and list ad codes', async () => {
    await collaborationService.grantAdAuthorization({
      postId: 'post_77',
      partnerId: 'brand_1',
      partnerName: 'Lumia Gear',
      expiresInDays: 45,
    });
    expect(callFunctionMock).toHaveBeenCalledWith('grantAdAuthorization', {
      postId: 'post_77',
      partnerId: 'brand_1',
      partnerName: 'Lumia Gear',
      expiresInDays: 45,
    });

    await collaborationService.revokeAdAuthorization('auth_1');
    expect(callFunctionMock).toHaveBeenCalledWith('revokeAdAuthorization', { authorizationId: 'auth_1' });

    await collaborationService.listAdAuthorizations();
    expect(callFunctionMock).toHaveBeenCalledWith('listAdAuthorizations', {});
  });
});

describe('creatorEarningsService & postAnalyticsService', () => {
  beforeEach(() => {
    callFunctionMock.mockClear();
  });

  test('creatorEarningsService invokes ledger, affiliate, promo, and conversion callables', async () => {
    await creatorEarningsService.getEarningsLedger(20);
    expect(callFunctionMock).toHaveBeenCalledWith('getCreatorEarningsLedger', { limit: 20 });

    await creatorEarningsService.createAffiliateLink({
      postId: 'post_5',
      label: 'Studio Mic',
      destinationUrl: 'https://shop.example.com/mic',
      commissionRatePct: 12,
    });
    expect(callFunctionMock).toHaveBeenCalledWith('createAffiliateLink', {
      postId: 'post_5',
      label: 'Studio Mic',
      destinationUrl: 'https://shop.example.com/mic',
      commissionRatePct: 12,
    });

    await creatorEarningsService.createPromoCode({
      code: 'ARV20',
      discountText: '20% off',
      expiresAt: '2030-01-01',
    });
    expect(callFunctionMock).toHaveBeenCalledWith('createPromoCode', {
      code: 'ARV20',
      discountText: '20% off',
      expiresAt: '2030-01-01',
    });

    await creatorEarningsService.listAffiliateAssets();
    expect(callFunctionMock).toHaveBeenCalledWith('listCreatorAffiliateAssets', {});

    await creatorEarningsService.trackAffiliateConversion('link_1', 'conversion');
    expect(callFunctionMock).toHaveBeenCalledWith('trackAffiliateConversion', {
      linkId: 'link_1',
      eventType: 'conversion',
    });
  });

  test('postAnalyticsService requires postId and calls getPostSeparatedAnalytics', async () => {
    await expect(postAnalyticsService.getPostSeparatedAnalytics('')).rejects.toThrow(/postId is required/i);

    await postAnalyticsService.getPostSeparatedAnalytics('post_88');
    expect(callFunctionMock).toHaveBeenCalledWith('getPostSeparatedAnalytics', { postId: 'post_88' });
  });
});
