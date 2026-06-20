// src/screens/PostCard/TextCard.jsx – Arvdoul Final (All Issues Resolved)
// Solid random backgrounds, no gradients, no expand button, perfect responsive.
// Includes: summary, listen (TTS), translate, copy, reading time, sentiment, topic, markdown.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Volume2, Languages, BookOpen, Heart, Smile, Frown,
  Copy, Check, Mic, MicOff, Settings, Hash, Play
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { marked } from 'marked'; // optional – we'll handle safely

// ------------------------------------------------------------------
// 1. SOLID BACKGROUND COLOURS (random but stable per post)
// ------------------------------------------------------------------
const TEXT_BACKGROUNDS = [
  '#2563EB', '#7C3AED', '#DB2777', '#DC2626', '#059669', '#0891B2',
  '#EA580C', '#4338CA', '#0F172A', '#374151', '#166534', '#9A3412'
];

function getRandomSolidBackground(postId) {
  if (!postId) {
    const randomIndex = Math.floor(Math.random() * TEXT_BACKGROUNDS.length);
    return TEXT_BACKGROUNDS[randomIndex];
  }
  let hash = 0;
  for (let i = 0; i < postId.length; i++) {
    hash = ((hash << 5) - hash) + postId.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % TEXT_BACKGROUNDS.length;
  return TEXT_BACKGROUNDS[index];
}

// ------------------------------------------------------------------
// 2. SHARED LRU CACHE (single instance – prevents memory bloat)
// ------------------------------------------------------------------
class LRUCache {
  constructor(maxSize = 800) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }
  get(key) {
    const val = this.cache.get(key);
    if (val === undefined) return undefined;
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }
  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }
    this.cache.set(key, value);
  }
  has(key) { return this.cache.has(key); }
}

const sharedCache = new LRUCache(800);

// ------------------------------------------------------------------
// 3. GLOBAL SPEECH CONTROLLER (with proper event cleanup)
// ------------------------------------------------------------------
let globalSynth = null;
let globalUtterance = null;
if (typeof window !== 'undefined') {
  globalSynth = window.speechSynthesis;
}

function cancelGlobalSpeech() {
  if (globalSynth) globalSynth.cancel();
  globalUtterance = null;
}

function speakGlobal(text, onEnd, options = {}) {
  if (!globalSynth) return;
  cancelGlobalSpeech();
  const utterance = new SpeechSynthesisUtterance(text);
  if (options.rate) utterance.rate = options.rate;
  if (options.voice) utterance.voice = options.voice;
  utterance.onend = () => {
    globalUtterance = null;
    onEnd?.();
  };
  utterance.onerror = () => {
    globalUtterance = null;
    onEnd?.();
  };
  globalUtterance = utterance;
  globalSynth.speak(utterance);
}

// Global voice list (loaded once with event listener)
let globalVoices = [];
let voicesLoaded = false;
if (typeof window !== 'undefined' && globalSynth) {
  const loadVoices = () => {
    globalVoices = globalSynth.getVoices();
    voicesLoaded = true;
  };
  if (globalSynth.onvoiceschanged !== undefined) {
    globalSynth.onvoiceschanged = loadVoices;
  }
  loadVoices();
}

// ------------------------------------------------------------------
// 4. SINGLE ANALYSIS PIPELINE (performance + avoids duplicate work)
// ------------------------------------------------------------------
function sentenceTokenizer(text) {
  return text.match(/[^.!?]+[.!?]+/g) || [text];
}
function extractKeywords(text) {
  const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const freq = {};
  words.forEach(w => freq[w] = (freq[w] || 0) + 1);
  return Object.entries(freq).sort((a,b) => b[1]-a[1]).slice(0,10).map(e => e[0]);
}
function scoreSentence(sentence, keywords) {
  let score = 0;
  const lower = sentence.toLowerCase();
  keywords.forEach(kw => { if (lower.includes(kw)) score += 2; });
  if (/\d/.test(sentence)) score += 1;
  if (sentence.includes('"') || sentence.includes("'")) score += 0.5;
  if (sentence.includes('important') || sentence.includes('key') || sentence.includes('conclusion')) score += 1.5;
  return score;
}
function generateSummaryRaw(text) {
  if (!text || text.length < 100) return text;
  const sentences = sentenceTokenizer(text);
  if (sentences.length <= 3) return text;
  const keywords = extractKeywords(text);
  const scored = sentences.map(s => ({ sentence: s.trim(), score: scoreSentence(s, keywords) }));
  scored.sort((a,b) => b.score - a.score);
  const top = scored.slice(0, 3).map(s => s.sentence);
  top.sort((a,b) => sentences.indexOf(a) - sentences.indexOf(b));
  let summary = top.join(' ');
  if (summary.length > 350) summary = summary.slice(0,350) + '…';
  return summary || text.slice(0,200);
}

const SENTIMENT_WORDS = {
  good:2, great:3, amazing:4, excellent:4, fantastic:4, wonderful:3,
  happy:2, love:3, awesome:3, perfect:3, terrible:-3, awful:-3,
  bad:-2, hate:-3, worst:-4, sad:-2, disappointing:-2, boring:-1,
  horrible:-3, poor:-2
};
function computeSentimentRaw(text) {
  const words = text.toLowerCase().split(/\s+/);
  let score = 0;
  for (const w of words) if (SENTIMENT_WORDS[w]) score += SENTIMENT_WORDS[w];
  if (score >= 2) return { label: 'Positive', color: '#22c55e', icon: Smile, emoji: '😊' };
  if (score <= -2) return { label: 'Negative', color: '#ef4444', icon: Frown, emoji: '😞' };
  return { label: 'Neutral', color: '#a855f7', icon: Heart, emoji: '😐' };
}

const TOPIC_KEYWORDS = {
  Technology: ['code', 'tech', 'ai', 'software', 'app', 'digital', 'programming'],
  Business: ['startup', 'business', 'market', 'invest', 'fund', 'ceo', 'company'],
  Education: ['learn', 'study', 'course', 'lesson', 'school', 'university', 'tutorial'],
  Health: ['health', 'fitness', 'wellness', 'mental', 'exercise', 'diet'],
  Entertainment: ['movie', 'music', 'game', 'stream', 'celebrity', 'film'],
  News: ['breaking', 'news', 'update', 'report', 'election', 'crisis']
};
function detectTopicRaw(text) {
  const lower = text.toLowerCase();
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return topic;
  }
  return 'General';
}

function getReadingTimeRaw(text) {
  const words = text?.split(/\s+/).length || 0;
  return Math.max(1, Math.ceil(words / 200));
}

function getFullAnalysis(content) {
  if (sharedCache.has(content)) return sharedCache.get(content);
  const analysis = {
    summary: generateSummaryRaw(content),
    sentiment: computeSentimentRaw(content),
    topic: detectTopicRaw(content),
    readingTime: getReadingTimeRaw(content),
  };
  sharedCache.set(content, analysis);
  return analysis;
}

// ------------------------------------------------------------------
// 5. MARKDOWN RENDERER (safe, with size limit, sync-safe)
// ------------------------------------------------------------------
function simpleMarkdownToHtml(md) {
  return md
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/@(\w+)/g, '<span class="arvdoul-mention">@$1</span>')
    .replace(/#(\w+)/g, '<span class="arvdoul-hashtag">#$1</span>');
}

// Safely parse markdown – synchronous only
function parseMarkdownSafe(content) {
  if (!content) return '';
  // Limit content size to prevent DOM explosion
  const safeContent = content.slice(0, 10000);
  let rawHtml;
  if (typeof marked?.parse === 'function') {
    // marked.parse can return a promise or string; we force synchronous by checking
    const result = marked.parse(safeContent);
    rawHtml = typeof result === 'string' ? result : safeContent;
  } else {
    rawHtml = simpleMarkdownToHtml(safeContent);
  }
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['h1','h2','h3','p','strong','em','u','s','code','pre','blockquote','a','br','ul','ol','li','span','div'],
    ALLOWED_ATTR: ['href','target','rel','class']
  });
}

function getCachedMarkdown(content) {
  const key = `md:${content}`;
  if (sharedCache.has(key)) return sharedCache.get(key);
  const result = parseMarkdownSafe(content);
  sharedCache.set(key, result);
  return result;
}

// ------------------------------------------------------------------
// 6. TRANSLATION (cached, with proper fallback)
// ------------------------------------------------------------------
async function translateTextRaw(text, targetLang) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0,500))}&langpair=en|${targetLang}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    if (data?.responseData?.translatedText) return data.responseData.translatedText;
  } catch(e) { console.warn('Translation error:', e); }
  return null;
}
async function getCachedTranslation(text, lang) {
  const key = `tr:${text}|${lang}`;
  if (sharedCache.has(key)) return sharedCache.get(key);
  const result = await translateTextRaw(text, lang);
  if (result) sharedCache.set(key, result);
  return result;
}

// ------------------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------------------
const TextCard = React.memo(({
  content,
  expanded,        // unused – we manage internal expansion
  setExpanded,
  tokens,
  currentUser,
  postId,
  onAnalytics
}) => {
  // UI state
  const [showSummary, setShowSummary] = useState(false);
  const [showTts, setShowTts] = useState(false);
  const [showTranslate, setShowTranslate] = useState(false);
  const [translatedText, setTranslatedText] = useState(null);
  const [targetLang, setTargetLang] = useState('es');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [speechRate, setSpeechRate] = useState(1);
  const [showTtsSettings, setShowTtsSettings] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [copied, setCopied] = useState(false);
  const [isExpandedLocally, setIsExpandedLocally] = useState(false);
  const lastTranslateRef = useRef(0);
  const mountedRef = useRef(true);

  // Theme detection
  const isDark = tokens?.theme === 'dark' || (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cancelGlobalSpeech();
    };
  }, []);

  // Voice loading with proper event listener (no global override)
  useEffect(() => {
    if (!globalSynth) return;
    const load = () => {
      if (mountedRef.current) setAvailableVoices(globalSynth.getVoices());
    };
    globalSynth.addEventListener?.('voiceschanged', load);
    load(); // initial load
    return () => {
      globalSynth.removeEventListener?.('voiceschanged', load);
    };
  }, []);

  // Single analysis pipeline
  const analysis = useMemo(() => getFullAnalysis(content), [content]);
  const { summary, sentiment, topic, readingTime } = analysis;
  const htmlContent = useMemo(() => getCachedMarkdown(content), [content]);
  const truncated = content?.length > 500 && !isExpandedLocally;
  const solidBg = useMemo(() => getRandomSolidBackground(postId), [postId]);
  const SentimentIcon = sentiment.icon;

  // Add a contrast overlay to ensure readability (premium fix)
  const contrastOverlay = isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.1)';

  // Uniform typography (no scaling by content length)
  const textFontSize = '1rem';

  // Button styling (subtle)
  const buttonGlow = `0 0 8px rgba(236, 72, 153, 0.4), 0 0 12px rgba(147, 51, 234, 0.2)`;
  const neonGradient = `linear-gradient(135deg, ${tokens?.audioNeonPrimary || '#9333ea'}, ${tokens?.audioNeonSecondary || '#c026d3'}, #06b6d4)`;

  // Floating shadow
  const floatingShadow = isDark
    ? '0 20px 35px -12px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.2)'
    : '0 20px 35px -12px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.05)';

  // Translation handler (with proper fallback)
  const handleTranslate = useCallback(async () => {
    const now = Date.now();
    if (now - lastTranslateRef.current < 2000) return;
    lastTranslateRef.current = now;
    if (isTranslating) return;
    setIsTranslating(true);
    const translated = await getCachedTranslation(content, targetLang);
    if (mountedRef.current) {
      setTranslatedText(translated); // null if failed – we'll show error message
    }
    setIsTranslating(false);
  }, [content, targetLang, isTranslating]);

  // TTS handler (event-driven sync)
  const startSpeaking = useCallback(() => {
    if (!globalSynth) return;
    if (isSpeaking) {
      cancelGlobalSpeech();
      setIsSpeaking(false);
      return;
    }
    speakGlobal(content, () => {
      if (mountedRef.current) setIsSpeaking(false);
    }, {
      rate: speechRate,
      voice: selectedVoice,
    });
    setIsSpeaking(true);
  }, [content, isSpeaking, speechRate, selectedVoice]);

  // Copy with fallback
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      if (window.navigator.vibrate) window.navigator.vibrate(20);
      setTimeout(() => setCopied(false), 2000);
      onAnalytics?.('text_copy', { postId });
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Rendered markdown (reused)
  const renderedMarkdown = useMemo(() => (
    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
  ), [htmlContent]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ type: "spring", damping: 26, stiffness: 280 }}
      whileHover={{ scale: 1.006, y: -1, transition: { duration: 0.2 } }}
      className="relative mx-4 my-3 rounded-2xl overflow-hidden border"
      style={{
        backgroundColor: solidBg,
        borderColor: tokens?.border || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
        boxShadow: floatingShadow,
      }}
    >
      {/* Contrast overlay (ensures text readability) */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: contrastOverlay, mixBlendMode: 'multiply' }} />
      
      <div className="relative z-10 p-4 sm:p-5 space-y-3 sm:space-y-4">
        {/* Header Badges */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-black/20 backdrop-blur-sm" style={{ color: tokens?.textSecondary || (isDark ? '#e5e7eb' : '#f3f4f6') }}>
            <BookOpen className="w-3 h-3" /> {readingTime} min
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-black/20 backdrop-blur-sm" style={{ color: sentiment.color }}>
            <SentimentIcon className="w-3 h-3" /> {sentiment.label}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-black/20 backdrop-blur-sm">
            <Hash className="w-3 h-3" style={{ color: tokens?.textSecondary || (isDark ? '#e5e7eb' : '#f3f4f6') }} /> {topic}
          </span>
          {summary && summary !== content && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-white" style={{ background: neonGradient, boxShadow: buttonGlow }}>
              <Sparkles className="w-3 h-3" /> Quick Summary
            </span>
          )}
        </div>

        {/* Rich Text Content – uniform font size */}
        <div
          className="prose prose-invert max-w-none break-words"
          style={{
            color: tokens?.text || (isDark ? '#fff' : '#1f2937'),
            fontSize: textFontSize,
            lineHeight: 1.5,
          }}
        >
          <style>{`
            .arvdoul-mention { color: ${tokens?.primary || '#60A5FA'}; font-weight: 500; background: rgba(96,165,250,0.1); border-radius: 8px; padding: 0 2px; }
            .arvdoul-hashtag { color: ${tokens?.secondary || '#A78BFA'}; font-weight: 500; }
            blockquote { border-left: 3px solid ${tokens?.primary || '#8B5CF6'}; margin: 0.75rem 0; padding-left: 1rem; color: ${tokens?.textSecondary || (isDark ? '#9ca3af' : '#4b5563')}; font-style: italic; }
            pre { background: rgba(0,0,0,0.4); border-radius: 12px; padding: 0.75rem; overflow-x: auto; font-size: 0.85rem; }
            code { font-family: 'Fira Code', monospace; background: rgba(0,0,0,0.3); padding: 0.2rem 0.4rem; border-radius: 6px; font-size: 0.85rem; }
            h1 { font-size: 1.6rem; font-weight: 700; margin: 0.75rem 0; }
            h2 { font-size: 1.4rem; font-weight: 600; margin: 0.6rem 0; }
            h3 { font-size: 1.2rem; font-weight: 600; margin: 0.5rem 0; }
            a { color: ${tokens?.accent || '#FF2D55'}; text-decoration: underline; }
            p { margin: 0.5rem 0; }
          `}</style>
          {truncated ? (
            <>
              <div className="line-clamp-6 sm:line-clamp-8">{renderedMarkdown}</div>
              <button
                onClick={() => setIsExpandedLocally(true)}
                className="mt-2 text-xs sm:text-sm font-medium transition hover:underline"
                style={{ color: tokens?.primary || '#8B5CF6' }}
              >
                Read more
              </button>
            </>
          ) : (
            renderedMarkdown
          )}
        </div>

        {/* Feature Buttons */}
        <div className="flex flex-wrap gap-2 sm:gap-3 pt-1">
          {summary && summary !== content && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => setShowSummary(!showSummary)}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium text-white transition-all"
              style={{ background: neonGradient, boxShadow: buttonGlow }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {showSummary ? 'Hide Summary' : 'Quick Summary'}
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => setShowTts(!showTts)}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium text-white transition-all"
            style={{ background: neonGradient, boxShadow: buttonGlow }}
          >
            <Volume2 className="w-3.5 h-3.5" />
            {showTts ? 'Hide Listen' : 'Listen'}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => setShowTranslate(!showTranslate)}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium text-white transition-all"
            style={{ background: neonGradient, boxShadow: buttonGlow }}
          >
            <Languages className="w-3.5 h-3.5" />
            {showTranslate ? 'Hide Translate' : 'Translate'}
          </motion.button>
        </div>

        {/* Expandable Panels */}
        <AnimatePresence>
          {showSummary && summary && summary !== content && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="p-2 sm:p-3 rounded-xl text-xs sm:text-sm overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', borderLeft: `3px solid ${tokens?.primary || '#8B5CF6'}` }}
            >
              <span className="font-semibold">📄 Quick Summary: </span>{summary}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showTts && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="p-2 sm:p-3 rounded-xl space-y-2 sm:space-y-3 overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', border: `1px solid rgba(255,255,255,0.1)` }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={startSpeaking}
                  className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium text-white"
                  style={{ background: neonGradient, boxShadow: buttonGlow }}
                >
                  {isSpeaking ? <MicOff className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {isSpeaking ? 'Stop' : 'Read aloud'}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setShowTtsSettings(!showTtsSettings)}
                  className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 transition"
                >
                  <Settings className="w-3.5 h-3.5" style={{ color: '#fff' }} />
                </motion.button>
              </div>
              {showTtsSettings && (
                <div className="space-y-2">
                  <select
                    onChange={e => setSelectedVoice(availableVoices.find(v => v.name === e.target.value) || null)}
                    className="w-full text-xs p-1.5 sm:p-2 rounded-lg bg-black/50 border border-white/20 text-white"
                  >
                    <option>Default Voice</option>
                    {availableVoices.map(v => (
                      <option key={v.name}>{v.name}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white">Speed</span>
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.1"
                      value={speechRate}
                      onChange={e => setSpeechRate(parseFloat(e.target.value))}
                      className="flex-1 h-1 rounded-full"
                      style={{ background: '#374151' }}
                    />
                    <span className="text-xs text-white w-8">{speechRate}x</span>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showTranslate && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="p-2 sm:p-3 rounded-xl space-y-2 sm:space-y-3 overflow-hidden"
              style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', border: `1px solid rgba(255,255,255,0.1)` }}
            >
              <div className="flex flex-wrap gap-2">
                <select
                  value={targetLang}
                  onChange={e => setTargetLang(e.target.value)}
                  className="text-xs p-1.5 sm:p-2 rounded-lg bg-black/50 border border-white/20 text-white"
                >
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="it">Italian</option>
                  <option value="pt">Portuguese</option>
                  <option value="zh">Chinese</option>
                  <option value="ja">Japanese</option>
                </select>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleTranslate}
                  disabled={isTranslating}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium text-white"
                  style={{ background: neonGradient }}
                >
                  {isTranslating ? 'Translating…' : 'Translate'}
                </motion.button>
              </div>
              {translatedText ? (
                <div
                  className="p-2 rounded-lg text-xs sm:text-sm text-white"
                  style={{ background: 'rgba(0,0,0,0.3)', borderLeft: `3px solid #22c55e` }}
                >
                  {translatedText}
                </div>
              ) : isTranslating ? null : (
                <div className="p-2 rounded-lg text-xs sm:text-sm text-white/60" style={{ background: 'rgba(0,0,0,0.3)' }}>
                  Translation unavailable
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Action Bar – only Copy */}
        <div className="flex justify-end gap-2 sm:gap-3 pt-2 border-t" style={{ borderColor: tokens?.border || (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)') }}>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={copyToClipboard}
            className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 transition"
            aria-label="Copy text"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" style={{ color: tokens?.textSecondary || (isDark ? '#9ca3af' : '#4b5563') }} />}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
});

TextCard.displayName = 'TextCard';
export default TextCard;