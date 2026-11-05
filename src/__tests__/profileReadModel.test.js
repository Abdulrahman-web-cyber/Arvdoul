/**
 * Canonical profile read-model contract (AUDIT V3 A-3 / N018).
 *
 * These are the derivations that were previously copy-pasted into
 * ProfilePublicScreen / ProfilePreviewScreen / ProfileMyScreen and drifted.
 * The test pins the single implementation: placeholder rejection, avatar
 * fallback, count/level coercion, creator/verified flags, and the
 * capability-driven masking applied exactly once.
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeString,
  isPlaceholderName,
  isPlaceholderHandle,
  deriveHandle,
  pickHandle,
  pickDisplayName,
  resolveAvatarUrl,
  resolveCount,
  resolveLevelValue,
  readStandingScore,
  resolveCreatorFlag,
  resolveVerifiedFlag,
  projectProfileForViewer,
  OFFLINE_PRESENCE,
} from '../services/profileReadModel.js';

describe('profileReadModel - handle derivation', () => {
  it('rejects synthetic user_* ids and generic placeholders', () => {
    expect(isPlaceholderHandle('user_abc123')).toBe(true);
    expect(isPlaceholderHandle('creator')).toBe(true);
    expect(isPlaceholderHandle('USER')).toBe(true);
    expect(isPlaceholderHandle('')).toBe(true);
    expect(isPlaceholderHandle('elena')).toBe(false);
  });

  it('derives a clean handle from an email or name, never a placeholder', () => {
    expect(deriveHandle('Elena.Marchetti@example.com')).toBe('elenamarchetti');
    expect(deriveHandle('user_123')).toBeNull();
    expect(deriveHandle('user@example.com')).toBeNull();
    expect(deriveHandle('')).toBeNull();
  });

  it('picks the first real handle, skipping placeholders', () => {
    expect(pickHandle(['user_9', 'creator', 'elena'])).toBe('elena');
    expect(pickHandle(['user_9', undefined, null])).toBeNull();
  });
});

describe('profileReadModel - display name', () => {
  it('skips placeholder names but keeps a real one', () => {
    expect(pickDisplayName(['User', 'Creator', 'Elena'], { fallback: 'Creator' })).toBe('Elena');
    expect(pickDisplayName(['User', ''], { fallback: 'Creator' })).toBe('Creator');
  });

  it('can keep a literal placeholder when the owner set it', () => {
    expect(pickDisplayName(['User'], { fallback: 'Creator', rejectPlaceholder: false })).toBe('User');
  });

  it('supports a null fallback so absence is reported as absence', () => {
    expect(pickDisplayName([undefined, 'Creator'], { fallback: null })).toBeNull();
  });

  it('isPlaceholderName is case-insensitive and trims', () => {
    expect(isPlaceholderName('  creator ')).toBe(true);
    expect(isPlaceholderName('Elena')).toBe(false);
    expect(normalizeString('  x ')).toBe('x');
  });
});

describe('profileReadModel - numeric coercion', () => {
  it('resolveCount takes the first numeric candidate, treating 0 as real', () => {
    expect(resolveCount(undefined, 0, 12)).toBe(0);
    expect(resolveCount('12', undefined)).toBe(12);
    expect(resolveCount(null, '')).toBe(0);
  });

  it('resolveLevelValue keeps absent standing unknown, never a fake Level 1', () => {
    expect(resolveLevelValue(undefined, null, 0)).toBeNull();
    expect(resolveLevelValue(0, 7)).toBe(7);
    expect(resolveLevelValue('8')).toBe(8);
  });

  it('readStandingScore clamps to 0..100 and keeps absence as null', () => {
    expect(readStandingScore(undefined, null, '')).toBeNull();
    expect(readStandingScore(140, 20)).toBe(100);
    expect(readStandingScore(-5)).toBe(0);
    expect(readStandingScore('42')).toBe(42);
  });
});

describe('profileReadModel - standing flags', () => {
  it('creator flag honours an explicit profile/viewer flag then the level gate', () => {
    expect(resolveCreatorFlag({ isCreator: true }, {}, null)).toBe(true);
    expect(resolveCreatorFlag({}, { isCreator: true }, null)).toBe(true);
    expect(resolveCreatorFlag({ creatorStatus: 'approved' }, {}, null)).toBe(true);
    expect(resolveCreatorFlag({ creatorTier: 'partner' }, {}, null)).toBe(true);
    expect(resolveCreatorFlag({ creatorTier: 'standard' }, {}, null)).toBe(false);
  });

  it('verified flag reads either stored field', () => {
    expect(resolveVerifiedFlag({ isVerified: true })).toBe(true);
    expect(resolveVerifiedFlag({ verified: true })).toBe(true);
    expect(resolveVerifiedFlag({})).toBe(false);
  });

  it('avatar falls back to a deterministic SVG, never an empty string', () => {
    const url = resolveAvatarUrl('', 'Elena', 'u1');
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
    expect(resolveAvatarUrl('https://cdn/x.png', 'Elena', 'u1')).toBe('https://cdn/x.png');
  });
});

describe('profileReadModel - capability projection', () => {
  const profile = {
    id: 'u1', coins: 500, links: ['a'], bio: 'hi', location: 'Rome', website: 'https://e.dev',
    presence: { isOnline: true, status: 'online', lastActive: 1 },
  };

  it('masks economic status, links and presence when the engine denies them', () => {
    const projected = projectProfileForViewer(profile, {
      canViewEconomicStatus: false,
      canViewLinks: false,
      canViewPresence: false,
    });
    expect(projected.coins).toBeNull();
    expect(projected.links).toEqual([]);
    expect(projected.presence).toEqual(OFFLINE_PRESENCE);
  });

  it('masks the identity card (profileInfo scope) when canViewIdentity is denied', () => {
    const projected = projectProfileForViewer(profile, {
      canViewIdentity: false,
      canViewLinks: true,
    });
    expect(projected.bio).toBe('');
    expect(projected.location).toBe('');
    expect(projected.website).toBe('');
    expect(projected.canViewIdentity).toBe(false);
    // `links` has its own scope and stays when that scope allows it.
    expect(projected.links).toEqual(['a']);
    // The account identity is never masked — only the descriptive card.
    expect(projected.id).toBe('u1');
  });

  it('fails closed on the identity card when the capability map is absent', () => {
    const projected = projectProfileForViewer(profile, {});
    expect(projected.bio).toBe('');
    expect(projected.location).toBe('');
  });

  it('masks raw isOnline/lastActive alongside presence so a consumer cannot read around the gate', () => {
    const raw = { id: 'u1', isOnline: true, lastActive: '2026-01-01T00:00:00.000Z' };
    const denied = projectProfileForViewer(raw, { canViewPresence: false });
    expect(denied.isOnline).toBe(false);
    expect(denied.lastActive).toBeNull();
    expect(denied.presence).toEqual(OFFLINE_PRESENCE);

    const allowed = projectProfileForViewer(raw, { canViewPresence: true });
    expect(allowed.isOnline).toBe(true);
    expect(allowed.lastActive).toBe('2026-01-01T00:00:00.000Z');
  });

    it('masks the creator suite (creatorInfo scope) so the business contact cannot leak', () => {
      // creatorInfo was a dead control: saved/validated, enforced nowhere, so a
      // creator's business email was world-readable on users/{uid}.
      const raw = { id: 'u1', creatorCategory: 'Musician', inquiriesEmail: 'mgmt@x.com', tipMessage: 'tip me' };
      const denied = projectProfileForViewer(raw, { canViewCreatorInfo: false });
      expect(denied.creatorCategory).toBe('');
      expect(denied.inquiriesEmail).toBe('');
      expect(denied.tipMessage).toBe('');
      expect(denied.canViewCreatorInfo).toBe(false);

      const allowed = projectProfileForViewer(raw, { canViewCreatorInfo: true });
      expect(allowed.creatorCategory).toBe('Musician');
      expect(allowed.inquiriesEmail).toBe('mgmt@x.com');
      expect(allowed.tipMessage).toBe('tip me');
    });

    it('fails closed on the creator suite when the capability map is absent', () => {
      const projected = projectProfileForViewer(
        { id: 'u1', creatorCategory: 'Musician', inquiriesEmail: 'mgmt@x.com' },
        {}
      );
      expect(projected.creatorCategory).toBe('');
      expect(projected.inquiriesEmail).toBe('');
    });

    it('owner always sees the creator suite', () => {
      const projected = projectProfileForViewer(
        { id: 'u1', creatorCategory: 'Musician', inquiriesEmail: 'mgmt@x.com' },
        { canViewCreatorInfo: false },
        { isOwner: true }
      );
      expect(projected.creatorCategory).toBe('Musician');
      expect(projected.inquiriesEmail).toBe('mgmt@x.com');
    });

    it('masks every money field when economic status is denied, not just coins', () => {
      // The spread left earnings/totalEarned/coinBalance on the projected object,
      // so a viewer denied economicStatus could still read the creator's income.
      const raw = {
        id: 'u1', coins: 500, coinBalance: 500, balance: 500,
        earnings: 1200, totalEarned: 1200, lifetimeEarnings: 1200, withdrawableBalance: 900,
      };
      const denied = projectProfileForViewer(raw, { canViewEconomicStatus: false });
      for (const field of ['coins', 'coinBalance', 'balance', 'earnings', 'totalEarned', 'lifetimeEarnings', 'withdrawableBalance']) {
        expect(denied[field]).toBeNull();
      }

      const allowed = projectProfileForViewer(raw, { canViewEconomicStatus: true });
      expect(allowed.earnings).toBe(1200);
      expect(allowed.totalEarned).toBe(1200);
      expect(allowed.coins).toBe(500);
    });

    it('gates civic standing (level/reputation/streak/badges) on the activity scope', () => {
      // canViewActivity was resolved and exposed but applied to nothing, so the
      // "Civic Standing & Badges" scope hid no level, reputation or streak.
      const raw = {
        id: 'u1', level: 7, experience: 3400, activeStreak: 12, activeDaysCount: 90,
        reputationScore: 88, reputation: 88, achievements: ['a'], titles: ['t'], activeTitle: { name: 'X' },
      };
      const denied = projectProfileForViewer(raw, { canViewActivity: false, canViewAchievements: false, canViewTitles: false });
      expect(denied.level).toBeNull();
      expect(denied.experience).toBeNull();
      expect(denied.activeStreak).toBeNull();
      expect(denied.reputationScore).toBeNull();
      expect(denied.achievements).toEqual([]);
      expect(denied.titles).toEqual([]);
      expect(denied.activeTitle).toBeNull();

      const allowed = projectProfileForViewer(raw, { canViewActivity: true, canViewAchievements: true, canViewTitles: true });
      expect(allowed.level).toBe(7);
      expect(allowed.reputationScore).toBe(88);
      expect(allowed.achievements).toEqual(['a']);
    });

    it('gates badges and titles on their own scopes, independent of the level', () => {
      // The settings UI writes `achievements` and `titles` separately, so a
      // viewer allowed the level but denied badges must not read the badges.
      const raw = { id: 'u1', level: 7, achievements: ['a'], titles: ['t'] };
      const projected = projectProfileForViewer(raw, {
        canViewActivity: true, canViewAchievements: false, canViewTitles: false,
      });
      expect(projected.level).toBe(7);
      expect(projected.achievements).toEqual([]);
      expect(projected.titles).toEqual([]);
    });

    it('owner bypasses the standing gate', () => {
      const projected = projectProfileForViewer(
        { id: 'u1', level: 7, activeStreak: 12 },
        { canViewActivity: false },
        { isOwner: true }
      );
      expect(projected.level).toBe(7);
      expect(projected.activeStreak).toBe(12);
    });

    it('passes sections through when the engine allows them', () => {
      const projected = projectProfileForViewer(profile, {
      canViewEconomicStatus: true,
      canViewLinks: true,
      canViewPresence: true,
      canViewActivity: true,
      canViewFollowers: true,
      canViewIdentity: true,
    });
    expect(projected.coins).toBe(500);
    expect(projected.links).toEqual(['a']);
    expect(projected.bio).toBe('hi');
    expect(projected.presence).toEqual(profile.presence);
    expect(projected.canViewActivity).toBe(true);
    expect(projected.canViewFollowersList).toBe(true);
  });

  it('owner always sees economic status and the identity card even in a simulated public view', () => {
    const projected = projectProfileForViewer(profile, { canViewEconomicStatus: false, canViewIdentity: false }, { isOwner: true });
    expect(projected.coins).toBe(500);
    expect(projected.bio).toBe('hi');
    expect(projected.location).toBe('Rome');
  });

  it('null profile projects to null', () => {
    expect(projectProfileForViewer(null, {})).toBeNull();
  });
});

describe('profile surfaces consume the canonical read model (N018)', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
  const surfaces = [
    'src/screens/Profile/ProfilePublicScreen.jsx',
    'src/screens/Profile/ProfilePreviewScreen.jsx',
    'src/screens/Profile/ProfileMyScreen.jsx',
    'src/screens/Profile/AboutScreen.jsx',
    'src/services/passportService.js',
  ];

  it('every profile surface imports the canonical read model', () => {
    for (const file of surfaces) {
      expect(read(file)).toContain('profileReadModel');
    }
  });

  it('no surface re-derives privacy masking with its own capability ternary', () => {
    for (const file of surfaces) {
      const src = read(file);
      // The projection is applied once, by projectProfileForViewer — screens
      // must not inline their own `capabilities.canViewX ? ... : null` masking.
      expect(src).not.toMatch(/capabilities\.canViewEconomicStatus\s*\?/);
    }
  });

  it('no surface hardcodes the creator level gate', () => {
    for (const file of surfaces) {
      expect(read(file)).not.toContain('LEVEL_GATES.creatorProfile');
    }
  });

  it('no surface re-implements the user_/creator placeholder filter', () => {
    for (const file of surfaces) {
      expect(read(file)).not.toContain("startsWith('user_')");
    }
  });

  it('userService.getUserProfile is not a second privacy layer (N007)', () => {
    const src = read('src/services/userService.js');
    // The relation flags are resolved there, but the decision is the engine's.
    expect(src).toContain('resolveCapabilities(');
    expect(src).toContain('projectProfileForViewer(');
    // A second hand-rolled section mask would be the divergence N007 describes.
    expect(src).not.toContain('canViewProfileSection(');
  });

  it('standing scores are read through the canonical read model, not re-clamped', () => {
    // passportService + reputationService previously carried identical private
    // `readScore` closures (Math.max(0, Math.min(100, …))). They now call
    // readStandingScore so the clamp and the absent-value policy cannot drift.
    for (const file of ['src/services/passportService.js', 'src/services/reputationService.js']) {
      const src = read(file);
      expect(src).toContain('readStandingScore');
      expect(src).not.toMatch(/const readScore = /);
    }
    // reputationService must read the profile through the canonical service.
    expect(read('src/services/reputationService.js')).not.toContain("getDoc(doc(db, 'users'");
  });

    it('passportService applies the canonical projection instead of the raw profile', () => {
      // The passport read `users/{uid}` (world-readable) and rendered raw fields
      // without the capability decision, so a narrowed scope was bypassed.
      const src = read('src/services/passportService.js');
      expect(src).toContain('projectProfileForViewer');
      // It must read through the canonical service, not a raw doc fetch.
      expect(src).toContain('getUserService().getUserProfile(');
      expect(src).not.toContain("doc(this.firestore, 'users'");
    });

    it('the store reads the mutualFriends key the service actually returns', () => {
      // userService.getMutualFriends resolves `{ success, mutualFriends }`, but
      // the store read `mutualResult?.users`, so the social-context bar always
      // rendered an empty mutual list.
      const src = read('src/store/profileStore.js');
      expect(src).toContain('mutualResult?.mutualFriends?.slice(0, 5)');
      expect(src).toContain('result?.mutualFriends?.slice(0, 5)');
      expect(src).not.toContain('mutualResult?.users');
    });

    it('profile surfaces do not read standing around the projection', () => {
      // The hero received the raw store `level` (MyScreen) and the public screen
      // hardcoded `|| 0` / `?? 0` for XP and streak, so a viewer denied the
      // activity scope still saw the standing. The screens must pass the
      // projected values through, un-defaulted.
      const my = read('src/screens/Profile/ProfileMyScreen.jsx');
      expect(my).not.toContain('level={level || effectiveProfile.level}');
      expect(my).toContain('level={displayedProfile?.level}');
      const pub = read('src/screens/Profile/ProfilePublicScreen.jsx');
      expect(pub).not.toContain('experience={effectiveProfile?.experience || 0}');
      expect(pub).not.toContain('streak={effectiveProfile?.activeStreak ?? 0}');
      const about = read('src/screens/Profile/AboutScreen.jsx');
      expect(about).not.toContain('effectiveProfile?.level != null');
      expect(about).toContain('displayedProfile?.level != null');
      const preview = read('src/screens/Profile/ProfilePreviewScreen.jsx');
      expect(preview).not.toContain('level={effectiveProfile?.level ?? null}');
      expect(preview).toContain('level={projectedProfile?.level ?? null}');
    });

    it('the featured "More Handpicked" card is owner-gated and links to a real route', () => {
      // The card linked to `/profile/:id/collections`, which has no route (it fell
      // through to the 404 screen), and collections are owner-only anyway.
      const src = read('src/components/profile/ProfileFeaturedSection.jsx');
      expect(src).toContain("navigate('/collections')");
      expect(src).toContain('showCollectionsCard');
      expect(src).not.toContain('/collections`)}');
    });

    it('AboutScreen applies the projection so the profileInfo scope is enforced', () => {
      // AboutScreen rendered bio/location/website/links straight from the raw
    // profile, so the `profileInfo` scope ("who can view your profile info")
    // controlled nothing. It now resolves capabilities and renders the projected
    // profile, so a narrowed scope actually hides the card.
    const src = read('src/screens/Profile/AboutScreen.jsx');
    expect(src).toContain('projectProfileForViewer');
    expect(src).toContain('resolveCapabilities(');
    expect(src).toContain('profile={displayedProfile}');
    expect(src).not.toContain('profile={effectiveProfile}');
  });
});

describe('creatorInfo scope is wired end to end (N038)', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  it('the engine exposes canViewCreatorInfo from the creatorInfo scope', () => {
    expect(read('src/services/profileCapabilityEngine.js')).toContain("canViewProfileSection('creatorInfo'");
  });

  it('the projection masks the creator suite fields', () => {
    const src = read('src/services/profileReadModel.js');
    expect(src).toContain('CREATOR_INFO_FIELDS');
    expect(src).toContain('mayViewCreator');
  });

  it('a surface renders the creator suite and both editors can set the scope', () => {
    // A dead control is a field that is writable but read nowhere. It must be
    // rendered by a surface AND settable from the settings UI.
    expect(read('src/screens/Profile/AboutScreen.jsx')).toContain('creatorCategory');
    expect(read('src/screens/SettingsScreen.jsx')).toContain("handleUpdateProfilePrivacyScope('creatorInfo'");
    expect(read('src/screens/Profile/EditProfileScreen.jsx')).toContain("handlePrivacyChange('creatorInfo'");
  });
});

describe('profile components fail closed on capabilities', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

  it('ProfileMetricsGrid does not default a capability to visible', () => {
    const src = read('src/components/profile/ProfileMetricsGrid.jsx');
    // A missing capabilities prop must hide sections, never reveal them.
    expect(src).not.toMatch(/canView\w+\s*\?\?\s*true/);
    expect(src).not.toMatch(/canViewEconomicStatus\s*\?\?/);
  });

  it('ProfilePreviewScreen does not fabricate a follow relationship', () => {
    const src = read('src/screens/Profile/ProfilePreviewScreen.jsx');
    // The visitor perspective must resolve the real relationship, not assert
    // isFollowing/isFollower: true.
    expect(src).not.toMatch(/isFollowing:\s*!isOwnerMode/);
  });

  it('no profile surface re-implements the placeholder handle filter', () => {
    for (const file of [
      'src/screens/Profile/EditProfileScreen.jsx',
      'src/screens/Profile/ProfileMyScreen.jsx',
      'src/screens/Profile/ProfilePublicScreen.jsx',
      'src/screens/Profile/ProfilePreviewScreen.jsx',
      'src/screens/Profile/AboutScreen.jsx',
    ]) {
      expect(read(file)).not.toContain("startsWith('user_')");
    }
  });

  it('EditProfileScreen uses the canonical creator flag, not a raw level gate', () => {
    const src = read('src/screens/Profile/EditProfileScreen.jsx');
    expect(src).toContain('resolveCreatorFlag(');
    expect(src).not.toContain('LEVEL_GATES.creatorProfile');
  });

  it('the show* privacy toggles are read by the progression surfaces, not just written', () => {
    // showLevel/showReputation/showStreak were saved by EditProfileScreen but
    // read nowhere, so every viewer saw the level badge, reputation and streak
    // regardless of the owner's choice. They must now gate the render.
    const progression = read('src/components/profile/ProfileProgression.jsx');
    const hero = read('src/components/profile/ProfileHeroSection.jsx');
    for (const toggle of ['showLevel', 'showReputation', 'showStreak']) {
      expect(progression).toContain(toggle);
    }
    expect(hero).toContain('showLevel');
    // Both profile surfaces must render the progression component.
    expect(read('src/screens/Profile/ProfilePublicScreen.jsx')).toContain('<ProfileProgression');
    expect(read('src/screens/Profile/ProfileMyScreen.jsx')).toContain('<ProfileProgression');
  });

  it('no dead profile components linger', () => {
    for (const gone of [
      'src/components/profile/ProfileHeader.jsx',
      'src/components/profile/ProfileStats.jsx',
      'src/components/profile/ProfileCivicCard.jsx',
    ]) {
      expect(fs.existsSync(path.join(root, gone))).toBe(false);
    }
  });
});


describe('ConnectionsScreen gates each list on its own scope (N046)', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const src = fs.readFileSync(path.join(root, 'src/screens/Profile/ConnectionsScreen.jsx'), 'utf8');

  it('resolves the following scope, not only the followers scope', () => {
    expect(src).toContain('canViewFollowing');
    expect(src).toContain('canViewFriends');
  });

  it('does not fetch a list the viewer may not see', () => {
    // The denied branch must resolve to an empty result instead of a real read.
    expect(src).toContain('Promise.resolve({ followers: [] })');
    expect(src).toContain('Promise.resolve({ following: [] })');
  });

  it('renders each tab only when its scope allows it', () => {
    expect(src).toContain('tabVisible.followers &&');
    expect(src).toContain('tabVisible.following &&');
    expect(src).toContain('tabVisible.friends &&');
  });
});
