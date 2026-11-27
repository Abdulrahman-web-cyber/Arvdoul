// src/screens/CreatePost/postPublishPipeline.js
import DOMPurify from 'dompurify';
import { v4 as uuidv4 } from 'uuid';
import { LOCAL_POSTS_KEY } from '../../utils/localContentCache.js';
import { pickDisplayName, deriveHandle } from '../../services/profileReadModel.js';
import {
  uploadComposerMedia,
  uploadAudioCoverIfNeeded,
} from './postMediaPipeline.js';
import { evaluateContentSafety } from '../../utils/contentSafety.js';

function buildControlMetadata(current = {}) {
  const commercial = current.commercialSettings || {};
  const safety = current.safetyAccessibility || {};
  const engagement = current.engagementControls || {};
  const lifecycle = current.lifecycleSettings || {};
  const disclosureType = commercial.disclosureType || 'none';

  return {
    identityMeta: {
      publishAs: current.identityMeta?.publishAs || 'personal',
      collaborators: Array.isArray(current.identityMeta?.collaborators)
        ? current.identityMeta.collaborators.slice(0, 10)
        : [],
      communityDestinationId: current.identityMeta?.communityDestinationId || null,
    },
    distributionSettings: {
      allowDiscovery: current.distributionSettings?.allowDiscovery !== false,
      allowReposts: current.distributionSettings?.allowReposts !== false,
      allowRemixes: current.distributionSettings?.allowRemixes !== false,
      allowDownloads: current.distributionSettings?.allowDownloads !== false,
      category: String(current.distributionSettings?.category || 'general').slice(0, 60),
      mentions: Array.isArray(current.distributionSettings?.mentions)
        ? current.distributionSettings.mentions.slice(0, 20)
        : [],
    },
    engagementControls: {
      enableComments: engagement.commentMode === 'off' ? false : engagement.enableComments !== false,
      commentMode: engagement.commentMode || 'everyone',
      enableReactions: engagement.enableReactions !== false,
      enableGifts: engagement.enableGifts !== false,
      enableSaves: engagement.enableSaves !== false,
      enableShares: engagement.enableShares !== false,
    },
    commercialDisclosure: {
      type: disclosureType,
      isPromotional: disclosureType !== 'none',
      isPaidPartnership: disclosureType === 'paid_partnership',
      isSponsoredAd: disclosureType === 'sponsored_ad',
      affiliateLinkId: commercial.affiliateLinkId || null,
      affiliateUrl: String(commercial.affiliateUrl || '').slice(0, 500),
      affiliateLabel: String(commercial.affiliateLabel || '').slice(0, 120),
      promoCode: String(commercial.promoCode || '').slice(0, 40),
      productTag: String(commercial.productTag || '').slice(0, 120),
      ctaLabel: String(commercial.ctaLabel || 'Learn More').slice(0, 40),
      ctaUrl: String(commercial.ctaUrl || '').slice(0, 500),
      regionalStandard: safety.regionalStandard || 'global',
    },
    partnership:
      disclosureType === 'paid_partnership' || commercial.brandPartnerId || commercial.brandPartnerName
        ? {
            brandPartnerId: commercial.brandPartnerId || null,
            brandPartnerName: String(commercial.brandPartnerName || '').slice(0, 120),
            brandPartnerHandle: String(commercial.brandPartnerHandle || '').slice(0, 60),
            partnershipId: commercial.partnershipId || null,
            adAuthorizationId: commercial.adAuthorizationId || null,
            adAuthorizationCode: commercial.adAuthorizationCode || '',
            allowPartnerPromotion: Boolean(commercial.allowPartnerPromotion),
          }
        : null,
    creatorPrograms: {
      enableGiftsForPost: current.creatorPrograms?.enableGiftsForPost !== false,
      enableAdRevenueShare: Boolean(current.creatorPrograms?.enableAdRevenueShare),
      enableAffiliateTracking: Boolean(current.creatorPrograms?.enableAffiliateTracking),
      enableSponsorshipAttribution: Boolean(current.creatorPrograms?.enableSponsorshipAttribution),
    },
    safetyAccessibility: {
      contentWarning: String(safety.contentWarning || '').slice(0, 200),
      isSensitiveMedia: Boolean(safety.isSensitiveMedia),
      ageRating: safety.ageRating || 'all',
      regionalStandard: safety.regionalStandard || 'global',
      copyrightConfirmed: safety.copyrightConfirmed !== false,
      captionsText: String(safety.captionsText || '').slice(0, 2000),
      transcriptText: String(safety.transcriptText || '').slice(0, 4000),
      language: String(safety.language || 'en').slice(0, 12),
      allowAutoTranslation: safety.allowAutoTranslation !== false,
    },
    lifecycleSettings: {
      timezone: String(lifecycle.timezone || 'UTC').slice(0, 80),
      expiresAt: lifecycle.expiresAt || null,
      notifyFollowers: lifecycle.notifyFollowers !== false,
      priorityAlert: Boolean(lifecycle.priorityAlert),
    },
    enableComments: engagement.commentMode === 'off' ? false : engagement.enableComments !== false,
    enableGifts: engagement.enableGifts !== false && current.creatorPrograms?.enableGiftsForPost !== false,
    expiresAt: lifecycle.expiresAt || null,
  };
}

export function extractMergedHashtags(text, explicitHashtags = []) {
  const fromText =
    typeof text === 'string'
      ? (text.match(/#([A-Za-z0-9_]+)/g) || []).map((t) => t.slice(1).toLowerCase())
      : [];
  const fromState = Array.isArray(explicitHashtags)
    ? explicitHashtags
        .filter((t) => typeof t === 'string' && t.trim())
        .map((t) => t.replace(/^#/, '').trim().toLowerCase())
    : [];
  return Array.from(new Set([...fromState, ...fromText])).slice(0, 30);
}

export function extractSanitizedContent(content, contentJSON) {
  const rawContent = typeof content === 'string' ? content : '';
  const sanitizeFn = typeof DOMPurify?.sanitize === 'function' ? DOMPurify.sanitize.bind(DOMPurify) : null;
  const sanitizedContent = sanitizeFn
    ? sanitizeFn(rawContent, { ALLOWED_TAGS: [] })
    : rawContent.replace(/<[^>]+>/g, '');

  let sanitizedJSON = null;
  let jsonExtractedText = '';
  if (contentJSON) {
    if (typeof contentJSON === 'string') {
      sanitizedJSON = sanitizeFn
        ? sanitizeFn(contentJSON, {
            ALLOWED_TAGS: [
              'p', 'br', 'strong', 'em', 'u', 's',
              'blockquote', 'ul', 'ol', 'li', 'a',
              'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            ],
          })
        : contentJSON;
      jsonExtractedText = sanitizedJSON.replace(/<[^>]+>/g, '').trim();
    } else if (typeof contentJSON === 'object') {
      sanitizedJSON = contentJSON;
      const walk = (node) => {
        if (!node) return '';
        if (typeof node.text === 'string') return node.text;
        if (Array.isArray(node.content)) return node.content.map(walk).join(' ');
        return '';
      };
      jsonExtractedText = walk(contentJSON).trim();
    }
  }

  const effectiveText = sanitizedContent.trim() || jsonExtractedText || rawContent.trim();
  return { effectiveText, sanitizedContent, sanitizedJSON };
}

export async function resolveLiveAuthenticatedAuthor(userSnapshot) {
  const { getAuthService } = await import('../../services/authService.js');
  const liveUser = getAuthService().getCurrentUser();
  if (!liveUser?.uid) {
    throw new Error('You must be signed in to publish. Please sign in and try again.');
  }
  if (userSnapshot?.uid && userSnapshot.uid !== liveUser.uid) {
    throw new Error('Your active account changed. Please reload the composer before publishing.');
  }
  return {
    uid: liveUser.uid,
    displayName: userSnapshot?.displayName || liveUser.displayName || '',
    name: userSnapshot?.name || '',
    username: userSnapshot?.username || '',
    email: userSnapshot?.email || liveUser.email || '',
    photoURL: userSnapshot?.photoURL || liveUser.photoURL || '',
    photo: userSnapshot?.photo || '',
  };
}

export async function executePostPublish({
  current,
  communityId,
  userSnapshot,
  services,
  isOffline,
  isOfflineReplay = false,
  onMediaItemProgress,
  onMediaBatchProgress,
  onDeleteDraft,
  onEnqueueOffline,
}) {
  const userNow = await resolveLiveAuthenticatedAuthor(userSnapshot);

  if (!current?.postType) {
    throw new Error('Please select a post type.');
  }

  const { effectiveText, sanitizedContent, sanitizedJSON } = extractSanitizedContent(
    current.content,
    current.contentJSON
  );

  const editPostId = current.editPostId || null;

  let effectiveType = current.postType;
  const mediaCount = current.mediaItems?.length || 0;
  if ((effectiveType === 'image' || effectiveType === 'video') && mediaCount === 0 && effectiveText) {
    effectiveType = 'text';
  } else if (effectiveType === 'text' && !effectiveText && mediaCount > 0) {
    effectiveType = current.mediaItems.some(
      (m) => m.type?.startsWith('video') || m.file?.type?.startsWith('video')
    )
      ? 'video'
      : 'image';
  }

  if (effectiveType === 'text' && !effectiveText && mediaCount === 0) {
    throw new Error('Please add some text or media to your post.');
  }
  if (effectiveType === 'image' && mediaCount === 0 && !effectiveText) {
    throw new Error('Please add an image or caption.');
  }
  if (effectiveType === 'video' && mediaCount === 0 && !effectiveText) {
    throw new Error('Please add a video or caption.');
  }
  if (effectiveType === 'question' && !effectiveText) {
    throw new Error('Please enter your question before publishing.');
  }
  if (effectiveType === 'audio') {
    const hasAudioTrack = Boolean(
      current.typeData?.audio?.file ||
      current.typeData?.audio?.url ||
      mediaCount > 0
    );
    if (!hasAudioTrack) {
      throw new Error('Please upload or record an audio track before publishing.');
    }
  }
  if (effectiveType === 'poll') {
    if (!effectiveText) {
      throw new Error('Please enter your poll question before publishing.');
    }
    const cleanPollOptions = (current.typeData?.poll?.options || [])
      .map((o) => (typeof o === 'string' ? o.trim() : ''))
      .filter(Boolean);
    if (cleanPollOptions.length < 2) {
      throw new Error('Please add at least 2 poll options.');
    }
    const normalizedOptions = cleanPollOptions.map((o) =>
      o.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
    );
    if (new Set(normalizedOptions).size !== normalizedOptions.length) {
      throw new Error('Poll options must be unique.');
    }
    if (current.pollClosesAt && new Date(current.pollClosesAt) <= new Date()) {
      throw new Error('Poll closing time must be in the future.');
    }
  }
  if (
    effectiveType === 'event' &&
    (!current.typeData?.event?.date || new Date(current.typeData.event.date) <= new Date())
  ) {
    throw new Error('Event date must be in the future.');
  }
  if (
    effectiveType === 'link' &&
    (!current.typeData?.link?.url ||
      (!current.typeData.link.url.startsWith('https://') &&
        !current.typeData.link.url.startsWith('http://')))
  ) {
    throw new Error('Please enter a valid URL (e.g. https://example.com).');
  }

  // Enforce Step 3 compliance & partnership settings before any publish
  if (current.safetyAccessibility?.copyrightConfirmed === false) {
    throw new Error('Please confirm copyright and usage rights in Post Settings before publishing.');
  }
  if (
    current.commercialSettings?.disclosureType === 'paid_partnership' &&
    !String(current.commercialSettings?.brandPartnerName || '').trim() &&
    !current.commercialSettings?.brandPartnerId
  ) {
    throw new Error('Please tag a brand partner for your paid partnership post.');
  }

  const safetyCheck = evaluateContentSafety({
    text: effectiveText,
    title: current.typeData?.link?.title || current.typeData?.event?.title || current.typeData?.audio?.title || '',
    description: current.typeData?.event?.description || current.typeData?.link?.description || '',
    hashtags: current.hashtags || [],
    mediaNames: (current.mediaItems || []).map((m) => m?.file?.name || m?.name || ''),
    extraFields: [
      current.typeData?.poll?.question,
      current.typeData?.poll?.options,
      current.typeData?.link?.url,
      current.commercialSettings?.affiliateLabel,
      current.commercialSettings?.productTag,
      current.safetyAccessibility?.contentWarning,
    ],
  });
  if (!safetyCheck.allowed) {
    throw new Error(safetyCheck.reason);
  }

  // Offline handling before attempting network writes
  if (isOffline) {
    if (isOfflineReplay || editPostId) {
      throw new Error('You appear to be offline.');
    }
    const clientPostId = current.clientPostId || `post_${userNow.uid}_${uuidv4()}`;
    await onEnqueueOffline?.({ ...current, clientPostId });
    if (current.draftId) {
      await onDeleteDraft?.(current.draftId).catch((e) => {
        console.warn('[postPublishPipeline] Draft cleanup after queue failed:', e?.message);
      });
    }
    return { status: 'queued', postId: clientPostId, isScheduled: false, communityId };
  }

  // Edit existing post flow
  if (editPostId) {
    const { getFirestoreService } = await import('../../services/firestoreService.js');
    const firestoreService = services?.firestore || getFirestoreService();
    const uploadedMedia = await uploadComposerMedia(current.mediaItems || [], {
      uid: userNow.uid,
      storageService: services?.storage,
      onItemProgress: onMediaItemProgress,
      onBatchProgress: onMediaBatchProgress,
    });
    const uploadedAudioCover =
      effectiveType === 'audio'
        ? await uploadAudioCoverIfNeeded(current.typeData?.audio, {
            uid: userNow.uid,
            storageService: services?.storage,
          })
        : '';

    const controlMeta = buildControlMetadata(current);
    const updatePayload = {
      type: effectiveType,
      content: effectiveText,
      contentJSON: sanitizedJSON,
      media: uploadedMedia,
      mediaUrl: uploadedMedia[0]?.url || '',
      videoUrl: uploadedMedia.find((m) => m.type === 'video')?.url || '',
      thumbnailUrl: uploadedMedia[0]?.thumbnail || uploadedMedia[0]?.url || '',
      visibility: current.visibility || 'public',
      hashtags: extractMergedHashtags(effectiveText, current.hashtags),
      location: current.location || null,
      scheduledTime: current.scheduledTime || null,
      ...controlMeta,
    };

    if (effectiveType === 'poll') {
      updatePayload.poll = {
        question: effectiveText,
        options: (current.typeData?.poll?.options || []).filter((o) => o && o.trim()),
        allowMultiple: !!current.typeData?.poll?.allowMultiple,
        closesAt: current.pollClosesAt || null,
      };
    } else if (effectiveType === 'question') {
      updatePayload['question.text'] = effectiveText;
    } else if (effectiveType === 'event') {
      const existingEventId = current.typeData?.event?.id || null;
      if (existingEventId) {
        try {
          const { getEventService } = await import('../../services/eventService.js');
          const eventService = services?.event || getEventService();
          await eventService.updateEvent(
            existingEventId,
            {
              title: effectiveText,
              description: current.typeData?.event?.description || '',
              coverImage: current.typeData?.event?.coverImage || '',
              startDate: current.typeData?.event?.date ? new Date(current.typeData.event.date) : null,
              location: current.typeData?.event?.location || '',
              locationLat: current.typeData?.event?.locationData?.lat ?? null,
              locationLng: current.typeData?.event?.locationData?.lng ?? null,
              timezone: current.typeData?.event?.timezone || 'UTC',
              capacity: current.typeData?.event?.capacity ?? 0,
            },
            userNow.uid
          );
        } catch (eventSyncErr) {
          console.warn('[postPublishPipeline] Linked event sync skipped:', eventSyncErr?.message);
        }
      }
      updatePayload.event = {
        id: existingEventId,
        title: effectiveText,
        date: current.typeData?.event?.date,
        location: current.typeData?.event?.location || '',
        locationData: current.typeData?.event?.locationData || null,
        description: current.typeData?.event?.description || '',
        coverImage: current.typeData?.event?.coverImage || '',
        rsvpEnabled: current.typeData?.event?.rsvpEnabled !== false,
        capacity: current.typeData?.event?.capacity ?? null,
        timezone: current.typeData?.event?.timezone || null,
      };
    } else if (effectiveType === 'link') {
      const rawLink = current.typeData?.link || {};
      const linkMeta = rawLink.metadata || null;
      updatePayload.link = {
        url: rawLink.url || '',
        title: rawLink.title || linkMeta?.title || effectiveText,
        description: rawLink.description || linkMeta?.description || '',
        image: rawLink.image || rawLink.thumbnail || linkMeta?.image || '',
        thumbnail: rawLink.thumbnail || rawLink.image || linkMeta?.image || '',
        domain: rawLink.domain || linkMeta?.domain || '',
        metadata: linkMeta,
      };
    } else if (effectiveType === 'audio') {
      updatePayload.audio = {
        url: uploadedMedia.find((m) => m.type === 'audio')?.url || current.typeData?.audio?.url || '',
        duration: current.typeData?.audio?.duration || 0,
        title: current.typeData?.audio?.title || effectiveText,
        artist: current.typeData?.audio?.artist || '',
        genre: current.typeData?.audio?.genre || '',
        coverUrl: uploadedAudioCover || '',
        sourceSoundId: current.typeData?.audio?.sourceSoundId || null,
      };
    }

    await firestoreService.updatePost(editPostId, updatePayload);
    if (current.draftId) {
      await onDeleteDraft?.(current.draftId).catch((e) => {
        console.warn('[postPublishPipeline] Draft cleanup after edit failed:', e?.message);
      });
    }
    return { status: 'updated', postId: editPostId, isScheduled: false, communityId };
  }

  // New post publish flow with deterministic clientPostId for idempotency
  const clientPostId = current.clientPostId || `post_${userNow.uid}_${uuidv4()}`;
  const isScheduled = Boolean(
    current.scheduledTime && new Date(current.scheduledTime) > new Date()
  );

  try {
    const firstVideoItem =
      effectiveType === 'video'
        ? (current.mediaItems || []).find(
            (m) => m.type === 'video' || m.file?.type?.startsWith('video/')
          ) || current.mediaItems?.[0]
        : null;
    const hasPreHostedVideoUrl = Boolean(
      (typeof firstVideoItem?.url === 'string' &&
        (firstVideoItem.url.startsWith('https://') || firstVideoItem.url.startsWith('http://'))) ||
        (typeof current.typeData?.video?.url === 'string' &&
          (current.typeData.video.url.startsWith('https://') ||
            current.typeData.video.url.startsWith('http://')))
    );
    const shouldUseMuxSparkUpload =
      effectiveType === 'video' &&
      !isScheduled &&
      !communityId &&
      !hasPreHostedVideoUrl &&
      Boolean(firstVideoItem?.file || firstVideoItem?.preview || current.typeData?.video?.file);

    let result = null;
    let finalPostData = null;

    if (shouldUseMuxSparkUpload) {
      const { mediaUrlToFile } = await import('./postMediaPipeline.js');
      const { default: videoService } = await import('../../services/videoService.js');

      let videoFile = firstVideoItem?.file || current.typeData?.video?.file || null;
      if (!videoFile && firstVideoItem?.preview) {
        videoFile = await mediaUrlToFile(
          firstVideoItem.preview,
          firstVideoItem.name || `spark_${Date.now()}.mp4`,
          'video/mp4'
        );
      }
      if (!videoFile) {
        throw new Error('Could not read the selected video file for upload.');
      }

      let thumbnailFile = firstVideoItem?.thumbnailFile || null;
      if (
        !thumbnailFile &&
        typeof firstVideoItem?.thumbnailUrl === 'string' &&
        (firstVideoItem.thumbnailUrl.startsWith('blob:') ||
          firstVideoItem.thumbnailUrl.startsWith('data:'))
      ) {
        thumbnailFile = await mediaUrlToFile(
          firstVideoItem.thumbnailUrl,
          `spark_thumb_${Date.now()}.jpg`,
          'image/jpeg'
        ).catch(() => null);
      }

      const mergedTags = extractMergedHashtags(effectiveText, current.hashtags);
      const sparkSubType = current.typeData?.video?.subType || 'spark';
      const sparkDuration =
        Number(firstVideoItem?.duration || current.typeData?.video?.duration || 0) || null;
      const controlMeta = buildControlMetadata(current);

      const uploadRes = await videoService.uploadVideo(
        videoFile,
        {
          title: (effectiveText || firstVideoItem?.name || 'Untitled Spark').slice(0, 140),
          description: effectiveText || sanitizedContent || '',
          content: effectiveText || sanitizedContent || '',
          tags: mergedTags,
          hashtags: mergedTags,
          visibility: current.visibility || 'public',
          subType: sparkSubType,
          type: sparkSubType === 'reel' ? 'reel' : 'video',
          duration: sparkDuration,
          allowDownload:
            controlMeta.distributionSettings?.allowDownloads !== false &&
            (current.typeData?.video?.allowDownload ?? true),
          duetEnabled:
            controlMeta.distributionSettings?.allowRemixes !== false &&
            (current.typeData?.video?.duetEnabled ?? true),
          stitchEnabled:
            controlMeta.distributionSettings?.allowRemixes !== false &&
            (current.typeData?.video?.stitchEnabled ?? true),
          chapters: Array.isArray(current.typeData?.video?.chapters)
            ? current.typeData.video.chapters
            : [],
          thumbnailFile,
          location: current.location || null,
          ...controlMeta,
        },
        {
          onProgress: (fraction) => {
            const pct = Math.min(100, Math.round((Number(fraction) || 0) * 100));
            if (firstVideoItem?.id) onMediaItemProgress?.(firstVideoItem.id, pct);
            onMediaBatchProgress?.(pct);
          },
        }
      );

      if (uploadRes?.postId || uploadRes?.videoId) {
        const canonicalId = uploadRes.postId || uploadRes.videoId;
        result = { postId: canonicalId };
        finalPostData = {
          id: canonicalId,
          clientPostId,
          type: 'video',
          subType: sparkSubType,
          content: effectiveText || sanitizedContent,
          contentJSON: sanitizedJSON,
          media: [],
          mediaUrl: '',
          videoUrl: uploadRes.playbackId
            ? `https://stream.mux.com/${uploadRes.playbackId}.m3u8`
            : firstVideoItem?.preview || '',
          muxPlaybackId: uploadRes.playbackId || null,
          processingState: uploadRes.processingState || 'UPLOAD_RESERVED',
          thumbnailUrl: uploadRes.thumbnailUrl || firstVideoItem?.thumbnailUrl || '',
          authorId: userNow.uid,
          authorName: pickDisplayName([userNow.displayName, userNow.name, userNow.username]),
          authorUsername: deriveHandle(userNow.username) || deriveHandle(userNow.email) || '',
          authorPhoto: userNow.photoURL || userNow.photo || '',
          visibility: current.visibility || 'public',
          communityId: null,
          location: current.location || null,
          hashtags: mergedTags,
          scheduledTime: null,
          ...controlMeta,
          video: {
            url: '',
            duration: sparkDuration || 0,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          likesCount: 0,
          commentsCount: 0,
          sharesCount: 0,
          viewsCount: 0,
          stats: { likes: 0, comments: 0, shares: 0, saves: 0, views: 0 },
        };
      }
    } else {
      const uploadedMedia = await uploadComposerMedia(current.mediaItems || [], {
        uid: userNow.uid,
        storageService: services?.storage,
        onItemProgress: onMediaItemProgress,
        onBatchProgress: onMediaBatchProgress,
      });

      const uploadedAudioCover =
        effectiveType === 'audio'
          ? await uploadAudioCoverIfNeeded(current.typeData?.audio, {
              uid: userNow.uid,
              storageService: services?.storage,
            })
          : '';

      const audioMediaUrl = uploadedMedia.find((m) => m.type === 'audio')?.url || '';
      const existingAudioUrl =
        typeof current.typeData?.audio?.url === 'string' &&
        current.typeData.audio.url.startsWith('http')
          ? current.typeData.audio.url
          : '';

      const finalAudioUrl = audioMediaUrl || existingAudioUrl;
      if (effectiveType === 'audio' && !finalAudioUrl) {
        throw new Error('Please attach or upload an audio track before publishing.');
      }

      const firstMedia = uploadedMedia[0] || null;
      const videoMedia = uploadedMedia.find((m) => m.type === 'video') || null;
      const rawVideoUrl =
        videoMedia?.url ||
        (typeof current.typeData?.video?.url === 'string' &&
        current.typeData.video.url.startsWith('http')
          ? current.typeData.video.url
          : '');

      let linkedEventId = current.typeData?.event?.id || null;
      if (effectiveType === 'event' && !isScheduled && !linkedEventId) {
        try {
          const { getEventService } = await import('../../services/eventService.js');
          const eventService = services?.event || getEventService();
          const createdEvent = await eventService.createEvent(userNow.uid, {
            title: effectiveText || 'Untitled Event',
            description: current.typeData?.event?.description || '',
            coverImage: current.typeData?.event?.coverImage || uploadedMedia[0]?.url || '',
            startDate: current.typeData?.event?.date ? new Date(current.typeData.event.date) : null,
            timezone: current.typeData?.event?.timezone || 'UTC',
            location: current.typeData?.event?.location || '',
            locationLat: current.typeData?.event?.locationData?.lat ?? null,
            locationLng: current.typeData?.event?.locationData?.lng ?? null,
            type: current.typeData?.event?.location ? 'physical' : 'digital',
            capacity: current.typeData?.event?.capacity ?? 0,
            communityId: communityId || null,
          });
          if (createdEvent?.id) {
            linkedEventId = createdEvent.id;
            await eventService.publishEvent(createdEvent.id, userNow.uid).catch(() => {});
          }
        } catch (eventCreateErr) {
          console.warn('[postPublishPipeline] Linked event creation skipped:', eventCreateErr?.message);
        }
      }

      const rawLink = current.typeData?.link || {};
      const linkMeta = rawLink.metadata || null;
      const controlMeta = buildControlMetadata(current);
      finalPostData = {
        id: clientPostId,
        clientPostId,
        type: effectiveType,
        ...(effectiveType === 'video'
          ? { subType: current.typeData?.video?.subType || 'spark' }
          : {}),
        content: effectiveText || sanitizedContent,
        contentJSON: sanitizedJSON,
        media: uploadedMedia,
        mediaUrl: firstMedia?.url || '',
        videoUrl: rawVideoUrl,
        thumbnailUrl: firstMedia?.thumbnail || firstMedia?.url || uploadedAudioCover || '',
        authorId: userNow.uid,
        authorName: pickDisplayName([userNow.displayName, userNow.name, userNow.username]),
        authorUsername: deriveHandle(userNow.username) || deriveHandle(userNow.email) || '',
        authorPhoto: userNow.photoURL || userNow.photo || '',
        visibility: communityId ? 'community' : current.visibility || 'public',
        communityId: communityId || null,
        location: current.location || null,
        hashtags: extractMergedHashtags(effectiveText, current.hashtags),
        scheduledTime: current.scheduledTime || null,
        ...controlMeta,
        poll:
          effectiveType === 'poll'
            ? {
                question: effectiveText,
                options: (current.typeData?.poll?.options || []).filter((o) => o && o.trim()),
                allowMultiple: !!current.typeData?.poll?.allowMultiple,
                closesAt: current.pollClosesAt || null,
              }
            : null,
        event:
          effectiveType === 'event'
            ? {
                id: linkedEventId,
                title: effectiveText,
                date: current.typeData?.event?.date,
                location: current.typeData?.event?.location || '',
                locationData: current.typeData?.event?.locationData || null,
                description: current.typeData?.event?.description || '',
                coverImage: current.typeData?.event?.coverImage || uploadedMedia[0]?.url || '',
                rsvpEnabled: current.typeData?.event?.rsvpEnabled !== false,
                capacity: current.typeData?.event?.capacity ?? null,
                timezone: current.typeData?.event?.timezone || null,
              }
            : null,
        link:
          effectiveType === 'link'
            ? {
                url: rawLink.url || '',
                title: rawLink.title || linkMeta?.title || effectiveText,
                description: rawLink.description || linkMeta?.description || '',
                image: rawLink.image || rawLink.thumbnail || linkMeta?.image || '',
                thumbnail: rawLink.thumbnail || rawLink.image || linkMeta?.image || '',
                domain: rawLink.domain || linkMeta?.domain || '',
                metadata: linkMeta,
              }
            : null,
        question:
          effectiveType === 'question'
            ? { text: effectiveText, bounty: 0, closed: false, answers: [] }
            : null,
        audio:
          effectiveType === 'audio'
            ? {
                url: finalAudioUrl,
                duration: current.typeData?.audio?.duration || 0,
                title: current.typeData?.audio?.title || effectiveText,
                artist: current.typeData?.audio?.artist || '',
                genre: current.typeData?.audio?.genre || '',
                coverUrl: uploadedAudioCover || '',
                sourceSoundId: current.typeData?.audio?.sourceSoundId || null,
              }
            : null,
        video:
          effectiveType === 'video'
            ? {
                url: rawVideoUrl,
                duration: videoMedia?.duration || current.typeData?.video?.duration || 0,
              }
            : null,
        createdAt: new Date(),
        updatedAt: new Date(),
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        viewsCount: 0,
        stats: { likes: 0, comments: 0, shares: 0, saves: 0, views: 0 },
      };

      if (communityId) {
        const { getCommunityService } = await import('../../services/communityService.js');
        const communityService = services?.community || getCommunityService();
        const communityPost = await communityService.createCommunityPost(
          communityId,
          userNow.uid,
          finalPostData
        );
        result = communityPost?.id ? { postId: communityPost.id } : null;
      } else {
        const { getFirestoreService } = await import('../../services/firestoreService.js');
        const firestoreService = services?.firestore || getFirestoreService();
        result = await firestoreService.createPost(finalPostData);
      }
    }

    if (!result?.postId) {
      throw new Error('The post could not be saved.');
    }

    const confirmedPost = {
      ...finalPostData,
      id: result.postId,
      isOptimistic: false,
    };

    // Only write to device-local feed cache & emit arvdoul:new_post_published AFTER
    // server confirmation succeeds and ONLY when the post is immediately live.
    if (!isScheduled && !communityId) {
      try {
        const localList = JSON.parse(localStorage.getItem(LOCAL_POSTS_KEY) || '[]');
        const updated = [
          confirmedPost,
          ...localList.filter((p) => p.id !== confirmedPost.id),
        ];
        localStorage.setItem(LOCAL_POSTS_KEY, JSON.stringify(updated.slice(0, 50)));
        window.dispatchEvent(
          new CustomEvent('arvdoul:new_post_published', { detail: confirmedPost })
        );
      } catch (cacheErr) {
        console.warn('[postPublishPipeline] Local post cache write note:', cacheErr?.message);
      }
    }

    if (current.draftId) {
      await onDeleteDraft?.(current.draftId).catch((e) => {
        console.warn('[postPublishPipeline] Draft cleanup after publish failed:', e?.message);
      });
    }

    try {
      const { getFeedService } = await import('../../services/feedService.js');
      const feedService = services?.feed || getFeedService();
      feedService.clearUserCache(userNow.uid);
    } catch (e) {
      console.warn('[postPublishPipeline] Feed cache clear failed:', e?.message);
    }

    let adAuthorizationCode = current.commercialSettings?.adAuthorizationCode || '';
    if (
      current.commercialSettings?.allowPartnerPromotion &&
      current.commercialSettings?.brandPartnerId &&
      !adAuthorizationCode &&
      result?.postId
    ) {
      try {
        const { default: collaborationService } = await import('../../services/collaborationService.js');
        const authRes = await collaborationService.grantAdAuthorization({
          postId: result.postId,
          partnerId: current.commercialSettings.brandPartnerId,
          partnerName: current.commercialSettings.brandPartnerName || 'Brand Partner',
          expiresInDays: 30,
        });
        if (authRes?.authCode) adAuthorizationCode = authRes.authCode;
      } catch (authErr) {
        console.warn('[postPublishPipeline] Post-publish ad authorization grant failed:', authErr?.message);
      }
    }

    let linkedCampaignId = null;
    let promotionError = null;
    if (current.promotionIntent?.enabled && !isScheduled && result?.postId) {
      try {
        const { default: advertisingService } = await import('../../services/advertisingService.js');
        const promo = current.promotionIntent;
        const kindMap = {
          boost_post: 'post',
          promote_profile: 'profile',
          promote_website: 'website',
          promote_product: 'product',
          promote_event: 'event',
          promote_spark_video: 'spark_video',
        };
        const placementMap = {
          home_feed: 'home',
          sparks_feed: 'sparks',
          search_discovery: 'search',
          community_feed: 'explore',
          stories_vibes: 'explore',
        };
        const resolvedKind =
          kindMap[promo.promotionKind] ||
          promo.promotionKind ||
          (effectiveType === 'video' ? 'spark_video' : 'post');
        const resolvedPlacements = Array.isArray(promo.placements) && promo.placements.length
          ? promo.placements.map((p) => placementMap[p] || p)
          : ['home'];

        const campaignRes = await advertisingService.createAdCampaign({
          title: `${(effectiveText || 'Post Promotion').slice(0, 48)} Campaign`,
          promotionKind: resolvedKind,
          objective: promo.objective || 'reach',
          sourcePostId: result.postId,
          placements: resolvedPlacements,
          targeting: {
            locations: promo.targetLocations || [],
            interests: promo.targetInterests || [],
            ageMin: Number(promo.targetAgeMin || 18),
          },
          budgetType: 'daily',
          budgetCents: Math.max(100, Number(promo.dailyBudgetCents || 1000)),
          currency: promo.currency || 'USD',
          durationDays: Number(promo.durationDays || 7),
          adAuthorizationCode,
          destinationUrl: current.commercialSettings?.ctaUrl || current.commercialSettings?.affiliateUrl || '',
          ctaLabel: current.commercialSettings?.ctaLabel || 'Learn More',
          disclosureType: current.commercialSettings?.disclosureType || 'sponsored_ad',
          complianceNotes: promo.complianceNotes || '',
          submitForReview: Boolean(promo.submitForReview),
        });
        linkedCampaignId = campaignRes?.campaignId || null;
      } catch (promoErr) {
        console.warn('[postPublishPipeline] Linked campaign draft creation failed:', promoErr?.message);
        promotionError = promoErr?.message || 'Could not create promotion campaign';
      }
    }

    return {
      status: isScheduled ? 'scheduled' : 'published',
      postId: result.postId,
      post: confirmedPost,
      isScheduled,
      communityId,
      linkedCampaignId,
      promotionError,
    };
  } catch (err) {
    // On transient network failure during live interactive publish, queue cleanly
    // with the deterministic clientPostId instead of silently fabricating success.
    const msg = String(err?.message || '').toLowerCase();
    const isNetworkIssue =
      !navigator.onLine ||
      msg.includes('network') ||
      msg.includes('unavailable') ||
      msg.includes('failed to fetch') ||
      err?.code === 'unavailable';

    if (!isOfflineReplay && isNetworkIssue && onEnqueueOffline) {
      try {
        await onEnqueueOffline({ ...current, clientPostId });
        if (current.draftId) {
          await onDeleteDraft?.(current.draftId).catch((e) => {
            console.warn('[postPublishPipeline] Draft cleanup after fallback queue failed:', e?.message);
          });
        }
        return {
          status: 'queued',
          postId: clientPostId,
          isScheduled,
          communityId,
        };
      } catch (queueErr) {
        console.warn('[postPublishPipeline] Fallback offline enqueue failed:', queueErr?.message);
      }
    }
    throw err;
  }
}
