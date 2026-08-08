// src/screens/DataUsageScreen.jsx - ARVDOUL DATA USAGE
// Per Constitution v5.0 - Storage usage, offline cache, clear cache
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useTheme } from '@context/ThemeContext';
import { useAuth } from '@context/AuthContext';
import { cn } from '../lib/utils';
import { 
  ArrowLeft, HardDrive, Database, Image, Video, MessageSquare,
  Download, Trash2, RefreshCw, AlertTriangle, CheckCircle
} from 'lucide-react';

const USAGE_DATA = {
  total: 2.4, // GB
  breakdown: [
    { id: 'media', name: 'Media Files', size: 1.2, icon: Image, color: 'text-purple-400' },
    { id: 'video', name: 'Videos', size: 0.8, icon: Video, color: 'text-blue-400' },
    { id: 'messages', name: 'Messages & Chats', size: 0.3, icon: MessageSquare, color: 'text-green-400' },
    { id: 'cache', name: 'Cache & Temp', size: 0.1, icon: Database, color: 'text-yellow-400' },
  ],
  cacheBreakdown: [
    { id: 'images', name: 'Cached Images', size: 45, unit: 'MB' },
    { id: 'videos', name: 'Cached Videos', size: 30, unit: 'MB' },
    { id: 'feed', name: 'Feed Data', size: 15, unit: 'MB' },
    { id: 'other', name: 'Other', size: 10, unit: 'MB' },
  ],
};

export default function DataUsageScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';
  const [clearing, setClearing] = useState(null);

  const totalUsagePercent = (USAGE_DATA.total / 5) * 100; // Assuming 5GB limit

  const handleClearCache = async (cacheId) => {
    setClearing(cacheId);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success('Cache cleared successfully');
    } catch (error) {
      toast.error('Failed to clear cache');
    } finally {
      setClearing(null);
    }
  };

  const handleExportData = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success('Data export started. You\'ll receive an email when ready.');
    } catch (error) {
      toast.error('Export failed. Please try again.');
    }
  };

  const backgroundStyle = useMemo(() => ({
    background: isDark
      ? 'radial-gradient(circle at 50% 0%, rgba(139, 30, 243, 0.1) 0%, transparent 50%), #03071B'
      : 'radial-gradient(circle at 50% 0%, rgba(139, 30, 243, 0.05) 0%, transparent 50%), #F6F8FC',
  }), [isDark]);

  return (
    <div className="min-h-screen pb-20" style={backgroundStyle}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4"
      >
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate(-1)}
            className={cn("p-2 rounded-full", isDark ? "hover:bg-white/10" : "hover:bg-black/5")}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className={cn("text-2xl font-display font-bold", isDark ? "text-white" : "text-gray-900")}>
            Data Usage
          </h1>
        </div>

        {/* Total Usage Card */}
        <div className={cn(
          "rounded-arvdoul-xl p-6 mb-4",
          "bg-arvdoul-surface backdrop-blur-md border border-arvdoul-border"
        )}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-arvdoul-gradient flex items-center justify-center">
                <HardDrive className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-arvdoul-text-secondary text-sm">Total Storage Used</p>
                <p className="text-3xl font-bold text-white">{USAGE_DATA.total} GB</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-arvdoul-text-secondary text-sm">of 5 GB</p>
              <p className="text-lg font-semibold text-arvdoul-purple">{Math.round(totalUsagePercent)}%</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className={cn(
            "h-3 rounded-full overflow-hidden",
            isDark ? "bg-white/10" : "bg-gray-200"
          )}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${totalUsagePercent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full bg-arvdoul-gradient"
            />
          </div>
        </div>
      </motion.div>

      {/* Usage Breakdown */}
      <div className="px-4 mb-6">
        <h2 className={cn("text-lg font-semibold mb-3", isDark ? "text-white" : "text-gray-900")}>
          Usage Breakdown
        </h2>
        <div className="space-y-3">
          {USAGE_DATA.breakdown.map((item, index) => {
            const Icon = item.icon;
            const percent = (item.size / USAGE_DATA.total) * 100;
            
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-arvdoul-lg",
                  "bg-arvdoul-surface border border-arvdoul-border"
                )}
              >
                <div className={cn("p-2 rounded-lg bg-white/5", item.color)}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-medium">{item.name}</span>
                    <span className="text-arvdoul-text-secondary">{item.size} GB</span>
                  </div>
                  <div className={cn("h-1.5 rounded-full overflow-hidden", isDark ? "bg-white/10" : "bg-gray-200")}>
                    <div
                      className={cn("h-full", item.color.replace('text-', 'bg-'))}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Cache Management */}
      <div className="px-4 mb-6">
        <h2 className={cn("text-lg font-semibold mb-3", isDark ? "text-white" : "text-gray-900")}>
          Cache & Offline Data
        </h2>
        <div className="space-y-2">
          {USAGE_DATA.cacheBreakdown.map((cache, index) => (
            <motion.div
              key={cache.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 + index * 0.05 }}
              className={cn(
                "flex items-center justify-between p-3 rounded-arvdoul-lg",
                "bg-arvdoul-surface/50 border border-arvdoul-border/50"
              )}
            >
              <span className="text-arvdoul-text-secondary">{cache.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-white">{cache.size} {cache.unit}</span>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleClearCache(cache.id)}
                  disabled={clearing === cache.id}
                  className={cn(
                    "p-1.5 rounded-lg",
                    "hover:bg-red-500/20 text-arvdoul-text-secondary hover:text-red-400",
                    "transition-colors"
                  )}
                >
                  {clearing === cache.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => handleClearCache('all')}
          disabled={clearing === 'all'}
          className={cn(
            "w-full mt-4 py-3 rounded-arvdoul-md",
            "border border-red-500/30 text-red-400",
            "hover:bg-red-500/10 transition-colors",
            "flex items-center justify-center gap-2"
          )}
        >
          <Trash2 className="w-5 h-5" />
          {clearing === 'all' ? 'Clearing...' : 'Clear All Cache'}
        </motion.button>
      </div>

      {/* Data Export */}
      <div className="px-4">
        <h2 className={cn("text-lg font-semibold mb-3", isDark ? "text-white" : "text-gray-900")}>
          Your Data
        </h2>
        <div className={cn(
          "rounded-arvdoul-lg p-4",
          "bg-arvdoul-surface border border-arvdoul-border"
        )}>
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-medium">Download Your Data</p>
              <p className="text-sm text-arvdoul-text-secondary">
                Get a copy of all your data including posts, messages, media, and account info.
              </p>
            </div>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleExportData}
            className={cn(
              "w-full py-3 rounded-arvdoul-md",
              "bg-arvdoul-gradient text-white font-medium",
              "shadow-arvdoul-button flex items-center justify-center gap-2"
            )}
          >
            <Download className="w-5 h-5" />
            Request Data Export
          </motion.button>
        </div>
      </div>
    </div>
  );
}
