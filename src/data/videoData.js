/**
 * src/data/videoData.js
 * ARVDOUL STATIC CATALOG DATA.
 * Contains only real configuration catalogs (virtual gift catalog).
 * The previous fabricated "INITIAL_VIDEOS" dataset (fake creators, Unsplash
 * stock URLs) was REMOVED - the video feed reads exclusively from Firestore.
 *
 * The gift `type` values MUST match the server catalog (DEFAULT_GIFT_TYPES in
 * functions/monetization.js). The server rejects unknown gift types, so a
 * divergent local id would present a button that can never succeed.
 */

export const VIRTUAL_GIFTS = [
  { type: "rose", name: "Rose", emoji: "🌹", coins: 5, animation: "heart_burst" },
  { type: "crown", name: "Crown", emoji: "👑", coins: 50, animation: "crown_glow" },
  { type: "diamond", name: "Diamond", emoji: "💎", coins: 100, animation: "diamond_sparkle" },
  { type: "rocket", name: "Rocket", emoji: "🚀", coins: 500, animation: "rocket_launch" },
];
