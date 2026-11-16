// src/screens/Admin/AdminFeatureFlagsScreen.jsx

import { useState, useEffect, useCallback } from "react";
import { useConfirm } from '../../components/Shared/ConfirmProvider.jsx';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Search, RotateCcw, MonitorSmartphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { featureFlagService, DEFAULT_FLAGS } from '../../services/featureFlagService.js';
import { callFunction, FUNCTIONS, fetchAdminStatus } from '../../services/callableService.js';
import PermissionDenied from '../../design-system/PermissionDenied.jsx';
import AdminNavHeader from '../../components/Admin/AdminNavHeader.jsx';

const AdminFeatureFlagsScreen = () => {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { user } = useAuth();
  const [denied, setDenied] = useState(false);
  const [flags, setFlags] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [busyFlag, setBusyFlag] = useState(null);

  const loadGovernedOverrides = useCallback(async () => {
    try {
      if (!user?.uid || !(await fetchAdminStatus())) {
        setDenied(true);
        return;
      }
      const res = await callFunction(FUNCTIONS.GET_FEATURE_FLAG_OVERRIDES, {});
      featureFlagService.applyRemoteOverrides(res?.overrides || {});
      setFlags(featureFlagService.getAll());
    } catch {
      toast.error('Could not load platform feature flags.');
    }
  }, [user?.uid]);

  useEffect(() => {
    loadGovernedOverrides();
    const unsub = featureFlagService.subscribe(() => setFlags(featureFlagService.getAll()));
    return unsub;
  }, [loadGovernedOverrides]);

  const handleToggle = async (flagName, currentVal) => {
    const newVal = !currentVal;
    setBusyFlag(flagName);
    try {
      await callFunction(FUNCTIONS.SET_FEATURE_FLAG_OVERRIDE, { flag: flagName, value: newVal });
      await loadGovernedOverrides();
      toast.success(`Flag "${flagName}" set to ${newVal ? 'ENABLED' : 'DISABLED'} platform-wide`);
    } catch {
      toast.error(`Could not update "${flagName}".`);
    } finally {
      setBusyFlag(null);
    }
  };

  const handleRevert = async (flagName) => {
    setBusyFlag(flagName);
    try {
      await callFunction(FUNCTIONS.SET_FEATURE_FLAG_OVERRIDE, { flag: flagName, value: null });
      await loadGovernedOverrides();
      toast.info(`Cleared platform override for "${flagName}". Reverted to baseline.`);
    } catch {
      toast.error(`Could not revert "${flagName}".`);
    } finally {
      setBusyFlag(null);
    }
  };

  const handleResetAll = async () => {
    const ok = await confirm({
      title: 'Reset all platform flags?',
      description: 'This emergency action resets ALL platform feature flag overrides to the baseline configuration.',
      confirmText: 'Reset all',
      tone: 'danger',
    });
    if (!ok) return;
    const overridden = Object.keys(DEFAULT_FLAGS).filter(
      (name) => featureFlagService.getOverride(name) === null && featureFlagService.getSnapshot()[name]?.source === 'governed'
    );
    if (overridden.length === 0) {
      toast.info('No platform overrides are currently set.');
      return;
    }
    try {
      for (const name of overridden) {
        await callFunction(FUNCTIONS.SET_FEATURE_FLAG_OVERRIDE, { flag: name, value: null });
      }
      await loadGovernedOverrides();
      toast.warning(`Reset ${overridden.length} platform override(s) to baseline.`);
    } catch {
      toast.error('Could not reset all overrides.');
    }
  };

  const handleLocalOverride = (flagName) => {
    const current = featureFlagService.getOverride(flagName);
    if (current === null) {
      featureFlagService.setOverride(flagName, !featureFlagService.getRaw(flagName));
      toast.info(`Local override set for "${flagName}" on this device only.`);
    } else {
      featureFlagService.clearOverride(flagName);
      toast.info(`Local override cleared for "${flagName}".`);
    }
    setFlags(featureFlagService.getAll());
  };

  const categories = ['all', ...new Set(Object.keys(DEFAULT_FLAGS).map((k) => k.split('.')[0]))];

  const flagEntries = Object.entries(DEFAULT_FLAGS).filter(([name, def]) => {
    const category = name.split('.')[0];
    if (selectedCategory !== 'all' && category !== selectedCategory) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return name.toLowerCase().includes(q) || (def.description && def.description.toLowerCase().includes(q));
  });

  if (denied) {
    return <PermissionDenied onGoHome={() => navigate('/')} />;
  }

  return (
    <div id="admin-flags-screen" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <AdminNavHeader
        title="Feature Flags & Kill Switches"
        subtitle="Server-authoritative platform toggles; every change is admin-gated and audit-logged"
        actions={
          <button
            id="emergency-reset-flags-btn"
            type="button"
            onClick={handleResetAll}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition border border-red-200 dark:border-red-900/60 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All Overrides</span>
          </button>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              aria-label="Search flag or description"
              type="text"
              placeholder="Search flag or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-arvdoul-purple"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize whitespace-nowrap shrink-0 transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {flagEntries.map(([name, def]) => {
            const snapshot = featureFlagService.getSnapshot()[name];
            const isLocal = featureFlagService.getOverride(name) !== null;
            const isGoverned = snapshot?.source === 'governed';
            const currentValue = Boolean(flags[name] ?? def.defaultValue);
            const isBusy = busyFlag === name;

            return (
              <div
                key={name}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-xs font-mono font-semibold text-slate-900 dark:text-white">{name}</code>
                        {isGoverned && (
                          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                            · Platform override
                          </span>
                        )}
                        {isLocal && (
                          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                            · This device
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{def.description}</p>
                    </div>

                    <button
                      id={`toggle-${name}`}
                      type="button"
                      onClick={() => handleToggle(name, currentValue)}
                      disabled={isBusy}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-arvdoul-purple disabled:opacity-50 ${
                        currentValue ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
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

                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex-wrap">
                    <span>Default: {def.defaultValue ? 'Enabled' : 'Disabled'}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      State: <strong className={currentValue ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}>{currentValue ? 'Active' : 'Inactive'}</strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">Source: {snapshot?.source || 'default'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-4 text-xs">
                  <button
                    type="button"
                    onClick={() => handleLocalOverride(name)}
                    className="text-slate-500 dark:text-slate-400 hover:underline flex items-center gap-1 cursor-pointer"
                    title="Affects only this browser; not a governance record."
                  >
                    <MonitorSmartphone className="w-3.5 h-3.5" />
                    {isLocal ? 'Clear device override' : 'Set device override'}
                  </button>
                  {isGoverned && (
                    <button
                      type="button"
                      onClick={() => handleRevert(name)}
                      disabled={isBusy}
                      className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Clear platform override
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminFeatureFlagsScreen;
