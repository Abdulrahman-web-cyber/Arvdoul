/**
 * functions/ai.js - ARVDOUL AI GATEWAY (server-side)
 *
 * The client (aiStudioService) calls this endpoint via VITE_AI_GATEWAY_URL.
 * The OpenAI key NEVER ships to the client. This function:
 *   - authenticates the caller (context.auth required)
 *   - enforces per-user rate limiting (X requests / minute, Firestore window)
 *   - enforces per-user daily budget caps (Firestore counters)
 *   - forwards to OpenAI with the server-side key from env config
 *   - persists usage/cost telemetry to `ai_usage_logs`
 *   - returns a stable shape the client already understands
 *     ({ content, usage: { prompt_tokens, completion_tokens, cost } })
 *
 * Config (functions env):
 *   AI_OPENAI_API_KEY    - OpenAI API key (never a VITE_ variable)
 *   AI_MODEL             - model name (default gpt-4o-mini)
 *   AI_DAILY_BUDGET_USD  - per-user daily cap (default 1.00)
 *   AI_RATE_LIMIT_PER_MIN- per-user requests/minute (default 10)
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

const MODEL = process.env.AI_MODEL || 'gpt-4o-mini';
const DAILY_BUDGET_USD = Number(process.env.AI_DAILY_BUDGET_USD || 1.0);
const RATE_LIMIT_PER_MIN = Number(process.env.AI_RATE_LIMIT_PER_MIN || 10);
// Rough token->USD cost model for gpt-4o-mini (input $0.15/M, output $0.60/M).
const COST_PER_INPUT_TOKEN = 0.15 / 1e6;
const COST_PER_OUTPUT_TOKEN = 0.60 / 1e6;

function rateLimitKey(uid, minuteBucket) {
  return `ai_${uid}_${minuteBucket}`;
}

/**
 * Sliding-window rate limit using a Firestore doc with a TTL-ish cleanup:
 * window start + count. Old windows are overwritten (single doc per minute).
 */
async function checkRateLimit(uid) {
  const now = Date.now();
  const minuteBucket = Math.floor(now / 60000);
  const ref = db.doc(`ai_rate_limits/${rateLimitKey(uid, minuteBucket)}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? (snap.data().count || 0) : 0;
    if (count >= RATE_LIMIT_PER_MIN) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        `AI rate limit exceeded (${RATE_LIMIT_PER_MIN}/min). Try again shortly.`
      );
    }
    tx.set(ref, { uid, count: count + 1, windowStart: now }, { merge: true });
  });
}

/** Daily per-user budget check + accumulation. */
async function checkAndTrackBudget(uid, estimatedCost) {
  const today = new Date().toISOString().slice(0, 10);
  const ref = db.doc(`ai_usage_daily/${uid}_${today}`);

  let allowed = true;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const spent = snap.exists ? (snap.data().spentUSD || 0) : 0;
    if (spent + estimatedCost > DAILY_BUDGET_USD) {
      allowed = false;
      return;
    }
    tx.set(ref, { uid, date: today, spentUSD: spent + estimatedCost }, { merge: true });
  });
  return allowed;
}

/** Truncates the prompt defensively before it reaches the provider. */
function sanitizePrompt(prompt) {
  const text = typeof prompt === 'string' ? prompt : '';
  return text.slice(0, 4000);
}

exports.generateAIContent = functions
  .runWith({ memory: '256MB', timeoutSeconds: 120 })
  .https.onCall(async (data, context) => {
    // 1. Auth
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be signed in to use AI Studio.'
      );
    }
    const uid = context.auth.uid;

    // 2. Input
    const prompt = sanitizePrompt(data && data.prompt);
    const systemPrompt = typeof (data && data.systemPrompt) === 'string'
      ? data.systemPrompt.slice(0, 2000)
      : 'You are a world-class creator AI assistant.';
    const capability = typeof (data && data.capability) === 'string'
      ? data.capability.slice(0, 40)
      : 'chat';
    if (!prompt) {
      throw new functions.https.HttpsError('invalid-argument', 'prompt is required');
    }

    // 3. Rate limit
    await checkRateLimit(uid);

    // 4. Provider key (server-side only)
    const apiKey = process.env.AI_OPENAI_API_KEY;
    if (!apiKey) {
      // Fail loudly - never silently fake a response.
      throw new functions.https.HttpsError(
        'failed-precondition',
        'AI provider is not configured. Contact support.'
      );
    }

    // 5. Call OpenAI
    let providerResponse;
    try {
      providerResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
        signal: AbortSignal.timeout(60000),
      });
    } catch (err) {
      throw new functions.https.HttpsError('unavailable', `AI provider unreachable: ${err.message}`);
    }

    if (!providerResponse.ok) {
      const body = await providerResponse.text().catch(() => '');
      throw new functions.https.HttpsError(
        'internal',
        `AI provider error (${providerResponse.status})`,
        body.slice(0, 500)
      );
    }

    const providerData = await providerResponse.json();
    const content = providerData.choices && providerData.choices[0]
      ? providerData.choices[0].message.content
      : null;
    if (!content) {
      throw new functions.https.HttpsError('internal', 'AI provider returned no content');
    }

    // 6. Cost accounting + budget cap (post-check: prevent runaway spend)
    const promptTokens = providerData.usage ? providerData.usage.prompt_tokens : 0;
    const completionTokens = providerData.usage ? providerData.usage.completion_tokens : 0;
    const estimatedCost =
      promptTokens * COST_PER_INPUT_TOKEN + completionTokens * COST_PER_OUTPUT_TOKEN;
    const withinBudget = await checkAndTrackBudget(uid, estimatedCost);
    if (!withinBudget) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        `AI daily budget exceeded ($${DAILY_BUDGET_USD.toFixed(2)}). Resets tomorrow.`
      );
    }

    // 7. Persist usage telemetry (best-effort, never breaks the response)
    try {
      await db.collection('ai_usage_logs').add({
        uid,
        capability,
        promptTokens,
        completionTokens,
        estimatedCost,
        model: MODEL,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      functions.logger.warn('AI usage log write failed', { error: err.message });
    }

    return {
      content,
      usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, cost: estimatedCost },
      model: MODEL,
      serverVerified: true,
    };
  });
