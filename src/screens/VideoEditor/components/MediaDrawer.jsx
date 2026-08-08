// src/screens/VideoEditor/components/MediaDrawer.jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Image as ImageIcon, Video, Music, Upload, Plus, Check, Search
} from 'lucide-react';
import { STOCK_VIDEOS, STOCK_AUDIO } from '../constants';

export default function MediaDrawer({
  isOpen,
  onClose,
  onAddMedia,
}) {
  const [activeTab, setActiveTab] = useState('stock_videos');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="w-full max-w-2xl bg-gray-950/95 border-t sm:border border-white/15 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-600/30 text-purple-400 flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-white">Media Library & Stock Clips</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 pt-3">
          <button
            onClick={() => setActiveTab('stock_videos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'stock_videos'
                ? 'bg-purple-600 text-white'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>4K Videos ({STOCK_VIDEOS.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('stock_audio')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'stock_audio'
                ? 'bg-purple-600 text-white'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Soundtracks ({STOCK_AUDIO.length})</span>
          </button>
        </div>

        {/* Media Grid */}
        <div className="flex-1 overflow-y-auto py-4">
          {activeTab === 'stock_videos' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {STOCK_VIDEOS.map((video) => (
                <div
                  key={video.id}
                  className="group relative rounded-2xl overflow-hidden bg-black/40 border border-white/10 hover:border-purple-500 transition-all cursor-pointer shadow-md"
                  onClick={() => {
                    onAddMedia?.({
                      type: 'video',
                      title: video.title,
                      url: video.url,
                      thumbnail: video.thumbnail,
                      duration: video.duration,
                    });
                    onClose();
                  }}
                >
                  <div className="aspect-video relative overflow-hidden">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-mono text-white font-bold">
                      {video.duration}s
                    </span>
                  </div>
                  <div className="p-2 flex items-center justify-between">
                    <div className="text-xs font-semibold text-white truncate">{video.title}</div>
                    <button className="p-1 rounded-lg bg-purple-600/30 group-hover:bg-purple-600 text-purple-300 group-hover:text-white transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {STOCK_AUDIO.map((audio) => (
                <div
                  key={audio.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-black/40 border border-white/10 hover:border-purple-500 transition-all cursor-pointer"
                  onClick={() => {
                    onAddMedia?.({
                      type: 'audio',
                      title: audio.title,
                      url: audio.url,
                      duration: 45,
                    });
                    onClose();
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Music className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{audio.title}</div>
                      <div className="text-[10px] text-gray-400">{audio.genre} • {audio.duration}</div>
                    </div>
                  </div>

                  <button className="p-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600 text-purple-300 hover:text-white">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

MediaDrawer.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onAddMedia: PropTypes.func,
};
