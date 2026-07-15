// src/screens/CreatePost/timelineEngine.js - ARVDOUL Timeline Engine
// Core timeline model, track management, and clip operations

import { 
  TRACK_TYPES, 
  CLIP_COLORS, 
  generateVideoId, 
  clamp, 
  mapRange,
  TIMELINE_SETTINGS 
} from './videoConstants';

// ==================== TIMELINE MODEL ====================

/**
 * Create a new timeline instance
 */
export function createTimeline() {
  return {
    id: generateVideoId(),
    name: 'Untitled Project',
    duration: 0,
    fps: 30,
    resolution: { width: 1920, height: 1080 },
    aspectRatio: 16 / 9,
    tracks: [],
    markers: [],
    playhead: 0,
    zoom: TIMELINE_SETTINGS.DEFAULT_ZOOM,
    scrollX: 0,
    scrollY: 0,
    selectedClipIds: [],
    selectedTrackId: null,
    isPlaying: false,
    inPoint: null,
    outPoint: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Create a new track
 */
export function createTrack(type, options = {}) {
  return {
    id: generateVideoId(),
    type,
    name: options.name || getDefaultTrackName(type),
    clips: [],
    muted: false,
    solo: false,
    locked: false,
    visible: true,
    height: TIMELINE_SETTINGS.TRACK_HEIGHT,
    color: getTrackColor(type),
    volume: 100,
    pan: 0,
    ...options,
  };
}

/**
 * Get default track name based on type
 */
function getDefaultTrackName(type) {
  switch (type) {
    case TRACK_TYPES.VIDEO:
      return 'Video';
    case TRACK_TYPES.AUDIO:
      return 'Audio';
    case TRACK_TYPES.OVERLAY:
      return 'Overlay';
    case TRACK_TYPES.SUBTITLE:
      return 'Subtitles';
    case TRACK_TYPES.EFFECT:
      return 'Effects';
    default:
      return 'Track';
  }
}

/**
 * Get track color based on type
 */
function getTrackColor(type) {
  switch (type) {
    case TRACK_TYPES.VIDEO:
      return CLIP_COLORS[5]; // Blue
    case TRACK_TYPES.AUDIO:
      return CLIP_COLORS[3]; // Green
    case TRACK_TYPES.OVERLAY:
      return CLIP_COLORS[6]; // Purple
    case TRACK_TYPES.SUBTITLE:
      return CLIP_COLORS[2]; // Yellow
    case TRACK_TYPES.EFFECT:
      return CLIP_COLORS[7]; // Pink
    default:
      return CLIP_COLORS[0]; // Red
  }
}

// ==================== CLIP MODEL ====================

/**
 * Create a new clip
 */
export function createClip(source, options = {}) {
  const {
    startTime = 0,
    duration = source.duration || 5000,
    type = TRACK_TYPES.VIDEO,
  } = options;

  return {
    id: generateVideoId(),
    type,
    source: {
      id: source.id || generateVideoId(),
      file: source.file || null,
      url: source.url || null,
      name: source.name || 'Clip',
      duration: source.duration || duration,
      width: source.width || 1920,
      height: source.height || 1080,
      thumbnail: source.thumbnail || null,
    },
    // Timeline position
    startTime,
    duration,
    // Source trimming
    trimStart: 0,
    trimEnd: 0,
    // Playback
    playbackRate: 1,
    volume: 100,
    // Visual
    colorLabel: options.colorLabel || CLIP_COLORS[0].id,
    opacity: 100,
    // Transform
    transform: {
      x: 0,
      y: 0,
      scaleX: 100,
      scaleY: 100,
      rotation: 0,
    },
    // Effects
    adjustments: {},
    filter: 'none',
    filterIntensity: 100,
    effects: [],
    // Keyframes
    keyframes: {},
    // Audio
    fadeIn: 0,
    fadeOut: 0,
    pan: 0,
    // Transitions
    transitionIn: null,
    transitionOut: null,
    // Metadata
    name: source.name || 'Clip',
    locked: false,
    visible: true,
  };
}

/**
 * Create a video clip from file
 */
export function createVideoClip(file, options = {}) {
  const clip = createClip(
    {
      id: generateVideoId(),
      file,
      name: file.name,
      duration: 0, // Will be set after loading
      width: 1920,
      height: 1080,
    },
    { type: TRACK_TYPES.VIDEO, ...options }
  );

  return clip;
}

/**
 * Create an audio clip from file
 */
export function createAudioClip(file, options = {}) {
  const clip = createClip(
    {
      id: generateVideoId(),
      file,
      name: file.name,
      duration: 0,
    },
    { type: TRACK_TYPES.AUDIO, ...options }
  );

  return clip;
}

/**
 * Create a subtitle clip
 */
export function createSubtitleClip(text, startTime, endTime, options = {}) {
  return createClip(
    {
      id: generateVideoId(),
      name: text.substring(0, 20),
      duration: endTime - startTime,
      text,
    },
    {
      type: TRACK_TYPES.SUBTITLE,
      startTime,
      duration: endTime - startTime,
      ...options,
    }
  );
}

// ==================== CLIP OPERATIONS ====================

/**
 * Get clip end time
 */
export function getClipEndTime(clip) {
  return clip.startTime + clip.duration;
}

/**
 * Get clip source duration (untrimmed)
 */
export function getClipSourceDuration(clip) {
  return clip.source.duration;
}

/**
 * Get clip actual playback duration
 */
export function getClipPlaybackDuration(clip) {
  return clip.duration / clip.playbackRate;
}

/**
 * Move clip to new position
 */
export function moveClip(timeline, clipId, newStartTime) {
  const clip = findClip(timeline, clipId);
  if (!clip) return timeline;

  const minTime = 0;
  newStartTime = clamp(newStartTime, minTime, Infinity);

  return updateClip(timeline, clipId, { startTime: newStartTime });
}

/**
 * Trim clip from start
 */
export function trimClipStart(timeline, clipId, newStartTime, newTrimStart) {
  const clip = findClip(timeline, clipId);
  if (!clip) return timeline;

  const oldStartTime = clip.startTime;
  const oldTrimStart = clip.trimStart;
  const timeDelta = newStartTime - oldStartTime;
  const trimDelta = newTrimStart - oldTrimStart;

  // Calculate new values
  const maxTrimStart = getClipSourceDuration(clip) - clip.trimEnd - 100;
  const clampedTrimStart = clamp(newTrimStart, 0, maxTrimStart);
  const actualTimeDelta = trimDelta;

  return updateClip(timeline, clipId, {
    startTime: newStartTime,
    trimStart: clampedTrimStart,
    duration: clip.duration - actualTimeDelta,
  });
}

/**
 * Trim clip from end
 */
export function trimClipEnd(timeline, clipId, newEndTime) {
  const clip = findClip(timeline, clipId);
  if (!clip) return timeline;

  const minDuration = 100; // Minimum clip duration
  const maxEndTime = clip.startTime + getClipSourceDuration(clip) - clip.trimStart;
  const newDuration = clamp(newEndTime - clip.startTime, minDuration, maxEndTime - clip.startTime);

  return updateClip(timeline, clipId, {
    duration: newDuration,
    trimEnd: getClipSourceDuration(clip) - clip.trimStart - newDuration,
  });
}

/**
 * Split clip at time
 */
export function splitClip(timeline, clipId, splitTime) {
  const clip = findClip(timeline, clipId);
  if (!clip) return timeline;

  const clipStart = clip.startTime;
  const clipEnd = getClipEndTime(clip);

  if (splitTime <= clipStart || splitTime >= clipEnd) {
    return timeline; // Can't split outside clip bounds
  }

  // Calculate split point in source time
  const relativeTime = splitTime - clipStart;
  const sourceTime = clip.trimStart + (relativeTime * clip.playbackRate);

  // Create first clip (before split)
  const clip1 = {
    ...clip,
    id: clip.id,
    duration: relativeTime,
    trimEnd: clip.trimEnd + (getClipSourceDuration(clip) - sourceTime),
    transitionOut: null,
  };

  // Create second clip (after split)
  const clip2 = {
    ...clip,
    id: generateVideoId(),
    startTime: splitTime,
    duration: clip.duration - relativeTime,
    trimStart: sourceTime,
    transitionIn: null,
  };

  // Update timeline
  return updateClipInTrack(timeline, clip.trackId || findClipTrackId(timeline, clipId), clipId, clip1, clip2);
}

/**
 * Duplicate clip
 */
export function duplicateClip(timeline, clipId) {
  const clip = findClip(timeline, clipId);
  if (!clip) return timeline;

  const newClip = {
    ...clip,
    id: generateVideoId(),
    startTime: getClipEndTime(clip),
    name: `${clip.name} (copy)`,
    keyframes: JSON.parse(JSON.stringify(clip.keyframes)), // Deep clone
  };

  return addClipToTrack(timeline, clip.trackId || findClipTrackId(timeline, clipId), newClip);
}

/**
 * Delete clip
 */
export function deleteClip(timeline, clipId) {
  const trackId = findClipTrackId(timeline, clipId);
  if (!trackId) return timeline;

  return removeClipFromTrack(timeline, trackId, clipId);
}

/**
 * Set clip playback rate (speed)
 */
export function setClipSpeed(timeline, clipId, playbackRate) {
  const clip = findClip(timeline, clipId);
  if (!clip) return timeline;

  // Speed affects duration
  const sourceDuration = getClipSourceDuration(clip) - clip.trimStart - clip.trimEnd;
  const newDuration = sourceDuration / playbackRate;

  return updateClip(timeline, clipId, {
    playbackRate,
    duration: newDuration,
  });
}

/**
 * Set clip volume
 */
export function setClipVolume(timeline, clipId, volume) {
  return updateClip(timeline, clipId, { volume: clamp(volume, 0, 200) });
}

/**
 * Set clip opacity
 */
export function setClipOpacity(timeline, clipId, opacity) {
  return updateClip(timeline, clipId, { opacity: clamp(opacity, 0, 100) });
}

/**
 * Set clip color label
 */
export function setClipColor(timeline, clipId, colorId) {
  return updateClip(timeline, clipId, { colorLabel: colorId });
}

/**
 * Set clip transform
 */
export function setClipTransform(timeline, clipId, transform) {
  const clip = findClip(timeline, clipId);
  if (!clip) return timeline;

  return updateClip(timeline, clipId, {
    transform: { ...clip.transform, ...transform },
  });
}

/**
 * Set clip adjustments
 */
export function setClipAdjustments(timeline, clipId, adjustments) {
  const clip = findClip(timeline, clipId);
  if (!clip) return timeline;

  return updateClip(timeline, clipId, {
    adjustments: { ...clip.adjustments, ...adjustments },
  });
}

/**
 * Set clip filter
 */
export function setClipFilter(timeline, clipId, filter, intensity = 100) {
  return updateClip(timeline, clipId, {
    filter,
    filterIntensity: intensity,
  });
}

/**
 * Set clip fade
 */
export function setClipFade(timeline, clipId, fadeIn, fadeOut) {
  return updateClip(timeline, clipId, {
    fadeIn: fadeIn !== undefined ? fadeIn : undefined,
    fadeOut: fadeOut !== undefined ? fadeOut : undefined,
  });
}

/**
 * Set clip transition
 */
export function setClipTransition(timeline, clipId, transitionIn, transitionOut) {
  return updateClip(timeline, clipId, {
    transitionIn: transitionIn !== undefined ? transitionIn : undefined,
    transitionOut: transitionOut !== undefined ? transitionOut : undefined,
  });
}

// ==================== TRACK OPERATIONS ====================

/**
 * Add track to timeline
 */
export function addTrack(timeline, type, options = {}) {
  const newTrack = createTrack(type, options);

  return {
    ...timeline,
    tracks: [...timeline.tracks, newTrack],
    updatedAt: Date.now(),
  };
}

/**
 * Remove track from timeline
 */
export function removeTrack(timeline, trackId) {
  return {
    ...timeline,
    tracks: timeline.tracks.filter((t) => t.id !== trackId),
    updatedAt: Date.now(),
  };
}

/**
 * Update track
 */
export function updateTrack(timeline, trackId, updates) {
  return {
    ...timeline,
    tracks: timeline.tracks.map((t) =>
      t.id === trackId ? { ...t, ...updates } : t
    ),
    updatedAt: Date.now(),
  };
}

/**
 * Reorder tracks
 */
export function reorderTracks(timeline, trackId, newIndex) {
  const tracks = [...timeline.tracks];
  const oldIndex = tracks.findIndex((t) => t.id === trackId);

  if (oldIndex === -1) return timeline;

  const [track] = tracks.splice(oldIndex, 1);
  tracks.splice(newIndex, 0, track);

  return {
    ...timeline,
    tracks,
    updatedAt: Date.now(),
  };
}

/**
 * Move track up
 */
export function moveTrackUp(timeline, trackId) {
  const index = timeline.tracks.findIndex((t) => t.id === trackId);
  if (index <= 0) return timeline;

  return reorderTracks(timeline, trackId, index - 1);
}

/**
 * Move track down
 */
export function moveTrackDown(timeline, trackId) {
  const index = timeline.tracks.findIndex((t) => t.id === trackId);
  if (index === -1 || index >= timeline.tracks.length - 1) return timeline;

  return reorderTracks(timeline, trackId, index + 1);
}

/**
 * Add clip to track
 */
export function addClipToTrack(timeline, trackId, clip) {
  const updatedTracks = timeline.tracks.map((track) => {
    if (track.id !== trackId) return track;

    return {
      ...track,
      clips: [...track.clips, { ...clip, trackId }],
    };
  });

  // Update timeline duration
  const maxEndTime = calculateTimelineDuration({ ...timeline, tracks: updatedTracks });

  return {
    ...timeline,
    tracks: updatedTracks,
    duration: Math.max(timeline.duration, maxEndTime),
    updatedAt: Date.now(),
  };
}

/**
 * Remove clip from track
 */
export function removeClipFromTrack(timeline, trackId, clipId) {
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => {
      if (track.id !== trackId) return track;

      return {
        ...track,
        clips: track.clips.filter((c) => c.id !== clipId),
      };
    }),
    updatedAt: Date.now(),
  };
}

/**
 * Update clip in track
 */
export function updateClipInTrack(timeline, trackId, oldClipId, newClip1, newClip2 = null) {
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => {
      if (track.id !== trackId) return track;

      let clips = track.clips.filter((c) => c.id !== oldClipId);
      clips = [...clips, newClip1];
      if (newClip2) {
        clips = [...clips, newClip2];
      }

      return {
        ...track,
        clips,
      };
    }),
    updatedAt: Date.now(),
  };
}

// ==================== FIND & SEARCH ====================

/**
 * Find clip by ID
 */
export function findClip(timeline, clipId) {
  for (const track of timeline.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return clip;
  }
  return null;
}

/**
 * Find track by ID
 */
export function findTrack(timeline, trackId) {
  return timeline.tracks.find((t) => t.id === trackId);
}

/**
 * Find clip track ID
 */
export function findClipTrackId(timeline, clipId) {
  for (const track of timeline.tracks) {
    if (track.clips.some((c) => c.id === clipId)) {
      return track.id;
    }
  }
  return null;
}

/**
 * Find clips at time
 */
export function findClipsAtTime(timeline, time) {
  const clips = [];

  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      if (time >= clip.startTime && time < getClipEndTime(clip)) {
        clips.push({ ...clip, trackId: track.id });
      }
    }
  }

  return clips;
}

/**
 * Find clips in range
 */
export function findClipsInRange(timeline, startTime, endTime) {
  const clips = [];

  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      const clipEnd = getClipEndTime(clip);
      if (clip.startTime < endTime && clipEnd > startTime) {
        clips.push({ ...clip, trackId: track.id });
      }
    }
  }

  return clips;
}

// ==================== HELPERS ====================

/**
 * Calculate timeline duration based on clips
 */
export function calculateTimelineDuration(timeline) {
  let maxEnd = 0;

  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      const clipEnd = getClipEndTime(clip);
      if (clipEnd > maxEnd) {
        maxEnd = clipEnd;
      }
    }
  }

  return maxEnd;
}

/**
 * Update clip by ID
 */
export function updateClip(timeline, clipId, updates) {
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) =>
        clip.id === clipId ? { ...clip, ...updates } : clip
      ),
    })),
    updatedAt: Date.now(),
  };
}

/**
 * Snap time to grid
 */
export function snapToGrid(time, gridSize, threshold = TIMELINE_SETTINGS.SNAP_THRESHOLD) {
  const snappedTime = Math.round(time / gridSize) * gridSize;
  return Math.abs(time - snappedTime) < threshold ? snappedTime : time;
}

/**
 * Snap clip to other clips
 */
export function snapClipToClips(timeline, clipId, snapThreshold = TIMELINE_SETTINGS.SNAP_THRESHOLD) {
  const clip = findClip(timeline, clipId);
  if (!clip) return timeline;

  const clipStart = clip.startTime;
  const clipEnd = getClipEndTime(clip);
  let newStartTime = clipStart;

  for (const track of timeline.tracks) {
    for (const otherClip of track.clips) {
      if (otherClip.id === clipId) continue;

      const otherStart = otherClip.startTime;
      const otherEnd = getClipEndTime(otherClip);

      // Snap start to other end
      if (Math.abs(clipStart - otherEnd) < snapThreshold) {
        newStartTime = otherEnd;
      }

      // Snap end to other start
      if (Math.abs(clipEnd - otherStart) < snapThreshold) {
        newStartTime = otherStart - clip.duration;
      }

      // Snap start to other start
      if (Math.abs(clipStart - otherStart) < snapThreshold) {
        newStartTime = otherStart;
      }
    }
  }

  if (newStartTime !== clipStart) {
    return moveClip(timeline, clipId, newStartTime);
  }

  return timeline;
}

/**
 * Get video clips (main track)
 */
export function getVideoClips(timeline) {
  const videoTrack = timeline.tracks.find((t) => t.type === TRACK_TYPES.VIDEO);
  return videoTrack ? videoTrack.clips : [];
}

/**
 * Get audio clips
 */
export function getAudioClips(timeline) {
  const audioTrack = timeline.tracks.find((t) => t.type === TRACK_TYPES.AUDIO);
  return audioTrack ? audioTrack.clips : [];
}

/**
 * Get subtitle clips
 */
export function getSubtitleClips(timeline) {
  const subtitleTrack = timeline.tracks.find((t) => t.type === TRACK_TYPES.SUBTITLE);
  return subtitleTrack ? subtitleTrack.clips : [];
}

// ==================== SELECTION ====================

/**
 * Select clip
 */
export function selectClip(timeline, clipId, addToSelection = false) {
  return {
    ...timeline,
    selectedClipIds: addToSelection
      ? [...timeline.selectedClipIds, clipId]
      : [clipId],
  };
}

/**
 * Deselect clip
 */
export function deselectClip(timeline, clipId) {
  return {
    ...timeline,
    selectedClipIds: timeline.selectedClipIds.filter((id) => id !== clipId),
  };
}

/**
 * Clear selection
 */
export function clearSelection(timeline) {
  return {
    ...timeline,
    selectedClipIds: [],
    selectedTrackId: null,
  };
}

/**
 * Select all clips
 */
export function selectAllClips(timeline) {
  const allClipIds = timeline.tracks.flatMap((track) =>
    track.clips.map((clip) => clip.id)
  );

  return {
    ...timeline,
    selectedClipIds: allClipIds,
  };
}

/**
 * Get selected clips
 */
export function getSelectedClips(timeline) {
  return timeline.selectedClipIds
    .map((id) => findClip(timeline, id))
    .filter(Boolean);
}

// ==================== PLAYHEAD ====================

/**
 * Set playhead position
 */
export function setPlayhead(timeline, time) {
  return {
    ...timeline,
    playhead: clamp(time, 0, timeline.duration || 0),
  };
}

/**
 * Move playhead forward
 */
export function playheadForward(timeline, frames = 1) {
  const timeDelta = (frames / timeline.fps) * 1000;
  return setPlayhead(timeline, timeline.playhead + timeDelta);
}

/**
 * Move playhead backward
 */
export function playheadBackward(timeline, frames = 1) {
  const timeDelta = (frames / timeline.fps) * 1000;
  return setPlayhead(timeline, timeline.playhead - timeDelta);
}

/**
 * Jump to start
 */
export function jumpToStart(timeline) {
  return setPlayhead(timeline, 0);
}

/**
 * Jump to end
 */
export function jumpToEnd(timeline) {
  return setPlayhead(timeline, timeline.duration);
}

// ==================== ZOOM ====================

/**
 * Set zoom level
 */
export function setZoom(timeline, zoom) {
  return {
    ...timeline,
    zoom: clamp(zoom, TIMELINE_SETTINGS.MIN_ZOOM, TIMELINE_SETTINGS.MAX_ZOOM),
  };
}

/**
 * Zoom in
 */
export function zoomIn(timeline, amount = 0.1) {
  return setZoom(timeline, timeline.zoom + amount);
}

/**
 * Zoom out
 */
export function zoomOut(timeline, amount = 0.1) {
  return setZoom(timeline, timeline.zoom - amount);
}

/**
 * Fit timeline to view
 */
export function fitTimelineToView(timeline, viewportWidth) {
  const duration = timeline.duration || 60000; // Default 60s if empty
  const pixelsPerSecond = viewportWidth / (duration / 1000);
  const zoom = pixelsPerSecond / 100; // Target 100px per second at zoom 1

  return {
    ...timeline,
    zoom: clamp(zoom, TIMELINE_SETTINGS.MIN_ZOOM, TIMELINE_SETTINGS.MAX_ZOOM),
    scrollX: 0,
  };
}

// ==================== MARKERS ====================

/**
 * Add marker
 */
export function addMarker(timeline, time, label = '') {
  const marker = {
    id: generateVideoId(),
    time,
    label,
    color: '#B416DB',
  };

  return {
    ...timeline,
    markers: [...timeline.markers, marker].sort((a, b) => a.time - b.time),
    updatedAt: Date.now(),
  };
}

/**
 * Remove marker
 */
export function removeMarker(timeline, markerId) {
  return {
    ...timeline,
    markers: timeline.markers.filter((m) => m.id !== markerId),
    updatedAt: Date.now(),
  };
}

/**
 * Update marker
 */
export function updateMarker(timeline, markerId, updates) {
  return {
    ...timeline,
    markers: timeline.markers.map((m) =>
      m.id === markerId ? { ...m, ...updates } : m
    ),
    updatedAt: Date.now(),
  };
}

// ==================== RIPPLE EDITING ====================

/**
 * Ripple delete (close gap after deletion)
 */
export function rippleDelete(timeline, clipId) {
  const clip = findClip(timeline, clipId);
  if (!clip) return timeline;

  const trackId = findClipTrackId(timeline, clipId);
  if (!trackId) return timeline;

  const track = findTrack(timeline, trackId);
  const clipEnd = getClipEndTime(clip);
  const gap = clip.duration;

  // Move all clips after this one earlier
  const updatedClips = track.clips.map((c) => {
    if (c.startTime >= clipEnd) {
      return { ...c, startTime: c.startTime - gap };
    }
    return c;
  });

  // Remove the deleted clip
  const filteredClips = updatedClips.filter((c) => c.id !== clipId);

  return {
    ...timeline,
    tracks: timeline.tracks.map((t) =>
      t.id === trackId ? { ...t, clips: filteredClips } : t
    ),
    updatedAt: Date.now(),
  };
}

/**
 * Ripple trim (adjust subsequent clips)
 */
export function rippleTrim(timeline, clipId, newEndTime) {
  const clip = findClip(timeline, clipId);
  if (!clip) return timeline;

  const oldEnd = getClipEndTime(clip);
  const newEnd = newEndTime;
  const delta = newEnd - oldEnd;

  if (delta === 0) return timeline;

  const trackId = findClipTrackId(timeline, clipId);
  if (!trackId) return timeline;

  const track = findTrack(timeline, trackId);

  // Update the trimmed clip
  const updatedClips = track.clips.map((c) => {
    if (c.id === clipId) {
      return { ...c, duration: newEnd - c.startTime };
    }
    // Move subsequent clips
    if (c.startTime >= oldEnd) {
      return { ...c, startTime: c.startTime + delta };
    }
    return c;
  });

  return {
    ...timeline,
    tracks: timeline.tracks.map((t) =>
      t.id === trackId ? { ...t, clips: updatedClips } : t
    ),
    updatedAt: Date.now(),
  };
}

// ==================== SERIALIZATION ====================

/**
 * Serialize timeline to JSON
 */
export function serializeTimeline(timeline) {
  return JSON.stringify(timeline);
}

/**
 * Deserialize timeline from JSON
 */
export function deserializeTimeline(json) {
  try {
    return JSON.parse(json);
  } catch (error) {
    console.error('Failed to deserialize timeline:', error);
    return createTimeline();
  }
}

/**
 * Clone timeline
 */
export function cloneTimeline(timeline) {
  return JSON.parse(JSON.stringify(timeline));
}

// ==================== VALIDATION ====================

/**
 * Validate timeline
 */
export function validateTimeline(timeline) {
  const errors = [];

  // Check for overlapping clips
  for (const track of timeline.tracks) {
    const clips = [...track.clips].sort((a, b) => a.startTime - b.startTime);

    for (let i = 0; i < clips.length - 1; i++) {
      const current = clips[i];
      const next = clips[i + 1];
      const currentEnd = getClipEndTime(current);

      if (currentEnd > next.startTime) {
        errors.push({
          type: 'overlap',
          trackId: track.id,
          clipIds: [current.id, next.id],
          message: `Clips "${current.name}" and "${next.name}" overlap`,
        });
      }
    }
  }

  // Check for negative durations
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      if (clip.duration < 0) {
        errors.push({
          type: 'negative_duration',
          clipId: clip.id,
          message: `Clip "${clip.name}" has negative duration`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
