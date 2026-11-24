// src/screens/CreatePost/createPostConstants.js
import {
  PhotoIcon,
  EventIcon,
  QuestionIcon,
  PollIcon,
  TextIcon,
  VideoIcon,
  AudioIcon,
  VibeIcon,
  LinkIcon,
} from './createPostIcons.jsx';

export {
  PhotoIcon,
  EventIcon,
  QuestionIcon,
  PollIcon,
  TextIcon,
  VideoIcon,
  AudioIcon,
  VibeIcon,
  LinkIcon,
};

export const DRAFT_DB_NAME = 'arvdoul_create_post_v6';
export const DRAFT_DB_VERSION = 5;
export const DRAFTS_STORE = 'drafts';
export const OFFLINE_QUEUE_STORE = 'offline_queue';
export const MEDIA_BLOB_STORE = 'media_blobs';
export const BLOB_HASH_STORE = 'blob_hashes';
export const VERSIONS_STORE = 'draft_versions';
export const TEMPLATES_STORE = 'templates';
export const MEDIA_UPLOAD_QUEUE_STORE = 'media_upload_queue';

export const MAX_VERSIONS_PER_DRAFT = 15;
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

export const INPUT_CLASS =
  'w-full px-3.5 py-2.5 rounded-xl border text-sm transition-colors ' +
  'bg-white/95 dark:bg-[#080F2E]/90 text-slate-900 dark:text-white ' +
  'border-slate-200/90 dark:border-white/12 placeholder:text-slate-400 dark:placeholder:text-slate-500 ' +
  'focus-visible:ring-2 focus-visible:ring-arvdoul-purple focus:outline-none';

export const SURFACE_GLASS_CLASS =
  'rounded-2xl border backdrop-blur-xl transition-colors ' +
  'bg-white/90 dark:bg-[#080F2E]/75 border-slate-200/80 dark:border-white/10 ' +
  'shadow-[0_12px_36px_-12px_rgba(3,7,27,0.12)] dark:shadow-[0_18px_44px_-12px_rgba(0,0,0,0.55)]';

export const POST_TYPES = [
  { id: 'text', label: 'Text', icon: TextIcon, subtitle: 'Write your thoughts' },
  { id: 'image', label: 'Photo', icon: PhotoIcon, subtitle: 'Share moments' },
  { id: 'video', label: 'Video', icon: VideoIcon, subtitle: 'Record & share' },
  { id: 'vibe', label: 'Vibe', icon: VibeIcon, isStory: true, subtitle: 'Capture the moment' },
  { id: 'poll', label: 'Poll', icon: PollIcon, subtitle: 'Get opinions' },
  { id: 'question', label: 'Questions', icon: QuestionIcon, subtitle: 'Ask anything' },
  { id: 'link', label: 'Links', icon: LinkIcon, subtitle: 'Share resources' },
  { id: 'audio', label: 'Audio', icon: AudioIcon, subtitle: 'Sound & voice' },
  { id: 'event', label: 'Events', icon: EventIcon, subtitle: 'Plan together' },
];

export const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'followers', label: 'Followers' },
  { value: 'friends', label: 'Friends' },
  { value: 'only_me', label: 'Only Me' },
];

export const MEDIA_LIMITS = {
  maxImages: 10,
  maxVideos: 1,
  maxVideoDurationSec: 600,
  maxFileSizeMB: 100,
  maxImageSizeMB: 10,
  maxTotalMediaCount: 10,
};
