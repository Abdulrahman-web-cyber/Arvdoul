// src/services/adminService.js
//
// Admin screens previously imported firebase/firestore directly to read
// collections the admin rules open up (moderation_logs, withdrawal_requests,
// coin_transactions, creator_verifications) and to run aggregate counts.
// Funnelling those reads here keeps the collection names, ordering and limits in
// one place and keeps the UI out of the Firebase SDK.
// This service does NOT decide authorization: every caller still gates on
// `fetchAdminStatus()` and the firestore.rules admin branch is the real boundary.

class AdminService {
  async _firestore() {
    const { getFirestoreInstance } = await import('../firebase/firebase.js');
    return getFirestoreInstance();
  }

  async _readCollection(path, { orderField = 'createdAt', max = 100 } = {}) {
    const db = await this._firestore();
    const { collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
    const snap = await getDocs(
      query(collection(db, path), orderBy(orderField, 'desc'), limit(max))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  /** Round-trip probe used by the system-health screen. Never throws. */
  async probeDatabase() {
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try {
      const db = await this._firestore();
      const { doc, getDocFromServer } = await import('firebase/firestore');
      await getDocFromServer(doc(db, 'system_health', 'probe'));
      const latencyMs = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - start);
      return { status: 'operational', latencyMs };
    } catch {
      return { status: 'degraded', latencyMs: null };
    }
  }

  /** Aggregate count for a collection, optionally constrained. Returns 0 on failure. */
  async count(collectionPath, constraints = []) {
    try {
      const db = await this._firestore();
      const { collection, getCountFromServer, query } = await import('firebase/firestore');
      const colRef = constraints.length
        ? query(collection(db, collectionPath), ...constraints)
        : collection(db, collectionPath);
      const snap = await getCountFromServer(colRef);
      return snap.data().count;
    } catch {
      return 0;
    }
  }

  /** Build a Firestore `where` constraint without importing the SDK in the UI. */
  async where(field, op, value) {
    const { where } = await import('firebase/firestore');
    return where(field, op, value);
  }

  listAuditLogs(max = 100) {
    return this._readCollection('moderation_logs', { max });
  }

  listContent(max = 100) {
    return this._readCollection('posts', { max });
  }

  listWithdrawalRequests(max = 100) {
    return this._readCollection('withdrawal_requests', { max });
  }

  listCoinTransactions(max = 100) {
    return this._readCollection('coin_transactions', { max });
  }

  listVerificationApplications(max = 50) {
    return this._readCollection('creator_verifications', { orderField: 'submittedAt', max });
  }
}

let _instance = null;
export function getAdminService() {
  if (!_instance) _instance = new AdminService();
  return _instance;
}

export default { getAdminService };
