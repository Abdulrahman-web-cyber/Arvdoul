// src/components/Shared/ProgressionIcons.jsx
// Canonical, emoji-free Lucide icon primitives for Arvdoul progression,
// citizenship tiers, achievements, titles, perks, and virtual gifts.

import {
  Award,
  Bookmark,
  CheckCircle2,
  Coins,
  Compass,
  Crown,
  Flame,
  Gem,
  Gift,
  Globe,
  Heart,
  Landmark,
  Medal,
  MessageSquare,
  Mic,
  Palette,
  Rocket,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
  Video,
  Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const CITIZEN_TIER_ICONS = {
  Resident: Compass,
  'Active Member': UserCheck,
  Citizen: ShieldCheck,
  'Distinguished Citizen': Award,
  'Elder Citizen': Landmark,
  Founder: Crown,
};

const GIFT_ICON_MAP = {
  rose: Heart,
  star: Star,
  diamond: Gem,
  fire: Flame,
  rocket: Rocket,
  crown: Crown,
  trophy: Trophy,
};

export function CitizenTierIcon({ tier, className = 'w-5 h-5' }) {
  const Icon = CITIZEN_TIER_ICONS[tier] || Compass;
  return <Icon className={className} aria-hidden="true" />;
}

export function PerkIcon({ minLevel, title = '', className = 'w-5 h-5' }) {
  const lower = String(title).toLowerCase();
  let Icon = Sparkles;
  if (lower.includes('live')) Icon = Video;
  else if (lower.includes('voice') || lower.includes('audio')) Icon = Mic;
  else if (lower.includes('gift') || lower.includes('monetiz') || lower.includes('tip')) Icon = Gift;
  else if (lower.includes('coin') || lower.includes('withdraw') || lower.includes('payout')) Icon = Coins;
  else if (lower.includes('poll') || lower.includes('civic') || lower.includes('vote')) Icon = Landmark;
  else if (lower.includes('creator') || lower.includes('studio')) Icon = Rocket;
  else if (lower.includes('theme') || lower.includes('custom') || lower.includes('color')) Icon = Palette;
  else if (lower.includes('crown') || lower.includes('royal') || minLevel >= 80) Icon = Crown;
  else if (lower.includes('highlight') || lower.includes('pin')) Icon = Bookmark;
  else if (lower.includes('badge') || lower.includes('verify')) Icon = ShieldCheck;
  else if (minLevel >= 50) Icon = Trophy;
  else if (minLevel >= 20) Icon = Star;

  return <Icon className={className} aria-hidden="true" />;
}

export function GiftCatalogIcon({ giftId, className = 'w-6 h-6' }) {
  const Icon = GIFT_ICON_MAP[giftId] || Gift;
  const tone =
    giftId === 'rose'
      ? 'text-rose-500'
      : giftId === 'star' || giftId === 'crown' || giftId === 'trophy'
        ? 'text-amber-500'
        : giftId === 'diamond'
          ? 'text-cyan-400'
          : giftId === 'fire'
            ? 'text-orange-500'
            : 'text-purple-500';
  return <Icon className={cn(tone, className)} aria-hidden="true" />;
}

export function AchievementIcon({ category = '', rarity = '', className = 'w-5 h-5' }) {
  const cat = String(category).toLowerCase();
  const rar = String(rarity).toLowerCase();
  let Icon = Award;
  if (cat === 'progression') Icon = Zap;
  else if (cat === 'creation') Icon = Video;
  else if (cat === 'creator') Icon = Rocket;
  else if (cat === 'community') Icon = MessageSquare;
  else if (cat === 'social') Icon = Users;
  else if (cat === 'economy') Icon = Coins;
  else if (cat === 'citizenship') Icon = Landmark;
  else if (cat === 'historical') Icon = Shield;
  else if (rar === 'legendary' || rar === 'mythic') Icon = Crown;

  return <Icon className={className} aria-hidden="true" />;
}

export function TitleIcon({ titleId = '', domain = '', className = 'w-5 h-5' }) {
  const id = String(titleId).toLowerCase();
  const dom = String(domain).toLowerCase();
  let Icon = Medal;
  if (id.includes('king') || id.includes('queen') || id.includes('duke') || id.includes('monarch') || id.includes('sovereign')) {
    Icon = Crown;
  } else if (id.includes('founder') || id.includes('pioneer')) {
    Icon = ShieldCheck;
  } else if (dom === 'civic') {
    Icon = Landmark;
  } else if (dom === 'creation') {
    Icon = Sparkles;
  } else if (dom === 'community') {
    Icon = Globe;
  } else if (dom === 'historical') {
    Icon = Award;
  } else if (id.includes('trend') || id.includes('influencer')) {
    Icon = TrendingUp;
  } else if (id.includes('verified')) {
    Icon = CheckCircle2;
  }
  return <Icon className={className} aria-hidden="true" />;
}
