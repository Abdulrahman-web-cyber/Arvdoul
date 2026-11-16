// src/screens/AIStudio/AIStudioScreen.jsx
//
// Comprehensive AI toolkit: Viral Hooks, Caption Crafter, Reel Scriptwriter, Prompt Studio,
// Viral Analyzer, Global Localization, and Voiceover TTS & Transcription.

import { useState, useRef } from 'react';
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
  Play,
  Lightbulb,
  Mic,
  Volume2,
  Upload,
  Download,
  Sliders,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../../context/ThemeContext';
import aiStudioService from '../../services/aiStudioService';
import LoadingSpinner from '../../components/Shared/LoadingSpinner';
import { cn } from '../../lib/utils';

const TABS = [
  { id: 'captions', label: 'Captions & Hooks', icon: Flame },
  { id: 'scripts', label: 'Reel Scriptwriter', icon: Video },
  { id: 'voiceover', label: 'Voiceover & Transcribe', icon: Mic },
  { id: 'prompts', label: 'Image Prompts', icon: ImageIcon },
  { id: 'sentiment', label: 'Viral Retention', icon: TrendingUp },
  { id: 'localize', label: 'Localization', icon: Globe },
];

const TTS_VOICES = [
  { id: 'Kore', label: 'Kore — Crisp Narrator' },
  { id: 'Puck', label: 'Puck — Energetic Creator' },
  { id: 'Charon', label: 'Charon — Deep Documentary' },
  { id: 'Aoede', label: 'Aoede — Warm Conversational' },
  { id: 'Fenrir', label: 'Fenrir — Trailer Bold' },
];

function base64ToBlob(base64, mimeType) {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    arr[i] = bytes.charCodeAt(i);
  }
  return new Blob([arr], { type: mimeType });
}

export default function AIStudioScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
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

  // Voiceover & Transcription State
  const [voiceText, setVoiceText] = useState('Welcome to Arvdoul — turn your raw ideas into studio-grade stories in minutes.');
  const [voiceName, setVoiceName] = useState('Kore');
  const [voiceStyle, setVoiceStyle] = useState('confident, clear, engaging studio narration');
  const [generatedVoiceover, setGeneratedVoiceover] = useState(null);
  const [transcriptResult, setTranscriptResult] = useState(null);
  const transcribeInputRef = useRef(null);

  // Prompt Studio State
  const [promptSubject, setPromptSubject] = useState('Architectural creator studio overlooking Tokyo skyline at dusk');
  const [promptStyle, setPromptStyle] = useState('Cinematic 8K');
  const [promptRatio, setPromptRatio] = useState('9:16');
  const [generatedPrompt, setGeneratedPrompt] = useState(null);

  // Viral Sentiment State
  const [sentimentText, setSentimentText] = useState('Here is the exact roadmap to building your creator business on Arvdoul without middlemen. Save this post for reference.');
  const [viralAnalysis, setViralAnalysis] = useState(null);

  // Localization State
  const [localizeText, setLocalizeText] = useState('Welcome to Arvdoul, the creative economy platform built for modern creators.');
  const [translations, setTranslations] = useState(null);
  const [aiError, setAiError] = useState(null);

  const AI_UNAVAILABLE_MSG =
    'AI Studio is not configured yet. The AI gateway (VITE_AI_GATEWAY_URL → functions/ai.js) must be set up before captions, scripts, prompts or analyses can be generated. Nothing was fabricated to hide this.';

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  // 1. Generate Caption
  const handleGenerateCaption = async () => {
    setLoading(true);
    setAiError(null);
    try {
      const res = await aiStudioService.generateCaptions({
        topic: captionTopic,
        tone: captionTone,
      });
      if (!res) {
        setAiError(AI_UNAVAILABLE_MSG);
        setGeneratedCaption(null);
        toast.error('AI gateway unavailable — no caption was generated');
        return;
      }
      setGeneratedCaption(res);
      toast.success('Caption generated');
    } catch (err) {
      setAiError(err?.message || 'Failed to generate caption');
      setGeneratedCaption(null);
      toast.error('Failed to generate caption');
    } finally {
      setLoading(false);
    }
  };

  // 2. Generate Script
  const handleGenerateScript = async () => {
    setLoading(true);
    setAiError(null);
    try {
      const res = await aiStudioService.generateScript({
        topic: scriptTopic,
        duration: scriptDuration,
        style: scriptStyle,
      });
      if (!res) {
        setAiError(AI_UNAVAILABLE_MSG);
        setGeneratedScript(null);
        toast.error('AI gateway unavailable — no script was generated');
        return;
      }
      setGeneratedScript(res);
      toast.success('Storyboard script generated');
    } catch (err) {
      setAiError(err?.message || 'Failed to generate script');
      setGeneratedScript(null);
      toast.error('Failed to generate script');
    } finally {
      setLoading(false);
    }
  };

  // 3. Voiceover TTS
  const handleGenerateVoiceover = async () => {
    setLoading(true);
    setAiError(null);
    try {
      const res = await aiStudioService.generateVoiceover({
        text: voiceText,
        voiceName,
        style: voiceStyle,
      });
      if (!res) {
        setAiError(AI_UNAVAILABLE_MSG);
        setGeneratedVoiceover(null);
        toast.error('AI gateway unavailable — no voiceover was synthesized');
        return;
      }
      setGeneratedVoiceover(res);
      toast.success('Studio voiceover ready');
    } catch (err) {
      setAiError(err?.message || 'Voiceover synthesis failed');
      setGeneratedVoiceover(null);
      toast.error('Voiceover synthesis failed');
    } finally {
      setLoading(false);
    }
  };

  // 3b. Transcribe Uploaded Audio
  const handleTranscribeFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setAiError(null);
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onload = () => {
          const raw = typeof reader.result === 'string' ? reader.result : '';
          resolve(raw.includes(',') ? raw.split(',')[1] : raw);
        };
        reader.onerror = () => reject(new Error('Could not read audio file'));
        reader.readAsDataURL(file);
      });
      const res = await aiStudioService.transcribeAudio({
        audioBase64: base64,
        mimeType: file.type || 'audio/webm',
      });
      if (!res) {
        setAiError(AI_UNAVAILABLE_MSG);
        setTranscriptResult(null);
        toast.error('AI gateway unavailable — could not transcribe audio');
        return;
      }
      setTranscriptResult({ ...res, fileName: file.name });
      toast.success('Audio transcribed');
    } catch (err) {
      setAiError(err?.message || 'Transcription failed');
      toast.error('Transcription failed');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  // 4. Generate Image Prompt
  const handleGeneratePrompt = async () => {
    setLoading(true);
    setAiError(null);
    try {
      const res = await aiStudioService.craftImagePrompt({
        subject: promptSubject,
        style: promptStyle,
        ratio: promptRatio,
      });
      if (!res) {
        setAiError(AI_UNAVAILABLE_MSG);
        setGeneratedPrompt(null);
        toast.error('AI gateway unavailable — no prompt was crafted');
        return;
      }
      setGeneratedPrompt(res);
      toast.success('Image prompt crafted');
    } catch (err) {
      setAiError(err?.message || 'Failed to craft prompt');
      setGeneratedPrompt(null);
      toast.error('Failed to craft prompt');
    } finally {
      setLoading(false);
    }
  };

  // 5. Analyze Viral Score
  const handleAnalyzeViral = async () => {
    setLoading(true);
    setAiError(null);
    try {
      const res = await aiStudioService.analyzeViralPotential({ text: sentimentText });
      if (!res) {
        setAiError(AI_UNAVAILABLE_MSG);
        setViralAnalysis(null);
        toast.error('AI gateway unavailable — no analysis was produced');
        return;
      }
      setViralAnalysis(res);
      toast.success('Retention audit complete');
    } catch (err) {
      setAiError(err?.message || 'Analysis failed');
      setViralAnalysis(null);
      toast.error('Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  // 6. Localize
  const handleLocalize = async () => {
    setLoading(true);
    setAiError(null);
    try {
      const res = await aiStudioService.localizeContent({ text: localizeText });
      setTranslations(res);
      if (res.some((item) => item.untranslated)) {
        toast.warning('AI translation unavailable — showing original text');
      } else {
        toast.success('Content localized into 5 languages');
      }
    } catch {
      toast.error('Localization failed');
    } finally {
      setLoading(false);
    }
  };

  const cardSurface = isDark
    ? 'bg-[#080F2E] border-white/[0.08] text-white'
    : 'bg-white border-slate-200 text-slate-900';

  const inputSurface = isDark
    ? 'bg-[#03071B] border-white/10 text-white placeholder:text-slate-500'
    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400';

  return (
    <div className="min-h-screen pb-28 pt-3 max-w-6xl mx-auto px-3 sm:px-6">
      {/* Studio Header */}
      <div
        className={cn(
          'rounded-2xl p-6 sm:p-8 border mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5',
          cardSurface
        )}
      >
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Arvdoul Creator Studio</span>
            <span aria-hidden="true">·</span>
            <span>Copy, Scripts, Voiceover &amp; Localization</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-display">
            AI Creator Co-Pilot
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Draft hooks, direct multi-scene video scripts, synthesize studio voiceovers, transcribe audio, and localize posts directly into your Arvdoul workflow.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/create-post')}
          className="px-5 py-2.5 bg-arvdoul-gradient text-white rounded-xl font-semibold text-sm flex items-center gap-2 hover:opacity-95 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          Open Create Post
        </button>
      </div>

      {/* Segmented Navigation Tabs */}
      <div
        className={cn(
          'flex items-center gap-1.5 overflow-x-auto p-1.5 rounded-xl border mb-6 scrollbar-none',
          isDark ? 'bg-[#080F2E] border-white/[0.08]' : 'bg-slate-100 border-slate-200'
        )}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap shrink-0 transition-colors cursor-pointer',
                isActive
                  ? isDark
                    ? 'bg-arvdoul-gradient text-white'
                    : 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Honest AI-unavailable banner */}
      {aiError && (
        <div className="mb-6 p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 flex items-start gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-600 dark:text-amber-300 mb-1">AI Studio unavailable</p>
            <p className="text-xs text-amber-800/80 dark:text-amber-200/80 leading-relaxed">{aiError}</p>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {/* TAB 1: CAPTIONS & VIRAL HOOKS */}
        {activeTab === 'captions' && (
          <motion.div
            key="captions"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            <div className={cn('lg:col-span-5 p-6 rounded-2xl border space-y-5', cardSurface)}>
              <div className="flex items-center gap-2 font-semibold text-base">
                <Flame className="w-4 h-4 text-arvdoul-purple" />
                Prompt &amp; Tone
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                  What is your post about?
                </label>
                <textarea
                  aria-label="What is your post about?"
                  value={captionTopic}
                  onChange={(e) => setCaptionTopic(e.target.value)}
                  placeholder="e.g. 5 mindset shifts for high-earning creators"
                  rows={4}
                  className={cn(
                    'w-full p-3.5 rounded-xl text-sm border focus:ring-2 focus:ring-arvdoul-purple outline-none resize-none transition-colors',
                    inputSurface
                  )}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                  Voice &amp; Tone
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'hype', label: 'Viral & Hype' },
                    { id: 'casual', label: 'Casual & Direct' },
                    { id: 'educational', label: 'Deep Dive' },
                    { id: 'poetic', label: 'Editorial' },
                    { id: 'story', label: 'Storytelling' },
                    { id: 'humor', label: 'Witty & Sarcastic' },
                  ].map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setCaptionTone(t.id)}
                      className={cn(
                        'p-2.5 rounded-xl text-xs font-medium border text-left transition-colors cursor-pointer',
                        captionTone === t.id
                          ? 'border-arvdoul-purple bg-arvdoul-purple/10 text-arvdoul-purple dark:text-white font-semibold'
                          : isDark
                          ? 'border-white/10 bg-[#03071B] text-slate-400 hover:border-white/20'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateCaption}
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold bg-arvdoul-gradient text-white flex items-center justify-center gap-2 hover:opacity-95 transition-opacity disabled:opacity-50 cursor-pointer"
              >
                {loading ? <LoadingSpinner size="sm" /> : <><Sparkles className="w-4 h-4" /> Generate Caption</>}
              </button>
            </div>

            <div className={cn('lg:col-span-7 p-6 rounded-2xl border flex flex-col justify-between', cardSurface)}>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 font-semibold text-base">
                    <Sparkles className="w-4 h-4 text-arvdoul-purple" />
                    Output &amp; Opening Hook
                  </div>
                </div>

                {generatedCaption ? (
                  <div className="space-y-4">
                    {generatedCaption.hook && (
                      <div className="p-4 rounded-xl bg-arvdoul-purple/10 border border-arvdoul-purple/30">
                        <span className="text-xs font-medium text-arvdoul-purple block mb-1">Opening Hook</span>
                        <p className="text-base font-bold">{generatedCaption.hook}</p>
                      </div>
                    )}

                    <div className={cn('p-4 rounded-xl border', inputSurface)}>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-2">
                        Complete Post Caption
                      </span>
                      <p className="text-sm whitespace-pre-line leading-relaxed">{generatedCaption.body}</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-500 border border-dashed border-slate-300 dark:border-white/10 rounded-xl">
                    <Sparkles className="w-8 h-8 text-arvdoul-purple/50 mb-2" />
                    <p className="font-medium text-sm">Enter a topic and select Generate to craft a post caption.</p>
                  </div>
                )}
              </div>

              {generatedCaption && (
                <div className="flex items-center gap-3 pt-5 border-t border-slate-200 dark:border-white/10 mt-6">
                  <button
                    type="button"
                    onClick={() => handleCopy(generatedCaption.body)}
                    className={cn(
                      'flex-1 py-2.5 rounded-xl text-sm font-semibold border flex items-center justify-center gap-2 transition-colors cursor-pointer',
                      isDark ? 'border-white/15 bg-white/5 hover:bg-white/10 text-white' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900'
                    )}
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied' : 'Copy Caption'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      navigate('/create-post', {
                        state: {
                          prefillContent: generatedCaption.body,
                          prefillType: 'text',
                        },
                      })
                    }
                    className="flex-1 py-2.5 bg-arvdoul-gradient text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-95 transition-opacity cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4" /> Use in Create Post
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* TAB 2: REEL SCRIPTWRITER */}
        {activeTab === 'scripts' && (
          <motion.div
            key="scripts"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16 }}
            className="space-y-6"
          >
            <div className={cn('p-6 rounded-2xl border space-y-4', cardSurface)}>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                    Video Concept / Script Goal
                  </label>
                  <input
                    aria-label="Video Concept / Script Goal"
                    type="text"
                    value={scriptTopic}
                    onChange={(e) => setScriptTopic(e.target.value)}
                    className={cn(
                      'w-full p-3 rounded-xl text-sm border focus:ring-2 focus:ring-arvdoul-purple outline-none',
                      inputSurface
                    )}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                    Script Style
                  </label>
                  <select
                    aria-label="Script Style"
                    value={scriptStyle}
                    onChange={(e) => setScriptStyle(e.target.value)}
                    className={cn(
                      'w-full p-3 rounded-xl text-sm border focus:ring-2 focus:ring-arvdoul-purple outline-none',
                      inputSurface
                    )}
                  >
                    <option value="tech">Tech &amp; Product</option>
                    <option value="funny">Comedy &amp; Skits</option>
                    <option value="educational">Educational</option>
                    <option value="storytelling">Storytelling</option>
                    <option value="motivational">Motivational</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                    Duration Target
                  </label>
                  <select
                    aria-label="Duration Target"
                    value={scriptDuration}
                    onChange={(e) => setScriptDuration(Number(e.target.value))}
                    className={cn(
                      'w-full p-3 rounded-xl text-sm border focus:ring-2 focus:ring-arvdoul-purple outline-none tabular-nums',
                      inputSurface
                    )}
                  >
                    <option value={15}>15 Seconds</option>
                    <option value={30}>30 Seconds</option>
                    <option value={60}>60 Seconds</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateScript}
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold bg-arvdoul-gradient text-white flex items-center justify-center gap-2 hover:opacity-95 cursor-pointer"
              >
                {loading ? <LoadingSpinner size="sm" /> : <><Video className="w-4 h-4" /> Write Video Storyboard</>}
              </button>
            </div>

            {generatedScript && (
              <div className={cn('p-6 rounded-2xl border space-y-4', cardSurface)}>
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-white/10">
                  <div>
                    <h3 className="text-lg font-bold">{generatedScript.title}</h3>
                    {generatedScript.estimatedPacing && generatedScript.suggestedBgm && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Pacing: {generatedScript.estimatedPacing} · Audio: {generatedScript.suggestedBgm}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(generatedScript.rawScriptText)}
                      className={cn(
                        'px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer',
                        isDark ? 'border-white/15 bg-white/5 text-white' : 'border-slate-200 bg-slate-50 text-slate-900'
                      )}
                    >
                      Copy Script
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        navigate('/video-editor', {
                          state: { script: generatedScript },
                        })
                      }
                      className="px-4 py-2 bg-arvdoul-gradient text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" /> Open in Video Editor Pro
                    </button>
                  </div>
                </div>

                <div className={cn('p-4 rounded-xl border', inputSurface)}>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-2">
                    Multi-scene script
                  </span>
                  <p className="text-sm whitespace-pre-line leading-relaxed">{generatedScript.rawScriptText}</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 3: VOICEOVER TTS & AUDIO TRANSCRIPTION */}
        {activeTab === 'voiceover' && (
          <motion.div
            key="voiceover"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* Text-to-Speech Synthesis */}
            <div className={cn('lg:col-span-7 p-6 rounded-2xl border space-y-4', cardSurface)}>
              <div className="flex items-center gap-2 font-semibold text-base">
                <Volume2 className="w-4 h-4 text-arvdoul-purple" />
                Studio Voiceover Synthesis
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                  Voiceover Script
                </label>
                <textarea
                  aria-label="Voiceover Script"
                  value={voiceText}
                  onChange={(e) => setVoiceText(e.target.value)}
                  rows={4}
                  className={cn(
                    'w-full p-3.5 rounded-xl text-sm border focus:ring-2 focus:ring-arvdoul-purple outline-none resize-none',
                    inputSurface
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                    Voice Talent
                  </label>
                  <select
                    aria-label="Voice Talent"
                    value={voiceName}
                    onChange={(e) => setVoiceName(e.target.value)}
                    className={cn('w-full p-3 rounded-xl text-sm border outline-none', inputSurface)}
                  >
                    {TTS_VOICES.map((v) => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                    Delivery Style
                  </label>
                  <input
                    aria-label="Delivery Style"
                    type="text"
                    value={voiceStyle}
                    onChange={(e) => setVoiceStyle(e.target.value)}
                    className={cn('w-full p-3 rounded-xl text-sm border outline-none', inputSurface)}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateVoiceover}
                disabled={loading || !voiceText.trim()}
                className="w-full py-3 rounded-xl font-semibold bg-arvdoul-gradient text-white flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50 cursor-pointer"
              >
                {loading ? <LoadingSpinner size="sm" /> : <><Mic className="w-4 h-4" /> Synthesize Voiceover</>}
              </button>

              {generatedVoiceover && (
                <div className={cn('p-4 rounded-xl border space-y-3', inputSurface)}>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Voice: {voiceName}</span>
                    {generatedVoiceover.model && <span>{generatedVoiceover.model}</span>}
                  </div>
                  <audio controls src={generatedVoiceover.audioDataUrl} className="w-full" />
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <a
                      href={generatedVoiceover.audioDataUrl}
                      download={`arvdoul-voiceover-${Date.now()}.wav`}
                      className={cn(
                        'px-3.5 py-2 rounded-lg text-xs font-semibold border flex items-center gap-1.5',
                        isDark ? 'border-white/15 bg-white/5 text-white' : 'border-slate-200 bg-white text-slate-900'
                      )}
                    >
                      <Download className="w-3.5 h-3.5" /> Download WAV
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        navigate('/audio-editor', {
                          state: {
                            audioUrl: generatedVoiceover.audioDataUrl,
                            title: `Voiceover (${voiceName})`,
                          },
                        })
                      }
                      className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-arvdoul-purple text-white flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" /> Send to Audio Studio
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const blob = base64ToBlob(generatedVoiceover.audioBase64, generatedVoiceover.mimeType);
                        const audioFile = new File([blob], `voiceover-${Date.now()}.wav`, { type: generatedVoiceover.mimeType });
                        navigate('/create-post', {
                          state: {
                            audioFile,
                            prefillContent: voiceText,
                            prefillType: 'audio',
                          },
                        });
                      }}
                      className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-arvdoul-gradient text-white flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowRight className="w-3.5 h-3.5" /> Post Audio
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Audio Transcription */}
            <div className={cn('lg:col-span-5 p-6 rounded-2xl border space-y-4 flex flex-col justify-between', cardSurface)}>
              <div className="space-y-4">
                <div className="flex items-center gap-2 font-semibold text-base">
                  <Upload className="w-4 h-4 text-arvdoul-blue" />
                  Audio &amp; Voice Transcription
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Upload a voice memo, podcast snippet, or video audio track to generate clean transcripts and timed caption lines.
                </p>

                <input
                  ref={transcribeInputRef}
                  type="file"
                  accept="audio/*,video/*"
                  onChange={handleTranscribeFile}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => transcribeInputRef.current?.click()}
                  disabled={loading}
                  className={cn(
                    'w-full py-6 rounded-xl border border-dashed flex flex-col items-center justify-center gap-2 text-xs font-semibold transition-colors cursor-pointer',
                    isDark ? 'border-white/20 bg-[#03071B] hover:border-arvdoul-purple' : 'border-slate-300 bg-slate-50 hover:border-arvdoul-purple'
                  )}
                >
                  <Upload className="w-5 h-5 text-arvdoul-purple" />
                  <span>Select Audio File to Transcribe</span>
                </button>

                {transcriptResult && (
                  <div className={cn('p-4 rounded-xl border space-y-2', inputSurface)}>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="truncate">{transcriptResult.fileName}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(transcriptResult.text)}
                        className="text-arvdoul-purple font-semibold hover:underline cursor-pointer"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-sm whitespace-pre-line leading-relaxed">{transcriptResult.text}</p>
                  </div>
                )}
              </div>

              {transcriptResult?.text && (
                <button
                  type="button"
                  onClick={() =>
                    navigate('/create-post', {
                      state: {
                        prefillContent: transcriptResult.text,
                        prefillType: 'text',
                      },
                    })
                  }
                  className="w-full py-2.5 rounded-xl bg-arvdoul-gradient text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" /> Draft Post from Transcript
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* TAB 4: PROMPT STUDIO */}
        {activeTab === 'prompts' && (
          <motion.div
            key="prompts"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            <div className={cn('lg:col-span-6 p-6 rounded-2xl border space-y-4', cardSurface)}>
              <h3 className="font-semibold text-base flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-arvdoul-blue" /> Image Concept Creator
              </h3>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                  Subject &amp; Scene
                </label>
                <textarea
                  aria-label="Subject &amp; Scene"
                  value={promptSubject}
                  onChange={(e) => setPromptSubject(e.target.value)}
                  rows={3}
                  className={cn(
                    'w-full p-3.5 rounded-xl text-sm border focus:ring-2 focus:ring-arvdoul-purple outline-none',
                    inputSurface
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                    Style
                  </label>
                  <select
                    aria-label="Style"
                    value={promptStyle}
                    onChange={(e) => setPromptStyle(e.target.value)}
                    className={cn('w-full p-3 rounded-xl text-xs border', inputSurface)}
                  >
                    <option>Cinematic 8K</option>
                    <option>Cyberpunk Anime</option>
                    <option>Minimalist 3D Clay</option>
                    <option>Dark Luxury Editorial</option>
                    <option>Vintage 35mm Analog</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                    Aspect Ratio
                  </label>
                  <select
                    aria-label="Aspect Ratio"
                    value={promptRatio}
                    onChange={(e) => setPromptRatio(e.target.value)}
                    className={cn('w-full p-3 rounded-xl text-xs border tabular-nums', inputSurface)}
                  >
                    <option value="9:16">9:16 (Reels &amp; Stories)</option>
                    <option value="1:1">1:1 (Square Post)</option>
                    <option value="16:9">16:9 (Landscape Video)</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGeneratePrompt}
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold bg-arvdoul-gradient text-white flex items-center justify-center gap-2 hover:opacity-95 cursor-pointer"
              >
                {loading ? <LoadingSpinner size="sm" /> : <><Sparkles className="w-4 h-4" /> Craft Master Prompt</>}
              </button>
            </div>

            <div className={cn('lg:col-span-6 p-6 rounded-2xl border flex flex-col justify-between', cardSurface)}>
              <div>
                <h3 className="font-semibold text-base mb-4">Crafted Prompt Result</h3>
                {generatedPrompt ? (
                  <div className={cn('p-4 rounded-xl border', inputSurface)}>
                    <span className="text-xs font-medium text-arvdoul-blue block mb-1">Optimized Positive Prompt</span>
                    <p className="text-xs font-mono break-words leading-relaxed">{generatedPrompt.prompt}</p>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-center text-slate-500 border border-dashed border-slate-300 dark:border-white/10 rounded-xl">
                    <p className="text-xs">Crafted prompt parameters will appear here.</p>
                  </div>
                )}
              </div>

              {generatedPrompt && (
                <button
                  type="button"
                  onClick={() => handleCopy(generatedPrompt.prompt)}
                  className="w-full py-2.5 mt-4 bg-arvdoul-blue hover:opacity-95 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Copy className="w-4 h-4" /> Copy Prompt for Generation
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* TAB 5: VIRAL SENTIMENT & RETENTION */}
        {activeTab === 'sentiment' && (
          <motion.div
            key="sentiment"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16 }}
            className="space-y-6"
          >
            <div className={cn('p-6 rounded-2xl border space-y-4', cardSurface)}>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                Paste caption or transcript for retention audit
              </label>
              <textarea
                aria-label="Paste caption or transcript for viral audit"
                value={sentimentText}
                onChange={(e) => setSentimentText(e.target.value)}
                rows={3}
                className={cn('w-full p-4 rounded-xl text-sm border focus:ring-2 focus:ring-arvdoul-purple outline-none', inputSurface)}
              />
              <button
                type="button"
                onClick={handleAnalyzeViral}
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold bg-arvdoul-gradient text-white flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? <LoadingSpinner size="sm" /> : <><TrendingUp className="w-4 h-4" /> Analyze Retention &amp; Clarity</>}
              </button>
            </div>

            {viralAnalysis && (
              <div className={cn('p-6 rounded-2xl border space-y-3', cardSurface)}>
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  <h4 className="font-semibold text-sm">Retention &amp; Hook Breakdown</h4>
                </div>
                <p className="text-sm whitespace-pre-line leading-relaxed">
                  {viralAnalysis.rawAnalysis}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Quantitative reach metrics depend on live audience response and are never estimated locally.
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* TAB 6: GLOBAL LOCALIZATION */}
        {activeTab === 'localize' && (
          <motion.div
            key="localize"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16 }}
            className="space-y-6"
          >
            <div className={cn('p-6 rounded-2xl border space-y-4', cardSurface)}>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                Content to Localize Globally
              </label>
              <textarea
                aria-label="Content to Localize Globally"
                value={localizeText}
                onChange={(e) => setLocalizeText(e.target.value)}
                rows={3}
                className={cn('w-full p-4 rounded-xl text-sm border focus:ring-2 focus:ring-arvdoul-purple outline-none', inputSurface)}
              />
              <button
                type="button"
                onClick={handleLocalize}
                disabled={loading}
                className="w-full py-3 rounded-xl font-semibold bg-arvdoul-gradient text-white flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? <LoadingSpinner size="sm" /> : <><Globe className="w-4 h-4" /> Localize into 5 Languages</>}
              </button>
            </div>

            {translations && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {translations.map((item, idx) => (
                  <div key={item.code || idx} className={cn('p-4 rounded-xl border space-y-2', cardSurface)}>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold uppercase">{item.code}</span>
                      {item.untranslated && <span>Untranslated</span>}
                    </div>
                    <p className="text-sm leading-relaxed">
                      {item.untranslated ? item.original : item.translation}
                    </p>
                    {!item.untranslated && (
                      <button
                        type="button"
                        onClick={() => handleCopy(item.translation)}
                        className="text-xs text-arvdoul-purple font-semibold flex items-center gap-1 hover:underline pt-1 cursor-pointer"
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
