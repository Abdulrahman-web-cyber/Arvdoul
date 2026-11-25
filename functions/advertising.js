// functions/advertising.js — Server-authoritative Advertising Center & Ad Delivery Ledger
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('./logger');
const { getUserIdFromContext, assertAdmin } = require('./auth');
const { checkRateLimit } = require('./rateLimit');
const { writeAudit } = require('./admin');

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const VALID_PROMOTION_KINDS = new Set([
  'post',
  'profile',
  'website',
  'product',
  'event',
  'spark_video',
]);

const VALID_OBJECTIVES = new Set([
  'reach',
  'impressions',
  'engagement',
  'profile_visits',
  'clicks',
  'conversions',
]);

const VALID_PLACEMENTS = new Set(['home', 'sparks', 'explore', 'search']);
const VALID_BUDGET_TYPES = new Set(['daily', 'lifetime']);
const VALID_CAMPAIGN_STATUSES = new Set([
  'draft',
  'pending_review',
  'active',
  'paused',
  'rejected',
  'completed',
  'ended',
]);

const cleanText = (val, maxLen = 200) => {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
};

const safeCurrency = (val) => {
  const c = String(val || 'USD').trim().toUpperCase().slice(0, 6);
  return /^[A-Z]{3}$/.test(c) ? c : 'USD';
};

const toIsoOrNull = (val) => {
  if (!val) return null;
  if (typeof val?.toDate === 'function') return val.toDate().toISOString();
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const getDateKey = (date = new Date()) => {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

async function resolveMutualBlockedIds(uid) {
  const blocked = new Set();
  if (!uid) return blocked;
  const [outgoingSnap, incomingSnap] = await Promise.all([
    db.collection('blocks').where('blockerId', '==', uid).limit(200).get(),
    db.collection('blocks').where('blockedId', '==', uid).limit(200).get(),
  ]);
  outgoingSnap.forEach((docSnap) => {
    const id = docSnap.data()?.blockedId;
    if (id) blocked.add(id);
  });
  incomingSnap.forEach((docSnap) => {
    const id = docSnap.data()?.blockerId;
    if (id) blocked.add(id);
  });
  return blocked;
}

exports.getOrCreateAdAccount = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'getOrCreateAdAccount', 60, 60000);

  const accountRef = db.collection('ad_accounts').doc(uid);
  const currency = safeCurrency(data?.currency || 'USD');

  const account = await db.runTransaction(async (t) => {
    const snap = await t.get(accountRef);
    if (snap.exists) {
      return { id: snap.id, ...snap.data() };
    }
    const fresh = {
      ownerId: uid,
      currency,
      balanceCents: 0,
      reservedCents: 0,
      lifetimeSpendCents: 0,
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    t.set(accountRef, fresh);
    return { id: uid, ...fresh };
  });

  return {
    success: true,
    account: {
      ...account,
      createdAt: toIsoOrNull(account.createdAt),
      updatedAt: toIsoOrNull(account.updatedAt),
    },
  };
});

exports.fundAdAccount = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'fundAdAccount', 10, 60000);

  const amountCents = Number(data?.amountCents);
  if (!Number.isInteger(amountCents) || amountCents < 100 || amountCents > 50_000_000) {
    throw new functions.https.HttpsError('invalid-argument', 'amountCents must be an integer between 100 ($1) and 50,000,000.');
  }
  const currency = safeCurrency(data?.currency || 'USD');
  const paymentReference = cleanText(data?.paymentReference || '', 120);
  const idempotencyKey = typeof data?.idempotencyKey === 'string' && data.idempotencyKey.trim()
    ? data.idempotencyKey.trim()
    : uuidv4();

  const ledgerRef = db.collection('idempotency_ledger').doc(`ad_fund_${idempotencyKey}`);
  const accountRef = db.collection('ad_accounts').doc(uid);

  const result = await db.runTransaction(async (t) => {
    const ledgerSnap = await t.get(ledgerRef);
    if (ledgerSnap.exists) {
      if (ledgerSnap.data().userId !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'Idempotency key belongs to another user.');
      }
      return ledgerSnap.data().result;
    }

    const accSnap = await t.get(accountRef);
    const existing = accSnap.exists
      ? accSnap.data()
      : {
          ownerId: uid,
          currency,
          balanceCents: 0,
          reservedCents: 0,
          lifetimeSpendCents: 0,
          status: 'active',
          createdAt: FieldValue.serverTimestamp(),
        };

    const newBalanceCents = Number(existing.balanceCents || 0) + amountCents;
    t.set(accountRef, {
      ...existing,
      ownerId: uid,
      currency: existing.currency || currency,
      balanceCents: newBalanceCents,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    const entryRef = db.collection('ad_billing_ledger').doc();
    t.set(entryRef, {
      advertiserId: uid,
      campaignId: null,
      type: 'deposit',
      amountCents,
      currency: existing.currency || currency,
      balanceAfterCents: newBalanceCents,
      paymentReference: paymentReference || `direct_${entryRef.id}`,
      idempotencyKey,
      createdAt: FieldValue.serverTimestamp(),
    });

    const out = {
      success: true,
      balanceCents: newBalanceCents,
      entryId: entryRef.id,
      currency: existing.currency || currency,
    };

    t.set(ledgerRef, {
      function: 'fundAdAccount',
      userId: uid,
      result: out,
      processedAt: FieldValue.serverTimestamp(),
      expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return out;
  });

  logger.info('Ad account funded', { uid, amountCents, entryId: result.entryId });
  return result;
});

exports.createAdCampaign = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'createAdCampaign', 20, 60000);

  const promotionKind = VALID_PROMOTION_KINDS.has(data?.promotionKind) ? data.promotionKind : 'post';
  const objective = VALID_OBJECTIVES.has(data?.objective) ? data.objective : 'reach';
  const budgetType = VALID_BUDGET_TYPES.has(data?.budgetType) ? data.budgetType : 'daily';
  const budgetCents = Number(data?.budgetCents);
  if (!Number.isInteger(budgetCents) || budgetCents < 100 || budgetCents > 50_000_000) {
    throw new functions.https.HttpsError('invalid-argument', 'budgetCents must be an integer >= 100.');
  }

  const currency = safeCurrency(data?.currency || 'USD');
  const title = cleanText(data?.title || 'Untitled Campaign', 160);
  const placementsRaw = Array.isArray(data?.placements) ? data.placements : ['home'];
  const placements = [...new Set(placementsRaw.filter((p) => VALID_PLACEMENTS.has(p)))];
  if (placements.length === 0) placements.push('home');

  const sourcePostId = typeof data?.sourcePostId === 'string' && data.sourcePostId.trim()
    ? data.sourcePostId.trim()
    : null;
  const providedAuthCode = cleanText(data?.adAuthorizationCode || '', 64);

  let partnerCreatorId = null;
  let adAuthorizationId = null;
  let sourcePostSnapshot = null;

  // Spark / Post-preserve model: link existing post without creating a duplicate organic post.
  if (sourcePostId) {
    const postRef = db.collection('posts').doc(sourcePostId);
    const postSnap = await postRef.get();
    if (!postSnap.exists || postSnap.data()?.isDeleted === true) {
      throw new functions.https.HttpsError('not-found', 'Source post not found or deleted.');
    }
    const postData = postSnap.data();
    sourcePostSnapshot = {
      type: postData.type || 'text',
      contentPreview: cleanText(postData.content || '', 280),
      thumbnailUrl: postData.thumbnailUrl || postData.mediaUrl || null,
      authorId: postData.authorId,
      authorName: postData.authorName || null,
    };

    if (postData.authorId !== uid) {
      // Must verify active, unrevoked, non-expired ad authorization
      let matchedAuth = null;
      if (providedAuthCode) {
        const byCode = await db.collection('ad_authorizations')
          .where('postId', '==', sourcePostId)
          .where('authCode', '==', providedAuthCode)
          .where('status', '==', 'active')
          .limit(1)
          .get();
        if (!byCode.empty) matchedAuth = byCode.docs[0];
      } else {
        const byPartner = await db.collection('ad_authorizations')
          .where('partnerId', '==', uid)
          .where('status', '==', 'active')
          .limit(50)
          .get();
        matchedAuth = byPartner.docs.find((d) => d.data()?.postId === sourcePostId) || null;
      }

      if (!matchedAuth) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Promoting another creator’s post requires an active ad authorization code.'
        );
      }
      const authData = matchedAuth.data();
      if (authData.partnerId && authData.partnerId !== uid) {
        throw new functions.https.HttpsError('permission-denied', 'This authorization code is scoped to another partner.');
      }
      const expMs = authData.expiresAt?.toMillis?.() || (authData.expiresAt ? new Date(authData.expiresAt).getTime() : 0);
      if (expMs && expMs <= Date.now()) {
        throw new functions.https.HttpsError('failed-precondition', 'Ad authorization has expired.');
      }
      adAuthorizationId = matchedAuth.id;
      partnerCreatorId = postData.authorId;
    }
  }

  const startDate = toIsoOrNull(data?.startDate) || new Date().toISOString();
  const durationDays = Math.max(1, Math.min(Number(data?.durationDays) || 7, 90));
  const endDate = toIsoOrNull(data?.endDate) || new Date(new Date(startDate).getTime() + durationDays * 86400000).toISOString();

  const targeting = {
    locations: Array.isArray(data?.targeting?.locations) ? data.targeting.locations.slice(0, 20).map((s) => cleanText(s, 80)).filter(Boolean) : ['Global'],
    ageMin: Math.max(13, Math.min(Number(data?.targeting?.ageMin) || 18, 65)),
    ageMax: Math.max(18, Math.min(Number(data?.targeting?.ageMax) || 65, 99)),
    interests: Array.isArray(data?.targeting?.interests) ? data.targeting.interests.slice(0, 20).map((s) => cleanText(s, 60)).filter(Boolean) : [],
    languages: Array.isArray(data?.targeting?.languages) ? data.targeting.languages.slice(0, 10).map((s) => cleanText(s, 20)).filter(Boolean) : ['en'],
  };

  const submitNow = data?.submitForReview === true;
  const campaignRef = db.collection('ad_campaigns').doc();
  const creativeRef = db.collection('ad_creatives').doc();

  const campaignPayload = {
    advertiserId: uid,
    partnerCreatorId: partnerCreatorId || null,
    adAuthorizationId: adAuthorizationId || null,
    sourcePostId: sourcePostId || null,
    preservesOriginalPost: Boolean(sourcePostId),
    promotionKind,
    objective,
    title,
    budgetType,
    budgetCents,
    spentCents: 0,
    currency,
    bidCapCents: Number.isInteger(Number(data?.bidCapCents)) ? Math.max(10, Number(data.bidCapCents)) : 150,
    dailyFrequencyCap: Math.max(1, Math.min(Number(data?.dailyFrequencyCap) || 3, 20)),
    placements,
    targeting,
    startDate,
    endDate,
    durationDays,
    status: submitNow ? 'pending_review' : 'draft',
    reviewStatus: submitNow ? 'pending_review' : 'not_submitted',
    metrics: { impressions: 0, reach: 0, clicks: 0, conversions: 0, spendCents: 0 },
    creativeId: creativeRef.id,
    sourcePostSnapshot,
    destinationUrl: cleanText(data?.destinationUrl || '', 1000),
    ctaLabel: cleanText(data?.ctaLabel || 'Learn More', 48),
    complianceNotes: cleanText(data?.complianceNotes || '', 500),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const creativePayload = {
    campaignId: campaignRef.id,
    advertiserId: uid,
    sourcePostId: sourcePostId || null,
    headline: cleanText(data?.headline || title, 160),
    body: cleanText(data?.body || sourcePostSnapshot?.contentPreview || '', 1000),
    ctaLabel: cleanText(data?.ctaLabel || 'Learn More', 48),
    destinationUrl: cleanText(data?.destinationUrl || '', 1000),
    mediaUrl: cleanText(data?.mediaUrl || sourcePostSnapshot?.thumbnailUrl || '', 1000),
    disclosureType: data?.disclosureType === 'paid_partnership'
      ? 'paid_partnership'
      : data?.disclosureType === 'own_promotion'
        ? 'own_promotion'
        : 'sponsored_ad',
    status: 'draft',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  const batch = db.batch();
  batch.set(campaignRef, campaignPayload);
  batch.set(creativeRef, creativePayload);

  if (submitNow) {
    const reviewRef = db.collection('ad_reviews').doc();
    batch.set(reviewRef, {
      campaignId: campaignRef.id,
      advertiserId: uid,
      sourcePostId: sourcePostId || null,
      status: 'pending_review',
      notes: campaignPayload.complianceNotes || '',
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  if (sourcePostId) {
    batch.update(db.collection('posts').doc(sourcePostId), {
      adCampaignId: campaignRef.id,
      adReviewStatus: submitNow ? 'pending_review' : 'none',
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();

  return {
    success: true,
    campaignId: campaignRef.id,
    creativeId: creativeRef.id,
    status: campaignPayload.status,
    reviewStatus: campaignPayload.reviewStatus,
  };
});

exports.updateAdCampaign = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'updateAdCampaign', 30, 60000);

  const { campaignId, updates = {} } = data || {};
  if (!campaignId || typeof campaignId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'campaignId is required.');
  }

  const ref = db.collection('ad_campaigns').doc(campaignId);
  const snap = await ref.get();
  if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Campaign not found.');
  const existing = snap.data();
  if (existing.advertiserId !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'Only the campaign owner can update it.');
  }

  const safeUpdates = { updatedAt: FieldValue.serverTimestamp() };
  if (typeof updates.title === 'string') safeUpdates.title = cleanText(updates.title, 160);
  if (VALID_OBJECTIVES.has(updates.objective)) safeUpdates.objective = updates.objective;
  if (VALID_BUDGET_TYPES.has(updates.budgetType)) safeUpdates.budgetType = updates.budgetType;
  if (Number.isInteger(Number(updates.budgetCents)) && Number(updates.budgetCents) >= 100) {
    safeUpdates.budgetCents = Number(updates.budgetCents);
  }
  if (Array.isArray(updates.placements)) {
    const cleanPlacements = [...new Set(updates.placements.filter((p) => VALID_PLACEMENTS.has(p)))];
    if (cleanPlacements.length > 0) safeUpdates.placements = cleanPlacements;
  }
  if (updates.targeting && typeof updates.targeting === 'object') {
    safeUpdates.targeting = updates.targeting;
  }
  if (typeof updates.destinationUrl === 'string') safeUpdates.destinationUrl = cleanText(updates.destinationUrl, 1000);
  if (typeof updates.ctaLabel === 'string') safeUpdates.ctaLabel = cleanText(updates.ctaLabel, 48);

  await ref.update(safeUpdates);
  return { success: true, campaignId };
});

exports.setAdCampaignStatus = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'setAdCampaignStatus', 30, 60000);

  const { campaignId, status } = data || {};
  if (!campaignId || !VALID_CAMPAIGN_STATUSES.has(status)) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid campaignId and status are required.');
  }

  const ref = db.collection('ad_campaigns').doc(campaignId);
  const snap = await ref.get();
  if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Campaign not found.');
  const campaign = snap.data();
  if (campaign.advertiserId !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'Only the advertiser can change campaign status.');
  }

  if (status === 'active') {
    if (campaign.reviewStatus !== 'approved') {
      throw new functions.https.HttpsError('failed-precondition', 'Campaign must pass ad review before activation.');
    }
    const accSnap = await db.collection('ad_accounts').doc(uid).get();
    const balance = accSnap.exists ? Number(accSnap.data()?.balanceCents || 0) : 0;
    if (balance < 100) {
      throw new functions.https.HttpsError('failed-precondition', 'Ad account balance is insufficient to activate delivery.');
    }
  }

  await ref.update({
    status,
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (campaign.creativeId) {
    await db.collection('ad_creatives').doc(campaign.creativeId).update({
      status: status === 'active' ? 'active' : status === 'ended' || status === 'completed' ? 'archived' : 'draft',
      updatedAt: FieldValue.serverTimestamp(),
    }).catch((err) => logger.warn('Creative status sync skipped', { error: err?.message }));
  }

  return { success: true, campaignId, status };
});

exports.submitAdCampaignForReview = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'submitAdCampaignForReview', 20, 60000);

  const { campaignId, complianceNotes = '' } = data || {};
  if (!campaignId) throw new functions.https.HttpsError('invalid-argument', 'campaignId is required.');

  const ref = db.collection('ad_campaigns').doc(campaignId);
  const snap = await ref.get();
  if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Campaign not found.');
  const campaign = snap.data();
  if (campaign.advertiserId !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'Only the campaign owner can submit for review.');
  }

  const batch = db.batch();
  batch.update(ref, {
    status: 'pending_review',
    reviewStatus: 'pending_review',
    complianceNotes: cleanText(complianceNotes, 500) || campaign.complianceNotes || '',
    updatedAt: FieldValue.serverTimestamp(),
  });
  const reviewRef = db.collection('ad_reviews').doc();
  batch.set(reviewRef, {
    campaignId,
    advertiserId: uid,
    sourcePostId: campaign.sourcePostId || null,
    status: 'pending_review',
    notes: cleanText(complianceNotes, 500),
    createdAt: FieldValue.serverTimestamp(),
  });
  if (campaign.sourcePostId) {
    batch.update(db.collection('posts').doc(campaign.sourcePostId), {
      adReviewStatus: 'pending_review',
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();

  return { success: true, campaignId, reviewId: reviewRef.id, status: 'pending_review' };
});

exports.listAdCampaigns = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'listAdCampaigns', 60, 60000);

  const limitCount = Math.min(Math.max(Number(data?.limit) || 50, 1), 100);
  const snap = await db.collection('ad_campaigns')
    .where('advertiserId', '==', uid)
    .orderBy('createdAt', 'desc')
    .limit(limitCount)
    .get();

  const campaigns = snap.docs.map((d) => {
    const c = d.data();
    return {
      id: d.id,
      ...c,
      createdAt: toIsoOrNull(c.createdAt),
      updatedAt: toIsoOrNull(c.updatedAt),
    };
  });

  return { success: true, campaigns };
});

exports.listAdModerationQueue = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'listAdModerationQueue', 60, 60000);

  const statusFilter = typeof data?.status === 'string' ? data.status : 'pending_review';
  const [reviewsSnap, disputesSnap] = await Promise.all([
    db.collection('ad_reviews').where('status', '==', statusFilter).orderBy('createdAt', 'desc').limit(50).get(),
    db.collection('ad_disputes').where('status', '==', 'open').orderBy('createdAt', 'desc').limit(50).get(),
  ]);

  const campaignIds = [...new Set(reviewsSnap.docs.map((d) => d.data().campaignId).filter(Boolean))];
  const campaignById = Object.create(null);
  if (campaignIds.length > 0) {
    const refs = campaignIds.slice(0, 30).map((id) => db.collection('ad_campaigns').doc(id));
    const snaps = await db.getAll(...refs);
    snaps.forEach((s) => {
      if (s.exists) campaignById[s.id] = { id: s.id, ...s.data(), createdAt: toIsoOrNull(s.data().createdAt) };
    });
  }

  return {
    success: true,
    reviews: reviewsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      campaign: campaignById[d.data().campaignId] || null,
      createdAt: toIsoOrNull(d.data().createdAt),
    })),
    disputes: disputesSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: toIsoOrNull(d.data().createdAt),
    })),
  };
});

exports.reviewAdCampaign = functions.https.onCall(async (data, context) => {
  const adminUid = await assertAdmin(context);
  await checkRateLimit(adminUid, 'reviewAdCampaign', 60, 60000);

  const { campaignId, reviewId, decision, notes = '' } = data || {};
  if (!campaignId || (decision !== 'approved' && decision !== 'rejected')) {
    throw new functions.https.HttpsError('invalid-argument', 'campaignId and decision (approved|rejected) required.');
  }

  const campaignRef = db.collection('ad_campaigns').doc(campaignId);
  const snap = await campaignRef.get();
  if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Campaign not found.');
  const campaign = snap.data();

  const accSnap = await db.collection('ad_accounts').doc(campaign.advertiserId).get();
  const hasBalance = accSnap.exists && Number(accSnap.data()?.balanceCents || 0) >= 100;
  const nextCampaignStatus = decision === 'approved' ? (hasBalance ? 'active' : 'paused') : 'rejected';

  const batch = db.batch();
  batch.update(campaignRef, {
    status: nextCampaignStatus,
    reviewStatus: decision,
    reviewNotes: cleanText(notes, 500),
    reviewedBy: adminUid,
    reviewedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (reviewId) {
    batch.update(db.collection('ad_reviews').doc(reviewId), {
      status: decision,
      notes: cleanText(notes, 500),
      reviewedBy: adminUid,
      reviewedAt: FieldValue.serverTimestamp(),
    });
  }
  if (campaign.sourcePostId) {
    batch.update(db.collection('posts').doc(campaign.sourcePostId), {
      adReviewStatus: decision,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  if (campaign.creativeId) {
    batch.update(db.collection('ad_creatives').doc(campaign.creativeId), {
      status: nextCampaignStatus === 'active' ? 'active' : 'draft',
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();

  await writeAudit(
    adminUid,
    `ad_campaign_${decision}`,
    campaignId,
    { advertiserId: campaign.advertiserId, notes: cleanText(notes, 300), nextCampaignStatus },
    'ad_campaign'
  );

  return { success: true, campaignId, decision, status: nextCampaignStatus };
});

exports.getAdBillingLedger = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'getAdBillingLedger', 60, 60000);

  const [accSnap, entriesSnap, disputesSnap] = await Promise.all([
    db.collection('ad_accounts').doc(uid).get(),
    db.collection('ad_billing_ledger')
      .where('advertiserId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(Math.min(Math.max(Number(data?.limit) || 50, 1), 100))
      .get(),
    db.collection('ad_disputes')
      .where('advertiserId', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(25)
      .get(),
  ]);

  return {
    success: true,
    account: accSnap.exists ? { id: accSnap.id, ...accSnap.data(), createdAt: toIsoOrNull(accSnap.data().createdAt) } : null,
    entries: entriesSnap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toIsoOrNull(d.data().createdAt) })),
    disputes: disputesSnap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toIsoOrNull(d.data().createdAt) })),
  };
});

exports.requestAdRefundOrDispute = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'requestAdRefundOrDispute', 10, 60000);

  const { campaignId = null, reason, requestedAmountCents } = data || {};
  const cleanReason = cleanText(reason || '', 500);
  const amount = Number(requestedAmountCents);
  if (!cleanReason || !Number.isInteger(amount) || amount < 100) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid reason and requestedAmountCents (>= 100) are required.');
  }

  if (campaignId) {
    const campSnap = await db.collection('ad_campaigns').doc(campaignId).get();
    if (!campSnap.exists || campSnap.data()?.advertiserId !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'Campaign does not belong to your ad account.');
    }
  }

  const ref = await db.collection('ad_disputes').add({
    advertiserId: uid,
    campaignId,
    reason: cleanReason,
    requestedAmountCents: amount,
    status: 'open',
    createdAt: FieldValue.serverTimestamp(),
  });

  return { success: true, disputeId: ref.id, status: 'open' };
});

exports.adminResolveAdDispute = functions.https.onCall(async (data, context) => {
  const adminUid = await assertAdmin(context);
  await checkRateLimit(adminUid, 'adminResolveAdDispute', 30, 60000);

  const { disputeId, decision, resolutionNotes = '' } = data || {};
  if (!disputeId || (decision !== 'approved' && decision !== 'rejected')) {
    throw new functions.https.HttpsError('invalid-argument', 'disputeId and decision (approved|rejected) required.');
  }

  const disputeRef = db.collection('ad_disputes').doc(disputeId);
  const idempotencyRef = db.collection('idempotency_ledger').doc(`dispute_${disputeId}_${decision}`);

  const res = await db.runTransaction(async (t) => {
    const idemSnap = await t.get(idempotencyRef);
    if (idemSnap.exists) {
      if (idemSnap.data().userId !== adminUid) {
        throw new functions.https.HttpsError('permission-denied', 'Idempotency key belongs to another admin.');
      }
      return idemSnap.data().result;
    }

    const dSnap = await t.get(disputeRef);
    if (!dSnap.exists) throw new functions.https.HttpsError('not-found', 'Dispute not found.');
    const dispute = dSnap.data();
    if (dispute.status !== 'open') {
      throw new functions.https.HttpsError('failed-precondition', 'Dispute has already been resolved.');
    }

    const refundAmount = decision === 'approved' ? Number(dispute.requestedAmountCents || 0) : 0;
    let newBalanceCents = null;

    if (decision === 'approved' && refundAmount > 0) {
      const accRef = db.collection('ad_accounts').doc(dispute.advertiserId);
      const accSnap = await t.get(accRef);
      const currentBal = accSnap.exists ? Number(accSnap.data()?.balanceCents || 0) : 0;
      newBalanceCents = currentBal + refundAmount;
      t.set(accRef, {
        ownerId: dispute.advertiserId,
        balanceCents: newBalanceCents,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      const entryRef = db.collection('ad_billing_ledger').doc();
      t.set(entryRef, {
        advertiserId: dispute.advertiserId,
        campaignId: dispute.campaignId || null,
        type: 'refund',
        amountCents: refundAmount,
        currency: accSnap.exists ? (accSnap.data()?.currency || 'USD') : 'USD',
        balanceAfterCents: newBalanceCents,
        disputeId,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    t.update(disputeRef, {
      status: decision,
      resolutionNotes: cleanText(resolutionNotes, 500),
      resolvedBy: adminUid,
      resolvedAt: FieldValue.serverTimestamp(),
    });

    const out = { success: true, disputeId, decision, refundAmount, newBalanceCents };
    t.set(idempotencyRef, {
      function: 'adminResolveAdDispute',
      userId: adminUid,
      result: out,
      processedAt: FieldValue.serverTimestamp(),
      expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    return out;
  });

  await writeAudit(
    adminUid,
    `ad_dispute_${decision}`,
    disputeId,
    { refundAmount: res.refundAmount, resolutionNotes: cleanText(resolutionNotes, 300) },
    'ad_dispute'
  );

  return res;
});

exports.getAdCampaignAnalytics = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'getAdCampaignAnalytics', 60, 60000);

  const { campaignId } = data || {};
  if (!campaignId) throw new functions.https.HttpsError('invalid-argument', 'campaignId is required.');

  const campSnap = await db.collection('ad_campaigns').doc(campaignId).get();
  if (!campSnap.exists) throw new functions.https.HttpsError('not-found', 'Campaign not found.');
  const campaign = campSnap.data();
  if (campaign.advertiserId !== uid && campaign.partnerCreatorId !== uid) {
    throw new functions.https.HttpsError('permission-denied', 'Access denied to campaign analytics.');
  }

  const [dailySnap, convSnap] = await Promise.all([
    db.collection('ad_daily_metrics')
      .where('campaignId', '==', campaignId)
      .orderBy('dateKey', 'desc')
      .limit(60)
      .get(),
    db.collection('ad_conversions')
      .where('campaignId', '==', campaignId)
      .limit(100)
      .get(),
  ]);

  const daily = dailySnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const metrics = campaign.metrics || { impressions: 0, reach: 0, clicks: 0, conversions: 0, spendCents: 0 };
  const ctr = metrics.impressions > 0 ? Number(((metrics.clicks / metrics.impressions) * 100).toFixed(2)) : 0;
  const cpmCents = metrics.impressions > 0 ? Math.round((metrics.spendCents / metrics.impressions) * 1000) : 0;
  const cpcCents = metrics.clicks > 0 ? Math.round(metrics.spendCents / metrics.clicks) : 0;

  return {
    success: true,
    campaign: { id: campSnap.id, ...campaign, createdAt: toIsoOrNull(campaign.createdAt) },
    summary: { ...metrics, ctr, cpmCents, cpcCents },
    daily,
    conversionsCount: convSnap.size,
  };
});

exports.recordAdDeliveryEvent = functions.https.onCall(async (data, context) => {
  const viewerId = getUserIdFromContext(context);
  await checkRateLimit(viewerId, 'recordAdDeliveryEvent', 120, 60000);

  const { campaignId, eventType = 'impression', placement = 'home', idempotencyKey } = data || {};
  if (!campaignId || !['impression', 'click'].includes(eventType)) {
    throw new functions.https.HttpsError('invalid-argument', 'Valid campaignId and eventType (impression|click) required.');
  }

  const chargeCents = eventType === 'click' ? 15 : 2;
  const dateKey = getDateKey();
  const key = typeof idempotencyKey === 'string' && idempotencyKey.trim()
    ? idempotencyKey.trim()
    : `${viewerId}_${campaignId}_${eventType}_${dateKey}`;
  const idemRef = db.collection('idempotency_ledger').doc(`ad_evt_${key}`);

  const result = await db.runTransaction(async (t) => {
    const idemSnap = await t.get(idemRef);
    if (idemSnap.exists) {
      if (idemSnap.data().userId !== viewerId) {
        throw new functions.https.HttpsError('permission-denied', 'Idempotency key belongs to another user.');
      }
      return idemSnap.data().result;
    }

    const campRef = db.collection('ad_campaigns').doc(campaignId);
    const campSnap = await t.get(campRef);
    if (!campSnap.exists) throw new functions.https.HttpsError('not-found', 'Campaign not found.');
    const campaign = campSnap.data();
    if (campaign.status !== 'active' || campaign.reviewStatus !== 'approved') {
      return { success: false, counted: false, reason: 'inactive_campaign' };
    }

    const accRef = db.collection('ad_accounts').doc(campaign.advertiserId);
    const accSnap = await t.get(accRef);
    const currentBal = accSnap.exists ? Number(accSnap.data()?.balanceCents || 0) : 0;
    const remainingBudget = Number(campaign.budgetCents || 0) - Number(campaign.spentCents || 0);
    const effectiveCharge = currentBal >= chargeCents && remainingBudget >= chargeCents ? chargeCents : 0;

    if (effectiveCharge > 0) {
      const nextBal = currentBal - effectiveCharge;
      t.update(accRef, {
        balanceCents: nextBal,
        lifetimeSpendCents: FieldValue.increment(effectiveCharge),
        updatedAt: FieldValue.serverTimestamp(),
      });
      const billRef = db.collection('ad_billing_ledger').doc();
      t.set(billRef, {
        advertiserId: campaign.advertiserId,
        campaignId,
        type: 'spend',
        amountCents: effectiveCharge,
        currency: campaign.currency || 'USD',
        balanceAfterCents: nextBal,
        eventType,
        placement,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    const metricUpdates = {
      spentCents: FieldValue.increment(effectiveCharge),
      'metrics.spendCents': FieldValue.increment(effectiveCharge),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (eventType === 'impression') {
      metricUpdates['metrics.impressions'] = FieldValue.increment(1);
      metricUpdates['metrics.reach'] = FieldValue.increment(1);
    } else {
      metricUpdates['metrics.clicks'] = FieldValue.increment(1);
    }
    if (remainingBudget - effectiveCharge <= 0) {
      metricUpdates.status = 'completed';
    }
    t.update(campRef, metricUpdates);

    const dailyRef = db.collection('ad_daily_metrics').doc(`${campaignId}_${dateKey}`);
    t.set(dailyRef, {
      campaignId,
      advertiserId: campaign.advertiserId,
      partnerCreatorId: campaign.partnerCreatorId || null,
      sourcePostId: campaign.sourcePostId || null,
      dateKey,
      impressions: FieldValue.increment(eventType === 'impression' ? 1 : 0),
      reach: FieldValue.increment(eventType === 'impression' ? 1 : 0),
      clicks: FieldValue.increment(eventType === 'click' ? 1 : 0),
      conversions: FieldValue.increment(0),
      spendCents: FieldValue.increment(effectiveCharge),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    if (campaign.sourcePostId) {
      t.update(db.collection('posts').doc(campaign.sourcePostId), {
        'paidStats.impressions': FieldValue.increment(eventType === 'impression' ? 1 : 0),
        'paidStats.clicks': FieldValue.increment(eventType === 'click' ? 1 : 0),
        'paidStats.spendCents': FieldValue.increment(effectiveCharge),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const out = { success: true, counted: true, chargedCents: effectiveCharge };
    t.set(idemRef, {
      function: 'recordAdDeliveryEvent',
      userId: viewerId,
      result: out,
      processedAt: FieldValue.serverTimestamp(),
      expireAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    return out;
  });

  return result;
});

exports.trackAdConversion = functions.https.onCall(async (data, context) => {
  const viewerId = getUserIdFromContext(context);
  await checkRateLimit(viewerId, 'trackAdConversion', 60, 60000);

  const { campaignId, eventType = 'click', valueCents = 0 } = data || {};
  if (!campaignId) throw new functions.https.HttpsError('invalid-argument', 'campaignId is required.');

  const campRef = db.collection('ad_campaigns').doc(campaignId);
  const campSnap = await campRef.get();
  if (!campSnap.exists) throw new functions.https.HttpsError('not-found', 'Campaign not found.');
  const campaign = campSnap.data();

  const dateKey = getDateKey();
  const convRef = db.collection('ad_conversions').doc();
  const batch = db.batch();
  batch.set(convRef, {
    campaignId,
    advertiserId: campaign.advertiserId,
    sourcePostId: campaign.sourcePostId || null,
    viewerId,
    eventType: cleanText(eventType, 32) || 'click',
    valueCents: Math.max(0, Number(valueCents) || 0),
    createdAt: FieldValue.serverTimestamp(),
  });
  batch.update(campRef, {
    'metrics.conversions': FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(db.collection('ad_daily_metrics').doc(`${campaignId}_${dateKey}`), {
    campaignId,
    advertiserId: campaign.advertiserId,
    sourcePostId: campaign.sourcePostId || null,
    dateKey,
    conversions: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  if (campaign.sourcePostId) {
    batch.update(db.collection('posts').doc(campaign.sourcePostId), {
      'paidStats.conversions': FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();

  return { success: true, conversionId: convRef.id };
});

exports.getEligibleFeedAds = functions.https.onCall(async (data, context) => {
  const viewerId = getUserIdFromContext(context);
  await checkRateLimit(viewerId, 'getEligibleFeedAds', 60, 60000);

  const placement = VALID_PLACEMENTS.has(data?.placement) ? data.placement : 'home';
  const limitCount = Math.min(Math.max(Number(data?.limit) || 5, 1), 15);
  const nowIso = new Date().toISOString();

  const [blockedIds, snap] = await Promise.all([
    resolveMutualBlockedIds(viewerId),
    db.collection('ad_campaigns')
      .where('status', '==', 'active')
      .where('reviewStatus', '==', 'approved')
      .orderBy('createdAt', 'desc')
      .limit(30)
      .get(),
  ]);

  const ads = [];
  for (const docSnap of snap.docs) {
    const c = docSnap.data();
    if (blockedIds.has(c.advertiserId) || (c.partnerCreatorId && blockedIds.has(c.partnerCreatorId))) continue;
    if (Array.isArray(c.placements) && !c.placements.includes(placement)) continue;
    if (c.endDate && c.endDate < nowIso) continue;
    if (Number(c.spentCents || 0) >= Number(c.budgetCents || 0)) continue;

    ads.push({
      id: docSnap.id,
      campaignId: docSnap.id,
      advertiserId: c.advertiserId,
      partnerCreatorId: c.partnerCreatorId || null,
      sourcePostId: c.sourcePostId || null,
      promotionKind: c.promotionKind,
      title: c.title,
      ctaLabel: c.ctaLabel || 'Learn More',
      destinationUrl: c.destinationUrl || null,
      sourcePostSnapshot: c.sourcePostSnapshot || null,
    });
    if (ads.length >= limitCount) break;
  }

  return { success: true, ads };
});
