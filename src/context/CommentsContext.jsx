// src/context/CommentsContext.jsx
import { createContext, useContext, useState, useRef } from "react";
import { getDbInstance } from "../firebase/firebase";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  runTransaction,
  query,
  orderBy,
} from "firebase/firestore";
import { useUser } from "./UserContext";

const CommentsContext = createContext();

export const CommentsProvider = ({ children }) => {
  const { user } = useUser();
  const [commentsByPost, setCommentsByPost] = useState({}); // { postId: [comments] }
  const commentsListenersRef = useRef({}); // { postId: unsubscribe }

  // -------------------- Subscribe comments for a post --------------------
  const subscribeComments = (postId) => {
    if (commentsListenersRef.current[postId]) return;
    const commentsRef = collection(db, `posts/${postId}/comments`);
    const q = query(commentsRef, orderBy("createdAt", "asc"));

    commentsListenersRef.current[postId] = onSnapshot(q, (snap) => {
      const comments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCommentsByPost((prev) => ({ ...prev, [postId]: comments }));
    });
  };

  // -------------------- Add a comment --------------------
  const addComment = async ({
    postId,
    content = "",
    parentId = null,
    mentions = [],
  }) => {
    if (!user) return null;

    const commentRef = doc(collection(db, `posts/${postId}/comments`));
    const commentData = {
      id: commentRef.id,
      authorId: user.uid,
      content,
      parentId, // null for top-level, commentId for reply
      mentions,
      reactions: {}, // { userId: "❤️" }
      likes: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      flagged: false,
    };

    await setDoc(commentRef, commentData);

    // Increment comment count and engagement on the post
    const postRef = doc(db, "posts", postId);
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(postRef);
      if (!snap.exists()) return;
      const newCount = (snap.data().commentsCount || 0) + 1;
      const newEngagement = (snap.data().engagementScore || 0) + 1;
      transaction.update(postRef, {
        commentsCount: newCount,
        engagementScore: newEngagement,
      });
    });

    return commentRef.id;
  };

  // -------------------- Edit a comment --------------------
  const editComment = async (postId, commentId, updates) => {
    const commentRef = doc(db, `posts/${postId}/comments`, commentId);
    const snap = await commentRef.get?.() || (await doc(db, `posts/${postId}/comments`, commentId).get());
    if (!snap.exists()) throw new Error("Comment not found");
    if (snap.data().authorId !== user.uid) throw new Error("You can only edit your own comments");
    await updateDoc(commentRef, { ...updates, updatedAt: serverTimestamp() });
  };

  // -------------------- Delete a comment --------------------
  const deleteComment = async (postId, commentId) => {
    const commentRef = doc(db, `posts/${postId}/comments`, commentId);
    const snap = await commentRef.get?.() || (await doc(db, `posts/${postId}/comments`, commentId).get());
    if (!snap.exists()) throw new Error("Comment not found");
    if (snap.data().authorId !== user.uid) throw new Error("You can only delete your own comments");
    await deleteDoc(commentRef);

    // Decrement comment count and engagement on the post
    const postRef = doc(db, "posts", postId);
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(postRef);
      if (!snap.exists()) return;
      const newCount = Math.max((snap.data().commentsCount || 1) - 1, 0);
      const newEngagement = Math.max((snap.data().engagementScore || 1) - 1, 0);
      transaction.update(postRef, {
        commentsCount: newCount,
        engagementScore: newEngagement,
      });
    });
  };

  // -------------------- React to comment --------------------
  const toggleReaction = async (postId, commentId, reaction) => {
    if (!user) return;
    const commentRef = doc(db, `posts/${postId}/comments`, commentId);
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(commentRef);
      if (!snap.exists()) return;
      const reactions = snap.data().reactions || {};
      if (reactions[user.uid] === reaction) delete reactions[user.uid];
      else reactions[user.uid] = reaction;
      transaction.update(commentRef, { reactions });
    });
  };

  // -------------------- Like / Unlike comment --------------------
  const toggleLikeComment = async (postId, commentId) => {
    if (!user) return;
    const commentRef = doc(db, `posts/${postId}/comments`, commentId);
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(commentRef);
      if (!snap.exists()) return;
      const likes = snap.data().likes || [];
      if (likes.includes(user.uid)) transaction.update(commentRef, { likes: arrayRemove(user.uid) });
      else transaction.update(commentRef, { likes: arrayUnion(user.uid) });
    });
  };

  // -------------------- Flag comment for moderation --------------------
  const flagComment = async (postId, commentId, flagged = true) => {
    const commentRef = doc(db, `posts/${postId}/comments`, commentId);
    await updateDoc(commentRef, { flagged });
  };

  // -------------------- Unsubscribe all listeners --------------------
  const unsubscribeAll = () => {
    Object.values(commentsListenersRef.current).forEach((unsub) => unsub());
    commentsListenersRef.current = {};
  };

  return (
    <CommentsContext.Provider
      value={{
        commentsByPost,
        subscribeComments,
        addComment,
        editComment,
        deleteComment,
        toggleReaction,
        toggleLikeComment,
        flagComment,
        unsubscribeAll,
      }}
    >
      {children}
    </CommentsContext.Provider>
  );
};

export const useComments = () => useContext(CommentsContext);