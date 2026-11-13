// src/hooks/useAuthorStanding.js
//
// Resolves the *author's* standing (verified / creator / premium) for a page of
// feed posts.
//
// `PostCard` read `post.authorLevel` (`>= 5` creator, `>= 8` premium) and
// `post.isVerified`, but no writer ever puts `authorLevel` or `isVerified` on a
// `posts/{id}` document — the standing lives on the author's `users/{uid}`
// profile. The reads were therefore always falsy: the creator/premium avatar
// rings, the verified badge, and the creator-gated "Send gift" affordance were
// permanently dead.
//
// This hook hydrates the distinct author uids in one bounded batch
// (`socialGraphService.hydrateProfiles`, 30 ids per `documentId() in` read, and
// already viewer-projected) and returns a per-author map keyed by uid. A missing
// or denied profile yields no entry, so the card renders no badge — never a
// fabricated one. Ids that already resolved are not re-read as the feed grows.

import { useEffect, useRef, useState } from 'react';
import { resolveCreatorFlag, resolveVerifiedFlag } from '../services/profileReadModel.js';

// Cap the ids hydrated in a single pass so a long-lived feed cannot grow the
// batch without bound; the newest page's authors win.
const MAX_IDS = 60;

export function useAuthorStanding(posts) {
  const [standing, setStanding] = useState({});
  const requestSeq = useRef(0);
  const resolvedRef = useRef(new Set());

  const authorIds = [];
  const seen = new Set();
  for (const post of posts || []) {
    const id = post?.authorId;
    if (!id || seen.has(id) || resolvedRef.current.has(id)) continue;
    seen.add(id);
    authorIds.push(id);
    if (authorIds.length >= MAX_IDS) break;
  }
  const key = authorIds.join(',');

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (ids.length === 0) return undefined;
    const seq = ++requestSeq.current;
    let cancelled = false;

    (async () => {
      try {
        const { getSocialGraphService } = await import('../services/socialGraphService.js');
        const profiles = await getSocialGraphService().hydrateProfiles(ids);
        if (cancelled || seq !== requestSeq.current) return;
        for (const id of ids) resolvedRef.current.add(id);
        setStanding((prev) => {
          const next = { ...prev };
          for (const profile of profiles || []) {
            if (!profile) continue;
            const uid = profile.uid || profile.id;
            if (!uid) continue;
            next[uid] = {
              isVerified: resolveVerifiedFlag(profile),
              isCreator: resolveCreatorFlag(profile, {}, profile.level ?? null),
              isPremium: Boolean(profile.isPremium || profile.subscription),
            };
          }
          return next;
        });
      } catch {
        // A failed hydrate leaves the standing unknown. The card then renders no
        // badge rather than inventing one, and the ids stay unresolved so the
        // next page re-attempts them.
      }
    })();

    return () => { cancelled = true; };
  }, [key]);

  return standing;
}

export default useAuthorStanding;
