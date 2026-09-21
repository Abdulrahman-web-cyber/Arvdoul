// src/services/supportAutomationService.js

import { logger } from '../utils/Logger.js';

class SupportAutomationService {
  constructor() {
    this.knowledgeBase = [
      {
        patterns: [/\b(where\s+are\s+my\s+coins|coins\s+not\s+showing|balance\s+wrong)\b/i],
        category: 'billing_coins',
        resolution: 'Coin balances refresh automatically after network confirmation. If your balance does not update within 2 minutes, navigate to Wallet > Refresh Balance or contact billing support.',
      },
      {
        patterns: [/\b(reset\s+password|forgot\s+password|cant\s+log\s+in)\b/i],
        category: 'auth_recovery',
        resolution: 'You can reset your account password securely by visiting the Login screen and clicking "Forgot Password" or by using your registered Passkey.',
      },
      {
        patterns: [/\b(verify\s+account|blue\s+badge|creator\s+verification)\b/i],
        category: 'creator_verification',
        resolution: 'Creator verification requires: 1) Verified phone and email, 2) At least 1,000 followers, 3) 0 community strikes in the last 90 days. Apply in Settings > Creator Verification.',
      },
    ];
  }

  /**
   * Triage an incoming support ticket text.
   */
  triageSupportTicket(text) {
    if (!text || typeof text !== 'string') {
      return { autoResolved: false, category: 'general_inquiry', response: null };
    }

    for (const item of this.knowledgeBase) {
      for (const pattern of item.patterns) {
        if (pattern.test(text)) {
          logger.info(`[SupportAutomation] Ticket auto-resolved with category: ${item.category}`);
          return {
            autoResolved: true,
            category: item.category,
            response: item.resolution,
          };
        }
      }
    }

    return {
      autoResolved: false,
      category: 'escalate_to_human_agent',
      response: 'Your inquiry has been escalated to our Trust & Support team. A specialist will respond shortly.',
    };
  }
}

export const supportAutomationService = new SupportAutomationService();
export default supportAutomationService;
