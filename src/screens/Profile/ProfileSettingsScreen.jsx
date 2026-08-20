/**
 * src/screens/Profile/ProfileSettingsScreen.jsx - ARVDOUL CREATOR & PROFILE SETTINGS
 * 
 * Pixel-perfect settings suite with Account, Privacy, Creator Monetization,
 * Notification preferences, Audio/Video Playback, and Security controls.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, User, Shield, Bell, Lock, Volume2, Video,
  Sparkles, DollarSign, Database, Moon, Sun, Smartphone,
  ChevronRight, Check, AlertTriangle, Eye, Key, RefreshCw,
  Sliders, ShieldCheck, Heart, Trash2, LogOut, Radio, Globe
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

export default function ProfileSettingsScreen() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const isDark = theme !== 'light';

  // Toggle states
  const [isPrivate, setIsPrivate] = useState(false);
  const [showActiveStatus, setShowActiveStatus] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [allowDMs, setAllowDMs] = useState('everyone'); // 'everyone' | 'mutual' | 'none'
  const [allowComments, setAllowComments] = useState('everyone');
  const [autoPlayReels, setAutoPlayReels] = useState(true);
  const [spatialAudio, setSpatialAudio] = useState(true);
  const [streamQuality, setStreamQuality] = useState('4k');
  const [pushNotifs, setPushNotifs] = useState(true);
  const [coinGiftsNotifs, setCoinGiftsNotifs] = useState(true);
  const [mentionNotifs, setMentionNotifs] = useState(true);
  const [showClearCacheModal, setShowClearCacheModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  // Clear cache handler
  const handleClearCache = () => {
    try {
      const keysToPreserve = ['auth_token', 'user_session', 'arvdoul_theme'];
      Object.keys(localStorage).forEach((key) => {
        if (!keysToPreserve.includes(key)) {
          localStorage.removeItem(key);
        }
      });
      setShowClearCacheModal(false);
      toast.success('Profile cache and offline temp data purged ✨');
    } catch {
      toast.error('Failed to clear cache');
    }
  };

  const handleLogout = async () => {
    try {
      if (signOut) await signOut();
      toast.success('Signed out of ARVDOUL');
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  return (
    <div className={cn(
      "min-h-screen pb-28 transition-colors duration-200",
      isDark ? "bg-[#060816] text-white" : "bg-[#f4f7fb] text-gray-900"
    )}>
      {/* Sticky Header */}
      <header className={cn(
        "sticky top-0 z-40 backdrop-blur-xl border-b transition-colors",
        isDark ? "bg-[#060816]/85 border-white/10" : "bg-white/85 border-gray-200"
      )}>
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className={cn(
                "p-2 rounded-full transition-all",
                isDark ? "hover:bg-white/10 text-gray-300" : "hover:bg-gray-100 text-gray-700"
              )}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md">
                <Sliders className="w-4 h-4" />
              </div>
              <h1 className="font-bold text-lg">Profile & Creator Settings</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Settings Body */}
      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {/* Creator Account Card */}
        <section className={cn(
          "rounded-3xl p-5 border space-y-4 shadow-sm",
          isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center gap-2.5 text-xs font-bold text-purple-400 uppercase tracking-wider">
            <User className="w-4 h-4" />
            <span>Profile Identity</span>
          </div>

          <div className="divide-y divide-white/5">
            <button
              onClick={() => navigate('/profile/edit')}
              className="w-full py-3.5 flex items-center justify-between text-left group"
            >
              <div>
                <p className="font-bold text-sm group-hover:text-purple-400 transition-colors">Edit Profile Information</p>
                <p className="text-xs text-gray-400">Display name, username, bio, website link, avatar & cover</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => navigate('/profile/highlights')}
              className="w-full py-3.5 flex items-center justify-between text-left group"
            >
              <div>
                <p className="font-bold text-sm group-hover:text-purple-400 transition-colors">Manage Profile Highlights</p>
                <p className="text-xs text-gray-400">Reorganize, create, or archive pinned story highlights</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => navigate('/profile/analytics')}
              className="w-full py-3.5 flex items-center justify-between text-left group"
            >
              <div>
                <p className="font-bold text-sm group-hover:text-purple-400 transition-colors">Creator Studio & Analytics</p>
                <p className="text-xs text-gray-400">Impressions, viral scores, subscriber retention, and rankings</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </section>

        {/* Privacy & Safety */}
        <section className={cn(
          "rounded-3xl p-5 border space-y-4 shadow-sm",
          isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center gap-2.5 text-xs font-bold text-cyan-400 uppercase tracking-wider">
            <Shield className="w-4 h-4" />
            <span>Privacy & Audience</span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="font-bold text-sm">Private Account</p>
                <p className="text-xs text-gray-400">Only approved followers can view your posts and reels</p>
              </div>
              <button
                onClick={() => {
                  setIsPrivate(!isPrivate);
                  toast.success(isPrivate ? 'Account is now Public' : 'Account is now Private');
                }}
                className={cn(
                  "w-12 h-6.5 rounded-full transition-colors relative p-0.5",
                  isPrivate ? "bg-cyan-500" : "bg-gray-600"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full bg-white transition-transform shadow-md",
                  isPrivate ? "translate-x-5.5" : "translate-x-0.5"
                )} />
              </button>
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="font-bold text-sm">Activity & Online Status</p>
                <p className="text-xs text-gray-400">Show when you are active on ARVDOUL</p>
              </div>
              <button
                onClick={() => setShowActiveStatus(!showActiveStatus)}
                className={cn(
                  "w-12 h-6.5 rounded-full transition-colors relative p-0.5",
                  showActiveStatus ? "bg-purple-600" : "bg-gray-600"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full bg-white transition-transform shadow-md",
                  showActiveStatus ? "translate-x-5.5" : "translate-x-0.5"
                )} />
              </button>
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="font-bold text-sm">Read Receipts in Messages</p>
                <p className="text-xs text-gray-400">Let others know when you have seen their chats</p>
              </div>
              <button
                onClick={() => setReadReceipts(!readReceipts)}
                className={cn(
                  "w-12 h-6.5 rounded-full transition-colors relative p-0.5",
                  readReceipts ? "bg-purple-600" : "bg-gray-600"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full bg-white transition-transform shadow-md",
                  readReceipts ? "translate-x-5.5" : "translate-x-0.5"
                )} />
              </button>
            </div>
          </div>
        </section>

        {/* Playback & Media */}
        <section className={cn(
          "rounded-3xl p-5 border space-y-4 shadow-sm",
          isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center gap-2.5 text-xs font-bold text-pink-400 uppercase tracking-wider">
            <Volume2 className="w-4 h-4" />
            <span>Audio, Video & Display</span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="font-bold text-sm">Spatial Audio Processing</p>
                <p className="text-xs text-gray-400">Immersive 3D audio rendering for creator soundscapes</p>
              </div>
              <button
                onClick={() => {
                  setSpatialAudio(!spatialAudio);
                  toast.success(spatialAudio ? 'Spatial Audio disabled' : 'Spatial Audio enabled 🎧');
                }}
                className={cn(
                  "w-12 h-6.5 rounded-full transition-colors relative p-0.5",
                  spatialAudio ? "bg-pink-500" : "bg-gray-600"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full bg-white transition-transform shadow-md",
                  spatialAudio ? "translate-x-5.5" : "translate-x-0.5"
                )} />
              </button>
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="font-bold text-sm">Autoplay Videos & Reels</p>
                <p className="text-xs text-gray-400">Play next video automatically in fullscreen mode</p>
              </div>
              <button
                onClick={() => setAutoPlayReels(!autoPlayReels)}
                className={cn(
                  "w-12 h-6.5 rounded-full transition-colors relative p-0.5",
                  autoPlayReels ? "bg-purple-600" : "bg-gray-600"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full bg-white transition-transform shadow-md",
                  autoPlayReels ? "translate-x-5.5" : "translate-x-0.5"
                )} />
              </button>
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="font-bold text-sm">Appearance Theme</p>
                <p className="text-xs text-gray-400">Switch between dark cosmic and crisp light theme</p>
              </div>
              <button
                onClick={toggleTheme}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all",
                  isDark ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "bg-orange-500/20 text-orange-600 border border-orange-500/30"
                )}
              >
                {isDark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                <span>{isDark ? 'Cosmic Dark' : 'Daylight'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Notifications & Gifts */}
        <section className={cn(
          "rounded-3xl p-5 border space-y-4 shadow-sm",
          isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center gap-2.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <Bell className="w-4 h-4" />
            <span>Alerts & Coin Tips</span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="font-bold text-sm">Coin Gift Alerts</p>
                <p className="text-xs text-gray-400">Instant notification when a viewer sends you coins</p>
              </div>
              <button
                onClick={() => setCoinGiftsNotifs(!coinGiftsNotifs)}
                className={cn(
                  "w-12 h-6.5 rounded-full transition-colors relative p-0.5",
                  coinGiftsNotifs ? "bg-amber-500" : "bg-gray-600"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full bg-white transition-transform shadow-md",
                  coinGiftsNotifs ? "translate-x-5.5" : "translate-x-0.5"
                )} />
              </button>
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="font-bold text-sm">Push Notifications</p>
                <p className="text-xs text-gray-400">Receive alerts when offline</p>
              </div>
              <button
                onClick={() => setPushNotifs(!pushNotifs)}
                className={cn(
                  "w-12 h-6.5 rounded-full transition-colors relative p-0.5",
                  pushNotifs ? "bg-purple-600" : "bg-gray-600"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full bg-white transition-transform shadow-md",
                  pushNotifs ? "translate-x-5.5" : "translate-x-0.5"
                )} />
              </button>
            </div>
          </div>
        </section>

        {/* Data & Storage */}
        <section className={cn(
          "rounded-3xl p-5 border space-y-3 shadow-sm",
          isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center gap-2.5 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            <Database className="w-4 h-4" />
            <span>Cache & Storage</span>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-bold text-sm">Clear Offline Media Cache</p>
              <p className="text-xs text-gray-400">Free up local browser storage and temporary assets</p>
            </div>
            <button
              onClick={() => setShowClearCacheModal(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 transition-colors"
            >
              Clear
            </button>
          </div>
        </section>

        {/* Session & Sign Out */}
        <section className="pt-2 space-y-3">
          <button
            onClick={handleLogout}
            className="w-full py-3.5 rounded-2xl font-bold text-sm bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out of ARVDOUL</span>
          </button>
        </section>
      </main>

      {/* Clear Cache Confirmation Dialog */}
      {showClearCacheModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className={cn(
            "w-full max-w-sm rounded-3xl p-6 border shadow-2xl space-y-4",
            isDark ? "bg-[#0b1220] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
          )}>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <Database className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-bold text-lg">Clear Local Cache?</h3>
              <p className="text-xs text-gray-400">This will purge temporary images, video caches, and draft previews. Your account and cloud data remain completely safe.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => setShowClearCacheModal(false)}
                className="py-2.5 rounded-xl font-semibold text-sm bg-white/10 hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearCache}
                className="py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md hover:opacity-95"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
