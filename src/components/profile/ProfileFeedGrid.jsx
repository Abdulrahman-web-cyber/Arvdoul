/**
 * src/components/profile/ProfileFeedGrid.jsx - ARVDOUL Profile Feed Grid
 * 
 * Recreates the media post grid from the uploaded designs:
 * - 2-4 column responsive grid
 * - Video duration badges, likes/comments counters, hover effects
 * - Handles filtering for videos, reels, photos, saved posts, and about info
 * 
 * @component
 */

import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Heart, 
  MessageCircle, 
  Play, 
  Film, 
  Image as ImageIcon, 
  Bookmark,
  Award,
  Globe,
  MapPin,
  Calendar,
  Sparkles,
  Layers
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { getPerksForLevel } from '../../services/levelSystemService';

// Default media placeholders if user has no posts yet
const SAMPLE_MEDIA = [
  { id: 'sm-1', type: 'video', mediaURL: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80', likes: 890, comments: 45, duration: '1:20' },
  { id: 'sm-2', type: 'image', mediaURL: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80', likes: 1420, comments: 88 },
  { id: 'sm-3', type: 'reel', mediaURL: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80', likes: 2150, comments: 134, duration: '0:30' },
  { id: 'sm-4', type: 'image', mediaURL: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80', likes: 670, comments: 23 },
  { id: 'sm-5', type: 'video', mediaURL: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80', likes: 980, comments: 56, duration: '2:15' },
  { id: 'sm-6', type: 'image', mediaURL: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=600&auto=format&fit=crop&q=80', likes: 1120, comments: 72 },
  { id: 'sm-7', type: 'reel', mediaURL: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80', likes: 1840, comments: 95, duration: '0:45' },
  { id: 'sm-8', type: 'image', mediaURL: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80', likes: 760, comments: 39 },
];

const ProfileFeedGrid = memo(({
  posts = [],
  savedPosts = [],
  activeTab = 'posts',
  loading = false,
  theme = 'light',
  profile,
  onPostClick,
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  // Handle 'about' tab
  if (activeTab === 'about') {
    const perks = getPerksForLevel(profile?.level || 24);
    return (
      <div className={cn(
        "w-full rounded-3xl p-6 border backdrop-blur-xl transition-all shadow-sm space-y-6",
        isDark ? "bg-[#0d1424]/70 border-white/10 text-white" : "bg-white/95 border-slate-200/90 text-slate-900"
      )}>
        <div>
          <h3 className="text-base font-bold mb-2">About Creator</h3>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {profile?.bio || 'Creator on Arvdoul exploring digital frontiers, 3D experiences, and decentralized social networking.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-white/10">
          <div>
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
              Profile Information
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-purple-500" />
                <span>Location: {profile?.location || 'Global'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-500" />
                <span>Website: {profile?.website || 'arvdoul.com'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-500" />
                <span>Citizen Since: 2024</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
              Unlocked Perks (Level {profile?.level || 24})
            </h4>
            <div className="space-y-2">
              {perks.slice(0, 4).map((perk, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-base">{perk.icon}</span>
                  <span className="font-semibold">{perk.title}</span>
                  <span className="text-slate-400 text-[11px]">— {perk.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Filter items by active tab
  let displayItems = posts.length > 0 ? posts : SAMPLE_MEDIA;
  if (activeTab === 'saved') {
    displayItems = savedPosts.length > 0 ? savedPosts : displayItems.slice(0, 4);
  } else if (activeTab === 'videos') {
    const vids = displayItems.filter(p => p.type === 'video');
    displayItems = vids.length > 0 ? vids : displayItems.slice(0, 4).map(p => ({ ...p, type: 'video', duration: '1:30' }));
  } else if (activeTab === 'reels') {
    const reels = displayItems.filter(p => p.type === 'reel');
    displayItems = reels.length > 0 ? reels : displayItems.slice(0, 4).map(p => ({ ...p, type: 'reel', duration: '0:30' }));
  } else if (activeTab === 'photos') {
    const photos = displayItems.filter(p => p.type === 'image');
    displayItems = photos.length > 0 ? photos : displayItems.slice(0, 6).map(p => ({ ...p, type: 'image' }));
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        {displayItems.map((item, idx) => {
          const isVid = item.type === 'video' || item.type === 'reel' || Boolean(item.duration);
          const isReel = item.type === 'reel';

          return (
            <div
              key={item.id || idx}
              onClick={() => onPostClick?.(item) || navigate(`/post/${item.id}`)}
              className={cn(
                "group relative rounded-2xl overflow-hidden cursor-pointer border border-white/10 shadow-sm bg-slate-900 transition-all hover:scale-[1.02]",
                isReel ? "aspect-[9/16]" : "aspect-square"
              )}
            >
              {/* Media Thumbnail */}
              <img
                src={item.mediaURL || item.thumbnailUrl || item.mediaUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80'}
                alt={item.title || item.caption || 'Media item'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />

              {/* Video Indicator at Top Right */}
              {isVid && (
                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white flex items-center gap-1 text-[10px] font-bold">
                  {isReel ? <Film className="w-3 h-3" /> : <Play className="w-3 h-3 fill-white" />}
                  <span>{item.duration || '1:15'}</span>
                </div>
              )}

              {/* Hover Overlay with Stats */}
              <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white">
                <div className="flex items-center gap-1 text-xs font-bold">
                  <Heart className="w-4 h-4 fill-white text-white" />
                  <span>{item.likes || item.likesCount || 420}</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold">
                  <MessageCircle className="w-4 h-4 fill-white text-white" />
                  <span>{item.comments || item.commentsCount || 18}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

ProfileFeedGrid.displayName = 'ProfileFeedGrid';

export default ProfileFeedGrid;
