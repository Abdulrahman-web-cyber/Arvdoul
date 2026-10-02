// src/services/supportTicketService.js
//
// Canonical owner of the `support_tickets` collection for the client. Screens
// must not read/write it directly; the ticket shape (status, messages[],
// timestamps) and the automation triage live here so Help and any future entry
// point stay consistent.

import { logger } from '../utils/Logger.js';
import { supportAutomationService } from './supportAutomationService.js';

class SupportTicketService {
  async _firestore() {
    const { getFirestoreInstance } = await import('../firebase/firebase.js');
    return getFirestoreInstance();
  }

  /** Most recent tickets filed by this user (bounded). */
  async listMyTickets(userId, max = 10) {
    if (!userId) return [];
    const db = await this._firestore();
    const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
    const q = query(
      collection(db, 'support_tickets'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(max)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  /**
   * File a ticket. Triage (category / auto-resolve) is applied here so every
   * caller gets the same classification.
   */
  async fileTicket(userId, { subject, message }) {
    if (!userId) throw new Error('Sign in to contact support');
    const trimmedSubject = String(subject || '').trim();
    const trimmedMessage = String(message || '').trim();
    if (trimmedSubject.length < 3) throw new Error('Please add a short subject');
    if (trimmedMessage.length < 10) throw new Error('Please describe the issue in a little more detail');

    const triage = supportAutomationService.triageSupportTicket(`${trimmedSubject} ${trimmedMessage}`);
    const db = await this._firestore();
    const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
    const createdAt = new Date().toISOString();
    const ref = await addDoc(collection(db, 'support_tickets'), {
      userId,
      subject: trimmedSubject,
      category: triage.category,
      status: 'open',
      messages: [{ sender: 'user', text: trimmedMessage, timestamp: createdAt }],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    logger.info('[supportTicketService] ticket filed', { id: ref.id, category: triage.category });
    return {
      id: ref.id,
      subject: trimmedSubject,
      category: triage.category,
      status: 'open',
      autoResolved: Boolean(triage.autoResolved),
      messages: [{ sender: 'user', text: trimmedMessage, timestamp: createdAt }],
    };
  }
}

let _instance = null;
export function getSupportTicketService() {
  if (!_instance) _instance = new SupportTicketService();
  return _instance;
}

export default { getSupportTicketService };
