// src/services/aiCoPilotDirectorService.js

import { logger } from '../utils/Logger.js';

export const CONTENT_FORMATS = {
  REEL: 'reel',
  AUDIO_SPACE: 'audio_space',
  STORY: 'story',
  POST: 'post',
};

export class AICoPilotDirectorService {
  /**
   * Generates a structured narrative plan with hook, key beats, and call-to-action.
   */
  generateCreativeScript({ topic, format = CONTENT_FORMATS.REEL, targetAudience = 'general', tone = 'energetic' }) {
    if (!topic) throw new Error('Topic is required for script generation');

    const cleanTopic = String(topic).trim();

    const scriptStructure = {
      id: `script_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      format,
      topic: cleanTopic,
      targetAudience,
      tone,
      hook: `Did you know that ${cleanTopic} is completely changing the way we create? Here is the secret nobody talks about...`,
      scenes: [
        {
          sceneNumber: 1,
          durationSec: format === CONTENT_FORMATS.REEL ? 4 : 10,
          visualCue: 'Fast zoom-in on face with bold text overlay',
          voiceover: `Most people get ${cleanTopic} totally wrong. Let's fix that in 30 seconds.`,
          soundEffect: 'whoosh_riser.mp3',
        },
        {
          sceneNumber: 2,
          durationSec: format === CONTENT_FORMATS.REEL ? 12 : 25,
          visualCue: 'Screen recording / B-roll demonstrating the core workflow',
          voiceover: `Step one: focus on velocity and quality. Step two: leverage your unique voice.`,
          soundEffect: 'subtle_lofi_beat.mp3',
        },
        {
          sceneNumber: 3,
          durationSec: format === CONTENT_FORMATS.REEL ? 6 : 10,
          visualCue: 'Creator smiling, gesturing toward comment section / follow button',
          voiceover: `Drop a comment with your take, and follow for daily deep dives!`,
          soundEffect: 'bell_chime.mp3',
        },
      ],
      estimatedTotalDurationSec: format === CONTENT_FORMATS.REEL ? 22 : 45,
      suggestedHashtags: [`#${cleanTopic.replace(/\s+/g, '')}`, '#ArvdoulCreators', '#ViralTips', '#TechDaily'],
    };

    logger.info(`[AICoPilot] Creative script generated for topic: ${cleanTopic}`);
    return scriptStructure;
  }

  /**
   * Analyzes text for hook potency, sentiment tone, and readability.
   */
  analyzeHookAndReadability(text = '') {
    if (!text || typeof text !== 'string') {
      return { score: 0, grade: 'POOR', recommendations: ['Provide text to analyze'] };
    }

    const trimmed = text.trim();
    const words = trimmed.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Hook power triggers
    const powerWords = new Set([
      'secret', 'shocking', 'revealed', 'stop', 'warning', 'never', 'how to',
      'mistake', 'transform', 'crazy', 'insane', 'proven', 'hack', 'hidden'
    ]);

    let powerHits = 0;
    const lower = trimmed.toLowerCase();
    for (const pw of powerWords) {
      if (lower.includes(pw)) powerHits++;
    }

    const hasQuestion = trimmed.includes('?');
    const hasNumbers = /\d+/.test(trimmed);

    // Score calculation (0 - 100)
    let hookScore = 40;
    if (powerHits > 0) hookScore += Math.min(30, powerHits * 15);
    if (hasQuestion) hookScore += 15;
    if (hasNumbers) hookScore += 10;
    if (wordCount >= 6 && wordCount <= 22) hookScore += 15; // Ideal hook length
    if (wordCount > 35) hookScore -= 20; // Too verbose

    hookScore = Math.min(100, Math.max(10, hookScore));

    const recommendations = [];
    if (powerHits === 0) recommendations.push('Incorporate high-impact power words (e.g. secret, mistake, proven)');
    if (!hasNumbers) recommendations.push('Add specific numbers to increase curiosity and credibility');
    if (!hasQuestion) recommendations.push('Consider framing the opening sentence as a provocative question');
    if (wordCount > 25) recommendations.push('Shorten the opening hook to under 20 words for immediate retention');

    return {
      hookScore,
      powerWordsDetected: powerHits,
      wordCount,
      grade: hookScore >= 80 ? 'EXCELLENT' : hookScore >= 60 ? 'GOOD' : 'NEEDS_IMPROVEMENT',
      recommendations,
    };
  }

  /**
   * Generates optimized multi-modal prompts for AI cover art and soundtrack synthesis.
   */
  generateAssetPrompts(topic, style = 'cyberpunk') {
    return {
      imagePrompt: `Ultra-high-resolution dynamic visual representing ${topic}, ${style} aesthetic, dramatic neon rim lighting, 8k octane render, cinematic composition, depth of field, sharp focus, no watermarks`,
      aspectRatio: '9:16',
      audioPrompt: {
        genre: 'Electronic Synthwave / Ambient Lo-Fi',
        tempoBpm: 124,
        mood: 'Futuristic, uplifting, confident, driving baseline',
        durationSec: 30,
      },
    };
  }

  /**
   * Performs pre-flight compliance check to ensure content is safe for publishing.
   */
  preFlightSafetyCheck(content = '') {
    const forbiddenPatterns = [
      /\b(hate|slur|kill\s+yourself|suicide)\b/i,
      /\b(credit\s*card\s*\d{4}|\b\d{3}-\d{2}-\d{4}\b)/i, // PII / SSN
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(content)) {
        return {
          isSafe: false,
          flaggedReason: 'POTENTIAL_POLICY_OR_PII_VIOLATION',
          recommendedAction: 'REVIEW_REQUIRED',
        };
      }
    }

    return {
      isSafe: true,
      flaggedReason: null,
      recommendedAction: 'PROCEED_WITH_PUBLISH',
    };
  }
}

export const aiCoPilotDirectorService = new AICoPilotDirectorService();
export default aiCoPilotDirectorService;
