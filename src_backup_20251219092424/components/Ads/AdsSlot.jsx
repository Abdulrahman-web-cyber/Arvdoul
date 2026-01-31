// src/components/Ads/AdsSlot.jsx
import React, { useEffect } from "react";

/**
 * AdsSlot: displays ad creative and calls onImpression once when visible.
 * - ad: { id, mediaUrl, title, clickUrl }
 */
export default function AdsSlot({ ad = {}, onImpression = () => {} }) {
  useEffect(() => {
    onImpression?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ad) return null;
  return (
    <div className="max-w-md w-full p-4 bg-gray-800 rounded-xl text-white">
      <div className="text-xs mb-2">Sponsored</div>
      {ad.mediaUrl && <img src={ad.mediaUrl} alt={`ad.title || "ad"} className="w-full h-56 object-cover rounded-md mb-2" />`}
      <div className="font-semibold">{ad.title}</div>
      <a href={ad.clickUrl || "#"} target="_blank" rel="noreferrer" className="text-sm underline mt-2 inline-block">Visit</a>
    </div>
  );
}