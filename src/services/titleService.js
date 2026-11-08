// src/services/titleService.js
//
// Server-validated, multidimensional criteria, Zero Pay-to-Legitimacy.

import { TITLES_CATALOG, ROYAL_ELIGIBILITY, getRoyalEligibility } from './levelSystemService.js';
import { callFunction, FUNCTIONS } from './callableService.js';
import { getFirestoreInstance } from '../firebase/firebase.js';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { logger } from '../utils/Logger.js';

// Hard ceiling for a user's granted-titles list read.
const TITLES_MAX_READ = 200;

class TitleService {
  constructor() {
    this._cache = new Map();
    this.TTL_MS = 60_000;
  }

  /**
   * Returns the static canonical catalog of titles.
   */
  getCatalog() {
    return TITLES_CATALOG;
  }

  /**
   * Return titles grouped by domain (creation, community, civic, historical).
   */
  getTitlesByDomain() {
    const grouped = {
      creation: [],
      community: [],
      civic: [],
      historical: [],
    };
    for (const title of Object.values(TITLES_CATALOG)) {
      if (grouped[title.domain]) {
        grouped[title.domain].push(title);
      }
    }
    return grouped;
  }

  /**
   * Check if a user satisfies the multidimensional criteria for a title.
   * Pure evaluation; never mutates state.
   */
  checkEligibility(titleId, stats = {}) {
    const title = TITLES_CATALOG[titleId];
    if (!title) return { eligible: false, reasons: ['Unknown title'] };

    if (titleId === 'duke' || titleId === 'king') {
      const res = getRoyalEligibility(titleId, stats);
      const rule = ROYAL_ELIGIBILITY[titleId];
      const reasons = res.missing.map((m) => {
        if (m === 'reputation') return `Requires Minimum ${rule.minReputation} Reputation`;
        if (m === 'contribution') return `Requires Minimum ${rule.minContribution} Contribution`;
        if (m === 'influence') return `Requires Minimum ${rule.minInfluence} Influence`;
        if (m === 'level') return `Requires Level ${rule.minLevel}`;
        if (m === 'activeDays') return `Requires ${rule.minActiveDays} Active Days`;
        if (m === 'achievements') return `Requires ${rule.minAchievements} Achievements`;
        if (m === 'policyStanding') return 'Account must be in good policy standing';
        return `Requires ${m}`;
      });
      return { eligible: res.eligible, reasons };
    }

    const c = title.criteria || {};
    // An unknown level is NOT Level 1: a `|| 1` floor used to hand every title
    // with a `minLevel` gate to a viewer whose standing had not loaded, while
    // the server (the authority) would reject it. Absent standing reads as 0 so
    // the gate fails closed.
    const level = Number(stats.level) || 0;
    const activeDays = Number(stats.activeDaysCount) || 0;
    const contribution = Number(stats.contributionScore || stats.contribution) || 0;
    const reputation = Number(stats.reputationScore || stats.reputation) || 0;
    const influence = Number(stats.influenceScore || stats.influence) || 0;
    const creations = Number(stats.creationsCount || stats.minCreations || stats.creations) || 0;

    const reasons = [];
    // Titles declare their gate on the title itself (`title.minLevel`); the
    // criteria object may also carry one. Check both, and the creation-count
    // gate the catalog defines but the evaluator used to ignore.
    const minLevel = c.minLevel ?? title.minLevel;
    if (minLevel && level < minLevel) reasons.push(`Requires Level ${minLevel}`);
    if (c.minCreations && creations < c.minCreations) reasons.push(`Requires ${c.minCreations} Creations`);
    if (c.minActiveDays && activeDays < c.minActiveDays) reasons.push(`Requires ${c.minActiveDays} Active Days`);
    if (c.minContribution && contribution < c.minContribution) reasons.push(`Requires ${c.minContribution} Contribution`);
    if (c.minReputation && reputation < c.minReputation) reasons.push(`Requires ${c.minReputation} Reputation`);
    if (c.minInfluence && influence < c.minInfluence) reasons.push(`Requires ${c.minInfluence} Influence`);
    if (c.isCreator && !stats.isCreator) reasons.push('Requires Creator status');
    if (c.isFounder && !stats.isFounder) reasons.push('Requires Founder status');
    if (c.isPioneer && !stats.isPioneer) reasons.push('Requires Pioneer status');

    return {
      eligible: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Fetch all earned titles for a user from their authoritative titles subcollection.
   */
  async getUserTitles(userId) {
    if (!userId) return [];

    const cached = this._cache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.TTL_MS) {
      return cached.items;
    }

    try {
      const db = await getFirestoreInstance();
      const colRef = collection(db, 'titles', userId, 'items');
      const snap = await getDocs(query(colRef, limit(TITLES_MAX_READ)));

      const items = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        grantedAt: d.data().grantedAt?.toDate?.() || null,
      }));

      // No synthetic titles: the 'resident' title is part of the citizenship
      // foundation and must be provisioned server-side, not injected here. A
      // fabricated entitlement is indistinguishable from a real grant.

      this._cache.set(userId, { items, timestamp: Date.now() });
      return items;
    } catch (err) {
      // Load failed - return nothing rather than a fabricated entitlement.
      logger.warn('[TitleService] Failed to load user titles:', { userId, error: err.message });
      return [];
    }
  }

  /**
   * Claim an unlocked title via server-authoritative callable.
   */
  async claimTitle(titleId) {
    if (!titleId) throw new Error('titleId is required');

    try {
      const res = await callFunction(FUNCTIONS.CLAIM_TITLE, { titleId });
      return res;
    } catch (err) {
      logger.error('[TitleService] claimTitle failed:', { titleId, error: err.message });
      throw err;
    }
  }

  /**
   * Set user's active primary title via server callable.
   */
  async setActiveTitle(titleId) {
    try {
      const res = await callFunction(FUNCTIONS.SET_ACTIVE_TITLE, { titleId });
      return res;
    } catch (err) {
      logger.error('[TitleService] setActiveTitle failed:', { titleId, error: err.message });
      throw err;
    }
  }

  invalidate(userId) {
    if (userId) this._cache.delete(userId);
  }
}

export const titleService = new TitleService();
export default titleService;
