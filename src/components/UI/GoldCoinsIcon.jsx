import { memo, useId } from 'react';

/**
 * Canonical metallic Gold Arvdoul stacked coins icon.
 * Uses instance-unique SVG gradient IDs so multiple icons on the same screen
 * never collide in Chromium/WebKit gradient caches.
 */
export const GoldCoinsIcon = memo(function GoldCoinsIcon({ className = 'w-6 h-6', ...props }) {
  const id = useId().replace(/:/g, '');
  const goldGradient = `arvdoul-gold-${id}`;
  const darkGoldGradient = `arvdoul-dark-gold-${id}`;
  const rimHighlight = `arvdoul-gold-rim-${id}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <defs>
        <linearGradient id={goldGradient} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF8C9" />
          <stop offset="28%" stopColor="#FFE066" />
          <stop offset="68%" stopColor="#F5A623" />
          <stop offset="100%" stopColor="#D49A1A" />
        </linearGradient>
        <linearGradient id={darkGoldGradient} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#B8860B" />
          <stop offset="50%" stopColor="#DAA520" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
        <linearGradient id={rimHighlight} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFBEB" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${goldGradient})`}
        d="M21 6.375c0 2.692-4.03 4.875-9 4.875S3 9.067 3 6.375 7.03 1.5 12 1.5s9 2.183 9 4.875Z"
      />
      <ellipse
        cx="12"
        cy="5.9"
        rx="6.2"
        ry="2.55"
        fill="none"
        stroke={`url(#${rimHighlight})`}
        strokeWidth="0.7"
      />
      <path
        fill={`url(#${goldGradient})`}
        d="M12 12.75c2.685 0 5.19-.586 7.078-1.609a8.283 8.283 0 0 0 1.897-1.384c.016.121.025.244.025.368C21 12.817 16.97 15 12 15s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.285 8.285 0 0 0 1.897 1.384C6.809 12.164 9.315 12.75 12 12.75Z"
      />
      <path
        fill={`url(#${darkGoldGradient})`}
        d="M12 16.5c2.685 0 5.19-.586 7.078-1.609a8.282 8.282 0 0 0 1.897-1.384c.016.121.025.244.025.368 0 2.692-4.03 4.875-9 4.875s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.284 8.284 0 0 0 1.897 1.384C6.809 15.914 9.315 16.5 12 16.5Z"
      />
      <path
        fill={`url(#${goldGradient})`}
        d="M12 20.25c2.685 0 5.19-.586 7.078-1.609a8.282 8.282 0 0 0 1.897-1.384c.016.121.025.244.025.368 0 2.692-4.03 4.875-9 4.875s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.284 8.284 0 0 0 1.897 1.384C6.809 19.664 9.315 20.25 12 20.25Z"
      />
    </svg>
  );
});

GoldCoinsIcon.displayName = 'GoldCoinsIcon';
export default GoldCoinsIcon;
