// src/components/Home/Composer.jsx
import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { db, storage } from "../../firebase/firebase";
import { collection, addDoc, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { toast } from "sonner";
import { Camera, Video, Send, Link as LinkIcon, X } from "lucide-react";

const MAX_FILES = 4;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export default function Composer({ onCreate }) {
const { theme } = useTheme();
const { user } = useAuth();

const [text, setText] = useState("");
const [mediaFiles, setMediaFiles] = useState([]);
const [uploading, setUploading] = useState(false);
const [progress, setProgress] = useState(0);
const [linkPreview, setLinkPreview] = useState(null);

const fileInputRef = useRef(null);

// ---------------- Auto-revoke Object URLs ----------------
useEffect(() => {
return () => mediaFiles.forEach(file => URL.revokeObjectURL(file.preview));
}, [mediaFiles]);

// ---------------- Detect Link Preview ----------------
useEffect(() => {
const urlRegex = /(https?://[^\s]+)/g;
const match = text.match(urlRegex);
if (match) {
const url = match[0];
setLinkPreview({ url, title: url });
// Optionally: fetch Open Graph data here for rich preview
} else {
setLinkPreview(null);
}
}, [text]);

// ---------------- Handle File Selection ----------------
const handleFiles = (e) => {
const files = Array.from(e.target.files);
const validFiles = files
.filter(f => (f.type.startsWith("image/") || f.type.startsWith("video/")) && f.size <= MAX_FILE_SIZE)
.slice(0, MAX_FILES - mediaFiles.length)
.map(f => ({ file: f, preview: URL.createObjectURL(f), muted: true }));

if (validFiles.length + mediaFiles.length > MAX_FILES) {  
  toast.error(`Maximum ${MAX_FILES} files allowed.`);  
}  

setMediaFiles(prev => [...prev, ...validFiles]);

};

// ---------------- Remove Media ----------------
const removeMedia = (index) => setMediaFiles(prev => prev.filter((_, i) => i !== index));

// ---------------- Toggle Video Mute ----------------
const toggleMute = (index) => {
setMediaFiles(prev =>
prev.map((m, i) => i === index ? { ...m, muted: !m.muted } : m)
);
};

// ---------------- Upload Media ----------------
const uploadMedia = async () => {
const urls = [];
for (const m of mediaFiles) {
const file = m.file;
const storageRef = ref(storage, posts/${user.uid}/${Date.now()}-${file.name});
const uploadTask = uploadBytesResumable(storageRef, file);

await new Promise((resolve, reject) => {  
    uploadTask.on(  
      "state_changed",  
      snapshot => {  
        const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);  
        setProgress(percent);  
      },  
      err => reject(err),  
      async () => {  
        const url = await getDownloadURL(uploadTask.snapshot.ref);  
        urls.push({ url, type: file.type.startsWith("video") ? "video" : "image" });  
        resolve();  
      }  
    );  
  });  
}  
return urls;

};

// ---------------- Extract Hashtags & Mentions ----------------
const extractTags = () => {
const hashtags = (text.match(/#\w+/g) || []).map(tag => tag.slice(1));
const mentions = (text.match(/@\w+/g) || []).map(tag => tag.slice(1));
return { hashtags, mentions };
};

// ---------------- Create Post ----------------
const handlePost = async () => {
if (!text.trim() && mediaFiles.length === 0) {
toast.error("Cannot create empty post.");
return;
}

setUploading(true);  
try {  
  const media = await uploadMedia();  
  const { hashtags, mentions } = extractTags();  

  const newPost = {  
    content: text.trim(),  
    media,  
    linkPreview,  
    authorId: user.uid,  
    createdAt: serverTimestamp(),  
    likes: [],  
    comments: [],  
    type: media.length === 1 && media[0].type === "video" ? "video" : "post",  
    hashtags,  
    mentions,  
  };  

  const postRef = await addDoc(collection(db, "posts"), newPost);  

  // ---------------- Reward coins ----------------  
  const userRef = doc(db, "users", user.uid);  
  await updateDoc(userRef, {  
    coins: (user.coins || 0) + 10  
  });  

  toast.success("Post created! +10 coins awarded");  
  onCreate && onCreate({ ...newPost, id: postRef.id });  

  // reset  
  setText("");  
  setMediaFiles([]);  
  setProgress(0);  
  setLinkPreview(null);  
} catch (err) {  
  console.error("Post creation failed:", err);  
  toast.error("Failed to create post.");  
} finally {  
  setUploading(false);  
}

};

// ---------------- Drag & Drop ----------------
const handleDrop = (e) => {
e.preventDefault();
const dtFiles = Array.from(e.dataTransfer.files);
const validFiles = dtFiles
.filter(f => (f.type.startsWith("image/") || f.type.startsWith("video/")) && f.size <= MAX_FILE_SIZE)
.slice(0, MAX_FILES - mediaFiles.length)
.map(f => ({ file: f, preview: URL.createObjectURL(f), muted: true }));

setMediaFiles(prev => [...prev, ...validFiles]);

};

const handleDragOver = (e) => e.preventDefault();

return (
<div
className={`p-3 rounded-xl border ${theme === "dark" ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"}`}
onDrop={handleDrop}
onDragOver={handleDragOver}
>
{/* Text Input */}
<textarea
value={text}
onChange={(e) => setText(e.target.value)}
placeholder="What's happening?"
className={`w-full p-2 rounded-md resize-none border ${theme === "dark" ? "bg-gray-800 border-gray-700 text-white" : "bg-gray-50 border-gray-200 text-gray-900"}`}
rows={3}
maxLength={280}
/>

{/* Link Preview */}  
  {linkPreview && (  
    <div className="p-2 mt-2 border rounded-md bg-gray-100 dark:bg-gray-800 flex items-center gap-2">  
      <LinkIcon size={16} />  
      <a href={linkPreview.url} target="_blank" rel="noopener noreferrer" className="truncate">  
        {linkPreview.title}  
      </a>  
    </div>  
  )}  

  {/* Media Preview */}  
  {mediaFiles.length > 0 && (  
    <div className="flex gap-2 mt-2 overflow-x-auto">  
      {mediaFiles.map((m, i) => (  
        <div key={i} className="relative">  
          {m.type === "image" || m.file.type.startsWith("image") ? (  
            <img src={m.preview} alt="preview" className="w-20 h-20 object-cover rounded" />  
          ) : (  
            <video src={m.preview} className="w-20 h-20 object-cover rounded" muted={m.muted} controls />  
          )}  
          <div className="absolute top-1 right-1 flex gap-1">  
            {m.file.type.startsWith("video") && (  
              <button onClick={() => toggleMute(i)} className="bg-black/50 text-white rounded-full p-1">  
                {m.muted ? "🔇" : "🔊"}  
              </button>  
            )}  
            <button onClick={() => removeMedia(i)} className="bg-black/50 text-white rounded-full p-1">  
              <X size={12} />  
            </button>  
          </div>  
        </div>  
      ))}  
    </div>  
  )}  

  {/* Upload Progress */}  
  {uploading && progress > 0 && (  
    <div className="w-full h-1 bg-gray-300 rounded mt-1">  
      <div className="h-1 bg-primary-500 rounded" style={`{ width: `${progress}%` `}} />  
    </div>  
  )}  

  {/* Action Buttons */}  
  <div className="flex items-center justify-between mt-2">  
    <div className="flex gap-2">  
      <label className="cursor-pointer p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800">  
        <Camera size={20} />  
        <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />  
      </label>  
      <label className="cursor-pointer p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800">  
        <Video size={20} />  
        <input type="file" accept="video/*" multiple hidden onChange={handleFiles} />  
      </label>  
    </div>  
    <button  
      onClick={handlePost}  
      disabled={uploading}  
      className={`flex items-center gap-1 px-4 py-2 rounded-full font-medium ${uploading ? "bg-gray-400 cursor-not-allowed" : "bg-primary-600 text-white hover:bg-primary-700"}`}  
      aria-label="Create Post"  
    >  
      {uploading ? "Posting..." : <><Send size={16} /> Post</>}  
    </button>  
  </div>  
</div>

);
}