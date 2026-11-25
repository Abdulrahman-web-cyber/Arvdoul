/**
 * Profile Highlights (Vibes highlights) carousel for Arvdoul.
 *
 * A slim, transparent liquid-glass strip that sits on the profile canvas.
 *
 * Data ownership (deterministic):
 *   - managedByParent === true  -> the `highlights` prop is the only source. No request is made.
 *   - managedByParent === false -> storyService.getHighlights(userId) is the only source and is
 *     called only for a real userId. Loading, success, empty and error are distinct states, an
 *     empty success never falls back to props, and a failed request offers a retry through the
 *     same service method.
 *   Results are keyed by user id and request generation, so a finished request for an old user (or
 *   an old attempt) can never render, even for one frame, and nothing updates after unmount.
 *
 * Interaction contracts are unchanged:
 *   onHighlightPress(item) is preferred, otherwise /highlight/:id (valid id only);
 *   owners: New -> onAddHighlight or /profile/highlights?create=true, Manage -> /profile/highlights;
 *   visitors: View all -> /stories and no owner controls. Records without a usable id are shown
 *   but are not interactive. Privacy and audience filtering remain the service's and parent's job.
 *
 * Visitors see nothing while a component-managed request is loading, and nothing when the
 * result is empty; they do see a retryable error if loading fails.
 *
 * @component
 */

import { memo, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronRight, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import storyService from '../../services/storyService';
import { LazyImage } from '../../components/Shared/LazyImage';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';

const ROUTES = Object.freeze({
  manage: '/profile/highlights',
  create: '/profile/highlights?create=true',
  viewAll: '/stories',
  highlight: (id) => `/highlight/${encodeURIComponent(id)}`,
});

const DEFAULT_TITLE = 'Highlight';
const SKELETON_COUNT = 5;

/* ── normalization (one path for parent and service data) ─────────────────── */

const cleanString = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeId = (value) => {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

// Network images, same-origin paths, blobs and raster data URIs only (no javascript:, no SVG data).
const SAFE_IMAGE = /^(https?:\/\/|\/(?!\/)|blob:|data:image\/(?:png|jpe?g|webp|gif|avif)[;,])/i;

const normalizeImage = (value) => {
  const raw = value && typeof value === 'object' ? (value.url ?? value.uri) : value;
  const text = cleanString(raw);
  return text && SAFE_IMAGE.test(text) ? text : null;
};

let EMOJI_PATTERN = null;
try {
  EMOJI_PATTERN = new RegExp('\\p{Extended_Pictographic}', 'u');
} catch {
  EMOJI_PATTERN = null;
}

const normalizeEmoji = (value) => {
  const text = cleanString(value);
  if (!text || text.length > 16) return null;
  return EMOJI_PATTERN ? (EMOJI_PATTERN.test(text) ? text : null) : text;
};

/**
 * Returns [{ key, item }]. `item` keeps every original field and is what onHighlightPress
 * receives, with id/title/cover/emoji normalized. Originals are never mutated. Duplicate ids
 * are dropped (first wins); records without an id get a content-based key.
 */
const normalizeHighlights = (source) => {
  if (!Array.isArray(source)) return [];
  const seenIds = new Set();
  const anonymousCounts = new Map();
  const entries = [];

  source.forEach((record) => {
    if (!record || typeof record !== 'object') return;
    const id = normalizeId(record.id);
    const realTitle = cleanString(record.title);
    const cover =
      normalizeImage(record.cover) ||
      normalizeImage(record.coverUrl) ||
      normalizeImage(record.thumbnailUrl) ||
      normalizeImage(record.mediaURL);
    const emoji = normalizeEmoji(record.emoji);
    if (!realTitle && !cover && !emoji) return;

    let key;
    if (id) {
      if (seenIds.has(id)) return;
      seenIds.add(id);
      key = `id:${id}`;
    } else {
      const base = `anon:${realTitle}|${cover || emoji || ''}`;
      const count = (anonymousCounts.get(base) || 0) + 1;
      anonymousCounts.set(base, count);
      key = `${base}#${count}`;
    }

    entries.push({ key, item: { ...record, id, title: realTitle || DEFAULT_TITLE, cover, emoji } });
  });

  return entries;
};

/** Accepts the service's array or { highlights: [] } shapes; anything else is a failed load. */
const readServiceList = (response) => {
  if (Array.isArray(response)) return response;
  if (response && Array.isArray(response.highlights)) return response.highlights;
  return null;
};

/* ── styles (scoped under .phl; colours derive from the brand token and Arvdoul values) ── */

const CSS = `
.phl{
  --v:200,43,255;--b:0,136,255;
  --tx:#F5F7FF;--tx2:#B4BFDE;--link:#8EC3FF;--focus:#7DB6FF;--err:#FCA5A5;
  --base:rgba(255,255,255,.025);--solid:#03071B;
  --spec:.14;--spec2:.03;--cv:.09;--cb:.13;--gloss:.05;
  --shadow:0 14px 26px -22px rgba(0,0,0,.48),0 2px 6px -3px rgba(0,0,0,.20);
  --inset:inset 0 1px 1px rgba(255,255,255,.16),inset 0 -10px 16px -14px rgba(var(--b),.22),inset 0 0 14px rgba(130,110,255,.04);
  --rim:linear-gradient(140deg,rgba(255,255,255,.26),rgba(255,255,255,.06) 30%,rgba(255,255,255,.02) 56%,rgba(var(--b),.28));
  --chip:linear-gradient(160deg,rgba(255,255,255,.12),rgba(255,255,255,.03));--chip-rim:rgba(255,255,255,.12);
  --face:#03071B;--sk:rgba(255,255,255,.07);
  --size:clamp(52px,14.5vw,60px);
  display:block;width:100%;min-width:0;color:var(--tx);
  font-family:inherit;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent;
}
.phl[data-theme="light"]{
  --tx:#121A3A;--tx2:#4B5679;--link:var(--arv-brand-blue);--focus:var(--arv-brand-blue);--err:#B91C1C;
  --base:rgba(255,255,255,.42);--solid:#FFFFFF;
  --spec:.85;--spec2:.36;--cv:.10;--cb:.14;--gloss:.5;
  --shadow:0 16px 26px -22px rgba(40,50,150,.34),0 1px 3px -1px rgba(30,40,110,.10);
  --inset:inset 0 1px 1px #fff,inset 0 -10px 16px -14px rgba(var(--b),.22),inset 0 0 14px rgba(255,255,255,.5);
  --rim:linear-gradient(140deg,#fff,rgba(255,255,255,.42) 30%,rgba(90,80,220,.08) 56%,rgba(var(--b),.30));
  --chip:linear-gradient(160deg,#FFFFFF,rgba(240,243,255,.78));--chip-rim:rgba(35,49,84,.10);
  --face:#E2E8F0;--sk:rgba(35,49,84,.07);
}
.phl *,.phl *::before,.phl *::after{box-sizing:border-box}
:where(.phl) button{font:inherit;color:inherit}
.phl button:focus-visible{outline:2px solid var(--focus);outline-offset:2px}

/* transparent liquid glass strip */
.phl-glass{
  --layers:
    radial-gradient(120% 90% at 14% -30%,rgba(255,255,255,var(--spec)) 0%,rgba(255,255,255,var(--spec2)) 34%,transparent 58%),
    radial-gradient(70% 70% at 104% 120%,rgba(var(--b),var(--cb)) 0%,transparent 64%),
    radial-gradient(60% 70% at -6% 120%,rgba(var(--v),var(--cv)) 0%,transparent 62%),
    linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.01));
  position:relative;isolation:isolate;width:100%;padding:8px 12px 10px;border:1px solid transparent;border-radius:22px;
  background:var(--layers),var(--base);background-origin:border-box;box-shadow:var(--shadow),var(--inset);
  -webkit-backdrop-filter:blur(22px) saturate(180%);backdrop-filter:blur(22px) saturate(180%)}
.phl-glass::before{content:"";position:absolute;inset:-1px;padding:1px;border-radius:inherit;pointer-events:none;background:var(--rim);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude}
.phl-glass::after{content:"";position:absolute;z-index:-1;left:0;right:0;top:0;height:56%;border-radius:inherit;pointer-events:none;background:radial-gradient(70% 100% at 50% 0%,rgba(255,255,255,var(--gloss)),rgba(255,255,255,0) 72%)}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){.phl-glass{background:var(--layers),var(--solid);background-origin:border-box}}
@media (prefers-reduced-transparency:reduce){.phl-glass{-webkit-backdrop-filter:none;backdrop-filter:none;background:var(--layers),var(--solid);background-origin:border-box}}

.phl-head{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:28px}
.phl-title{margin:0;font-size:14px;line-height:1.2;font-weight:700;letter-spacing:-.005em;color:var(--tx)}
.phl-action{position:relative;display:inline-flex;align-items:center;gap:2px;min-height:28px;padding:0 4px 0 8px;margin-right:-4px;border:0;border-radius:8px;background:none;
  font-size:12px;font-weight:600;line-height:1;color:var(--link);cursor:pointer;transition:opacity .15s}
.phl-action::after{content:"";position:absolute;inset:-8px -4px}
.phl-action svg{width:14px;height:14px;transition:transform .15s}
@media (hover:hover){.phl-action:hover{opacity:.8}.phl-action:hover svg{transform:translateX(2px)}}

/* carousel */
.phl-rail{list-style:none;margin:0;padding:4px 4px 2px;display:flex;align-items:flex-start;gap:12px;min-width:0;max-width:100%;
  overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;scrollbar-width:none;touch-action:pan-x pan-y}
.phl-rail::-webkit-scrollbar{display:none}
.phl-cell{flex:none;display:flex}
.phl-tile{display:flex;flex-direction:column;align-items:center;gap:5px;width:calc(var(--size) + 14px);padding:0;border:0;background:none;border-radius:14px;text-align:center}
button.phl-tile{cursor:pointer}
.phl-label{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px;line-height:1.25;font-weight:600;color:var(--tx)}
.phl-label[data-quiet="true"]{color:var(--tx2);font-weight:500}

/* ring: brand gradient, constant thickness, clear gap, localized soft light */
.phl-orb{position:relative;width:var(--size);height:var(--size);flex:none;border-radius:50%;transition:transform .18s cubic-bezier(.22,.8,.24,1)}
.phl-halo{position:absolute;inset:4px;border-radius:50%;pointer-events:none;box-shadow:0 5px 12px -5px rgba(var(--b),.5);opacity:.75}
.phl-ring{position:absolute;inset:0;border-radius:50%;padding:2px;pointer-events:none;background:var(--phl-brand);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude}
.phl-face{position:absolute;inset:4px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:var(--face)}
.phl-face::after{content:"";position:absolute;inset:0;border-radius:50%;pointer-events:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.14),inset 0 -8px 12px -10px rgba(0,0,0,.25)}
.phl-face img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .3s ease}
.phl-face[data-kind="glyph"]{background:radial-gradient(90% 90% at 25% 10%,rgba(255,255,255,.22),transparent 60%),radial-gradient(80% 80% at 100% 110%,rgba(var(--b),.28),transparent 62%),linear-gradient(160deg,rgba(var(--v),.16),rgba(var(--b),.14)),var(--face)}
.phl[data-theme="light"] .phl-face[data-kind="glyph"]{background:radial-gradient(90% 90% at 25% 10%,rgba(255,255,255,.9),transparent 60%),radial-gradient(80% 80% at 100% 110%,rgba(var(--b),.18),transparent 62%),linear-gradient(160deg,rgba(var(--v),.08),rgba(var(--b),.10)),#F1F4FB}
.phl-glyph{font-size:22px;line-height:1;font-weight:700;color:var(--tx);user-select:none}

/* add tile: glass chip with a hairline brand ring */
.phl-add-face{position:absolute;inset:4px;border-radius:50%;display:grid;place-items:center;background:var(--chip);box-shadow:inset 0 1px 1px rgba(255,255,255,.22);color:var(--tx)}
.phl-add-face svg{width:20px;height:20px;transition:transform .18s}
.phl-ring[data-soft="true"]{opacity:.55}

@media (hover:hover){
  button.phl-tile:hover .phl-orb{transform:scale(1.04)}
  button.phl-tile:hover .phl-face img{transform:scale(1.05)}
  button.phl-tile:hover .phl-add-face svg{transform:rotate(90deg)}
}
button.phl-tile:active .phl-orb{transform:scale(.96)}

/* status rows */
.phl-note{display:flex;align-items:center;gap:12px;min-width:0}
.phl-note p{margin:0;flex:1;min-width:0;font-size:12.5px;line-height:1.35;font-weight:500;color:var(--tx2)}
.phl-note p[data-tone="error"]{color:var(--err);font-weight:600}
.phl-retry{display:inline-flex;align-items:center;gap:6px;flex:none;min-height:36px;padding:0 14px;border:1px solid var(--chip-rim);border-radius:999px;background:var(--chip);
  box-shadow:inset 0 1px 1px rgba(255,255,255,.2);font-size:12px;font-weight:600;color:var(--tx);cursor:pointer;transition:transform .15s,opacity .15s}
.phl-retry svg{width:14px;height:14px}
.phl-retry:active{transform:scale(.96)}
@media (hover:hover){.phl-retry:hover{opacity:.85}}

/* loading skeleton (same dimensions as the real carousel) */
.phl-sk-orb{width:var(--size);height:var(--size);border-radius:50%;background:var(--sk)}
.phl-sk-bar{width:calc(var(--size) - 10px);height:9px;border-radius:6px;background:var(--sk)}
.phl-sk{animation:phl-pulse 1.6s ease-in-out infinite}
@keyframes phl-pulse{0%,100%{opacity:1}50%{opacity:.55}}

@media (min-width:640px){.phl{--size:64px}.phl-glass{padding:8px 16px 10px}.phl-rail{gap:16px}.phl-title{font-size:15px}}
@media (forced-colors:active){
  .phl-glass,.phl-retry{border:1px solid CanvasText;background:Canvas}
  .phl-glass::before,.phl-glass::after{display:none}
  .phl-ring{background:Highlight}
}
@media (prefers-reduced-motion:reduce){
  .phl *,.phl *::before,.phl *::after{transition:none!important}
  .phl-sk{animation:none}
  button.phl-tile:active .phl-orb,.phl-retry:active{transform:none}
}
`;

/* ── presentation pieces ─────────────────────────────────────────────────── */

const HighlightTile = memo(({ entry, onOpen }) => {
  const { item } = entry;
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(item.cover) && !imageFailed;
  const glyph = item.emoji || Array.from(item.title)[0]?.toUpperCase() || '•';
  const interactive = Boolean(item.id);

  const body = (
    <>
      <span className="phl-orb">
        <span className="phl-halo" aria-hidden="true" />
        <span className="phl-ring" aria-hidden="true" />
        <span className="phl-face" data-kind={showImage ? 'photo' : 'glyph'}>
          {showImage ? (
            <LazyImage
              src={item.cover}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span className="phl-glyph" aria-hidden="true">{glyph}</span>
          )}
        </span>
      </span>
      <span className="phl-label">{item.title}</span>
    </>
  );

  return interactive ? (
    <button type="button" className="phl-tile" onClick={() => onOpen(item)} aria-label={`Highlight: ${item.title}`}>
      {body}
    </button>
  ) : (
    <span className="phl-tile" role="img" aria-label={`Highlight: ${item.title}`}>{body}</span>
  );
});
HighlightTile.displayName = 'HighlightTile';

const AddTile = memo(({ onAdd }) => (
  <button type="button" className="phl-tile" onClick={onAdd} aria-label="Create new highlight">
    <span className="phl-orb">
      <span className="phl-ring" data-soft="true" aria-hidden="true" />
      <span className="phl-add-face" aria-hidden="true"><Plus /></span>
    </span>
    <span className="phl-label" data-quiet="true">New</span>
  </button>
));
AddTile.displayName = 'AddTile';

const SkeletonRow = () => (
  <ul className="phl-rail" aria-hidden="true">
    {Array.from({ length: SKELETON_COUNT }, (_, slot) => (
      <li key={`sk-${slot}`} className="phl-cell">
        <span className="phl-tile phl-sk">
          <span className="phl-sk-orb" />
          <span className="phl-sk-bar" />
        </span>
      </li>
    ))}
  </ul>
);

/* ── component ───────────────────────────────────────────────────────────── */

const ProfileHighlightsSection = memo(({
  highlights = [],
  userId,
  isOwner = false,
  managedByParent = false,
  theme = 'light',
  onHighlightPress,
  onAddHighlight,
}) => {
  const navigate = useNavigate();
  const headingId = `phl-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const isDark = theme === 'dark';

  // Only a real id may reach the service; there is no implicit "me".
  const serviceUserId = !managedByParent ? normalizeId(userId) : null;

  const [attempt, setAttempt] = useState(0);
  // Result of the latest request. `userId` + `attempt` identify which request produced it.
  const [result, setResult] = useState({ userId: null, attempt: 0, status: 'idle', records: [] });

  useEffect(() => {
    if (!serviceUserId) return undefined;
    let cancelled = false;
    setResult({ userId: serviceUserId, attempt, status: 'loading', records: [] });

    Promise.resolve()
      .then(() => storyService.getHighlights(serviceUserId))
      .then((response) => {
        if (cancelled) return;
        const list = readServiceList(response);
        setResult(
          list
            ? { userId: serviceUserId, attempt, status: 'success', records: list }
            : { userId: serviceUserId, attempt, status: 'error', records: [] }
        );
      })
      .catch(() => {
        if (cancelled) return;
        setResult({ userId: serviceUserId, attempt, status: 'error', records: [] });
      });

    return () => { cancelled = true; };
  }, [serviceUserId, attempt]);

  // A result only counts if it belongs to the current user and attempt; otherwise we are loading.
  const status = useMemo(() => {
    if (managedByParent) return 'ready';
    if (!serviceUserId) return 'ready';
    const current = result.userId === serviceUserId && result.attempt === attempt;
    return current ? (result.status === 'success' ? 'ready' : result.status) : 'loading';
  }, [managedByParent, serviceUserId, result, attempt]);

  const entries = useMemo(() => {
    if (managedByParent) return normalizeHighlights(highlights);
    if (status === 'ready' && serviceUserId) return normalizeHighlights(result.records);
    return [];
  }, [managedByParent, highlights, status, serviceUserId, result.records]);

  const handleOpen = useCallback((item) => {
    if (!item || !item.id) return;
    if (typeof onHighlightPress === 'function') onHighlightPress(item);
    else navigate(ROUTES.highlight(item.id));
  }, [navigate, onHighlightPress]);

  const handleAdd = useCallback(() => {
    if (typeof onAddHighlight === 'function') onAddHighlight();
    else navigate(ROUTES.create);
  }, [navigate, onAddHighlight]);

  const handleHeaderAction = useCallback(() => {
    navigate(isOwner ? ROUTES.manage : ROUTES.viewAll);
  }, [navigate, isOwner]);

  const handleRetry = useCallback(() => setAttempt((n) => n + 1), []);

  const isLoading = status === 'loading';
  const isError = status === 'error';
  const isEmpty = !isLoading && !isError && entries.length === 0;

  // Visitors never see an empty or still-loading strip.
  if (!isOwner && (isEmpty || isLoading)) return null;

  let body;
  if (isLoading) {
    body = <SkeletonRow />;
  } else if (isError) {
    body = (
      <div className="phl-note" role="alert">
        <p data-tone="error">Couldn’t load highlights.</p>
        <button type="button" className="phl-retry" onClick={handleRetry}>
          <RefreshCw aria-hidden="true" />
          <span>Retry</span>
        </button>
      </div>
    );
  } else if (isEmpty) {
    body = (
      <ul className="phl-rail">
        <li className="phl-cell"><AddTile onAdd={handleAdd} /></li>
        <li className="phl-cell" style={{ alignSelf: 'center', minWidth: 0 }}>
          <div className="phl-note">
            <p>No highlights yet. Create one to pin your best Vibes.</p>
          </div>
        </li>
      </ul>
    );
  } else {
    body = (
      <ul className="phl-rail">
        {isOwner && <li className="phl-cell"><AddTile onAdd={handleAdd} /></li>}
        {entries.map((entry) => (
          <li key={entry.key} className="phl-cell">
            <HighlightTile entry={entry} onOpen={handleOpen} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      aria-busy={isLoading || undefined}
      className={cn('phl')}
      data-theme={isDark ? 'dark' : 'light'}
      style={{ '--phl-brand': BRAND_GRADIENT }}
    >
      <style>{CSS}</style>
      <div className="phl-glass">
        <div className="phl-head">
          <h2 id={headingId} className="phl-title">Highlights</h2>
          <button type="button" className="phl-action" onClick={handleHeaderAction}>
            <span>{isOwner ? 'Manage' : 'View all'}</span>
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
        {body}
      </div>
    </section>
  );
});

ProfileHighlightsSection.displayName = 'ProfileHighlightsSection';

export default ProfileHighlightsSection;