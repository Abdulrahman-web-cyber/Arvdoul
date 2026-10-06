/**
 * src/__tests__/profilePiiBoundary.test.js
 *
 * Guards the PII boundary. `users/{uid}` is readable by every signed-in user
 * (search, feeds, follower lists), and Firestore rules cannot field-mask a
 * readable document. PII therefore lives in `users_private/{uid}`, owner/admin
 * readable only. These tests fail if a field is re-added to the public doc, the
 * rules grant the wrong access, or the analytics collections leak again.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  PRIVATE_PROFILE_FIELDS,
  PRIVATE_PROFILE_COLLECTION,
  SERVER_AUTHORITATIVE_FIELDS,
  splitProfileFields,
} from '../config/profileContracts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');

function blockFor(collection) {
  const start = rules.indexOf(`match /${collection}/`);
  if (start === -1) return '';
  // The path itself contains `{var}`; the block brace is the last `{` on the
  // match header line.
  const headerEnd = rules.indexOf('\n', start);
  const open = rules.lastIndexOf('{', headerEnd);
  let depth = 0;
  for (let i = open; i < rules.length; i += 1) {
    if (rules[i] === '{') depth += 1;
    else if (rules[i] === '}') {
      depth -= 1;
      if (depth === 0) return rules.slice(start, i + 1);
    }
  }
  return rules.slice(start);
}

describe('private profile fields contract', () => {
  test('contact details and payment identifiers are private', () => {
    for (const field of ['email', 'phoneNumber', 'emailVerified', 'phoneVerified', 'stripeCustomerId']) {
      expect(PRIVATE_PROFILE_FIELDS).toContain(field);
    }
    expect(PRIVATE_PROFILE_COLLECTION).toBe('users_private');
  });

  test('splitProfileFields routes PII to the private half', () => {
    const { publicFields, privateFields } = splitProfileFields({
      username: 'ada',
      displayName: 'Ada',
      bio: 'hi',
      email: 'ada@example.com',
      phoneNumber: '+10000000000',
      emailVerified: true,
      stripeCustomerId: 'cus_123',
    });
    expect(publicFields).toEqual({ username: 'ada', displayName: 'Ada', bio: 'hi' });
    expect(privateFields).toEqual({
      email: 'ada@example.com',
      phoneNumber: '+10000000000',
      emailVerified: true,
      stripeCustomerId: 'cus_123',
    });
  });
});

describe('firestore.rules PII boundary', () => {
  test('users_private exists and is owner/admin readable only', () => {
    const block = blockFor('users_private');
    expect(block).not.toBe('');
    expect(block).toContain('allow read: if isOwner(userId) || isAdmin();');
    expect(block).not.toMatch(/allow read:\s*if isSignedIn\(\)/);
    expect(block).toContain('allow delete: if false;');
  });

  test('users doc refuses PII on create and update', () => {
    const block = blockFor('users');
    expect(block).toContain('!touchesPrivateProfileFields()');
    // The private-field helper must list every private field.
    for (const field of PRIVATE_PROFILE_FIELDS) {
      expect(rules).toContain(`'${field}'`);
    }
  });

  test('the rules helper lists exactly the contract private fields', () => {
    const helper = rules.slice(
      rules.indexOf('function touchesPrivateProfileFields'),
      rules.indexOf('}', rules.indexOf('function touchesPrivateProfileFields')),
    );
    const listed = [...helper.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]).sort();
    expect(listed).toEqual([...PRIVATE_PROFILE_FIELDS].sort());
  });

  test('the rules helper lists exactly the contract server-authoritative fields', () => {
    const start = rules.indexOf('function touchesServerAuthoritativeFields');
    const helper = rules.slice(start, rules.indexOf(']);', start));
    const listed = new Set([...helper.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]));
    for (const field of SERVER_AUTHORITATIVE_FIELDS) {
      expect(listed).toContain(field);
    }
    // No field in the rules list may be absent from the contract (drift guard).
    for (const field of listed) {
      expect(SERVER_AUTHORITATIVE_FIELDS).toContain(field);
    }
  });

  test('profile_analytics is not readable by arbitrary signed-in users', () => {
    const block = blockFor('profile_analytics');
    expect(block).toContain('allow read: if isOwner(userId) || isAdmin();');
    expect(block).not.toMatch(/allow read:\s*if isSignedIn\(\)/);
  });

  test('profile_views is readable only by the profile owner', () => {
    const block = blockFor('profile_views');
    expect(block).toContain('resource.data.profileOwnerId == uid()');
    expect(block).not.toMatch(/allow read:\s*if isSignedIn\(\)\s*;/);
  });
});

describe('client and server honour the split', () => {
  const userService = fs.readFileSync(path.join(ROOT, 'src/services/userService.js'), 'utf8');
  const authContext = fs.readFileSync(path.join(ROOT, 'src/context/AuthContext.jsx'), 'utf8');

  test('createUserProfile writes through splitProfileFields', () => {
    expect(userService).toContain('splitProfileFields(profile)');
    expect(userService).toContain('PRIVATE_PROFILE_COLLECTION');
  });

  test('createUserProfile writes only the public half to users/{uid}', () => {
    // The public doc must receive the split public half, never the raw payload.
    expect(userService).toContain('transaction.set(userDoc, publicFields');
    expect(userService).not.toContain('transaction.set(userDoc, profile');
    expect(userService).toContain('privateFields');
  });

  test('AuthContext merges the private doc only for the owner listener', () => {
    expect(authContext).toContain('getPrivateProfile(uid)');
    expect(authContext).toContain('PRIVATE_PROFILE_FIELDS');
  });

  test('account deletion purges the private doc', () => {
    const userFn = fs.readFileSync(path.join(ROOT, 'functions/user.js'), 'utf8');
    expect(userFn).toContain("collection('users_private')");
    expect(userFn).toContain('privateDocRef.delete()');
  });

  test('stripe customer ids are stored and queried on users_private', () => {
    const monetization = fs.readFileSync(path.join(ROOT, 'functions/monetization.js'), 'utf8');
    expect(monetization).toContain("collection('users_private').where('stripeCustomerId'");
    expect(monetization).not.toContain("collection('users').where('stripeCustomerId'");
  });

  test('the migration module is registered and mirrors the contract', () => {
    const migration = fs.readFileSync(path.join(ROOT, 'functions/privacyMigration.js'), 'utf8');
    const index = fs.readFileSync(path.join(ROOT, 'functions/index.js'), 'utf8');
    expect(index).toContain("require('./privacyMigration.js')");
    // Same field list as the client contract.
    for (const field of PRIVATE_PROFILE_FIELDS) {
      expect(migration).toContain(`'${field}'`);
    }
    // Idempotent: merge the private doc, delete (never overwrite) the public one.
    expect(migration).toContain('FieldValue.delete()');
    expect(migration).toContain('{ merge: true }');
    expect(migration).toContain('orderBy(admin.firestore.FieldPath.documentId())');
    expect(migration).toContain('startAfter');
    // Admin-gated manual trigger.
    expect(migration).toContain('await assertAdmin(context)');
  });

  test('functions contract test sees the migration exports', () => {
    const contract = fs.readFileSync(path.join(ROOT, 'src/__tests__/functionsContract.test.js'), 'utf8');
    // The contract suite enumerates every module in functions/; the new module
    // must be required by index.js or that suite fails. Sanity-check the wiring
    // here too so a rename surfaces next to the boundary tests.
    const index = fs.readFileSync(path.join(ROOT, 'functions/index.js'), 'utf8');
    expect(index).toMatch(/require\('\.\/privacyMigration\.js'\)/);
    expect(contract).toContain('no dead modules');
  });
});
