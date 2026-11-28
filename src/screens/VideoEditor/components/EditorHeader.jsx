// src/screens/VideoEditor/components/EditorHeader.jsx

import { useState, useRef, useEffect } from "react";
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Undo2, Redo2, Crop, Upload, ChevronDown, Check,
  Moon, Sun, Sparkles, FolderOpen, Plus, Save
} from 'lucide-react';
import { RESOLUTION_PRESETS } from '../constants';
import { useTheme } from '../../../context/ThemeContext';

// Relative save label derived from a real stored timestamp. A missing or
// unparseable timestamp is unknown ("—"), never a fabricated "Just now".
function formatSavedAt(iso) {
  if (!iso) return '—';
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return '—';
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function EditorHeader({
  projectName,
  onProjectNameChange,
  onClose,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  currentResolution,
  onSelectResolution,
  onExportClick,
  onSaveProject,
  onNewProject,
  savedProjects = [],
  onLoadProject,
}) {
  const { isDark, toggleTheme } = useTheme();

  const [showProjectsMenu, setShowProjectsMenu] = useState(false);
  const [showAspectMenu, setShowAspectMenu] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(projectName || 'Video Studio');

  const menuRef = useRef(null);
  const aspectRef = useRef(null);

  useEffect(() => {
    setTempTitle(projectName || 'Video Studio');
  }, [projectName]);

  // Click outside to close menus
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowProjectsMenu(false);
      }
      if (aspectRef.current && !aspectRef.current.contains(e.target)) {
        setShowAspectMenu(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (tempTitle.trim() && onProjectNameChange) {
      onProjectNameChange(tempTitle.trim());
    }
  };

  const iconBtnClass = isDark
    ? 'bg-white/10 hover:bg-white/20 text-gray-200'
    : 'bg-gray-100 hover:bg-gray-200 text-gray-800';
  const menuPanelClass = isDark
    ? 'bg-gray-900/95 border-white/15 text-gray-200'
    : 'bg-white/95 border-gray-200 text-gray-800';
  const menuItemHover = isDark ? 'hover:bg-white/10 text-gray-200' : 'hover:bg-gray-100 text-gray-800';

  return (
    <header
      className={`relative z-30 flex items-center justify-between px-3 md:px-6 py-2.5 backdrop-blur-xl border-b ${
        isDark ? 'bg-gray-950/90 border-white/10' : 'bg-white/90 border-gray-200'
      }`}
    >
      {/* Left: Close Button */}
      <div className="flex items-center gap-2">
        <button
          id="editor-close-btn"
          type="button"
          onClick={onClose}
          aria-label="Close Video Studio"
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 shadow-sm ${iconBtnClass}`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle dark/light theme"
          className={`hidden sm:flex w-8 h-8 rounded-full items-center justify-center transition-all text-xs ${
            isDark ? 'bg-white/5 hover:bg-white/15 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
          title={isDark ? 'Switch to Light Studio' : 'Switch to Dark Studio'}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
        </button>
      </div>

      {/* Center: Brand & Project Dropdown */}
      <div className="relative flex flex-col items-center justify-center" ref={menuRef}>
        <button
          type="button"
          aria-label="Project menu"
          aria-expanded={showProjectsMenu}
          className="flex items-center gap-1.5 cursor-pointer select-none group"
          onClick={() => setShowProjectsMenu(!showProjectsMenu)}
        >
          <span className="text-sm sm:text-base font-black tracking-widest bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(139,92,246,0.35)]">
            ARVDOUL
          </span>
          <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-1">
          {isEditingTitle ? (
            <input
              aria-label="Project title"
              type="text"
              value={tempTitle}
              autoFocus
              onChange={(e) => setTempTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
              className={`text-xs font-semibold px-2 py-0.5 rounded outline-none border border-purple-500 text-center max-w-[140px] ${
                isDark ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-900'
              }`}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowProjectsMenu(!showProjectsMenu)}
              className={`flex items-center gap-1 text-xs transition-colors font-medium ${
                isDark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>{projectName || 'Video Studio'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showProjectsMenu ? 'rotate-180 text-purple-400' : ''}`} />
            </button>
          )}
        </div>

        {/* Project Selector Menu */}
        <AnimatePresence>
          {showProjectsMenu && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className={`absolute top-full mt-2 w-64 rounded-2xl backdrop-blur-2xl border shadow-2xl p-2 z-50 ${menuPanelClass}`}
            >
              <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Studio Project
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditingTitle(true);
                  setShowProjectsMenu(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors text-left ${menuItemHover}`}
              >
                <span>Rename Project</span>
                <span className="text-[10px] text-gray-500">Edit</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onSaveProject?.();
                  setShowProjectsMenu(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors ${menuItemHover}`}
              >
                <Save className="w-3.5 h-3.5 text-indigo-400" />
                <span>Save Project Snapshot</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onNewProject?.();
                  setShowProjectsMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-purple-400 hover:bg-purple-500/10 transition-colors font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Project</span>
              </button>

              {savedProjects && savedProjects.length > 0 && (
                <>
                  <div className={`my-1 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`} />
                  <div className="px-3 py-1 text-[10px] text-gray-400 uppercase font-semibold">Recent Projects</div>
                  <div className="max-h-36 overflow-y-auto space-y-0.5">
                    {savedProjects.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          onLoadProject?.(p);
                          setShowProjectsMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-left ${
                          isDark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FolderOpen className="w-3 h-3 text-cyan-400 shrink-0" />
                          <span className="truncate">{p.name || 'Untitled'}</span>
                        </div>
                        <span className="text-[10px] text-gray-500 shrink-0">{formatSavedAt(p.updatedAt)}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right Actions: Undo, Redo, Aspect Ratio, Export */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Undo */}
        <button
          id="editor-undo-btn"
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo (Ctrl+Z)"
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            canUndo
              ? `${iconBtnClass} active:scale-95`
              : `${isDark ? 'text-gray-600' : 'text-gray-400'} bg-transparent cursor-not-allowed opacity-50`
          }`}
        >
          <Undo2 className="w-4 h-4" />
        </button>

        {/* Redo */}
        <button
          id="editor-redo-btn"
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo (Ctrl+Shift+Z)"
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            canRedo
              ? `${iconBtnClass} active:scale-95`
              : `${isDark ? 'text-gray-600' : 'text-gray-400'} bg-transparent cursor-not-allowed opacity-50`
          }`}
        >
          <Redo2 className="w-4 h-4" />
        </button>

        {/* Aspect Ratio Selector */}
        <div className="relative" ref={aspectRef}>
          <button
            id="editor-aspect-btn"
            type="button"
            onClick={() => setShowAspectMenu(!showAspectMenu)}
            aria-label="Canvas aspect ratio"
            title="Aspect Ratio & Framing"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-95 ${iconBtnClass}`}
          >
            <Crop className="w-4 h-4" />
          </button>

          <AnimatePresence>
            {showAspectMenu && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                className={`absolute right-0 top-full mt-2 w-56 rounded-2xl backdrop-blur-2xl border shadow-2xl p-2 z-50 ${menuPanelClass}`}
              >
                <div className="px-3 py-1 text-[11px] font-semibold text-gray-400 uppercase">Canvas Aspect Ratio</div>
                <div className="space-y-1 mt-1">
                  {RESOLUTION_PRESETS.map((preset) => {
                    const isSelected = currentResolution?.id === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          onSelectResolution?.(preset);
                          setShowAspectMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${
                          isSelected
                            ? 'bg-purple-600/30 text-purple-400 font-semibold border border-purple-500/40'
                            : menuItemHover
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`text-[11px] px-1.5 py-0.5 rounded font-mono font-bold ${isDark ? 'bg-white/10' : 'bg-gray-200 text-gray-800'}`}>
                            {preset.aspect}
                          </span>
                          <span>{preset.name}</span>
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-purple-400" />}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Primary Export Button */}
        <button
          id="editor-export-btn"
          type="button"
          onClick={onExportClick}
          className="relative group flex items-center gap-1.5 px-4 sm:px-5 py-1.5 rounded-full bg-arvdoul-gradient hover:opacity-95 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-purple-600/30 hover:shadow-purple-600/50 transition-all duration-200 active:scale-95 border border-white/20"
        >
          <Upload className="w-4 h-4 stroke-[2.5]" />
          <span>Export</span>
          <span className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-30 blur transition-opacity pointer-events-none" />
        </button>
      </div>
    </header>
  );
}

EditorHeader.propTypes = {
  projectName: PropTypes.string,
  onProjectNameChange: PropTypes.func,
  onClose: PropTypes.func.isRequired,
  canUndo: PropTypes.bool,
  canRedo: PropTypes.bool,
  onUndo: PropTypes.func,
  onRedo: PropTypes.func,
  currentResolution: PropTypes.object,
  onSelectResolution: PropTypes.func,
  onExportClick: PropTypes.func.isRequired,
  onSaveProject: PropTypes.func,
  onNewProject: PropTypes.func,
  savedProjects: PropTypes.array,
  onLoadProject: PropTypes.func,
};
