// src/data/videoData.js - ARVDOUL INITIAL VIDEO DATASET
// High quality vertical & reels videos with zero placeholders, full metadata, mutual connections, and audio tracks

export const INITIAL_VIDEOS = [
  {
    id: "v_arvdoul_01",
    title: "Lost in the City",
    description: "Chasing dreams and building digital experiences. ✨",
    hashtags: ["#arvdoul", "#dreambig", "#motivation", "#cyberpunk", "#gt-r"],
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-car-driving-through-the-city-at-night-4228-large.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1080&auto=format&fit=crop&q=80",
    duration: 34,
    currentTime: 12,
    likes: 128000,
    likesFormatted: "128K",
    commentsCount: 2345,
    shares: 12600,
    saves: 8942,
    gifts: 1230,
    views: 845200,
    isLiked: false,
    isSaved: false,
    mutualFriendsCount: 12,
    mutualFriends: [
      { id: "mf1", name: "Zaid Al-Harbi", username: "zaid_dev", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80" },
      { id: "mf2", name: "Elena Rostova", username: "elena_ui", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80" },
      { id: "mf3", name: "Marcus Vance", username: "marcus_cyber", avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80" },
      { id: "mf4", name: "Sofia Chen", username: "sofia_motion", avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80" },
      { id: "mf5", name: "Tariq Mansoor", username: "tariq_sound", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80" }
    ],
    creator: {
      id: "usr_abdulrahman",
      name: "Abdulrahman",
      username: "abdulrahman",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
      isVerified: true,
      isFollowing: false,
      followers: 84200,
      bio: "Founder & Lead Architect @ ARVDOUL. Crafting futuristic mobile web horizons."
    },
    audio: {
      id: "snd_lost_city",
      title: "Lost in the City – ARVDOUL Beats",
      artist: "ARVDOUL Original Audio",
      coverUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=120&auto=format&fit=crop&q=80",
      duration: 34,
      usesCount: "42.8K"
    },
    quality: "1080p",
    createdAt: new Date(Date.now() - 3600 * 1000 * 4).toISOString()
  },
  {
    id: "v_arvdoul_02",
    title: "Cyberpunk Metropolis 2088",
    description: "Welcome to the next generation of digital interconnected worlds. Experience ARVDOUL.",
    hashtags: ["#future", "#neon", "#metaverse", "#arvdoulWorld"],
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-futuristic-city-with-flying-cars-and-skyscrapers-41618-large.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1080&auto=format&fit=crop&q=80",
    duration: 28,
    currentTime: 6,
    likes: 95400,
    likesFormatted: "95.4K",
    commentsCount: 1820,
    shares: 8300,
    saves: 6120,
    gifts: 840,
    views: 620400,
    isLiked: false,
    isSaved: false,
    mutualFriendsCount: 9,
    mutualFriends: [
      { id: "mf1", name: "Zaid Al-Harbi", username: "zaid_dev", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80" },
      { id: "mf4", name: "Sofia Chen", username: "sofia_motion", avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80" }
    ],
    creator: {
      id: "usr_cyber_studio",
      name: "Cyber Visionaries",
      username: "cybervision",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
      isVerified: true,
      isFollowing: false,
      followers: 120500,
      bio: "Visual effects & cyberpunk cinematic worlds."
    },
    audio: {
      id: "snd_synth_wave",
      title: "Hyperdrive Synthwave - ARVDOUL Soundlab",
      artist: "Cyber Visionaries",
      coverUrl: "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=120&auto=format&fit=crop&q=80",
      duration: 28,
      usesCount: "19.3K"
    },
    quality: "4K UHD",
    createdAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString()
  },
  {
    id: "v_arvdoul_03",
    title: "Building Real-Time Full Stack in Minutes",
    description: "The workflow of building ultra high performance distributed applications. What do you think of this architecture?",
    hashtags: ["#coding", "#fullstack", "#devlife", "#techcreators"],
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-man-coding-on-a-laptop-43527-large.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1080&auto=format&fit=crop&q=80",
    duration: 45,
    currentTime: 18,
    likes: 64200,
    likesFormatted: "64.2K",
    commentsCount: 940,
    shares: 4500,
    saves: 11200,
    gifts: 610,
    views: 410800,
    isLiked: false,
    isSaved: false,
    mutualFriendsCount: 15,
    mutualFriends: [
      { id: "mf2", name: "Elena Rostova", username: "elena_ui", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80" },
      { id: "mf3", name: "Marcus Vance", username: "marcus_cyber", avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80" }
    ],
    creator: {
      id: "usr_alex_dev",
      name: "Alex Dev Labs",
      username: "alex_labs",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
      isVerified: true,
      isFollowing: true,
      followers: 95400,
      bio: "Full Stack Engineer & Web Performance Architect."
    },
    audio: {
      id: "snd_lofi_focus",
      title: "Deep Code Flow - Lo-Fi Chill Beats",
      artist: "Alex Dev Labs",
      coverUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=120&auto=format&fit=crop&q=80",
      duration: 45,
      usesCount: "83.1K"
    },
    quality: "1080p",
    createdAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString()
  },
  {
    id: "v_arvdoul_04",
    title: "Tokyo Neon Drift Horizon",
    description: "Midnight highway run under neon rain. The rhythm of the city never sleeps.",
    hashtags: ["#tokyo", "#nightdrive", "#streetlife", "#arvdoul"],
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-motorcyclist-riding-in-a-neon-tunnel-41604-large.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1080&auto=format&fit=crop&q=80",
    duration: 32,
    currentTime: 8,
    likes: 182400,
    likesFormatted: "182.4K",
    commentsCount: 3410,
    shares: 21900,
    saves: 14800,
    gifts: 2450,
    views: 1240000,
    isLiked: true,
    isSaved: true,
    mutualFriendsCount: 18,
    mutualFriends: [
      { id: "mf1", name: "Zaid Al-Harbi", username: "zaid_dev", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80" },
      { id: "mf5", name: "Tariq Mansoor", username: "tariq_sound", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80" }
    ],
    creator: {
      id: "usr_neon_rider",
      name: "Kenji Sato",
      username: "kenji_drift",
      avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200&auto=format&fit=crop&q=80",
      isVerified: true,
      isFollowing: false,
      followers: 210000,
      bio: "Automotive filmmaker based in Tokyo & Dubai."
    },
    audio: {
      id: "snd_tokyo_drift",
      title: "Midnight Shinjuku - Bass Boosted Phonk",
      artist: "Kenji Sato",
      coverUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=120&auto=format&fit=crop&q=80",
      duration: 32,
      usesCount: "112K"
    },
    quality: "4K UHD",
    createdAt: new Date(Date.now() - 3600 * 1000 * 30).toISOString()
  }
];

export const VIRTUAL_GIFTS = [
  { id: "g1", name: "Super Heart", icon: "❤️", coins: 10, animation: "heart_burst" },
  { id: "g2", name: "ARVDOUL Crown", icon: "👑", coins: 50, animation: "crown_glow" },
  { id: "g3", name: "Diamond Gem", icon: "💎", coins: 100, animation: "diamond_sparkle" },
  { id: "g4", name: "Neon Rocket", icon: "🚀", coins: 250, animation: "rocket_launch" },
  { id: "g5", name: "Golden Mic", icon: "🎙️", coins: 500, animation: "gold_waves" },
  { id: "g6", name: "Galaxy Star", icon: "🌌", coins: 1000, animation: "galaxy_burst" }
];
