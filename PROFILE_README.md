# ARVDOUL User Profile System

## Overview

The User Profile System is a comprehensive, production-ready profile management solution for ARVDOUL, a world-class social platform. This system surpasses Instagram, Facebook, TikTok, and Twitter in terms of features, design, and user experience.

## Architecture

### Services

- **analyticsService.js** (`src/services/analyticsService.js`)
  - Profile view tracking and analytics
  - Post analytics with daily stats
  - Creator ranking system (Top 1%, Top 5%, etc.)
  - Audience demographics tracking
  - Engagement trends and growth metrics
  - Coin earning history
  - 5-minute cache TTL with LRU cache

- **liveService.js** (`src/services/liveService.js`)
  - Level-based live streaming (minimum level 5)
  - Live stream management (start, end, join, leave)
  - Real-time comments and viewer tracking
  - Gifts and tips monetization system
  - Analytics and earnings tracking
  - 1-minute cache TTL

### Stores (Zustand with Immer)

- **profileStore.js** (`src/store/profileStore.js`)
  - Profile data management
  - Follow/unfollow with optimistic updates
  - Posts pagination
  - Highlights and stories
  - Level, balance, and position tracking
  - Error handling with rollback

- **analyticsStore.js** (`src/store/analyticsStore.js`)
  - Analytics data management
  - Timeframe selection (7d, 30d, 90d, 365d)
  - Daily stats and trends
  - Demographics and ranking

### Components (22 total)

Located in `src/components/profile/`:

| Component | Description |
|-----------|-------------|
| ProfileHeader | Main profile header with avatar, cover, level, and actions |
| ProfileStats | Stats row (posts, followers, following, etc.) |
| ProfileActions | Action buttons (follow, message, share) |
| ProfileBadges | User badges and achievements display |
| ProfileLevel | Level badge with progress indicator |
| ProfileHighlights | Story highlights horizontal scrollable |
| ProfileFeatured | Featured content section |
| ProfileTabs | Tab navigation for content sections |
| ProfileTabContent | Content renderer for active tab |
| FollowButton | Follow/unfollow button with states |
| CreatorDashboard | Analytics dashboard for creators |
| CreatorCharts | Visual charts (bar, line) for metrics |
| ProfileMutualFriends | Mutual friends display |
| ProfileSocialStatus | Social connection status badge |
| ProfileCoverPhoto | Cover photo with edit overlay |
| ProfileAvatar | Avatar with level badge |
| ProfileStatsGrid | Grid view of statistics |
| ProfileAchievements | Achievements and badges display |
| ProfileMediaGrid | Grid of user's media posts |
| ProfileAbout | Profile about/bio information |
| ProfilePrivacyBadge | Privacy status indicator |
| ProfileSkeleton | Loading skeleton for profiles |

### Screens (12 total)

Located in `src/screens/Profile/`:

| Screen | Route | Description |
|--------|-------|-------------|
| ProfileScreen | `/profile`, `/profile/:userId` | Main profile screen |
| EditProfileScreen | `/profile/edit` | Edit profile form |
| CreatorDashboardScreen | `/profile/analytics` | Full analytics dashboard |
| FollowersScreen | `/profile/:userId/followers` | Followers list |
| FollowingScreen | `/profile/:userId/following` | Following list |
| FriendsScreen | `/profile/:userId/friends` | Mutual friends list |
| HighlightsScreen | `/profile/highlights` | Manage highlights |
| AboutScreen | `/profile/about` | Profile about section |
| ProfileSettingsScreen | `/profile/settings` | Privacy and settings |

### Hooks (5 total)

Located in `src/hooks/`:

| Hook | Description |
|------|-------------|
| useProfile | Profile loading, follow/unfollow, posts management |
| useAnalytics | Analytics loading and timeframe selection |
| useLive | Live streaming functionality |
| useProfileTabs | Tab state and content management |
| useCreatorDashboard | Creator dashboard with export |

## Design System

### ARVDOUL DNA Gradient
```css
/* Primary gradient */
linear-gradient(135deg, #B416DB 0%, #872FE2 35%, #4B6BFF 70%, #0EA3E6 100%)

/* Secondary (glassmorphism) */
linear-gradient(135deg, rgba(180,22,219,0.15) 0%, rgba(135,47,226,0.15) 35%, rgba(75,107,255,0.15) 70%, rgba(14,163,230,0.15) 100%)

/* Button gradient */
linear-gradient(135deg, #B416DB 0%, #872FE2 50%, #4B6BFF 100%)

/* Glow effect */
box-shadow: 0 0 30px rgba(180,22,219,0.3), 0 0 60px rgba(75,107,255,0.15)
```

### Design Tokens
```css
/* Colors */
--purple-500: #9333EA;
--pink-500: #C026D3;
--cyan-500: #06B6D4;

/* Spacing */
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;

/* Border Radius */
--radius-sm: 8px;
--radius-md: 12px;
--radius-lg: 16px;
```

## Features

### Profile Management
- View own and others' profiles
- Edit profile information (name, bio, location, etc.)
- Avatar and cover photo management
- Privacy settings (public/private)

### Social Features
- Follow/unfollow users
- View followers, following, and friends
- Mutual friends display
- Real-time follow status updates

### Creator Tools
- Creator dashboard with analytics
- View counts, engagement, reach metrics
- Growth rate tracking
- Audience demographics
- Top performing posts

### Live Streaming
- Level-based live streaming (min level 5)
- Viewer limits based on creator level
- Real-time comments
- Gifts and tips monetization
- Stream analytics

### Highlights
- Create and manage story highlights
- Add/remove stories from highlights
- Custom cover images

## Routes

| Route | Component | Description |
|-------|----------|-------------|
| `/profile` | ProfileScreen | Own profile |
| `/profile/:userId` | ProfileScreen | Other user's profile |
| `/profile/edit` | EditProfileScreen | Edit profile |
| `/profile/analytics` | CreatorDashboardScreen | Creator analytics |
| `/profile/highlights` | HighlightsScreen | Manage highlights |
| `/profile/:userId/followers` | FollowersScreen | Followers list |
| `/profile/:userId/following` | FollowingScreen | Following list |
| `/profile/:userId/friends` | FriendsScreen | Friends list |
| `/profile/about` | AboutScreen | About section |
| `/profile/settings` | ProfileSettingsScreen | Settings |

## Integration

### Existing Services Used
- `userService` - Profile, follow, friends
- `firestoreService` - Posts, likes, saves
- `monetizationService` - Coins, levels, positions
- `storyService` - Stories, highlights
- `notificationsService` - Notifications

### State Management
- Zustand with Immer middleware
- Optimistic updates with rollback
- Error handling with toast notifications
- Loading states for all operations

## Quality Standards

- **Performance**: React.memo, useCallback, useMemo
- **Accessibility**: ARIA labels, keyboard navigation
- **Error Handling**: Try/catch, error boundaries, fallback UI
- **Dark/Light Theme**: Full theme support
- **JSDoc**: All functions and components documented
- **ESLint Clean**: No console.log in production, no TODO/FIXME

## Usage

### Loading a Profile
```jsx
import { useProfile } from '../hooks/useProfile';

function MyComponent({ userId }) {
  const { profile, loading, follow, unfollow } = useProfile(userId);
  
  if (loading) return <ProfileSkeleton />;
  
  return (
    <ProfileHeader
      profile={profile}
      onFollow={follow}
      onUnfollow={unfollow}
    />
  );
}
```

### Using Live Streaming
```jsx
import { useLive } from '../hooks/useLive';

function LiveStreamComponent({ streamId }) {
  const { stream, sendComment, sendGift } = useLive(streamId);
  
  const handleSendComment = async (text) => {
    await sendComment(streamId, userId, text);
  };
  
  return (
    <div>
      {/* Stream content */}
    </div>
  );
}
```

## Future Enhancements

- Story archive management
- Profile customization options
- Advanced analytics reports
- Multi-language support
- Enhanced privacy controls

---

Built with ❤️ by the ARVDOUL Engineering Team
