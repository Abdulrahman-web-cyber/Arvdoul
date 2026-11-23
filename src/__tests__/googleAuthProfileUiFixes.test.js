/**
 * Regression guards for Google Auth, SetupProfile Firestore rules, avatar upload,
 * duplicate offline banner removal, bio-only quick edit, Creator Dashboard Lv.1 unlock,
 * ProfileTabsBar liquid DNA + About/Citizenship relocation, and dark-theme liquid glass parity.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relPath) => fs.readFileSync(path.join(root, relPath), 'utf8');

describe('Google OAuth & SetupProfile permission hardening', () => {
  test('index.html CSP allows Google OAuth scripts cleanly without unsafe-eval or bare https:', () => {
    const html = read('index.html');
    const cspContent = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)?.[1] || '';
    expect(cspContent).toContain('https://apis.google.com');
    expect(cspContent).toContain('https://accounts.google.com');
    expect(cspContent).toContain('https://www.gstatic.com');
    expect(cspContent).toContain('https://arvdoul-8057b.firebaseapp.com');
    expect(cspContent).not.toContain("'unsafe-eval'");
    const scriptSrc = cspContent.match(/script-src[^;]+/)?.[0] || '';
    expect(scriptSrc).not.toMatch(/\shttps:(?=[\s;]|$)/);
  });

  test('authService exposes prewarmGoogleAuth and AuthContext preserves onboarding for incomplete Google accounts', () => {
    const authSvc = read('src/services/authService.js');
    const authCtx = read('src/context/AuthContext.jsx');
    expect(authSvc).toContain('async prewarmGoogleAuth()');
    expect(authSvc).toContain('window.location.hostname');
    expect(authCtx).toContain('result.user?.isProfileComplete === false');
    expect(authCtx).toContain('result.user?.requiresProfileCompletion === true');
  });

  test('LoginScreen & SignupStep2VerifyContact pre-warm Google Auth and offer Open in New Tab recovery in iframes', () => {
    const login = read('src/screens/LoginScreen.jsx');
    const signup2 = read('src/screens/SignupStep2VerifyContact.jsx');
    expect(login).toContain('prewarmGoogleAuth');
    expect(login).toContain('Open in New Tab');
    expect(signup2).toContain('prewarmGoogleAuth');
    expect(signup2).toContain('Open in New Tab');
  });

  test('firestore.rules safely accesses optional token claims via .get() across users_private and mail', () => {
    const rules = read('firestore.rules');
    expect(rules).not.toMatch(/request\.auth\.token\.(email_verified|phone_number|email)(?![a-zA-Z0-9_])/);
    expect(rules).toContain("request.auth.token.get('email_verified', false)");
    expect(rules).toContain("request.auth.token.get('phone_number', null)");
    expect(rules).toContain("request.auth.token.get('email', null)");
  });
});

describe('Avatar upload, single offline banner, and bio-only quick edit', () => {
  test('userService.uploadAvatar guarantees canonical URL keys and ProfileMyScreen/AvatarUploadModal fail closed', () => {
    const userSvc = read('src/services/userService.js');
    const myProfile = read('src/screens/Profile/ProfileMyScreen.jsx');
    const modal = read('src/components/profile/AvatarUploadModal.jsx');
    expect(userSvc).toContain('downloadURL');
    expect(userSvc).toContain('photoURL: downloadURL');
    expect(userSvc).toContain('url: downloadURL');
    expect(myProfile).toContain('uploadRes?.downloadURL || uploadRes?.photoURL || uploadRes?.url');
    expect(myProfile).toContain('err._toastShown = true');
    expect(modal).toContain('!err?._toastShown');
  });

  test('TopAppBar removes duplicate offline pill while OfflineIndicator remains responsive', () => {
    const topBar = read('src/components/Shared/TopAppBar.jsx');
    const offlineBanner = read('src/components/UI/OfflineIndicator.jsx');
    expect(topBar).not.toMatch(/No Internet|Offline Mode|Back online/i);
    expect(offlineBanner).toContain("import { cn } from '../../lib/utils'");
  });

  test('ProfileQuickEditModal isolates bio-only edits and ProfileHeroSection routes both add & edit bio there', () => {
    const modal = read('src/components/profile/ProfileQuickEditModal.jsx');
    const hero = read('src/components/profile/ProfileHeroSection.jsx');
    expect(modal).toContain("initialField === 'bio'");
    expect(modal).toContain("updates.bio = bio.trim()");
    expect(modal).toContain('{showDisplayName &&');
    expect(modal).toContain('{showWebsite &&');
    expect(hero).toContain("onOpenQuickEdit('bio')");
  });
});

describe('ProfileTabsBar DNA liquidity, tab relocation, Creator Dashboard Lv.1 unlock, and dark contrast parity', () => {
  test('ProfileTabsBar removes citizenship/about tabs and uses signature liquid-glass active tab DNA', () => {
    const tabsBar = read('src/components/profile/ProfileTabsBar.jsx');
    const hero = read('src/components/profile/ProfileHeroSection.jsx');
    const options = read('src/components/profile/ProfileOptionsMenu.jsx');
    expect(tabsBar).not.toContain("id: 'citizenship'");
    expect(tabsBar).not.toContain("id: 'about'");
    expect(tabsBar).toContain('--ptb-grad');
    expect(tabsBar).toContain(".ptb-tab[aria-selected='true']");
    expect(hero).toContain("key: 'passport'");
    expect(hero).toContain("key: 'about'");
    expect(options).toContain('About Profile');
  });

  test('ProfileCreatorDashboard unlocks for owners and Level 1 users cleanly', () => {
    const dash = read('src/components/profile/ProfileCreatorDashboard.jsx');
    const myProfile = read('src/screens/Profile/ProfileMyScreen.jsx');
    expect(dash).toContain('isOwner = false');
    expect(dash).toContain('level >= 1');
    expect(myProfile).toContain('isOwner={isOwnerView}');
  });

  test('Dark-theme profile components use soft translucent deep-navy liquid glass without heavy #080F2E opacity', () => {
    const files = [
      'src/screens/Profile/ProfileMyScreen.jsx',
      'src/components/profile/ProfileHeroSection.jsx',
      'src/components/profile/ProfileTabsBar.jsx',
      'src/components/profile/ProfileCreatorDashboard.jsx',
      'src/components/profile/ProfileMetricsGrid.jsx',
      'src/components/profile/ProfileProgression.jsx',
      'src/components/profile/ProfileHighlightsSection.jsx',
      'src/components/profile/ProfilePinnedPosts.jsx',
      'src/components/profile/ProfileSocialContext.jsx',
      'src/components/profile/ProfileAbout.jsx',
      'src/components/profile/ProfileOptionsMenu.jsx',
      'src/components/profile/ProfileSkeleton.jsx',
      'src/screens/Profile/EditProfileScreen.jsx',
    ];
    for (const file of files) {
      const content = read(file);
      expect(content).not.toMatch(/bg-\[#080F2E\](\/75|\/9[0-9]|(?!\/))/);
    }
  });
});
