// src/screens/CreatePost/ContentEditor.jsx - ARVDOUL PRO STUDIO CONTENT EDITOR
import React, { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import * as Icons from "lucide-react";
import ReactMarkdown from "react-markdown";
import DOMPurify from "dompurify";
import CreatableSelect from "react-select/creatable";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import LoadingSpinner from "../../components/Shared/LoadingSpinner.jsx";

// Inline sortable media item
const SortableMediaItem = React.memo(({ media, index, onRemove, onRetry }) => {
  const [hover, setHover] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: media.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative aspect-square rounded-2xl overflow-hidden bg-gray-900 border border-gray-700/80 cursor-grab shadow-lg group"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {media.type === "image" && <img src={media.preview} alt="" className="w-full h-full object-cover" />}
      {media.type === "video" && <video src={media.preview} className="w-full h-full object-cover" muted />}
      {media.type === "audio" && (
        <div className="w-full h-full flex flex-col items-center justify-center bg-purple-950/40">
          <Icons.Music className="w-8 h-8 text-purple-400" />
          <span className="text-[10px] text-purple-300 font-bold mt-1">Audio Track</span>
        </div>
      )}
      {media.progress > 0 && media.progress < 100 && (
        <div className="absolute bottom-0 left-0 w-full h-2 bg-gray-800">
          <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all" style={{ width: `${media.progress}%` }} />
        </div>
      )}
      {media.error && (
        <div className="absolute inset-0 bg-black/75 flex items-center justify-center p-2">
          <button onClick={() => onRetry(index)} className="px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-xl shadow">
            <Icons.RefreshCw className="w-3 h-3 inline mr-1" /> Retry
          </button>
        </div>
      )}
      <div className={`absolute top-1.5 right-1.5 transition-opacity ${hover ? "opacity-100" : "opacity-0"}`}>
        <button onClick={() => onRemove(index)} className="p-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white shadow-md">
          <Icons.Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
});

SortableMediaItem.displayName = "SortableMediaItem";

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
  const navigate = useNavigate();
  const [showAiPrompts, setShowAiPrompts] = useState(false);

  const sampleViralHooks = [
    "🔥 3 secrets about creators that almost nobody knows:",
    "⚡ Unpopular opinion: The future of digital media is happening right now.",
    "🚀 Just dropped something huge. Here's the full breakdown 🧵👇",
    "💡 Question for the community: If you could master one creative skill today, what would it be?",
  ];

  const handleApplyHook = (hook) => {
    dispatch({ type: "SET_CONTENT", payload: hook + "\n\n" + (state.content || "") });
    setShowAiPrompts(false);
  };

  // Emoji picker inline
  const EmojiPicker = ({ onSelect }) => {
    const emojis = ["😀","😂","❤️","🔥","🎉","👍","✨","🚀","🤩","😍","💡","⚡","🤔","🙌","👏","💎","🎯","🌟","👑","🎵"];
    return (
      <div className="grid grid-cols-5 gap-1.5 p-3 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 max-w-[240px]">
        {emojis.map(e => (
          <button key={e} onClick={() => onSelect(e)} className="text-xl p-1.5 hover:bg-purple-500/20 rounded-xl transition-all">
            {e}
          </button>
        ))}
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
        const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query || "trending")}&limit=9`);
        const data = await res.json();
        setGifs(data.data || []);
      } catch (err) {
        console.warn(err);
      }
      setLoading(false);
    }, [query, apiKey]);

    React.useEffect(() => {
      search();
    }, [search]);

    return (
      <div className="p-3 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 max-w-xs">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search trending GIFs..."
          className="w-full p-2 text-xs border rounded-xl bg-transparent outline-none mb-2 border-gray-300 dark:border-gray-700"
        />
        {loading && <div className="text-center p-2"><LoadingSpinner size="sm" /></div>}
        <div className="grid grid-cols-3 gap-1.5 max-h-52 overflow-auto scrollbar-hide">
          {gifs.map(gif => (
            <button key={gif.id} onClick={() => onSelect(gif.images.fixed_height.url)} className="hover:scale-105 transition-transform rounded-lg overflow-hidden">
              <img src={gif.images.fixed_height_small.url} alt="" className="w-full h-16 object-cover" />
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Studio Quick Shortcuts Banner */}
      <div className="p-4 rounded-3xl bg-gradient-to-r from-purple-900/30 via-pink-900/20 to-blue-900/30 border border-purple-500/30 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white shadow-md">
            <Icons.Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white">Need Advanced Production Editors?</h3>
            <p className="text-xs text-purple-200/70">Launch 4K Timeline, Waveform Synth, or Thumbnail Canvas</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => navigate("/video-editor")}
            className="px-3 py-1.5 rounded-xl bg-purple-600/40 hover:bg-purple-600/60 border border-purple-400/40 text-purple-200 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Icons.Video className="w-3.5 h-3.5" />
            Video Studio
          </button>
          <button
            onClick={() => navigate("/thumbnail-designer")}
            className="px-3 py-1.5 rounded-xl bg-cyan-600/40 hover:bg-cyan-600/60 border border-cyan-400/40 text-cyan-200 text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Icons.Image className="w-3.5 h-3.5" />
            Thumbnail Studio
          </button>
        </div>
      </div>

      {/* Post Type Selector */}
      <div id="post-type-selector">
        <h2 className={`text-base font-black mb-3 ${colors.text} flex items-center gap-2`}>
          <Icons.Layers className="w-4 h-4 text-purple-400" />
          Select Post Type
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {POST_TYPES.map(type => (
            <motion.button
              key={type.id}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => dispatch({ type: "SET_POST_TYPE", payload: type.id })}
              className={`p-4 rounded-2xl border transition-all cursor-pointer text-left flex flex-col justify-between ${
                state.postType === type.id
                  ? "border-purple-500 bg-purple-500/15 shadow-xl shadow-purple-500/20 text-white"
                  : CARD
              }`}
            >
              <type.icon className={`w-7 h-7 mb-3 ${type.color}`} />
              <div>
                <p className="text-xs font-black">{type.label}</p>
                <p className="text-[10px] opacity-70 mt-0.5">{type.description || "Format"}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Main Content Text Area & Rich Toolbar */}
      <div id="content-editor" ref={textareaContainerRef} className="relative" onKeyDown={handleMentionKeyDown}>
        <div className="flex items-center justify-between mb-2">
          <h2 className={`text-base font-black ${colors.text} flex items-center gap-2`}>
            <Icons.PenTool className="w-4 h-4 text-purple-400" />
            Story & Caption
          </h2>
          <button
            onClick={() => setShowAiPrompts(!showAiPrompts)}
            className="text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/40 text-purple-300 flex items-center gap-1.5 hover:scale-105 transition-transform"
          >
            <Icons.Sparkles className="w-3.5 h-3.5 text-purple-400" />
            Viral AI Hooks
          </button>
        </div>

        {/* AI Hooks Carousel */}
        <AnimatePresence>
          {showAiPrompts && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 p-3 rounded-2xl bg-purple-950/40 border border-purple-500/30 overflow-hidden"
            >
              <p className="text-[11px] font-bold text-purple-300 mb-2">Choose an instant viral hook:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sampleViralHooks.map((hook, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleApplyHook(hook)}
                    className="p-2.5 rounded-xl text-left text-xs bg-purple-900/30 hover:bg-purple-900/60 border border-purple-500/20 text-purple-200 transition-colors"
                  >
                    {hook}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`${CARD} overflow-hidden rounded-3xl`}>
          {/* Format Action Toolbar */}
          <div className="p-2.5 border-b border-gray-200 dark:border-white/10 flex items-center gap-1.5 bg-gray-50/70 dark:bg-[#0f172a]/70 flex-wrap">
            {[
              {
                icon: Icons.Bold,
                title: "Bold",
                action: () => {
                  const el = contentRef.current;
                  if (!el) return;
                  const start = el.selectionStart, end = el.selectionEnd;
                  dispatch({ type: "SET_CONTENT", payload: state.content.substring(0, start) + "**" + state.content.substring(start, end) + "**" + state.content.substring(end) });
                }
              },
              {
                icon: Icons.Italic,
                title: "Italic",
                action: () => {
                  const el = contentRef.current;
                  const start = el.selectionStart, end = el.selectionEnd;
                  dispatch({ type: "SET_CONTENT", payload: state.content.substring(0, start) + "*" + state.content.substring(start, end) + "*" + state.content.substring(end) });
                }
              },
              {
                icon: Icons.Link,
                title: "Insert Link",
                action: () => {
                  const el = contentRef.current;
                  const start = el.selectionStart, end = el.selectionEnd;
                  dispatch({ type: "SET_CONTENT", payload: state.content.substring(0, start) + "[" + state.content.substring(start, end) + "](url)" + state.content.substring(end) });
                }
              },
              { icon: Icons.Smile, title: "Emoji Picker", action: () => setShowEmojiPicker(!showEmojiPicker) },
              { icon: Icons.Image, title: "GIF Search", action: () => setShowGifPicker(!showGifPicker) },
            ].map((item, i) => (
              <button
                key={i}
                onClick={item.action}
                title={item.title}
                className="p-2 rounded-xl bg-white dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              >
                <item.icon className="w-4 h-4" />
              </button>
            ))}
          </div>

          <div className="relative">
            <textarea
              ref={contentRef}
              value={state.content}
              onChange={e => dispatch({ type: "SET_CONTENT", payload: e.target.value })}
              placeholder="What's happening? Share stories, insights, or ask your audience..."
              rows={6}
              className="w-full p-4 resize-none bg-transparent focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 text-sm leading-relaxed"
              style={{ color: state.textColor }}
            />

            <AnimatePresence>
              {showEmojiPicker && (
                <div className="absolute top-2 right-2 z-30">
                  <EmojiPicker
                    onSelect={emoji => {
                      dispatch({ type: "SET_CONTENT", payload: (state.content || "") + emoji });
                      setShowEmojiPicker(false);
                    }}
                  />
                </div>
              )}
              {showGifPicker && (
                <div className="absolute top-2 right-2 z-30">
                  <GifPicker
                    onSelect={url => {
                      dispatch({ type: "SET_CONTENT", payload: (state.content || "") + `\n![GIF](${url})\n` });
                      setShowGifPicker(false);
                    }}
                  />
                </div>
              )}
            </AnimatePresence>
          </div>

          {showMentionSuggestions && mentionSearchResults.length > 0 && (
            <div className="border-t border-gray-200 dark:border-white/10 bg-white/90 dark:bg-[#0f172a]/90 backdrop-blur-xl max-h-40 overflow-auto">
              {mentionSearchResults.map((usr, idx) => (
                <button
                  key={usr.id}
                  onClick={() => insertMention(usr)}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/5 flex items-center gap-2 ${
                    idx === mentionSelectedIndex ? "bg-purple-500/20" : ""
                  }`}
                >
                  <img src={usr.photoURL || "/assets/default-profile.png"} className="w-6 h-6 rounded-full object-cover" alt="" />
                  <span className="text-xs font-bold">{usr.displayName}</span>
                  <span className="text-[10px] text-gray-400">@{usr.username}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-4 py-3 text-xs border-t border-gray-200 dark:border-white/10 gap-2">
            <span className="text-gray-400 text-[11px] font-semibold">{state.content.length} characters</span>
            <CreatableSelect
              isMulti
              options={hashtagOptions}
              value={selectedHashtagOptions}
              onChange={handleHashtagChange}
              placeholder="#Add hashtags..."
              className="w-full sm:w-56 text-xs"
              styles={{
                control: (base) => ({ ...base, background: "transparent", borderColor: "rgba(255,255,255,0.1)", borderRadius: "12px" }),
                multiValue: (base) => ({ ...base, backgroundColor: "rgba(168, 85, 247, 0.2)", borderRadius: "8px" }),
                multiValueLabel: (base) => ({ ...base, color: isDark ? "#fff" : "#111" }),
                multiValueRemove: (base) => ({ ...base, color: "#888" }),
              }}
            />
          </div>
        </div>

        {state.content && (
          <div className={`mt-3 p-4 rounded-3xl ${CARD}`}>
            <p className="text-[10px] font-black uppercase text-purple-400 tracking-wider mb-2">Live Markdown Preview</p>
            <div className="prose dark:prose-invert max-w-none text-xs">
              <ReactMarkdown>{DOMPurify.sanitize(state.content)}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* Media Uploader Section */}
      <div id="media-uploader">
        <div className="flex items-center justify-between mb-3">
          <h2 className={`text-base font-black ${colors.text} flex items-center gap-2`}>
            <Icons.Upload className="w-4 h-4 text-purple-400" />
            Media & Attachments
          </h2>
          <span className="text-[10px] font-bold text-gray-400">
            {state.mediaFiles.length} / {TIER_LIMITS[userTier]?.maxMedia || 10} files
          </span>
        </div>

        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleMediaDrop(Array.from(e.dataTransfer.files)); }}
          onClick={() => fileInputRef.current?.click()}
          className={`p-8 text-center border-2 border-dashed rounded-3xl ${CARD} cursor-pointer hover:border-purple-500/70 transition-all group`}
        >
          <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,audio/*" className="hidden" onChange={e => handleMediaDrop(Array.from(e.target.files))} />
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-3 text-purple-400 group-hover:scale-110 transition-transform">
            <Icons.UploadCloud className="w-6 h-6" />
          </div>
          <p className="text-xs font-bold text-gray-200">Drag & drop photos, 4K videos, or audio clips</p>
          <p className="text-[10px] text-gray-500 mt-1">Supports PNG, JPG, MP4, MOV, MP3, WAV up to 500MB</p>
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

      {/* Specific Post Type Forms */}
      {state.postType === "poll" && (
        <div className={`${CARD} p-5 rounded-3xl`}>
          <h3 className="text-sm font-black mb-3 flex items-center gap-2 text-purple-400">
            <Icons.PieChart className="w-4 h-4" />
            Interactive Poll Questions
          </h3>
          <input
            value={state.pollData.question}
            onChange={e => dispatch({ type: "SET_POLL", payload: { question: e.target.value } })}
            placeholder="Poll topic or question..."
            className="w-full p-3 rounded-2xl bg-white/5 border border-gray-200 dark:border-white/10 mb-3 text-xs font-medium outline-none"
          />
          {state.pollData.options.map((opt, idx) => (
            <div key={idx} className="flex gap-2 mb-2">
              <input
                value={opt}
                onChange={e => {
                  const newOpts = [...state.pollData.options];
                  newOpts[idx] = e.target.value;
                  dispatch({ type: "SET_POLL", payload: { options: newOpts } });
                }}
                placeholder={`Option ${idx + 1}`}
                className="flex-1 p-2.5 rounded-xl bg-white/5 border border-gray-200 dark:border-white/10 text-xs outline-none"
              />
              {state.pollData.options.length > 2 && (
                <button
                  onClick={() => dispatch({ type: "SET_POLL", payload: { options: state.pollData.options.filter((_, i) => i !== idx) } })}
                  className="p-2 text-red-400 hover:text-red-300"
                >
                  <Icons.X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => dispatch({ type: "SET_POLL", payload: { options: [...state.pollData.options, ""] } })}
            className="mt-2 text-xs text-purple-400 font-bold hover:underline"
          >
            + Add Option
          </button>
        </div>
      )}

      {state.postType === "link" && (
        <div className={`${CARD} p-5 rounded-3xl space-y-2.5`}>
          <h3 className="text-sm font-black mb-2 flex items-center gap-2 text-cyan-400">
            <Icons.Link2 className="w-4 h-4" />
            Smart Link Preview
          </h3>
          <input
            type="url"
            value={state.linkData.url}
            onChange={e => dispatch({ type: "SET_LINK", payload: { url: e.target.value } })}
            placeholder="https://..."
            className="w-full p-3 rounded-xl bg-white/5 border border-gray-200 dark:border-white/10 text-xs outline-none"
          />
          <input
            value={state.linkData.title}
            onChange={e => dispatch({ type: "SET_LINK", payload: { title: e.target.value } })}
            placeholder="Link Title (optional)"
            className="w-full p-2.5 rounded-xl bg-white/5 border border-gray-200 dark:border-white/10 text-xs outline-none"
          />
          <textarea
            value={state.linkData.description}
            onChange={e => dispatch({ type: "SET_LINK", payload: { description: e.target.value } })}
            placeholder="Description..."
            rows={2}
            className="w-full p-2.5 rounded-xl bg-white/5 border border-gray-200 dark:border-white/10 text-xs outline-none resize-none"
          />
        </div>
      )}

      {state.postType === "question" && (
        <div className={`${CARD} p-5 rounded-3xl`}>
          <h3 className="text-sm font-black mb-2 flex items-center gap-2 text-amber-400">
            <Icons.HelpCircle className="w-4 h-4" />
            Ask the Community (AMA)
          </h3>
          <textarea
            value={state.question}
            onChange={e => dispatch({ type: "SET_QUESTION", payload: e.target.value })}
            placeholder="What prompt or question would you like answered?"
            rows={3}
            className="w-full p-3 rounded-xl bg-white/5 border border-gray-200 dark:border-white/10 text-xs outline-none resize-none"
          />
        </div>
      )}

      {/* Visual Presentation & Accent Gradients */}
      <div className={`${CARD} p-5 rounded-3xl`}>
        <h3 className="text-sm font-black mb-3 flex items-center gap-2">
          <Icons.Palette className="w-4 h-4 text-pink-400" />
          Canvas Presentation & Gradients
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowBackgroundPicker(!showBackgroundPicker)}
            className="px-4 py-2 rounded-2xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-bold transition-all"
          >
            Canvas Gradients
          </button>
          <button
            onClick={() => setShowTextColorPicker(!showTextColorPicker)}
            className="px-4 py-2 rounded-2xl bg-pink-600/30 hover:bg-pink-600/50 border border-pink-500/40 text-pink-200 text-xs font-bold transition-all"
          >
            Text Accent
          </button>
        </div>

        {showBackgroundPicker && (
          <div className="grid grid-cols-3 gap-2 mt-4">
            {BACKGROUND_GRADIENTS.map(g => (
              <button
                key={g.id}
                onClick={() => dispatch({ type: "SET_BACKGROUND_GRADIENT", payload: g.id })}
                className={`p-2 rounded-2xl border transition-all ${
                  state.backgroundGradient === g.id ? "border-purple-500 ring-2 ring-purple-500/40" : "border-gray-300 dark:border-white/10"
                }`}
              >
                {g.value ? (
                  <div className="h-10 rounded-xl" style={{ background: g.value }} />
                ) : (
                  <div className="h-10 rounded-xl bg-gray-600/40 flex items-center justify-center text-[10px] text-gray-300">
                    Default
                  </div>
                )}
                <span className="text-[10px] font-bold mt-1 block truncate">{g.name}</span>
              </button>
            ))}
          </div>
        )}

        {showTextColorPicker && (
          <div className="flex gap-2.5 mt-4 flex-wrap">
            {TEXT_COLORS.map(c => (
              <button
                key={c}
                onClick={() => dispatch({ type: "SET_TEXT_COLOR", payload: c })}
                className="w-8 h-8 rounded-full border-2 border-white/40 shadow-lg hover:scale-110 transition-transform"
                style={{ backgroundColor: c }}
                aria-label={`Text color ${c}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
