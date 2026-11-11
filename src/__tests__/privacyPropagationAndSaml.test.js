/**
 * src/__tests__/privacyPropagationAndSaml.test.js
 *
 * Two `functions/*.js` modules shipped without a dedicated suite. Both sit on a
 * trust boundary:
 *
 *   * `privacyPropagation.js` rewrites the denormalised `posts.authorIsPrivate`
 *     flag the post read-rule depends on. It must act only on the caller's own
 *     posts (or, for the backfill, only for an admin), and it must actually
 *     filter/paginate rather than scan a whole collection into one batch.
 *   * `saml.js` is an enterprise SSO endpoint that returns `serverVerified:
 *     true`. A wrong issuer/audience check, a missing signature check when a
 *     cert is configured, or an unvalidated encrypted assertion would let an
 *     attacker mint a verified enterprise identity.
 *
 * The SAML helper functions are pure, so they are extracted from the real source
 * and exercised directly (including a genuine RSA-SHA256 verify with a generated
 * key pair). The propagation logic is pinned as a source contract.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

/** Load the pure SAML helpers out of the real module text (no admin boot). */
function loadSamlHelpers() {
  const src = read('functions/saml.js');
  const from = src.indexOf('function extractAttr');
  const to = src.indexOf('exports.verifySAMLAssertion');
  expect(from).toBeGreaterThan(-1);
  expect(to).toBeGreaterThan(from);
  const body = src.slice(from, to);
  const stubFunctions = { logger: { warn: () => {} } };
  // eslint-disable-next-line no-new-func
  const factory = new Function('crypto', 'functions', `${body}; return { extractAttr, extractNameID, verifySignature };`);
  return factory(crypto, stubFunctions);
}

describe('functions/saml.js — enterprise SSO trust boundary', () => {
  const { extractAttr, extractNameID, verifySignature } = loadSamlHelpers();

  test('extractNameID parses a SAML NameID element', () => {
    const xml = '<saml:Assertion><saml:Subject><saml:NameID Format="email">user@corp.com</saml:NameID></saml:Subject></saml:Assertion>';
    expect(extractNameID(xml)).toBe('user@corp.com');
    expect(extractNameID('<saml:Assertion/>')).toBe(null);
  });

  test('extractAttr reads an attribute value by Name', () => {
    const xml = '<saml:AttributeStatement><saml:Attribute Name="displayName"><saml:AttributeValue>Ada</saml:AttributeValue></saml:Attribute></saml:AttributeStatement>';
    expect(extractAttr(xml, 'displayName')).toBe('Ada');
    expect(extractAttr(xml, 'missing')).toBe(null);
  });

  test('verifySignature is a real RSA-SHA256 check (accepts a valid signature, rejects a tampered one)', () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const assertion = '<saml:Assertion>issuer=acme;audience=arvdoul</saml:Assertion>';
    const goodSig = crypto.createSign('RSA-SHA256').update(assertion).sign(privateKey, 'base64');

    expect(verifySignature(assertion, goodSig, publicKey)).toBe(true);
    // Tampered payload with the original signature must fail.
    expect(verifySignature(assertion + 'x', goodSig, publicKey)).toBe(false);
    // Missing signature / cert is a fail-closed false, never a throw.
    expect(verifySignature(assertion, null, publicKey)).toBe(false);
    expect(verifySignature(assertion, goodSig, null)).toBe(false);
  });

  test('the callable is auth-gated, checks issuer + audience, and rejects unsigned/encrypted assertions', () => {
    const src = read('functions/saml.js');
    const body = src.slice(src.indexOf('exports.verifySAMLAssertion'));
    // Authenticated caller required (fails closed without context.auth).
    expect(body).toMatch(/if\s*\(!context\.auth\)/);
    // Issuer + audience must both be enforced.
    expect(body).toMatch(/issuer\s*!==\s*tenant\.issuer/);
    expect(body).toMatch(/audience\s*!==\s*tenant\.audience/);
    // A tenant with a cert must reject an unsigned assertion and a bad signature.
    expect(body).toMatch(/tenant\.publicCert/);
    expect(body).toMatch(/SAML assertion is not signed/);
    expect(body).toMatch(/SAML signature verification failed/);
    // Encrypted assertions are rejected explicitly (no silent pass).
    expect(body).toMatch(/EncryptedAssertion/);
    expect(body).toMatch(/Encrypted SAML assertions are not supported/);
  });
});

describe('functions/privacyPropagation.js — denormalised authorIsPrivate stays in step', () => {
  const src = read('functions/privacyPropagation.js');

  test('propagatePostPrivacy rewrites only the caller\'s own posts, from the caller\'s own flag', () => {
    const body = src.slice(src.indexOf('exports.propagatePostPrivacy'), src.indexOf('exports.backfillPostPrivacy'));
    expect(body).toMatch(/getUserIdFromContext\(context\)/);
    expect(body).toMatch(/checkRateLimit\(/);
    // The value comes from the caller's OWN user doc, never the request payload.
    expect(body).toMatch(/users\/\$\{uid\}/);
    expect(body).toMatch(/propagateForAuthor\(uid, isPrivate\)/);
  });

  test('backfillPostPrivacy is admin-gated, bounded, and audited', () => {
    const body = src.slice(src.indexOf('exports.backfillPostPrivacy'));
    expect(body).toMatch(/assertAdmin\(context\)/);
    expect(body).toMatch(/MAX_BACKFILL_USERS_PER_RUN/);
    expect(body).toMatch(/writeAudit\(/);
  });

  test('propagateForAuthor filters on the stale flag and pages rather than rewriting everything', () => {
    const body = src.slice(src.indexOf('function propagateForAuthor'), src.indexOf('exports.propagatePostPrivacy'));
    // Only docs whose flag disagrees are written.
    expect(body).toMatch(/d\.data\(\)\.authorIsPrivate\s*!==\s*isPrivate/);
    expect(body).toMatch(/batch\.commit\(\)/);
    // Bounded pages with a cursor, not one unbounded get.
    expect(body).toMatch(/\.limit\(BATCH_LIMIT\)/);
    expect(body).toMatch(/startAfter\(lastId\)/);
    expect(body).toMatch(/MAX_POSTS_PER_CALL/);
  });
});
