/**
 * REAL SYSTEM (not static UI):
 *  - Every toggle persists via settingsService (Firestore `users/{uid}`
 *    settings field, optimistic updates, offline queue, rollback on failure)
 *  - Level & Progress card driven by the real levelSystemService
 *    (XP curve, rank titles, perks, lifetime coin rewards)
 *  - Language switcher wired to i18n (7 locales) + persisted
 *  - Reduce-motion override applies a document-level class
 *  - Clear cache actually clears localStorage + IndexedDB + memory caches
 *  - Danger zone: real account deletion via userService.deleteAccount
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, Shield, LogOut, Moon, Sun, Lock, Trash2, Volume2, Video, Sparkles, DollarSign, Database, Info, ChevronRight, AlertTriangle, Eye, User, ShieldCheck, RefreshCw, Languages, Activity, Trophy, Zap } from "lucide-react";
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useProfileStore } from '../store/profileStore.js';
import { settingsService, DEFAULT_SETTINGS } from '../services/settingsService.js';
import { levelSystemService, getPerksForLevel, getLifetimeRewards, LEVEL_GATES } from '../services/levelSystemService.js';
import { VISIBILITY_SCOPES, DEFAULT_PROFILE_PRIVACY } from '../config/profileContracts.js';
import { ProfileSystemRoadmapModal } from '../components/profile/ProfileSystemRoadmapModal.jsx';
import { SUPPORTED_LOCALES } from '../i18n/index.js';
import { Dialog } from '../components/UI/Dialog.jsx';
import { Skeleton } from '../components/UI/Skeleton.jsx';
import { cn } from '../lib/utils';

/* ---------- Reusable row primitives ---------- */
function ToggleRow({ icon: Icon, label, description, checked, onChange, disabled }) {
  return (
    <div className="w-full py-3.5 flex items-center justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && <Icon className="w-4 h-4 mt-0.5 text-purple-400 shrink-0" aria-hidden="true" />}
        <div className="min-w-0">
          <p className="font-bold text-sm">{label}</p>
          {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
        </div>
      </div>
      <button
        role="switch"
        aria-checked={Boolean(checked)}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={cn(
          'relative w-11 h-6 rounded-full transition-colors shrink-0',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2',
          checked ? 'bg-gradient-to-r from-purple-600 to-indigo-600' : 'bg-gray-300 dark:bg-gray-700',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-5'
          )}
        />
      </button>
    </div>
  );
}

function Section({ icon: Icon, title, children, id }) {
  return (
    <section id={id} className="rounded-3xl p-5 border shadow-sm bg-white/[0.03] dark:bg-white/[0.03] border-gray-200 dark:border-white/10 scroll-mt-24">
      <div className="flex items-center gap-2.5 text-xs font-bold text-purple-400 uppercase tracking-wider mb-1">
        <Icon className="w-4 h-4" aria-hidden="true" />
        <span>{title}</span>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-white/5">{children}</div>
    </section>
  );
}

function NavRow({ icon: Icon, label, description, onClick }) {
  return (
    <button onClick={onClick} className="w-full py-3.5 flex items-center justify-between text-left group">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && <Icon className="w-4 h-4 mt-0.5 text-purple-400 shrink-0" aria-hidden="true" />}
        <div className="min-w-0">
          <p className="font-bold text-sm group-hover:text-purple-400 transition-colors">{label}</p>
          {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform shrink-0" aria-hidden="true" />
    </button>
  );
}

function OptionPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'px-3 py-1.5 rounded-full text-xs font-semibold transition-all min-h-[36px]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500',
        active
          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
      )}
    >
      {label}
    </button>
  );
}

/* ---------- Main screen ---------- */
export default function SettingsScreen() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { t, i18n } = useTranslation();
  const isDark = theme !== 'light';
  const uid = user?.uid;

  const [settings, setSettings] = useState(null); // null = loading
  const [levelInfo, setLevelInfo] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showRoadmapModal, setShowRoadmapModal] = useState(false);
  const [roadmapTab, setRoadmapTab] = useState('levels');

  const storeProfile = useProfileStore((state) => state.profile);
  const [profilePrivacy, setProfilePrivacy] = useState(DEFAULT_PROFILE_PRIVACY);
  const [profileIsPrivate, setProfileIsPrivate] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [loaded, level] = await Promise.all([
        settingsService.getSettings(uid),
        levelSystemService.getLevelInfo(uid),
      ]);
      if (!mounted) return;
      setSettings(loaded);
      setLevelInfo(level);
      // Initialize profile privacy from storeProfile or loaded doc
      if (storeProfile?.privacy) {
        setProfilePrivacy({ ...DEFAULT_PROFILE_PRIVACY, ...storeProfile.privacy });
      }
      // Profile privacy is owned by the user profile (`users/{uid}.isPrivate`),
      // never by the settings document - read it from the profile store only.
      setProfileIsPrivate(Boolean(storeProfile?.isPrivate));
      // Apply persisted reduce-motion override
      if (loaded?.appearance?.reduceMotion) {
        document.documentElement.classList.add('arvdoul-reduce-motion');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [uid, storeProfile]);

  // Deep-link support: /settings#appearance, /settings#privacy, /settings#data
  // scroll to the matching section once settings have rendered.
  const location = useLocation();
  const scrollTargetRef = useRef(null);
  useEffect(() => {
    const hash = (location.hash || '').replace('#', '');
    if (!hash || !settings) return;
    const el = document.getElementById(`settings-${hash}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      scrollTargetRef.current = hash;
    }
  }, [location.hash, settings]);

  const updateSetting = useCallback(
    async (path, value) => {
      if (!settings || !uid) return;
      const previous = settings;
      // Optimistic
      setSettings((cur) => {
        const next = JSON.parse(JSON.stringify(cur || DEFAULT_SETTINGS));
        const keys = path.split('.');
        let node = next;
        for (let i = 0; i < keys.length - 1; i++) node = node[keys[i]];
        node[keys[keys.length - 1]] = value;
        return next;
      });
      try {
        await settingsService.updateSetting(uid, path, value);
      } catch (err) {
        setSettings(previous); // rollback - the UI never lies
        toast.error(t('settings.saveFailed'));
      }
    },
    [settings, uid, t]
  );

  const handleToggleProfilePrivate = useCallback(async (val) => {
    setProfileIsPrivate(val);
    if (!uid) return;
    try {
      const { getUserService } = await import('../services/userService.js');
      const userService = getUserService();
      await userService.updateUserProfile(uid, { isPrivate: val });
      useProfileStore.setState((s) => ({
        profile: s.profile ? { ...s.profile, isPrivate: val } : s.profile
      }));
      toast.success(val ? 'Profile visibility set to Private' : 'Profile visibility set to Public');
    } catch (err) {
      // Roll back the optimistic switch - the profile is the source of truth.
      setProfileIsPrivate(!val);
      console.warn('Failed to sync profile private flag:', err);
      toast.error(t('settings.saveFailed'));
    }
  }, [uid, t]);

  const handleUpdateProfilePrivacyScope = useCallback(async (scopeKey, scopeVal) => {
    setProfilePrivacy((cur) => {
      const next = { ...cur, [scopeKey]: scopeVal };
      return next;
    });
    if (!uid) return;
    try {
      const { getUserService } = await import('../services/userService.js');
      const userService = getUserService();
      const updatedPrivacy = { ...profilePrivacy, [scopeKey]: scopeVal };
      await userService.updateUserProfile(uid, { privacy: updatedPrivacy });
      useProfileStore.setState((s) => ({
        profile: s.profile ? { ...s.profile, privacy: updatedPrivacy } : s.profile
      }));
      toast.success('Audience privacy updated');
    } catch (err) {
      console.warn('Failed to update privacy scope:', err);
      toast.error('Failed to update privacy settings');
    }
  }, [uid, profilePrivacy]);

  const handleReduceMotion = (value) => {
    document.documentElement.classList.toggle('arvdoul-reduce-motion', value);
    updateSetting('appearance.reduceMotion', value);
  };

  // Push/email toggles persist to `users/{uid}.settings` (so the UI reads a
  // single document) AND mirror to `user_settings/{uid}.notificationPreferences`
  // — the document the server actually reads when dispatching a notification.
  // Without the mirror these switches were inert.
  const handleNotificationChannel = useCallback(async (path, value) => {
    updateSetting(path, value);
    if (!uid) return;
    const channel = path === 'notifications.push' ? 'push'
      : path === 'notifications.email' ? 'email'
        : null;
    if (!channel) return;
    try {
      const { default: notificationsService } = await import('../services/notificationsService.js');
      await notificationsService.updateUserNotificationPreferences(uid, { [channel]: value });
    } catch (err) {
      console.warn('Failed to sync notification preference:', err);
    }
  }, [uid, updateSetting]);

  const handleLanguage = async (code) => {
    try {
      await i18n.changeLanguage(code);
      updateSetting('appearance.language', code);
      toast.success(t('settings.languageChanged'));
    } catch {
      toast.error(t('settings.saveFailed'));
    }
  };

  const handleClearCache = async () => {
    try {
      const res = await settingsService.clearApplicationCache();
      toast.success(t('settings.cacheCleared', { count: res.cleared.length }));
    } catch {
      toast.error(t('settings.cacheClearFailed'));
    }
  };

  const handleLogout = async () => {
    try {
      if (signOut) await signOut();
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  const handleDeleteAccount = async () => {
    if (!uid) return;
    setDeleting(true);
    try {
      const { default: userService } = await import('../services/userService.js');
      await userService.deleteAccount(uid);
      setShowDeleteConfirm(false);
      toast.success(t('settings.accountDeleted'));
      navigate('/login');
    } catch {
      setDeleting(false);
      toast.error(t('settings.accountDeleteFailed'));
    }
  };

  const toggleThemeSafe = useCallback(() => {
    try {
      toggleTheme?.();
    } catch {
      /* noop */
    }
  }, [toggleTheme]);

  if (!settings) {
    return (
      <div className={cn('min-h-screen pb-24 transition-colors duration-200', isDark ? 'bg-[#0B0F17] text-white' : 'bg-gray-50 text-gray-900')}>
        <div className="max-w-3xl mx-auto px-4 pt-8 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full rounded-3xl" />
          <Skeleton className="h-72 w-full rounded-3xl" />
          <Skeleton className="h-52 w-full rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('min-h-screen pb-24 transition-colors duration-200', isDark ? 'bg-[#0B0F17] text-white' : 'bg-gray-50 text-gray-900')}>
      <main className="max-w-3xl mx-auto px-4 pt-4 sm:pt-6 space-y-6">
        {/* Page Heading & Summary */}
        <div className="pb-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Settings &amp; Preferences
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Manage your account security, appearance, notifications, and privacy preferences
          </p>
        </div>

        {/* ============ LEVEL & PROGRESS ============ */}
        {levelInfo && (
          <section className="rounded-3xl p-5 border shadow-sm bg-gradient-to-br from-purple-600/15 via-indigo-600/10 to-transparent border-purple-500/20">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div className="flex items-center gap-2.5 text-xs font-bold text-purple-400 uppercase tracking-wider">
                <Trophy className="w-4 h-4" aria-hidden="true" />
                <span>{t('level.title')}</span>
              </div>
              <button
                type="button"
                onClick={() => { setRoadmapTab('levels'); setShowRoadmapModal(true); }}
                className="text-xs font-bold text-purple-400 hover:text-purple-300 inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Perks &amp; Appearance Roadmap</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex flex-col items-center justify-center text-white shadow-lg shrink-0"
                aria-label={`${t('level.level')} ${levelInfo.level}`}
              >
                <span className="text-2xl font-black leading-none">{levelInfo.level}</span>
                <span className="text-[9px] uppercase tracking-wider opacity-80">{t('level.level')}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-lg leading-tight">{levelInfo.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {levelInfo.isMaxLevel
                    ? t('level.maxLevel')
                    : t('level.xpToNext', { xp: levelInfo.xpToNext })}
                </p>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(levelInfo.progress)}
                  aria-label={`${t('level.progress')} ${Math.round(levelInfo.progress)}%`}
                  className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden"
                >
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 rounded-full transition-all duration-500"
                    style={{ width: `${levelInfo.progress}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  {levelInfo.isMaxLevel
                    ? t('level.maxLevelDesc')
                    : t('level.xpProgress', {
                        xp: Math.round(levelInfo.xpIntoLevel),
                        // `nextLevelXp` is an absolute total; the numerator is
                        // relative, so the level span is the honest denominator.
                        next: levelInfo.nextLevelXp - levelInfo.currentLevelXp,
                      })}
                </p>
              </div>
              <div className="text-right shrink-0 hidden sm:block">
                <p className="text-[10px] uppercase tracking-wider text-gray-400">{t('level.rewardsEarned')}</p>
                <p className="font-black text-amber-400 text-lg">+{getLifetimeRewards(levelInfo.level)} 🪙</p>
              </div>
            </div>

            {/* Active Unlocked Perks */}
            <div className="mt-4 flex flex-wrap gap-2">
              {getPerksForLevel(levelInfo.level).map((perk) => (
                <span
                  key={perk.title}
                  title={perk.description}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/5 border border-white/10"
                >
                  <span aria-hidden="true">{perk.icon}</span> {perk.title}
                </span>
              ))}
              {getPerksForLevel(levelInfo.level).length === 0 && (
                <p className="text-xs text-gray-400">{t('level.noPerksYet')}</p>
              )}
            </div>

            {/* Level Appearance Unlocks Tracker */}
            <div className="mt-4 pt-3 border-t border-white/10 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">
                  Appearance &amp; Cosmetic Unlocks
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  Level {levelInfo.level} of 100
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const gates = LEVEL_GATES;
                  return (
                    <>
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5",
                        levelInfo.level >= gates.advancedEditor 
                          ? "bg-purple-500/15 border-purple-500/30 text-purple-300" 
                          : "bg-white/5 border-white/10 text-gray-500"
                      )}>
                        <span>✏️</span> Status &amp; Bio Customization {levelInfo.level < gates.advancedEditor && `• Unlocks Lvl ${gates.advancedEditor}`}
                      </span>
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5",
                        levelInfo.level >= gates.customBadge
                          ? "bg-amber-500/15 border-amber-500/30 text-amber-300" 
                          : "bg-white/5 border-white/10 text-gray-500"
                      )}>
                        <span>🏷️</span> Custom Badge {levelInfo.level < gates.customBadge && `• Unlocks Lvl ${gates.customBadge}`}
                      </span>
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5",
                        levelInfo.level >= gates.verifiedPriority
                          ? "bg-blue-500/15 border-blue-500/30 text-blue-300" 
                          : "bg-white/5 border-white/10 text-gray-500"
                      )}>
                        <span>🎨</span> Custom Profile Accent {levelInfo.level < gates.verifiedPriority && `• Unlocks Lvl ${gates.verifiedPriority}`}
                      </span>
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5",
                        levelInfo.level >= gates.sovereign
                          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" 
                          : "bg-white/5 border-white/10 text-gray-500"
                      )}>
                        <span>💎</span> Cornerstone Aura Glow {levelInfo.level < gates.sovereign && `• Unlocks Lvl ${gates.sovereign}`}
                      </span>
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[11px] font-semibold border flex items-center gap-1.5",
                        levelInfo.level >= gates.transcendent
                          ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-300" 
                          : "bg-white/5 border-white/10 text-gray-500"
                      )}>
                        <span>👑</span> Monarch Halo {levelInfo.level < gates.transcendent && `• Unlocks Lvl ${gates.transcendent}`}
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>
          </section>
        )}

        {/* ============ ACCOUNT & IDENTITY ============ */}
        <Section icon={User} title={t('settings.accountSection')}>
          <NavRow icon={User} label={t('settings.editProfile')} description={t('settings.editProfileDesc')} onClick={() => navigate('/profile/edit')} />
          <NavRow icon={ShieldCheck} label={t('settings.securityPassword')} description={t('settings.securityPasswordDesc')} onClick={() => navigate('/reset-password')} />
          <NavRow icon={DollarSign} label={t('settings.wallet')} description={t('settings.walletDesc')} onClick={() => navigate('/coins')} />
          <NavRow icon={Activity} label={t('settings.dataUsage')} description={t('settings.dataUsageDesc')} onClick={() => navigate('/settings/data-usage')} />
        </Section>

        {/* ============ APPEARANCE ============ */}
        <Section id="settings-appearance" icon={Sparkles} title={t('settings.appearanceSection')}>
          <div className="w-full py-3.5 flex items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              {isDark ? <Moon className="w-4 h-4 mt-0.5 text-purple-400" aria-hidden="true" /> : <Sun className="w-4 h-4 mt-0.5 text-purple-400" aria-hidden="true" />}
              <div>
                <p className="font-bold text-sm">{t('settings.theme')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{isDark ? t('settings.themeDark') : t('settings.themeLight')}</p>
              </div>
            </div>
            <button
              onClick={toggleThemeSafe}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow min-h-[36px]"
            >
              {isDark ? t('settings.switchLight') : t('settings.switchDark')}
            </button>
          </div>

          <ToggleRow
            icon={Activity}
            label={t('settings.reduceMotion')}
            description={t('settings.reduceMotionDesc')}
            checked={settings.appearance.reduceMotion}
            onChange={handleReduceMotion}
          />

          <div className="w-full py-3.5">
            <div className="flex items-start gap-3 mb-2">
              <Languages className="w-4 h-4 mt-0.5 text-purple-400" aria-hidden="true" />
              <div>
                <p className="font-bold text-sm">{t('settings.language')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t('settings.languageDesc')}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pl-7" role="group" aria-label={t('settings.language')}>
              {SUPPORTED_LOCALES.map((locale) => (
                <OptionPill
                  key={locale.code}
                  label={locale.label}
                  active={i18n.language?.startsWith(locale.code) || settings.appearance.language === locale.code}
                  onClick={() => handleLanguage(locale.code)}
                />
              ))}
            </div>
          </div>
        </Section>

        {/* ============ NOTIFICATIONS ============ */}
        <Section icon={Bell} title={t('settings.notificationsSection')}>
          <ToggleRow icon={Bell} label={t('settings.pushNotifs')} checked={settings.notifications.push} onChange={(v) => handleNotificationChannel('notifications.push', v)} />
          <ToggleRow icon={MailIcon} label={t('settings.emailNotifs')} checked={settings.notifications.email} onChange={(v) => handleNotificationChannel('notifications.email', v)} />
          <ToggleRow icon={Volume2} label={t('settings.soundFx')} checked={settings.notifications.soundFx} onChange={(v) => updateSetting('notifications.soundFx', v)} />
        </Section>

        {/* ============ PRIVACY & AUDIENCE GOVERNANCE ============ */}
        <Section id="settings-privacy" icon={Shield} title={t('settings.privacySection')}>
          <ToggleRow
            icon={Eye}
            label={t('settings.privateProfile')}
            description={t('settings.privateProfileDesc')}
            checked={profileIsPrivate}
            onChange={handleToggleProfilePrivate}
          />
          <ToggleRow
            icon={Activity}
            label={t('settings.activeStatus')}
            description="Broadcast your live presence status to permitted circles"
            checked={settings.privacy.showActiveStatus}
            onChange={(v) => {
              updateSetting('privacy.showActiveStatus', v);
              handleUpdateProfilePrivacyScope('presence', v ? VISIBILITY_SCOPES.FOLLOWERS : VISIBILITY_SCOPES.ONLY_ME);
            }}
          />

          {/* Granular Scope Selectors */}
          <div className="w-full py-3.5 space-y-3 border-t border-gray-100 dark:border-white/5">
            <p className="text-xs font-bold uppercase tracking-wider text-purple-400">Audience &amp; Visibility Permissions</p>

            {/* Profile Discovery Scope */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-bold text-sm">Profile Discovery</p>
                <p className="text-xs text-gray-400 mt-0.5">Who can view your full bio and public identity card</p>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group">
                {[
                  { id: VISIBILITY_SCOPES.EVERYONE, label: 'Everyone' },
                  { id: VISIBILITY_SCOPES.CONNECTIONS, label: 'Connections' },
                  { id: VISIBILITY_SCOPES.ONLY_ME, label: 'Only Me' }
                ].map((s) => (
                  <OptionPill
                    key={s.id}
                    label={s.label}
                    active={(profilePrivacy.profileInfo || VISIBILITY_SCOPES.EVERYONE) === s.id}
                    onClick={() => handleUpdateProfilePrivacyScope('profileInfo', s.id)}
                  />
                ))}
              </div>
            </div>

            {/* Live Presence Scope */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-bold text-sm">Live Online Presence</p>
                <p className="text-xs text-gray-400 mt-0.5">Who can see when you are active on the platform</p>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group">
                {[
                  { id: VISIBILITY_SCOPES.EVERYONE, label: 'Everyone' },
                  { id: VISIBILITY_SCOPES.FOLLOWERS, label: 'Followers' },
                  { id: VISIBILITY_SCOPES.CONNECTIONS, label: 'Connections' },
                  { id: VISIBILITY_SCOPES.ONLY_ME, label: 'Nobody' }
                ].map((s) => (
                  <OptionPill
                    key={s.id}
                    label={s.label}
                    active={(profilePrivacy.presence || VISIBILITY_SCOPES.FOLLOWERS) === s.id}
                    onClick={() => handleUpdateProfilePrivacyScope('presence', s.id)}
                  />
                ))}
              </div>
            </div>

            {/* Social Graph Scope */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-bold text-sm">Followers &amp; Following List</p>
                <p className="text-xs text-gray-400 mt-0.5">Who can inspect your follower and following social graph</p>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group">
                {[
                  { id: VISIBILITY_SCOPES.EVERYONE, label: 'Everyone' },
                  { id: VISIBILITY_SCOPES.CONNECTIONS, label: 'Connections' },
                  { id: VISIBILITY_SCOPES.ONLY_ME, label: 'Only Me' }
                ].map((s) => (
                  <OptionPill
                    key={s.id}
                    label={s.label}
                    active={(profilePrivacy.followersList || VISIBILITY_SCOPES.EVERYONE) === s.id}
                    onClick={() => {
                      handleUpdateProfilePrivacyScope('followersList', s.id);
                      handleUpdateProfilePrivacyScope('followingList', s.id);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Civic Standing & Badges Scope */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-bold text-sm">Civic Badges &amp; Milestones</p>
                <p className="text-xs text-gray-400 mt-0.5">Who can view your earned badges, level, and accomplishments</p>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group">
                {[
                  { id: VISIBILITY_SCOPES.EVERYONE, label: 'Everyone' },
                  { id: VISIBILITY_SCOPES.FOLLOWERS, label: 'Followers' },
                  { id: VISIBILITY_SCOPES.CONNECTIONS, label: 'Connections' },
                  { id: VISIBILITY_SCOPES.ONLY_ME, label: 'Only Me' }
                ].map((s) => (
                  <OptionPill
                    key={s.id}
                    label={s.label}
                    active={(profilePrivacy.activity || VISIBILITY_SCOPES.EVERYONE) === s.id}
                    onClick={() => {
                      handleUpdateProfilePrivacyScope('activity', s.id);
                      handleUpdateProfilePrivacyScope('achievements', s.id);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Large Coin Treasury Privacy Card */}
            <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
              <div>
                <p className="font-bold text-sm">Large Coin Treasury Card Display</p>
                <p className="text-xs text-gray-400 mt-0.5">Showcase total coin treasury proudly or keep confidential</p>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group">
                {[
                  { id: VISIBILITY_SCOPES.ONLY_ME, label: '🔒 Only Me (Confidential)' },
                  { id: VISIBILITY_SCOPES.CONNECTIONS, label: '👥 Connections' },
                  { id: VISIBILITY_SCOPES.EVERYONE, label: '🌐 Public Showcase' }
                ].map((s) => (
                  <OptionPill
                    key={s.id}
                    label={s.label}
                    active={(profilePrivacy.economicStatus || VISIBILITY_SCOPES.ONLY_ME) === s.id}
                    onClick={() => handleUpdateProfilePrivacyScope('economicStatus', s.id)}
                  />
                ))}
              </div>
            </div>

            {/* Creator Suite Scope (creatorInfo) */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-bold text-sm">Creator Suite</p>
                <p className="text-xs text-gray-400 mt-0.5">Who can see your creator discipline, business contact and patronage note</p>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group">
                {[
                  { id: VISIBILITY_SCOPES.EVERYONE, label: 'Everyone' },
                  { id: VISIBILITY_SCOPES.FOLLOWERS, label: 'Followers' },
                  { id: VISIBILITY_SCOPES.CONNECTIONS, label: 'Connections' },
                  { id: VISIBILITY_SCOPES.ONLY_ME, label: 'Only Me' }
                ].map((s) => (
                  <OptionPill
                    key={s.id}
                    label={s.label}
                    active={(profilePrivacy.creatorInfo || VISIBILITY_SCOPES.EVERYONE) === s.id}
                    onClick={() => handleUpdateProfilePrivacyScope('creatorInfo', s.id)}
                  />
                ))}
              </div>
            </div>

          </div>

          <div className="w-full py-3.5">
            <div className="flex items-start gap-3 mb-2">
              <Lock className="w-4 h-4 mt-0.5 text-purple-400" aria-hidden="true" />
              <div>
                <p className="font-bold text-sm">{t('settings.allowDMs')}</p>
                <p className="text-xs text-gray-400 mt-0.5">Who can initiate direct messages with you</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pl-7" role="group" aria-label={t('settings.allowDMs')}>
              {['everyone', 'friends', 'none'].map((opt) => (
                <OptionPill
                  key={opt}
                  label={t(`settings.dmOption.${opt}`)}
                  active={settings.privacy.allowDMs === opt}
                  onClick={() => updateSetting('privacy.allowDMs', opt)}
                />
              ))}
            </div>
          </div>
        </Section>

        {/* ============ PLAYBACK ============ */}
        <Section icon={Video} title={t('settings.playbackSection')}>
          <ToggleRow icon={Video} label={t('settings.autoPlay')} checked={settings.playback.autoPlayVideos} onChange={(v) => updateSetting('playback.autoPlayVideos', v)} />
        </Section>

        {/* ============ DATA & CACHE ============ */}
        <Section id="settings-data" icon={Database} title={t('settings.dataSection')}>
          <button onClick={handleClearCache} className="w-full py-3.5 flex items-center justify-between text-left group">
            <div className="flex items-start gap-3">
              <RefreshCw className="w-4 h-4 mt-0.5 text-purple-400" aria-hidden="true" />
              <div>
                <p className="font-bold text-sm group-hover:text-purple-400 transition-colors">{t('settings.clearCache')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t('settings.clearCacheDesc')}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
          </button>
          <NavRow icon={Info} label={t('settings.about')} description="Arvdoul v1.0.0" onClick={() => navigate('/profile/about')} />
        </Section>

        {/* ============ DANGER ZONE ============ */}
        <Section icon={AlertTriangle} title={t('settings.dangerSection')}>
          <button onClick={handleLogout} className="w-full py-3.5 flex items-center justify-between text-left group">
            <div className="flex items-start gap-3">
              <LogOut className="w-4 h-4 mt-0.5 text-amber-400" aria-hidden="true" />
              <div>
                <p className="font-bold text-sm text-amber-500 group-hover:text-amber-400 transition-colors">{t('settings.signOut')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t('settings.signOutDesc')}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
          </button>
          <button onClick={() => setShowDeleteConfirm(true)} className="w-full py-3.5 flex items-center justify-between text-left group">
            <div className="flex items-start gap-3">
              <Trash2 className="w-4 h-4 mt-0.5 text-red-400" aria-hidden="true" />
              <div>
                <p className="font-bold text-sm text-red-500 group-hover:text-red-400 transition-colors">{t('settings.deleteAccount')}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t('settings.deleteAccountDesc')}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
          </button>
        </Section>
      </main>

      {/* Delete account confirmation (accessible Dialog) */}
      <Dialog isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title={t('settings.deleteAccount')} size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" aria-hidden="true" />
            <p className="text-sm text-gray-700 dark:text-gray-200">{t('settings.deleteWarning')}</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-gray-300 dark:border-white/15 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors min-h-[44px]"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-500 shadow-lg disabled:opacity-60 min-h-[44px]"
            >
              {deleting ? t('settings.deleting') : t('settings.confirmDelete')}
            </button>
          </div>
        </div>
      </Dialog>
      {/* Interactive Level Perks & Appearance Roadmap Modal */}
      {showRoadmapModal && (
        <ProfileSystemRoadmapModal
          isOpen={showRoadmapModal}
          onClose={() => setShowRoadmapModal(false)}
          initialTab={roadmapTab}
          profile={storeProfile || { level: levelInfo?.level, experience: levelInfo?.currentLevelXp }}
          theme={theme}
          userId={uid}
        />
      )}
    </div>
  );
}

// Small local icon helper (avoids an extra import churn)
function MailIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true" {...props}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
