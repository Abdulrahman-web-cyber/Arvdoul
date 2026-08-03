// src/screens/SettingsScreen.jsx - ARVDOUL SETTINGS (REAL)
// Profile, security (password/MFA), notifications, appearance, data controls.
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '@context/ThemeContext';
import { cn } from '../lib/utils';
import {
  ArrowLeft, User, KeyRound, Bell, Palette, Shield, Trash2, LogOut,
  ChevronRight, Loader2, Moon, Sun, Monitor
} from 'lucide-react';

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  const [prefs, setPrefs] = useState(null);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const loadPrefs = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const { getNotificationsService } = await import('../services/notificationsService.js');
      const svc = getNotificationsService();
      const p = await svc.getUserNotificationPreferences(user.uid);
      setPrefs(p || {});
    } catch (err) {
      setPrefs(null);
    } finally {
      setPrefsLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => { loadPrefs(); }, [loadPrefs]);

  const togglePref = async (key, value) => {
    if (!user?.uid) return;
    try {
      const { getNotificationsService } = await import('../services/notificationsService.js');
      await getNotificationsService().updateUserNotificationPreferences(user.uid, { [key]: value });
      setPrefs((p) => ({ ...p, [key]: value }));
      toast.success('Preferences updated');
    } catch (err) {
      toast.error('Could not update preferences.');
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email || sendingReset) return;
    setSendingReset(true);
    try {
      const { sendPasswordResetEmail } = await import('../services/authService.js');
      await sendPasswordResetEmail(user.email);
      toast.success(`Password reset email sent to ${user.email}`);
    } catch (err) {
      toast.error(err?.message || 'Could not send reset email.');
    } finally {
      setSendingReset(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.uid || deleting) return;
    if (!window.confirm('Delete your account permanently? This cannot be undone.')) return;
    setDeleting(true);
    try {
      const { getUserService } = await import('../services/userService.js');
      await getUserService().deleteAccount(user.uid);
      toast.success('Account deletion scheduled.');
      await signOut();
      navigate('/login');
    } catch (err) {
      toast.error('Account deletion failed.');
      setDeleting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isDark = theme === 'dark';
  const colors = {
    bg: isDark ? 'bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a]' : 'bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8]',
    card: isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-white/90 border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    secondary: isDark ? 'text-gray-400' : 'text-gray-600',
  };

  const Row = ({ icon: Icon, title, subtitle, onClick, danger = false, right }) => (
    <button
      onClick={onClick}
      className={cn("w-full flex items-center gap-3 p-4 rounded-xl transition hover:opacity-90", colors.card, "border")}
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", danger ? "bg-red-500/15 text-red-500" : "bg-violet-500/15 text-violet-500")}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className={cn("font-medium text-sm", colors.text)}>{title}</p>
        {subtitle && <p className={cn("text-xs truncate", colors.secondary)}>{subtitle}</p>}
      </div>
      {right || <ChevronRight className={cn("w-4 h-4", colors.secondary)} />}
    </button>
  );

  const Switch = ({ checked, onChange }) => (
    <button
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={cn("w-11 h-6 rounded-full transition-colors relative", checked ? "bg-violet-500" : "bg-gray-300 dark:bg-gray-700")}
    >
      <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  );

  return (
    <div className={cn("min-h-screen pb-16", colors.bg)}>
      <div className={cn("sticky top-0 z-50 border-b backdrop-blur-xl", colors.card, "border")}>
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label="Go back" className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className={cn("text-xl font-bold", colors.text)}>Settings</h1>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Profile */}
        <section>
          <h2 className={cn("text-xs font-semibold uppercase tracking-wider mb-2 px-1", colors.secondary)}>Account</h2>
          <div className="space-y-2">
            <Row icon={User} title="Edit Profile" subtitle={user?.displayName || user?.username || 'Update your profile'} onClick={() => navigate('/profile/edit')} />
            <Row icon={KeyRound} title="Change Password" subtitle="Send a password reset email" onClick={handlePasswordReset} right={sendingReset ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined} />
            <Row icon={Shield} title="Security" subtitle="MFA & verification status" onClick={() => navigate('/profile/settings')} />
          </div>
        </section>

        {/* Notifications */}
        <section>
          <h2 className={cn("text-xs font-semibold uppercase tracking-wider mb-2 px-1", colors.secondary)}>Notifications</h2>
          {prefsLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-violet-500 animate-spin" /></div>
          ) : (
            <div className={cn("rounded-xl divide-y", colors.card, "border")}>
              {[
                { key: 'pushEnabled', label: 'Push Notifications', def: true },
                { key: 'emailEnabled', label: 'Email Notifications', def: true },
                { key: 'inAppEnabled', label: 'In-App Notifications', def: true },
              ].map(({ key, label, def }) => (
                <div key={key} className="flex items-center justify-between p-4">
                  <p className={cn("text-sm font-medium", colors.text)}>{label}</p>
                  <Switch checked={prefs?.[key] ?? def} onChange={(v) => togglePref(key, v)} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Appearance */}
        <section>
          <h2 className={cn("text-xs font-semibold uppercase tracking-wider mb-2 px-1", colors.secondary)}>Appearance</h2>
          <div className={cn("rounded-xl p-2", colors.card, "border")}>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'light', icon: Sun, label: 'Light' },
                { id: 'dark', icon: Moon, label: 'Dark' },
                { id: 'system', icon: Monitor, label: 'System' },
              ].map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setTheme(id)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl transition",
                    (theme === id) ? "bg-violet-500/20 text-violet-500" : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className={cn("text-xs font-medium", colors.text)}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Data */}
        <section>
          <h2 className={cn("text-xs font-semibold uppercase tracking-wider mb-2 px-1", colors.secondary)}>Data</h2>
          <div className="space-y-2">
            <Row icon={Bell} title="Notification History" subtitle="View all your notifications" onClick={() => navigate('/notifications')} />
            <Row icon={Palette} title="Saved & Collections" subtitle="Manage your saved content" onClick={() => navigate('/saved')} />
          </div>
        </section>

        {/* Danger */}
        <section>
          <h2 className={cn("text-xs font-semibold uppercase tracking-wider mb-2 px-1 text-red-500")}>Danger Zone</h2>
          <div className="space-y-2">
            <Row icon={LogOut} title="Sign Out" onClick={handleSignOut} />
            <Row icon={Trash2} title="Delete Account" subtitle="Permanently delete your account" danger onClick={handleDeleteAccount} right={deleting ? <Loader2 className="w-4 h-4 animate-spin text-red-500" /> : undefined} />
          </div>
        </section>
      </main>
    </div>
  );
}
