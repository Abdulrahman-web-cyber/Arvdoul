// src/screens/CreatePost/postPublishPipeline.js
import DOMPurify from 'dompurify';
import { v4 as uuidv4 } from 'uuid';
import { LOCAL_POSTS_KEY } from '../../utils/localContentCache.js';
import { pickDisplayName, deriveHandle } from '../../services/profileReadModel.js';
import {
  uploadComposerMedia,
  uploadAudioCoverIfNeeded,
} from './postMediaPipeline.js';

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
  if (
    effectiveType === 'poll' &&
    (current.typeData?.poll?.options || []).filter((o) => o && o.trim()).length < 2
  ) {
    throw new Error('Please add at least 2 poll options.');
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
    };

    if (effectiveType === 'poll') {
      updatePayload.poll = {
        question: effectiveText,
        options: (current.typeData?.poll?.options || []).filter((o) => o && o.trim()),
        allowMultiple: !!current.typeData?.poll?.allowMultiple,
        closesAt: current.pollClosesAt || null,
      };
    } else if (effectiveType === 'event') {
      updatePayload.event = {
        title: effectiveText,
        date: current.typeData?.event?.date,
        location: current.typeData?.event?.location || '',
        locationData: current.typeData?.event?.locationData || null,
        description: current.typeData?.event?.description || '',
        coverImage: current.typeData?.event?.coverImage || '',
        rsvpEnabled: !!current.typeData?.event?.rsvpEnabled,
        capacity: current.typeData?.event?.capacity ?? null,
        timezone: current.typeData?.event?.timezone || null,
      };
    } else if (effectiveType === 'link') {
      updatePayload.link = {
        url: current.typeData?.link?.url || '',
        title: current.typeData?.link?.title || effectiveText,
        thumbnail: current.typeData?.link?.thumbnail || '',
        metadata: current.typeData?.link?.metadata || null,
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
          allowDownload: current.typeData?.video?.allowDownload ?? true,
          duetEnabled: current.typeData?.video?.duetEnabled ?? true,
          stitchEnabled: current.typeData?.video?.stitchEnabled ?? true,
          chapters: Array.isArray(current.typeData?.video?.chapters)
            ? current.typeData.video.chapters
            : [],
          thumbnailFile,
          location: current.location || null,
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
                title: effectiveText,
                date: current.typeData?.event?.date,
                location: current.typeData?.event?.location || '',
                locationData: current.typeData?.event?.locationData || null,
                description: current.typeData?.event?.description || '',
                coverImage: current.typeData?.event?.coverImage || '',
                rsvpEnabled: !!current.typeData?.event?.rsvpEnabled,
                capacity: current.typeData?.event?.capacity ?? null,
                timezone: current.typeData?.event?.timezone || null,
              }
            : null,
        link:
          effectiveType === 'link'
            ? {
                url: current.typeData?.link?.url || '',
                title: current.typeData?.link?.title || effectiveText,
                thumbnail: current.typeData?.link?.thumbnail || '',
                metadata: current.typeData?.link?.metadata || null,
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

    return {
      status: isScheduled ? 'scheduled' : 'published',
      postId: result.postId,
      post: confirmedPost,
      isScheduled,
      communityId,
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
