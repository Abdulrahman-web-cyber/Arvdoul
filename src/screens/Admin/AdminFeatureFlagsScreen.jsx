// src/screens/Admin/AdminFeatureFlagsScreen.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Sliders,
  Search,
  RotateCcw,
  ShieldAlert,
  CheckCircle,
  XCircle,
  HelpCircle,
  Sparkles,
  Zap,
  Filter,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { featureFlagService, DEFAULT_FLAGS } from '../../services/featureFlagService.js';
import { auditLogger } from '../../utils/AuditLogger.js';

const AdminFeatureFlagsScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [flags, setFlags] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Load current flags state
  const loadFlags = () => {
    const all = featureFlagService.getAll();
    setFlags(all);
  };

  useEffect(() => {
    loadFlags();
    const unsub = featureFlagService.subscribe(() => {
      loadFlags();
    });
    return unsub;
  }, []);

  // Handle toggle override
  const handleToggle = async (flagName, currentVal) => {
    const newVal = !currentVal;
    featureFlagService.setOverride(flagName, newVal);
    setFlags(featureFlagService.getAll());

    await auditLogger.log(user?.uid || 'admin', 'FEATURE_FLAG_OVERRIDDEN', {
      flag: flagName,
      previousValue: currentVal,
      newValue: newVal,
      actorEmail: user?.email,
    });

    toast.success(`Flag "${flagName}" set to ${newVal ? 'ENABLED' : 'DISABLED'}`);
  };

  // Revert override to default
  const handleRevert = async flagName => {
    featureFlagService.clearOverride(flagName);
    setFlags(featureFlagService.getAll());

    await auditLogger.log(user?.uid || 'admin', 'FEATURE_FLAG_REVERTED', {
      flag: flagName,
      actorEmail: user?.email,
    });

    toast.info(`Cleared override for "${flagName}". Reverted to baseline.`);
  };

  // Emergency reset all
  const handleResetAll = async () => {
    if (!window.confirm('Emergency Action: Reset ALL feature flag overrides to default configuration?')) {
      return;
    }

    featureFlagService.resetOverrides();
    setFlags(featureFlagService.getAll());

    await auditLogger.log(user?.uid || 'admin', 'FEATURE_FLAGS_RESET_ALL', {
      actorEmail: user?.email,
    });

    toast.warning('All feature flag overrides reset to static baseline.');
  };

  // Extract categories
  const categories = ['all', ...new Set(Object.keys(DEFAULT_FLAGS).map(k => k.split('.')[0]))];

  // Filter flags
  const flagEntries = Object.entries(DEFAULT_FLAGS).filter(([name, def]) => {
    const category = name.split('.')[0];
    if (selectedCategory !== 'all' && category !== selectedCategory) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return name.toLowerCase().includes(q) || (def.description && def.description.toLowerCase().includes(q));
  });

  return (
    <div id="admin-flags-screen" className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Top Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              id="back-btn-flags"
              onClick={() => navigate('/admin')}
              className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              aria-label="Back to Admin"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Feature Flags & Kill Switches</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" />
                  Live Overrides
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Instant platform toggles, experimentation controls, and circuit breakers
              </p>
            </div>
          </div>

          <button
            id="emergency-reset-flags-btn"
            onClick={handleResetAll}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl transition border border-red-200 dark:border-red-800/40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All Overrides</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search flag or description..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Flag Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {flagEntries.map(([name, def]) => {
            const isOverridden = featureFlagService.getOverride(name) !== null;
            const currentValue = Boolean(flags[name] ?? def.defaultValue);

            return (
              <div
                key={name}
                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono font-bold text-gray-900 dark:text-white">{name}</code>
                        {isOverridden && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                            Override
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{def.description}</p>
                    </div>

                    {/* Switch Toggle */}
                    <button
                      id={`toggle-${name}`}
                      onClick={() => handleToggle(name, currentValue)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        currentValue ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                      role="switch"
                      aria-checked={currentValue}
                      aria-label={`Toggle ${name}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          currentValue ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-400 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/60">
                    <span>Default: {def.defaultValue ? 'Enabled' : 'Disabled'}</span>
                    <span>State: <b className={currentValue ? 'text-emerald-500' : 'text-gray-400'}>{currentValue ? 'Active' : 'Inactive'}</b></span>
                  </div>
                </div>

                {isOverridden && (
                  <div className="mt-3 pt-2 flex justify-end">
                    <button
                      onClick={() => handleRevert(name)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Clear Override
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminFeatureFlagsScreen;
