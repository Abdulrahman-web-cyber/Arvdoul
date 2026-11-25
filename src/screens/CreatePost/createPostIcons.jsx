// src/screens/CreatePost/createPostIcons.jsx
import { useId } from 'react';
import { tokens } from '../../design-system/tokens.js';

// Bespoke Arvdoul studio icons with collision-free instance IDs
const makeIconComponent = (renderSvg) => {
  const StudioIcon = ({ className = 'w-12 h-12' }) => {
    const uid = useId().replace(/:/g, '');
    return renderSvg(uid, className);
  };
  return StudioIcon;
};

export const PhotoIcon = makeIconComponent((uid, className) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className={className} aria-hidden="true">
    <defs>
      <linearGradient id={`g-${uid}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={tokens.color.brand.violet} />
        <stop offset="35%" stopColor={tokens.color.brand.indigo} />
        <stop offset="70%" stopColor={tokens.color.brand.blue} />
        <stop offset="100%" stopColor={tokens.color.brand.cyan} />
      </linearGradient>
      <linearGradient id={`glass-${uid}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.40" />
        <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.10" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
      </linearGradient>
      <radialGradient id={`lens-${uid}`}>
        <stop offset="0%" stopColor="#EAFBFF" />
        <stop offset="25%" stopColor="#7FE7FF" />
        <stop offset="55%" stopColor="#1B8CFF" />
        <stop offset="100%" stopColor="#050816" />
      </radialGradient>
      <radialGradient id={`core-${uid}`}>
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
        <stop offset="30%" stopColor="#9BE9FF" stopOpacity="0.55" />
        <stop offset="70%" stopColor={tokens.color.brand.cyan} stopOpacity="0.12" />
        <stop offset="100%" stopColor={tokens.color.brand.cyan} stopOpacity="0" />
      </radialGradient>
      <filter id={`shadow-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#000000" floodOpacity="0.45" />
      </filter>
    </defs>
    <rect x="10" y="20" width="100" height="80" rx="28" fill={`url(#g-${uid})`} filter={`url(#shadow-${uid})`} />
    <rect x="10" y="20" width="100" height="80" rx="28" fill={`url(#glass-${uid})`} />
    <rect x="12" y="22" width="96" height="76" rx="26" fill="none" stroke="#FFFFFF" strokeOpacity="0.16" />
    <rect x="18" y="28" width="84" height="10" rx="5" fill="#FFFFFF" opacity="0.16" />
    <circle cx="92" cy="33" r="2" fill="#7FE7FF" opacity="0.75" />
    <circle cx="60" cy="62" r="33" fill="#050A14" />
    <circle cx="60" cy="62" r="26" fill={`url(#lens-${uid})`} />
    <circle cx="60" cy="62" r="21" fill="none" stroke="#BFEFFF" strokeOpacity="0.22" strokeWidth="2" />
    <circle cx="60" cy="62" r="13" fill="#061022" />
    <circle cx="60" cy="62" r="11" fill={`url(#core-${uid})`} />
    <circle cx="53" cy="55" r="5" fill="#FFFFFF" opacity="0.25" />
    <circle cx="66" cy="50" r="2.5" fill="#FFFFFF" opacity="0.18" />
    <rect x="44" y="18" width="32" height="6" rx="3" fill="#FFFFFF" opacity="0.12" />
  </svg>
));

export const EventIcon = makeIconComponent((uid, className) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className={className} aria-hidden="true">
    <defs>
      <linearGradient id={`g-${uid}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={tokens.color.brand.violet} />
        <stop offset="35%" stopColor={tokens.color.brand.indigo} />
        <stop offset="70%" stopColor={tokens.color.brand.blue} />
        <stop offset="100%" stopColor={tokens.color.brand.cyan} />
      </linearGradient>
      <linearGradient id={`glass-${uid}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.28" />
        <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.08" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.40" />
      </linearGradient>
      <radialGradient id={`corePulse-${uid}`}>
        <stop offset="0%" stopColor="#7FE7FF" stopOpacity="0.95" />
        <stop offset="40%" stopColor={tokens.color.brand.blue} stopOpacity="0.25" />
        <stop offset="100%" stopColor={tokens.color.brand.cyan} stopOpacity="0" />
      </radialGradient>
      <filter id={`shadow-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#000000" floodOpacity="0.45" />
      </filter>
    </defs>
    <rect x="14" y="16" width="92" height="88" rx="26" fill={`url(#g-${uid})`} filter={`url(#shadow-${uid})`} />
    <rect x="14" y="16" width="92" height="88" rx="26" fill={`url(#glass-${uid})`} />
    <rect x="22" y="24" width="76" height="14" rx="7" fill="#FFFFFF" opacity="0.14" />
    <circle cx="32" cy="31" r="3" fill="#7FE7FF" opacity="0.9" />
    <circle cx="88" cy="31" r="3" fill="#FF4FD8" opacity="0.8" />
    <rect x="24" y="42" width="72" height="56" rx="18" fill="#08101A" opacity="0.65" />
    <circle cx="60" cy="66" r="16" fill={`url(#corePulse-${uid})`} />
    <circle cx="60" cy="66" r="9" fill="#7FE7FF" />
    <circle cx="60" cy="66" r="3.5" fill="#FFFFFF" />
    <circle cx="38" cy="52" r="3.2" fill={tokens.color.brand.violet} />
    <circle cx="82" cy="52" r="3.2" fill={tokens.color.brand.blue} />
    <circle cx="38" cy="78" r="3.2" fill={tokens.color.brand.cyan} />
    <circle cx="82" cy="78" r="3.2" fill="#7FE7FF" />
  </svg>
));

export const QuestionIcon = makeIconComponent((uid, className) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className={className} aria-hidden="true">
    <defs>
      <linearGradient id={`arvdoul-gradient-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={tokens.color.brand.violet} />
        <stop offset="35%" stopColor={tokens.color.brand.indigo} />
        <stop offset="70%" stopColor={tokens.color.brand.blue} />
        <stop offset="100%" stopColor={tokens.color.brand.cyan} />
      </linearGradient>
      <radialGradient id={`core-bg-${uid}`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#0F1A33" />
        <stop offset="70%" stopColor="#070D1F" />
        <stop offset="100%" stopColor="#03060D" />
      </radialGradient>
      <filter id={`shadow-${uid}`} x="-25%" y="-15%" width="150%" height="150%">
        <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#000000" floodOpacity="0.45" />
      </filter>
    </defs>
    <circle cx="60" cy="60" r="52" fill={`url(#arvdoul-gradient-${uid})`} filter={`url(#shadow-${uid})`} />
    <circle cx="60" cy="60" r="43.5" fill={`url(#core-bg-${uid})`} />
    <path
      d="M 46 44 C 46 33 57 27 66 30 C 74 33 76 42 71 48 C 65 55 60 59 60 68"
      fill="none"
      stroke={`url(#arvdoul-gradient-${uid})`}
      strokeWidth="9.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="60" cy="86" r="4.8" fill="#7FE7FF" />
    <circle cx="60" cy="86" r="2" fill="#FFFFFF" />
  </svg>
));

export const PollIcon = makeIconComponent((uid, className) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className={className} aria-hidden="true">
    <defs>
      <linearGradient id={`arvdoul-gradient-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={tokens.color.brand.violet} />
        <stop offset="35%" stopColor={tokens.color.brand.indigo} />
        <stop offset="70%" stopColor={tokens.color.brand.blue} />
        <stop offset="100%" stopColor={tokens.color.brand.cyan} />
      </linearGradient>
      <filter id={`depth-${uid}`} x="-25%" y="-20%" width="150%" height="160%">
        <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#000000" floodOpacity="0.25" />
      </filter>
    </defs>
    <rect x="18" y="62" width="20" height="38" rx="10" fill={`url(#arvdoul-gradient-${uid})`} filter={`url(#depth-${uid})`} />
    <rect x="50" y="24" width="20" height="76" rx="10" fill={`url(#arvdoul-gradient-${uid})`} filter={`url(#depth-${uid})`} />
    <rect x="82" y="42" width="20" height="58" rx="10" fill={`url(#arvdoul-gradient-${uid})`} filter={`url(#depth-${uid})`} />
  </svg>
));

export const TextIcon = makeIconComponent((uid, className) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className={className} aria-hidden="true">
    <defs>
      <linearGradient id={`g-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={tokens.color.brand.violet} />
        <stop offset="35%" stopColor={tokens.color.brand.indigo} />
        <stop offset="70%" stopColor={tokens.color.brand.blue} />
        <stop offset="100%" stopColor={tokens.color.brand.cyan} />
      </linearGradient>
      <filter id={`depth-${uid}`} x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#000000" floodOpacity="0.25" />
      </filter>
    </defs>
    <rect x="14" y="14" width="92" height="92" rx="24" fill={`url(#g-${uid})`} filter={`url(#depth-${uid})`} />
    <rect x="28" y="37" width="64" height="10" rx="5" fill="#07101A" opacity="0.50" />
    <rect x="28" y="55" width="48" height="10" rx="5" fill="#07101A" opacity="0.50" />
    <rect x="28" y="73" width="58" height="10" rx="5" fill="#07101A" opacity="0.50" />
  </svg>
));

export const VideoIcon = makeIconComponent((uid, className) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className={className} aria-hidden="true">
    <defs>
      <linearGradient id={`g-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={tokens.color.brand.violet} />
        <stop offset="35%" stopColor={tokens.color.brand.indigo} />
        <stop offset="70%" stopColor={tokens.color.brand.blue} />
        <stop offset="100%" stopColor={tokens.color.brand.cyan} />
      </linearGradient>
      <radialGradient id={`core-${uid}`} cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="#121C36" />
        <stop offset="70%" stopColor="#070D1F" />
        <stop offset="100%" stopColor="#050914" />
      </radialGradient>
      <filter id={`shadow-${uid}`} x="-25%" y="-25%" width="150%" height="150%">
        <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#000000" floodOpacity="0.4" />
      </filter>
    </defs>
    <circle cx="60" cy="60" r="52" fill={`url(#g-${uid})`} filter={`url(#shadow-${uid})`} />
    <circle cx="60" cy="60" r="41.5" fill={`url(#core-${uid})`} />
    <path d="M54 44 L84 60 L54 76 Z" fill={`url(#g-${uid})`} />
  </svg>
));

export const AudioIcon = makeIconComponent((uid, className) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className={className} aria-hidden="true">
    <defs>
      <linearGradient id={`g-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={tokens.color.brand.violet} />
        <stop offset="35%" stopColor={tokens.color.brand.indigo} />
        <stop offset="70%" stopColor={tokens.color.brand.blue} />
        <stop offset="100%" stopColor={tokens.color.brand.cyan} />
      </linearGradient>
      <radialGradient id={`core-${uid}`} cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="#121C36" />
        <stop offset="70%" stopColor="#070D1F" />
        <stop offset="100%" stopColor="#050914" />
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="52" fill={`url(#g-${uid})`} />
    <circle cx="60" cy="60" r="41.5" fill={`url(#core-${uid})`} />
    <rect x="26" y="60" width="10" height="22" rx="5" fill={`url(#g-${uid})`} />
    <rect x="42" y="44" width="10" height="54" rx="5" fill={`url(#g-${uid})`} />
    <rect x="55" y="30" width="10" height="70" rx="5" fill={`url(#g-${uid})`} />
    <rect x="68" y="44" width="10" height="54" rx="5" fill={`url(#g-${uid})`} />
    <rect x="84" y="60" width="10" height="22" rx="5" fill={`url(#g-${uid})`} />
  </svg>
));

export const VibeIcon = makeIconComponent((uid, className) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className={className} aria-hidden="true">
    <defs>
      <linearGradient id={`g-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={tokens.color.brand.violet} />
        <stop offset="35%" stopColor={tokens.color.brand.indigo} />
        <stop offset="70%" stopColor={tokens.color.brand.blue} />
        <stop offset="100%" stopColor={tokens.color.brand.cyan} />
      </linearGradient>
      <radialGradient id={`core-${uid}`} cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="#0F1A33" />
        <stop offset="75%" stopColor="#070D1F" />
        <stop offset="100%" stopColor="#050914" />
      </radialGradient>
    </defs>
    <circle cx="60" cy="60" r="52" fill={`url(#g-${uid})`} />
    <circle cx="60" cy="60" r="37" fill={`url(#core-${uid})`} />
    <circle cx="60" cy="60" r="18" fill="none" stroke={`url(#g-${uid})`} strokeWidth="6" opacity="0.9" />
    <circle cx="60" cy="60" r="7" fill="#7FE7FF" />
  </svg>
));

export const LinkIcon = makeIconComponent((uid, className) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className={className} aria-hidden="true">
    <defs>
      <linearGradient id={`g-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={tokens.color.brand.violet} />
        <stop offset="35%" stopColor={tokens.color.brand.indigo} />
        <stop offset="70%" stopColor={tokens.color.brand.blue} />
        <stop offset="100%" stopColor={tokens.color.brand.cyan} />
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="52" fill={`url(#g-${uid})`} />
    <circle cx="60" cy="60" r="40" fill="#070D1F" />
    <rect x="26" y="48" width="36" height="24" rx="12" fill="none" stroke={`url(#g-${uid})`} strokeWidth="8" />
    <rect x="58" y="48" width="36" height="24" rx="12" fill="none" stroke={`url(#g-${uid})`} strokeWidth="8" />
    <rect x="52" y="56" width="16" height="8" rx="4" fill={`url(#g-${uid})`} />
  </svg>
));
