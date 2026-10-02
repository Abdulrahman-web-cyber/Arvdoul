/**
 * Contains only real configuration catalogs (virtual gift catalog).
 * The previous fabricated "INITIAL_VIDEOS" dataset (fake creators, Unsplash
 * stock URLs) was REMOVED - the video feed reads exclusively from Firestore.
 *
 * The gift `type` values MUST match the server catalog (DEFAULT_GIFT_TYPES in
 * functions/monetization.js). The server rejects unknown gift types, so a
 * divergent local id would present a button that can never succeed.
 */

import { GIFT_CATALOG } from "../shared/levelConfig.cjs";

const GIFT_ANIMATIONS = ["heart_burst", "crown_glow", "diamond_sparkle", "rocket_launch", "galaxy_spin"];

export const VIRTUAL_GIFTS = GIFT_CATALOG.map((gift, i) => ({
  ...gift,
  animation: GIFT_ANIMATIONS[i % GIFT_ANIMATIONS.length],
}));
