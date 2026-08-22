/**
 * src/__tests__/settingsScreen.test.jsx
 * Settings screen: renders (skeleton → content), persists toggles through
 * settingsService, shows the level card, zero axe violations.
 * Services are mocked so the test is hermetic.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';

jest.mock('../lib/utils.js', () => ({
  cn: (...args) => args.filter(Boolean).join(' '),
}));
jest.mock('../context/ThemeContext.jsx', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: jest.fn() }),
}));
jest.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, signOut: jest.fn() }),
}));
jest.mock('../i18n/index.js', () => ({
  SUPPORTED_LOCALES: [
    { code: 'en', label: 'English', rtl: false },
    { code: 'es', label: 'Español', rtl: false },
    { code: 'fr', label: 'Français', rtl: false },
  ],
  withLanguage: (C) => C,
}));

const mockUpdateSetting = jest.fn(async () => ({ success: true }));
jest.mock('../services/settingsService.js', () => ({
  settingsService: {
    getSettings: jest.fn(async () => ({
      notifications: { push: true, email: true, soundFx: true, spatialAudio: false },
      privacy: { profilePrivate: false, allowDMs: 'everyone', showActiveStatus: true },
      playback: { autoPlayVideos: true, streamQuality: 'auto' },
      appearance: { reduceMotion: false, language: 'en' },
    })),
    updateSetting: mockUpdateSetting,
    clearApplicationCache: jest.fn(async () => ({ success: true, cleared: ['a', 'b'] })),
  },
  DEFAULT_SETTINGS: {
    notifications: { push: true, email: true, soundFx: true, spatialAudio: true },
    privacy: { profilePrivate: false, allowDMs: 'everyone', showActiveStatus: true },
    playback: { autoPlayVideos: true, streamQuality: 'auto' },
    appearance: { reduceMotion: false, language: 'en' },
  },
}));
jest.mock('../services/levelSystemService.js', () => ({
  levelSystemService: {
    getLevelInfo: jest.fn(async () => ({
      level: 4,
      title: 'Explorer',
      progress: 33.3,
      xpIntoLevel: 100,
      nextLevelXp: 600,
      xpToNext: 200,
      isMaxLevel: false,
    })),
  },
  getPerksForLevel: () => [{ icon: '🎨', title: 'Advanced Editor', description: 'x' }],
  getLifetimeRewards: () => 60,
}));

const { default: SettingsScreen } = require('../screens/SettingsScreen.jsx');

expect.extend(toHaveNoViolations);

i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        common: { back: 'Back', cancel: 'Cancel' },
        settings: {
          title: 'Settings & Preferences',
          saveFailed: 'Could not save settings.',
          languageChanged: 'Language updated',
          cacheCleared: 'Cleared {{count}} cached items',
          cacheClearFailed: 'Failed to clear cache',
          accountDeleted: 'Account deletion scheduled.',
          accountDeleteFailed: 'Account deletion failed.',
          accountSection: 'Account & Identity',
          editProfile: 'Edit Profile Information',
          editProfileDesc: 'Bio, display name, avatar.',
          securityPassword: 'Security & Password',
          securityPasswordDesc: '2FA, passkeys.',
          wallet: 'Coins, Wallet & Payouts',
          walletDesc: 'Balance, transactions.',
          dataUsage: 'Data & Usage',
          dataUsageDesc: 'Storage, downloads.',
          appearanceSection: 'Appearance',
          theme: 'Theme',
          themeDark: 'Dark mode active',
          themeLight: 'Light mode active',
          switchLight: 'Light',
          switchDark: 'Dark',
          reduceMotion: 'Reduce animations',
          reduceMotionDesc: 'Minimize motion.',
          language: 'Language',
          languageDesc: 'Choose your language.',
          notificationsSection: 'Notifications',
          pushNotifs: 'Push notifications',
          emailNotifs: 'Email notifications',
          soundFx: 'Sound effects',
          spatialAudio: 'Spatial audio',
          privacySection: 'Privacy & Security',
          privateProfile: 'Private profile',
          privateProfileDesc: 'Only followers.',
          activeStatus: 'Show active status',
          allowDMs: 'Who can message you',
          dmOption: { everyone: 'Everyone', friends: 'Friends', none: 'No one' },
          playbackSection: 'Playback',
          autoPlay: 'Auto-play videos',
          streamQuality: 'Stream quality',
          dataSection: 'Data & Cache',
          clearCache: 'Clear application cache',
          clearCacheDesc: 'Removes cached content.',
          about: 'About Arvdoul',
          dangerSection: 'Account',
          signOut: 'Sign out',
          signOutDesc: 'End this session.',
          deleteAccount: 'Delete account',
          deleteAccountDesc: 'Permanently delete.',
          deleteWarning: 'This cannot be undone.',
          confirmDelete: 'Delete my account',
          deleting: 'Deleting...',
        },
        level: {
          title: 'Level & Progress',
          level: 'Level',
          maxLevel: 'Maximum level reached',
          xpToNext: '{{xp}} XP to next level',
          xpProgress: '{{xp}} / {{next}} XP',
          progress: 'Level progress',
          maxLevelDesc: 'Highest level.',
          rewardsEarned: 'Rewards earned',
          noPerksYet: 'Level up to unlock perks',
        },
      },
    },
  },
});

const renderScreen = () =>
  render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/settings']}>
        <SettingsScreen />
      </MemoryRouter>
    </I18nextProvider>
  );

describe('SettingsScreen', () => {
  test('renders content after loading (level card + sections)', async () => {
    renderScreen();
    expect(await screen.findByText('Level & Progress')).toBeInTheDocument();
    expect(screen.getByText('Explorer')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Advanced Editor')).toBeInTheDocument();
    expect(screen.getByText('Settings & Preferences')).toBeInTheDocument();
  });

  test('toggle persists through settingsService', async () => {
    renderScreen();
    const pushToggle = await screen.findByRole('switch', { name: 'Push notifications' });
    expect(pushToggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(pushToggle);
    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith('u1', 'notifications.push', false);
    });
  });

  test('has no axe violations', async () => {
    const { container } = renderScreen();
    await screen.findByText('Level & Progress');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('delete account opens the confirmation dialog', async () => {
    renderScreen();
    fireEvent.click(await screen.findByText('Delete account'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete my account')).toBeInTheDocument();
  });
});
