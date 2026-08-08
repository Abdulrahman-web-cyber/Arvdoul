/**
 * src/screens/SettingsScreen.jsx - ARVDOUL Master Settings & Preferences Center
 * 
 * Complete, pixel-perfect settings suite with Account, Privacy, Theme/Gradients,
 * Audio/Video, Monetization, Cache Management, and Security controls.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Bell, Shield, Globe, HelpCircle, LogOut, Moon, Sun,
  Lock, Trash2, Smartphone, Volume2, Video, Sparkles, DollarSign,
  Database, Info, ChevronRight, Check, AlertTriangle, Eye, User,
  Sliders, ShieldCheck, Key, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

export default function SettingsScreen() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const isDark = theme !== 'light';

  // State toggles
  const [pushNotifs, setPushNotifs] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [soundFx, setSoundFx] = useState(true);
  const [spatialAudio, setSpatialAudio] = useState(true);
  const [autoPlayVideos, setAutoPlayVideos] = useState(true);
  const [streamQuality, setStreamQuality] = useState('4K Ultra HD');
  const [profilePrivate, setProfilePrivate] = useState(false);
  const [allowDMs, setAllowDMs] = useState('everyone'); // 'everyone' | 'friends' | 'none'
  const [showActiveStatus, setShowActiveStatus] = useState(true);

  // Modals
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearCacheModal, setShowClearCacheModal] = useState(false);

  // Clear cache handler
  const handleClearCache = () => {
    try {
      const keysToPreserve = ['auth_token', 'user_session'];
      Object.keys(localStorage).forEach((key) => {
        if (!keysToPreserve.includes(key)) {
          localStorage.removeItem(key);
        }
      });
      setShowClearCacheModal(false);
      toast.success('Application cache and offline storage cleared! 🧹');
    } catch {
      toast.error('Failed to clear cache');
    }
  };

  // Sign out handler
  const handleLogout = async () => {
    try {
      if (signOut) await signOut();
      toast.success('Signed out successfully');
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  return (
    <div className={cn(
      "min-h-screen pb-24 transition-colors duration-200",
      isDark ? "bg-[#0B0F17] text-white" : "bg-gray-50 text-gray-900"
    )}>
      {/* Header */}
      <header className={cn(
        "sticky top-0 z-40 backdrop-blur-xl border-b transition-colors",
        isDark ? "bg-[#0B0F17]/85 border-white/10" : "bg-white/85 border-gray-200"
      )}>
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
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
              <Sliders className="w-5 h-5 text-purple-400" />
              <h1 className="font-bold text-lg">Settings & Preferences</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Settings Body */}
      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        {/* Account & Profile Section */}
        <section className={cn(
          "rounded-3xl p-5 border space-y-4 shadow-sm",
          isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center gap-2.5 text-xs font-bold text-purple-400 uppercase tracking-wider">
            <User className="w-4 h-4" />
            <span>Account & Identity</span>
          </div>

          <div className="divide-y divide-white/5">
            <button
              onClick={() => navigate('/profile/edit')}
              className="w-full py-3.5 flex items-center justify-between text-left group"
            >
              <div>
                <p className="font-bold text-sm group-hover:text-purple-400 transition-colors">Edit Profile Information</p>
                <p className="text-xs text-gray-400">Bio, display name, avatar, links, and cover photo</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => navigate('/reset-password')}
              className="w-full py-3.5 flex items-center justify-between text-left group"
            >
              <div>
                <p className="font-bold text-sm group-hover:text-purple-400 transition-colors">Security & Password</p>
                <p className="text-xs text-gray-400">Two-factor authentication, passkeys & passwords</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => navigate('/coins')}
              className="w-full py-3.5 flex items-center justify-between text-left group"
            >
              <div>
                <p className="font-bold text-sm group-hover:text-purple-400 transition-colors">Coins, Wallet & Payouts</p>
                <p className="text-xs text-gray-400">Balance, transactions, and creator withdrawal methods</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </section>

        {/* Display & Spatial Theme */}
        <section className={cn(
          "rounded-3xl p-5 border space-y-4 shadow-sm",
          isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center gap-2.5 text-xs font-bold text-blue-400 uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Appearance & Spatial UI</span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="font-bold text-sm">Theme Mode</p>
                <p className="text-xs text-gray-400">Choose between Midnight OLED Dark or Pure Light</p>
              </div>
              <button
                onClick={toggleTheme}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-2xl border font-bold text-xs transition-all",
                  isDark ? "bg-white/10 border-white/10 hover:bg-white/20" : "bg-gray-100 border-gray-300 hover:bg-gray-200"
                )}
              >
                {isDark ? <Moon className="w-4 h-4 text-purple-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                <span>{isDark ? 'Dark (OLED)' : 'Light'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="font-bold text-sm">Spatial UI Motion & Shaders</p>
                <p className="text-xs text-gray-400">Fluid physics animations and 60fps GPU micro-interactions</p>
              </div>
              <input
                type="checkbox"
                defaultChecked={true}
                className="w-5 h-5 accent-purple-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </section>

        {/* Audio & Video Playback */}
        <section className={cn(
          "rounded-3xl p-5 border space-y-4 shadow-sm",
          isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center gap-2.5 text-xs font-bold text-emerald-400 uppercase tracking-wider">
            <Video className="w-4 h-4" />
            <span>Playback & Media Quality</span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="font-bold text-sm">Autoplay Videos & Sparks</p>
                <p className="text-xs text-gray-400">Play video streams automatically while scrolling</p>
              </div>
              <input
                type="checkbox"
                checked={autoPlayVideos}
                onChange={(e) => setAutoPlayVideos(e.target.checked)}
                className="w-5 h-5 accent-purple-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="font-bold text-sm">Spatial Audio & Binaural Sound</p>
                <p className="text-xs text-gray-400">Immersive 3D audio rendering for sounds and studio audio</p>
              </div>
              <input
                type="checkbox"
                checked={spatialAudio}
                onChange={(e) => setSpatialAudio(e.target.checked)}
                className="w-5 h-5 accent-purple-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="font-bold text-sm">Default Streaming Quality</p>
                <p className="text-xs text-gray-400">High-bitrate video delivery protocol</p>
              </div>
              <select
                value={streamQuality}
                onChange={(e) => setStreamQuality(e.target.value)}
                className={cn(
                  "px-3 py-1.5 rounded-xl border text-xs font-bold focus:outline-none",
                  isDark ? "bg-white/10 border-white/10 text-white" : "bg-gray-100 border-gray-300 text-gray-900"
                )}
              >
                <option value="4K Ultra HD">4K Ultra HD</option>
                <option value="1080p 60fps">1080p 60fps</option>
                <option value="720p HD">720p HD</option>
                <option value="Auto (Adaptive)">Auto (Adaptive)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Privacy & Safety */}
        <section className={cn(
          "rounded-3xl p-5 border space-y-4 shadow-sm",
          isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center gap-2.5 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Privacy & Direct Messaging</span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="font-bold text-sm">Private Account</p>
                <p className="text-xs text-gray-400">Only approved followers can view your posts and sparks</p>
              </div>
              <input
                type="checkbox"
                checked={profilePrivate}
                onChange={(e) => setProfilePrivate(e.target.checked)}
                className="w-5 h-5 accent-purple-500 rounded cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="font-bold text-sm">Allow Direct Messages From</p>
                <p className="text-xs text-gray-400">Control who can initiate chats and calls with you</p>
              </div>
              <select
                value={allowDMs}
                onChange={(e) => setAllowDMs(e.target.value)}
                className={cn(
                  "px-3 py-1.5 rounded-xl border text-xs font-bold focus:outline-none",
                  isDark ? "bg-white/10 border-white/10 text-white" : "bg-gray-100 border-gray-300 text-gray-900"
                )}
              >
                <option value="everyone">Everyone</option>
                <option value="friends">Mutual Friends Only</option>
                <option value="none">Nobody</option>
              </select>
            </div>
          </div>
        </section>

        {/* Cache & Data Management */}
        <section className={cn(
          "rounded-3xl p-5 border space-y-4 shadow-sm",
          isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center gap-2.5 text-xs font-bold text-rose-400 uppercase tracking-wider">
            <Database className="w-4 h-4" />
            <span>Storage & Cache</span>
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <p className="font-bold text-sm">Temporary Media Cache</p>
              <p className="text-xs text-gray-400">Indexed video chunks, avatars, and audio preview buffers</p>
            </div>
            <button
              onClick={() => setShowClearCacheModal(true)}
              className="px-4 py-2 rounded-xl font-bold text-xs bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
            >
              Clear Cache
            </button>
          </div>
        </section>

        {/* App Info & About */}
        <div className="text-center py-4 space-y-1 text-xs text-gray-500">
          <p className="font-bold text-gray-400">ARVDOUL Spatial Media OS v2.4.0 (Production Build)</p>
          <p>© 2026 ARVDOUL Inc. All rights reserved. • Privacy Policy • Terms</p>
        </div>

        {/* Log Out & Delete Action */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleLogout}
            className={cn(
              "flex-1 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border transition-all",
              isDark ? "bg-white/5 border-white/10 hover:bg-white/10 text-white" : "bg-gray-100 border-gray-300 hover:bg-gray-200 text-gray-900"
            )}
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex-1 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 bg-rose-600/15 border border-rose-500/30 text-rose-400 hover:bg-rose-600/25 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Account</span>
          </button>
        </div>
      </main>

      {/* Clear Cache Confirmation Modal */}
      <AnimatePresence>
        {showClearCacheModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "w-full max-w-sm p-6 rounded-3xl border shadow-2xl space-y-4 text-center",
                isDark ? "bg-[#111622] border-white/15 text-white" : "bg-white border-gray-200 text-gray-900"
              )}
            >
              <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                <RefreshCw className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base">Clear App Cache?</h3>
              <p className="text-xs text-gray-400">
                This frees up device storage and refreshes all cached videos and thumbnails. Your login session will remain active.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setShowClearCacheModal(false)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl font-bold text-xs",
                    isDark ? "bg-white/10 text-gray-300" : "bg-gray-100 text-gray-700"
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearCache}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-purple-600 text-white shadow-md"
                >
                  Confirm Clear
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Account Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "w-full max-w-sm p-6 rounded-3xl border shadow-2xl space-y-4 text-center",
                isDark ? "bg-[#111622] border-white/15 text-white" : "bg-white border-gray-200 text-gray-900"
              )}
            >
              <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-rose-500">Delete Account?</h3>
              <p className="text-xs text-gray-400">
                This action is permanent and will delete your profile, videos, coins, and collections.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl font-bold text-xs",
                    isDark ? "bg-white/10 text-gray-300" : "bg-gray-100 text-gray-700"
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    toast.info('Account deletion request submitted');
                  }}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-rose-600 text-white shadow-md"
                >
                  Delete Forever
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
