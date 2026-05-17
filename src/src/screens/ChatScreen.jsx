// src/screens/ChatScreen.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import messagingService from '../services/messagesService';
import monetizationService from '../services/monetizationService';
import storageService from '../services/storageService';
import userService from '../services/userService';
import searchService from '../services/searchService';
import notificationsService from '../services/notificationsService';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import Modal from 'react-modal';
import { Menu, MenuItem, MenuButton } from '@szhsin/react-menu';
import '@szhsin/react-menu/dist/index.css';
import '@szhsin/react-menu/dist/theme-dark.css';
import EmojiPicker from '@emoji-mart/react';
import data from '@emoji-mart/data';

// Icons (individual imports for bundle size)
import ArrowLeft from 'lucide-react/icons/arrow-left';
import Send from 'lucide-react/icons/send';
import Smile from 'lucide-react/icons/smile';
import ImageIcon from 'lucide-react/icons/image';
import Video from 'lucide-react/icons/video';
import File from 'lucide-react/icons/file';
import Mic from 'lucide-react/icons/mic';
import Gift from 'lucide-react/icons/gift';
import MoreVertical from 'lucide-react/icons/more-vertical';
import Check from 'lucide-react/icons/check';
import CheckCheck from 'lucide-react/icons/check-check';
import Trash2 from 'lucide-react/icons/trash-2';
import Edit from 'lucide-react/icons/edit';
import Flag from 'lucide-react/icons/flag';
import Lock from 'lucide-react/icons/lock';
import Unlock from 'lucide-react/icons/unlock';
import X from 'lucide-react/icons/x';
import MapPin from 'lucide-react/icons/map-pin';
import Phone from 'lucide-react/icons/phone';
import Users from 'lucide-react/icons/users';
import Plus from 'lucide-react/icons/plus';
import Shield from 'lucide-react/icons/shield';
import UserMinus from 'lucide-react/icons/user-minus';
import LinkIcon from 'lucide-react/icons/link';
import Search from 'lucide-react/icons/search';
import Ban from 'lucide-react/icons/ban';
import Loader2 from 'lucide-react/icons/loader-2';

Modal.setAppElement('#root');

const MESSAGE_TYPES = messagingService.MESSAGE_TYPES;
const REACTION_TYPES = messagingService.REACTION_TYPES;
const PENDING_MESSAGES_KEY = 'arvdoul_pending_messages';

// ---------- Helper: offline queue ----------
const OfflineQueue = {
async add(message) {
try {
const existing = localStorage.getItem(PENDING_MESSAGES_KEY);
const pending = existing ? JSON.parse(existing) : [];
pending.push(message);
localStorage.setItem(PENDING_MESSAGES_KEY, JSON.stringify(pending));
} catch (err) {}
},
async getAll() {
try {
const existing = localStorage.getItem(PENDING_MESSAGES_KEY);
return existing ? JSON.parse(existing) : [];
} catch (err) { return []; }
},
async remove(clientId) {
try {
const existing = localStorage.getItem(PENDING_MESSAGES_KEY);
if (existing) {
const pending = JSON.parse(existing).filter(m => m._clientId !== clientId);
localStorage.setItem(PENDING_MESSAGES_KEY, JSON.stringify(pending));
}
} catch (err) {}
},
async clear() {
localStorage.removeItem(PENDING_MESSAGES_KEY);
}
};

// ---------- Message Bubble Component ----------
const MessageBubble = React.memo(({ message, isOwn, onReaction, onReply, onEdit, onDelete, onReport, onForward, conversationId, userId }) => {
const time = message.createdAt?.toDate ? format(message.createdAt.toDate(), 'p') : '';

const handleReaction = (reaction) => {
onReaction(message.id, reaction);
};

const handleReply = () => {
onReply(message);
};

const handleEdit = () => {
onEdit(message);
};

const handleDelete = (forEveryone) => {
onDelete(message.id, forEveryone);
};

const handleReport = () => {
onReport(message.id);
};

const handleForward = () => {
onForward(message);
};

return (
<div className={cn('flex mb-2', isOwn ? 'justify-end' : 'justify-start')}>
<div className={cn('max-w-[70%]', isOwn ? 'items-end' : 'items-start')}>
{/* Reply preview */}
{message.replyTo && (
<div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2 mb-1 text-sm">
<span className="text-xs text-gray-600 dark:text-gray-400">Replying to {message.replyTo.senderName}</span>
<p className="text-gray-900 dark:text-white truncate">{message.replyTo.contentPreview}</p>
</div>
)}

{/* Message bubble */}  
    <div  
      className={cn(  
        'rounded-2xl px-4 py-2 relative group',  
        isOwn ? 'bg-blue-600 rounded-br-none text-white' : 'bg-gray-200 dark:bg-gray-800 rounded-bl-none text-gray-900 dark:text-white'  
      )}  
    >  
      {/* Content by type */}  
      {message.type === MESSAGE_TYPES.TEXT && <p>{message.content}</p>}  
      {message.type === MESSAGE_TYPES.IMAGE && (  
        <img src={message.media.url} alt="" className="max-w-full rounded-lg cursor-pointer" onClick={() => window.open(message.media.url)} />  
      )}  
      {message.type === MESSAGE_TYPES.VIDEO && (  
        <video src={message.media.url} controls className="max-w-full rounded-lg" />  
      )}  
      {message.type === MESSAGE_TYPES.FILE && (  
        <a href={message.media.url} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-600 underline">  
          <File size={16} className="mr-1" /> {message.media.name}  
        </a>  
      )}  
      {message.type === MESSAGE_TYPES.VOICE && (  
        <audio src={message.media.url} controls className="h-8" />  
      )}  
      {message.type === MESSAGE_TYPES.LOCATION && (  
        <a href={`https://www.google.com/maps?q=${message.location.lat},${message.location.lng}`} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-600">  
          <MapPin size={16} className="mr-1" /> {message.content}  
        </a>  
      )}  
      {message.type === MESSAGE_TYPES.CONTACT && (  
        <div>  
          <p className="font-bold">{message.contact.name}</p>  
          {message.contact.phoneNumbers?.map((p, i) => <p key={i}>{p.number}</p>)}  
        </div>  
      )}  
      {message.type === MESSAGE_TYPES.POLL && (  
        <PollMessage poll={message.poll} messageId={message.id} conversationId={conversationId} userId={userId} />  
      )}  
      {message.type === MESSAGE_TYPES.GIFT && (  
        <div className="flex items-center">  
          <Gift size={16} className="mr-2" />  
          <span>Sent a gift! 🎁</span>  
        </div>  
      )}  

      {/* Reactions display */}  
      {message.reactions && Object.keys(message.reactions).length > 0 && (  
        <div className="absolute -bottom-3 right-2 flex bg-white dark:bg-gray-900 rounded-full px-2 py-1 shadow text-sm space-x-1">  
          {Object.entries(message.reactions).map(([uid, reaction]) => (  
            <span key={uid}>{reaction}</span>  
          ))}  
        </div>  
      )}  

      {/* Time and status */}  
      <div className="flex items-center justify-end mt-1 space-x-1">  
        <span className="text-xs opacity-75">{time}</span>  
        {isOwn && (  
          message.status === 'sending' ? <Loader2 size={12} className="animate-spin" /> :  
          message.status === 'sent' ? <Check size={12} /> :  
          message.status === 'delivered' ? <CheckCheck size={12} /> :  
          message.status === 'pending' ? <span className="text-xs">⌛</span> : null  
        )}  
      </div>  

      {/* Reaction buttons (on hover) */}  
      <div className="absolute -top-4 right-0 opacity-0 group-hover:opacity-100 transition bg-white dark:bg-gray-800 rounded-full shadow px-1 py-0.5 flex space-x-1">  
        {REACTION_TYPES.map(r => (  
          <button key={r} onClick={() => handleReaction(r)} className="text-lg hover:scale-125 transition">  
            {r}  
          </button>  
        ))}  
      </div>  
    </div>  

    {/* Actions menu */}  
    <Menu  
      menuButton={<MenuButton className="mt-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"><MoreVertical size={16} /></MenuButton>}  
      direction="bottom"  
      align="end"  
    >  
      <MenuItem onClick={handleReply}>Reply</MenuItem>  
      {isOwn && (  
        <>  
          <MenuItem onClick={handleEdit}>Edit</MenuItem>  
          <MenuItem onClick={() => handleDelete(false)}>Delete for me</MenuItem>  
          <MenuItem onClick={() => handleDelete(true)}>Delete for everyone</MenuItem>  
        </>  
      )}  
      <MenuItem onClick={handleForward}>Forward</MenuItem>  
      {!isOwn && <MenuItem onClick={handleReport}>Report</MenuItem>}  
    </Menu>  
  </div>  
</div>

);
});

// ---------- Poll Message Component ----------
const PollMessage = ({ poll, messageId, conversationId, userId }) => {
const [voted, setVoted] = useState(false);
const [selectedOptions, setSelectedOptions] = useState([]);

const vote = async (index) => {
if (voted && !poll.isMultiple) return;
try {
await messagingService.voteOnPoll(conversationId, messageId, userId, index, poll.isMultiple);
if (!poll.isMultiple) setVoted(true);
else setSelectedOptions(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
} catch (err) {
toast.error(err.message);
}
};

return (
<div className="p-2">
<p className="font-bold">{poll.question}</p>
{poll.options.map((opt, idx) => (
<button
key={idx}
onClick={() => vote(idx)}
disabled={!poll.isMultiple && voted}
className="w-full mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded flex justify-between"
>
<span>{opt.text}</span>
<span>{opt.votes} votes</span>
</button>
))}
</div>
);
};

// ---------- Main ChatScreen Component ----------
export default function ChatScreen() {
const { conversationId } = useParams();
const navigate = useNavigate();
const { user } = useAuth();
const { theme } = useTheme();

const [messages, setMessages] = useState([]);
const [conversation, setConversation] = useState(null);
const [inputText, setInputText] = useState('');
const [loading, setLoading] = useState(true);
const [sending, setSending] = useState(false);
const [pagination, setPagination] = useState({ lastDoc: null, hasMore: true });
const [replyTo, setReplyTo] = useState(null);
const [editMessage, setEditMessage] = useState(null);
const [typingUsers, setTypingUsers] = useState({});
const [otherUserPresence, setOtherUserPresence] = useState(null);
const [showEmojiPicker, setShowEmojiPicker] = useState(false);
const [uploadProgress, setUploadProgress] = useState({});
const [showGiftModal, setShowGiftModal] = useState(false);
const [showPollModal, setShowPollModal] = useState(false);
const [showGroupInfo, setShowGroupInfo] = useState(false);
const [showSearchModal, setShowSearchModal] = useState(false);
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState([]);
const [userBlocked, setUserBlocked] = useState(false);
const [coinBalance, setCoinBalance] = useState(0);
const [isRecording, setIsRecording] = useState(false);
const [mediaRecorder, setMediaRecorder] = useState(null);
const [recordingDuration, setRecordingDuration] = useState(0);
const [recordingInterval, setRecordingInterval] = useState(null);

const messagesEndRef = useRef(null);
const fileInputRef = useRef(null);
const videoInputRef = useRef(null);
const documentInputRef = useRef(null);

// ---------- Load conversation and messages ----------
useEffect(() => {
loadConversation();
loadCoinBalance();
loadPendingMessages();
}, [conversationId]);

const loadConversation = async () => {
try {
const result = await messagingService.getConversation(conversationId, { cacheFirst: false });
if (result.success) {
setConversation(result.conversation);
const otherId = result.conversation.participants.find(id => id !== user.uid);
if (otherId) {
messagingService.subscribeToTyping(conversationId, user.uid, (data) => setTypingUsers(data));
messagingService.subscribeToUserPresence(otherId, setOtherUserPresence);
const blockStatus = await userService.isBlocked(user.uid, otherId);
setUserBlocked(blockStatus.blocked);
}
}
} catch (err) {
toast.error('Failed to load conversation');
}
};

const loadCoinBalance = async () => {
try {
const balance = await monetizationService.getBalance(user.uid);
setCoinBalance(balance);
} catch (err) {
console.warn('Failed to load coin balance', err);
}
};

const loadMessages = useCallback(async (refresh = false) => {
if (!conversationId) return;
try {
setLoading(true);
const result = await messagingService.getMessages(conversationId, {
limit: 30,
startAfter: refresh ? null : pagination.lastDoc,
markAsRead: true,
});
if (result.success) {
setMessages(prev => refresh ? result.messages : [...prev, ...result.messages]);
setPagination({
lastDoc: result.nextCursor,
hasMore: result.hasMore,
});
}
} catch (err) {
console.error('Load messages error', err);
} finally {
setLoading(false);
}
}, [conversationId, pagination.lastDoc]);

useEffect(() => {
loadMessages(true);
}, [conversationId]);

useEffect(() => {
messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [messages]);

// ---------- Offline queue ----------
const loadPendingMessages = async () => {
const pending = await OfflineQueue.getAll();
if (pending.length) {
setMessages(prev => [...pending, ...prev]);
}
};

const flushQueue = async () => {
const pending = await OfflineQueue.getAll();
for (const msg of pending) {
try {
await messagingService.sendMessage(conversationId, msg.data, { clientId: msg._clientId });
await OfflineQueue.remove(msg._clientId);
} catch (err) {
console.warn('Failed to resend pending message', err);
}
}
};

useEffect(() => {
const handleOnline = () => flushQueue();
window.addEventListener('online', handleOnline);
return () => window.removeEventListener('online', handleOnline);
}, [conversationId]);

// ---------- Send message ----------
const sendMessage = async () => {
if ((!inputText.trim() && !replyTo && !editMessage) || userBlocked) return;

const clientId = `msg_${Date.now()}_${Math.random().toString(36)}`;  
const messageData = {  
  type: MESSAGE_TYPES.TEXT,  
  content: inputText.trim(),  
  ...(replyTo && { replyTo: { messageId: replyTo.id, contentPreview: replyTo.content } }),  
  ...(editMessage && { editMessageId: editMessage.id }),  
};  

// Optimistic update  
const optimisticMsg = {  
  id: clientId,  
  senderId: user.uid,  
  content: inputText.trim(),  
  createdAt: new Date(),  
  status: 'sending',  
  _clientId: clientId,  
  ...(replyTo && { replyTo }),  
};  
setMessages(prev => [optimisticMsg, ...prev]);  
setInputText('');  
setReplyTo(null);  
setEditMessage(null);  

setSending(true);  
try {  
  if (!navigator.onLine) {  
    await OfflineQueue.add({ _clientId: clientId, data: messageData });  
    setMessages(prev => prev.map(m => m.id === clientId ? { ...m, status: 'pending' } : m));  
  } else {  
    const result = await messagingService.sendMessage(conversationId, messageData, { clientId });  
    setMessages(prev => prev.map(m => m.id === clientId ? { ...result.message, status: 'sent' } : m));  
    monetizationService.addCoins(user.uid, 1, 'message_sent').catch(console.warn);  
  }  
} catch (err) {  
  toast.error(err.message);  
  setMessages(prev => prev.filter(m => m.id !== clientId));  
} finally {  
  setSending(false);  
}

};

// Typing indicator
const handleTyping = (e) => {
const text = e.target.value;
setInputText(text);
messagingService.sendTypingIndicator(conversationId, user.uid, text.length > 0);
};

// ---------- Media upload ----------
const handleImageUpload = (e) => {
const file = e.target.files[0];
if (file) uploadMedia(file, 'image');
};

const handleVideoUpload = (e) => {
const file = e.target.files[0];
if (file) uploadMedia(file, 'video');
};

const handleDocumentUpload = (e) => {
const file = e.target.files[0];
if (file) uploadMedia(file, 'file');
};

const uploadMedia = async (file, type) => {
const uploadId = upload_${Date.now()};
setUploadProgress(prev => ({ ...prev, [uploadId]: 0 }));
try {
const result = await storageService.uploadFileWithProgress(file, 'chat_media', {
userId: user.uid,
onProgress: (progress) => {
setUploadProgress(prev => ({ ...prev, [uploadId]: progress.progress }));
},
});
const messageData = {
type: type === 'image' ? MESSAGE_TYPES.IMAGE : type === 'video' ? MESSAGE_TYPES.VIDEO : MESSAGE_TYPES.FILE,
media: { file: result.downloadURL, ...result },
};
await messagingService.sendMessage(conversationId, messageData);
} catch (err) {
toast.error('Upload failed: ' + err.message);
} finally {
setUploadProgress(prev => {
const newProgress = { ...prev };
delete newProgress[uploadId];
return newProgress;
});
}
};

// ---------- Voice recording (web) ----------
const startRecording = async () => {
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
toast.error('Recording not supported');
return;
}
try {
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const recorder = new MediaRecorder(stream);
const chunks = [];
recorder.ondataavailable = (e) => chunks.push(e.data);
recorder.onstop = async () => {
const blob = new Blob(chunks, { type: 'audio/webm' });
const file = new File([blob], voice_${Date.now()}.webm, { type: 'audio/webm' });
uploadMedia(file, 'voice');
stream.getTracks().forEach(t => track.stop());
};
recorder.start();
setMediaRecorder(recorder);
setIsRecording(true);
const interval = setInterval(() => setRecordingDuration(d => d + 1), 1000);
setRecordingInterval(interval);
} catch (err) {
toast.error('Microphone access denied');
}
};

const stopRecording = () => {
if (mediaRecorder && mediaRecorder.state !== 'inactive') {
mediaRecorder.stop();
setIsRecording(false);
clearInterval(recordingInterval);
setRecordingDuration(0);
}
};

const cancelRecording = () => {
if (mediaRecorder) {
mediaRecorder.onstop = null;
mediaRecorder.stop();
setIsRecording(false);
clearInterval(recordingInterval);
setRecordingDuration(0);
}
};

// ---------- Emoji picker ----------
const addEmoji = (emoji) => {
setInputText(prev => prev + emoji.native);
setShowEmojiPicker(false);
};

// ---------- Gift sending ----------
const sendGift = async (giftType) => {
try {
await monetizationService.sendGift(user.uid, conversationId, giftType);
setShowGiftModal(false);
toast.success('Gift sent!');
monetizationService.addCoins(user.uid, 1, 'gift_sent');
} catch (err) {
toast.error(err.message);
}
};

// ---------- Poll creation ----------
const createPoll = (question, options, isMultiple) => {
const pollData = { question, options: options.map(t => ({ text: t, votes: 0 })), isMultiple, votes: [] };
messagingService.sendMessage(conversationId, { type: MESSAGE_TYPES.POLL, poll: pollData });
setShowPollModal(false);
};

// ---------- Location sharing ----------
const shareLocation = () => {
if (!navigator.geolocation) {
toast.error('Geolocation not supported');
return;
}
navigator.geolocation.getCurrentPosition(async (pos) => {
const { latitude, longitude } = pos.coords;
const res = await fetch(https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude});
const data = await res.json();
const address = data.display_name;
const messageData = {
type: MESSAGE_TYPES.LOCATION,
content: address,
location: { lat: latitude, lng: longitude },
};
messagingService.sendMessage(conversationId, messageData);
}, () => toast.error('Unable to get location'));
};

// ---------- Contact sharing ----------
const shareContact = async () => {
if (!navigator.contacts) {
toast.error('Contact sharing not supported');
return;
}
try {
const contact = await navigator.contacts.select(['name', 'tel', 'email']);
if (contact.length) {
const messageData = {
type: MESSAGE_TYPES.CONTACT,
contact: {
name: contact[0].name[0],
phoneNumbers: contact[0].tel,
emails: contact[0].email,
},
};
messagingService.sendMessage(conversationId, messageData);
}
} catch (err) {
toast.error('Could not access contacts');
}
};

// ---------- Block/unblock ----------
const toggleBlock = async () => {
const otherId = conversation?.participants.find(id => id !== user.uid);
if (!otherId) return;
try {
if (userBlocked) {
await userService.unblockUser(user.uid, otherId);
setUserBlocked(false);
toast.success('User unblocked');
} else {
await userService.blockUser(user.uid, otherId);
setUserBlocked(true);
toast.success('User blocked');
}
} catch (err) {
toast.error(err.message);
}
};

// ---------- Report user ----------
const reportUser = () => {
const otherId = conversation?.participants.find(id => id !== user.uid);
if (!otherId) return;
const reason = prompt('Reason for reporting?');
if (reason) {
userService.reportUser(user.uid, otherId, 'inappropriate', reason).then(() => {
toast.success('User reported');
}).catch(err => toast.error(err.message));
}
};

// ---------- Group management ----------
const addParticipants = () => {
// Open user picker modal (simplified)
alert('Add participants modal would open here');
};

const removeParticipant = (userId) => {
if (confirm('Remove this participant?')) {
messagingService.removeParticipants(conversationId, [userId], user.uid)
.then(() => loadConversation())
.catch(err => toast.error(err.message));
}
};

const changeRole = (userId, newRole) => {
messagingService.setUserRole(conversationId, userId, newRole, user.uid)
.then(() => loadConversation())
.catch(err => toast.error(err.message));
};

const createInviteLink = async () => {
try {
const result = await messagingService.createInviteLink(conversationId, user.uid);
navigator.clipboard.writeText(result.link);
toast.success('Invite link copied');
} catch (err) {
toast.error(err.message);
}
};

// ---------- Search messages ----------
const searchMessages = async () => {
if (!searchQuery.trim()) return;
try {
const results = await searchService.searchMessages(conversationId, searchQuery, { limit: 20 });
setSearchResults(results.results);
} catch (err) {
toast.error(err.message);
}
};

// ---------- Message actions ----------
const handleReaction = async (messageId, reaction) => {
try {
await messagingService.reactToMessage(conversationId, messageId, user.uid, reaction);
// Optimistically update the message
setMessages(prev => prev.map(m =>
m.id === messageId ? { ...m, reactions: { ...m.reactions, [user.uid]: reaction } } : m
));
} catch (err) {
toast.error(err.message);
}
};

const handleReply = (message) => {
setReplyTo(message);
};

const handleEdit = (message) => {
setEditMessage(message);
setInputText(message.content);
};

const handleDelete = async (messageId, forEveryone) => {
if (!confirm(forEveryone ? 'Delete for everyone?' : 'Delete for yourself?')) return;
try {
await messagingService.deleteMessage(messageId, conversationId, user.uid, forEveryone);
setMessages(prev => prev.filter(m => m.id !== messageId));
} catch (err) {
toast.error(err.message);
}
};

const handleReport = (messageId) => {
const reason = prompt('Reason for reporting?');
if (reason) {
messagingService.reportMessage(messageId, conversationId, user.uid, reason)
.then(() => toast.success('Message reported'))
.catch(err => toast.error(err.message));
}
};

const handleForward = (message) => {
// In a real app, open a dialog to select conversation
alert('Forward feature – select a conversation');
};

// ---------- Typing indicator text ----------
const typingText = Object.keys(typingUsers).filter(id => id !== user.uid).map(id => {
const p = conversation?.participantDetails?.find(p => p.uid === id);
return p?.displayName || 'Someone';
}).join(', ') + (Object.keys(typingUsers).length > 1 ? ' are typing...' : ' is typing...');

// ---------- Gift Modal ----------
const GiftModal = () => {
const gifts = monetizationService.config?.GIFTS || [
{ type: 'rose', value: 5 },
{ type: 'crown', value: 50 },
{ type: 'diamond', value: 100 },
{ type: 'rocket', value: 500 },
];
return (
<Modal isOpen={showGiftModal} onRequestClose={() => setShowGiftModal(false)} className="absolute inset-0 flex items-center justify-center p-4">
<div className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-md w-full">
<h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Send a Gift</h2>
<p className="text-gray-600 dark:text-gray-400 mb-4">Your balance: {coinBalance} coins</p>
<div className="grid grid-cols-2 gap-3">
{gifts.map(gift => (
<button
key={gift.type}
onClick={() => sendGift(gift.type)}
disabled={coinBalance < gift.value}
className={cn(
'p-4 rounded-xl text-white font-bold capitalize',
coinBalance >= gift.value ? 'bg-gradient-to-br from-purple-500 to-pink-500 hover:opacity-90' : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
)}
>
{gift.type} ({gift.value})
</button>
))}
</div>
</div>
</Modal>
);
};

// ---------- Poll Modal ----------
const PollModal = () => {
const [question, setQuestion] = useState('');
const [options, setOptions] = useState(['', '']);
const [isMultiple, setIsMultiple] = useState(false);
const addOption = () => setOptions([...options, '']);
const updateOption = (idx, val) => {
const newOpts = [...options];
newOpts[idx] = val;
setOptions(newOpts);
};
return (
<Modal isOpen={showPollModal} onRequestClose={() => setShowPollModal(false)} className="absolute inset-0 flex items-center justify-center p-4">
<div className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-md w-full">
<h2 className="text-xl font-bold mb-4">Create Poll</h2>
<input
type="text"
placeholder="Question"
value={question}
onChange={e => setQuestion(e.target.value)}
className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 mb-3"
/>
{options.map((opt, idx) => (
<input
key={idx}
type="text"
placeholder={Option ${idx+1}}
value={opt}
onChange={e => updateOption(idx, e.target.value)}
className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700 mb-2"
/>
))}
<button onClick={addOption} className="text-blue-600 mb-3">+ Add option</button>
<label className="flex items-center mb-4">
<input type="checkbox" checked={isMultiple} onChange={e => setIsMultiple(e.target.checked)} className="mr-2" />
Allow multiple votes
</label>
<button
onClick={() => createPoll(question, options.filter(o => o.trim()), isMultiple)}
className="w-full p-2 bg-blue-600 text-white rounded"
>
Send Poll
</button>
</div>
</Modal>
);
};

// ---------- Group Info Modal ----------
const GroupInfoModal = () => (
<Modal isOpen={showGroupInfo} onRequestClose={() => setShowGroupInfo(false)} className="absolute inset-0 flex items-center justify-center p-4">
<div className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
<h2 className="text-xl font-bold mb-4">Group Info</h2>
{conversation?.participantDetails?.map(p => (
<div key={p.uid} className="flex items-center justify-between py-2 border-b dark:border-gray-700">
<div className="flex items-center">
<img src={p.photoURL} alt="" className="w-8 h-8 rounded-full mr-3" />
<div>
<p className="font-medium">{p.displayName}</p>
<p className="text-xs text-gray-500">{p.role}</p>
</div>
</div>
{p.uid !== user.uid && (
<div className="flex space-x-2">
<button onClick={() => changeRole(p.uid, p.role === 'admin' ? 'member' : 'admin')} className="text-blue-600">
<Shield size={16} />
</button>
<button onClick={() => removeParticipant(p.uid)} className="text-red-600">
<UserMinus size={16} />
</button>
</div>
)}
</div>
))}
<button onClick={addParticipants} className="mt-4 w-full p-2 bg-blue-600 text-white rounded flex items-center justify-center">
<Plus size={16} className="mr-2" /> Add Participants
</button>
<button onClick={createInviteLink} className="mt-2 w-full p-2 bg-green-600 text-white rounded flex items-center justify-center">
<LinkIcon size={16} className="mr-2" /> Create Invite Link
</button>
</div>
</Modal>
);

// ---------- Search Modal ----------
const SearchModal = () => (
<Modal isOpen={showSearchModal} onRequestClose={() => setShowSearchModal(false)} className="absolute inset-0 flex items-center justify-center p-4">
<div className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
<div className="flex items-center mb-4">
<input
type="text"
placeholder="Search in conversation"
value={searchQuery}
onChange={e => setSearchQuery(e.target.value)}
onKeyDown={e => e.key === 'Enter' && searchMessages()}
className="flex-1 p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
autoFocus
/>
<button onClick={searchMessages} className="ml-2 p-2 bg-blue-600 text-white rounded">
<Search size={16} />
</button>
</div>
{searchResults.map(msg => (
<div key={msg.id} className="p-2 border-b dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800">
<p className="text-sm text-gray-900 dark:text-white">{msg.content}</p>
<p className="text-xs text-gray-500">{msg.createdAt?.toDate ? format(msg.createdAt.toDate(), 'PPp') : ''}</p>
</div>
))}
</div>
</Modal>
);

// ---------- Render ----------
if (userBlocked) {
return (
<div className="h-full flex flex-col items-center justify-center bg-white dark:bg-gray-950 p-4">
<Ban size={48} className="text-red-500 mb-4" />
<h2 className="text-xl font-bold text-gray-900 dark:text-white">You have blocked this user</h2>
<p className="text-gray-600 dark:text-gray-400 mt-2 text-center">You cannot send messages. Unblock to continue chatting.</p>
<button onClick={toggleBlock} className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-full">Unblock</button>
</div>
);
}

return (
<div className="h-full flex flex-col bg-white dark:bg-gray-950">
{/* Header */}
<div className="pt-12 pb-2 px-4 flex items-center bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
<button onClick={() => navigate('/messages')} className="mr-3">
<ArrowLeft size={20} className="text-blue-600" />
</button>

{conversation?.type === 'direct' ? (  
      (() => {  
        const otherId = conversation.participants.find(id => id !== user.uid);  
        const other = conversation.participantDetails?.find(p => p.uid === otherId);  
        return (  
          <>  
            <img src={other?.photoURL} alt="" className="w-8 h-8 rounded-full mr-3" />  
            <div className="flex-1">  
              <h2 className="font-semibold text-gray-900 dark:text-white">{other?.displayName}</h2>  
              <p className="text-xs text-gray-500">{otherUserPresence?.online ? 'Online' : 'Offline'}</p>  
            </div>  
          </>  
        );  
      })()  
    ) : (  
      <div className="flex-1 flex items-center cursor-pointer" onClick={() => setShowGroupInfo(true)}>  
        <div className="w-8 h-8 bg-gray-300 dark:bg-gray-700 rounded-full flex items-center justify-center mr-3">  
          <Users size={16} className="text-gray-600 dark:text-gray-400" />  
        </div>  
        <div>  
          <h2 className="font-semibold text-gray-900 dark:text-white">{conversation?.name}</h2>  
          <p className="text-xs text-gray-500">{conversation?.participantCount} participants</p>  
        </div>  
      </div>  
    )}  

    <div className="flex items-center space-x-2">  
      <span className="text-yellow-500 font-medium">{coinBalance}</span>  
      {conversation?.type === 'direct' && (  
        <button onClick={() => setShowGiftModal(true)} className="p-1 text-pink-500">  
          <Gift size={18} />  
        </button>  
      )}  
      <button onClick={() => setShowSearchModal(true)} className="p-1 text-blue-600">  
        <Search size={18} />  
      </button>  
      <div className="relative">  
        <Menu  
          menuButton={<MenuButton className="p-1 text-gray-600"><MoreVertical size={18} /></MenuButton>}  
        >  
          <MenuItem onClick={() => setShowGroupInfo(true)}>Group Info</MenuItem>  
          <MenuItem onClick={toggleBlock}>{userBlocked ? 'Unblock User' : 'Block User'}</MenuItem>  
          <MenuItem onClick={reportUser}>Report User</MenuItem>  
        </Menu>  
      </div>  
      {messagingService.CONFIG.ENCRYPTION.ENABLED ? (  
        <Lock size={16} className="text-green-500" />  
      ) : (  
        <Unlock size={16} className="text-gray-400" />  
      )}  
    </div>  
  </div>  

  {/* Messages */}  
  <div className="flex-1 overflow-y-auto p-4 space-y-2">  
    {messages.map(msg => (  
      <MessageBubble  
        key={msg.id}  
        message={msg}  
        isOwn={msg.senderId === user.uid}  
        onReaction={handleReaction}  
        onReply={handleReply}  
        onEdit={handleEdit}  
        onDelete={handleDelete}  
        onReport={handleReport}  
        onForward={handleForward}  
        conversationId={conversationId}  
        userId={user.uid}  
      />  
    ))}  
    {typingText && (  
      <div className="text-sm text-gray-500 italic">{typingText}</div>  
    )}  
    <div ref={messagesEndRef} />  
  </div>  

  {/* Reply/edit preview */}  
  {(replyTo || editMessage) && (  
    <div className="p-2 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">  
      <div className="flex-1">  
        <p className="text-xs text-blue-600">{replyTo ? 'Replying to' : 'Editing'}</p>  
        <p className="text-sm truncate">{replyTo?.content || editMessage?.content}</p>  
      </div>  
      <button onClick={() => { setReplyTo(null); setEditMessage(null); }}>  
        <X size={16} />  
      </button>  
    </div>  
  )}  

  {/* Input area */}  
  <div className="p-2 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">  
    <div className="flex items-center space-x-1">  
      <button onClick={() => setShowEmojiPicker(true)} className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">  
        <Smile size={20} />  
      </button>  
      <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />  
      <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">  
        <ImageIcon size={20} />  
      </button>  
      <input type="file" ref={videoInputRef} accept="video/*" onChange={handleVideoUpload} className="hidden" />  
      <button onClick={() => videoInputRef.current?.click()} className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">  
        <Video size={20} />  
      </button>  
      <input type="file" ref={documentInputRef} onChange={handleDocumentUpload} className="hidden" />  
      <button onClick={() => documentInputRef.current?.click()} className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">  
        <File size={20} />  
      </button>  
      <button onClick={() => setShowPollModal(true)} className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">  
        <span className="text-xs font-bold">📊</span>  
      </button>  
      <button onClick={shareLocation} className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">  
        <MapPin size={20} />  
      </button>  
      <button onClick={shareContact} className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">  
        <Users size={20} />  
      </button>  
      {isRecording ? (  
        <>  
          <span className="text-red-500">{recordingDuration}s</span>  
          <button onClick={stopRecording} className="p-2 bg-red-500 text-white rounded">Stop</button>  
          <button onClick={cancelRecording} className="p-2 text-gray-600">Cancel</button>  
        </>  
      ) : (  
        <button onMouseDown={startRecording} onMouseUp={stopRecording} className="p-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">  
          <Mic size={20} />  
        </button>  
      )}  
      <input  
        type="text"  
        placeholder={editMessage ? 'Edit message...' : 'Message...'}  
        className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"  
        value={inputText}  
        onChange={handleTyping}  
        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}  
        disabled={userBlocked}  
      />  
      <button  
        onClick={sendMessage}  
        disabled={sending || (!inputText.trim() && !replyTo && !editMessage)}  
        className={cn(  
          'p-2 rounded-full',  
          sending || (!inputText.trim() && !replyTo && !editMessage) ? 'opacity-50' : 'bg-blue-600 text-white'  
        )}  
      >  
        <Send size={20} />  
      </button>  
    </div>  
    {Object.entries(uploadProgress).map(([id, progress]) => (  
      <div key={id} className="mt-2 text-sm text-blue-600">Uploading {Math.round(progress)}%</div>  
    ))}  
  </div>  

  {/* Emoji picker */}  
  {showEmojiPicker && (  
    <div className="absolute bottom-20 left-4 z-10">  
      <EmojiPicker data={data} onEmojiSelect={addEmoji} theme={theme} />  
    </div>  
  )}  

  {/* Modals */}  
  <GiftModal />  
  <PollModal />  
  <GroupInfoModal />  
  <SearchModal />  
</div>

);
}