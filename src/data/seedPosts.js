// src/data/seedPosts.js - ARVDOUL PRODUCTION SEED DATASET
// Complete, rich, diverse initial dataset for immediate instant feed hydration
// Zero empty states, zero missing assets, 100% interactive & responsive

export const INITIAL_SEED_POSTS = [
  {
    id: "post_arvdoul_01",
    authorId: "usr_abdulrahman",
    authorName: "Abdulrahman",
    authorPhoto: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
    authorHandle: "@abdulrahman",
    authorVerified: true,
    authorBadge: "Founder",
    type: "image",
    content: "Welcome to ARVDOUL! 🚀 We built this platform from the ground up for creators, developers, and visionaries around the world. Real-time sync, ultra-smooth 120fps feeds, monetization with creator coins, and zero latency digital experiences. Share your world with us! ✨ #arvdoul #nextgen #tech #creator #innovation",
    media: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1200&auto=format&fit=crop&q=80",
        thumbnail: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=300&auto=format&fit=crop&q=80",
        aspectRatio: "16/9"
      }
    ],
    stats: {
      likes: 14820,
      comments: 1894,
      shares: 3420,
      saves: 5612,
      views: 124500
    },
    isLiked: false,
    isSaved: false,
    tags: ["arvdoul", "nextgen", "tech", "creator"],
    category: "tech",
    location: "Dubai, Silicon Oasis",
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    rankingMetadata: { score: 0.98, reason: "algorithm", rankWeight: 1 }
  },
  {
    id: "post_arvdoul_02",
    authorId: "usr_zaid",
    authorName: "Zaid Al-Harbi",
    authorPhoto: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80",
    authorHandle: "@zaid_dev",
    authorVerified: true,
    authorBadge: "PRO",
    type: "poll",
    content: "What is your primary focus for building next-generation web & mobile applications in 2026? Vote below! 👇",
    poll: {
      question: "Primary Focus for Next-Gen Apps",
      options: [
        { id: "opt_1", text: "AI & Intelligent Agents", votes: 4230, percentage: 48 },
        { id: "opt_2", text: "Real-time Edge Sync & P2P", votes: 2150, percentage: 24 },
        { id: "opt_3", text: "Ultra-fluid 120fps UI/UX", votes: 1680, percentage: 19 },
        { id: "opt_4", text: "Creator Monetization & Coins", votes: 790, percentage: 9 }
      ],
      totalVotes: 8850,
      userVotedOption: null,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString()
    },
    stats: {
      likes: 5410,
      comments: 632,
      shares: 980,
      saves: 1420,
      views: 64200
    },
    isLiked: false,
    isSaved: false,
    tags: ["tech", "poll", "developers", "ai"],
    category: "tech",
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    rankingMetadata: { score: 0.95, reason: "trending", rankWeight: 1 }
  },
  {
    id: "post_arvdoul_03",
    authorId: "usr_elena",
    authorName: "Elena Rostova",
    authorPhoto: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80",
    authorHandle: "@elena_ui",
    authorVerified: true,
    authorBadge: "Design Lead",
    type: "video",
    content: "Exploring futuristic ambient glassmorphism and kinetic motion physics for the new Arvdoul spatial layout. What do you think of this neon gradient palette? 🔮💜 #design #motion #cyberpunk #uxui",
    media: [
      {
        type: "video",
        url: "https://assets.mixkit.co/videos/preview/mixkit-car-driving-through-the-city-at-night-4228-large.mp4",
        thumbnail: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&auto=format&fit=crop&q=80",
        duration: 34
      }
    ],
    stats: {
      likes: 9340,
      comments: 1120,
      shares: 2180,
      saves: 4390,
      views: 98700
    },
    isLiked: false,
    isSaved: false,
    tags: ["design", "motion", "cyberpunk", "uxui"],
    category: "design",
    location: "Tokyo, Shibuya",
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    rankingMetadata: { score: 0.92, reason: "algorithm", rankWeight: 1 }
  },
  {
    id: "post_arvdoul_04",
    authorId: "usr_marcus",
    authorName: "Marcus Vance",
    authorPhoto: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&auto=format&fit=crop&q=80",
    authorHandle: "@marcus_cyber",
    authorVerified: true,
    type: "audio",
    content: "New deep atmospheric synthwave track produced exclusively on Arvdoul Studio. Plug in your headphones and enjoy the journey! 🎧⚡️ #synthwave #music #arvdoulSound #ambient",
    audio: {
      id: "track_01",
      title: "Neon Horizon 2088",
      artist: "Marcus Vance",
      duration: "3:45",
      waveform: [30, 45, 60, 80, 65, 90, 100, 75, 55, 70, 85, 95, 100, 85, 60, 40, 65, 80, 95, 70, 50, 60, 75, 90, 65, 45, 30]
    },
    stats: {
      likes: 6720,
      comments: 489,
      shares: 1540,
      saves: 3120,
      views: 52100
    },
    isLiked: false,
    isSaved: false,
    tags: ["synthwave", "music", "audio", "creative"],
    category: "music",
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    rankingMetadata: { score: 0.89, reason: "discover", rankWeight: 1 }
  },
  {
    id: "post_arvdoul_05",
    authorId: "usr_sofia",
    authorName: "Sofia Chen",
    authorPhoto: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80",
    authorHandle: "@sofia_motion",
    authorVerified: true,
    type: "image",
    content: "Sunset over the digital horizon. When technology meets nature, magic happens. Shot on Hasselblad X2D 100C. 🌅📸 #photography #landscape #goldenhour #art",
    media: [
      {
        type: "image",
        url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&auto=format&fit=crop&q=80",
        thumbnail: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300&auto=format&fit=crop&q=80",
        aspectRatio: "4/3"
      }
    ],
    stats: {
      likes: 11450,
      comments: 890,
      shares: 1980,
      saves: 4850,
      views: 104200
    },
    isLiked: false,
    isSaved: false,
    tags: ["photography", "landscape", "art"],
    category: "art",
    location: "Santorini, Greece",
    createdAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    rankingMetadata: { score: 0.88, reason: "algorithm", rankWeight: 1 }
  },
  {
    id: "post_arvdoul_06",
    authorId: "usr_tariq",
    authorName: "Tariq Mansoor",
    authorPhoto: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
    authorHandle: "@tariq_sound",
    authorVerified: true,
    type: "question",
    content: "Question for creators: When building a global community, what metric matters most to you? High retention vs. viral reach?",
    stats: {
      likes: 4210,
      comments: 780,
      shares: 512,
      saves: 890,
      views: 43200
    },
    isLiked: false,
    isSaved: false,
    tags: ["creators", "community", "growth"],
    category: "community",
    createdAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    rankingMetadata: { score: 0.85, reason: "community", rankWeight: 1 }
  }
];
