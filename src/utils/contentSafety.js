// src/utils/contentSafety.js
//
// Zero-tolerance explicit sexual / NSFW / CSAM / adult-solicitation safety guard.
// Runs deterministically on the client (creation + defensive display filtering)
// with carefully scoped word-boundary / phrase matching so normal vocabulary
// ("class", "classic", "assistant", "password", "analysis", "cocktail",
// "Essex", "peacock", "therapist", etc.) never triggers false positives.

const EXPLICIT_SEXUAL_PATTERNS = [
  // CSAM / underage sexual exploitation (strictest priority)
  { category: 'child_exploitation', re: /\b(?:csam|cp\s*links?|child\s*porn(?:ography)?|underage\s*(?:sex|nudes?|porn)|loli(?:con)?|shota(?:con)?|jailbait|preteen\s*(?:sex|nude))\b/i },
  // Explicit pornography / adult websites / explicit commercial sex work
  { category: 'sexually_explicit', re: /\b(?:porn(?:ography|hub|ographic)?|xxx|nsfw\s*(?:nudes?|leaks?|video|pics?)|xvideos|xnxx|redtube|youporn|brazzers|onlyfans\s*(?:leaks?|nudes?|promo|free)|fansly\s*(?:leaks?|nudes?)|chaturbate|camgirl|camboy|camsoda|hentai|rule34|nude\s*(?:leaks?|pics?|videos?|selfies?)|send\s*nudes|leak(?:ed)?\s*nudes|sextape|sex\s*tape)\b/i },
  // Explicit sexual acts & anatomical vulgar solicitation
  { category: 'sexually_explicit', re: /\b(?:blowjob|handjob|rimjob|footjob|titjob|deepthroat|creampie|gangbang|bukkake|cumshot|facial\s*cum|cunnilingus|fellatio|analingus|peg(?:ging)?\s*session|threesome\s*sex|foursome\s*sex|orgy|bdsm\s*(?:slave|dungeon|porn)|bondage\s*porn|fetish\s*(?:videos?|pics?|cam)|dildo|vibrator\s*(?:play|cam)|fleshlight|masturbat(?:e|ing|ion)|jacking\s*off|jerking\s*off|fingering\s*(?:pussy|her|myself)|pussy\s*(?:pics?|videos?|licking|eating|wet)|cock\s*(?:sucking|riding|pics?|rate)|dick\s*(?:pics?|rate|sucking)|tits\s*(?:out|pics?)|boob(?:s|ies)\s*(?:pics?|out|leaks?)|anal\s*sex|oral\s*sex|vaginal\s*sex|bareback\s*sex|raw\s*sex|sexting)\b/i },
  // Explicit adult solicitation / escorting
  { category: 'adult_solicitation', re: /\b(?:escort\s*(?:service|available|incall|outcall)|full\s*service\s*escort|incall\s*outcall|happy\s*ending\s*massage|erotic\s*massage|sugar\s*(?:daddy|baby)\s*(?:meet|sex|pay)|hookup\s*(?:tonight|nsfw|sex)|fwb\s*hookup|cash\s*meet\s*sex)\b/i },
  // Standalone high-signal explicit terms unlikely in clean civic discourse
  { category: 'sexually_explicit', re: /\b(?:slut(?:s|ty)?|whore(?:s)?|milf(?:s)?|dilf(?:s)?|jizz|splooge|ejaculat(?:e|ing|ion)|clitoris|orgasm(?:ic|s)?|erotica|erotic\s*(?:story|stories|video|videos|photos?)|naked\s*(?:pics?|photos?|videos?|selfies?))\b/i },
];

function collectStrings(value, out, depth = 0) {
  if (value == null || depth > 4) return;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) out.push(trimmed);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectStrings(entry, out, depth + 1);
    }
    return;
  }
  if (typeof value === 'object') {
    for (const val of Object.values(value)) {
      collectStrings(val, out, depth + 1);
    }
  }
}

/**
 * Normalize common obfuscation (zero-width chars, excessive spacing) lightly
 * without breaking word boundaries on normal text.
 */
function normalizeSafetyText(raw) {
  return String(raw || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[_*`~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findExplicitSexualMatches(rawText) {
  const clean = normalizeSafetyText(rawText);
  if (!clean) return [];
  const categories = new Set();
  for (const { category, re } of EXPLICIT_SEXUAL_PATTERNS) {
    if (re.test(clean)) {
      categories.add(category);
    }
  }
  return Array.from(categories);
}

/**
 * Evaluate candidate content before upload/publish.
 * Accepts string or structured object `{ text, title, caption, description, tags, hashtags, mediaNames, extraFields }`.
 */
export function evaluateContentSafety(input) {
  const parts = [];
  if (typeof input === 'string') {
    parts.push(input);
  } else if (input && typeof input === 'object') {
    collectStrings(
      [
        input.text,
        input.title,
        input.caption,
        input.description,
        input.content,
        input.tags,
        input.hashtags,
        input.mediaNames,
        input.extraFields,
      ],
      parts
    );
  }

  const combined = parts.join('\n');
  const categories = findExplicitSexualMatches(combined);
  if (categories.length === 0) {
    return {
      allowed: true,
      flagged: false,
      categories: [],
      reason: null,
    };
  }

  const isCsam = categories.includes('child_exploitation');
  return {
    allowed: false,
    flagged: true,
    categories,
    reason: isCsam
      ? 'This content violates Arvdoul zero-tolerance child safety policy and cannot be published.'
      : 'Sexually explicit or adult content is not permitted on Arvdoul.',
  };
}

/**
 * Defensive display-side filter for feeds, Sparks/videos, search hits, and offline caches.
 * Drops items explicitly marked NSFW/explicit/rejected or containing explicit sexual text.
 */
export function isSafeFeedItem(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.isNsfw === true || item.isExplicit === true || item.safetyAccessibility?.isExplicit === true) {
    return false;
  }
  if (item.moderation?.status === 'rejected' || item.moderationStatus === 'rejected') {
    return false;
  }
  const flags = Array.isArray(item.moderationFlags)
    ? item.moderationFlags
    : Array.isArray(item.moderation?.flags)
      ? item.moderation.flags
      : [];
  if (flags.some((f) => /sexual|explicit|nsfw|adult|csam/i.test(String(f)))) {
    return false;
  }

  const check = evaluateContentSafety({
    title: item.title,
    content: item.content,
    caption: item.caption,
    description: item.description,
    tags: item.tags,
    hashtags: item.hashtags,
    extraFields: [
      item.typeData?.poll?.question,
      item.typeData?.poll?.options,
      item.typeData?.link?.title,
      item.typeData?.event?.title,
      item.typeData?.event?.description,
    ],
  });
  return check.allowed;
}
