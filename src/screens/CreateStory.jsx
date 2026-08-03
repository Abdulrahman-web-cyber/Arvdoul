// src/screens/CreateStory.jsx - ARVDOUL CREATE STORY (REAL)
// Text + image stories published through storyService (moderation, storage).
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '@context/ThemeContext';
import { cn } from '../lib/utils';
import { Image as ImageIcon, Type, X, ArrowLeft, Loader2, Send } from 'lucide-react';

export default function CreateStory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [text, setText] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const fileInputRef = useRef(null);

  const colors = {
    text: isDark ? 'text-white' : 'text-gray-900',
    secondary: isDark ? 'text-gray-400' : 'text-gray-600',
  };

  const handlePickImage = () => fileInputRef.current?.click();

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const handlePublish = async () => {
    if (!user?.uid || publishing) return;
    if (!text.trim() && !mediaFile) {
      toast.error('Add some text or an image to your story.');
      return;
    }
    setPublishing(true);
    try {
      const { getStoryService } = await import('../services/storyService.js');
      const storyData = {
        type: mediaFile ? 'image' : 'text',
        content: text.trim().slice(0, 500) || undefined,
        ...(mediaFile ? { mediaFile } : {}),
        audience: 'followers',
      };
      const res = await getStoryService().createStory(storyData);
      if (res?.success || res?.queued) {
        toast.success(res?.queued ? 'Story queued — will post when you are online.' : 'Story published! 🎉');
        navigate('/home');
      } else {
        toast.error(res?.error || 'Could not publish your story.');
      }
    } catch (err) {
      toast.error(err?.message || 'Could not publish your story.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-white/10">
        <button onClick={() => navigate(-1)} aria-label="Close" className="p-2 rounded-full hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-lg">Create Story</h1>
        <button onClick={() => navigate(-1)} aria-label="Close" className="p-2 rounded-full hover:bg-white/10">
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Preview Area */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
        <div className="relative w-full max-w-md aspect-[9/16] rounded-3xl bg-gradient-to-br from-fuchsia-600 via-purple-600 to-cyan-500 flex items-center justify-center overflow-hidden">
          {mediaPreview ? (
            <img src={mediaPreview} alt="Story preview" className="absolute inset-0 w-full h-full object-cover" />
          ) : null}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's happening?"
            maxLength={500}
            className="relative w-full h-full bg-transparent text-center text-3xl font-bold resize-none outline-none p-8 placeholder:text-white/60"
          />
          <span className="absolute bottom-3 right-4 text-xs text-white/60">{text.length}/500</span>
        </div>
      </div>

      {/* Tools */}
      <div className="border-t border-white/10 p-4">
        <div className="flex justify-center gap-4 mb-4">
          <button
            onClick={handlePickImage}
            className={cn("h-14 w-14 rounded-full flex items-center justify-center transition", mediaFile ? "bg-fuchsia-500 text-white" : "bg-white/10 hover:bg-white/20")}
            aria-label="Add image"
          >
            <ImageIcon className="w-6 h-6" />
          </button>
          <button
            onClick={() => setMediaFile(null)}
            className={cn("h-14 w-14 rounded-full flex items-center justify-center transition", text ? "bg-cyan-500 text-white" : "bg-white/10 hover:bg-white/20")}
            aria-label="Text mode"
          >
            <Type className="w-6 h-6" />
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

        <button
          onClick={handlePublish}
          disabled={publishing}
          className="w-full h-12 rounded-xl font-semibold bg-gradient-to-r from-fuchsia-600 via-purple-600 to-cyan-500 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {publishing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          {publishing ? 'Publishing…' : 'Share Story'}
        </button>
      </div>
    </div>
  );
}
