import { db } from "../firebase/firebase.js";
import {
  doc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import axios from "axios";

/**
 * Upload to Cloudinary using an unsigned upload preset.
 * Make sure you created an unsigned preset named "arvdoul"
 * in your Cloudinary dashboard (Settings → Upload → Upload presets).
 */
export async function uploadToCloudinary(
  file,
  folder = "arvdoul",
  options = {},
) {
  try {
    const formData = new FormData();
    formData.append("file", file);
    // unsigned preset name
    formData.append("upload_preset", "arvdoul");
    formData.append("folder", folder);

    const resourceType = options.resource_type || "auto"; // image|video|raw|auto
    if (options.public_id) formData.append("public_id", options.public_id);

    const cloudName = "dutqufben"; // your cloud name
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

    const response = await axios.post(url, formData);

    return {
      url: response.data.secure_url,
      publicId: response.data.public_id,
      width: response.data.width,
      height: response.data.height,
      format: response.data.format,
      resourceType: response.data.resource_type,
      bytes: response.data.bytes,
      duration: response.data.duration, // videos
    };
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    const msg =
      err?.response?.data?.error?.message || "Failed to upload media.";
    throw new Error(msg);
  }
}

/**
 * Build a production-ready user document with defaults.
 * Accepts partial data and fills the rest.
 */
export function buildUserDoc(uid, data = {}) {
  const now = serverTimestamp();

  const firstName = (data.firstName || "").trim();
  const lastName = (data.lastName || "").trim();
  const displayName = (
    data.displayName || `${firstName} ${lastName}`.trim()
  ).trim();

  const defaults = {
    uid,
    firstName,
    lastName,
    displayName,
    nickName: data.nickName || "",
    gender: data.gender || "",
    dob: {
      day: Number(data.day) || Number(data?.dob?.day) || null,
      month: Number(data.month) || Number(data?.dob?.month) || null,
      year: Number(data.year) || Number(data?.dob?.year) || null,
    },
    email: data.email || "",
    phone: data.phone || "",
    passwordSet: Boolean(data.passwordSet || !!data.password),
    profilePicture: data.profilePicture || "",
    coverPhoto: data.coverPhoto || "",
    bio: (data.bio || "").slice(0, 150),

    coins: Number.isFinite(data.coins)
      ? Number(data.coins)
      : parseInt(import.meta.env.VITE_INITIAL_COIN_BALANCE || "100", 10),

    stats: {
      friends: Number(data?.stats?.friends) || 0,
      followers: Number(data?.stats?.followers) || 0,
      following: Number(data?.stats?.following) || 0,
      posts: Number(data?.stats?.posts) || 0,
    },

    status: data.status || "active", // active | suspended | banned
    verified: Boolean(data.verified) || false,

    settings: {
      privacy: data?.settings?.privacy || "public", // public | friends | private
      darkMode: Boolean(data?.settings?.darkMode) || false,
      notifications: data?.settings?.notifications ?? true,
    },

    lastLogin: data.lastLogin || now,
    createdAt: data.createdAt || now,
    updatedAt: now,
  };

  return defaults;
}

/**
 * Create/merge a user document with the production schema.
 */
export async function createUserInFirestore(uid, data) {
  if (!uid)
    throw new Error("Missing user id (uid) for Firestore user creation.");
  const userRef = doc(db, "users", uid);
  const userDoc = buildUserDoc(uid, data);

  await setDoc(userRef, userDoc, { merge: true });
  return userRef.id;
}

/**
 * Save a post document (images/videos).
 * media: array of { url, publicId, type, width, height }
 */
export async function savePostToFirestore({ userId, media, caption = "" }) {
  if (!userId) throw new Error("Missing userId for post.");
  if (!Array.isArray(media) || media.length === 0)
    throw new Error("Media is required.");

  const postsRef = collection(db, "posts");
  const docRef = await addDoc(postsRef, {
    userId,
    media,
    caption: caption.slice(0, 2200), // prevent huge captions
    likesCount: 0,
    commentsCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    visibility: "public", // future: friends/private
  });

  return docRef.id;
}

/**
 * Save a story document (ephemeral).
 */
export async function saveStoryToFirestore({
  userId,
  media,
  expiresInHours = 24,
}) {
  if (!userId) throw new Error("Missing userId for story.");
  if (!Array.isArray(media) || media.length === 0)
    throw new Error("Media is required.");

  const storiesRef = collection(db, "stories");
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + Number(expiresInHours || 24));

  const docRef = await addDoc(storiesRef, {
    userId,
    media,
    createdAt: serverTimestamp(),
    expiresAt,
  });

  return docRef.id;
}

/**
 * Simple, safe client-side download helper (images/videos).
 */
export function downloadMedia(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "arvdoul_media";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
