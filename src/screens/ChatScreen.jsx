// src/screens/ChatScreen.jsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { messagingService } from '../services/messagesService.js';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Send,
  Image as ImageIcon,
  Video,
  Mic,
  Smile,
  Paperclip,
  Phone,
  Video as VideoIcon,
  Info,
  MoreVertical,
  Check,
  CheckCheck,
  Clock,
  Eye,
  ThumbsUp,
  Heart,
  Star,
  Reply,
  Forward,
  Edit,
  Trash2,
  Pin,
  VolumeX,
  Bell,
  Users,
  Crown,
  Gift,
  Zap,
  Shield,
  Lock,
  Download,
  Copy,
  Flag,
  X,
  Search,
  Filter,
  Calendar,
  MapPin,
  FileText,
  Music,
  Camera
} from 'lucide-react';

// Emoji picker component
const EmojiPicker = ({ onSelect, onClose }) => {
  const emojis = ['😀', '😂', '😍', '😢', '😡', '👍', '❤️', '🎉', '🔥', '⭐'];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-3 z-50"
    >
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-white">Emoji</h3>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {emojis.map(emoji => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="p-2 text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {emoji}
          </button>
        ))}
      </div>
    </motion.div>
  );
};

// Message bubble component
const MessageBubble = React.memo(({ 
  message, 
  isOwn, 
  showAvatar, 
  showTime, 
  onReact,
  onReply,
  onMenu,
  isSelected,
  onSelect,
  currentUserId
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [reactions, setReactions] = useState(message.reactions || {});
  
  const getStatusIcon = () => {
    if (!isOwn) return null;
    
    if (message.readBy && message.readBy.length > 0) {
      return <CheckCheck className="w-4 h-4 text-blue-500" />;
    }
    if (message.deliveredTo && message.deliveredTo.length > 0) {
      return <CheckCheck className="w-4 h-4 text-gray-400" />;
    }
    if (message.status === 'SENT') {
      return <Check className="w-4 h-4 text-gray-400" />;
    }
    return <Clock className="w-4 h-4 text-gray-400 animate-pulse" />;
  };
  
  const getMessageTime = () => {
    if (!message.createdAt) return '';
    const date = message.createdAt?.toDate?.() || new Date(message.createdAt);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const handleDoubleClick = () => {
    if (!isOwn) {
      onReact && onReact(message.id, '❤️');
    }
  };
  
  const renderContent = () => {
    switch (message.type) {
      case 'text':
        return (
          <div className="whitespace-pre-wrap break-words">
            {message.content}
          </div>
        );
        
      case 'image':
        return (
          <div className="relative group">
            <img 
              src={message.media?.url || message.content} 
              alt="Shared image" 
              className="max-w-xs rounded-2xl cursor-pointer hover:opacity-95 transition-all"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        );
        
      case 'video':
        return (
          <div className="relative">
            <video 
              src={message.media?.url} 
              className="max-w-xs rounded-2xl"
              controls
              poster={message.media?.thumbnail}
            />
          </div>
        );
        
      case 'voice':
        return (
          <div className="flex items-center space-x-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-4 rounded-2xl">
            <Mic className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <div className="flex-1">
              <div className="h-2 bg-gradient-to-r from-purple-200 to-pink-200 dark:from-purple-700 dark:to-pink-700 rounded-full animate-pulse" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {Math.floor(message.media?.duration || 0)}s
            </span>
          </div>
        );
        
      case 'gift':
        return (
          <div className="flex items-center space-x-3 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 p-4 rounded-2xl">
            <Gift className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <div className="flex-1">
              <div className="font-semibold text-gray-900 dark:text-white">
                {message.gift?.giftType || 'Gift'}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {message.gift?.coinValue || 0} coins
              </div>
            </div>
          </div>
        );
        
      case 'file':
        return (
          <div className="flex items-center space-x-3 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 p-4 rounded-2xl">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div className="flex-1">
              <div className="font-medium truncate">{message.media?.name}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {(message.media?.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
            <button className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg">
              <Download className="w-4 h-4 text-blue-500" />
            </button>
          </div>
        );
        
      default:
        return <div>{message.content}</div>;
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group relative`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={handleDoubleClick}
    >
      <div className={`flex max-w-[80%] ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end space-x-2`}>
        {/* Avatar */}
        {showAvatar && !isOwn && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border-2 border-white dark:border-gray-800 shadow-lg">
            <img 
              src={message.senderPhoto || '/assets/default-profile.png'} 
              alt={message.senderName}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        {/* Message Bubble */}
        <div className={`relative ${isOwn ? 'pr-2' : 'pl-2'}`}>
          {!isOwn && (
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 ml-1">
              {message.senderName}
            </div>
          )}
          
          {/* Reply context */}
          {message.replyTo && (
            <div className={`mb-2 p-2 rounded-lg ${
              isOwn ? 'bg-blue-400/30' : 'bg-gray-200/50 dark:bg-gray-700/50'
            }`}>
              <div className="text-xs font-medium truncate">
                Replying to {message.replyToUsername}
              </div>
              <div className="text-xs truncate opacity-75">
                {message.replyContent?.substring(0, 50)}...
              </div>
            </div>
          )}
          
          <div
            className={`relative rounded-2xl p-4 shadow-lg transition-all duration-200 ${
              isOwn
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-br-sm'
                : 'bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 text-gray-800 dark:text-gray-200 rounded-bl-sm'
            } ${isSelected ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}`}
            onClick={() => onSelect && onSelect(message.id)}
          >
            {/* Edited indicator */}
            {message.isEdited && (
              <div className="absolute -top-2 right-2 text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded-full">
                edited
              </div>
            )}
            
            {/* Content */}
            {renderContent()}
            
            {/* Message Footer */}
            <div className={`flex items-center justify-between mt-2 text-xs ${
              isOwn ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
            }`}>
              <div className="flex items-center space-x-1">
                {getStatusIcon()}
                <span>{getMessageTime()}</span>
              </div>
              
              {/* Reactions */}
              {Object.keys(reactions).length > 0 && (
                <div className="flex items-center space-x-1">
                  {Object.entries(reactions).map(([emoji, users]) => (
                    <div 
                      key={emoji}
                      className="bg-white/20 dark:bg-black/20 px-1.5 py-0.5 rounded-full text-xs"
                    >
                      {emoji} {users.length > 1 && users.length}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Message Actions */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`absolute ${
                  isOwn ? 'right-full mr-2' : 'left-full ml-2'
                } top-1/2 transform -translate-y-1/2 flex items-center space-x-1 bg-white dark:bg-gray-800 rounded-full shadow-xl p-1 border border-gray-200 dark:border-gray-700 z-10`}
              >
                <button
                  onClick={() => onReact && onReact(message.id, '❤️')}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                  title="React with ❤️"
                >
                  <Heart className="w-4 h-4 text-red-500" />
                </button>
                <button
                  onClick={() => onReply && onReply(message)}
                  className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                  title="Reply"
                >
                  <Reply className="w-4 h-4 text-blue-500" />
                </button>
                <button
                  onClick={() => onMenu && onMenu(message)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  title="More options"
                >
                  <MoreVertical className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Own message avatar space */}
        {showAvatar && isOwn && <div className="w-8" />}
      </div>
    </motion.div>
  );
});

// Message input component
const MessageInput = ({ 
  onSend, 
  onTyping, 
  onAttach, 
  disabled,
  placeholder = "Message..." 
}) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef(null);
  
  const handleSend = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
      setShowEmojiPicker(false);
    }
  };
  
  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true);
      onTyping(true);
      
      setTimeout(() => {
        setIsTyping(false);
        onTyping(false);
      }, 3000);
    }
  };
  
  const handleEmojiSelect = (emoji) => {
    setMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };
  
  const attachments = [
    { icon: ImageIcon, label: 'Photo', color: 'text-green-500' },
    { icon: Camera, label: 'Camera', color: 'text-purple-500' },
    { icon: Video, label: 'Video', color: 'text-red-500' },
    { icon: FileText, label: 'Document', color: 'text-blue-500' },
    { icon: Music, label: 'Audio', color: 'text-pink-500' },
    { icon: MapPin, label: 'Location', color: 'text-orange-500' },
    { icon: Gift, label: 'Gift', color: 'text-yellow-500' },
    { icon: Calendar, label: 'Event', color: 'text-indigo-500' }
  ];
  
  return (
    <div className="relative">
      {/* Emoji Picker */}
      <AnimatePresence>
        {showEmojiPicker && (
          <EmojiPicker
            onSelect={handleEmojiSelect}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}
      </AnimatePresence>
      
      {/* Attachments Panel */}
      <form onSubmit={handleSend} className="relative">
        <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 rounded-2xl p-2 shadow-lg border border-gray-200 dark:border-gray-700">
          {/* Attachment Button */}
          <div className="relative group">
            <button
              type="button"
              onClick={onAttach}
              className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
              disabled={disabled}
            >
              <Paperclip className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
            
            {/* Attachment Menu */}
            <div className="absolute bottom-full left-0 mb-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-20">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-3 border border-gray-200 dark:border-gray-700 min-w-[200px]">
                <div className="grid grid-cols-4 gap-2">
                  {attachments.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      className="flex flex-col items-center p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      onClick={() => onAttach && onAttach(item.label.toLowerCase())}
                    >
                      <item.icon className={`w-6 h-6 ${item.color} mb-1`} />
                      <span className="text-xs text-gray-600 dark:text-gray-400">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Message Input */}
          <div className="flex-1">
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                handleTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder={placeholder}
              className="w-full bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-base"
              disabled={disabled}
            />
          </div>
          
          {/* Emoji Button */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            disabled={disabled}
          >
            <Smile className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
          
          {/* Voice Message */}
          <button
            type="button"
            className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            disabled={disabled}
          >
            <Mic className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
          
          {/* Send Button */}
          <button
            type="submit"
            disabled={!message.trim() || disabled}
            className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default function ChatScreen() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // State Management
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState({});
  const [showInfo, setShowInfo] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [subscriptionId, setSubscriptionId] = useState(null);
  
  // Refs
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  
  // Load conversation and messages
  useEffect(() => {
    if (!conversationId || !user) return;
    
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load conversation
        const convResult = await messagingService.getConversation(conversationId, {
          cacheFirst: true,
          loadParticipants: true
        });
        
        if (convResult.success) {
          setConversation(convResult.conversation);
        } else {
          toast.error('Conversation not found');
          navigate('/messages');
          return;
        }
        
        // Load messages
        const msgResult = await messagingService.getMessages(conversationId, {
          limit: 100,
          markAsRead: true
        });
        
        if (msgResult.success) {
          setMessages(msgResult.messages);
        }
      } catch (error) {
        console.error('Failed to load chat:', error);
        toast.error('Failed to load conversation');
        navigate('/messages');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
    
    // Subscribe to real-time updates
    const subId = messagingService.subscribeToConversation(
      conversationId,
      user.uid,
      (update) => {
        if (update.type === 'NEW_MESSAGE') {
          setMessages(prev => [...prev, update.message]);
        } else if (update.type === 'TYPING_UPDATE') {
          setTypingUsers(update.typing || {});
        }
      }
    );
    
    setSubscriptionId(subId);
    
    return () => {
      if (subId) messagingService.unsubscribe(subId);
    };
  }, [conversationId, user, navigate]);
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Handle typing indicator
  const handleTyping = useCallback((isTyping) => {
    if (!conversationId || !user) return;
    messagingService.sendTypingIndicator(conversationId, user.uid, isTyping);
  }, [conversationId, user]);
  
  // Send message
  const handleSendMessage = async (content) => {
    if (!content.trim() || !conversationId || !user) return;
    
    try {
      const messageData = {
        type: 'text',
        content: content.trim(),
        replyTo: replyTo?.id
      };
      
      const result = await messagingService.sendMessage(conversationId, messageData, {
        clientId: `temp_${Date.now()}`,
        optimisticId: `opt_${Date.now()}`
      });
      
      if (result.success) {
        setReplyTo(null);
      } else {
        toast.error(result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Send message failed:', error);
      toast.error('Failed to send message');
    }
  };
  
  // Handle message reaction
  const handleReactToMessage = async (messageId, emoji) => {
    try {
      // Update local state optimistically
      setMessages(prev => prev.map(msg => 
        msg.id === messageId
          ? {
              ...msg,
              reactions: {
                ...msg.reactions,
                [emoji]: [...(msg.reactions?.[emoji] || []), user.uid]
              }
            }
          : msg
      ));
      
      toast.success(`Reacted with ${emoji}`);
    } catch (error) {
      console.error('React to message failed:', error);
    }
  };
  
  // Handle message reply
  const handleReplyToMessage = (message) => {
    setReplyTo(message);
    toast.info(`Replying to: ${message.content?.substring(0, 50)}...`);
  };
  
  // Handle back
  const handleBack = () => {
    navigate('/messages');
  };
  
  // Handle attachment
  const handleAttachment = (type) => {
    toast.info(`Attach ${type}`);
  };
  
  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-gray-600 dark:text-gray-400">Loading conversation...</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (!conversation) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 text-center">
        <div className="w-20 h-20 bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-900/20 dark:to-pink-900/20 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-10 h-10 text-red-500" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Conversation not found
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          The conversation you're looking for doesn't exist or you don't have access.
        </p>
        <button
          onClick={handleBack}
          className="px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          Back to Messages
        </button>
      </div>
    );
  }
  
  const isGroup = conversation.type === 'group';
  const otherParticipant = !isGroup && conversation.participantDetails?.find(p => p.uid !== user.uid);
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors lg:hidden"
            >
              <ArrowLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
            
            {/* Conversation Info */}
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white dark:border-gray-800 shadow-lg">
                  {isGroup ? (
                    <img 
                      src={conversation.photoURL || '/assets/default-group.png'} 
                      alt={conversation.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <img 
                      src={otherParticipant?.photoURL || '/assets/default-profile.png'} 
                      alt={otherParticipant?.displayName}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                {!isGroup && otherParticipant?.isOnline && (
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800" />
                )}
              </div>
              
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">
                  {isGroup ? conversation.name : otherParticipant?.displayName}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                  {Object.keys(typingUsers).length > 0 ? (
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-100" />
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-200" />
                      <span className="ml-1">typing...</span>
                    </div>
                  ) : isGroup ? (
                    `${conversation.participantCount} members`
                  ) : otherParticipant?.isOnline ? (
                    'Online'
                  ) : (
                    `Last seen ${new Date(otherParticipant?.lastActive || 0).toLocaleTimeString()}`
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Header Actions */}
          <div className="flex items-center space-x-2">
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
              <Phone className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
              <VideoIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
            <button 
              onClick={() => setShowInfo(!showInfo)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              <Info className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
              <MoreVertical className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>
        
        {/* Reply Context */}
        {replyTo && (
          <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl flex items-center justify-between">
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                Replying to {replyTo.senderName}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                {replyTo.content?.substring(0, 50)}...
              </div>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        )}
      </div>
      
      {/* Messages Container */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-white/50 to-gray-50/50 dark:from-gray-900/50 dark:to-gray-950/50"
      >
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Welcome Message */}
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12"
            >
              <div className="w-24 h-24 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-12 h-12 text-blue-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Start a conversation
              </h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto mb-8">
                {isGroup 
                  ? `Welcome to ${conversation.name}! Send your first message to start the conversation.`
                  : `Say hello to ${otherParticipant?.displayName}! Start a conversation by sending a message.`}
              </p>
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl">
                  <div className="text-3xl mb-2">👋</div>
                  <div className="font-medium text-gray-900 dark:text-white">Say Hello</div>
                </div>
                <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10 rounded-xl">
                  <div className="text-3xl mb-2">📷</div>
                  <div className="font-medium text-gray-900 dark:text-white">Share Photo</div>
                </div>
                <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 rounded-xl">
                  <div className="text-3xl mb-2">🎤</div>
                  <div className="font-medium text-gray-900 dark:text-white">Voice Message</div>
                </div>
                <div className="p-4 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10 rounded-xl">
                  <div className="text-3xl mb-2">🎁</div>
                  <div className="font-medium text-gray-900 dark:text-white">Send Gift</div>
                </div>
              </div>
            </motion.div>
          )}
          
          {/* Messages */}
          {messages.map((message, index) => {
            const previousMessage = messages[index - 1];
            const showAvatar = !previousMessage || 
                              previousMessage.senderId !== message.senderId ||
                              (new Date(message.createdAt) - new Date(previousMessage.createdAt)) > 5 * 60 * 1000;
                              
            const showTime = index === messages.length - 1 || 
                           (messages[index + 1] && messages[index + 1].senderId !== message.senderId);
            
            return (
              <MessageBubble
                key={message.id || `temp-${index}`}
                message={message}
                isOwn={message.senderId === user.uid}
                showAvatar={showAvatar}
                showTime={showTime}
                onReact={handleReactToMessage}
                onReply={handleReplyToMessage}
                currentUserId={user.uid}
              />
            );
          })}
          
          {/* Typing Indicators */}
          {Object.keys(typingUsers).map(userId => {
            if (userId === user.uid) return null;
            
            const typingUser = conversation.participantDetails?.find(p => p.uid === userId);
            return (
              <div key={userId} className="flex items-start space-x-2">
                <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white dark:border-gray-800">
                  <img 
                    src={typingUser?.photoURL || '/assets/default-profile.png'} 
                    alt={typingUser?.displayName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-sm p-4">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                  </div>
                </div>
              </div>
            );
          })}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Message Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto">
          <MessageInput
            onSend={handleSendMessage}
            onTyping={handleTyping}
            onAttach={handleAttachment}
            disabled={!conversation}
            placeholder={replyTo 
              ? `Reply to ${replyTo.senderName}...`
              : `Message ${isGroup ? conversation.name : otherParticipant?.displayName}...`}
          />
        </div>
      </div>
    </div>
  );
}