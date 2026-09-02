// src/components/Shared/CoinStackIcon.jsx - 3D GOLD COIN STACK ICON
import React, { memo } from 'react';
import PropTypes from 'prop-types';

/**
 * CoinStackIcon - 3D stacked gold coin discs matching Image 1
 */
export const CoinStackIcon = memo(({ size = 24, className = '' }) => {
  const s = typeof size === 'number' ? `${size}px` : size;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform ${className}`}
      aria-label="Coins"
    >
      <defs>
        {/* Top coin face gradient */}
        <linearGradient id="coin-gold-top" x1="6" y1="4" x2="30" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="35%" stopColor="#FBBF24" />
          <stop offset="70%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>

        {/* Coin edge cylinder gradient */}
        <linearGradient id="coin-gold-edge" x1="4" y1="12" x2="32" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#B45309" />
          <stop offset="25%" stopColor="#F59E0B" />
          <stop offset="50%" stopColor="#FDE68A" />
          <stop offset="75%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#92400E" />
        </linearGradient>

        {/* Middle coin edge */}
        <linearGradient id="coin-gold-edge-mid" x1="4" y1="19" x2="32" y2="19" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#B45309" />
          <stop offset="30%" stopColor="#F59E0B" />
          <stop offset="55%" stopColor="#FEF08A" />
          <stop offset="80%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>

        {/* Bottom coin edge */}
        <linearGradient id="coin-gold-edge-bot" x1="4" y1="26" x2="32" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#92400E" />
          <stop offset="30%" stopColor="#D97706" />
          <stop offset="55%" stopColor="#FDE68A" />
          <stop offset="80%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>

        {/* Drop shadow */}
        <filter id="coin-shadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#78350F" floodOpacity="0.4" />
        </filter>
      </defs>

      <g filter="url(#coin-shadow)">
        {/* BOTTOM COIN */}
        {/* Cylinder side */}
        <path
          d="M6 23.5V26.5C6 29.5 11.4 32 18 32C24.6 32 30 29.5 30 26.5V23.5C28.2 26 23.4 27.5 18 27.5C12.6 27.5 7.8 26 6 23.5Z"
          fill="url(#coin-gold-edge-bot)"
        />
        {/* Top face */}
        <ellipse cx="18" cy="24" rx="12" ry="4.2" fill="url(#coin-gold-top)" />

        {/* MIDDLE COIN */}
        {/* Cylinder side */}
        <path
          d="M6 16.5V19.5C6 22.5 11.4 25 18 25C24.6 25 30 22.5 30 19.5V16.5C28.2 19 23.4 20.5 18 20.5C12.6 20.5 7.8 19 6 16.5Z"
          fill="url(#coin-gold-edge-mid)"
        />
        {/* Top face */}
        <ellipse cx="18" cy="17" rx="12" ry="4.2" fill="url(#coin-gold-top)" />

        {/* TOP COIN */}
        {/* Cylinder side */}
        <path
          d="M6 9.5V12.5C6 15.5 11.4 18 18 18C24.6 18 30 15.5 30 12.5V9.5C28.2 12 23.4 13.5 18 13.5C12.6 13.5 7.8 12 6 9.5Z"
          fill="url(#coin-gold-edge)"
        />
        {/* Top face with rim */}
        <ellipse cx="18" cy="10" rx="12" ry="4.5" fill="url(#coin-gold-top)" />
        {/* Inner rim circle */}
        <ellipse cx="18" cy="10" rx="9.5" ry="3.3" fill="none" stroke="#FEF08A" strokeWidth="0.8" opacity="0.8" />
        {/* Center spark */}
        <ellipse cx="16" cy="9.2" rx="3" ry="1.2" fill="#FFFBEB" opacity="0.6" />
      </g>
    </svg>
  );
});

CoinStackIcon.displayName = 'CoinStackIcon';
CoinStackIcon.propTypes = {
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
};

export default CoinStackIcon;
