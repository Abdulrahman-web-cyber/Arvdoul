// src/components/Ads/AdsSlot.jsx
// ARVDOUL DYNAMIC AD SLOT COMPONENT
import React from 'react';
import SponsoredPostCard from './SponsoredPostCard';

export default function AdsSlot({ ad = null, placement = 'home', onImpression = () => {} }) {
  return (
    <SponsoredPostCard
      adData={ad}
      placement={placement}
      onAdHidden={() => {}}
    />
  );
}
