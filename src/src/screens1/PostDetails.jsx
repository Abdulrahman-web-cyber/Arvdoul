import { useParams } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import {
  doc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  increment,
} from "firebase/firestore";
import { db } from "../firebase/firebase.js";
import {
  Heart,
  MessageCircle,
  Bookmark,
  Share,
  MoreVertical,
} from "lucide-react";
import SwipableMedia from "@components/Home/SwipableMedia";
import { useAuth } from "@context/AuthContext";
import { formatDistanceToNow } from "date-fns";

export default function PostDetails() {
  const { postId } = useParams();
  const { user, addCoins } = useAuth();
  const [post, setPost] = useState(null);
  const [liked, setLiked] = useState(false);

  // ---------------- Real-time Firestore Listener ----------------
  useEffect(() => {
    const postRef = doc(db, "posts", postId);
    const unsubscribe = onSnapshot(postRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setPost(data);
        setLiked(data.likedBy?.includes(user?.uid) || false);
      }
    });
    return unsubscribe;
  }, [postId, user?.uid]);

  // ---------------- Like Handler ----------------
  const handleLike = useCallback(async () => {
    if (!user || liked) return;

    try {
      setLiked(true);
      const postRef = doc(db, "posts", postId);
      await updateDoc(postRef, {
        likedBy: arrayUnion(user.uid),
        likesCount: increment(1),
      });
      // Reward coins for liking
      await addCoins(1, "like post");
    } catch (err) {
      console.error("Error liking post:", err);
    }
  }, [user, liked, postId, addCoins]);

  if (!post)
    return (
      <div className="text-center text-muted-foreground mt-10">
        Loading post...
      </div>
    );

  return (
    <div className="space-y-4 bg-background min-h-screen text-foreground">
      {/* --- Post Header --- */}
      <div className="px-4 pt-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={post.author?.avatar || "/assets/default-profile.png"}
            alt={`${post.author?.displayName || "User"} avatar`}
            className="w-10 h-10 rounded-full object-cover"
          />
          <div>
            <div className="flex items-center gap-1">
              <h2 className="font-semibold text-sm">
                {post.author?.displayName || "User"}
              </h2>
              {post.author?.verified && (
                <span className="text-blue-500 text-xs font-bold">✔️</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {post.createdAt?.seconds
                ? `${formatDistanceToNow(new Date(post.createdAt.seconds * 1000))} ago`
                : ""}
            </p>
          </div>
        </div>
        <button aria-label="Post menu">
          <MoreVertical className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* --- Media --- */}
      <div onDoubleClick={handleLike}>
        <SwipableMedia media={post.media || []} />
      </div>

      {/* --- Caption & Actions --- */}
      <div className="px-4 space-y-2">
        {post.caption && <p className="text-sm">{post.caption}</p>}

        <div className="flex items-center justify-between text-muted-foreground text-sm pt-2">
          <div className="flex items-center gap-4">
            <Heart
              size={20}
              className={`cursor-pointer transition-all ${
                liked ? "text-red-500 fill-red-500" : "text-muted-foreground"
              }`}
              onClick={handleLike}
            />
            <MessageCircle size={20} className="cursor-pointer" />
            <Share size={20} className="cursor-pointer" />
          </div>
          <Bookmark size={20} className="cursor-pointer" />
        </div>

        {/* Likes Count */}
        {post.likesCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {post.likesCount} likes
          </p>
        )}
      </div>

      {/* --- Comments Section --- */}
      <div className="px-4 text-sm text-muted-foreground">
        Comments (coming soon)
      </div>
    </div>
  );
}
