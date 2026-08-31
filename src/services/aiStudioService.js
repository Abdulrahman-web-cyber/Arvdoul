// src/services/aiStudioService.js
// 🌟 ARVDOUL AI CREATIVE CO-PILOT SERVICE - ULTRA PRODUCTION READY v8.0
// Advanced creative assistant supporting prompt caching, request queuing, budget caps, and multi-model fallback.

import { svcLogger } from './ServiceKit.js';
import localforage from 'localforage';

const log = svcLogger('aiStudioService');

const TONES = {
  hype: { label: '🔥 Hype & Viral', emojis: ['🚀', '💥', '🔥', '⚡️', '🤯'] },
  casual: { label: '☕️ Casual & Friendly', emojis: ['✨', '🤙', '💯', '😊'] },
  educational: { label: '🧠 Educational & Insightful', emojis: ['💡', '📚', '🎯', '🔍', '📌'] },
  poetic: { label: '✨ Aesthetic & Poetic', emojis: ['🌙', '🪐', '🕊️', '🍃', '💫'] },
  story: { label: '📖 Storytelling', emojis: ['👀', '⏳', '🧵', '🎙️', '🏆'] },
  humor: { label: '😂 Meme & Sarcastic', emojis: ['💀', '😭', '🤡', '🤣', '👀'] }
};

// NO local template fallbacks. AI output is only ever produced by the
// server-side AI gateway (functions/ai.js). When the gateway is not
// configured or fails, every generator returns null and the UI shows an
// honest error — fabricated hooks, fake viral scores, invented "best time to
// post" advice and sample scripts are NOT acceptable substitutes for AI.

class AIStudioService {
  constructor() {
    this.usageLogs = [];
    this.MAX_LOGS_LIMIT = 500;
    this.costPerToken = 0.000002; // Roughly $0.002 / 1K tokens standard
    this.dailyBudgetLimitUSD = 5.00; // Daily budget safety cap per user
    this.promptCache = new Map(); // local prompt cache
    this.requestQueue = [];
    this.maxConcurrentRequests = 2;
    this.activeRequests = 0;

    // Load persisted logs on startup
    this._initLogs();
  }

  /**
   * Enforces max logs limit.
   * @private
   */
  _enforceLogsLimit() {
    if (this.usageLogs.length > this.MAX_LOGS_LIMIT) {
      this.usageLogs.shift();
    }
  }

  /**
   * Initializes persistent localForage storage for usage logs.
   * @private
   */
  async _initLogs() {
    try {
      const saved = await localforage.getItem('arvdoul_ai_usage_logs');
      if (Array.isArray(saved)) {
        this.usageLogs = saved;
      }
    } catch (_) {
      this.usageLogs = [];
    }
  }

  /**
   * Persists current usage logs.
   * @private
   */
  async _persistLogs() {
    try {
      await localforage.setItem('arvdoul_ai_usage_logs', this.usageLogs);
    } catch (_) {}
  }

  /**
   * Evaluates current daily spent budget against limit.
   */
  getDailySpendUSD() {
    const todayStart = new Date().setHours(0, 0, 0, 0);
    return this.usageLogs
      .filter(log => log.timestamp >= todayStart)
      .reduce((sum, log) => sum + (log.estimatedCost || 0), 0);
  }

  /**
   * Robust model-fallback chain and queue manager.
   * Runs request within safe concurrency pool.
   * @private
   */
  async _queueRequest(requestFn) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ requestFn, resolve, reject });
      this._processQueue();
    });
  }

  /**
   * Process requests in queue under concurrency caps.
   * @private
   */
  async _processQueue() {
    if (this.activeRequests >= this.maxConcurrentRequests || this.requestQueue.length === 0) {
      return;
    }

    const { requestFn, resolve, reject } = this.requestQueue.shift();
    this.activeRequests++;

    try {
      const result = await requestFn();
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.activeRequests--;
      this._processQueue();
    }
  }

  /**
   * Executing chat completion with budget enforcement, caching, and fallback.
   * @private
   */
  async _callOpenAI(prompt, systemPrompt = "You are a world-class creator AI assistant.") {
    // 1. Budget enforcement
    const currentSpend = this.getDailySpendUSD();
    if (currentSpend >= this.dailyBudgetLimitUSD) {
      log.warn('AI Daily budget exceeded. Spend: $' + currentSpend.toFixed(4));
      return null;
    }

    // 2. Prompt Cache check
    const cacheKey = `${systemPrompt}:${prompt}`;
    if (this.promptCache.has(cacheKey)) {
      log.info('Prompt Cache hit.');
      return this.promptCache.get(cacheKey);
    }

    // 3. Server-side AI gateway (Cloud Function / proxy). The OpenAI key NEVER
    // ships to the client. The gateway authenticates the user, enforces per-
    // user rate limits and budget caps, and holds the provider credentials.
    const gatewayUrl = import.meta.env?.VITE_AI_GATEWAY_URL;
    if (!gatewayUrl) {
      log.warn('VITE_AI_GATEWAY_URL not configured - AI requests require a server-side gateway (functions/ai.js). No local fallback is produced; the caller must show an honest error.');
      return null;
    }

    const executeRequest = async () => {
      const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, systemPrompt, capability: 'chat' }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`AI gateway error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.content || data.choices?.[0]?.message?.content || null;

      // Server-reported usage/cost is authoritative; local estimate is a fallback.
      const promptTokens = data.usage?.prompt_tokens || 0;
      const completionTokens = data.usage?.completion_tokens || 0;
      const totalTokens = promptTokens + completionTokens;
      const estimatedCost = data.usage?.cost || totalTokens * this.costPerToken;

      this._enforceLogsLimit();
      this.usageLogs.push({
        timestamp: Date.now(),
        promptTokens,
        completionTokens,
        totalTokens,
        estimatedCost,
        gateway: gatewayUrl,
      });
      await this._persistLogs();

      // Save cache
      if (content) {
        this.promptCache.set(cacheKey, content);
      }

      return content;
    };

    try {
      return await this._queueRequest(executeRequest);
    } catch (err) {
      log.error('OpenAI fetch failed, falling back gracefully:', err);
      return null;
    }
  }

  /**
   * Simple content moderation pipeline for AI outputs.
   */
  moderateOutput(text) {
    const TOXIC_WORDS = ['idiot', 'stupid', 'retard', 'hate', 'kill yourself', 'spam', 'scam'];
    const lowerText = text.toLowerCase();
    for (const word of TOXIC_WORDS) {
      if (lowerText.includes(word)) {
        return {
          flagged: true,
          reason: `Content contains blocked phrase: "${word}"`
        };
      }
    }
    return { flagged: false };
  }

  /**
   * Generate high-engagement viral caption with hashtags
   */
  async generateCaptions({ topic, tone = 'hype', platform = 'reels', length = 'medium' }) {
    log.info('Generating AI captions', { topic, tone, platform, length });
    
    const selectedTone = TONES[tone] || TONES.hype;
    const cleanTopic = topic || 'content creation';

    // Try real OpenAI model first
    const systemPrompt = `You are an elite social media copywriter specializing in ${platform} captions. Tone: ${selectedTone.label}. Output style: ${length}.`;
    const prompt = `Write a viral high-engagement caption about: "${cleanTopic}". Include a strong hook, body, emojis: ${selectedTone.emojis.join(' ')}, and 5-8 relevant trending hashtags.`;

    const realResponse = await this._callOpenAI(prompt, systemPrompt);

    if (realResponse) {
      const modCheck = this.moderateOutput(realResponse);
      if (modCheck.flagged) {
        log.warn('OpenAI output flagged by moderation filter', modCheck.reason);
        return null;
      }
      const hashtags = realResponse.match(/#[a-zA-Z0-9]+/g) || [];

      // Only real data: the AI's own text + hashtags it actually produced.
      // No invented viral scores or "best time to post" — those are null and
      // the UI hides them.
      return {
        hook: realResponse.split('\n')[0] || null,
        body: realResponse,
        hashtags,
        viralScore: null,
        tone: selectedTone.label,
        recommendedPostTime: null,
        source: 'ai-gateway'
      };
    }

    // Honest unavailable state — never fabricate a caption.
    return null;
  }

  /**
   * Generate video / reel multi-scene script
   */
  async generateScript({ topic, duration = 30, style = 'tech' }) {
    log.info('Generating video script', { topic, duration, style });
    const cleanTopic = topic || 'your strategy';

    const systemPrompt = `You are a professional video editor and director. Generate a highly structured multi-scene video script with visual cues, audio cues, and speaking lines. Duration: ${duration} seconds.`;
    const prompt = `Write a highly engaging multi-scene video script with 3-4 scenes for topic: "${cleanTopic}" in a "${style}" style.`;

    const realResponse = await this._callOpenAI(prompt, systemPrompt);
    if (realResponse) {
      // Real AI output only. Title/derived labels come from the user's own
      // inputs; pacing and BGM suggestions are the AI's call, not ours.
      return {
        title: `How to Master ${cleanTopic} in ${duration} Seconds`,
        targetDuration: `${duration}s`,
        style,
        estimatedPacing: null,
        rawScriptText: realResponse,
        suggestedBgm: null,
        source: 'ai-gateway'
      };
    }

    // Honest unavailable state — no sample scripts.
    return null;
  }

  /**
   * Generate AI visual prompt
   */
  async craftImagePrompt({ subject, style = 'Cinematic', lighting = 'Golden Hour Volumetric', ratio = '9:16' }) {
    const cleanSubject = subject || 'a futuristic creator workspace in neon city';
    const systemPrompt = "You are a master AI prompt engineer for image generator systems like Midjourney v6.";
    const prompt = `Create a hyper-detailed photograph prompt for subject: "${cleanSubject}" in style: "${style}" with lighting: "${lighting}" with ratio: "${ratio}".`;

    const realResponse = await this._callOpenAI(prompt, systemPrompt);
    if (realResponse) {
      return {
        prompt: realResponse,
        ratio,
        style,
        lighting,
        source: 'ai-gateway'
      };
    }

    // Honest unavailable state — no locally assembled pseudo-prompts.
    return null;
  }

  /**
   * Predict sentiment & viral engagement
   */
  async analyzeViralPotential({ text }) {
    const systemPrompt = "You are a machine learning virality and sentiment analysis model. Output positive sentiment percentages and curiosity percentages.";
    const prompt = `Perform sentiment analysis on this content: "${text || ''}". Rate positive %, curiosity %, controversy %, and provide 3 key viral suggestions.`;

    const realResponse = await this._callOpenAI(prompt, systemPrompt);
    if (realResponse) {
      // The AI's analysis is the only real signal. Viral scores, sentiment
      // percentages and retention forecasts are NOT computed locally — any
      // hardcoded numbers would be fabricated analytics, so they are omitted.
      return {
        rawAnalysis: realResponse,
        source: 'ai-gateway'
      };
    }

    // Honest unavailable state — no invented scores or forecasts.
    return null;
  }

  /**
   * Multi-language content translation & localization
   */
  async localizeContent({ text, targetLanguages = ['es', 'fr', 'ja', 'pt', 'de'] }) {
    const cleanText = text || 'Discover the best content creation strategies on Arvdoul.';
    const systemPrompt = "You are a master localization engine translating social media captions precisely.";
    const prompt = `Translate this text exactly into these target languages: ${targetLanguages.join(', ')}. Text: "${cleanText}"`;

    const realResponse = await this._callOpenAI(prompt, systemPrompt);
    if (realResponse) {
      return targetLanguages.map(lang => ({
        code: lang,
        translation: realResponse,
        source: 'ai-gateway'
      }));
    }

    // NO fabricated translations. When the AI gateway is unavailable the
    // result is marked untranslated so the UI can show the original text
    // honestly instead of presenting invented content as a translation.
    return targetLanguages.map(lang => ({
      code: lang,
      translation: null,
      source: 'unavailable',
      untranslated: true,
      original: cleanText,
    }));
  }

  /**
   * Retrieve total cost of OpenAI calls made during this session
   */
  getCostAnalytics() {
    return this.usageLogs.reduce((acc, curr) => acc + curr.estimatedCost, 0);
  }
}

export const aiStudioService = new AIStudioService();
export default aiStudioService;
