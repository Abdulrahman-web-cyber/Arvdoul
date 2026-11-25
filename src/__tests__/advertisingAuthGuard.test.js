/**
 * Auth and ownership guard tests for Phase B Cloud Functions:
 * - functions/advertising.js
 * - functions/collaboration.js (Brand Partnerships & Ad Authorizations)
 *
 * Ensures every exported callable enforces authentication (`getUserIdFromContext`
 * or `assertAdmin`) and enforces ownership, party, or admin authorization checks.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const advertisingSrc = fs.readFileSync(path.join(root, 'functions', 'advertising.js'), 'utf8');
const collaborationSrc = fs.readFileSync(path.join(root, 'functions', 'collaboration.js'), 'utf8');

function extractCallables(src) {
  const regex = /exports\.(\w+)\s*=\s*functions\.https\.onCall\s*\(/g;
  const matches = [...src.matchAll(regex)];
  return matches.map((m, idx) => {
    const start = m.index;
    const end = idx + 1 < matches.length ? matches[idx + 1].index : src.length;
    return { name: m[1], body: src.slice(start, end) };
  });
}

describe('functions/advertising.js auth & ownership guards', () => {
  const callables = extractCallables(advertisingSrc);
  const byName = new Map(callables.map((c) => [c.name, c.body]));

  test('discovers all 16 advertising callables', () => {
    expect(callables.length).toBe(16);
  });

  test('every advertising callable enforces authentication', () => {
    const missingAuth = callables
      .filter((c) => !/(getUserIdFromContext|assertAdmin)\s*\(\s*context\s*\)/.test(c.body))
      .map((c) => c.name);
    expect(missingAuth).toEqual([]);
  });

  test('admin moderation and dispute resolution callables enforce assertAdmin', () => {
    for (const name of ['listAdModerationQueue', 'reviewAdCampaign', 'adminResolveAdDispute']) {
      expect(byName.get(name)).toMatch(/assertAdmin\s*\(\s*context\s*\)/);
    }
  });

  test('advertiser-scoped campaign mutations and analytics enforce advertiser ownership', () => {
    for (const name of [
      'updateAdCampaign',
      'setAdCampaignStatus',
      'submitAdCampaignForReview',
      'getAdCampaignAnalytics',
    ]) {
      expect(byName.get(name)).toMatch(/advertiserId\s*!==\s*uid/);
    }
  });

  test('Spark / post promotion validates source post ownership or active adAuthorizationCode', () => {
    const createBody = byName.get('createAdCampaign');
    expect(createBody).toMatch(/sourcePostId/);
    expect(createBody).toMatch(/authorId\s*!==\s*uid/);
    expect(createBody).toMatch(/ad_authorizations/);
    expect(createBody).toMatch(/adAuthorizationCode/);
  });

  test('idempotent funding and delivery events check idempotency ledger ownership', () => {
    expect(byName.get('fundAdAccount')).toMatch(/idempotency_ledger/);
    expect(byName.get('fundAdAccount')).toMatch(/userId\s*!==\s*uid/);
    expect(byName.get('recordAdDeliveryEvent')).toMatch(/idempotency_ledger/);
  });
});

describe('functions/collaboration.js brand partnerships & ad auth guards', () => {
  const callables = extractCallables(collaborationSrc);
  const byName = new Map(callables.map((c) => [c.name, c.body]));

  const phaseBCallables = [
    'createBrandPartnership',
    'respondBrandPartnership',
    'updatePartnershipDeliverable',
    'listBrandPartnerships',
    'grantAdAuthorization',
    'revokeAdAuthorization',
    'listAdAuthorizations',
    'getPartnershipAnalytics',
  ];

  test('every Phase B collaboration callable exists and checks getUserIdFromContext', () => {
    for (const name of phaseBCallables) {
      const body = byName.get(name);
      expect(body).toBeDefined();
      expect(body).toMatch(/getUserIdFromContext\s*\(\s*context\s*\)/);
    }
  });

  test('partnership mutations and analytics verify creatorId/brandId party membership', () => {
    for (const name of [
      'respondBrandPartnership',
      'updatePartnershipDeliverable',
      'getPartnershipAnalytics',
    ]) {
      const body = byName.get(name);
      expect(body).toMatch(/creatorId/);
      expect(body).toMatch(/brandId/);
      expect(body).toMatch(/permission-denied/);
    }
  });

  test('grantAdAuthorization requires post author and revokeAdAuthorization requires creator', () => {
    expect(byName.get('grantAdAuthorization')).toMatch(/authorId\s*!==\s*uid/);
    expect(byName.get('revokeAdAuthorization')).toMatch(/creatorId\s*!==\s*uid/);
  });
});
