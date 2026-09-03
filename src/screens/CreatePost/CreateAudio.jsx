// src/screens/CreatePost/CreateAudio.jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreatePostState, useCreatePostServices } from "../CreatePost";
import * as Icons from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import { useTheme } from "../../context/ThemeContext";

const AUDIO_GENRES = [
  "✨ Original", "🎵 Electronic", "🎤 Hip-Hop", "🎸 Acoustic",
  "🎷 Jazz & Soul", "☕ Lo-Fi", "🎙️ Podcast", "🌌 Ambient"
];

export default function CreateAudio() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme !== "light";
  const { state, dispatch } = useCreatePostState();
  const { saveDraft } = useCreatePostServices();

  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const [audioFile, setAudioFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [coverUrl, setCoverUrl] = useState(null);
  const [trackTitle, setTrackTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("✨ Original");
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    dispatch({
      type: "SET_TYPE_DATA",
      payload: {
        audio: {
          file: audioFile,
          previewUrl,
          coverUrl,
          title: trackTitle,
          artist: artistName,
          genre: selectedGenre,
        },
      },
    });
    dispatch({ type: "SET_CONTENT_READY", payload: !!audioFile });
  }, [audioFile, previewUrl, coverUrl, trackTitle, artistName, selectedGenre, dispatch]);

  const handleFile = useCallback((file) => {
    if (!file.type.startsWith("audio/")) {
      toast.error("Please select a valid audio file (MP3, WAV, AAC)");
      return;
    }
    const preview = URL.createObjectURL(file);
    setAudioFile(file);
    setPreviewUrl(preview);
    if (!trackTitle) {
      setTrackTitle(file.name.replace(/\.[^/.]+$/, ""));
    }
    toast.success("Audio loaded successfully");
  }, [trackTitle]);

  const handleCover = useCallback((file) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setCoverUrl(url);
  }, []);

  const removeAudio = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setAudioFile(null);
    setPreviewUrl(null);
  }, [previewUrl]);

  // Voice recording logic
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const recordedFile = new File([audioBlob], `Recording_${Date.now()}.webm`, { type: "audio/webm" });
        handleFile(recordedFile);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordDuration(0);
      timerRef.current = setInterval(() => {
        setRecordDuration((d) => d + 1);
      }, 1000);
      toast.info("Recording started. Speak now...");
    } catch {
      toast.error("Microphone permission denied or unavailable");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  return (
    <div className="space-y-5 max-w-xl mx-auto py-2">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-400">
            <Icons.Music className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Audio Creation Studio</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Record, upload or arrange multitrack audio</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/audio-editor")}
            className="px-3.5 py-1.5 text-xs font-bold rounded-xl text-white shadow-md flex items-center gap-1.5 hover:scale-105 active:scale-95 transition cursor-pointer"
            style={{ background: "linear-gradient(135deg, #8B1EF3 0%, #4431F7 50%, #055BFB 100%)" }}
          >
            <Icons.Sliders className="w-3.5 h-3.5" />
            <span>Open Studio</span>
          </button>
          <button
            onClick={saveDraft}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-white/15 transition cursor-pointer"
          >
            💾 Draft
          </button>
        </div>
      </div>

      {/* Audio Uploader / Record Selector Card */}
      {!audioFile && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* File Upload Box */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition hover:border-purple-500 hover:scale-[1.01]",
              isDark ? "border-white/15 bg-white/5" : "border-gray-300 bg-gray-50/50"
            )}
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
              <Icons.Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900 dark:text-white">Choose Audio File</p>
              <p className="text-[11px] text-gray-500">MP3, WAV, AAC up to 100MB</p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFile(e.target.files[0]);
              e.target.value = "";
            }}
          />

          {/* Record Live Microphone Box */}
          <div
            onClick={isRecording ? stopRecording : startRecording}
            className={cn(
              "p-6 rounded-2xl border-2 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition",
              isRecording
                ? "border-rose-500 bg-rose-500/10 animate-pulse"
                : isDark
                ? "border-white/15 bg-white/5 hover:border-rose-500"
                : "border-gray-300 bg-gray-50/50 hover:border-rose-500"
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform",
              isRecording ? "bg-rose-500 text-white scale-110" : "bg-rose-500/20 text-rose-400"
            )}>
              <Icons.Mic className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900 dark:text-white">
                {isRecording ? `Recording... (${recordDuration}s)` : "Record Live Voice"}
              </p>
              <p className="text-[11px] text-gray-500">
                {isRecording ? "Tap to Stop & Use" : "Record voice note or acoustic beat"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Active Audio Player & Details Card */}
      {audioFile && (
        <div className={cn(
          "p-4 rounded-2xl border space-y-4 shadow-lg",
          isDark ? "bg-[#060B24] border-white/10" : "bg-white border-gray-200"
        )}>
          <div className="flex items-start gap-3">
            {/* Album Cover preview or upload */}
            <div
              onClick={() => coverInputRef.current?.click()}
              className={cn(
                "w-20 h-20 rounded-xl overflow-hidden border flex flex-col items-center justify-center flex-shrink-0 cursor-pointer group relative",
                isDark ? "bg-[#03071B] border-white/10" : "bg-gray-100 border-gray-300"
              )}
            >
              {coverUrl ? (
                <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-1 text-gray-400">
                  <Icons.Image className="w-5 h-5 mx-auto mb-1 opacity-70 group-hover:text-purple-400" />
                  <span className="text-[9px] block">Cover</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] font-bold">
                Change
              </div>
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleCover(e.target.files[0]);
                e.target.value = "";
              }}
            />

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={trackTitle}
                  onChange={(e) => setTrackTitle(e.target.value)}
                  placeholder="Track title..."
                  className="text-sm font-bold bg-transparent border-b border-transparent hover:border-purple-500 focus:border-purple-500 outline-none w-full text-gray-900 dark:text-white"
                />
                <button
                  onClick={removeAudio}
                  className="text-gray-400 hover:text-rose-500 p-1 cursor-pointer"
                  title="Remove audio"
                >
                  <Icons.Trash2 className="w-4 h-4" />
                </button>
              </div>

              <input
                type="text"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder="Artist or creator name..."
                className="text-xs bg-transparent border-b border-transparent hover:border-purple-500 focus:border-purple-500 outline-none w-full text-gray-500 dark:text-gray-400"
              />

              <div className="flex items-center gap-2 text-[11px] text-purple-400">
                <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                  {selectedGenre}
                </span>
                <span className="text-gray-400 font-mono">
                  {(audioFile.size / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
            </div>
          </div>

          {/* HTML5 Audio Player */}
          <audio controls src={previewUrl} className="w-full h-10 rounded-xl" />

          {/* Action to master or edit in Audio Studio */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-gray-400">Ready to publish or enhance</span>
            <button
              type="button"
              onClick={() => navigate('/audio-editor', {
                state: {
                  audioUrl: previewUrl,
                  title: trackTitle || audioFile?.name || 'Untitled Audio',
                  artist: artistName,
                },
              })}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-1.5 hover:scale-105 active:scale-95 transition cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #8B1EF3 0%, #4431F7 50%, #055BFB 100%)' }}
            >
              <Icons.Sliders className="w-3.5 h-3.5" />
              <span>Multi-Track Master Studio</span>
            </button>
          </div>
        </div>
      )}

      {/* Genre pills selector */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Audio Category / Vibe</label>
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
          {AUDIO_GENRES.map((genre) => (
            <button
              key={genre}
              onClick={() => setSelectedGenre(genre)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer",
                selectedGenre === genre
                  ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                  : isDark
                  ? "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
                  : "bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200"
              )}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Caption text area */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Caption & Notes</label>
        <div className={cn(
          "rounded-2xl border p-3 focus-within:ring-2 focus-within:ring-purple-500 transition-all",
          isDark ? "bg-[#060B24] border-white/10" : "bg-white border-gray-200"
        )}>
          <textarea
            value={state.content}
            onChange={(e) => dispatch({ type: "SET_CONTENT", payload: e.target.value })}
            placeholder="Tell your listeners about this track, chords, inspiration, or gear used..."
            className="w-full min-h-[90px] bg-transparent resize-none outline-none text-xs text-gray-900 dark:text-white placeholder:text-gray-500"
          />
          <div className="flex items-center justify-between pt-2 border-t border-inherit text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => dispatch({ type: "SET_CONTENT", payload: `${state.content} #NewMusic ` })}
                className="hover:text-purple-400"
              >
                #NewMusic
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: "SET_CONTENT", payload: `${state.content} #ArvdoulAudio ` })}
                className="hover:text-purple-400"
              >
                #ArvdoulAudio
              </button>
            </div>
            <span>{state.content.length} / 2200</span>
          </div>
        </div>
      </div>
    </div>
  );
}
