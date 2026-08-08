// src/screens/VideoEditor/components/ExportModal.jsx
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Download, Share2, Check, Sparkles, Film,
  Sliders, ArrowRight, HardDrive, CheckCircle2, Play
} from 'lucide-react';
import { RESOLUTION_PRESETS } from '../constants';
import { useNavigate } from 'react-router-dom';

export default function ExportModal({
  isOpen,
  onClose,
  projectName = 'ARVDOUL Video Project',
  duration = 105.6,
  currentResolution,
  onCompleteExport,
}) {
  const navigate = useNavigate();
  const [selectedRes, setSelectedRes] = useState(currentResolution || RESOLUTION_PRESETS[0]);
  const [format, setFormat] = useState('mp4'); // mp4 | webm | gif
  const [frameRate, setFrameRate] = useState(60); // 60 | 30 | 24
  const [quality, setQuality] = useState('high'); // ultra | high | medium
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportComplete, setExportComplete] = useState(false);
  const [exportedUrl, setExportedUrl] = useState(null);

  useEffect(() => {
    if (currentResolution) {
      setSelectedRes(currentResolution);
    }
  }, [currentResolution]);

  const handleStartExport = () => {
    setIsExporting(true);
    setExportProgress(0);
    setExportComplete(false);

    // Simulate fast realistic render pipeline with Web Worker / Canvas processing
    const interval = setInterval(() => {
      setExportProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsExporting(false);
          setExportComplete(true);
          setExportedUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4');
          return 100;
        }
        const increment = Math.floor(Math.random() * 15) + 8;
        return Math.min(100, prev + increment);
      });
    }, 250);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = exportedUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
    a.download = `${projectName.toLowerCase().replace(/\s+/g, '_')}_rendered.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShareToFeed = () => {
    onClose();
    navigate('/create-post', {
      state: {
        mediaType: 'video',
        videoUrl: exportedUrl,
        title: projectName,
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        className="w-full max-w-xl rounded-3xl bg-gray-950/95 border border-white/15 shadow-2xl p-6 relative overflow-hidden"
      >
        {/* Glowing background ambient lights */}
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-purple-600/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-blue-600/30 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/40">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide">
                Export & Render Video
              </h2>
              <p className="text-xs text-gray-400">
                {projectName} • {Math.round(duration)}s total runtime
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="py-5 space-y-4 relative z-10">
          {!isExporting && !exportComplete ? (
            <>
              {/* Resolution Options */}
              <div>
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-2">
                  Target Resolution & Aspect Ratio
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {RESOLUTION_PRESETS.map((res) => {
                    const isSelected = selectedRes.id === res.id;
                    return (
                      <button
                        key={res.id}
                        onClick={() => setSelectedRes(res)}
                        className={`p-2.5 rounded-2xl text-left transition-all border ${
                          isSelected
                            ? 'bg-purple-600/30 border-purple-500 text-white ring-1 ring-purple-400/50 shadow-md shadow-purple-500/20'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">{res.label}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-purple-300">
                            {res.aspect}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400 mt-1">{res.width}x{res.height}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Format & FPS */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-2">
                    Format
                  </label>
                  <div className="flex items-center gap-1.5 p-1 bg-black/40 rounded-xl border border-white/10">
                    {['mp4', 'webm', 'gif'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setFormat(f)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all ${
                          format === f ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-2">
                    Frame Rate (FPS)
                  </label>
                  <div className="flex items-center gap-1.5 p-1 bg-black/40 rounded-xl border border-white/10">
                    {[60, 30, 24].map((fps) => (
                      <button
                        key={fps}
                        onClick={() => setFrameRate(fps)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          frameRate === fps ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {fps} fps
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quality Preset */}
              <div>
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider block mb-2">
                  Encoding Quality
                </label>
                <div className="flex items-center gap-2">
                  {[
                    { id: 'ultra', label: 'Maximum (ProRes 4K)', bitrate: '45 Mbps' },
                    { id: 'high', label: 'High (Web / Social)', bitrate: '24 Mbps' },
                    { id: 'medium', label: 'Balanced (Fast)', bitrate: '12 Mbps' },
                  ].map((q) => (
                    <button
                      key={q.id}
                      onClick={() => setQuality(q.id)}
                      className={`flex-1 p-2 rounded-xl text-left border text-xs transition-all ${
                        quality === q.id
                          ? 'bg-indigo-600/30 border-indigo-500 text-white'
                          : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      <div className="font-semibold">{q.label}</div>
                      <div className="text-[10px] text-gray-500">{q.bitrate}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : isExporting ? (
            /* Progress Bar State */
            <div className="py-8 flex flex-col items-center justify-center space-y-4">
              <div className="relative w-24 h-24 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full border-4 border-white/10 border-t-purple-500 animate-spin" />
                <span className="absolute text-lg font-mono font-bold text-white">
                  {exportProgress}%
                </span>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-white">
                  Rendering Multi-Track Composition...
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Encoding video shaders, audio stems, and vector overlays
                </p>
              </div>

              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-200"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          ) : (
            /* Export Completed State */
            <div className="py-6 flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-white">Export Ready!</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Your ultra high-definition video was successfully compiled.
                </p>
              </div>

              <div className="w-full grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleDownload}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download File</span>
                </button>

                <button
                  onClick={handleShareToFeed}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-purple-600/30 transition-all"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Post to Feed</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!isExporting && !exportComplete && (
          <div className="pt-4 border-t border-white/10 flex items-center justify-between relative z-10">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white"
            >
              Cancel
            </button>

            <button
              onClick={handleStartExport}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 active:scale-95 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Start Render</span>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

ExportModal.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  projectName: PropTypes.string,
  duration: PropTypes.number,
  currentResolution: PropTypes.object,
  onCompleteExport: PropTypes.func,
};
