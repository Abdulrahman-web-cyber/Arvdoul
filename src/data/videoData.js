/**
 * src/data/videoData.js
 * ARVDOUL STATIC CATALOG DATA.
 * Contains only real configuration catalogs (virtual gift catalog).
 * The previous fabricated "INITIAL_VIDEOS" dataset (fake creators, Unsplash
 * stock URLs) was REMOVED - the video feed reads exclusively from Firestore.
 */

export const VIRTUAL_GIFTS = [
  { id: "g1", name: "Super Heart", icon: "❤️", coins: 10, animation: "heart_burst" },
  { id: "g2", name: "ARVDOUL Crown", icon: "👑", coins: 50, animation: "crown_glow" },
  { id: "g3", name: "Diamond Gem", icon: "💎", coins: 100, animation: "diamond_sparkle" },
  { id: "g4", name: "Neon Rocket", icon: "🚀", coins: 250, animation: "rocket_launch" },
  { id: "g5", name: "Golden Mic", icon: "🎙️", coins: 500, animation: "gold_waves" },
  { id: "g6", name: "Galaxy Star", icon: "🌌", coins: 1000, animation: "galaxy_burst" }
];
