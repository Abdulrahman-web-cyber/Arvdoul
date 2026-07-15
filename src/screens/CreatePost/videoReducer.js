// src/screens/CreatePost/videoReducer.js - ARVDOUL Video Editor State Management
// Immutable state management with history support for video editing

import { produce } from 'immer';
import {
  VIDEO_TOOLS,
  VIDEO_ADJUSTMENTS,
  VIDEO_FILTERS,
  TRACK_TYPES,
  CLIP_COLORS,
  TRANSITIONS,
  SUBTITLE_PRESETS,
  TIMELINE_SETTINGS,
  VIDEO_PERFORMANCE,
  generateVideoId,
} from './videoConstants';
import {
  createTimeline,
  createTrack,
  createClip,
  createVideoClip,
  createAudioClip,
  createSubtitleClip,
  getClipEndTime,
  calculateTimelineDuration,
  findClip,
  findClipTrackId,
  findTrack,
} from './timelineEngine';

// ==================== DEFAULT STATE ====================

const DEFAULT_ADJUSTMENTS = VIDEO_ADJUSTMENTS.reduce((acc, adj) => {
  acc[adj.key] = adj.default;
  return acc;
}, {});

const DEFAULT_STATE = {
  // Editor state
  isOpen: false,
  isFullscreen: false,
  
  // Timeline
  timeline: null,
  
  // Playback
  isPlaying: false,
  currentTime: 0,
  playbackRate: 1,
  
  // Selection
  selectedClipIds: [],
  selectedTrackId: null,
  selectedMarkerId: null,
  
  // Tool state
  activeTool: VIDEO_TOOLS.SELECT,
  activeSubTool: null,
  
  // Video adjustments (global/effects track)
  adjustments: { ...DEFAULT_ADJUSTMENTS },
  
  // Filter
  filter: 'none',
  filterIntensity: 100,
  
  // Crop/Rotate
  crop: {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  },
  cropAspect: null,
  rotation: 0,
  flipH: false,
  flipV: false,
  
  // Speed
  speed: 1,
  
  // Volume
  volume: 100,
  masterVolume: 100,
  
  // Text/Subtitles
  textLayers: [],
  selectedTextId: null,
  subtitlePreset: SUBTITLE_PRESETS[0],
  
  // Transitions
  transitionLibrary: TRANSITIONS,
  selectedTransition: null,
  
  // Effects
  effectsLibrary: [],
  activeEffects: [],
  
  // UI state
  leftPanelOpen: true,
  rightPanelOpen: true,
  bottomPanelOpen: true,
  assetBrowserOpen: false,
  activeTab: 'tools',
  
  // History
  history: [],
  historyIndex: -1,
  canUndo: false,
  canRedo: false,
  
  // Media
  mediaItems: [],
  currentMediaId: null,
  
  // Export
  isExporting: false,
  exportProgress: 0,
  exportFormat: 'mp4-h264',
  exportQuality: 'high',
  
  // Processing
  isProcessing: false,
  processingMessage: '',
  
  // Error state
  error: null,
  
  // Video metadata
  videoWidth: 1920,
  videoHeight: 1080,
  videoDuration: 0,
  videoFrameRate: 30,
  
  // Thumbnail cache
  thumbnails: {},
  
  // Waveform cache
  waveforms: {},
  
  // Autosave
  lastSavedAt: null,
  hasUnsavedChanges: false,
};

// ==================== ACTION TYPES ====================

export const VIDEO_ACTIONS = {
  // Editor
  OPEN_EDITOR: 'OPEN_EDITOR',
  CLOSE_EDITOR: 'CLOSE_EDITOR',
  TOGGLE_FULLSCREEN: 'TOGGLE_FULLSCREEN',
  
  // Timeline
  INIT_TIMELINE: 'INIT_TIMELINE',
  LOAD_TIMELINE: 'LOAD_TIMELINE',
  UPDATE_TIMELINE: 'UPDATE_TIMELINE',
  
  // Playback
  PLAY: 'PLAY',
  PAUSE: 'PAUSE',
  TOGGLE_PLAY: 'TOGGLE_PLAY',
  SET_CURRENT_TIME: 'SET_CURRENT_TIME',
  SET_PLAYBACK_RATE: 'SET_PLAYBACK_RATE',
  STEP_FORWARD: 'STEP_FORWARD',
  STEP_BACKWARD: 'STEP_BACKWARD',
  JUMP_TO_START: 'JUMP_TO_START',
  JUMP_TO_END: 'JUMP_TO_END',
  
  // Selection
  SELECT_CLIP: 'SELECT_CLIP',
  DESELECT_CLIP: 'DESELECT_CLIP',
  SELECT_ALL_CLIPS: 'SELECT_ALL_CLIPS',
  CLEAR_SELECTION: 'CLEAR_SELECTION',
  SELECT_TRACK: 'SELECT_TRACK',
  SELECT_MARKER: 'SELECT_MARKER',
  
  // Tracks
  ADD_TRACK: 'ADD_TRACK',
  REMOVE_TRACK: 'REMOVE_TRACK',
  UPDATE_TRACK: 'UPDATE_TRACK',
  REORDER_TRACKS: 'REORDER_TRACKS',
  
  // Clips
  ADD_VIDEO_CLIP: 'ADD_VIDEO_CLIP',
  ADD_AUDIO_CLIP: 'ADD_AUDIO_CLIP',
  ADD_SUBTITLE_CLIP: 'ADD_SUBTITLE_CLIP',
  UPDATE_CLIP: 'UPDATE_CLIP',
  REMOVE_CLIP: 'REMOVE_CLIP',
  MOVE_CLIP: 'MOVE_CLIP',
  TRIM_CLIP_START: 'TRIM_CLIP_START',
  TRIM_CLIP_END: 'TRIM_CLIP_END',
  SPLIT_CLIP: 'SPLIT_CLIP',
  DUPLICATE_CLIP: 'DUPLICATE_CLIP',
  
  // Clip properties
  SET_CLIP_SPEED: 'SET_CLIP_SPEED',
  SET_CLIP_VOLUME: 'SET_CLIP_VOLUME',
  SET_CLIP_OPACITY: 'SET_CLIP_OPACITY',
  SET_CLIP_COLOR: 'SET_CLIP_COLOR',
  SET_CLIP_TRANSFORM: 'SET_CLIP_TRANSFORM',
  SET_CLIP_ADJUSTMENTS: 'SET_CLIP_ADJUSTMENTS',
  SET_CLIP_FILTER: 'SET_CLIP_FILTER',
  SET_CLIP_FADE: 'SET_CLIP_FADE',
  SET_CLIP_TRANSITION: 'SET_CLIP_TRANSITION',
  
  // Tools
  SET_TOOL: 'SET_TOOL',
  SET_SUB_TOOL: 'SET_SUB_TOOL',
  
  // Adjustments
  SET_ADJUSTMENT: 'SET_ADJUSTMENT',
  SET_ADJUSTMENTS: 'SET_ADJUSTMENTS',
  RESET_ADJUSTMENTS: 'RESET_ADJUSTMENTS',
  
  // Filter
  SET_FILTER: 'SET_FILTER',
  SET_FILTER_INTENSITY: 'SET_FILTER_INTENSITY',
  
  // Crop/Rotate
  SET_CROP: 'SET_CROP',
  SET_CROP_ASPECT: 'SET_CROP_ASPECT',
  ROTATE_LEFT: 'ROTATE_LEFT',
  ROTATE_RIGHT: 'ROTATE_RIGHT',
  FLIP_H: 'FLIP_H',
  FLIP_V: 'FLIP_V',
  
  // Speed/Volume
  SET_SPEED: 'SET_SPEED',
  SET_VOLUME: 'SET_VOLUME',
  SET_MASTER_VOLUME: 'SET_MASTER_VOLUME',
  
  // Text/Subtitles
  ADD_TEXT: 'ADD_TEXT',
  UPDATE_TEXT: 'UPDATE_TEXT',
  REMOVE_TEXT: 'REMOVE_TEXT',
  SELECT_TEXT: 'SELECT_TEXT',
  SET_SUBTITLE_PRESET: 'SET_SUBTITLE_PRESET',
  
  // Transitions
  SET_TRANSITION: 'SET_TRANSITION',
  
  // Effects
  ADD_EFFECT: 'ADD_EFFECT',
  UPDATE_EFFECT: 'UPDATE_EFFECT',
  REMOVE_EFFECT: 'REMOVE_EFFECT',
  
  // UI
  TOGGLE_LEFT_PANEL: 'TOGGLE_LEFT_PANEL',
  TOGGLE_RIGHT_PANEL: 'TOGGLE_RIGHT_PANEL',
  TOGGLE_BOTTOM_PANEL: 'TOGGLE_BOTTOM_PANEL',
  TOGGLE_ASSET_BROWSER: 'TOGGLE_ASSET_BROWSER',
  SET_ACTIVE_TAB: 'SET_ACTIVE_TAB',
  
  // History
  PUSH_HISTORY: 'PUSH_HISTORY',
  UNDO: 'UNDO',
  REDO: 'REDO',
  CLEAR_HISTORY: 'CLEAR_HISTORY',
  
  // Media
  ADD_MEDIA: 'ADD_MEDIA',
  REMOVE_MEDIA: 'REMOVE_MEDIA',
  SET_CURRENT_MEDIA: 'SET_CURRENT_MEDIA',
  
  // Export
  SET_EXPORTING: 'SET_EXPORTING',
  SET_EXPORT_PROGRESS: 'SET_EXPORT_PROGRESS',
  SET_EXPORT_FORMAT: 'SET_EXPORT_FORMAT',
  SET_EXPORT_QUALITY: 'SET_EXPORT_QUALITY',
  
  // Processing
  SET_PROCESSING: 'SET_PROCESSING',
  SET_PROCESSING_MESSAGE: 'SET_PROCESSING_MESSAGE',
  
  // Error
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  
  // Video metadata
  SET_VIDEO_METADATA: 'SET_VIDEO_METADATA',
  
  // Thumbnails/Waveforms
  CACHE_THUMBNAIL: 'CACHE_THUMBNAIL',
  CACHE_WAVEFORM: 'CACHE_WAVEFORM',
  
  // Autosave
  MARK_SAVED: 'MARK_SAVED',
  MARK_UNSAVED: 'MARK_UNSAVED',
  
  // State
  LOAD_STATE: 'LOAD_STATE',
  RESET_STATE: 'RESET_STATE',
};

// ==================== REDUCER ====================

export function videoReducer(state, action) {
  return produce(state, (draft) => {
    switch (action.type) {
      // ========== Editor ==========
      case VIDEO_ACTIONS.OPEN_EDITOR:
        draft.isOpen = true;
        break;
        
      case VIDEO_ACTIONS.CLOSE_EDITOR:
        draft.isOpen = false;
        draft.isFullscreen = false;
        break;
        
      case VIDEO_ACTIONS.TOGGLE_FULLSCREEN:
        draft.isFullscreen = !draft.isFullscreen;
        break;
        
      // ========== Timeline ==========
      case VIDEO_ACTIONS.INIT_TIMELINE:
        draft.timeline = createTimeline();
        draft.history = [];
        draft.historyIndex = -1;
        break;
        
      case VIDEO_ACTIONS.LOAD_TIMELINE:
        draft.timeline = action.payload;
        break;
        
      case VIDEO_ACTIONS.UPDATE_TIMELINE:
        if (draft.timeline) {
          draft.timeline = { ...draft.timeline, ...action.payload };
        }
        break;
        
      // ========== Playback ==========
      case VIDEO_ACTIONS.PLAY:
        draft.isPlaying = true;
        break;
        
      case VIDEO_ACTIONS.PAUSE:
        draft.isPlaying = false;
        break;
        
      case VIDEO_ACTIONS.TOGGLE_PLAY:
        draft.isPlaying = !draft.isPlaying;
        break;
        
      case VIDEO_ACTIONS.SET_CURRENT_TIME:
        draft.currentTime = action.payload;
        if (draft.timeline) {
          draft.timeline.playhead = action.payload;
        }
        break;
        
      case VIDEO_ACTIONS.SET_PLAYBACK_RATE:
        draft.playbackRate = action.payload;
        break;
        
      case VIDEO_ACTIONS.STEP_FORWARD:
        draft.currentTime += 1000 / (draft.videoFrameRate || 30);
        break;
        
      case VIDEO_ACTIONS.STEP_BACKWARD:
        draft.currentTime = Math.max(0, draft.currentTime - 1000 / (draft.videoFrameRate || 30));
        break;
        
      case VIDEO_ACTIONS.JUMP_TO_START:
        draft.currentTime = 0;
        break;
        
      case VIDEO_ACTIONS.JUMP_TO_END:
        draft.currentTime = draft.videoDuration || 0;
        break;
        
      // ========== Selection ==========
      case VIDEO_ACTIONS.SELECT_CLIP:
        if (action.payload.addToSelection) {
          draft.selectedClipIds = [...draft.selectedClipIds, action.payload.clipId];
        } else {
          draft.selectedClipIds = [action.payload.clipId];
        }
        break;
        
      case VIDEO_ACTIONS.DESELECT_CLIP:
        draft.selectedClipIds = draft.selectedClipIds.filter(
          (id) => id !== action.payload
        );
        break;
        
      case VIDEO_ACTIONS.SELECT_ALL_CLIPS:
        if (draft.timeline) {
          draft.selectedClipIds = draft.timeline.tracks.flatMap((t) =>
            t.clips.map((c) => c.id)
          );
        }
        break;
        
      case VIDEO_ACTIONS.CLEAR_SELECTION:
        draft.selectedClipIds = [];
        draft.selectedTrackId = null;
        draft.selectedMarkerId = null;
        break;
        
      case VIDEO_ACTIONS.SELECT_TRACK:
        draft.selectedTrackId = action.payload;
        break;
        
      case VIDEO_ACTIONS.SELECT_MARKER:
        draft.selectedMarkerId = action.payload;
        break;
        
      // ========== Tracks ==========
      case VIDEO_ACTIONS.ADD_TRACK:
        if (draft.timeline) {
          const newTrack = createTrack(action.payload.type, action.payload.options);
          draft.timeline.tracks.push(newTrack);
        }
        break;
        
      case VIDEO_ACTIONS.REMOVE_TRACK:
        if (draft.timeline) {
          draft.timeline.tracks = draft.timeline.tracks.filter(
            (t) => t.id !== action.payload
          );
        }
        break;
        
      case VIDEO_ACTIONS.UPDATE_TRACK:
        if (draft.timeline) {
          draft.timeline.tracks = draft.timeline.tracks.map((t) =>
            t.id === action.payload.trackId
              ? { ...t, ...action.payload.updates }
              : t
          );
        }
        break;
        
      case VIDEO_ACTIONS.REORDER_TRACKS:
        if (draft.timeline) {
          const { trackId, newIndex } = action.payload;
          const tracks = [...draft.timeline.tracks];
          const oldIndex = tracks.findIndex((t) => t.id === trackId);
          if (oldIndex !== -1 && newIndex >= 0 && newIndex < tracks.length) {
            const [track] = tracks.splice(oldIndex, 1);
            tracks.splice(newIndex, 0, track);
            draft.timeline.tracks = tracks;
          }
        }
        break;
        
      // ========== Clips ==========
      case VIDEO_ACTIONS.ADD_VIDEO_CLIP:
        if (draft.timeline) {
          const videoTrack = draft.timeline.tracks.find(
            (t) => t.type === TRACK_TYPES.VIDEO
          ) || draft.timeline.tracks[0];
          
          if (videoTrack) {
            const newClip = createVideoClip(action.payload.file, {
              startTime: action.payload.startTime || calculateTimelineDuration(draft.timeline),
              duration: action.payload.duration || 5000,
            });
            videoTrack.clips.push(newClip);
            draft.timeline.duration = calculateTimelineDuration(draft.timeline);
          }
        }
        break;
        
      case VIDEO_ACTIONS.ADD_AUDIO_CLIP:
        if (draft.timeline) {
          let audioTrack = draft.timeline.tracks.find(
            (t) => t.type === TRACK_TYPES.AUDIO
          );
          
          if (!audioTrack) {
            audioTrack = createTrack(TRACK_TYPES.AUDIO);
            draft.timeline.tracks.push(audioTrack);
          }
          
          const newClip = createAudioClip(action.payload.file, {
            startTime: action.payload.startTime || 0,
          });
          audioTrack.clips.push(newClip);
          draft.timeline.duration = calculateTimelineDuration(draft.timeline);
        }
        break;
        
      case VIDEO_ACTIONS.ADD_SUBTITLE_CLIP:
        if (draft.timeline) {
          let subtitleTrack = draft.timeline.tracks.find(
            (t) => t.type === TRACK_TYPES.SUBTITLE
          );
          
          if (!subtitleTrack) {
            subtitleTrack = createTrack(TRACK_TYPES.SUBTITLE);
            draft.timeline.tracks.push(subtitleTrack);
          }
          
          const newClip = createSubtitleClip(
            action.payload.text,
            action.payload.startTime,
            action.payload.endTime
          );
          subtitleTrack.clips.push(newClip);
        }
        break;
        
      case VIDEO_ACTIONS.UPDATE_CLIP:
        if (draft.timeline) {
          for (const track of draft.timeline.tracks) {
            const clipIndex = track.clips.findIndex(
              (c) => c.id === action.payload.clipId
            );
            if (clipIndex !== -1) {
              track.clips[clipIndex] = {
                ...track.clips[clipIndex],
                ...action.payload.updates,
              };
              break;
            }
          }
        }
        break;
        
      case VIDEO_ACTIONS.REMOVE_CLIP:
        if (draft.timeline) {
          for (const track of draft.timeline.tracks) {
            const clipIndex = track.clips.findIndex(
              (c) => c.id === action.payload
            );
            if (clipIndex !== -1) {
              track.clips.splice(clipIndex, 1);
              draft.selectedClipIds = draft.selectedClipIds.filter(
                (id) => id !== action.payload
              );
              break;
            }
          }
        }
        break;
        
      case VIDEO_ACTIONS.MOVE_CLIP:
        if (draft.timeline) {
          const { clipId, newStartTime } = action.payload;
          for (const track of draft.timeline.tracks) {
            const clip = track.clips.find((c) => c.id === clipId);
            if (clip) {
              clip.startTime = Math.max(0, newStartTime);
              break;
            }
          }
        }
        break;
        
      case VIDEO_ACTIONS.TRIM_CLIP_START:
        if (draft.timeline) {
          const { clipId, newStartTime, newTrimStart } = action.payload;
          for (const track of draft.timeline.tracks) {
            const clip = track.clips.find((c) => c.id === clipId);
            if (clip) {
              const timeDelta = newStartTime - clip.startTime;
              clip.startTime = newStartTime;
              clip.trimStart = newTrimStart;
              clip.duration -= timeDelta;
              break;
            }
          }
        }
        break;
        
      case VIDEO_ACTIONS.TRIM_CLIP_END:
        if (draft.timeline) {
          const { clipId, newEndTime } = action.payload;
          for (const track of draft.timeline.tracks) {
            const clip = track.clips.find((c) => c.id === clipId);
            if (clip) {
              clip.duration = newEndTime - clip.startTime;
              break;
            }
          }
        }
        break;
        
      case VIDEO_ACTIONS.SPLIT_CLIP:
        if (draft.timeline) {
          const { clipId, splitTime } = action.payload;
          for (const track of draft.timeline.tracks) {
            const clipIndex = track.clips.findIndex((c) => c.id === clipId);
            if (clipIndex !== -1) {
              const clip = track.clips[clipIndex];
              const clipEnd = getClipEndTime(clip);
              
              if (splitTime > clip.startTime && splitTime < clipEnd) {
                const relativeTime = splitTime - clip.startTime;
                const sourceTime = clip.trimStart + (relativeTime * clip.playbackRate);
                
                // Update original clip
                clip.duration = relativeTime;
                clip.trimEnd = clip.source.duration - sourceTime;
                
                // Create new clip
                const newClip = {
                  ...clip,
                  id: generateVideoId(),
                  startTime: splitTime,
                  duration: clipEnd - splitTime,
                  trimStart: sourceTime,
                  trimEnd: 0,
                };
                
                track.clips.splice(clipIndex + 1, 0, newClip);
              }
              break;
            }
          }
        }
        break;
        
      case VIDEO_ACTIONS.DUPLICATE_CLIP:
        if (draft.timeline) {
          const clipId = action.payload;
          for (const track of draft.timeline.tracks) {
            const clip = track.clips.find((c) => c.id === clipId);
            if (clip) {
              const newClip = {
                ...clip,
                id: generateVideoId(),
                startTime: getClipEndTime(clip),
                name: `${clip.name} (copy)`,
              };
              track.clips.push(newClip);
              break;
            }
          }
        }
        break;
        
      // ========== Clip Properties ==========
      case VIDEO_ACTIONS.SET_CLIP_SPEED:
        if (draft.timeline) {
          const { clipId, playbackRate } = action.payload;
          for (const track of draft.timeline.tracks) {
            const clip = track.clips.find((c) => c.id === clipId);
            if (clip) {
              const sourceDuration = clip.source.duration - clip.trimStart - clip.trimEnd;
              clip.playbackRate = playbackRate;
              clip.duration = sourceDuration / playbackRate;
              break;
            }
          }
        }
        break;
        
      case VIDEO_ACTIONS.SET_CLIP_VOLUME:
        if (draft.timeline) {
          const { clipId, volume } = action.payload;
          for (const track of draft.timeline.tracks) {
            const clip = track.clips.find((c) => c.id === clipId);
            if (clip) {
              clip.volume = Math.max(0, Math.min(200, volume));
              break;
            }
          }
        }
        break;
        
      case VIDEO_ACTIONS.SET_CLIP_OPACITY:
        if (draft.timeline) {
          const { clipId, opacity } = action.payload;
          for (const track of draft.timeline.tracks) {
            const clip = track.clips.find((c) => c.id === clipId);
            if (clip) {
              clip.opacity = Math.max(0, Math.min(100, opacity));
              break;
            }
          }
        }
        break;
        
      case VIDEO_ACTIONS.SET_CLIP_COLOR:
        if (draft.timeline) {
          const { clipId, colorId } = action.payload;
          for (const track of draft.timeline.tracks) {
            const clip = track.clips.find((c) => c.id === clipId);
            if (clip) {
              clip.colorLabel = colorId;
              break;
            }
          }
        }
        break;
        
      case VIDEO_ACTIONS.SET_CLIP_TRANSFORM:
        if (draft.timeline) {
          const { clipId, transform } = action.payload;
          for (const track of draft.timeline.tracks) {
            const clip = track.clips.find((c) => c.id === clipId);
            if (clip) {
              clip.transform = { ...clip.transform, ...transform };
              break;
            }
          }
        }
        break;
        
      case VIDEO_ACTIONS.SET_CLIP_ADJUSTMENTS:
        if (draft.timeline) {
          const { clipId, adjustments } = action.payload;
          for (const track of draft.timeline.tracks) {
            const clip = track.clips.find((c) => c.id === clipId);
            if (clip) {
              clip.adjustments = { ...clip.adjustments, ...adjustments };
              break;
            }
          }
        }
        break;
        
      case VIDEO_ACTIONS.SET_CLIP_FILTER:
        if (draft.timeline) {
          const { clipId, filter, intensity } = action.payload;
          for (const track of draft.timeline.tracks) {
            const clip = track.clips.find((c) => c.id === clipId);
            if (clip) {
              clip.filter = filter;
              if (intensity !== undefined) clip.filterIntensity = intensity;
              break;
            }
          }
        }
        break;
        
      case VIDEO_ACTIONS.SET_CLIP_FADE:
        if (draft.timeline) {
          const { clipId, fadeIn, fadeOut } = action.payload;
          for (const track of draft.timeline.tracks) {
            const clip = track.clips.find((c) => c.id === clipId);
            if (clip) {
              if (fadeIn !== undefined) clip.fadeIn = fadeIn;
              if (fadeOut !== undefined) clip.fadeOut = fadeOut;
              break;
            }
          }
        }
        break;
        
      // ========== Tools ==========
      case VIDEO_ACTIONS.SET_TOOL:
        draft.activeTool = action.payload;
        draft.activeSubTool = null;
        break;
        
      case VIDEO_ACTIONS.SET_SUB_TOOL:
        draft.activeSubTool = action.payload;
        break;
        
      // ========== Adjustments ==========
      case VIDEO_ACTIONS.SET_ADJUSTMENT:
        draft.adjustments[action.payload.key] = action.payload.value;
        break;
        
      case VIDEO_ACTIONS.SET_ADJUSTMENTS:
        draft.adjustments = { ...draft.adjustments, ...action.payload };
        break;
        
      case VIDEO_ACTIONS.RESET_ADJUSTMENTS:
        draft.adjustments = { ...DEFAULT_ADJUSTMENTS };
        break;
        
      // ========== Filter ==========
      case VIDEO_ACTIONS.SET_FILTER:
        draft.filter = action.payload;
        break;
        
      case VIDEO_ACTIONS.SET_FILTER_INTENSITY:
        draft.filterIntensity = action.payload;
        break;
        
      // ========== Crop/Rotate ==========
      case VIDEO_ACTIONS.SET_CROP:
        draft.crop = { ...draft.crop, ...action.payload };
        break;
        
      case VIDEO_ACTIONS.SET_CROP_ASPECT:
        draft.cropAspect = action.payload;
        break;
        
      case VIDEO_ACTIONS.ROTATE_LEFT:
        draft.rotation = (draft.rotation - 90 + 360) % 360;
        break;
        
      case VIDEO_ACTIONS.ROTATE_RIGHT:
        draft.rotation = (draft.rotation + 90) % 360;
        break;
        
      case VIDEO_ACTIONS.FLIP_H:
        draft.flipH = !draft.flipH;
        break;
        
      case VIDEO_ACTIONS.FLIP_V:
        draft.flipV = !draft.flipV;
        break;
        
      // ========== Speed/Volume ==========
      case VIDEO_ACTIONS.SET_SPEED:
        draft.speed = action.payload;
        break;
        
      case VIDEO_ACTIONS.SET_VOLUME:
        draft.volume = Math.max(0, Math.min(200, action.payload));
        break;
        
      case VIDEO_ACTIONS.SET_MASTER_VOLUME:
        draft.masterVolume = Math.max(0, Math.min(200, action.payload));
        break;
        
      // ========== Text/Subtitles ==========
      case VIDEO_ACTIONS.ADD_TEXT:
        draft.textLayers.push({
          id: generateVideoId(),
          ...action.payload,
        });
        break;
        
      case VIDEO_ACTIONS.UPDATE_TEXT:
        draft.textLayers = draft.textLayers.map((t) =>
          t.id === action.payload.id ? { ...t, ...action.payload.updates } : t
        );
        break;
        
      case VIDEO_ACTIONS.REMOVE_TEXT:
        draft.textLayers = draft.textLayers.filter((t) => t.id !== action.payload);
        draft.selectedTextId = null;
        break;
        
      case VIDEO_ACTIONS.SELECT_TEXT:
        draft.selectedTextId = action.payload;
        break;
        
      case VIDEO_ACTIONS.SET_SUBTITLE_PRESET:
        draft.subtitlePreset = action.payload;
        break;
        
      // ========== Transitions ==========
      case VIDEO_ACTIONS.SET_TRANSITION:
        draft.selectedTransition = action.payload;
        break;
        
      // ========== Effects ==========
      case VIDEO_ACTIONS.ADD_EFFECT:
        draft.activeEffects.push({
          id: generateVideoId(),
          ...action.payload,
        });
        break;
        
      case VIDEO_ACTIONS.UPDATE_EFFECT:
        draft.activeEffects = draft.activeEffects.map((e) =>
          e.id === action.payload.id ? { ...e, ...action.payload.updates } : e
        );
        break;
        
      case VIDEO_ACTIONS.REMOVE_EFFECT:
        draft.activeEffects = draft.activeEffects.filter(
          (e) => e.id !== action.payload
        );
        break;
        
      // ========== UI ==========
      case VIDEO_ACTIONS.TOGGLE_LEFT_PANEL:
        draft.leftPanelOpen = !draft.leftPanelOpen;
        break;
        
      case VIDEO_ACTIONS.TOGGLE_RIGHT_PANEL:
        draft.rightPanelOpen = !draft.rightPanelOpen;
        break;
        
      case VIDEO_ACTIONS.TOGGLE_BOTTOM_PANEL:
        draft.bottomPanelOpen = !draft.bottomPanelOpen;
        break;
        
      case VIDEO_ACTIONS.TOGGLE_ASSET_BROWSER:
        draft.assetBrowserOpen = !draft.assetBrowserOpen;
        break;
        
      case VIDEO_ACTIONS.SET_ACTIVE_TAB:
        draft.activeTab = action.payload;
        break;
        
      // ========== History ==========
      case VIDEO_ACTIONS.PUSH_HISTORY:
        // Save current state to history
        const historyState = {
          timeline: JSON.parse(JSON.stringify(draft.timeline)),
          adjustments: { ...draft.adjustments },
          filter: draft.filter,
          filterIntensity: draft.filterIntensity,
        };
        
        // Remove any redo states
        if (draft.historyIndex < draft.history.length - 1) {
          draft.history = draft.history.slice(0, draft.historyIndex + 1);
        }
        
        draft.history.push(historyState);
        
        // Limit history size
        if (draft.history.length > VIDEO_PERFORMANCE.MAX_HISTORY) {
          draft.history.shift();
        } else {
          draft.historyIndex++;
        }
        
        draft.canUndo = draft.historyIndex > 0;
        draft.canRedo = draft.historyIndex < draft.history.length - 1;
        break;
        
      case VIDEO_ACTIONS.UNDO:
        if (draft.historyIndex > 0) {
          draft.historyIndex--;
          const prevState = draft.history[draft.historyIndex];
          draft.timeline = prevState.timeline;
          draft.adjustments = prevState.adjustments;
          draft.filter = prevState.filter;
          draft.filterIntensity = prevState.filterIntensity;
        }
        draft.canUndo = draft.historyIndex > 0;
        draft.canRedo = draft.historyIndex < draft.history.length - 1;
        break;
        
      case VIDEO_ACTIONS.REDO:
        if (draft.historyIndex < draft.history.length - 1) {
          draft.historyIndex++;
          const nextState = draft.history[draft.historyIndex];
          draft.timeline = nextState.timeline;
          draft.adjustments = nextState.adjustments;
          draft.filter = nextState.filter;
          draft.filterIntensity = nextState.filterIntensity;
        }
        draft.canUndo = draft.historyIndex > 0;
        draft.canRedo = draft.historyIndex < draft.history.length - 1;
        break;
        
      case VIDEO_ACTIONS.CLEAR_HISTORY:
        draft.history = [];
        draft.historyIndex = -1;
        draft.canUndo = false;
        draft.canRedo = false;
        break;
        
      // ========== Media ==========
      case VIDEO_ACTIONS.ADD_MEDIA:
        draft.mediaItems.push({
          id: generateVideoId(),
          ...action.payload,
        });
        break;
        
      case VIDEO_ACTIONS.REMOVE_MEDIA:
        draft.mediaItems = draft.mediaItems.filter((m) => m.id !== action.payload);
        if (draft.currentMediaId === action.payload) {
          draft.currentMediaId = draft.mediaItems[0]?.id || null;
        }
        break;
        
      case VIDEO_ACTIONS.SET_CURRENT_MEDIA:
        draft.currentMediaId = action.payload;
        break;
        
      // ========== Export ==========
      case VIDEO_ACTIONS.SET_EXPORTING:
        draft.isExporting = action.payload;
        break;
        
      case VIDEO_ACTIONS.SET_EXPORT_PROGRESS:
        draft.exportProgress = action.payload;
        break;
        
      case VIDEO_ACTIONS.SET_EXPORT_FORMAT:
        draft.exportFormat = action.payload;
        break;
        
      case VIDEO_ACTIONS.SET_EXPORT_QUALITY:
        draft.exportQuality = action.payload;
        break;
        
      // ========== Processing ==========
      case VIDEO_ACTIONS.SET_PROCESSING:
        draft.isProcessing = action.payload;
        break;
        
      case VIDEO_ACTIONS.SET_PROCESSING_MESSAGE:
        draft.processingMessage = action.payload;
        break;
        
      // ========== Error ==========
      case VIDEO_ACTIONS.SET_ERROR:
        draft.error = action.payload;
        break;
        
      case VIDEO_ACTIONS.CLEAR_ERROR:
        draft.error = null;
        break;
        
      // ========== Video metadata ==========
      case VIDEO_ACTIONS.SET_VIDEO_METADATA:
        draft.videoWidth = action.payload.width || draft.videoWidth;
        draft.videoHeight = action.payload.height || draft.videoHeight;
        draft.videoDuration = action.payload.duration || draft.videoDuration;
        draft.videoFrameRate = action.payload.frameRate || draft.videoFrameRate;
        break;
        
      // ========== Thumbnails/Waveforms ==========
      case VIDEO_ACTIONS.CACHE_THUMBNAIL:
        draft.thumbnails[action.payload.clipId] = action.payload.thumbnail;
        break;
        
      case VIDEO_ACTIONS.CACHE_WAVEFORM:
        draft.waveforms[action.payload.clipId] = action.payload.waveform;
        break;
        
      // ========== Autosave ==========
      case VIDEO_ACTIONS.MARK_SAVED:
        draft.lastSavedAt = Date.now();
        draft.hasUnsavedChanges = false;
        break;
        
      case VIDEO_ACTIONS.MARK_UNSAVED:
        draft.hasUnsavedChanges = true;
        break;
        
      // ========== State ==========
      case VIDEO_ACTIONS.LOAD_STATE:
        return { ...DEFAULT_STATE, ...action.payload };
        
      case VIDEO_ACTIONS.RESET_STATE:
        return { ...DEFAULT_STATE };
        
      default:
        break;
    }
  });
}

// ==================== ACTION CREATORS ====================

export const videoActions = {
  openEditor: () => ({ type: VIDEO_ACTIONS.OPEN_EDITOR }),
  closeEditor: () => ({ type: VIDEO_ACTIONS.CLOSE_EDITOR }),
  toggleFullscreen: () => ({ type: VIDEO_ACTIONS.TOGGLE_FULLSCREEN }),
  
  initTimeline: () => ({ type: VIDEO_ACTIONS.INIT_TIMELINE }),
  loadTimeline: (timeline) => ({ type: VIDEO_ACTIONS.LOAD_TIMELINE, payload: timeline }),
  updateTimeline: (updates) => ({ type: VIDEO_ACTIONS.UPDATE_TIMELINE, payload: updates }),
  
  play: () => ({ type: VIDEO_ACTIONS.PLAY }),
  pause: () => ({ type: VIDEO_ACTIONS.PAUSE }),
  togglePlay: () => ({ type: VIDEO_ACTIONS.TOGGLE_PLAY }),
  setCurrentTime: (time) => ({ type: VIDEO_ACTIONS.SET_CURRENT_TIME, payload: time }),
  setPlaybackRate: (rate) => ({ type: VIDEO_ACTIONS.SET_PLAYBACK_RATE, payload: rate }),
  stepForward: () => ({ type: VIDEO_ACTIONS.STEP_FORWARD }),
  stepBackward: () => ({ type: VIDEO_ACTIONS.STEP_BACKWARD }),
  jumpToStart: () => ({ type: VIDEO_ACTIONS.JUMP_TO_START }),
  jumpToEnd: () => ({ type: VIDEO_ACTIONS.JUMP_TO_END }),
  
  selectClip: (clipId, addToSelection = false) => ({
    type: VIDEO_ACTIONS.SELECT_CLIP,
    payload: { clipId, addToSelection },
  }),
  deselectClip: (clipId) => ({ type: VIDEO_ACTIONS.DESELECT_CLIP, payload: clipId }),
  selectAllClips: () => ({ type: VIDEO_ACTIONS.SELECT_ALL_CLIPS }),
  clearSelection: () => ({ type: VIDEO_ACTIONS.CLEAR_SELECTION }),
  selectTrack: (trackId) => ({ type: VIDEO_ACTIONS.SELECT_TRACK, payload: trackId }),
  selectMarker: (markerId) => ({ type: VIDEO_ACTIONS.SELECT_MARKER, payload: markerId }),
  
  addTrack: (type, options = {}) => ({ type: VIDEO_ACTIONS.ADD_TRACK, payload: { type, options } }),
  removeTrack: (trackId) => ({ type: VIDEO_ACTIONS.REMOVE_TRACK, payload: trackId }),
  updateTrack: (trackId, updates) => ({ type: VIDEO_ACTIONS.UPDATE_TRACK, payload: { trackId, updates } }),
  reorderTracks: (trackId, newIndex) => ({ type: VIDEO_ACTIONS.REORDER_TRACKS, payload: { trackId, newIndex } }),
  
  addVideoClip: (file, startTime, duration) => ({
    type: VIDEO_ACTIONS.ADD_VIDEO_CLIP,
    payload: { file, startTime, duration },
  }),
  addAudioClip: (file, startTime) => ({
    type: VIDEO_ACTIONS.ADD_AUDIO_CLIP,
    payload: { file, startTime },
  }),
  addSubtitleClip: (text, startTime, endTime) => ({
    type: VIDEO_ACTIONS.ADD_SUBTITLE_CLIP,
    payload: { text, startTime, endTime },
  }),
  updateClip: (clipId, updates) => ({ type: VIDEO_ACTIONS.UPDATE_CLIP, payload: { clipId, updates } }),
  removeClip: (clipId) => ({ type: VIDEO_ACTIONS.REMOVE_CLIP, payload: clipId }),
  moveClip: (clipId, newStartTime) => ({ type: VIDEO_ACTIONS.MOVE_CLIP, payload: { clipId, newStartTime } }),
  trimClipStart: (clipId, newStartTime, newTrimStart) => ({
    type: VIDEO_ACTIONS.TRIM_CLIP_START,
    payload: { clipId, newStartTime, newTrimStart },
  }),
  trimClipEnd: (clipId, newEndTime) => ({ type: VIDEO_ACTIONS.TRIM_CLIP_END, payload: { clipId, newEndTime } }),
  splitClip: (clipId, splitTime) => ({ type: VIDEO_ACTIONS.SPLIT_CLIP, payload: { clipId, splitTime } }),
  duplicateClip: (clipId) => ({ type: VIDEO_ACTIONS.DUPLICATE_CLIP, payload: clipId }),
  
  setClipSpeed: (clipId, playbackRate) => ({ type: VIDEO_ACTIONS.SET_CLIP_SPEED, payload: { clipId, playbackRate } }),
  setClipVolume: (clipId, volume) => ({ type: VIDEO_ACTIONS.SET_CLIP_VOLUME, payload: { clipId, volume } }),
  setClipOpacity: (clipId, opacity) => ({ type: VIDEO_ACTIONS.SET_CLIP_OPACITY, payload: { clipId, opacity } }),
  setClipColor: (clipId, colorId) => ({ type: VIDEO_ACTIONS.SET_CLIP_COLOR, payload: { clipId, colorId } }),
  setClipTransform: (clipId, transform) => ({ type: VIDEO_ACTIONS.SET_CLIP_TRANSFORM, payload: { clipId, transform } }),
  setClipAdjustments: (clipId, adjustments) => ({ type: VIDEO_ACTIONS.SET_CLIP_ADJUSTMENTS, payload: { clipId, adjustments } }),
  setClipFilter: (clipId, filter, intensity) => ({ type: VIDEO_ACTIONS.SET_CLIP_FILTER, payload: { clipId, filter, intensity } }),
  setClipFade: (clipId, fadeIn, fadeOut) => ({ type: VIDEO_ACTIONS.SET_CLIP_FADE, payload: { clipId, fadeIn, fadeOut } }),
  
  setTool: (tool) => ({ type: VIDEO_ACTIONS.SET_TOOL, payload: tool }),
  setSubTool: (subTool) => ({ type: VIDEO_ACTIONS.SET_SUB_TOOL, payload: subTool }),
  
  setAdjustment: (key, value) => ({ type: VIDEO_ACTIONS.SET_ADJUSTMENT, payload: { key, value } }),
  setAdjustments: (adjustments) => ({ type: VIDEO_ACTIONS.SET_ADJUSTMENTS, payload: adjustments }),
  resetAdjustments: () => ({ type: VIDEO_ACTIONS.RESET_ADJUSTMENTS }),
  
  setFilter: (filter) => ({ type: VIDEO_ACTIONS.SET_FILTER, payload: filter }),
  setFilterIntensity: (intensity) => ({ type: VIDEO_ACTIONS.SET_FILTER_INTENSITY, payload: intensity }),
  
  setCrop: (crop) => ({ type: VIDEO_ACTIONS.SET_CROP, payload: crop }),
  setCropAspect: (aspect) => ({ type: VIDEO_ACTIONS.SET_CROP_ASPECT, payload: aspect }),
  rotateLeft: () => ({ type: VIDEO_ACTIONS.ROTATE_LEFT }),
  rotateRight: () => ({ type: VIDEO_ACTIONS.ROTATE_RIGHT }),
  flipH: () => ({ type: VIDEO_ACTIONS.FLIP_H }),
  flipV: () => ({ type: VIDEO_ACTIONS.FLIP_V }),
  
  setSpeed: (speed) => ({ type: VIDEO_ACTIONS.SET_SPEED, payload: speed }),
  setVolume: (volume) => ({ type: VIDEO_ACTIONS.SET_VOLUME, payload: volume }),
  setMasterVolume: (volume) => ({ type: VIDEO_ACTIONS.SET_MASTER_VOLUME, payload: volume }),
  
  addText: (textData) => ({ type: VIDEO_ACTIONS.ADD_TEXT, payload: textData }),
  updateText: (id, updates) => ({ type: VIDEO_ACTIONS.UPDATE_TEXT, payload: { id, updates } }),
  removeText: (id) => ({ type: VIDEO_ACTIONS.REMOVE_TEXT, payload: id }),
  selectText: (id) => ({ type: VIDEO_ACTIONS.SELECT_TEXT, payload: id }),
  setSubtitlePreset: (preset) => ({ type: VIDEO_ACTIONS.SET_SUBTITLE_PRESET, payload: preset }),
  
  setTransition: (transition) => ({ type: VIDEO_ACTIONS.SET_TRANSITION, payload: transition }),
  
  addEffect: (effect) => ({ type: VIDEO_ACTIONS.ADD_EFFECT, payload: effect }),
  updateEffect: (id, updates) => ({ type: VIDEO_ACTIONS.UPDATE_EFFECT, payload: { id, updates } }),
  removeEffect: (id) => ({ type: VIDEO_ACTIONS.REMOVE_EFFECT, payload: id }),
  
  toggleLeftPanel: () => ({ type: VIDEO_ACTIONS.TOGGLE_LEFT_PANEL }),
  toggleRightPanel: () => ({ type: VIDEO_ACTIONS.TOGGLE_RIGHT_PANEL }),
  toggleBottomPanel: () => ({ type: VIDEO_ACTIONS.TOGGLE_BOTTOM_PANEL }),
  toggleAssetBrowser: () => ({ type: VIDEO_ACTIONS.TOGGLE_ASSET_BROWSER }),
  setActiveTab: (tab) => ({ type: VIDEO_ACTIONS.SET_ACTIVE_TAB, payload: tab }),
  
  pushHistory: () => ({ type: VIDEO_ACTIONS.PUSH_HISTORY }),
  undo: () => ({ type: VIDEO_ACTIONS.UNDO }),
  redo: () => ({ type: VIDEO_ACTIONS.REDO }),
  clearHistory: () => ({ type: VIDEO_ACTIONS.CLEAR_HISTORY }),
  
  addMedia: (media) => ({ type: VIDEO_ACTIONS.ADD_MEDIA, payload: media }),
  removeMedia: (id) => ({ type: VIDEO_ACTIONS.REMOVE_MEDIA, payload: id }),
  setCurrentMedia: (id) => ({ type: VIDEO_ACTIONS.SET_CURRENT_MEDIA, payload: id }),
  
  setExporting: (isExporting) => ({ type: VIDEO_ACTIONS.SET_EXPORTING, payload: isExporting }),
  setExportProgress: (progress) => ({ type: VIDEO_ACTIONS.SET_EXPORT_PROGRESS, payload: progress }),
  setExportFormat: (format) => ({ type: VIDEO_ACTIONS.SET_EXPORT_FORMAT, payload: format }),
  setExportQuality: (quality) => ({ type: VIDEO_ACTIONS.SET_EXPORT_QUALITY, payload: quality }),
  
  setProcessing: (isProcessing) => ({ type: VIDEO_ACTIONS.SET_PROCESSING, payload: isProcessing }),
  setProcessingMessage: (message) => ({ type: VIDEO_ACTIONS.SET_PROCESSING_MESSAGE, payload: message }),
  
  setError: (error) => ({ type: VIDEO_ACTIONS.SET_ERROR, payload: error }),
  clearError: () => ({ type: VIDEO_ACTIONS.CLEAR_ERROR }),
  
  setVideoMetadata: (metadata) => ({ type: VIDEO_ACTIONS.SET_VIDEO_METADATA, payload: metadata }),
  
  cacheThumbnail: (clipId, thumbnail) => ({ type: VIDEO_ACTIONS.CACHE_THUMBNAIL, payload: { clipId, thumbnail } }),
  cacheWaveform: (clipId, waveform) => ({ type: VIDEO_ACTIONS.CACHE_WAVEFORM, payload: { clipId, waveform } }),
  
  markSaved: () => ({ type: VIDEO_ACTIONS.MARK_SAVED }),
  markUnsaved: () => ({ type: VIDEO_ACTIONS.MARK_UNSAVED }),
  
  loadState: (state) => ({ type: VIDEO_ACTIONS.LOAD_STATE, payload: state }),
  resetState: () => ({ type: VIDEO_ACTIONS.RESET_STATE }),
};

// ==================== SELECTORS ====================

export const videoSelectors = {
  isClipSelected: (state, clipId) => state.selectedClipIds.includes(clipId),
  getSelectedClips: (state) => {
    if (!state.timeline) return [];
    const clips = [];
    for (const track of state.timeline.tracks) {
      for (const clip of track.clips) {
        if (state.selectedClipIds.includes(clip.id)) {
          clips.push(clip);
        }
      }
    }
    return clips;
  },
  getClipById: (state, clipId) => {
    if (!state.timeline) return null;
    for (const track of state.timeline.tracks) {
      const clip = track.clips.find((c) => c.id === clipId);
      if (clip) return clip;
    }
    return null;
  },
  getClipsAtTime: (state, time) => {
    if (!state.timeline) return [];
    const clips = [];
    for (const track of state.timeline.tracks) {
      for (const clip of track.clips) {
        if (time >= clip.startTime && time < clip.startTime + clip.duration) {
          clips.push(clip);
        }
      }
    }
    return clips;
  },
  getTotalDuration: (state) => state.timeline?.duration || 0,
  hasUnsavedChanges: (state) => state.hasUnsavedChanges,
};

export { DEFAULT_STATE };
export default videoReducer;
