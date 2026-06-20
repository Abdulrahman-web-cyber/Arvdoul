// src/screens/CreatePost/ContentEditor.jsx
import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Icons from "lucide-react";
import ReactMarkdown from "react-markdown";
import DOMPurify from "dompurify";
import CreatableSelect from "react-select/creatable";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import LoadingSpinner from "../../components/Shared/LoadingSpinner.jsx"; // adjust path if needed

// Inline sortable media item (same as before)
const SortableMediaItem = React.memo(({ media, index, onRemove, onRetry }) => {
  const [hover, setHover] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: media.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      className="relative aspect-square rounded-xl overflow-hidden bg-gray-900 border border-gray-700 cursor-grab shadow-md"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {media.type === "image" && <img src={media.preview} alt="" className="w-full h-full object-cover" />}
      {media.type === "video" && <video src={media.preview} className="w-full h-full object-cover" muted />}
      {media.type === "audio" && <div className="w-full h-full flex items-center justify-center"><Icons.Music className="w-8 h-8 text-white/50" /></div>}
      {media.progress > 0 && media.progress < 100 && (
        <div className="absolute bottom-0 left-0 w-full h-2 bg-gray-800">
          <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all" style={{ width: `${media.progress}%` }} />
        </div>
      )}
      {media.error && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
          <button onClick={() => onRetry(index)} className="px-2 py-1 bg-red-500 text-white text-xs rounded-full"><Icons.RefreshCw className="w-3 h-3 inline mr-1" /> Retry</button>
        </div>
      )}
      <div className={`absolute top-1 right-1 transition-opacity ${hover ? 'opacity-100' : 'opacity-0'}`}>
        <button onClick={() => onRemove(index)} className="p-1 rounded-full bg-red-500 text-white"><Icons.Trash2 className="w-3 h-3" /></button>
      </div>
    </div>
  );
});

export default function ContentEditor({
  state, dispatch, isDark, colors, user, services,
  hashtagOptions, showEmojiPicker, setShowEmojiPicker, showGifPicker, setShowGifPicker,
  showBackgroundPicker, setShowBackgroundPicker, showTextColorPicker, setShowTextColorPicker,
  contentRef, fileInputRef, textareaContainerRef,
  handleMediaDrop, removeMedia, retryMedia, handleDragEnd, sensors,
  insertMention, handleMentionKeyDown, handleHashtagChange, selectedHashtagOptions,
  parsedHashtags, mentionSearchResults, showMentionSuggestions, mentionSelectedIndex,
  CARD, POST_TYPES, BACKGROUND_GRADIENTS, TEXT_COLORS, TIER_LIMITS, userTier
}) {
  // Emoji picker inline
  const EmojiPicker = ({ onSelect }) => {
    const emojis = ["😀","😂","❤️","🔥","🎉","👍","😢","😡","🥳","😎","🤩","😍","🥺","😤","🤔","😴","👋","💪","🙌","👏"];
    return (
      <div className="grid grid-cols-5 gap-1 p-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        {emojis.map(e => <button key={e} onClick={() => onSelect(e)} className="text-xl p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">{e}</button>)}
      </div>
    );
  };

  // Gif picker inline
  const GifPicker = ({ onSelect }) => {
    const [query, setQuery] = useState("");
    const [gifs, setGifs] = useState([]);
    const [loading, setLoading] = useState(false);
    const apiKey = import.meta.env.VITE_GIPHY_API_KEY;
    const search = useCallback(async () => {
      if (!apiKey) return;
      setLoading(true);
      try {
        const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=12`);
        const data = await res.json();
        setGifs(data.data);
      } catch (err) { console.warn(err); }
      setLoading(false);
    }, [query, apiKey]);
    React.useEffect(() => { if (query) search(); }, [query, search]);
    if (!apiKey) return null;
    return (
      <div className="p-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border max-w-sm">
        <input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search GIFs..." className="w-full p-1 text-sm border rounded mb-2" />
        {loading && <div className="text-center p-2"><LoadingSpinner size="sm" /></div>}
        <div className="grid grid-cols-3 gap-1 max-h-64 overflow-auto">
          {gifs.map(gif => <button key={gif.id} onClick={() => onSelect(gif.images.fixed_height.url)} className="hover:scale-105 transition"><img src={gif.images.fixed_height_small.url} alt="" className="rounded" /></button>)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div id="post-type-selector">
        <h2 className={`text-xl font-bold mb-4 ${colors.text}`}>Post Type</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {POST_TYPES.map(type => (
            <motion.button key={type.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => dispatch({ type: "SET_POST_TYPE", payload: type.id })}
              className={`p-4 rounded-2xl border transition-all ${state.postType === type.id ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 shadow-lg shadow-purple-500/20" : CARD}`}>
              <type.icon className={`w-8 h-8 mx-auto mb-2 ${type.color}`} />
              <p className="text-sm font-medium">{type.label}</p>
            </motion.button>
          ))}
        </div>
      </div>

      <div id="content-editor" ref={textareaContainerRef} className="relative" onKeyDown={handleMentionKeyDown}>
        <h2 className={`text-xl font-bold mb-3 ${colors.text}`}>Content</h2>
        <div className={`${CARD} overflow-hidden`}>
          <div className="p-2 border-b border-gray-200 dark:border-gray-700 flex gap-1 bg-gray-50 dark:bg-gray-800/50">
            {[
              { icon: Icons.Bold, action: () => { const el = contentRef.current; if (!el) return; const start = el.selectionStart, end = el.selectionEnd; dispatch({ type: "SET_CONTENT", payload: state.content.substring(0, start) + "**" + state.content.substring(start, end) + "**" + state.content.substring(end) }); } },
              { icon: Icons.Italic, action: () => { const el = contentRef.current; const start = el.selectionStart, end = el.selectionEnd; dispatch({ type: "SET_CONTENT", payload: state.content.substring(0, start) + "*" + state.content.substring(start, end) + "*" + state.content.substring(end) }); } },
              { icon: Icons.Link, action: () => { const el = contentRef.current; const start = el.selectionStart, end = el.selectionEnd; dispatch({ type: "SET_CONTENT", payload: state.content.substring(0, start) + "[" + state.content.substring(start, end) + "](url)" + state.content.substring(end) }); } },
              { icon: Icons.Smile, action: () => setShowEmojiPicker(!showEmojiPicker) },
              { icon: Icons.Image, action: () => setShowGifPicker(!showGifPicker) },
            ].map((item, i) => <button key={i} onClick={item.action} className="p-2 rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"><item.icon className="w-4 h-4" /></button>)}
          </div>
          <div className="relative">
            <textarea ref={contentRef} value={state.content} onChange={e => dispatch({ type: "SET_CONTENT", payload: e.target.value })}
              placeholder="What's on your mind?" rows={8}
              className="w-full p-4 resize-none bg-transparent focus:outline-none text-gray-900 dark:text-white placeholder-gray-400" style={{ color: state.textColor }} />
            <AnimatePresence>
              {showEmojiPicker && <div className="absolute top-0 right-0 z-20"><EmojiPicker onSelect={emoji => { dispatch({ type: "SET_CONTENT", payload: state.content + emoji }); setShowEmojiPicker(false); }} /></div>}
              {showGifPicker && <div className="absolute top-0 right-0 z-20"><GifPicker onSelect={url => { dispatch({ type: "SET_CONTENT", payload: state.content + `\n![GIF](${url})` }); setShowGifPicker(false); }} /></div>}
            </AnimatePresence>
          </div>
          {showMentionSuggestions && mentionSearchResults.length > 0 && (
            <div className="absolute z-30 bg-white dark:bg-gray-800 border rounded-lg shadow-lg max-h-40 overflow-auto" style={{ bottom: "100%", left: 0, right: 0 }}>
              {mentionSearchResults.map((usr, idx) => (
                <button key={usr.id} onClick={() => insertMention(usr)}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${idx === mentionSelectedIndex ? "bg-purple-100 dark:bg-purple-900/30" : ""}`}>
                  <img src={usr.photoURL || "/assets/default-profile.png"} className="w-6 h-6 rounded-full" alt="" />
                  <span>{usr.displayName}</span>
                  <span className="text-xs text-gray-500">@{usr.username}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-between items-center px-4 py-2 text-xs border-t border-gray-200 dark:border-gray-700">
            <span>{state.content.length} chars</span>
            <CreatableSelect isMulti options={hashtagOptions} value={selectedHashtagOptions} onChange={handleHashtagChange}
              placeholder="Add hashtags..." className="w-48 text-sm"
              styles={{
                control: (base) => ({ ...base, background: "transparent", borderColor: "transparent" }),
                multiValue: (base) => ({ ...base, backgroundColor: "rgba(147, 51, 234, 0.2)" }),
                multiValueLabel: (base) => ({ ...base, color: isDark ? "#ddd" : "#333" }),
                multiValueRemove: (base) => ({ ...base, color: "#888" }),
              }} />
          </div>
        </div>
        <div className={`mt-3 p-4 ${CARD}`}>
          <p className="text-xs font-medium mb-1">Preview</p>
          <ReactMarkdown>{DOMPurify.sanitize(state.content)}</ReactMarkdown>
        </div>
      </div>

      <div id="media-uploader">
        <h2 className={`text-xl font-bold mb-3 ${colors.text}`}>Media</h2>
        <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleMediaDrop(Array.from(e.dataTransfer.files)); }}
          onClick={() => fileInputRef.current.click()} className={`p-8 text-center border-2 border-dashed rounded-2xl ${CARD} cursor-pointer hover:border-purple-500 transition-colors`}>
          <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,audio/*" className="hidden" onChange={e => handleMediaDrop(Array.from(e.target.files))} />
          <Icons.Upload className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">Drag & drop or click to upload</p>
          <p className="text-xs text-gray-500 mt-1">Max {TIER_LIMITS[userTier]?.maxMedia} files</p>
        </div>
        {state.mediaFiles.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={state.mediaFiles.map(m => m.id)} strategy={verticalListSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-4">
                {state.mediaFiles.map((media, idx) => (
                  <SortableMediaItem key={media.id} media={media} index={idx} onRemove={removeMedia} onRetry={retryMedia} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {state.postType === "poll" && (
        <div className={`${CARD} p-4`}>
          <h3 className="text-lg font-bold mb-3">Poll</h3>
          <input value={state.pollData.question} onChange={e => dispatch({ type: "SET_POLL", payload: { question: e.target.value } })} placeholder="Question" className="w-full p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 mb-3" />
          {state.pollData.options.map((opt, idx) => (
            <div key={idx} className="flex gap-2 mb-2">
              <input value={opt} onChange={e => { const newOpts = [...state.pollData.options]; newOpts[idx] = e.target.value; dispatch({ type: "SET_POLL", payload: { options: newOpts } }); }} placeholder={`Option ${idx+1}`} className="flex-1 p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700" />
              {state.pollData.options.length > 2 && <button onClick={() => dispatch({ type: "SET_POLL", payload: { options: state.pollData.options.filter((_, i) => i !== idx) } })}><Icons.X /></button>}
            </div>
          ))}
          <button onClick={() => dispatch({ type: "SET_POLL", payload: { options: [...state.pollData.options, ""] } })} className="mt-2 text-sm text-purple-600 font-medium">+ Add Option</button>
        </div>
      )}

      {state.postType === "link" && (
        <div className={`${CARD} p-4`}>
          <h3 className="text-lg font-bold mb-3">Link</h3>
          <input type="url" value={state.linkData.url} onChange={e => dispatch({ type: "SET_LINK", payload: { url: e.target.value } })} placeholder="https://..." className="w-full p-3 rounded-xl bg-white dark:bg-gray-900 border mb-2" />
          <input value={state.linkData.title} onChange={e => dispatch({ type: "SET_LINK", payload: { title: e.target.value } })} placeholder="Title (optional)" className="w-full p-3 rounded-xl bg-white dark:bg-gray-900 border mb-2" />
          <textarea value={state.linkData.description} onChange={e => dispatch({ type: "SET_LINK", payload: { description: e.target.value } })} placeholder="Description" rows={2} className="w-full p-3 rounded-xl bg-white dark:bg-gray-900 border" />
        </div>
      )}

      {state.postType === "question" && (
        <div className={`${CARD} p-4`}>
          <h3 className="text-lg font-bold mb-3">Question</h3>
          <textarea value={state.question} onChange={e => dispatch({ type: "SET_QUESTION", payload: e.target.value })} placeholder="What would you like to ask?" rows={3} className="w-full p-3 rounded-xl bg-white dark:bg-gray-900 border" />
        </div>
      )}

      <div className={`${CARD} p-4`}>
        <h3 className="text-lg font-bold mb-3">Appearance</h3>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowBackgroundPicker(!showBackgroundPicker)} className="px-4 py-2 rounded-full bg-purple-600 text-white text-sm font-medium">Background</button>
          <button onClick={() => setShowTextColorPicker(!showTextColorPicker)} className="px-4 py-2 rounded-full bg-purple-600 text-white text-sm font-medium">Text Color</button>
        </div>
        {showBackgroundPicker && <div className="grid grid-cols-3 gap-2 mt-3">{BACKGROUND_GRADIENTS.map(g => <button key={g.id} onClick={() => dispatch({ type: "SET_BACKGROUND_GRADIENT", payload: g.id })} className={`p-2 rounded-xl border ${state.backgroundGradient === g.id ? "border-purple-500" : "border-gray-300"}`}>{g.value ? <div className="h-10 rounded" style={{ background: g.value }} /> : <div className="h-10 rounded bg-gray-500" />}<span className="text-xs mt-1 block">{g.name}</span></button>)}</div>}
        {showTextColorPicker && <div className="flex gap-2 mt-3">{TEXT_COLORS.map(c => <button key={c} onClick={() => dispatch({ type: "SET_TEXT_COLOR", payload: c })} className="w-8 h-8 rounded-full border-2 border-white shadow" style={{ backgroundColor: c }} aria-label={`Text color ${c}`} />)}</div>}
      </div>
    </div>
  );
}