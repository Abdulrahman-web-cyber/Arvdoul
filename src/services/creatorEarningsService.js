// src/services/creatorEarningsService.js
// Dedicated service for the Creator Earnings Ledger, Affiliate Links, and Promo Codes.
// Strictly separated from Virtual Coins Wallet and Advertiser Ad Spend.

import { callFunction, FUNCTIONS } from './callableService.js';

class CreatorEarningsService {
  async getEarningsLedger(limit = 50) {
    return callFunction(FUNCTIONS.GET_CREATOR_EARNINGS_LEDGER, { limit });
  }

  async createAffiliateLink({ postId = null, label, destinationUrl, commissionRatePct = 10 }) {
    return callFunction(FUNCTIONS.CREATE_AFFILIATE_LINK, {
      postId,
      label,
      destinationUrl,
      commissionRatePct,
    });
  }

  async createPromoCode({ code, discountText = '', expiresAt = null }) {
    return callFunction(FUNCTIONS.CREATE_PROMO_CODE, {
      code,
      discountText,
      expiresAt,
    });
  }

  async listAffiliateAssets() {
    return callFunction(FUNCTIONS.LIST_CREATOR_AFFILIATE_ASSETS, {});
  }

  async trackAffiliateConversion(linkId, eventType = 'click') {
    return callFunction(FUNCTIONS.TRACK_AFFILIATE_CONVERSION, { linkId, eventType });
  }
}

export const creatorEarningsService = new CreatorEarningsService();
export default creatorEarningsService;
