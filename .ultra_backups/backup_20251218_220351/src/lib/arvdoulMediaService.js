import { db } from "../firebase/firebase.js";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import axios from "axios";

\/\/ =========================
\/\/ Cloudinary Upload Helper
\/\/ =========================
export async function uploadToCloudinary(
  file,
  folder = "arvdoul",
  options = {},
) {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "arvdoul"); \/\/ Must create unsigned preset in Cloudinary
    formData.append("folder", folder);

    if (options.resource_type)
      formData.append("resource_type", options.resource_type); \/\/ 'image' | 'video'
    if (options.public_id) formData.append("public_id", options.public_id); \/\/ overwrite or set specific ID

    const response = await axios.post(
      `https:\/\/api.cloudinary.com/v1_1/dutqufben/${options.resource_type || "auto"}/upload`,
      formData,
    );

    return {
      url: response.data.secure_url,
      publicId: response.data.public_id,
      width: response.data.width,
      height: response.data.height,
      format: response.data.format,
      resourceType: response.data.resource_type,
    };
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    throw new Error(
      err.response?.data?.error?.message || "Failed to upload media.",
    );
  }
}

\/\/ =========================
\/\/ Firestore Helpers
\/\/ =========================

\/\/ Posts: images/videos in feed
export async function savePostToFirestore({ userId, media, caption = "" }) {
  try {
    const postsRef = collection(db, "posts");
    const docRef = await addDoc(postsRef, {
      userId,
      media: Array.isArray(media) ? media : [media],
      caption,
      likesCount: 0,
      commentsCount: 0,
      timestamp: serverTimestamp(),
    });
    return docRef.id;
  } catch (err) {
    console.error("Firestore save post error:", err);
    throw new Error("Failed to save post.");
  }
}

\/\/ Stories: ephemeral content
export async function saveStoryToFirestore({
  userId,
  media,
  expiresInHours = 24,
}) {
  try {
    const storiesRef = collection(db, "stories");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    const docRef = await addDoc(storiesRef, {
      userId,
      media: Array.isArray(media) ? media : [media],
      timestamp: serverTimestamp(),
      expiresAt,
    });
    return docRef.id;
  } catch (err) {
    console.error("Firestore save story error:", err);
    throw new Error("Failed to save story.");
  }
}

\/\/ Profile picture upload
export async function uploadProfilePicture({ userId, file }) {
  try {
    const uploadResult = await uploadToCloudinary(
      file,
      `profile_pictures/${userId}`,
      { resource_type: "image" },
    );
    \/\/ Save URL to Firestore user document, overwrite if exists
    const userRef = doc(db, "users", userId);
    await setDoc(
      userRef,
      {
        profilePicture: uploadResult.url,
        profilePicturePublicId: uploadResult.publicId,
        timestamp: serverTimestamp(),
      },
      { merge: true },
    );
    return uploadResult;
  } catch (err) {
    console.error("Profile picture upload error:", err);
    throw err;
  }
}

\/\/ =========================
\/\/ Utility: Download media
\/\/ =========================
export function downloadMedia(url, filename) {
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "arvdoul_media";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error("Download media error:", err);
    throw new Error("Failed to download media.");
  }
}
