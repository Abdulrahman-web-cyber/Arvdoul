// src/context/MessagingContext.jsx
import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { db, storage } from "../firebase/firebase";
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  deleteDoc,
  runTransaction,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  limit,
  startAfter,
  where,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useUser } from "./UserContext";

const MessagingContext = createContext(null);

export const MessagingProvider = ({ children }) => {
  const { user } = useUser();
  const [conversations, setConversations] = useState([]);
  const [activeMessages, setActiveMessages] = useState({}); // { conversationId: [messages] }
  const [typingStatus, setTypingStatus] = useState({}); // { conversationId: { userId: boolean } }
  const [uploadProgress, setUploadProgress] = useState({}); // { messageId: progress }
  const listenersRef = useRef({});
  const metaUnsubsRef = useRef({});
  const lastVisibleRef = useRef({});
  const convsUnsubRef = useRef(null);

  // ---- Conversations listener ----
  useEffect(() => {
    if (!user?.uid) {
      convsUnsubRef.current?.();
      setConversations([]);
      return;
    }
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", user.uid),
      orderBy("lastUpdated", "desc")
    );
    convsUnsubRef.current = onSnapshot(q, (snap) => {
      setConversations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => convsUnsubRef.current?.();
  }, [user?.uid]);

  // ---- Subscribe messages ----
  const subscribeMessages = useCallback((conversationId, pageSize = 50) => {
    if (!user?.uid || !conversationId || listenersRef.current[conversationId]) return;
    const messagesRef = collection(db, "conversations", conversationId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"), limit(pageSize));

    const unsubMsgs = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setActiveMessages((prev) => ({ ...prev, [conversationId]: msgs }));
      lastVisibleRef.current[conversationId] = snap.docs[snap.docs.length - 1] || null;
    });

    const convDocRef = doc(db, "conversations", conversationId);
    const unsubMeta = onSnapshot(convDocRef, (snap) => {
      const data = snap.data();
      if (data?.typing) setTypingStatus((prev) => ({ ...prev, [conversationId]: data.typing }));
    });

    listenersRef.current[conversationId] = unsubMsgs;
    metaUnsubsRef.current[conversationId] = unsubMeta;
  }, [user?.uid]);

  // ---- Unsubscribe messages ----
  const unsubscribeMessages = useCallback((conversationId) => {
    listenersRef.current[conversationId]?.();
    delete listenersRef.current[conversationId];
    metaUnsubsRef.current[conversationId]?.();
    delete metaUnsubsRef.current[conversationId];
    delete lastVisibleRef.current[conversationId];
    setActiveMessages((prev) => { const n = { ...prev }; delete n[conversationId]; return n; });
    setTypingStatus((prev) => { const n = { ...prev }; delete n[conversationId]; return n; });
  }, []);

  // ---- Load older messages ----
  const loadMoreMessages = async (conversationId, pageSize = 50) => {
    const cursor = lastVisibleRef.current[conversationId];
    if (!cursor) return [];
    const messagesRef = collection(db, "conversations", conversationId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"), startAfter(cursor), limit(pageSize));
    const snap = await getDocs(q);
    const more = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (more.length) lastVisibleRef.current[conversationId] = snap.docs[snap.docs.length - 1];
    setActiveMessages((prev) => ({ ...prev, [conversationId]: [...(prev[conversationId] || []), ...more] }));
    return more;
  };

  // ---- Send message with optional media ----
  const sendMessage = async (conversationId, message, mediaFile = null) => {
    if (!user?.uid || !conversationId || (!message?.content && !mediaFile)) return;
    const convRef = doc(db, "conversations", conversationId);
    let mediaURL = "";

    if (mediaFile) {
      const ext = mediaFile.name?.split(".").pop() || "bin";
      const mediaRef = ref(storage, `messages/${conversationId}/${Date.now()}_${user.uid}.${ext}`);
      const uploadTask = uploadBytesResumable(mediaRef, mediaFile);
      uploadTask.on("state_changed", (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress((prev) => ({ ...prev, [mediaFile.name]: progress }));
      });
      await uploadTask;
      mediaURL = await getDownloadURL(mediaRef);
    }

    const msgData = {
      ...message,
      mediaURL,
      senderId: user.uid,
      timestamp: serverTimestamp(),
      reactions: {},
      readBy: [user.uid],
      edited: false,
      deletedBy: [],
      replies: [],
      status: "sent",
      lastReadTimestamp: { [user.uid]: serverTimestamp() },
    };

    const messagesRef = collection(db, "conversations", conversationId, "messages");
    const newMsgRef = await addDoc(messagesRef, msgData);

    await runTransaction(db, async (tx) => {
      const convSnap = await tx.get(convRef);
      if (!convSnap.exists()) return;
      const data = convSnap.data();
      const unread = { ...(data.unread || {}) };
      (data.participants || []).forEach((uid) => {
        if (uid !== user.uid) unread[uid] = (unread[uid] || 0) + 1;
      });
      tx.update(convRef, { lastUpdated: serverTimestamp(), unread });
    });

    return newMsgRef.id;
  };

  // ---- Mark conversation read ----
  const markAsRead = async (conversationId) => {
    if (!user?.uid) return;
    const convRef = doc(db, "conversations", conversationId);
    await runTransaction(db, async (tx) => {
      const convSnap = await tx.get(convRef);
      if (!convSnap.exists()) return;
      const data = convSnap.data();
      const unread = { ...(data.unread || {}) };
      unread[user.uid] = 0;
      tx.update(convRef, { unread });
      const messagesRef = collection(db, "conversations", conversationId, "messages");
      const msgsSnap = await getDocs(messagesRef);
      for (const msgDoc of msgsSnap.docs) {
        const msgData = msgDoc.data();
        if (!(msgData.readBy || []).includes(user.uid)) tx.update(msgDoc.ref, { readBy: arrayUnion(user.uid), lastReadTimestamp: { [user.uid]: serverTimestamp() } });
      }
    });
  };

  // ---- Delete / edit / react / reply ----
  const deleteMessage = async (conversationId, messageId, hard = false) => {
    const messageRef = doc(db, "conversations", conversationId, "messages", messageId);
    if (hard) await deleteDoc(messageRef);
    else await updateDoc(messageRef, { deletedBy: arrayUnion(user.uid) });
  };

  const editMessage = async (conversationId, messageId, newContent) => {
    const messageRef = doc(db, "conversations", conversationId, "messages", messageId);
    await updateDoc(messageRef, { content: newContent, edited: true, editedAt: serverTimestamp() });
  };

  const reactToMessage = async (conversationId, messageId, reaction) => {
    const messageRef = doc(db, "conversations", conversationId, "messages", messageId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(messageRef);
      if (!snap.exists()) return;
      const reactions = { ...(snap.data().reactions || {}) };
      reactions[user.uid] = reaction;
      tx.update(messageRef, { reactions });
    });
  };

  const replyToMessage = async (conversationId, messageId, replyContent) => {
    const messageRef = doc(db, "conversations", conversationId, "messages", messageId);
    const reply = { id: crypto.randomUUID?.() || String(Date.now()), senderId: user.uid, content: replyContent, timestamp: serverTimestamp() };
    await updateDoc(messageRef, { replies: arrayUnion(reply) });
  };

  // ---- Typing ----
  const setUserTyping = async (conversationId, isTyping) => {
    if (!user?.uid || !conversationId) return;
    const convRef = doc(db, "conversations", conversationId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(convRef);
      if (!snap.exists()) return;
      const typing = { ...(snap.data().typing || {}) };
      typing[user.uid] = !!isTyping;
      tx.update(convRef, { typing });
    });
  };

  // ---- Create conversation (DM / Group) ----
  const createConversation = async (participantIds, name = "", isGroup = false, admins = []) => {
    if (!user?.uid) throw new Error("No user");
    const convRef = doc(collection(db, "conversations"));
    const participants = Array.from(new Set([user.uid, ...participantIds]));
    await setDoc(convRef, {
      participants,
      name: isGroup ? name : "",
      isGroup: !!isGroup,
      admins: isGroup ? Array.from(new Set([user.uid, ...admins])) : [],
      lastUpdated: serverTimestamp(),
      unread: {},
      typing: {},
      createdAt: serverTimestamp(),
      groupAvatar: "",
      groupDescription: "",
      pinnedMessages: [],
      archivedBy: [],
    });
    return convRef.id;
  };

  // ---- Cleanup listeners ----
  useEffect(() => {
    return () => {
      Object.values(listenersRef.current).forEach((u) => u && u());
      Object.values(metaUnsubsRef.current).forEach((u) => u && u());
      listenersRef.current = {};
      metaUnsubsRef.current = {};
    };
  }, []);

  return (
    <MessagingContext.Provider
      value={{
        conversations,
        activeMessages,
        typingStatus,
        uploadProgress,
        subscribeMessages,
        unsubscribeMessages,
        loadMoreMessages,
        sendMessage,
        replyToMessage,
        editMessage,
        deleteMessage,
        reactToMessage,
        markAsRead,
        setUserTyping,
        createConversation,
      }}
    >
      {children}
    </MessagingContext.Provider>
  );
};

export const useMessaging = () => useContext(MessagingContext);