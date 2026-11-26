// src/screens/CreatePost/createPostIcons.jsx
import { useId } from 'react';
import { tokens } from '../../design-system/tokens.js';

// Bespoke Arvdoul studio icons with unified 3D glass squircle chassis and collision-free IDs
const makeIconComponent = (renderSvg) => {
  const StudioIcon = ({ className = 'w-12 h-12' }) => {
    const uid = useId().replace(/:/g, '');
    return renderSvg(uid, className);
  };
  return StudioIcon;
};

const SharedSquircleDefs = ({ uid }) => (
  <>
    <linearGradient id={`brand-${uid}`} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor={tokens.color.brand.violet} />
      <stop offset="38%" stopColor={tokens.color.brand.indigo} />
      <stop offset="72%" stopColor={tokens.color.brand.blue} />
      <stop offset="100%" stopColor={tokens.color.brand.cyan} />
    </linearGradient>
    <linearGradient id={`glass-${uid}`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.34" />
      <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.08" />
      <stop offset="100%" stopColor="#020512" stopOpacity="0.36" />
    </linearGradient>
    <radialGradient id={`well-${uid}`} cx="50%" cy="42%" r="65%">
      <stop offset="0%" stopColor="#0F1B3A" />
      <stop offset="68%" stopColor="#070E23" />
      <stop offset="100%" stopColor="#040815" />
    </radialGradient>
    <clipPath id={`chamber-${uid}`}>
      <rect x="20" y="20" width="80" height="80" rx="20" />
    </clipPath>
    <filter id={`shadow-${uid}`} x="-25%" y="-20%" width="150%" height="160%">
      <feDropShadow dx="0" dy="7" stdDeviation="6" floodColor="#020512" floodOpacity="0.42" />
    </filter>
  </>
);

const SquircleChassis = ({ uid }) => (
  <>
    <rect
      x="12"
      y="12"
      width="96"
      height="96"
      rx="28"
      fill={`url(#brand-${uid})`}
      filter={`url(#shadow-${uid})`}
    />
    <rect x="12" y="12" width="96" height="96" rx="28" fill={`url(#glass-${uid})`} />
    <rect
      x="13.5"
      y="13.5"
      width="93"
      height="93"
      rx="26.5"
      fill="none"
      stroke="#FFFFFF"
      strokeOpacity="0.22"
      strokeWidth="1.5"
    />
  </>
);

export const TextIcon = makeIconComponent((uid, className) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className={className} aria-hidden="true">
    <defs>
      <SharedSquircleDefs uid={uid} />
    </defs>
    <SquircleChassis uid={uid} />
    <rect x="22" y="22" width="76" height="76" rx="19" fill={`url(#well-${uid})`} />
    <rect x="31" y="36" width="42" height="9" rx="4.5" fill={`url(#brand-${uid})`} />
    <circle cx="83" cy="40.5" r="4.5" fill="#7FE7FF" />
    <rect x="31" y="54" width="58" height="7.5" rx="3.75" fill="#DCE8FF" fillOpacity="0.88" />
    <rect x="31" y="69" width="46" height="7.5" rx="3.75" fill="#9BB8FF" fillOpacity="0.62" />
    <rect x="81" y="67.5" width="3.5" height="10.5" rx="1.75" fill="#7FE7FF" />
  </svg>
));

export const PhotoIcon = makeIconComponent((uid, className) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className={className} aria-hidden="true">
    <defs>
      <SharedSquircleDefs uid={uid} />
      <radialGradient id={`lens-${uid}`} cx="46%" cy="42%" r="58%">
        <stop offset="0%" stopColor="#EAFBFF" />
        <stop offset="28%" stopColor="#7FE7FF" />
        <stop offset="60%" stopColor={tokens.color.brand.blue} />
        <stop offset="100%" stopColor="#050919" />
      </radialGradient>
      <radialGradient id={`pupil-${uid}`}>
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
        <stop offset="35%" stopColor="#7FE7FF" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#040815" stopOpacity="0" />
      </radialGradient>
    </defs>
    <SquircleChassis uid={uid} />
    <rect x="22" y="22" width="76" height="76" rx="19" fill={`url(#well-${uid})`} />
    <rect x="33" y="28" width="20" height="4" rx="2" fill="#FFFFFF" fillOpacity="0.22" />
    <circle cx="83" cy="31" r="3" fill="#7FE7FF" />
    <circle cx="60" cy="63" r="26" fill="#040815" stroke="#FFFFFF" strokeOpacity="0.14" strokeWidth="1.5" />
    <circle cx="60" cy="63" r="21" fill={`url(#lens-${uid})`} />
    <circle cx="60" cy="63" r="14" fill="none" stroke="#EAFBFF" strokeOpacity="0.28" strokeWidth="1.5" />
    <circle cx="60" cy="63" r="10.5" fill="#050A1C" />
    <circle cx="60" cy="63" r="7" fill={`url(#pupil-${uid})`} />
    <circle cx="52" cy="54" r="4" fill="#FFFFFF" fillOpacity="0.45" />
    <circle cx="67" cy="51" r="2" fill="#FFFFFF" fillOpacity="0.3" />
  </svg>
));

export const VideoIcon = makeIconComponent((uid, className) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className={className} aria-hidden="true">
    <defs>
      <SharedSquircleDefs uid={uid} />
    </defs>
    <SquircleChassis uid={uid} />
    <rect x="22" y="22" width="76" height="76" rx="19" fill={`url(#well-${uid})`} />
    <g fill="#FFFFFF" fillOpacity="0.18">
      <rect x="31" y="28" width="8" height="4" rx="2" />
      <rect x="47" y="28" width="8" height="4" rx="2" />
      <rect x="65" y="28" width="8" height="4" rx="2" />
      <rect x="81" y="28" width="8" height="4" rx="2" />
      <rect x="31" y="88" width="8" height="4" rx="2" />
      <rect x="47" y="88" width="8" height="4" rx="2" />
      <rect x="65" y="88" width="8" height="4" rx="2" />
      <rect x="81" y="88" width="8" height="4" rx="2" />
    </g>
    <path
      d="M49 43.5 C49 41.2 51.6 39.8 53.6 41 L79.8 57.5 C81.6 58.6 81.6 61.4 79.8 62.5 L53.6 79 C51.6 80.2 49 78.8 49 76.5 Z"
      fill={`url(#brand-${uid})`}
    />
    <path
      d="M52 46.5 L74.5 60 L52 73.5 Z"
      fill="none"
      stroke="#EAFBFF"
      strokeOpacity="0.36"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
));

export const VibeIcon = makeIconComponent((uid, className) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className={className} aria-hidden="true">
    <defs>
      <SharedSquircleDefs uid={uid} />
      <radialGradient id={`aura-${uid}`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#7FE7FF" stopOpacity="0.65" />
        <stop offset="55%" stopColor={tokens.color.brand.indigo} stopOpacity="0.24" />
        <stop offset="100%" stopColor={tokens.color.brand.violet} stopOpacity="0" />
      </radialGradient>
    </defs>
    <SquircleChassis uid={uid} />
    <rect x="22" y="22" width="76" height="76" rx="19" fill={`url(#well-${uid})`} />
    <circle cx="60" cy="60" r="29" fill={`url(#aura-${uid})`} />
    <circle
      cx="60"
      cy="60"
      r="24"
      fill="none"
      stroke={`url(#brand-${uid})`}
      strokeWidth="4.5"
      strokeDasharray="112 38"
      strokeLinecap="round"
      transform="rotate(-35 60 60)"
    />
    <circle cx="81" cy="48" r="3" fill="#7FE7FF" />
    <path
      d="M60 39 L64.8 55.2 L81 60 L64.8 64.8 L60 81 L55.2 64.8 L39 60 L55.2 55.2 Z"
      fill={`url(#brand-${uid})`}
      stroke="#EAFBFF"
      strokeOpacity="0.45"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <circle cx="60" cy="60" r="4.2" fill="#EAFBFF" />
  </svg>
));

export const PollIcon = makeIconComponent((uid, className) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className={className} aria-hidden="true">
    <defs>
      <SharedSquircleDefs uid={uid} />
    </defs>
    <SquircleChassis uid={uid} />
    <rect x="22" y="22" width="76" height="76" rx="19" fill={`url(#well-${uid})`} />
    <g clipPath={`url(#chamber-${uid})`}>
      <rect x="30" y="84" width="60" height="3" rx="1.5" fill="#FFFFFF" fillOpacity="0.16" />
      <rect x="32" y="56" width="14" height="24" rx="6" fill={`url(#brand-${uid})`} />
      <rect x="53" y="34" width="14" height="46" rx="6" fill={`url(#brand-${uid})`} />
      <rect x="74" y="45" width="14" height="35" rx="6" fill={`url(#brand-${uid})`} />
      <circle cx="39" cy="61" r="2.2" fill="#EAFBFF" fillOpacity="0.85" />
      <circle cx="60" cy="39" r="2.5" fill="#7FE7FF" />
      <circle cx="81" cy="50" r="2.2" fill="#EAFBFF" fillOpacity="0.85" />
    </g>
  </svg>
));

export const QuestionIcon = makeIconComponent((uid, className) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className={className} aria-hidden="true">
    <defs>
      <SharedSquircleDefs uid={uid} />
    </defs>
    <SquircleChassis uid={uid} />
    <rect x="22" y="22" width="76" height="76" rx="19" fill={`url(#well-${uid})`} />
    <circle cx="60" cy="60" r="30" fill="none" stroke="#FFFFFF" strokeOpacity="0.08" strokeWidth="1.5" />
    <path
      d="M47.5 46.5 C47.5 38 54 33.5 61 34 C68 34.5 72.5 39.5 71.8 46 C71.2 51.2 66.5 53.8 62.6 56.6 C60.6 58 60 60 60 63.5"
      fill="none"
      stroke={`url(#brand-${uid})`}
      strokeWidth="9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M47.5 46.5 C47.5 38 54 33.5 61 34 C68 34.5 72.5 39.5 71.8 46"
      fill="none"
      stroke="#EAFBFF"
      strokeOpacity="0.32"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    <circle cx="60" cy="79" r="5" fill="#7FE7FF" />
    <circle cx="60" cy="79" r="2.1" fill="#FFFFFF" />
  </svg>
));

export const LinkIcon = makeIconComponent((uid, className) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className={className} aria-hidden="true">
    <defs>
      <SharedSquircleDefs uid={uid} />
    </defs>
    <SquircleChassis uid={uid} />
    <rect x="22" y="22" width="76" height="76" rx="19" fill={`url(#well-${uid})`} />
    <g transform="rotate(-38 60 60)">
      <rect
        x="29"
        y="48"
        width="34"
        height="24"
        rx="12"
        fill="none"
        stroke={`url(#brand-${uid})`}
        strokeWidth="7.5"
      />
      <rect
        x="57"
        y="48"
        width="34"
        height="24"
        rx="12"
        fill="none"
        stroke={`url(#brand-${uid})`}
        strokeWidth="7.5"
      />
      <rect x="49" y="56.5" width="22" height="7" rx="3.5" fill="#070E23" />
      <rect x="51" y="57.2" width="18" height="5.6" rx="2.8" fill="#7FE7FF" />
    </g>
  </svg>
));

export const AudioIcon = makeIconComponent((uid, className) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className={className} aria-hidden="true">
    <defs>
      <SharedSquircleDefs uid={uid} />
    </defs>
    <SquircleChassis uid={uid} />
    <rect x="22" y="22" width="76" height="76" rx="19" fill={`url(#well-${uid})`} />
    <g clipPath={`url(#chamber-${uid})`}>
      <rect x="31" y="51" width="8" height="18" rx="4" fill={`url(#brand-${uid})`} />
      <rect x="43.5" y="40" width="8" height="40" rx="4" fill={`url(#brand-${uid})`} />
      <rect x="56" y="32" width="8" height="56" rx="4" fill={`url(#brand-${uid})`} />
      <rect x="68.5" y="40" width="8" height="40" rx="4" fill={`url(#brand-${uid})`} />
      <rect x="81" y="51" width="8" height="18" rx="4" fill={`url(#brand-${uid})`} />
      <circle cx="60" cy="36" r="2.2" fill="#7FE7FF" />
      <circle cx="47.5" cy="44" r="1.8" fill="#EAFBFF" fillOpacity="0.85" />
      <circle cx="72.5" cy="44" r="1.8" fill="#EAFBFF" fillOpacity="0.85" />
    </g>
  </svg>
));

export const EventIcon = makeIconComponent((uid, className) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className={className} aria-hidden="true">
    <defs>
      <SharedSquircleDefs uid={uid} />
    </defs>
    <SquircleChassis uid={uid} />
    <rect x="22" y="26" width="76" height="72" rx="18" fill={`url(#well-${uid})`} />
    <rect x="22" y="26" width="76" height="20" rx="10" fill="#FFFFFF" fillOpacity="0.10" />
    <rect x="38" y="19" width="6" height="12" rx="3" fill="#EAFBFF" />
    <rect x="76" y="19" width="6" height="12" rx="3" fill="#7FE7FF" />
    <rect x="34" y="55" width="9" height="9" rx="3" fill={tokens.color.brand.violet} fillOpacity="0.8" />
    <rect x="48" y="55" width="9" height="9" rx="3" fill={tokens.color.brand.indigo} fillOpacity="0.8" />
    <rect x="63" y="55" width="9" height="9" rx="3" fill={tokens.color.brand.blue} fillOpacity="0.8" />
    <rect x="77" y="55" width="9" height="9" rx="3" fill="#FFFFFF" fillOpacity="0.2" />
    <rect x="34" y="70" width="9" height="9" rx="3" fill="#FFFFFF" fillOpacity="0.2" />
    <rect x="48" y="70" width="24" height="14" rx="5" fill={`url(#brand-${uid})`} />
    <circle cx="60" cy="77" r="3" fill="#EAFBFF" />
    <rect x="77" y="70" width="9" height="9" rx="3" fill="#FFFFFF" fillOpacity="0.2" />
  </svg>
));
