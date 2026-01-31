\/\/ src/screens/MessagesScreen.jsx
import React, { useState, useEffect, useRef } from "react";
import { useMessaging } from "../context/MessagingContext";
import { useUser } from "../context/UserContext";
import { motion, AnimatePresence } from "framer-motion";
import defaultProfile from "../assets/default-profile.png";

export default function MessagesScreen() {
  const { user } = useUser();
  const {
    conversations,
    activeMessages,
    typingStatus,
    uploadProgress,
    subscribeMessages,
    unsubscribeMessages,
    loadMoreMessages,
    sendMessage,
    reactToMessage,
    editMessage,
    deleteMessage,
    replyToMessage,
    markAsRead,
    setUserTyping,
  } = useMessaging();

  const [selectedConv, setSelectedConv] = useState(null);
  const [messageInput, setMessageInput] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const messagesEndRef = useRef(null);

  \/\/ Subscribe messages
  useEffect(() => {
    if (!selectedConv) return;
    subscribeMessages(selectedConv.id);
    markAsRead(selectedConv.id);

    return () => unsubscribeMessages(selectedConv.id);
  }, [selectedConv?.id]);

  \/\/ Scroll to bottom on new message
  useEffect(() => {
    if (!selectedConv) return;
    const msgs = activeMessages[selectedConv.id] || [];
    if (msgs.length && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeMessages[selectedConv?.id]?.length]);

  const handleSend = async () => {
    if ((!messageInput.trim() && !mediaFile) || !selectedConv) return;
    await sendMessage(selectedConv.id, { content: messageInput.trim() }, mediaFile);
    setMessageInput("");
    setMediaFile(null);
  };

  const handleLoadMore = async () => {
    if (!selectedConv) return;
    setLoadingMore(true);
    await loadMoreMessages(selectedConv.id, 50);
    setLoadingMore(false);
  };

  const renderMessage = (msg) => {
    const isMe = msg.senderId === user.uid;
    const isDeleted = msg.deletedBy?.includes(user.uid);

    return (
      <motion.div
        key={msg.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className={`max-w-[70%] p-3 rounded-xl my-1 break-words ${
          isMe
            ? "bg-blue-600 text-white self-end rounded-br-none"
            : "bg-gray-200 dark:bg-gray-800 text-black dark:text-white self-start rounded-bl-none"
        }`}
      >
        {isDeleted ? (
          <em className="text-gray-500 dark:text-gray-400 italic">Message deleted</em>
        ) : (
          <>
            {msg.mediaURL && (
              <img src={msg.mediaURL} className="max-h-60 rounded-lg mb-1 object-cover" />
            )}
            <span>{msg.content}</span>
            {msg.edited && <small className="ml-1 text-xs">(edited)</small>}
            {msg.replies?.length > 0 && (
              <div className="mt-1 pl-2 border-l-2 border-gray-400 dark:border-gray-600">
                {msg.replies.map((r) => (
                  <div key={r.id} className="text-xs text-gray-600 dark:text-gray-300">
                    {r.content}
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between items-center mt-1">
              <small className="text-xs text-gray-400">
                {msg.timestamp?.toDate ? new Date(msg.timestamp.toDate()).toLocaleTimeString() : ""}
              </small>
              {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                <div className="text-xs ml-2">{Object.values(msg.reactions).join(" ")}</div>
              )}
            </div>
            {uploadProgress[msg.mediaURL] && (
              <div className="w-full h-1 bg-gray-300 rounded mt-1">
                <div
                  className="h-1 bg-blue-500 rounded"
                  style={`{ width: `${uploadProgress[msg.mediaURL]}%` `}}
                />
              </div>
            )}
          </>
        )}
      </motion.div>
    );
  };

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950">
      {/* Conversations List */}
      <div className="w-80 border-r border-gray-300 dark:border-gray-700 overflow-y-auto">
        <h2 className="p-4 font-bold text-xl">Chats</h2>
        {conversations.map((conv) => {
          const lastMsg = activeMessages[conv.id]?.slice(-1)[0];
          const unreadCount = conv.unread?.[user.uid] || 0;
          return (
            <div
              key={conv.id}
              onClick={() => setSelectedConv(conv)}
              className={`flex items-center p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                selectedConv?.id === conv.id ? "bg-gray-100 dark:bg-gray-800" : ""
              }`}
            >
              <img
                src={conv.groupAvatar || defaultProfile}
                className="w-12 h-12 rounded-full mr-3 object-cover"
              />
              <div className="flex-1">
                <div className="font-semibold">{conv.isGroup ? conv.name : "Direct Message"}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {lastMsg ? lastMsg.content : "No messages yet"}
                </div>
              </div>
              {unreadCount > 0 && (
                <div className="ml-2 bg-blue-600 text-white rounded-full px-2 text-xs">
                  {unreadCount}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {selectedConv ? (
          <>
            <div
              className="flex-1 flex flex-col p-4 overflow-y-auto"
              onScroll={(e) => {
                if (e.currentTarget.scrollTop === 0) handleLoadMore();
              }}
            >
              <AnimatePresence initial={false}>
                {activeMessages[selectedConv.id]?.map((msg) => renderMessage(msg))}
              </AnimatePresence>
              <div ref={messagesEndRef}></div>
            </div>

            {/* Typing */}
            {typingStatus[selectedConv.id] &&
              Object.entries(typingStatus[selectedConv.id])
                .filter(([uid, t]) => t && uid !== user.uid)
                .length > 0 && (
                <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">Typing...</div>
              )}

            {/* Input */}
            <div className="p-3 border-t border-gray-300 dark:border-gray-700 flex items-center space-x-2">
              <input
                type="file"
                accept="image/*,video/*"
                onChange={(e) => setMediaFile(e.target.files[0])}
              />
              <input
                type="text"
                value={messageInput}
                onChange={(e) => {
                  setMessageInput(e.target.value);
                  setUserTyping(selectedConv.id, e.target.value.length > 0);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type a message..."
                className="flex-1 p-2 rounded-full border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-white"
              />
              <button
                onClick={handleSend}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full"
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
            Select a conversation
          </div>
        )}
      </div>
    </div>
  );
}