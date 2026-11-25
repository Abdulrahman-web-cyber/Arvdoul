/**
 * Unit tests for CreatePost Control Center reducer slices:
 * - SET_IDENTITY_META
 * - SET_DISTRIBUTION_SETTINGS
 * - SET_ENGAGEMENT_CONTROLS
 * - SET_COMMERCIAL_SETTINGS
 * - SET_CREATOR_PROGRAMS
 * - SET_PROMOTION_INTENT
 * - SET_SAFETY_ACCESSIBILITY
 * - SET_LIFECYCLE_SETTINGS
 * - LOAD_DRAFT preservation and UNDO/REDO history support
 */

import { initialState, reducer } from '../screens/CreatePost/createPostReducer.js';

describe('CreatePost Control Center reducer slices', () => {
  test('SET_IDENTITY_META merges partial updates and marks dirty with undo support', () => {
    const next = reducer(initialState, {
      type: 'SET_IDENTITY_META',
      payload: {
        publishAs: 'community',
        communityDestinationId: 'comm_42',
        collaborators: ['uid_a', 'uid_b'],
      },
    });

    expect(next.identityMeta).toEqual({
      publishAs: 'community',
      communityDestinationId: 'comm_42',
      collaborators: ['uid_a', 'uid_b'],
    });
    expect(next.isDirty).toBe(true);
    expect(next._past.length).toBe(1);

    const undone = reducer(next, { type: 'UNDO' });
    expect(undone.identityMeta).toEqual(initialState.identityMeta);
  });

  test('SET_DISTRIBUTION_SETTINGS updates discovery/remix/category without dropping siblings', () => {
    const next = reducer(initialState, {
      type: 'SET_DISTRIBUTION_SETTINGS',
      payload: { allowRemixes: false, category: 'technology' },
    });

    expect(next.distributionSettings.allowRemixes).toBe(false);
    expect(next.distributionSettings.category).toBe('technology');
    expect(next.distributionSettings.allowDiscovery).toBe(true);
    expect(next.distributionSettings.allowReposts).toBe(true);
    expect(next.isDirty).toBe(true);
  });

  test('SET_ENGAGEMENT_CONTROLS updates comment mode, gifts, and toggles cleanly', () => {
    const next = reducer(initialState, {
      type: 'SET_ENGAGEMENT_CONTROLS',
      payload: { commentMode: 'followers', enableGifts: false },
    });

    expect(next.engagementControls.commentMode).toBe('followers');
    expect(next.engagementControls.enableGifts).toBe(false);
    expect(next.engagementControls.enableComments).toBe(true);
    expect(next.engagementControls.enableSaves).toBe(true);
    expect(next.isDirty).toBe(true);
  });

  test('SET_COMMERCIAL_SETTINGS stores disclosure, brand partner, ad auth, and affiliate fields', () => {
    const next = reducer(initialState, {
      type: 'SET_COMMERCIAL_SETTINGS',
      payload: {
        disclosureType: 'paid_partnership',
        brandPartnerName: 'Nova Audio',
        adAuthorizationCode: 'ARV-XY12-90AB',
        allowPartnerPromotion: true,
        promoCode: 'NOVA20',
      },
    });

    expect(next.commercialSettings.disclosureType).toBe('paid_partnership');
    expect(next.commercialSettings.brandPartnerName).toBe('Nova Audio');
    expect(next.commercialSettings.adAuthorizationCode).toBe('ARV-XY12-90AB');
    expect(next.commercialSettings.allowPartnerPromotion).toBe(true);
    expect(next.commercialSettings.promoCode).toBe('NOVA20');
    expect(next.commercialSettings.ctaLabel).toBe('Learn More');
    expect(next.isDirty).toBe(true);
  });

  test('SET_CREATOR_PROGRAMS toggles creator revenue/affiliate/sponsorship flags', () => {
    const next = reducer(initialState, {
      type: 'SET_CREATOR_PROGRAMS',
      payload: {
        eligible: true,
        enableAdRevenueShare: true,
        enableAffiliateTracking: true,
      },
    });

    expect(next.creatorPrograms.eligible).toBe(true);
    expect(next.creatorPrograms.enableAdRevenueShare).toBe(true);
    expect(next.creatorPrograms.enableAffiliateTracking).toBe(true);
    expect(next.creatorPrograms.enableGiftsForPost).toBe(true);
    expect(next.isDirty).toBe(true);
  });

  test('SET_PROMOTION_INTENT configures ad handoff intent while preserving original post flag', () => {
    const next = reducer(initialState, {
      type: 'SET_PROMOTION_INTENT',
      payload: {
        enabled: true,
        promotionKind: 'spark_video',
        objective: 'conversions',
        placements: ['home', 'sparks'],
        dailyBudgetCents: 2500,
        durationDays: 14,
      },
    });

    expect(next.promotionIntent.enabled).toBe(true);
    expect(next.promotionIntent.promotionKind).toBe('spark_video');
    expect(next.promotionIntent.preservesOriginalPost).toBe(true);
    expect(next.promotionIntent.objective).toBe('conversions');
    expect(next.promotionIntent.placements).toEqual(['home', 'sparks']);
    expect(next.promotionIntent.dailyBudgetCents).toBe(2500);
    expect(next.promotionIntent.durationDays).toBe(14);
    expect(next.isDirty).toBe(true);
  });

  test('SET_SAFETY_ACCESSIBILITY updates warning, age rating, captions, and translation flags', () => {
    const next = reducer(initialState, {
      type: 'SET_SAFETY_ACCESSIBILITY',
      payload: {
        contentWarning: 'Flashing lights',
        isSensitiveMedia: true,
        ageRating: '18+',
        captionsText: 'Auto-captioned intro',
      },
    });

    expect(next.safetyAccessibility.contentWarning).toBe('Flashing lights');
    expect(next.safetyAccessibility.isSensitiveMedia).toBe(true);
    expect(next.safetyAccessibility.ageRating).toBe('18+');
    expect(next.safetyAccessibility.captionsText).toBe('Auto-captioned intro');
    expect(next.safetyAccessibility.copyrightConfirmed).toBe(true);
    expect(next.isDirty).toBe(true);
  });

  test('SET_LIFECYCLE_SETTINGS updates expiry and follower notification preferences', () => {
    const next = reducer(initialState, {
      type: 'SET_LIFECYCLE_SETTINGS',
      payload: {
        expiresAt: '2030-05-01T00:00:00.000Z',
        notifyFollowers: false,
        priorityAlert: true,
      },
    });

    expect(next.lifecycleSettings.expiresAt).toBe('2030-05-01T00:00:00.000Z');
    expect(next.lifecycleSettings.notifyFollowers).toBe(false);
    expect(next.lifecycleSettings.priorityAlert).toBe(true);
    expect(next.isDirty).toBe(true);
  });

  test('LOAD_DRAFT merges partial control-center slices with initial defaults', () => {
    const loaded = reducer(initialState, {
      type: 'LOAD_DRAFT',
      payload: {
        postType: 'text',
        content: 'Sponsored announcement',
        draftId: 'draft_cc_1',
        identityMeta: { publishAs: 'page' },
        distributionSettings: { category: 'music' },
        engagementControls: { commentMode: 'friends' },
        commercialSettings: { disclosureType: 'sponsored', brandPartnerName: 'Acme' },
        creatorPrograms: { enableAdRevenueShare: true },
        promotionIntent: { enabled: true, dailyBudgetCents: 5000 },
        safetyAccessibility: { ageRating: '16+' },
        lifecycleSettings: { notifyFollowers: false },
      },
    });

    expect(loaded.identityMeta).toEqual({
      publishAs: 'page',
      collaborators: [],
      communityDestinationId: null,
    });
    expect(loaded.distributionSettings.category).toBe('music');
    expect(loaded.distributionSettings.allowDiscovery).toBe(true);
    expect(loaded.engagementControls.commentMode).toBe('friends');
    expect(loaded.engagementControls.enableReactions).toBe(true);
    expect(loaded.commercialSettings.disclosureType).toBe('sponsored');
    expect(loaded.commercialSettings.brandPartnerName).toBe('Acme');
    expect(loaded.commercialSettings.ctaLabel).toBe('Learn More');
    expect(loaded.creatorPrograms.enableAdRevenueShare).toBe(true);
    expect(loaded.creatorPrograms.enableGiftsForPost).toBe(true);
    expect(loaded.promotionIntent.enabled).toBe(true);
    expect(loaded.promotionIntent.preservesOriginalPost).toBe(true);
    expect(loaded.safetyAccessibility.ageRating).toBe('16+');
    expect(loaded.safetyAccessibility.copyrightConfirmed).toBe(true);
    expect(loaded.lifecycleSettings.notifyFollowers).toBe(false);
    expect(loaded.isDraftLoaded).toBe(true);
  });
});
