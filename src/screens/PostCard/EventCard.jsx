// src/screens/PostCard/EventCard.jsx

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Calendar, MapPin, CheckCircle, Clock,
  UserPlus, UserCheck, Image
} from 'lucide-react';
import { format, differenceInDays, differenceInHours, differenceInMinutes } from 'date-fns';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';

// Safe date normalizer
const toDate = (dateish) => {
  if (!dateish) return null;
  if (dateish.toDate) return dateish.toDate();
  const d = new Date(dateish);
  return isNaN(d.getTime()) ? null : d;
};

// Word‑safe truncation (avoids cutting emojis/mid‑word)
const truncateSafe = (str, maxLen) => {
  if (!str || str.length <= maxLen) return str;
  const trimmed = str.slice(0, maxLen);
  const lastSpace = trimmed.lastIndexOf(' ');
  return lastSpace > 0 ? trimmed.slice(0, lastSpace) + '…' : trimmed + '…';
};

// Helpers
function getCountdownDetails(startDate) {
  if (!startDate) return { text: 'TBD', urgent: false };
  const now = new Date();
  const diff = startDate - now;
  if (diff <= 0) return { text: 'Started', urgent: true };
  const days = differenceInDays(startDate, now);
  const hours = differenceInHours(startDate, now) % 24;
  const minutes = differenceInMinutes(startDate, now) % 60;
  const urgent = days === 0 && hours < 6;
  let text = '';
  if (days > 0) text = `${days}d ${hours}h`;
  else if (hours > 0) text = `${hours}h ${minutes}m`;
  else text = `${minutes}m`;
  return { text, urgent };
}

// MAIN COMPONENT
const EventCard = React.memo(({
  event,
  currentUser,
  tokens,
  userStatus,
  onRSVP,             // async (newStatus) => void
  onOpenEvent,
  hostName = null,
  hostUsername = null,
  hostVerified = false,
}) => {
  // Optimistic UI state
  const [optimisticStatus, setOptimisticStatus] = useState(userStatus);
  const [isLoading, setIsLoading] = useState(false);
  const rsvpLock = useRef(false);

  // Sync external status changes
  useEffect(() => {
    setOptimisticStatus(userStatus);
  }, [userStatus]);

  // Normalize dates once
  const startDate = useMemo(() => toDate(event?.startTime || event?.startDate || event?.date), [event]);
  const endDate = useMemo(() => toDate(event?.endDate), [event?.endDate]);

  // The real server counter is `stats.attendeeCount` (functions/events.js). The
  // old `stats.going` / `stats.interested` / preview-attendee fields this card
  // read are written by nothing, so they fabricated a "0 going" and a
  // permanently empty avatar row. An absent count stays unknown, never 0.
  const attendeeCount = typeof event?.stats?.attendeeCount === 'number'
    ? event.stats.attendeeCount
    : (typeof event?.attendeeCount === 'number' ? event.attendeeCount : null);
  const hostDisplay = hostUsername || hostName || event?.host?.username || event?.host?.name || event?.authorUsername || event?.authorName || null;
  const isVerified = hostVerified || event?.host?.verified || false;
  const shortDescription = event?.shortDescription || (event?.content ? truncateSafe(event.content, 80) : '');

  // Countdown with stable interval (dynamic tick, not interval destruction)
  const [countdown, setCountdown] = useState(() => getCountdownDetails(startDate));
  useEffect(() => {
    if (!startDate) return;
    const updateCountdown = () => setCountdown(getCountdownDetails(startDate));
    updateCountdown();
    const interval = setInterval(updateCountdown, 15000); // update every 15s (balance between accuracy and performance)
    return () => clearInterval(interval);
  }, [startDate]);

  // Real‑time now for live/ended checks (updated via countdown ticks)
  const now = useMemo(() => new Date(), [countdown.text]);
  const isLive = startDate && startDate <= now && (!endDate || now < endDate);
  const isEnded = endDate && now > endDate;

  const urgent = countdown.urgent;

  // RSVP handler with lock + optimistic + rollback + micro animation
  const handleRSVP = useCallback(async (newStatus) => {
    if (!currentUser || isLoading || rsvpLock.current) return;
    if (typeof onRSVP !== 'function') {
      // No RSVP mutation is wired in this surface; never fake a success or
      // claim a failure — send the viewer to the real event screen instead.
      onOpenEvent?.(event);
      return;
    }
    rsvpLock.current = true;
    setIsLoading(true);

    const previousStatus = optimisticStatus;
    const finalStatus = previousStatus === newStatus ? null : newStatus;

    // Optimistic update
    setOptimisticStatus(finalStatus);

    // Micro animation (simulate haptic/visual feedback)
    const btn = document.activeElement;
    if (btn && btn.classList) btn.classList.add('scale-95');
    setTimeout(() => {
      if (btn && btn.classList) btn.classList.remove('scale-95');
    }, 150);

    try {
      await onRSVP(finalStatus);
      // Optional: success toast (silent is fine)
    } catch (err) {
      // Rollback
      setOptimisticStatus(previousStatus);
      toast.error('RSVP failed. Please try again.');
      console.error('RSVP error:', err);
    } finally {
      setIsLoading(false);
      rsvpLock.current = false;
    }
  }, [currentUser, isLoading, optimisticStatus, onRSVP, onOpenEvent, event]);

  // Glow reflects the only states the card actually knows: an urgent/live
  // event glows. (A "gravity"/"exploding" tier was derived from fields nothing
  // writes and has been removed rather than left as a dead branch.)
  const getGlowClass = () =>
    (urgent || isLive)
      ? 'shadow-[0_0_20px_rgba(236,72,153,0.4)] border-pink-500/30'
      : 'shadow-md border-white/10';

  // Neon gradient for buttons & date card (Arvdoul identity)
  const neonGradient = BRAND_GRADIENT;
  const buttonGlow = `0 0 8px rgba(236, 72, 153, 0.5)`;

  // Fallback gradient for a banner-less event card. A second brand gradient
  // (rose → pink → purple) was a rogue stand-in; the canonical Arvdoul gradient
  // is the single source of truth.
  const fallbackGradient = BRAND_GRADIENT;
  // The writer stores the cover under `coverImage` (CreatePost + eventService);
  // `banner` is never written, so reading only it made the real cover never show.
  const bannerUrl = event.banner || event.coverImage || '';
  const hasBanner = typeof bannerUrl === 'string' && bannerUrl.trim() !== '';

  if (!event) return null;

  // Category icon (use Image/photo icon for fallback)
  const CategoryIcon = Image;
  const categoryLabel = (event.category || 'EVENT').toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className={`relative overflow-hidden rounded-2xl border backdrop-blur-sm transition-all duration-300 ${getGlowClass()}`}
      style={{
        backgroundColor: tokens.cardBg,
        borderColor: tokens.border,
        boxShadow: `${tokens.shadowAmbient}, ${tokens.shadowDirectional}, 0 6px 16px -6px rgba(0,0,0,0.3)`,
      }}
    >
      {/* Banner – reduced height h-24 */}
      <div className="relative h-24 overflow-hidden">
        {hasBanner ? (
          <>
            <img src={bannerUrl} alt="cover" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </>
        ) : (
          <div className="relative w-full h-full overflow-hidden">
            <div className="absolute inset-0" style={{ background: fallbackGradient }} />
            <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <CategoryIcon className="w-6 h-6 text-white/90 drop-shadow-md" />
              <div className="text-white/80 text-[10px] font-bold tracking-wider mt-0.5">{categoryLabel}</div>
              <div className="text-white/40 text-[8px] flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-white/50" />
                ARVDOUL
                <span className="w-1 h-1 rounded-full bg-white/50" />
              </div>
            </div>
          </div>
        )}

        {/* Badges overlay (stacked vertically) */}
        <div className="absolute top-1 left-1 flex flex-col gap-0.5">
          {isLive && (
            <div className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow">
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
            </div>
          )}
        </div>
      </div>

      <div className="p-2.5 space-y-1.5">
        {/* Title row */}
        <div className="flex justify-between items-start">
          <h3 className="text-sm font-bold flex-1 pr-2 line-clamp-1" style={{ color: tokens.text }}>
            {event.title}
          </h3>
        </div>

        {/* Host and location */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px]" style={{ color: tokens.textSecondary }}>
          <div className="flex items-center gap-1">
            <span>by</span>
            <span className="font-medium" style={{ color: tokens.text }}>{hostDisplay || 'Unknown host'}</span>
            {isVerified && <CheckCircle className="w-2.5 h-2.5 text-blue-400" />}
          </div>
          {event.location && (
            <div className="flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5" />
              <span className="truncate max-w-[110px]">{event.location}</span>
            </div>
          )}
        </div>

        {/* Short description (one line, safe) */}
        {shortDescription && (
          <p className="text-[9px] line-clamp-1" style={{ color: tokens.textSecondary }}>
            {shortDescription}
          </p>
        )}

        {/* DATE CARD + COUNTDOWN – perfectly placed */}
        <div className="flex items-center justify-between gap-2 mt-1">
          {/* Vertical date card */}
          <div
            className="flex flex-col items-center justify-center rounded-lg px-2 py-1 shadow-md min-w-[52px]"
            style={{
              background: neonGradient,
              boxShadow: `0 2px 6px rgba(0,0,0,0.2), ${buttonGlow}`,
            }}
          >
            <Calendar className="w-3.5 h-3.5 text-white mb-0.5" />
            <span className="text-[10px] font-bold text-white leading-tight">
              {startDate ? format(startDate, 'MMM d') : 'TBD'}
            </span>
            <span className="text-[8px] text-white/80 leading-tight">
              {startDate ? format(startDate, 'p') : '—'}
            </span>
          </div>

          {/* Countdown pill – right aligned, advanced styling */}
          {!isEnded && startDate && (
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full shadow-md transition-all duration-300 ${
                urgent ? 'bg-pink-500/30 text-pink-400 animate-pulse' : 'bg-white/10'
              }`}
              style={{ backdropFilter: 'blur(4px)' }}
            >
              <Clock className="w-3 h-3" />
              <span className="text-[10px] font-mono font-semibold tracking-wide">{countdown.text}</span>
            </div>
          )}
        </div>

        {/* Social proof row */}
        <div className="flex flex-wrap items-center justify-between gap-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px]" style={{ color: tokens.textSecondary }}>
              <span className="font-semibold" style={{ color: tokens.text }}>
                {attendeeCount === null ? '—' : attendeeCount}
              </span>{' '}
              going
            </span>
          </div>

          {/* RSVP BUTTONS – with loading state + micro animation */}
          <div className="flex gap-1.5">
            <button
              onClick={() => handleRSVP('going')}
              disabled={isLoading || isEnded}
              aria-pressed={optimisticStatus === 'going'}
              aria-label="Mark as going"
              aria-busy={isLoading}
              className={`px-2 py-0.5 rounded-full text-[9px] font-semibold transition-all flex items-center gap-1 text-white shadow-md ${
                optimisticStatus === 'going' ? 'opacity-100 scale-105' : 'opacity-85'
              } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
              style={{ background: neonGradient, boxShadow: buttonGlow }}
            >
              {optimisticStatus === 'going' ? <CheckCircle className="w-2.5 h-2.5" /> : <UserCheck className="w-2.5 h-2.5" />}
              Going
            </button>
            <button
              onClick={() => handleRSVP('interested')}
              disabled={isLoading || isEnded}
              aria-pressed={optimisticStatus === 'interested'}
              aria-label="Mark as interested"
              aria-busy={isLoading}
              className={`px-2 py-0.5 rounded-full text-[9px] font-semibold transition-all flex items-center gap-1 text-white shadow-md ${
                optimisticStatus === 'interested' ? 'opacity-100 scale-105' : 'opacity-85'
              } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
              style={{ background: neonGradient, boxShadow: buttonGlow }}
            >
              {optimisticStatus === 'interested' ? <CheckCircle className="w-2.5 h-2.5" /> : <UserPlus className="w-2.5 h-2.5" />}
              Interested
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

EventCard.displayName = 'EventCard';
export default EventCard;