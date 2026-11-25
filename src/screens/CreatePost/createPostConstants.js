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

export const COMPOSER_SECTIONS = [
  { id: '01', key: 'content', label: '01 Content' },
  { id: '02', key: 'identity', label: '02 Identity' },
  { id: '03', key: 'audience', label: '03 Audience' },
  { id: '04', key: 'engagement', label: '04 Engagement' },
  { id: '05', key: 'commercial', label: '05 Commercial' },
  { id: '06', key: 'programs', label: '06 Creator' },
  { id: '07', key: 'promotion', label: '07 Promotion' },
  { id: '08', key: 'analytics', label: '08 Analytics' },
  { id: '09', key: 'safety', label: '09 Safety' },
  { id: '10', key: 'schedule', label: '10 Schedule' },
];

export const COMMERCIAL_TYPES = [
  {
    id: 'none',
    label: 'Organic Post',
    badge: null,
    description: 'Standard organic post with no brand, commercial, or paid sponsorship.',
  },
  {
    id: 'own_promotion',
    label: 'Promotional Content',
    badge: 'Promotional content',
    description: 'Promoting your own business, store, event, digital product, or service.',
  },
  {
    id: 'paid_partnership',
    label: 'Paid Partnership',
    badge: 'Paid partnership',
    description: 'Creator collaboration compensated by a brand or partner with disclosure.',
  },
  {
    id: 'sponsored_ad',
    label: 'Sponsored Ad Creative',
    badge: 'Sponsored',
    description: 'Formal paid advertising creative managed via the Advertising Center.',
  },
];

export const REGIONAL_DISCLOSURE_STANDARDS = [
  { id: 'global', label: 'Global Transparency Standard' },
  { id: 'us_ftc', label: 'United States (FTC Endorsement Guides)' },
  { id: 'ng_arcon', label: 'Nigeria (ARCON Advertising Code)' },
  { id: 'eu_dsa', label: 'European Union (DSA Commercial Disclosure)' },
];

export const AD_OBJECTIVES = [
  { id: 'reach', label: 'Reach', desc: 'Maximize unique viewers' },
  { id: 'impressions', label: 'Impressions', desc: 'Maximize total views' },
  { id: 'engagement', label: 'Engagement', desc: 'Likes, comments, shares, saves' },
  { id: 'profile_visits', label: 'Profile Visits', desc: 'Grow profile visits and followers' },
  { id: 'clicks', label: 'Website Clicks', desc: 'Drive external destination visits' },
  { id: 'conversions', label: 'Conversions', desc: 'Track signups, sales, or RSVPs' },
];

export const PROMOTION_KINDS = [
  { id: 'post', label: 'Boost this post', desc: 'Preserve original post & organic engagement' },
  { id: 'spark_video', label: 'Promote video / Spark', desc: 'Use existing organic video as paid Spark ad' },
  { id: 'profile', label: 'Promote profile', desc: 'Drive profile visits and new followers' },
  { id: 'website', label: 'Promote website', desc: 'Send visitors to an external URL' },
  { id: 'product', label: 'Promote product / service', desc: 'Drive product discovery, leads, or sales' },
  { id: 'event', label: 'Promote event', desc: 'Increase event registrations and RSVPs' },
];

export const AD_PLACEMENTS = [
  { id: 'home', label: 'Home Feed' },
  { id: 'sparks', label: 'Sparks / Short Video' },
  { id: 'explore', label: 'Explore & Communities' },
  { id: 'search', label: 'Search & Discovery' },
];

export const AGE_RATINGS = [
  { id: 'all', label: 'All Ages' },
  { id: '13+', label: '13+ Teen & Adult' },
  { id: '18+', label: '18+ Mature Only' },
];

export const COMMENT_MODES = [
  { id: 'everyone', label: 'Everyone' },
  { id: 'followers', label: 'Followers & Friends' },
  { id: 'off', label: 'Comments Off' },
];

