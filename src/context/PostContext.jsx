// src/context/PostsContext.jsx
import { createContext, useContext, useState, useRef } from "react";
import { db, storage } from "../firebase/firebase";
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
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useUser } from "./UserContext";

const PostsContext = createContext();

export const PostsProvider = ({ children }) => {
const { user } = useUser();
const [feedPosts, setFeedPosts] = useState([]);
const [userPosts, setUserPosts] = useState({});
const feedListenerRef = useRef(null);
const userListenersRef = useRef({});

// -------------------- Subscribe to feed posts --------------------
const subscribeFeed = () => {
if (feedListenerRef.current) return;
const postsRef = collection(db, "posts");
feedListenerRef.current = onSnapshot(postsRef, (snap) => {
const posts = snap.docs
.map((d) => ({ id: d.id, ...d.data() }))
.sort((a, b) => {
// weighted sort: engagement + timestamp
const engagementA = (a.likes?.length || 0) + (a.commentsCount || 0) + (a.sharesCount || 0);
const engagementB = (b.likes?.length || 0) + (b.commentsCount || 0) + (b.sharesCount || 0);
return engagementB - engagementA || b.createdAt?.seconds - a.createdAt?.seconds;
});
setFeedPosts(posts);
});
};

// -------------------- Create a post --------------------
const createPost = async ({ content = "", mediaFiles = [], privacy = "public", mentions = [], hashtags = [], scheduledAt = null }) => {
if (!user) return null;

const mediaURLs = [];  
for (let file of mediaFiles) {  
  const storageRef = ref(storage, `posts/${user.uid}/${Date.now()}_${file.name}`);  
  await uploadBytes(storageRef, file);  
  mediaURLs.push({  
    url: await getDownloadURL(storageRef),  
    type: file.type.startsWith("video") ? "video" : "image",  
    name: file.name,  
    size: file.size,  
  });  
}  

const postRef = doc(collection(db, "posts"));  
const postData = {  
  id: postRef.id,  
  authorId: user.uid,  
  content,  
  media: mediaURLs,  
  privacy, // "public" | "friends" | "groups" | "custom"  
  mentions, // array of userIds  
  hashtags, // array of strings  
  likes: [],  
  reactions: {}, // { userId: "❤️" }  
  commentsCount: 0,  
  sharesCount: 0,  
  savedBy: [],  
  views: 0,  
  impressions: 0,  
  engagementScore: 0,  
  scheduledAt,  
  pinned: false,  
  createdAt: serverTimestamp(),  
  updatedAt: serverTimestamp(),  
};  

await setDoc(postRef, postData);  

setUserPosts((prev) => ({  
  ...prev,  
  [user.uid]: [postData, ...(prev[user.uid] || [])],  
}));  

return postRef.id;

};

// -------------------- Edit / Delete Post --------------------
const editPost = async (postId, updates) => {
const postRef = doc(db, "posts", postId);
const snap = await postRef.get?.() || (await doc(db, "posts", postId).get());
if (!snap.exists()) throw new Error("Post not found");
if (snap.data().authorId !== user.uid) throw new Error("You can only edit your own posts");
await updateDoc(postRef, { ...updates, updatedAt: serverTimestamp() });
};

const deletePost = async (postId) => {
const postRef = doc(db, "posts", postId);
const snap = await postRef.get?.() || (await doc(db, "posts", postId).get());
if (!snap.exists()) throw new Error("Post not found");
if (snap.data().authorId !== user.uid) throw new Error("You can only delete your own posts");
await deleteDoc(postRef);
};

// -------------------- Like / Reactions --------------------
const toggleReaction = async (postId, reaction) => {
if (!user) return;
const postRef = doc(db, "posts", postId);
await runTransaction(db, async (transaction) => {
const snap = await transaction.get(postRef);
if (!snap.exists()) return;
const reactions = snap.data().reactions || {};
if (reactions[user.uid] === reaction) delete reactions[user.uid];
else reactions[user.uid] = reaction;
transaction.update(postRef, { reactions });
});
};

// -------------------- Comments & Engagement --------------------
const incrementCommentCount = async (postId) => {
const postRef = doc(db, "posts", postId);
await runTransaction(db, async (transaction) => {
const snap = await transaction.get(postRef);
if (!snap.exists()) return;
transaction.update(postRef, { commentsCount: (snap.data().commentsCount || 0) + 1 });
});
};

const incrementShareCount = async (postId) => {
const postRef = doc(db, "posts", postId);
await runTransaction(db, async (transaction) => {
const snap = await transaction.get(postRef);
if (!snap.exists()) return;
transaction.update(postRef, { sharesCount: (snap.data().sharesCount || 0) + 1 });
});
};

// -------------------- Save / Unsave post --------------------
const toggleSavePost = async (postId) => {
if (!user) return;
const postRef = doc(db, "posts", postId);
await runTransaction(db, async (transaction) => {
const snap = await transaction.get(postRef);
if (!snap.exists()) return;
const savedBy = snap.data().savedBy || [];
if (savedBy.includes(user.uid)) transaction.update(postRef, { savedBy: arrayRemove(user.uid) });
else transaction.update(postRef, { savedBy: arrayUnion(user.uid) });
});
};

// -------------------- Subscribe user posts --------------------
const subscribeUserPosts = (userId) => {
if (userListenersRef.current[userId]) return;
const postsRef = collection(db, "posts");
userListenersRef.current[userId] = onSnapshot(postsRef, (snap) => {
const posts = snap.docs
.map((d) => ({ id: d.id, ...d.data() }))
.filter((p) => p.authorId === userId)
.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
setUserPosts((prev) => ({ ...prev, [userId]: posts }));
});
};

// -------------------- Unsubscribe all --------------------
const unsubscribeAll = () => {
feedListenerRef.current?.();
Object.values(userListenersRef.current).forEach((unsub) => unsub());
feedListenerRef.current = null;
userListenersRef.current = {};
};

return (
<PostsContext.Provider
value={{
feedPosts,
userPosts,
subscribeFeed,
createPost,
editPost,
deletePost,
toggleReaction,
incrementCommentCount,
incrementShareCount,
toggleSavePost,
subscribeUserPosts,
unsubscribeAll,
}}
>
{children}
</PostsContext.Provider>
);
};

export const usePosts = () => useContext(PostsContext);