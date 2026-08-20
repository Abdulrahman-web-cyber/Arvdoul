// src/screens/AIStudio/AIStudioScreen.jsx
// 🌟 ARVDOUL AI CREATIVE CO-PILOT STUDIO
// Comprehensive AI toolkit: Viral Hooks, Caption Crafter, Reel Scriptwriter, Prompt Studio, Viral Analyzer & Localization

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Flame, 
  Copy, 
  Check, 
  Video, 
  Image as ImageIcon, 
  TrendingUp, 
  Globe, 
  ArrowRight, 
  Sliders, 
  Zap, 
  RefreshCw, 
  MessageSquare,
  Play,
  Lightbulb,
  Share2,
  Crown,
  ChevronLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import aiStudioService from '../../services/aiStudioService';
import LoadingSpinner from '../../components/Shared/LoadingSpinner';

const TABS = [
  { id: 'captions', label: 'Viral Captions & Hooks', icon: Flame, color: 'from-orange-500 to-red-500' },
  { id: 'scripts', label: 'Reel Scriptwriter', icon: Video, color: 'from-purple-500 to-pink-500' },
  { id: 'prompts', label: 'AI Image Prompt Studio', icon: ImageIcon, color: 'from-blue-500 to-indigo-500' },
  { id: 'sentiment', label: 'Viral Score & Retention', icon: TrendingUp, color: 'from-green-500 to-emerald-500' },
  { id: 'localize', label: 'Global Localization', icon: Globe, color: 'from-amber-500 to-yellow-500' }
];

export default function AIStudioScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState('captions');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Captions State
  const [captionTopic, setCaptionTopic] = useState('How I scaled my creator workflow with AI');
  const [captionTone, setCaptionTone] = useState('hype');
  const [generatedCaption, setGeneratedCaption] = useState(null);

  // Script State
  const [scriptTopic, setScriptTopic] = useState('3 AI tools that will save you 20 hours a week');
  const [scriptDuration, setScriptDuration] = useState(30);
  const [scriptStyle, setScriptStyle] = useState('tech');
  const [generatedScript, setGeneratedScript] = useState(null);

  // Prompt Studio State
  const [promptSubject, setPromptSubject] = useState('Cyberpunk neon rooftop creator studio overlooking futuristic Tokyo skyline');
  const [promptStyle, setPromptStyle] = useState('Cinematic 8K');
  const [promptRatio, setPromptRatio] = useState('9:16');
  const [generatedPrompt, setGeneratedPrompt] = useState(null);

  // Viral Sentiment State
  const [sentimentText, setSentimentText] = useState('Stop scrolling! Here is the exact roadmap to earning your first $1,000 on Arvdoul with 0 platform fees. Save this post right now.');
  const [viralAnalysis, setViralAnalysis] = useState(null);

  // Localization State
  const [localizeText, setLocalizeText] = useState('Welcome to Arvdoul, the ultimate creative economy platform for modern creators.');
  const [translations, setTranslations] = useState(null);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard! 📋');
    setTimeout(() => setCopied(false), 2000);
  };

  // 1. Generate Caption
  const handleGenerateCaption = async () => {
    setLoading(true);
    try {
      const res = await aiStudioService.generateCaptions({
        topic: captionTopic,
        tone: captionTone
      });
      setGeneratedCaption(res);
      toast.success('Generated viral caption! 🚀');
    } catch {
      toast.error('Failed to generate caption');
    } finally {
      setLoading(false);
    }
  };

  // 2. Generate Script
  const handleGenerateScript = async () => {
    setLoading(true);
    try {
      const res = await aiStudioService.generateScript({
        topic: scriptTopic,
        duration: scriptDuration,
        style: scriptStyle
      });
      setGeneratedScript(res);
      toast.success('Generated video storyboard! 🎬');
    } catch {
      toast.error('Failed to generate script');
    } finally {
      setLoading(false);
    }
  };

  // 3. Generate Image Prompt
  const handleGeneratePrompt = async () => {
    setLoading(true);
    try {
      const res = await aiStudioService.craftImagePrompt({
        subject: promptSubject,
        style: promptStyle,
        ratio: promptRatio
      });
      setGeneratedPrompt(res);
      toast.success('AI Prompt crafted! 🎨');
    } catch {
      toast.error('Failed to craft prompt');
    } finally {
      setLoading(false);
    }
  };

  // 4. Analyze Viral Score
  const handleAnalyzeViral = async () => {
    setLoading(true);
    try {
      const res = await aiStudioService.analyzeViralPotential({ text: sentimentText });
      setViralAnalysis(res);
      toast.success('Audience simulation complete! 📊');
    } catch {
      toast.error('Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  // 5. Localize
  const handleLocalize = async () => {
    setLoading(true);
    try {
      const res = await aiStudioService.localizeContent({ text: localizeText });
      setTranslations(res);
      if (res.some((item) => item.untranslated)) {
        toast.warning('AI translation unavailable - showing original text');
      } else {
        toast.success('Content localized into 5 languages! 🌍');
      }
    } catch {
      toast.error('Localization failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-28 pt-2 max-w-5xl mx-auto px-3 sm:px-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-purple-900/90 via-indigo-900/80 to-pink-900/80 border border-purple-500/30 shadow-2xl backdrop-blur-xl mb-8">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full w-fit mb-3 border border-white/20">
              <Sparkles className="w-4 h-4 text-yellow-300 animate-spin" style={{ animationDuration: '6s' }} />
              <span className="text-xs font-semibold text-purple-200 uppercase tracking-wider">Arvdoul Intelligence Suite</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
              AI Creator Co-Pilot <Crown className="w-6 h-6 text-yellow-400" />
            </h1>
            <p className="text-gray-300 text-sm sm:text-base mt-2 max-w-xl">
              Supercharge your creative workflow with viral hooks, multi-scene video scripts, prompt engineering, audience retention simulation, and global localization.
            </p>
          </div>

          <button
            onClick={() => navigate('/create-post')}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-2xl font-bold shadow-lg shadow-purple-500/30 hover:scale-105 transition-all text-sm whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4" /> Open Create Post
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl font-semibold text-sm whitespace-nowrap transition-all duration-200 ${
                isActive
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25 scale-[1.02]'
                  : isDark
                  ? 'bg-gray-800/80 text-gray-300 hover:bg-gray-700 border border-gray-700/60'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 shadow-sm'
              }`}
            >
              <div className={`p-1.5 rounded-lg bg-gradient-to-br ${tab.color} text-white`}>
                <Icon className="w-4 h-4" />
              </div>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {/* ==================== TAB 1: CAPTIONS & VIRAL HOOKS ==================== */}
        {activeTab === 'captions' && (
          <motion.div
            key="captions"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* Input Config */}
            <div className={`lg:col-span-5 p-6 rounded-3xl border ${isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-white border-gray-200'} shadow-xl space-y-5`}>
              <div className="flex items-center gap-2 font-bold text-lg text-purple-400">
                <Flame className="w-5 h-5 text-orange-500" />
                Prompt & Tone Selector
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">What is your post about?</label>
                <textarea
                  value={captionTopic}
                  onChange={(e) => setCaptionTopic(e.target.value)}
                  placeholder="e.g. 5 mindset shifts for high-earning creators"
                  rows={4}
                  className={`w-full p-4 rounded-2xl text-sm border focus:ring-2 focus:ring-purple-500 outline-none resize-none transition-all ${
                    isDark ? 'bg-gray-800/90 border-gray-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Voice & Tone</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'hype', label: '🔥 Viral & Hype' },
                    { id: 'casual', label: '☕️ Casual & Relatable' },
                    { id: 'educational', label: '🧠 Deep Dive' },
                    { id: 'poetic', label: '✨ Aesthetic' },
                    { id: 'story', label: '📖 Storytelling' },
                    { id: 'humor', label: '😂 Meme & Sarcastic' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setCaptionTone(t.id)}
                      className={`p-2.5 rounded-xl text-xs font-medium border text-left transition-all ${
                        captionTone === t.id
                          ? 'border-purple-500 bg-purple-500/20 text-purple-300 font-bold'
                          : isDark ? 'border-gray-700 bg-gray-800/40 text-gray-400 hover:border-gray-600' : 'border-gray-200 bg-gray-50 text-gray-600'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerateCaption}
                disabled={loading}
                className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 text-white shadow-xl shadow-purple-500/30 flex items-center justify-center gap-2 hover:opacity-95 transition-all disabled:opacity-50"
              >
                {loading ? <LoadingSpinner size="sm" /> : <><Sparkles className="w-5 h-5" /> Generate Viral Caption</>}
              </button>
            </div>

            {/* Output View */}
            <div className={`lg:col-span-7 p-6 rounded-3xl border ${isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-white border-gray-200'} shadow-xl flex flex-col justify-between`}>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 font-bold text-lg">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    AI Output & Viral Hook
                  </div>
                  {generatedCaption && (
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-bold flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5" /> Viral Score: {generatedCaption.viralScore}/100
                      </span>
                    </div>
                  )}
                </div>

                {generatedCaption ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30">
                      <span className="text-xs font-bold text-purple-400 uppercase tracking-wider block mb-1">Generated Hook</span>
                      <p className="text-base font-extrabold text-white">{generatedCaption.hook}</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-gray-800/60 border border-gray-700/60">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Complete Post Caption</span>
                      <p className="text-sm text-gray-200 whitespace-pre-line leading-relaxed font-sans">{generatedCaption.body}</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-gray-500 border border-dashed border-gray-700/60 rounded-2xl">
                    <Sparkles className="w-12 h-12 text-purple-500/40 mb-3 animate-pulse" />
                    <p className="font-semibold text-sm">Enter a topic and tap Generate to craft a viral caption.</p>
                  </div>
                )}
              </div>

              {generatedCaption && (
                <div className="flex items-center gap-3 pt-6 border-t border-gray-800 mt-6">
                  <button
                    onClick={() => handleCopy(generatedCaption.body)}
                    className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy Caption'}
                  </button>
                  <button
                    onClick={() => navigate('/create-post')}
                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-600/30"
                  >
                    <ArrowRight className="w-4 h-4" /> Use in Create Post
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ==================== TAB 2: REEL SCRIPTWRITER ==================== */}
        {activeTab === 'scripts' && (
          <motion.div
            key="scripts"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className={`p-6 rounded-3xl border ${isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-white border-gray-200'} shadow-xl space-y-4`}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Video Concept / Script Goal</label>
                  <input
                    type="text"
                    value={scriptTopic}
                    onChange={(e) => setScriptTopic(e.target.value)}
                    className={`w-full p-3.5 rounded-xl text-sm border focus:ring-2 focus:ring-purple-500 outline-none ${
                      isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Duration Target</label>
                  <select
                    value={scriptDuration}
                    onChange={(e) => setScriptDuration(Number(e.target.value))}
                    className={`w-full p-3.5 rounded-xl text-sm border focus:ring-2 focus:ring-purple-500 outline-none ${
                      isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                    }`}
                  >
                    <option value={15}>15 Seconds (Fast Hype)</option>
                    <option value={30}>30 Seconds (Standard Reel)</option>
                    <option value={60}>60 Seconds (Deep Dive)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleGenerateScript}
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 hover:opacity-95"
              >
                {loading ? <LoadingSpinner size="sm" /> : <><Video className="w-5 h-5" /> Write Video Storyboard</>}
              </button>
            </div>

            {generatedScript && (
              <div className={`p-6 rounded-3xl border ${isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-white border-gray-200'} shadow-xl space-y-4`}>
                <div className="flex items-center justify-between pb-4 border-b border-gray-800">
                  <div>
                    <h3 className="text-lg font-bold text-white">{generatedScript.title}</h3>
                    <p className="text-xs text-purple-400">Pacing: {generatedScript.estimatedPacing} • Audio: {generatedScript.suggestedBgm}</p>
                  </div>
                  <button
                    onClick={() => navigate('/video-editor')}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
                  >
                    <Play className="w-3.5 h-3.5" /> Open in Video Editor Pro
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {generatedScript.scenes.map((scene, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-gray-800/50 border border-gray-700/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 bg-purple-500/20 text-purple-300 font-bold rounded-lg text-xs">Scene {scene.scene} ({scene.time})</span>
                        <span className="text-[11px] text-gray-400">🔊 {scene.audioCue}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-gray-400 block font-semibold">Visual Action:</span>
                        <p className="text-xs text-gray-200">{scene.visual}</p>
                      </div>
                      <div className="pt-2 border-t border-gray-700/50">
                        <span className="text-[11px] text-yellow-400 block font-semibold">Voiceover / Speech:</span>
                        <p className="text-xs font-medium text-white italic">"{scene.speech}"</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ==================== TAB 3: PROMPT STUDIO ==================== */}
        {activeTab === 'prompts' && (
          <motion.div
            key="prompts"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            <div className={`lg:col-span-6 p-6 rounded-3xl border ${isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-white border-gray-200'} shadow-xl space-y-4`}>
              <h3 className="font-bold text-lg text-blue-400 flex items-center gap-2">
                <ImageIcon className="w-5 h-5" /> Image Concept Creator
              </h3>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Subject & Scene</label>
                <textarea
                  value={promptSubject}
                  onChange={(e) => setPromptSubject(e.target.value)}
                  rows={3}
                  className={`w-full p-3.5 rounded-xl text-sm border focus:ring-2 focus:ring-blue-500 outline-none ${
                    isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Style</label>
                  <select
                    value={promptStyle}
                    onChange={(e) => setPromptStyle(e.target.value)}
                    className={`w-full p-3 rounded-xl text-xs border ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50'}`}
                  >
                    <option>Cinematic 8K</option>
                    <option>Cyberpunk Anime</option>
                    <option>Minimalist 3D Clay</option>
                    <option>Dark Luxury Editorial</option>
                    <option>Vintage 35mm Analog</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Aspect Ratio</label>
                  <select
                    value={promptRatio}
                    onChange={(e) => setPromptRatio(e.target.value)}
                    className={`w-full p-3 rounded-xl text-xs border ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50'}`}
                  >
                    <option value="9:16">9:16 (Reels & Stories)</option>
                    <option value="1:1">1:1 (Square Feed Post)</option>
                    <option value="16:9">16:9 (Landscape Video)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleGeneratePrompt}
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 hover:opacity-95"
              >
                {loading ? <LoadingSpinner size="sm" /> : <><Sparkles className="w-5 h-5" /> Craft Master Prompt</>}
              </button>
            </div>

            <div className={`lg:col-span-6 p-6 rounded-3xl border ${isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-white border-gray-200'} shadow-xl flex flex-col justify-between`}>
              <div>
                <h3 className="font-bold text-lg text-white mb-4">Crafted Prompt Result</h3>
                {generatedPrompt ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30">
                      <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block mb-1">Optimized Positive Prompt</span>
                      <p className="text-xs font-mono text-gray-200 break-words leading-relaxed">{generatedPrompt.prompt}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-gray-800/40 border border-gray-700 text-xs text-gray-400">
                      <span className="font-bold block text-red-400 mb-1">Negative Weights:</span>
                      {generatedPrompt.negativePrompt}
                    </div>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-center text-gray-500 border border-dashed border-gray-700 rounded-2xl">
                    <p className="text-xs">Crafted prompt parameters will appear here.</p>
                  </div>
                )}
              </div>

              {generatedPrompt && (
                <button
                  onClick={() => handleCopy(generatedPrompt.prompt)}
                  className="w-full py-3 mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" /> Copy Prompt for Generation
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* ==================== TAB 4: VIRAL SENTIMENT & RETENTION ==================== */}
        {activeTab === 'sentiment' && (
          <motion.div
            key="sentiment"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className={`p-6 rounded-3xl border ${isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-white border-gray-200'} shadow-xl space-y-4`}>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Paste caption or transcript for viral audit</label>
              <textarea
                value={sentimentText}
                onChange={(e) => setSentimentText(e.target.value)}
                rows={3}
                className={`w-full p-4 rounded-xl text-sm border focus:ring-2 focus:ring-green-500 outline-none ${
                  isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                }`}
              />
              <button
                onClick={handleAnalyzeViral}
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg shadow-green-500/20 flex items-center justify-center gap-2"
              >
                {loading ? <LoadingSpinner size="sm" /> : <><TrendingUp className="w-5 h-5" /> Simulate Viral Retention & Sentiment</>}
              </button>
            </div>

            {viralAnalysis && (
              <div className={`p-6 rounded-3xl border ${isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-white border-gray-200'} shadow-xl space-y-6`}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/30 text-center">
                    <span className="text-3xl font-extrabold text-green-400">{viralAnalysis.viralScore}%</span>
                    <span className="text-[11px] text-gray-400 block mt-1 uppercase font-bold">Viral Probability</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-center">
                    <span className="text-3xl font-extrabold text-blue-400">{viralAnalysis.sentiment.curiosity}%</span>
                    <span className="text-[11px] text-gray-400 block mt-1 uppercase font-bold">Curiosity Hook</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-center">
                    <span className="text-3xl font-extrabold text-purple-400">{viralAnalysis.sentiment.actionability}%</span>
                    <span className="text-[11px] text-gray-400 block mt-1 uppercase font-bold">Actionability</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center">
                    <span className="text-3xl font-extrabold text-amber-400">{viralAnalysis.sentiment.positive}%</span>
                    <span className="text-[11px] text-gray-400 block mt-1 uppercase font-bold">Positive Sentiment</span>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-white mb-2 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-400" /> AI Optimization Recommendations:
                  </h4>
                  <ul className="space-y-2">
                    {viralAnalysis.recommendations.map((rec, i) => (
                      <li key={i} className="text-xs text-gray-300 flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ==================== TAB 5: GLOBAL LOCALIZATION ==================== */}
        {activeTab === 'localize' && (
          <motion.div
            key="localize"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className={`p-6 rounded-3xl border ${isDark ? 'bg-gray-900/70 border-gray-800' : 'bg-white border-gray-200'} shadow-xl space-y-4`}>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Content to Localize Globally</label>
              <textarea
                value={localizeText}
                onChange={(e) => setLocalizeText(e.target.value)}
                rows={3}
                className={`w-full p-4 rounded-xl text-sm border focus:ring-2 focus:ring-amber-500 outline-none ${
                  isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-300 text-gray-900'
                }`}
              />
              <button
                onClick={handleLocalize}
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                {loading ? <LoadingSpinner size="sm" /> : <><Globe className="w-5 h-5" /> Localize into 5 Languages</>}
              </button>
            </div>

            {translations && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {translations.map((item, idx) => (
                  <div key={idx} className={`p-4 rounded-2xl border ${isDark ? 'bg-gray-900/80 border-gray-800' : 'bg-white border-gray-200'} shadow-md space-y-2`}>
                    <p className="text-xs text-gray-200 font-sans leading-relaxed">
                      {item.untranslated ? item.original : item.translation}
                    </p>
                    {!item.untranslated && (
                      <button
                        onClick={() => handleCopy(item.translation)}
                        className="text-[11px] text-amber-400 font-semibold flex items-center gap-1 hover:underline pt-1"
                      >
                        <Copy className="w-3 h-3" /> Copy translation
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
