/**
 * src/__tests__/phase20BondingCurveAndStakedJury.test.js - ARVDOUL PHASE 20 TEST SUITE
 * Verifies Bancor bonding curve continuous pricing and Staked Moderation Jury with commit-reveal.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DecentralizedTokenBondingCurveService } from '../services/decentralizedTokenBondingCurveService.js';
import {
  DecentralizedModerationJuryService,
  JURY_PHASE,
  JURY_VERDICTS,
} from '../services/decentralizedModerationJuryService.js';

describe('Phase 20: Creator Token Bonding Curves & Decentralized Staked Jury', () => {
  let bondingCurve;
  let moderationJury;

  beforeEach(() => {
    // slope 0.001, exponent 1.5, initial supply test
    bondingCurve = new DecentralizedTokenBondingCurveService(0.001, 1.5);
    moderationJury = new DecentralizedModerationJuryService(100, 30);
  });

  describe('1. Creator Token Continuous Bonding Curves (Feature 58)', () => {
    it('launches token with initial creator allocation and computes spot price', () => {
      const market = bondingCurve.launchCreatorToken({
        creatorId: 'musician_mia',
        tokenName: 'Mia Beats',
        tokenSymbol: 'MIA',
        initialReserve: 500,
        creatorAllocation: 100,
      });

      expect(market.symbol).toBe('MIA');
      expect(market.totalSupply).toBe(100);
      expect(market.spotPrice).toBeGreaterThan(0);
      expect(market.holdersCount).toBe(1);
    });

    it('calculates buy cost and adjusts token supply and reserve dynamically', () => {
      bondingCurve.launchCreatorToken({
        creatorId: 'creator_1',
        tokenName: 'Alpha Coin',
        tokenSymbol: 'ALPHA',
        initialReserve: 1000,
        creatorAllocation: 200,
      });

      const quote = bondingCurve.calculateBuyCost('ALPHA', 50);
      expect(quote.totalCostCoins).toBeGreaterThan(0);
      expect(quote.estimatedSpotPriceAfter).toBeGreaterThan(quote.averagePrice);

      const buyResult = bondingCurve.buyTokens({
        symbol: 'ALPHA',
        buyerId: 'investor_alice',
        maxCollateralCoins: 2000,
        minTokensExpected: 10,
      });

      expect(buyResult.tx.tokensMinted).toBeGreaterThanOrEqual(10);
      expect(buyResult.market.totalSupply).toBeGreaterThan(200);
      expect(buyResult.market.reserveBalance).toBeGreaterThan(1000);
    });

    it('allows selling tokens back into reserve with slippage protection', () => {
      bondingCurve.launchCreatorToken({
        creatorId: 'trader_bob',
        tokenName: 'Beta Coin',
        tokenSymbol: 'BETA',
        initialReserve: 500,
        creatorAllocation: 50,
      });

      // Buy some tokens first
      bondingCurve.buyTokens({
        symbol: 'BETA',
        buyerId: 'buyer_sam',
        maxCollateralCoins: 500,
        minTokensExpected: 5,
      });

      // Sell portion back
      const sellResult = bondingCurve.sellTokens({
        symbol: 'BETA',
        sellerId: 'buyer_sam',
        tokensToBurn: 5,
        minPayoutExpected: 1,
      });

      expect(sellResult.tx.tokensBurned).toBe(5);
      expect(sellResult.tx.payoutCoins).toBeGreaterThan(0);
    });
  });

  describe('2. Staked Community Moderation Jury & Commit-Reveal (Feature 59)', () => {
    beforeEach(() => {
      // Impanel 3 jurors
      moderationJury.registerJuror('juror_1', 200, 90);
      moderationJury.registerJuror('juror_2', 150, 85);
      moderationJury.registerJuror('juror_3', 300, 95);
    });

    it('impannels highest reputation jurors and manages commit phase', () => {
      const juryCase = moderationJury.openCase({
        contentId: 'flagged_video_882',
        creatorId: 'suspect_uploader',
        reporterId: 'concerned_viewer',
        reason: 'Severe copyright infringement and hate speech',
        jurySize: 3,
      });

      expect(juryCase.jurySize).toBe(3);
      expect(juryCase.phase).toBe(JURY_PHASE.COMMIT);
      expect(juryCase.assignedJurorIds).toContain('juror_1');
      expect(juryCase.assignedJurorIds).toContain('juror_2');
      expect(juryCase.assignedJurorIds).toContain('juror_3');
    });

    it('executes commit-reveal secret voting and rewards Schelling consensus', () => {
      const juryCase = moderationJury.openCase({
        contentId: 'disputed_comment_33',
        creatorId: 'author_x',
        reporterId: 'mod_y',
        reason: 'Harassment',
        jurySize: 3,
      });

      const salt1 = 'salt_abc_1';
      const salt2 = 'salt_def_2';
      const salt3 = 'salt_ghi_3';

      const commit1 = moderationJury._hashCommit(JURY_VERDICTS.VIOLATION_CONFIRMED, salt1);
      const commit2 = moderationJury._hashCommit(JURY_VERDICTS.VIOLATION_CONFIRMED, salt2);
      const commit3 = moderationJury._hashCommit(JURY_VERDICTS.NO_VIOLATION, salt3);

      moderationJury.submitCommit(juryCase.caseId, 'juror_1', commit1);
      moderationJury.submitCommit(juryCase.caseId, 'juror_2', commit2);
      const commitStep3 = moderationJury.submitCommit(juryCase.caseId, 'juror_3', commit3);

      // Transitioned to REVEAL phase
      expect(commitStep3.phase).toBe(JURY_PHASE.REVEAL);

      // Reveal phase
      moderationJury.submitReveal(juryCase.caseId, 'juror_1', JURY_VERDICTS.VIOLATION_CONFIRMED, salt1);
      moderationJury.submitReveal(juryCase.caseId, 'juror_2', JURY_VERDICTS.VIOLATION_CONFIRMED, salt2);
      const finalized = moderationJury.submitReveal(juryCase.caseId, 'juror_3', JURY_VERDICTS.NO_VIOLATION, salt3);

      expect(finalized.phase).toBe(JURY_PHASE.FINALIZED);
      expect(finalized.verdict).toBe(JURY_VERDICTS.VIOLATION_CONFIRMED);

      // Majority jurors rewarded, dissident juror 3 slashed
      const juror1 = moderationJury.jurorPool.get('juror_1');
      const juror3 = moderationJury.jurorPool.get('juror_3');

      expect(juror1.rewardsEarned).toBe(30);
      expect(juror3.stakeCoins).toBeLessThan(300); // 10% slashed
    });

    it('rejects fraudulent reveals when salt or choice do not match commitment', () => {
      const juryCase = moderationJury.openCase({
        contentId: 'item_101',
        creatorId: 'u1',
        reporterId: 'u2',
        reason: 'Spam',
        jurySize: 3,
      });

      const salt = 'valid_salt';
      const commit = moderationJury._hashCommit(JURY_VERDICTS.NO_VIOLATION, salt);
      moderationJury.submitCommit(juryCase.caseId, 'juror_1', commit);
      moderationJury.submitCommit(juryCase.caseId, 'juror_2', commit);
      moderationJury.submitCommit(juryCase.caseId, 'juror_3', commit);

      // Juror attempts to reveal different choice than committed
      expect(() => {
        moderationJury.submitReveal(juryCase.caseId, 'juror_1', JURY_VERDICTS.VIOLATION_CONFIRMED, salt);
      }).toThrow('Commit-reveal mismatch');
    });
  });
});
