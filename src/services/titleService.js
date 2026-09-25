// src/services/titleService.js — ARVDOUL TITLES & PROVENANCE ENGINE (Part 2)
// Server-validated, multidimensional criteria, Zero Pay-to-Legitimacy.

import { TITLES_CATALOG, ROYAL_ELIGIBILITY, getRoyalEligibility } from './levelSystemService.js';
import { callFunction, FUNCTIONS } from './callableService.js';
import { getFirestoreInstance } from '../firebase/firebase.js';
import { collection, getDocs } from 'firebase/firestore';
import { logger } from '../utils/Logger.js';

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
    const level = Number(stats.level) || 1;
    const activeDays = Number(stats.activeDaysCount) || 0;
    const contribution = Number(stats.contributionScore || stats.contribution) || 0;
    const reputation = Number(stats.reputationScore || stats.reputation) || 0;
    const influence = Number(stats.influenceScore || stats.influence) || 0;

    const reasons = [];
    if (c.minLevel && level < c.minLevel) reasons.push(`Requires Level ${c.minLevel}`);
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
      const snap = await getDocs(colRef);

      const items = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        grantedAt: d.data().grantedAt?.toDate?.() || new Date(),
      }));

      // Every registered citizen inherently possesses the 'resident' title
      const hasResident = items.some((t) => t.id === 'resident');
      if (!hasResident) {
        items.unshift({
          id: 'resident',
          titleId: 'resident',
          domain: 'civic',
          name: 'Resident',
          icon: '🌱',
          description: 'Registered platform resident of Arvdoul.',
          status: 'active',
          source: 'citizenship_foundation',
        });
      }

      this._cache.set(userId, { items, timestamp: Date.now() });
      return items;
    } catch (err) {
      logger.warn('[TitleService] Failed to load user titles:', { userId, error: err.message });
      return [
        {
          id: 'resident',
          titleId: 'resident',
          domain: 'civic',
          name: 'Resident',
          icon: '🌱',
          description: 'Registered platform resident of Arvdoul.',
          status: 'active',
        },
      ];
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
