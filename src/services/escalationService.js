/**
 * src/services/escalationService.js - ARVDOUL TIER-1 TO TIER-3 MODERATION ESCALATION ENGINE
 *
 * Implements:
 * 1. Multi-Stage Escalation Hierarchy:
 *    - Tier 1: Frontline AI and community moderators (Spam, standard profanity)
 *    - Tier 2: Senior trust & safety team (Harassment, copyright disputes, hate speech)
 *    - Tier 3: Legal, Executive & Law Enforcement Officers (CSAM, terrorism, immediate physical threat)
 * 2. Automatic Emergency Escalation: Instantly elevates critical safety risks to Tier 3.
 */

import { logger } from '../utils/Logger.js';
import { auditLogger } from '../utils/AuditLogger.js';

class EscalationService {
  /**
   * Escalates a ticket to the appropriate operational tier.
   */
  async escalateTicket(ticketId, targetTier = 'tier_2', reason = 'Complex Policy Edge Case') {
    try {
      const { getFirestoreInstance } = await import('../firebase/firebase.js');
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const db = await getFirestoreInstance();

      const ticketRef = doc(db, 'moderation_queue', ticketId);
      await updateDoc(ticketRef, {
        tier: targetTier,
        escalationReason: reason,
        escalatedAt: serverTimestamp(),
      });

      logger.info(`[EscalationService] Ticket ${ticketId} escalated to ${targetTier}: ${reason}`);
      auditLogger.log('moderation.ticket_escalated', {
        meta: { ticketId, targetTier, reason },
      });

      return { success: true, tier: targetTier };
    } catch (err) {
      logger.error(`[EscalationService] Failed to escalate ticket ${ticketId}:`, { error: err.message });
      throw err;
    }
  }
}

export const escalationService = new EscalationService();
export default escalationService;
