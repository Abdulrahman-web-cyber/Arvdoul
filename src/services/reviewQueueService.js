// src/services/reviewQueueService.js

import { logger } from '../utils/Logger.js';
import { auditLogger } from '../utils/AuditLogger.js';

class ReviewQueueService {
  /**
   * Enqueues an item for human moderator review.
   */
  async enqueueReviewItem(itemData) {
    try {
      const { getFirestoreInstance } = await import('../firebase/firebase.js');
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const db = await getFirestoreInstance();

      const ticket = {
        contentType: itemData.contentType || 'post',
        contentId: itemData.contentId,
        authorId: itemData.authorId,
        flaggedReasons: itemData.flaggedReasons || [],
        riskScore: itemData.riskScore || 50,
        priority: itemData.priority || 'p2_normal',
        status: 'pending', // 'pending' | 'in_review' | 'resolved'
        assignedTo: null,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'moderation_queue'), ticket);
      logger.info(`[ReviewQueue] Moderation ticket created: ${docRef.id} (Priority: ${ticket.priority})`);
      auditLogger.log('moderation.ticket_created', {
        meta: { ticketId: docRef.id, contentId: itemData.contentId, priority: ticket.priority },
      });

      return { success: true, ticketId: docRef.id };
    } catch (err) {
      logger.error('[ReviewQueue] Failed to enqueue review ticket:', { error: err.message });
      throw err;
    }
  }

  /**
   * Resolves a moderation ticket.
   */
  async resolveTicket(ticketId, moderatorId, decision, notes = '') {
    try {
      const { getFirestoreInstance } = await import('../firebase/firebase.js');
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const db = await getFirestoreInstance();

      const ticketRef = doc(db, 'moderation_queue', ticketId);
      await updateDoc(ticketRef, {
        status: 'resolved',
        decision, // 'approved' | 'removed' | 'warned' | 'banned'
        resolvedBy: moderatorId,
        resolvedAt: serverTimestamp(),
        notes,
      });

      logger.info(`[ReviewQueue] Ticket ${ticketId} resolved by ${moderatorId}: ${decision}`);
      auditLogger.log('moderation.ticket_resolved', {
        userId: moderatorId,
        meta: { ticketId, decision, notes },
      });

      return { success: true };
    } catch (err) {
      logger.error(`[ReviewQueue] Failed to resolve ticket ${ticketId}:`, { error: err.message });
      throw err;
    }
  }
}

export const reviewQueueService = new ReviewQueueService();
export default reviewQueueService;
