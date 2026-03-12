// src/screens/MessagingScreen.jsx - MASTER CONTROLLER V2
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ConversationList from './ConversationList.jsx';
import ChatScreen from './ChatScreen.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, MessageSquare, Users } from 'lucide-react';

export default function MessagingScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { conversationId } = useParams();
  
  const [showMobileList, setShowMobileList] = useState(!conversationId);
  const [showNewChat, setShowNewChat] = useState(location.pathname === '/messages/new');
  
  // Responsive handling
  const isMobile = window.innerWidth < 768;
  
  // Auto-hide list on mobile when conversation is selected
  useEffect(() => {
    if (isMobile && conversationId) {
      setShowMobileList(false);
    } else if (isMobile && !conversationId) {
      setShowMobileList(true);
    }
  }, [conversationId, isMobile]);
  
  const handleSelectConversation = (conversation) => {
    navigate(`/messages/${conversation.id}`);
    if (isMobile) {
      setShowMobileList(false);
    }
  };
  
  const handleBackToList = () => {
    navigate('/messages');
    if (isMobile) {
      setShowMobileList(true);
    }
  };
  
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Please sign in to access messages</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 overflow-hidden">
      {/* Mobile toggle button */}
      {isMobile && (
        <button
          onClick={() => setShowMobileList(!showMobileList)}
          className="fixed top-4 left-4 z-50 p-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl shadow-2xl"
        >
          {showMobileList ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      )}
      
      {/* Conversation List */}
      <AnimatePresence>
        {(!isMobile || showMobileList) && (
          <motion.div
            key="list"
            initial={{ x: isMobile ? -300 : 0, opacity: isMobile ? 0 : 1 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: isMobile ? -300 : 0, opacity: isMobile ? 0 : 1 }}
            transition={{ type: "spring", damping: 25 }}
            className={`${isMobile ? 'fixed inset-0 z-40' : 'w-96'} flex-shrink-0`}
          >
            <ConversationList
              onSelectConversation={handleSelectConversation}
              selectedConversationId={conversationId}
              showNewChat={showNewChat}
              onToggleNewChat={setShowNewChat}
              className="h-full"
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Chat Screen */}
      <AnimatePresence>
        {(!isMobile || !showMobileList) && (
          <motion.div
            key="chat"
            initial={{ x: isMobile ? 300 : 0, opacity: isMobile ? 0 : 1 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: isMobile ? 300 : 0, opacity: isMobile ? 0 : 1 }}
            transition={{ type: "spring", damping: 25 }}
            className="flex-1"
          >
            {conversationId ? (
              <ChatScreen
                conversationId={conversationId}
                onBack={handleBackToList}
                className="h-full"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <div className="w-48 h-48 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-full flex items-center justify-center mb-8">
                  <MessageSquare className="w-24 h-24 text-blue-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  Arvdoul Messages
                </h2>
                <p className="text-gray-600 dark:text-gray-400 max-w-md mb-8">
                  Select a conversation or start a new one to begin messaging. 
                  Enjoy unlimited text, voice, video, and file sharing.
                </p>
                <div className="flex space-x-4">
                  <button
                    onClick={() => setShowNewChat(true)}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:opacity-90 transition-opacity font-medium"
                  >
                    New Message
                  </button>
                  <button
                    onClick={() => setShowNewChat(true)}
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:opacity-90 transition-opacity font-medium"
                  >
                    New Group
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}