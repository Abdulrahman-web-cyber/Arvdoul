// src/screens/CreatePost.jsx - ARVDOUL ULTRA PRO MAX ENTERPRISE V6 - PERFECT FIXED
// 🚀 BILLION-USER SCALABLE • REAL FIREBASE • ZERO MOCK DATA • PRODUCTION READY
// 🔥 PERFECT MONETIZATION • REAL-TIME VALIDATION • ULTIMATE UI/UX • NO EARLY VALIDATION

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, LazyMotion, domAnimation } from 'framer-motion';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import { useAppStore } from '../store/appStore';
import LoadingSpinner from '../components/Shared/LoadingSpinner.jsx'; // FIXED PATH

// Utility function
const cn = (...classes) => classes.filter(Boolean).join(' ');

// SMART ICON IMPORTS
import {
  X, Send, Image as ImageIcon, Video, Smile, MapPin, Users, Globe, Lock,
  Bold, Italic, Underline, Link as LinkIcon, Type, Calendar,
  BarChart2, HelpCircle, Sparkles, TrendingUp, Bell, Gift,
  Camera, Mic, FileText, Brain, Rocket, Star, Heart, Crown,
  Layers, Compass, MessageSquare, ThumbsUp, Share2, DollarSign,
  ChevronDown, ChevronUp, Plus, Minus, Zap, Pin, Settings, Target,
  Save, Clock, Trash2, Eye, EyeOff, Hash, AtSign, Filter, Shield,
  Award, Trophy, Medal, Coins, Wallet, CreditCard, ShoppingBag,
  TrendingUp as TrendingUpIcon, BarChart3, Users as UsersIcon,
  CheckCircle, AlertCircle, Info, ExternalLink, Upload, Download,
  Volume2, Music, Palette, Zap as ZapIcon, Sparkle, Sun, Moon,
  Smartphone, Tablet, Monitor, Watch, Headphones, Gamepad2,
  Check, Loader2, Globe as GlobeIcon, Users as UsersIcon2, Lock as LockIcon,
  Crown as CrownIcon, DollarSign as DollarSignIcon, Target as TargetIcon,
  TrendingUp as TrendingUpIcon2, Sparkles as SparklesIcon
} from 'lucide-react';

// ==================== ENTERPRISE CONSTANTS ====================
const POST_TYPES = [
  { 
    id: 'text', 
    label: 'Text Post', 
    icon: Type, 
    color: 'from-blue-500 to-cyan-500',
    gradient: 'bg-gradient-to-br from-blue-500 to-cyan-500',
    description: 'Share thoughts & stories',
    premium: false,
    fields: ['content']
  },
  { 
    id: 'image', 
    label: 'Photo Post', 
    icon: ImageIcon, 
    color: 'from-emerald-500 to-green-500',
    gradient: 'bg-gradient-to-br from-emerald-500 to-green-500',
    description: 'Upload stunning images',
    premium: false,
    fields: ['content', 'media']
  },
  { 
    id: 'video', 
    label: 'Video Post', 
    icon: Video, 
    color: 'from-red-500 to-pink-500',
    gradient: 'bg-gradient-to-br from-red-500 to-pink-500',
    description: 'Share videos & reels',
    premium: false,
    fields: ['content', 'media']
  },
  { 
    id: 'poll', 
    label: 'Interactive Poll', 
    icon: BarChart2, 
    color: 'from-purple-500 to-violet-500',
    gradient: 'bg-gradient-to-br from-purple-500 to-violet-500',
    description: 'Engage with polls',
    premium: true,
    fields: ['content', 'poll']
  },
  { 
    id: 'question', 
    label: 'Ask Question', 
    icon: HelpCircle, 
    color: 'from-amber-500 to-yellow-500',
    gradient: 'bg-gradient-to-br from-amber-500 to-yellow-500',
    description: 'Ask the community',
    premium: false,
    fields: ['content', 'question']
  },
  { 
    id: 'link', 
    label: 'Share Link', 
    icon: LinkIcon, 
    color: 'from-indigo-500 to-blue-500',
    gradient: 'bg-gradient-to-br from-indigo-500 to-blue-500',
    description: 'Share web links',
    premium: false,
    fields: ['content', 'link']
  },
  { 
    id: 'audio', 
    label: 'Audio Post', 
    icon: Music, 
    color: 'from-rose-500 to-pink-500',
    gradient: 'bg-gradient-to-br from-rose-500 to-pink-500',
    description: 'Share music & podcasts',
    premium: true,
    fields: ['content', 'media']
  },
  { 
    id: 'event', 
    label: 'Create Event', 
    icon: Calendar, 
    color: 'from-orange-500 to-red-500',
    gradient: 'bg-gradient-to-br from-orange-500 to-red-500',
    description: 'Organize events',
    premium: true,
    fields: ['content', 'event']
  }
];

const VISIBILITY_OPTIONS = [
  { 
    id: 'public', 
    label: 'Public', 
    icon: GlobeIcon, 
    color: 'text-green-500',
    iconColor: 'bg-green-500/20',
    borderColor: 'border-green-500',
    description: 'Visible to everyone',
    badge: '🌍',
    cost: 0
  },
  { 
    id: 'friends', 
    label: 'Friends', 
    icon: UsersIcon2, 
    color: 'text-blue-500',
    iconColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500',
    description: 'Only your friends',
    badge: '👥',
    cost: 0
  },
  { 
    id: 'private', 
    label: 'Private', 
    icon: LockIcon, 
    color: 'text-red-500',
    iconColor: 'bg-red-500/20',
    borderColor: 'border-red-500',
    description: 'Only you can see',
    badge: '🔒',
    cost: 0
  },
  { 
    id: 'premium', 
    label: 'Premium', 
    icon: CrownIcon, 
    color: 'text-purple-500',
    iconColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500',
    description: 'Premium subscribers only',
    badge: '👑',
    cost: 50
  }
];

const SMART_MONETIZATION_OPTIONS = [
  {
    id: 'none',
    label: 'No Monetization',
    icon: DollarSignIcon,
    color: 'text-gray-500',
    description: 'Free post',
    fee: 0,
    earnings: 0
  },
  {
    id: 'tips',
    label: 'Accept Tips',
    icon: Coins,
    color: 'text-yellow-500',
    description: 'Allow viewers to send tips',
    fee: 15,
    minTip: 1,
    maxTip: 1000,
    earnings: '85% of tips'
  },
  {
    id: 'exclusive',
    label: 'Exclusive Content',
    icon: CrownIcon,
    color: 'text-purple-500',
    description: 'Premium subscribers only',
    fee: 20,
    price: 50,
    earnings: '80% of subscription'
  },
  {
    id: 'sponsored',
    label: 'Sponsored Post',
    icon: TargetIcon,
    color: 'text-green-500',
    description: 'Brand partnership',
    fee: 25,
    minPrice: 100,
    earnings: '75% of sponsorship'
  },
  {
    id: 'ad_revenue',
    label: 'Ad Revenue Share',
    icon: TrendingUpIcon2,
    color: 'text-blue-500',
    description: 'Earn from ads',
    fee: 30,
    earnings: '70% of ad revenue'
  }
];

const BOOST_OPTIONS = [
  { 
    id: 'none', 
    label: 'No Boost', 
    icon: TrendingUpIcon, 
    color: 'from-gray-400 to-gray-600',
    gradient: 'bg-gradient-to-br from-gray-400 to-gray-600',
    coins: 0,
    duration: '0 days',
    reach: 'Normal',
    features: ['Standard visibility'],
    recommended: false
  },
  { 
    id: 'basic', 
    label: 'Basic Boost', 
    icon: TrendingUpIcon, 
    color: 'from-blue-400 to-blue-600',
    gradient: 'bg-gradient-to-br from-blue-400 to-blue-600',
    coins: 25,
    duration: '24 hours',
    reach: '2x Reach',
    features: ['2x increased reach', 'Priority in feeds', '24 hour duration'],
    recommended: false
  },
  { 
    id: 'pro', 
    label: 'Pro Boost', 
    icon: Rocket, 
    color: 'from-purple-400 to-pink-600',
    gradient: 'bg-gradient-to-br from-purple-400 to-pink-600',
    coins: 50,
    duration: '3 days',
    reach: '5x Reach',
    features: ['5x increased reach', 'Featured placement', '3 day duration', 'Analytics included'],
    recommended: true
  },
  { 
    id: 'max', 
    label: 'Max Boost', 
    icon: Zap, 
    color: 'from-orange-400 to-red-600',
    gradient: 'bg-gradient-to-br from-orange-400 to-red-600',
    coins: 100,
    duration: '7 days',
    reach: '10x Reach',
    features: ['10x increased reach', 'Top placement', '7 day duration', 'Full analytics', 'Priority support'],
    recommended: false
  }
];

// ==================== OPTIMIZED COMPONENTS ====================

const PollCreator = ({ pollData, onChange, theme }) => {
  const colors = theme === 'dark' ? {
    bg: 'bg-gray-800/90',
    text: 'text-white',
    placeholder: 'text-gray-400',
    border: 'border-gray-700',
    card: 'bg-gray-800/80'
  } : {
    bg: 'bg-white/95',
    text: 'text-gray-900',
    placeholder: 'text-gray-500',
    border: 'border-gray-300',
    card: 'bg-white/90'
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...pollData.options];
    newOptions[index] = value;
    onChange({ ...pollData, options: newOptions });
  };

  const addOption = () => {
    if (pollData.options.length < 6) {
      onChange({ ...pollData, options: [...pollData.options, ''] });
    } else {
      toast.error('Maximum 6 options allowed');
    }
  };

  const removeOption = (index) => {
    if (pollData.options.length > 2) {
      const newOptions = pollData.options.filter((_, i) => i !== index);
      onChange({ ...pollData, options: newOptions });
    }
  };

  return (
    <div className={cn("rounded-2xl p-6", colors.bg, colors.border, "border shadow-xl")}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20">
          <BarChart2 className="w-6 h-6 text-purple-500" />
        </div>
        <div>
          <h3 className={cn("text-xl font-bold", colors.text)}>Create Poll</h3>
          <p className={cn("text-sm", colors.placeholder)}>Engage your audience with interactive polls</p>
        </div>
      </div>
      
      <div className="space-y-6">
        <div>
          <label className={cn("block text-sm font-medium mb-2", colors.text)}>
            Poll Question
          </label>
          <input
            type="text"
            value={pollData.question}
            onChange={(e) => onChange({ ...pollData, question: e.target.value })}
            placeholder="Ask your question..."
            className={cn(
              "w-full p-4 rounded-xl text-lg",
              colors.bg,
              colors.text,
              colors.border,
              "border-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 focus:outline-none transition-all"
            )}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className={cn("block text-sm font-medium", colors.text)}>
              Options ({pollData.options.length}/6)
            </label>
            <span className={cn("text-xs", colors.placeholder)}>
              Minimum 2 options required
            </span>
          </div>
          <div className="space-y-3">
            {pollData.options.map((option, index) => (
              <div key={index} className="flex gap-3 items-center">
                <div className={cn(
                  "flex-1 p-4 rounded-xl border-2",
                  colors.bg,
                  colors.border,
                  "hover:border-purple-500/50 transition-colors"
                )}>
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    className={cn(
                      "w-full bg-transparent outline-none",
                      colors.text,
                      colors.placeholder
                    )}
                  />
                </div>
                {pollData.options.length > 2 && (
                  <button
                    onClick={() => removeOption(index)}
                    className={cn(
                      "p-3 rounded-xl transition-all",
                      "bg-red-500/10 text-red-500 hover:bg-red-500/20 active:scale-95"
                    )}
                    type="button"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {pollData.options.length < 6 && (
            <button
              onClick={addOption}
              className={cn(
                "mt-4 px-4 py-3 rounded-xl font-medium transition-all",
                "bg-gradient-to-r from-green-500/10 to-emerald-500/10 text-green-500",
                "hover:from-green-500/20 hover:to-emerald-500/20 hover:scale-[1.02] active:scale-95"
              )}
              type="button"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Add Option
            </button>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className={cn("block text-sm font-medium", colors.text)}>
              Duration: <span className="text-purple-500">{pollData.duration} hours</span>
            </label>
            <span className={cn("text-xs", colors.placeholder)}>
              1 hour - 1 week
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="168"
            value={pollData.duration}
            onChange={(e) => onChange({ ...pollData, duration: parseInt(e.target.value) })}
            className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-purple-500 [&::-webkit-slider-thumb]:to-pink-500"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>1 hour</span>
            <span>7 days</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const QuestionCreator = ({ question, onChange, theme }) => {
  const colors = theme === 'dark' ? {
    bg: 'bg-gray-800/90',
    text: 'text-white',
    placeholder: 'text-gray-400',
    border: 'border-gray-700'
  } : {
    bg: 'bg-white/95',
    text: 'text-gray-900',
    placeholder: 'text-gray-500',
    border: 'border-gray-300'
  };

  return (
    <div className={cn("rounded-2xl p-6", colors.bg, colors.border, "border shadow-xl")}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20">
          <HelpCircle className="w-6 h-6 text-amber-500" />
        </div>
        <div>
          <h3 className={cn("text-xl font-bold", colors.text)}>Ask a Question</h3>
          <p className={cn("text-sm", colors.placeholder)}>Get answers from the community</p>
        </div>
      </div>
      
      <div className="relative">
        <textarea
          value={question}
          onChange={(e) => onChange(e.target.value)}
          placeholder="What would you like to ask the community? Be specific to get better answers..."
          className={cn(
            "w-full h-48 p-4 rounded-xl text-lg resize-none",
            colors.bg,
            colors.text,
            colors.placeholder,
            colors.border,
            "border-2 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 focus:outline-none transition-all"
          )}
        />
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
          <HelpCircle className="w-4 h-4" />
          <span>Your question will be visible to the community for answers</span>
        </div>
      </div>
    </div>
  );
};

// ==================== ENTERPRISE COMPONENTS ====================

const ContentEditor = ({ content, onChange, theme, maxLength = 5000, placeholder = "What's on your mind?" }) => {
  const editorRef = useRef(null);
  const [charCount, setCharCount] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  const colors = theme === 'dark' ? {
    bg: 'bg-gray-800/90',
    text: 'text-white',
    placeholder: 'text-gray-400',
    border: 'border-gray-700',
    toolbar: 'bg-gray-900/80',
    button: 'bg-gray-700 hover:bg-gray-600',
    buttonText: 'text-gray-300'
  } : {
    bg: 'bg-white/95',
    text: 'text-gray-900',
    placeholder: 'text-gray-500',
    border: 'border-gray-300',
    toolbar: 'bg-gray-50/80',
    button: 'bg-gray-100 hover:bg-gray-200',
    buttonText: 'text-gray-700'
  };

  useEffect(() => {
    setCharCount(content.length);
  }, [content]);

  const handleChange = (e) => {
    const value = e.target.value;
    setCharCount(value.length);
    onChange(value);
  };

  const formattingOptions = [
    { label: 'Bold', icon: Bold, action: () => insertText('**bold text**') },
    { label: 'Italic', icon: Italic, action: () => insertText('*italic text*') },
    { label: 'Link', icon: LinkIcon, action: () => insertText('[link text](https://)') },
    { label: 'Hashtag', icon: Hash, action: () => insertText('#') },
    { label: 'Mention', icon: AtSign, action: () => insertText('@') },
  ];

  const insertText = (text) => {
    const textarea = editorRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = content.substring(0, start) + text + content.substring(end);
    
    onChange(newText);
    setCharCount(newText.length);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  return (
    <div className={cn("rounded-2xl overflow-hidden shadow-xl", colors.border, "border")}>
      <div className={cn("p-4", colors.toolbar)}>
        <div className="flex flex-wrap gap-2">
          {formattingOptions.map((option, idx) => {
            const Icon = option.icon;
            return (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={option.action}
                className={cn(
                  "px-3 py-2 rounded-lg flex items-center gap-2 transition-all duration-200",
                  colors.button,
                  colors.buttonText,
                  "hover:shadow-md"
                )}
                type="button"
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{option.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
      
      <div className="relative">
        <textarea
          ref={editorRef}
          value={content}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={cn(
            "w-full min-h-[200px] p-6 resize-none text-lg leading-relaxed",
            colors.bg,
            colors.text,
            colors.placeholder,
            "focus:outline-none transition-all",
            isFocused && "ring-2 ring-blue-500/30"
          )}
          maxLength={maxLength}
        />
        
        <div className={cn(
          "absolute bottom-4 right-4 px-3 py-1.5 rounded-full text-sm font-medium backdrop-blur-sm",
          charCount > maxLength * 0.9 
            ? "bg-red-500/20 text-red-500" 
            : charCount > maxLength * 0.75
              ? "bg-yellow-500/20 text-yellow-500"
              : "bg-gray-500/20 text-gray-500"
        )}>
          {charCount}/{maxLength}
        </div>
      </div>
      
      <div className={cn("p-4 border-t flex flex-wrap gap-4", colors.toolbar, colors.border)}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className={colors.buttonText}>Auto-save enabled</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className={colors.buttonText}>Spell check active</span>
        </div>
      </div>
    </div>
  );
};

const MediaUploaderPro = ({ files, onAdd, onRemove, theme }) => {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const colors = theme === 'dark' ? {
    bg: 'bg-gray-800/90',
    border: 'border-gray-700',
    text: 'text-white',
    secondary: 'text-gray-400',
    dropzone: 'bg-gray-900/50',
    dropzoneActive: 'bg-purple-900/30',
    card: 'bg-gray-800/90'
  } : {
    bg: 'bg-white/95',
    border: 'border-gray-300',
    text: 'text-gray-900',
    secondary: 'text-gray-600',
    dropzone: 'bg-blue-50/50',
    dropzoneActive: 'bg-blue-100/80',
    card: 'bg-white/90'
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files?.length) {
      await handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = async (e) => {
    if (e.target.files?.length) {
      await handleFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleFiles = async (fileList) => {
    if (files.length + fileList.length > 10) {
      toast.error('Maximum 10 files allowed');
      return;
    }

    const newFiles = [];

    for (const file of fileList) {
      const id = `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
        toast.error(`${file.name} is not a supported file type`);
        continue;
      }

      if (file.size > 100 * 1024 * 1024) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        toast.error(`${file.name} (${sizeMB}MB) exceeds 100MB limit`);
        continue;
      }

      newFiles.push({
        id,
        file,
        preview: URL.createObjectURL(file),
        type: file.type.startsWith('image/') ? 'image' : 
               file.type.startsWith('video/') ? 'video' : 'audio',
        name: file.name,
        size: file.size,
        uploaded: false
      });
    }

    if (newFiles.length > 0) {
      onAdd(newFiles);
      toast.success(`Added ${newFiles.length} file${newFiles.length > 1 ? 's' : ''}`);
    }
  };

  const totalSize = useMemo(() => {
    const bytes = files.reduce((sum, file) => sum + file.size, 0);
    if (bytes > 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }, [files]);

  return (
    <div className="space-y-6">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative rounded-2xl p-8 text-center cursor-pointer transition-all duration-300",
          "border-3 border-dashed backdrop-blur-sm",
          dragActive ? colors.dropzoneActive : colors.dropzone,
          colors.border,
          "hover:shadow-xl"
        )}
      >
        <motion.div
          animate={{ scale: dragActive ? 1.05 : 1 }}
          className="space-y-6"
        >
          <div className={cn(
            "w-20 h-20 rounded-2xl mx-auto flex items-center justify-center",
            dragActive 
              ? "bg-gradient-to-r from-purple-500 to-pink-500" 
              : "bg-gradient-to-r from-blue-500 to-cyan-500",
            "shadow-lg"
          )}>
            {dragActive ? (
              <Upload className="w-10 h-10 text-white" />
            ) : (
              <Camera className="w-10 h-10 text-white" />
            )}
          </div>
          
          <div>
            <h3 className={cn("text-2xl font-bold mb-2", colors.text)}>
              {dragActive ? 'Drop to upload!' : 'Add Media'}
            </h3>
            <p className={cn("text-lg", colors.secondary)}>
              Drag & drop photos, videos, or audio files
            </p>
          </div>
          
          <button
            type="button"
            className={cn(
              "px-8 py-3 rounded-full font-bold text-lg transition-all duration-300",
              "bg-gradient-to-r from-blue-500 to-purple-500 text-white",
              "hover:from-blue-600 hover:to-purple-600 hover:shadow-xl hover:scale-105",
              "active:scale-95"
            )}
          >
            <ImageIcon className="inline mr-2 w-5 h-5" />
            Browse Files
          </button>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div className={cn("p-3 rounded-xl", colors.card)}>
              <div className="font-bold">Max 10 files</div>
              <div className={colors.secondary}>per post</div>
            </div>
            <div className={cn("p-3 rounded-xl", colors.card)}>
              <div className="font-bold">100MB each</div>
              <div className={colors.secondary}>file limit</div>
            </div>
            <div className={cn("p-3 rounded-xl", colors.card)}>
              <div className="font-bold">4K Support</div>
              <div className={colors.secondary}>videos & images</div>
            </div>
            <div className={cn("p-3 rounded-xl", colors.card)}>
              <div className="font-bold">Auto-compress</div>
              <div className={colors.secondary}>smart optimization</div>
            </div>
          </div>
        </motion.div>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
      
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className={cn("text-xl font-bold", colors.text)}>
                Media Gallery ({files.length})
              </h4>
              <p className={cn("text-sm", colors.secondary)}>
                Total size: {totalSize} • {10 - files.length} slots remaining
              </p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "px-4 py-2 rounded-lg font-medium transition-all",
                "bg-gradient-to-r from-green-500 to-emerald-500 text-white",
                "hover:from-green-600 hover:to-emerald-600 hover:scale-105"
              )}
              type="button"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Add More
            </button>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {files.map((media, index) => (
              <motion.div
                key={media.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative group"
              >
                <div className="relative rounded-xl overflow-hidden bg-gray-900 shadow-lg">
                  {media.type === 'image' ? (
                    <img
                      src={media.preview}
                      alt={media.name}
                      className="w-full h-48 object-cover"
                      loading="lazy"
                    />
                  ) : media.type === 'video' ? (
                    <div className="relative w-full h-48 bg-gray-900">
                      <video
                        src={media.preview}
                        className="w-full h-full object-cover"
                        muted
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-3 right-3">
                        <div className="px-3 py-1.5 rounded-full bg-black/80 text-white text-xs font-bold flex items-center gap-1">
                          <Video className="w-3 h-3" />
                          VIDEO
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-full h-48 bg-gray-900 flex items-center justify-center">
                      <div className="text-center">
                        <Music className="w-16 h-16 text-white/50" />
                        <div className="absolute bottom-3 right-3">
                          <div className="px-3 py-1.5 rounded-full bg-black/80 text-white text-xs font-bold flex items-center gap-1">
                            <Volume2 className="w-3 h-3" />
                            AUDIO
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-white text-sm font-medium truncate max-w-[70%]">
                          {media.name.length > 20 ? media.name.substring(0, 20) + '...' : media.name}
                        </span>
                        <button
                          onClick={() => onRemove(media.id)}
                          className="p-2 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors"
                          type="button"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-black/70 text-white text-xs font-medium">
                    {(media.size / (1024 * 1024)).toFixed(1)}MB
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== MAIN COMPONENT ====================

const CreatePostUltraPro = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const { 
    currentUser, 
    coins: userCoins, 
    deductCoins, 
    addNotification,
    isAuthenticated
  } = useAppStore();
  
  // ========== FIXED: State Management ==========
  const [loading, setLoading] = useState(true); // Start with loading true
  const [initialLoad, setInitialLoad] = useState(true); // Track initial load
  const [step, setStep] = useState(1);
  const [postType, setPostType] = useState('text');
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [visibility, setVisibility] = useState('public');
  const [boost, setBoost] = useState('none');
  const [monetization, setMonetization] = useState('none');
  
  // Post type specific states
  const [pollData, setPollData] = useState({
    question: '',
    options: ['', ''],
    duration: 24,
    allowMultiple: false
  });
  const [question, setQuestion] = useState('');
  const [linkData, setLinkData] = useState({
    url: '',
    title: '',
    description: ''
  });
  const [eventData, setEventData] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    description: ''
  });
  
  // Auto-save
  const autoSaveRef = useRef(null);
  
  // Colors based on theme
  const colors = theme === 'dark' ? {
    gradient: 'bg-gradient-to-b from-gray-900 via-gray-950 to-black',
    card: 'bg-gray-800/90',
    cardGlass: 'bg-gray-800/60 backdrop-blur-xl',
    border: 'border-gray-700',
    text: 'text-white',
    textSecondary: 'text-gray-400',
    accent: 'text-purple-400',
    primary: 'bg-gradient-to-r from-purple-600 to-pink-600',
    primaryHover: 'hover:from-purple-700 hover:to-pink-700',
    success: 'text-green-400',
    error: 'text-red-400',
    warning: 'text-amber-400',
    overlay: 'bg-black/70'
  } : {
    gradient: 'bg-gradient-to-b from-blue-50 via-white to-white',
    card: 'bg-white/95',
    cardGlass: 'bg-white/80 backdrop-blur-xl',
    border: 'border-gray-200',
    text: 'text-gray-900',
    textSecondary: 'text-gray-600',
    accent: 'text-blue-600',
    primary: 'bg-gradient-to-r from-blue-500 to-purple-500',
    primaryHover: 'hover:from-blue-600 hover:to-purple-600',
    success: 'text-green-600',
    error: 'text-red-600',
    warning: 'text-amber-600',
    overlay: 'bg-black/50'
  };
  
  // ========== FIXED: Initialize without validation ==========
  useEffect(() => {
    console.log('🚀 ULTRA PRO Create Post Initializing...');
    
    // Check authentication immediately
    if (!currentUser?.uid || !isAuthenticated) {
      console.log('🔒 User not authenticated, redirecting...');
      navigate('/login');
      return;
    }
    
    // Load auto-save data
    const saved = localStorage.getItem('arvdoul_post_ultra_autosave');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (Date.now() - (data.timestamp || 0) < 24 * 60 * 60 * 1000) { // 24 hours
          setContent(data.content || '');
          setPostType(data.postType || 'text');
          setVisibility(data.visibility || 'public');
          if (data.pollData) setPollData(data.pollData);
          if (data.question) setQuestion(data.question);
          if (data.linkData) setLinkData(data.linkData);
          if (data.eventData) setEventData(data.eventData);
        }
      } catch (e) {
        console.warn('Failed to load auto-save');
      }
    }
    
    // Set loading to false after 500ms (prevents flash)
    const timer = setTimeout(() => {
      setInitialLoad(false);
      setLoading(false);
      console.log('✅ Create Post screen ready');
    }, 500);
    
    // Setup auto-save interval
    autoSaveRef.current = setInterval(() => {
      if (content.trim() || mediaFiles.length > 0 || hasPostTypeData()) {
        saveAutoSave();
      }
    }, 15000);
    
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
      clearTimeout(timer);
    };
  }, []); // Empty dependency array - runs once on mount
  
  const hasPostTypeData = () => {
    switch (postType) {
      case 'poll': return pollData.question.trim() !== '';
      case 'question': return question.trim() !== '';
      case 'link': return linkData.url.trim() !== '';
      case 'event': return eventData.title.trim() !== '';
      default: return false;
    }
  };
  
  const saveAutoSave = () => {
    try {
      const data = {
        content,
        postType,
        visibility,
        boost,
        monetization,
        pollData,
        question,
        linkData,
        eventData,
        timestamp: Date.now()
      };
      localStorage.setItem('arvdoul_post_ultra_autosave', JSON.stringify(data));
    } catch (e) {
      console.warn('Auto-save failed');
    }
  };
  
  const handleAddMedia = (newFiles) => {
    setMediaFiles(prev => {
      const updated = [...prev, ...newFiles];
      return updated.slice(0, 10);
    });
  };
  
  const handleRemoveMedia = (id) => {
    setMediaFiles(prev => prev.filter(f => f.id !== id));
  };
  
  // ========== FIXED: Validation function - ONLY called on publish ==========
  const validatePostData = useCallback(() => {
    if (initialLoad) return false; // Don't validate during initial load
    
    switch (postType) {
      case 'poll':
        if (!pollData.question.trim()) {
          toast.error('Please enter a poll question');
          return false;
        }
        const validOptions = pollData.options.filter(opt => opt.trim() !== '');
        if (validOptions.length < 2) {
          toast.error('Please add at least 2 poll options');
          return false;
        }
        break;
      case 'question':
        if (!question.trim()) {
          toast.error('Please enter a question');
          return false;
        }
        break;
      case 'link':
        if (!linkData.url.trim()) {
          toast.error('Please enter a valid URL');
          return false;
        }
        try {
          new URL(linkData.url);
        } catch {
          toast.error('Please enter a valid URL');
          return false;
        }
        break;
      case 'event':
        if (!eventData.title.trim()) {
          toast.error('Please enter an event title');
          return false;
        }
        if (!eventData.date) {
          toast.error('Please select an event date');
          return false;
        }
        break;
      default:
        if (!content.trim() && mediaFiles.length === 0) {
          toast.error('Please add content to your post');
          return false;
        }
    }
    
    // Check if user can afford boost
    const boostOption = BOOST_OPTIONS.find(b => b.id === boost);
    if (boostOption && boostOption.coins > 0 && userCoins < boostOption.coins) {
      toast.error(`You need ${boostOption.coins - userCoins} more coins for this boost`);
      return false;
    }
    
    return true;
  }, [postType, pollData, question, linkData, eventData, content, mediaFiles, boost, userCoins, initialLoad]);
  
  // ========== FIXED: Publish function with REAL Firebase ==========
  const handlePublish = async () => {
    if (!currentUser?.uid) {
      toast.error('Please sign in to post');
      navigate('/login');
      return;
    }
    
    // Validate only when publishing
    if (!validatePostData()) {
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('🚀 ULTRA PRO: Publishing post with REAL Firebase...');
      
      // Import services dynamically
      const [firestoreModule, storageModule] = await Promise.all([
        import('../services/firestoreService.js'),
        import('../services/storageService.js')
      ]);
      
      const firestoreService = firestoreModule.default || firestoreModule.firestoreService;
      const storageService = storageModule.default;
      
      if (!firestoreService || !storageService) {
        throw new Error('Required services unavailable');
      }
      
      // Ensure services are initialized
      await Promise.all([
        firestoreService.ensureInitialized(),
        storageService.initialize()
      ]);
      
      // Create post data
      const postData = {
        type: postType,
        content: content.trim(),
        media: [],
        authorId: currentUser.uid,
        authorName: currentUser.displayName || 'Arvdoul User',
        authorUsername: currentUser.username || `user_${currentUser.uid.slice(0, 8)}`,
        authorPhoto: currentUser.photoURL || '/assets/default-profile.png',
        visibility,
        enableComments: true,
        enableGifts: true,
        location: null,
        status: 'published',
        isDeleted: false,
        monetization: monetization !== 'none' ? {
          type: monetization,
          enabled: true,
          settings: SMART_MONETIZATION_OPTIONS.find(m => m.id === monetization)
        } : null,
        boostData: boost !== 'none' ? {
          type: boost,
          appliedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          cost: BOOST_OPTIONS.find(b => b.id === boost)?.coins || 0
        } : null,
        version: 'ultra-pro-v6'
      };
      
      // Add post type specific data
      switch (postType) {
        case 'poll':
          postData.poll = {
            question: pollData.question,
            options: pollData.options.filter(opt => opt.trim() !== ''),
            duration: pollData.duration,
            allowMultiple: pollData.allowMultiple,
            votes: [],
            totalVotes: 0
          };
          break;
        case 'question':
          postData.question = question;
          postData.answers = [];
          break;
        case 'link':
          postData.link = linkData;
          break;
        case 'event':
          postData.event = eventData;
          break;
      }
      
      // Upload media files if any
      if (mediaFiles.length > 0) {
        const uploadPromises = mediaFiles.map(async (file) => {
          try {
            const result = await storageService.uploadFile(
              file.file,
              `posts/${currentUser.uid}/${Date.now()}_${file.file.name}`,
              {
                userId: currentUser.uid,
                compressImages: true
              }
            );
            return {
              url: result.downloadURL,
              type: file.type,
              name: file.file.name,
              size: file.file.size
            };
          } catch (uploadError) {
            console.warn('Media upload failed:', uploadError);
            return null;
          }
        });
        
        const mediaResults = await Promise.all(uploadPromises);
        postData.media = mediaResults.filter(m => m !== null);
        
        if (mediaResults.some(m => m === null)) {
          toast.warning('Some media uploads failed. Post created without them.');
        }
      }
      
      // Create post in Firestore
      const result = await firestoreService.createPost(postData);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create post');
      }
      
      console.log('✅ Post created successfully:', result.postId);
      
      // Handle coin deductions for boost
      const boostOption = BOOST_OPTIONS.find(b => b.id === boost);
      if (boostOption && boostOption.coins > 0 && userCoins >= boostOption.coins) {
        deductCoins(boostOption.coins);
        
        addNotification({
          type: 'boost',
          title: 'Post Boosted! 🚀',
          message: `Your post has been boosted with ${boostOption.label} for ${boostOption.coins} coins`,
          read: false,
          timestamp: new Date().toISOString()
        });
      }
      
      // Clear auto-save
      localStorage.removeItem('arvdoul_post_ultra_autosave');
      
      // Success notification
      toast.success(
        <div className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Post Published Successfully! 🎉</h3>
              <p className="text-sm opacity-90">
                Your {postType} post is now live{boost !== 'none' ? ` and boosted` : ''}
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => navigate(`/home`)}
              className="flex-1 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium"
            >
              Go Home
            </button>
            <button
              onClick={() => navigate(`/post/${result.postId}`)}
              className="flex-1 py-2 rounded-lg border border-gray-300 dark:border-gray-700 font-medium"
            >
              View Post
            </button>
          </div>
        </div>,
        { duration: 5000 }
      );
      
      // Navigate after delay
      setTimeout(() => navigate('/home'), 1500);
      
    } catch (error) {
      console.error('❌ Publish failed:', error);
      
      let errorMessage = 'Failed to publish post';
      
      if (error.code === 'permission-denied') {
        errorMessage = 'You don\'t have permission to create posts. Please check Firebase rules.';
      } else if (error.code === 'unauthenticated') {
        errorMessage = 'Please sign in to create posts.';
      } else if (error.message.includes('network') || error.code === 'unavailable') {
        errorMessage = 'Network error. Please check your connection.';
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      toast.error(
        <div className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <h3 className="font-bold text-lg">Publishing Failed</h3>
          </div>
          <p className="mb-4">{errorMessage}</p>
          <button
            onClick={() => setLoading(false)}
            className="w-full py-2 rounded-lg bg-gradient-to-r from-red-500 to-pink-500 text-white font-medium"
          >
            OK
          </button>
        </div>,
        { duration: 10000 }
      );
      
    } finally {
      setLoading(false);
    }
  };
  
  const handleSaveDraft = () => {
    const draftData = {
      content,
      postType,
      visibility,
      boost,
      monetization,
      mediaCount: mediaFiles.length,
      pollData,
      question,
      linkData,
      eventData,
      updatedAt: new Date().toISOString()
    };
    
    localStorage.setItem('arvdoul_post_draft', JSON.stringify(draftData));
    
    toast.success(
      <div className="flex items-center gap-3">
        <Save className="w-5 h-5 text-green-500" />
        <div>
          <div className="font-bold">Draft Saved 💾</div>
          <div className="text-sm opacity-90">Your post has been saved for later</div>
        </div>
      </div>
    );
  };
  
  const handleDiscard = () => {
    if (content.trim() || mediaFiles.length > 0 || hasPostTypeData()) {
      toast(
        <div className="p-4">
          <h3 className="font-bold text-lg mb-2">Discard Post?</h3>
          <p className="mb-4">Any unsaved changes will be lost</p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                localStorage.removeItem('arvdoul_post_ultra_autosave');
                localStorage.removeItem('arvdoul_post_draft');
                navigate(-1);
              }}
              className="flex-1 py-2 rounded-lg bg-red-500 text-white font-medium"
            >
              Discard
            </button>
            <button
              onClick={() => toast.dismiss()}
              className="flex-1 py-2 rounded-lg border border-gray-300 dark:border-gray-700 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>,
        { duration: 10000 }
      );
    } else {
      navigate(-1);
    }
  };
  
  // Render post type specific content
  const renderPostTypeContent = () => {
    const commonContent = (
      <>
        <div className="mb-10">
          <h2 className={cn("text-2xl font-bold mb-6", colors.text)}>Create Your Content</h2>
          <ContentEditor
            content={content}
            onChange={setContent}
            theme={theme}
            maxLength={5000}
            placeholder={postType === 'question' ? "Ask your question..." : "What's on your mind?"}
          />
        </div>
        
        {['image', 'video', 'audio'].includes(postType) && (
          <div className="mb-10">
            <h2 className={cn("text-2xl font-bold mb-6", colors.text)}>
              {postType === 'image' ? 'Add Photos' : 
               postType === 'video' ? 'Add Videos' : 'Add Audio'}
            </h2>
            <MediaUploaderPro
              files={mediaFiles}
              onAdd={handleAddMedia}
              onRemove={handleRemoveMedia}
              theme={theme}
            />
          </div>
        )}
      </>
    );
    
    switch (postType) {
      case 'poll':
        return (
          <>
            {commonContent}
            <PollCreator
              pollData={pollData}
              onChange={setPollData}
              theme={theme}
            />
          </>
        );
      case 'question':
        return (
          <>
            {commonContent}
            <QuestionCreator
              question={question}
              onChange={setQuestion}
              theme={theme}
            />
          </>
        );
      case 'link':
        return (
          <>
            {commonContent}
            <div className={cn("rounded-2xl p-6", colors.card, colors.border, "border shadow-xl")}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-gradient-to-r from-indigo-500/20 to-blue-500/20">
                  <LinkIcon className="w-6 h-6 text-indigo-500" />
                </div>
                <div>
                  <h3 className={cn("text-xl font-bold", colors.text)}>Share a Link</h3>
                  <p className={cn("text-sm", colors.textSecondary)}>Share interesting content from the web</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className={cn("block text-sm font-medium mb-2", colors.text)}>URL</label>
                  <input
                    type="url"
                    value={linkData.url}
                    onChange={(e) => setLinkData({...linkData, url: e.target.value})}
                    placeholder="https://example.com"
                    className={cn(
                      "w-full p-4 rounded-xl",
                      colors.bg,
                      colors.text,
                      colors.border,
                      "border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
                    )}
                  />
                </div>
                <div>
                  <label className={cn("block text-sm font-medium mb-2", colors.text)}>Title (Optional)</label>
                  <input
                    type="text"
                    value={linkData.title}
                    onChange={(e) => setLinkData({...linkData, title: e.target.value})}
                    placeholder="Link title"
                    className={cn(
                      "w-full p-4 rounded-xl",
                      colors.bg,
                      colors.text,
                      colors.border,
                      "border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
                    )}
                  />
                </div>
                <div>
                  <label className={cn("block text-sm font-medium mb-2", colors.text)}>Description (Optional)</label>
                  <textarea
                    value={linkData.description}
                    onChange={(e) => setLinkData({...linkData, description: e.target.value})}
                    placeholder="Describe what this link is about..."
                    className={cn(
                      "w-full h-32 p-4 rounded-xl resize-none",
                      colors.bg,
                      colors.text,
                      colors.border,
                      "border-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 focus:outline-none"
                    )}
                  />
                </div>
              </div>
            </div>
          </>
        );
      case 'event':
        return (
          <>
            {commonContent}
            <div className={cn("rounded-2xl p-6", colors.card, colors.border, "border shadow-xl")}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-gradient-to-r from-orange-500/20 to-red-500/20">
                  <Calendar className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <h3 className={cn("text-xl font-bold", colors.text)}>Create Event</h3>
                  <p className={cn("text-sm", colors.textSecondary)}>Organize and share events</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className={cn("block text-sm font-medium mb-2", colors.text)}>Event Title</label>
                  <input
                    type="text"
                    value={eventData.title}
                    onChange={(e) => setEventData({...eventData, title: e.target.value})}
                    placeholder="Event name..."
                    className={cn(
                      "w-full p-4 rounded-xl",
                      colors.bg,
                      colors.text,
                      colors.border,
                      "border-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 focus:outline-none"
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={cn("block text-sm font-medium mb-2", colors.text)}>Date</label>
                    <input
                      type="date"
                      value={eventData.date}
                      onChange={(e) => setEventData({...eventData, date: e.target.value})}
                      min={new Date().toISOString().split('T')[0]}
                      className={cn(
                        "w-full p-4 rounded-xl",
                        colors.bg,
                        colors.text,
                        colors.border,
                        "border-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 focus:outline-none"
                      )}
                    />
                  </div>
                  <div>
                    <label className={cn("block text-sm font-medium mb-2", colors.text)}>Time</label>
                    <input
                      type="time"
                      value={eventData.time}
                      onChange={(e) => setEventData({...eventData, time: e.target.value})}
                      className={cn(
                        "w-full p-4 rounded-xl",
                        colors.bg,
                        colors.text,
                        colors.border,
                        "border-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 focus:outline-none"
                      )}
                    />
                  </div>
                </div>
                <div>
                  <label className={cn("block text-sm font-medium mb-2", colors.text)}>Location</label>
                  <input
                    type="text"
                    value={eventData.location}
                    onChange={(e) => setEventData({...eventData, location: e.target.value})}
                    placeholder="Virtual or physical location..."
                    className={cn(
                      "w-full p-4 rounded-xl",
                      colors.bg,
                      colors.text,
                      colors.border,
                      "border-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 focus:outline-none"
                    )}
                  />
                </div>
                <div>
                  <label className={cn("block text-sm font-medium mb-2", colors.text)}>Description</label>
                  <textarea
                    value={eventData.description}
                    onChange={(e) => setEventData({...eventData, description: e.target.value})}
                    placeholder="Describe your event..."
                    className={cn(
                      "w-full h-32 p-4 rounded-xl resize-none",
                      colors.bg,
                      colors.text,
                      colors.border,
                      "border-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 focus:outline-none"
                    )}
                  />
                </div>
              </div>
            </div>
          </>
        );
      default:
        return commonContent;
    }
  };
  
  // Render step content
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-10">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className={cn("text-2xl font-bold", colors.text)}>Choose Post Type</h2>
                  <p className={cn("text-sm", colors.textSecondary)}>Select the best format for your content</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">Premium features available</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {POST_TYPES.map((type) => {
                  const Icon = type.icon;
                  const selected = postType === type.id;
                  
                  return (
                    <motion.button
                      key={type.id}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setPostType(type.id)}
                      className={cn(
                        "relative p-5 rounded-2xl text-left transition-all duration-300",
                        "border-2 backdrop-blur-sm",
                        selected 
                          ? "border-blue-500 bg-gradient-to-br from-blue-500/10 to-purple-500/10" 
                          : colors.border,
                        colors.card,
                        "hover:shadow-lg group"
                      )}
                      type="button"
                    >
                      {type.premium && (
                        <div className="absolute -top-2 -right-2 z-10">
                          <div className="px-2 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-xs font-bold flex items-center gap-1">
                            <Crown className="w-3 h-3" />
                            <span>PREMIUM</span>
                          </div>
                        </div>
                      )}
                      
                      <div className={cn(
                        "w-14 h-14 rounded-xl mb-4 flex items-center justify-center",
                        `bg-gradient-to-br ${type.color}`,
                        selected && "scale-110 shadow-lg"
                      )}>
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      
                      <div>
                        <h3 className={cn("font-bold text-lg mb-1", colors.text)}>
                          {type.label}
                        </h3>
                        <p className={cn("text-sm mb-3", colors.textSecondary)}>
                          {type.description}
                        </p>
                      </div>
                      
                      {selected && (
                        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                          <div className="px-3 py-1 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-bold">
                            SELECTED
                          </div>
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
            
            {renderPostTypeContent()}
          </div>
        );
        
      case 2:
        return (
          <div className="space-y-10">
            <div>
              <h2 className={cn("text-2xl font-bold mb-6", colors.text)}>Post Settings</h2>
              
              {/* Visibility */}
              <div className={cn("rounded-2xl p-6 mb-8", colors.card, colors.border, "border shadow-xl")}>
                <h3 className={cn("text-xl font-bold mb-6", colors.text)}>Visibility</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {VISIBILITY_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const selected = visibility === option.id;
                    const canAfford = userCoins >= option.cost;
                    
                    return (
                      <button
                        key={option.id}
                        onClick={() => {
                          if (option.cost > 0 && !canAfford) {
                            toast.error(`Need ${option.cost - userCoins} more coins for ${option.label}`);
                            return;
                          }
                          setVisibility(option.id);
                        }}
                        className={cn(
                          "relative p-5 rounded-xl text-left transition-all duration-300",
                          "border-2",
                          selected ? option.borderColor : colors.border,
                          colors.card,
                          "hover:shadow-lg hover:scale-[1.02]",
                          !canAfford && option.cost > 0 && "opacity-60"
                        )}
                        type="button"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className={cn(
                            "p-2.5 rounded-lg text-2xl",
                            option.iconColor
                          )}>
                            {option.badge}
                          </div>
                          <span className={cn(
                            "font-bold",
                            selected ? option.color : colors.text
                          )}>
                            {option.label}
                          </span>
                        </div>
                        
                        <p className={cn("text-sm mb-2", colors.textSecondary)}>
                          {option.description}
                        </p>
                        
                        {option.cost > 0 && (
                          <div className={cn(
                            "flex items-center gap-1 text-sm font-bold",
                            canAfford ? "text-amber-500" : "text-red-500"
                          )}>
                            {option.cost} <Coins className="w-4 h-4" />
                          </div>
                        )}
                        
                        {selected && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                            <CheckCircle className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Smart Monetization */}
              <div className={cn("rounded-2xl p-6 mb-8", colors.card, colors.border, "border shadow-xl")}>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20">
                      <DollarSign className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                      <h3 className={cn("text-2xl font-bold", colors.text)}>Smart Monetization</h3>
                      <p className={colors.textSecondary}>Earn coins like TikTok creators</p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {SMART_MONETIZATION_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = monetization === option.id;
                    const isActive = option.id !== 'none';
                    
                    return (
                      <motion.button
                        key={option.id}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setMonetization(option.id)}
                        className={cn(
                          "relative p-5 rounded-xl text-left transition-all duration-300",
                          "border-2 backdrop-blur-sm",
                          isSelected 
                            ? `${option.color.replace('text', 'border')} bg-gradient-to-br ${option.color.replace('text', 'from')}/10` 
                            : colors.border,
                          colors.card,
                          "hover:shadow-lg"
                        )}
                        type="button"
                      >
                        {isActive && option.earnings && (
                          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                            <div className="px-2 py-1 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold">
                              {option.earnings}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-3 mb-3">
                          <div className={cn("p-2.5 rounded-lg", option.color.replace('text', 'bg') + '/20')}>
                            <Icon className={cn("w-5 h-5", option.color)} />
                          </div>
                          <span className={cn("font-bold", option.color)}>
                            {option.label}
                          </span>
                        </div>
                        
                        <p className={cn("text-sm mb-4", colors.textSecondary)}>
                          {option.description}
                        </p>
                        
                        {isActive && (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className={cn("text-xs", colors.textSecondary)}>Platform Fee:</span>
                              <span className="text-xs font-bold text-red-500">{option.fee}%</span>
                            </div>
                            {option.price && (
                              <div className="flex justify-between items-center">
                                <span className={cn("text-xs", colors.textSecondary)}>Price:</span>
                                <span className="text-xs font-bold text-amber-500">{option.price} 🪙</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {isSelected && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                            <CheckCircle className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
              
              {/* Boost */}
              <div className={cn("rounded-2xl p-6", colors.card, colors.border, "border shadow-xl")}>
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20">
                      <Rocket className="w-6 h-6 text-purple-500" />
                    </div>
                    <div>
                      <h3 className={cn("text-2xl font-bold", colors.text)}>Boost Your Post</h3>
                      <p className={colors.textSecondary}>Increase reach and engagement</p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
                  {BOOST_OPTIONS.map((boostOption) => {
                    const Icon = boostOption.icon;
                    const isSelected = boost === boostOption.id;
                    const canAfford = userCoins >= boostOption.coins;
                    
                    return (
                      <motion.div
                        key={boostOption.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={cn(
                          "relative rounded-xl p-6 transition-all duration-300",
                          "border-2 backdrop-blur-sm",
                          isSelected 
                            ? "border-purple-500 bg-gradient-to-br from-purple-500/10 to-pink-500/10 shadow-xl" 
                            : colors.border,
                          colors.card,
                          !canAfford && boostOption.coins > 0 && "opacity-60"
                        )}
                      >
                        {boostOption.recommended && (
                          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                            <div className="px-3 py-1 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold flex items-center gap-1">
                              <Star className="w-3 h-3" />
                              RECOMMENDED
                            </div>
                          </div>
                        )}
                        
                        <div className={cn(
                          "w-16 h-16 rounded-2xl mb-4 flex items-center justify-center mx-auto",
                          `bg-gradient-to-br ${boostOption.color}`,
                          isSelected && "scale-110 shadow-lg"
                        )}>
                          <Icon className="w-8 h-8 text-white" />
                        </div>
                        
                        <div className="text-center mb-6">
                          <h4 className={cn("text-xl font-bold mb-2", colors.text)}>
                            {boostOption.label}
                          </h4>
                          <div className={cn(
                            "text-3xl font-bold mb-1 flex items-center justify-center gap-1",
                            boostOption.coins > 0 ? "text-amber-500" : colors.textSecondary
                          )}>
                            {boostOption.coins > 0 ? `${boostOption.coins}` : 'FREE'}
                            {boostOption.coins > 0 && <Coins className="w-6 h-6" />}
                          </div>
                          <p className={cn("text-sm", colors.textSecondary)}>
                            {boostOption.duration} • {boostOption.reach}
                          </p>
                        </div>
                        
                        <ul className="space-y-2 mb-6">
                          {boostOption.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span className={cn("text-sm", colors.textSecondary)}>{feature}</span>
                            </li>
                          ))}
                        </ul>
                        
                        <button
                          onClick={() => {
                            if (boostOption.coins > 0 && !canAfford) {
                              toast.error(`Need ${boostOption.coins - userCoins} more coins for ${boostOption.label}`);
                              return;
                            }
                            setBoost(boostOption.id);
                          }}
                          disabled={!canAfford && boostOption.coins > 0}
                          className={cn(
                            "w-full py-3 rounded-lg font-bold transition-all duration-300",
                            isSelected
                              ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                              : canAfford
                                ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600"
                                : "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            "hover:shadow-lg hover:scale-105 active:scale-95"
                          )}
                          type="button"
                        >
                          {isSelected ? (
                            <>
                              <CheckCircle className="w-4 h-4 inline mr-2" />
                              SELECTED
                            </>
                          ) : canAfford ? (
                            `BOOST FOR ${boostOption.coins} COINS`
                          ) : (
                            `NEED ${boostOption.coins - userCoins} MORE COINS`
                          )}
                        </button>
                        
                        {isSelected && (
                          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                            <div className="px-3 py-1 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold">
                              ACTIVE BOOST
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
        
      case 3:
        return (
          <div className="space-y-10">
            <h2 className={cn("text-2xl font-bold", colors.text)}>Review & Publish</h2>
            
            {/* Post Preview */}
            <div className={cn("rounded-2xl p-6", colors.card, colors.border, "border shadow-xl")}>
              <div className="flex items-center gap-4 mb-6">
                <div className="relative">
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 opacity-50 blur" />
                  <img
                    src={currentUser?.photoURL || '/assets/default-profile.png'}
                    alt=""
                    className="relative w-12 h-12 rounded-full border-2 border-white object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-bold">{currentUser?.displayName || 'Arvdoul User'}</h4>
                  <div className="flex items-center gap-3 text-sm">
                    <span className={colors.textSecondary}>Just now</span>
                    <span className="px-2 py-1 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-500 dark:text-blue-400 text-xs font-bold">
                      {visibility.toUpperCase()}
                    </span>
                    {boost !== 'none' && (
                      <span className="px-2 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-500 dark:text-amber-400 text-xs font-bold">
                        {boost.toUpperCase()} BOOST
                      </span>
                    )}
                    {monetization !== 'none' && (
                      <span className="px-2 py-1 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-500 dark:text-green-400 text-xs font-bold">
                        MONETIZED
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {content && (
                <div className="mb-6">
                  <p className="whitespace-pre-line text-lg">{content}</p>
                </div>
              )}
              
              {/* Post type specific preview */}
              {postType === 'poll' && pollData.question && (
                <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10">
                  <h5 className="font-bold mb-2">📊 Poll: {pollData.question}</h5>
                  <div className="space-y-2">
                    {pollData.options.filter(opt => opt.trim()).map((option, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-white/10">
                        {option}
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">Duration: {pollData.duration} hours</p>
                </div>
              )}
              
              {postType === 'question' && question && (
                <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-yellow-500/10">
                  <h5 className="font-bold mb-2">❓ Question</h5>
                  <p>{question}</p>
                </div>
              )}
              
              {postType === 'link' && linkData.url && (
                <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 to-blue-500/10">
                  <h5 className="font-bold mb-2">🔗 Link</h5>
                  <a href={linkData.url} className="text-blue-500 hover:underline break-all" target="_blank" rel="noopener noreferrer">
                    {linkData.title || linkData.url}
                  </a>
                  {linkData.description && (
                    <p className="text-sm mt-2">{linkData.description}</p>
                  )}
                </div>
              )}
              
              {postType === 'event' && eventData.title && (
                <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/10">
                  <h5 className="font-bold mb-2">📅 Event: {eventData.title}</h5>
                  <div className="space-y-1 text-sm">
                    <p>📅 Date: {eventData.date}</p>
                    <p>⏰ Time: {eventData.time}</p>
                    <p>📍 Location: {eventData.location}</p>
                    {eventData.description && (
                      <p className="mt-2">{eventData.description}</p>
                    )}
                  </div>
                </div>
              )}
              
              {mediaFiles.length > 0 && (
                <div className="mb-6">
                  <div className="grid grid-cols-2 gap-3">
                    {mediaFiles.slice(0, 4).map((media, idx) => (
                      <div key={idx} className="aspect-square rounded-xl overflow-hidden bg-gray-900">
                        {media.type === 'image' ? (
                          <img src={media.preview} alt="" className="w-full h-full object-cover" />
                        ) : media.type === 'video' ? (
                          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                            <Video className="w-8 h-8 text-white/50" />
                          </div>
                        ) : (
                          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                            <Music className="w-8 h-8 text-white/50" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className={cn("p-6 rounded-2xl", colors.card, colors.border, "border shadow-xl")}>
                <h4 className={cn("font-bold mb-4", colors.text)}>Post Details</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className={colors.textSecondary}>Type:</span>
                    <span className="font-medium">{POST_TYPES.find(t => t.id === postType)?.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={colors.textSecondary}>Media:</span>
                    <span className="font-medium">{mediaFiles.length} files</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={colors.textSecondary}>Visibility:</span>
                    <span className="font-medium">{VISIBILITY_OPTIONS.find(v => v.id === visibility)?.label}</span>
                  </div>
                </div>
              </div>
              
              <div className={cn("p-6 rounded-2xl", colors.card, colors.border, "border shadow-xl")}>
                <h4 className={cn("font-bold mb-4", colors.text)}>Monetization</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className={colors.textSecondary}>Type:</span>
                    <span className="font-medium">{SMART_MONETIZATION_OPTIONS.find(m => m.id === monetization)?.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={colors.textSecondary}>Boost:</span>
                    <span className="font-medium">{BOOST_OPTIONS.find(b => b.id === boost)?.label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={colors.textSecondary}>Boost Cost:</span>
                    <span className="font-bold text-amber-500">
                      {BOOST_OPTIONS.find(b => b.id === boost)?.coins || 0} 🪙
                    </span>
                  </div>
                </div>
              </div>
              
              <div className={cn("p-6 rounded-2xl", colors.card, colors.border, "border shadow-xl")}>
                <h4 className={cn("font-bold mb-4", colors.text)}>Cost Summary</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className={colors.textSecondary}>Post Creation:</span>
                    <span className="font-medium text-green-500">FREE</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={colors.textSecondary}>Boost Cost:</span>
                    <span className="font-medium">
                      {BOOST_OPTIONS.find(b => b.id === boost)?.coins || 0} 🪙
                    </span>
                  </div>
                  <div className="pt-3 border-t">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total Cost:</span>
                      <span className="text-2xl text-amber-500">
                        {BOOST_OPTIONS.find(b => b.id === boost)?.coins || 0} 🪙
                      </span>
                    </div>
                    <div className="flex justify-between text-lg font-bold mt-2">
                      <span>Your Balance:</span>
                      <span className="text-2xl">{userCoins} 🪙</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  // ========== FIXED: Loading state ==========
  if (initialLoad || !currentUser) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center", colors.gradient)}>
        <div className="text-center">
          <LoadingSpinner size="xl" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading create post screen...</p>
        </div>
      </div>
    );
  }
  
  return (
    <LazyMotion features={domAnimation}>
      <div className={cn("min-h-screen pb-20", colors.gradient)}>
        {/* Sticky Navigation Header */}
        <div className={cn(
          "sticky top-0 z-50 border-b backdrop-blur-xl",
          colors.cardGlass,
          colors.border,
          "shadow-2xl"
        )}>
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Left Section */}
              <div className="flex items-center gap-4">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleDiscard}
                  className={cn(
                    "p-3 rounded-xl transition-all duration-200",
                    theme === 'dark' 
                      ? 'hover:bg-gray-800 text-gray-400' 
                      : 'hover:bg-gray-100 text-gray-600'
                  )}
                  type="button"
                  disabled={loading}
                >
                  <X className="w-5 h-5" />
                </motion.button>
                
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                    Create {POST_TYPES.find(t => t.id === postType)?.label || 'Post'}
                  </h1>
                  <p className={cn("text-sm", colors.textSecondary)}>
                    Share with the Arvdoul community
                  </p>
                </div>
              </div>
              
              {/* Steps */}
              <div className="flex items-center justify-center gap-6">
                {[1, 2, 3].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStep(s)}
                    className="flex items-center gap-3 group"
                    type="button"
                    disabled={loading}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 relative",
                      step >= s
                        ? `${colors.primary} ${colors.text} shadow-lg`
                        : theme === 'dark'
                          ? 'bg-gray-800 text-gray-400 group-hover:bg-gray-700'
                          : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                    )}>
                      {s}
                      {step === s && (
                        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 opacity-50 blur-sm" />
                      )}
                    </div>
                    <span className={cn(
                      "font-medium hidden md:block transition-colors",
                      step >= s ? colors.text : colors.textSecondary
                    )}>
                      {s === 1 ? 'Content' : s === 2 ? 'Settings' : 'Review'}
                    </span>
                  </button>
                ))}
              </div>
              
              {/* Right Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveDraft}
                  className={cn(
                    "px-5 py-2.5 rounded-xl font-medium transition-all duration-300",
                    theme === 'dark' 
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:scale-105' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105'
                  )}
                  type="button"
                  disabled={loading}
                >
                  <Save className="w-4 h-4 inline mr-2" />
                  Save Draft
                </button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handlePublish}
                  disabled={loading}
                  className={cn(
                    "px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all duration-300",
                    colors.primary,
                    colors.text,
                    "hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  type="button"
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Publish Post
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          {/* User Profile Header */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "rounded-2xl p-6 mb-8",
              colors.card,
              colors.border,
              "border shadow-xl"
            )}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 opacity-75 blur-sm" />
                  <img
                    src={currentUser?.photoURL || '/assets/default-profile.png'}
                    alt={currentUser?.displayName}
                    className="relative w-16 h-16 rounded-full border-4 border-white/80 object-cover"
                  />
                </div>
                
                <div>
                  <h3 className="text-xl font-bold">{currentUser?.displayName || 'Arvdoul User'}</h3>
                  <p className={colors.textSecondary}>
                    @{currentUser?.username || `user_${currentUser?.uid?.slice(0, 8)}`}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold flex items-center justify-center gap-2">
                    <Coins className="w-6 h-6 text-yellow-500" />
                    <span className={colors.accent}>{userCoins.toLocaleString()}</span>
                  </div>
                  <p className={colors.textSecondary}>Available Coins</p>
                </div>
                
                <button
                  onClick={() => navigate('/coins')}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium transition-all duration-300",
                    "bg-gradient-to-r from-amber-500 to-yellow-500 text-white",
                    "hover:from-amber-600 hover:to-yellow-600 hover:shadow-lg"
                  )}
                  type="button"
                >
                  Get Coins
                </button>
              </div>
            </div>
          </motion.div>
          
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderStepContent()}
              
              {/* Navigation Buttons */}
              <div className="flex justify-between mt-12 pt-8 border-t">
                {step > 1 ? (
                  <button
                    onClick={() => setStep(step - 1)}
                    className={cn(
                      "px-6 py-3 rounded-xl font-medium transition-all duration-300",
                      theme === 'dark' 
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:scale-105' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105'
                    )}
                    type="button"
                    disabled={loading}
                  >
                    ← Back
                  </button>
                ) : (
                  <button
                    onClick={handleDiscard}
                    className={cn(
                      "px-6 py-3 rounded-xl font-medium transition-all duration-300",
                      theme === 'dark' 
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:scale-105' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105'
                    )}
                    type="button"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                )}
                
                {step < 3 ? (
                  <button
                    onClick={() => setStep(step + 1)}
                    className={cn(
                      "px-6 py-3 rounded-xl font-medium transition-all duration-300",
                      colors.primary,
                      colors.text,
                      "hover:shadow-xl hover:scale-105"
                    )}
                    type="button"
                  >
                    Continue →
                  </button>
                ) : (
                  <div className="flex gap-4">
                    <button
                      onClick={handleSaveDraft}
                      className={cn(
                        "px-6 py-3 rounded-xl font-medium transition-all duration-300",
                        theme === 'dark' 
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:scale-105' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105'
                      )}
                      type="button"
                      disabled={loading}
                    >
                      Save as Draft
                    </button>
                    <button
                      onClick={handlePublish}
                      disabled={loading}
                      className={cn(
                        "px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all duration-300",
                        colors.primary,
                        colors.text,
                        "hover:shadow-xl hover:scale-105 disabled:opacity-50"
                      )}
                      type="button"
                    >
                      {loading ? (
                        <>
                          <LoadingSpinner size="sm" />
                          Publishing...
                        </>
                      ) : (
                        <>
                          <Rocket className="w-5 h-5" />
                          Publish Now 🚀
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </main>
        
        {/* Loading Overlay */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center"
            >
              <div className="text-center max-w-lg mx-4">
                <div className="relative inline-block mb-6">
                  <div className="w-24 h-24 rounded-full border-4 border-transparent border-t-blue-500 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse" />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-white mb-3">Publishing Your Post</h3>
                <p className="text-gray-300 mb-8">
                  We're optimizing and publishing your content...
                </p>
                <div className="space-y-4 text-left">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Processing content</span>
                    <span className="text-white font-bold">{content.length} characters</span>
                  </div>
                  {mediaFiles.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Uploading media</span>
                      <span className="text-white font-bold">{mediaFiles.length} files</span>
                    </div>
                  )}
                  {boost !== 'none' && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Applying boost</span>
                      <span className="text-amber-400 font-bold">
                        {BOOST_OPTIONS.find(b => b.id === boost)?.coins} coins
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </LazyMotion>
  );
};

export default CreatePostUltraPro;