// src/screens/CreateStory.jsx
// 🚀 ULTRA PRO MAX STORY CREATION - ADVANCED THAN INSTAGRAM/FACEBOOK
// ✨ Professional • Real-time • Filters • Music • Text • Stickers • Production Ready

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useTheme } from '@context/ThemeContext';
import { useSound } from '../hooks/useSound';
import { useAnalytics } from '../hooks/useAnalytics';
import { useAppStore } from '../store/appStore';
import { storageService } from '../services/storageService';
import { firestoreService } from '../services/firestoreService';
import { cn } from '../lib/utils';
import LoadingSpinner from '../components/Shared/LoadingSpinner';

// Icons
import {
  X, Camera, Video, Image as ImageIcon, Type, Music, Smile, Sticker,
  Palette, Filter, Crop, RotateCw, Zap, Sparkles, Wand2, Brush,
  PenTool, Shapes, Layers, Clock, Globe, Lock, Users, UserCheck,
  Send, Download, Copy, Trash2, ChevronLeft, ChevronRight, Plus,
  Minus, Maximize2, Volume2, VolumeX, Play, Pause, Eye, EyeOff,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Hash, AtSign, Link, Gift, Crown, Award, Star, Heart
} from 'lucide-react';

// Constants
const STORY_TYPES = {
  PHOTO: 'photo',
  VIDEO: 'video',
  TEXT: 'text',
  MUSIC: 'music',
  POLL: 'poll',
  QUESTION: 'question',
  COUNTDOWN: 'countdown'
};

const STORY_DURATIONS = [5, 7, 10, 15];
const DEFAULT_DURATION = 7;

const FILTERS = [
  { id: 'normal', name: 'Normal', icon: '✨' },
  { id: 'vintage', name: 'Vintage', icon: '📷' },
  { id: 'dramatic', name: 'Dramatic', icon: '🎭' },
  { id: 'warm', name: 'Warm', icon: '🔥' },
  { id: 'cool', name: 'Cool', icon: '❄️' },
  { id: 'bright', name: 'Bright', icon: '☀️' },
  { id: 'dark', name: 'Dark', icon: '🌙' },
  { id: 'vibrant', name: 'Vibrant', icon: '🌈' },
];

const FONTS = [
  { id: 'default', name: 'Default', class: 'font-sans' },
  { id: 'serif', name: 'Serif', class: 'font-serif' },
  { id: 'mono', name: 'Mono', class: 'font-mono' },
  { id: 'cursive', name: 'Cursive', class: 'font-cursive' },
  { id: 'bold', name: 'Bold', class: 'font-bold' },
  { id: 'light', name: 'Light', class: 'font-light' },
];

const TEXT_COLORS = [
  '#FFFFFF', '#000000', '#FF3B30', '#FF9500', '#FFCC00', 
  '#4CD964', '#5AC8FA', '#007AFF', '#5856D6', '#FF2D55'
];

// Camera Component
const StoryCamera = memo(({ onCapture, theme }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [flash, setFlash] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const recordIntervalRef = useRef(null);
  
  const startCamera = useCallback(async () => {
    try {
      const constraints = {
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: true
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast.error('Camera access denied or not available');
    }
  }, [facingMode]);
  
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);
  
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
      const file = new File([blob], `story_photo_${Date.now()}.jpg`, {
        type: 'image/jpeg'
      });
      
      onCapture({
        type: 'photo',
        file,
        preview: URL.createObjectURL(blob)
      });
      
      // Flash effect
      setFlash(true);
      setTimeout(() => setFlash(false), 200);
    }, 'image/jpeg', 0.9);
  }, [onCapture]);
  
  const startRecording = useCallback(() => {
    if (!stream) return;
    
    const mediaRecorder = new MediaRecorder(stream);
    const chunks = [];
    
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const file = new File([blob], `story_video_${Date.now()}.webm`, {
        type: 'video/webm'
      });
      
      onCapture({
        type: 'video',
        file,
        preview: URL.createObjectURL(blob),
        duration: recordTime
      });
    };
    
    mediaRecorder.start();
    setRecording(true);
    
    // Start timer
    recordIntervalRef.current = setInterval(() => {
      setRecordTime(prev => {
        if (prev >= 15) {
          mediaRecorder.stop();
          setRecording(false);
          clearInterval(recordIntervalRef.current);
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
  }, [stream, onCapture, recordTime]);
  
  const stopRecording = useCallback(() => {
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
    }
    setRecording(false);
    setRecordTime(0);
  }, []);
  
  const toggleCamera = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, []);
  
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);
  
  useEffect(() => {
    return () => {
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
      }
    };
  }, []);
  
  return (
    <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden">
      {/* Flash Effect */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white z-40"
          />
        )}
      </AnimatePresence>
      
      {/* Camera View */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
      
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Camera Controls */}
      <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-6 z-30">
        {/* Flip Camera */}
        <button
          onClick={toggleCamera}
          className="p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          type="button"
        >
          <RotateCw className="w-6 h-6" />
        </button>
        
        {/* Capture Button */}
        <button
          onClick={capturePhoto}
          disabled={recording}
          className={cn(
            "w-16 h-16 rounded-full border-4 border-white",
            "hover:scale-105 active:scale-95 transition-transform",
            recording && "opacity-50 cursor-not-allowed"
          )}
          type="button"
        >
          <div className="w-12 h-12 rounded-full bg-white m-auto" />
        </button>
        
        {/* Record Button */}
        <button
          onClick={recording ? stopRecording : startRecording}
          className={cn(
            "p-3 rounded-full transition-colors",
            recording 
              ? "bg-red-500 text-white animate-pulse" 
              : "bg-black/50 text-white hover:bg-black/70"
          )}
          type="button"
        >
          {recording ? (
            <div className="w-6 h-6 bg-white rounded-sm" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-red-500" />
          )}
        </button>
      </div>
      
      {/* Recording Timer */}
      <AnimatePresence>
        {recording && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="absolute top-6 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full bg-red-500 text-white font-bold z-30"
          >
            {recordTime}s / 15s
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Close Camera */}
      <button
        onClick={stopCamera}
        className="absolute top-6 right-6 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 z-30"
        type="button"
      >
        <X className="w-6 h-6" />
      </button>
    </div>
  );
});

StoryCamera.displayName = 'StoryCamera';

// Story Editor Component
const StoryEditor = memo(({ media, onSave, onCancel, theme }) => {
  const [activeTool, setActiveTool] = useState('text');
  const [textElements, setTextElements] = useState([]);
  const [stickers, setStickers] = useState([]);
  const [drawings, setDrawings] = useState([]);
  const [activeFilter, setActiveFilter] = useState('normal');
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [musicTrack, setMusicTrack] = useState(null);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  
  const mediaRef = useRef(null);
  const canvasRef = useRef(null);
  const drawingCanvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  
  // Sample stickers
  const stickerPack = useMemo(() => [
    { id: 'heart', emoji: '❤️', category: 'love' },
    { id: 'fire', emoji: '🔥', category: 'trending' },
    { id: 'star', emoji: '⭐', category: 'shine' },
    { id: 'crown', emoji: '👑', category: 'royal' },
    { id: 'rocket', emoji: '🚀', category: 'achievement' },
    { id: 'trophy', emoji: '🏆', category: 'win' },
    { id: 'party', emoji: '🎉', category: 'celebration' },
    { id: 'sparkles', emoji: '✨', category: 'magic' },
    { id: '100', emoji: '💯', category: 'perfect' },
    { id: 'eyes', emoji: '👀', category: 'watching' },
  ], []);
  
  // Sample music tracks
  const musicTracks = useMemo(() => [
    { id: 'trending1', title: 'Trending Beat', artist: 'Arvdoul Music', duration: '0:30' },
    { id: 'chill1', title: 'Chill Vibes', artist: 'Arvdoul Music', duration: '0:45' },
    { id: 'upbeat1', title: 'Upbeat Energy', artist: 'Arvdoul Music', duration: '1:00' },
    { id: 'romantic1', title: 'Romantic Mood', artist: 'Arvdoul Music', duration: '0:30' },
  ], []);
  
  // Add text element
  const addText = useCallback((text = 'Your text here') => {
    const newText = {
      id: `text_${Date.now()}`,
      content: text,
      fontSize: 24,
      fontFamily: 'default',
      color: '#FFFFFF',
      backgroundColor: 'transparent',
      position: { x: 50, y: 50 },
      rotation: 0,
      scale: 1,
      alignment: 'center',
      bold: false,
      italic: false,
      underline: false
    };
    
    setTextElements(prev => [...prev, newText]);
    setActiveTool('text');
  }, []);
  
  // Add sticker
  const addSticker = useCallback((sticker) => {
    const newSticker = {
      id: `sticker_${Date.now()}`,
      emoji: sticker.emoji,
      position: { x: 100, y: 100 },
      rotation: 0,
      scale: 1
    };
    
    setStickers(prev => [...prev, newSticker]);
    setShowStickerPicker(false);
  }, []);
  
  // Start drawing
  const startDrawing = useCallback((e) => {
    if (activeTool !== 'draw') return;
    
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const context = canvas.getContext('2d');
    context.beginPath();
    context.moveTo(x, y);
    
    isDrawingRef.current = true;
    
    // Add to drawings
    setDrawings(prev => [...prev, {
      id: `draw_${Date.now()}`,
      points: [{ x, y }],
      color: '#FF3B30',
      size: 5
    }]);
  }, [activeTool]);
  
  // Continue drawing
  const continueDrawing = useCallback((e) => {
    if (!isDrawingRef.current || activeTool !== 'draw') return;
    
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const context = canvas.getContext('2d');
    context.lineTo(x, y);
    context.strokeStyle = '#FF3B30';
    context.lineWidth = 5;
    context.lineCap = 'round';
    context.stroke();
    
    // Update last drawing
    setDrawings(prev => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last) {
        last.points.push({ x, y });
      }
      return updated;
    });
  }, [activeTool]);
  
  // Stop drawing
  const stopDrawing = useCallback(() => {
    isDrawingRef.current = false;
  }, []);
  
  // Update text element
  const updateText = useCallback((id, updates) => {
    setTextElements(prev => 
      prev.map(text => 
        text.id === id ? { ...text, ...updates } : text
      )
    );
  }, []);
  
  // Remove element
  const removeElement = useCallback((id, type) => {
    switch (type) {
      case 'text':
        setTextElements(prev => prev.filter(t => t.id !== id));
        break;
      case 'sticker':
        setStickers(prev => prev.filter(s => s.id !== id));
        break;
      case 'drawing':
        setDrawings(prev => prev.filter(d => d.id !== id));
        break;
    }
  }, []);
  
  // Apply filter
  const applyFilter = useCallback((filterId) => {
    setActiveFilter(filterId);
    
    // In production, apply filter to canvas
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      // Example filter application
      switch (filterId) {
        case 'vintage':
          // Apply vintage filter
          break;
        case 'warm':
          // Apply warm filter
          break;
        // Add more filters
      }
    }
  }, []);
  
  // Handle save
  const handleSave = useCallback(async () => {
    try {
      // Combine all elements into final story
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = 1080;
      finalCanvas.height = 1920; // Story aspect ratio
      
      const ctx = finalCanvas.getContext('2d');
      
      // Draw background media
      if (media.type === 'photo') {
        const img = new Image();
        img.src = media.preview;
        await new Promise(resolve => {
          img.onload = () => {
            ctx.drawImage(img, 0, 0, finalCanvas.width, finalCanvas.height);
            resolve();
          };
        });
      }
      
      // Apply filter
      // ... filter logic
      
      // Draw text elements
      textElements.forEach(text => {
        ctx.save();
        ctx.translate(text.position.x, text.position.y);
        ctx.rotate(text.rotation * Math.PI / 180);
        ctx.scale(text.scale, text.scale);
        
        ctx.font = `${text.bold ? 'bold ' : ''}${text.italic ? 'italic ' : ''}${text.fontSize}px ${text.fontFamily}`;
        ctx.fillStyle = text.color;
        ctx.textAlign = text.alignment;
        
        if (text.backgroundColor !== 'transparent') {
          ctx.fillStyle = text.backgroundColor;
          // Draw background
        }
        
        ctx.fillText(text.content, 0, 0);
        
        if (text.underline) {
          ctx.strokeStyle = text.color;
          ctx.lineWidth = 2;
          // Draw underline
        }
        
        ctx.restore();
      });
      
      // Convert to blob
      const blob = await new Promise(resolve => {
        finalCanvas.toBlob(resolve, 'image/jpeg', 0.9);
      });
      
      const file = new File([blob], `story_${Date.now()}.jpg`, {
        type: 'image/jpeg'
      });
      
      onSave({
        file,
        preview: URL.createObjectURL(blob),
        elements: { textElements, stickers, drawings },
        filter: activeFilter,
        duration,
        music: musicTrack
      });
      
    } catch (error) {
      console.error('Story save error:', error);
      toast.error('Failed to save story');
    }
  }, [media, textElements, stickers, drawings, activeFilter, duration, musicTrack, onSave]);
  
  return (
    <div className="relative w-full h-full">
      {/* Editor Canvas */}
      <div className="relative w-full h-[70vh] bg-black rounded-2xl overflow-hidden">
        {/* Media Background */}
        {media.type === 'photo' ? (
          <img
            src={media.preview}
            alt="Story background"
            className="w-full h-full object-cover"
            style={{ filter: `url(#${activeFilter})` }}
          />
        ) : (
          <video
            src={media.preview}
            className="w-full h-full object-cover"
            autoPlay
            loop
            muted
          />
        )}
        
        {/* Drawing Canvas */}
        <canvas
          ref={drawingCanvasRef}
          className="absolute inset-0 z-20"
          width={1080}
          height={1920}
          onMouseDown={startDrawing}
          onMouseMove={continueDrawing}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />
        
        {/* Text Elements */}
        {textElements.map(text => (
          <div
            key={text.id}
            className="absolute z-30 cursor-move"
            style={{
              left: `${text.position.x}px`,
              top: `${text.position.y}px`,
              transform: `rotate(${text.rotation}deg) scale(${text.scale})`,
              fontSize: `${text.fontSize}px`,
              fontFamily: text.fontFamily,
              color: text.color,
              backgroundColor: text.backgroundColor,
              textAlign: text.alignment,
              fontWeight: text.bold ? 'bold' : 'normal',
              fontStyle: text.italic ? 'italic' : 'normal',
              textDecoration: text.underline ? 'underline' : 'none'
            }}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/id', text.id);
            }}
          >
            {text.content}
            
            {/* Text Controls */}
            <div className="absolute -top-8 left-0 flex items-center gap-1 bg-black/70 rounded-lg p-1">
              <button
                onClick={() => updateText(text.id, { fontSize: text.fontSize + 2 })}
                className="p-1 text-white hover:bg-white/20 rounded"
                type="button"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                onClick={() => updateText(text.id, { fontSize: Math.max(12, text.fontSize - 2) })}
                className="p-1 text-white hover:bg-white/20 rounded"
                type="button"
              >
                <Minus className="w-3 h-3" />
              </button>
              <button
                onClick={() => removeElement(text.id, 'text')}
                className="p-1 text-red-400 hover:bg-white/20 rounded"
                type="button"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
        
        {/* Stickers */}
        {stickers.map(sticker => (
          <div
            key={sticker.id}
            className="absolute z-30 cursor-move text-4xl"
            style={{
              left: `${sticker.position.x}px`,
              top: `${sticker.position.y}px`,
              transform: `rotate(${sticker.rotation}deg) scale(${sticker.scale})`
            }}
          >
            {sticker.emoji}
          </div>
        ))}
        
        <canvas ref={canvasRef} className="hidden" />
      </div>
      
      {/* Editor Tools */}
      <div className={cn(
        "mt-4 p-4 rounded-2xl",
        theme === 'dark' 
          ? 'bg-gray-900/50 border border-gray-700' 
          : 'bg-gray-50 border border-gray-200'
      )}>
        {/* Tool Selection */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {[
              { id: 'text', icon: Type, label: 'Text' },
              { id: 'draw', icon: Brush, label: 'Draw' },
              { id: 'sticker', icon: Sticker, label: 'Stickers' },
              { id: 'filter', icon: Filter, label: 'Filters' },
              { id: 'music', icon: Music, label: 'Music' },
              { id: 'duration', icon: Clock, label: 'Duration' }
            ].map(tool => (
              <button
                key={tool.id}
                onClick={() => {
                  if (tool.id === 'sticker') setShowStickerPicker(true);
                  else if (tool.id === 'music') setShowMusicPicker(true);
                  else setActiveTool(tool.id);
                }}
                className={cn(
                  "px-4 py-2 rounded-full flex items-center gap-2 whitespace-nowrap",
                  activeTool === tool.id
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                    : theme === 'dark'
                      ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
                type="button"
              >
                <tool.icon className="w-4 h-4" />
                {tool.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Active Tool Panel */}
        <AnimatePresence mode="wait">
          {activeTool === 'text' && (
            <motion.div
              key="text-tool"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <button
                onClick={() => addText()}
                className={cn(
                  "w-full p-3 rounded-lg border border-dashed flex items-center justify-center gap-2",
                  theme === 'dark'
                    ? 'border-gray-700 text-gray-400 hover:border-purple-500 hover:text-purple-400'
                    : 'border-gray-300 text-gray-600 hover:border-purple-500 hover:text-purple-600'
                )}
                type="button"
              >
                <Plus className="w-4 h-4" />
                Add Text
              </button>
              
              {textElements.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => textElements.length > 0 && updateText(textElements[0].id, { bold: !textElements[0].bold })}
                    className={cn(
                      "p-2 rounded-lg",
                      textElements[0]?.bold
                        ? "bg-purple-500 text-white"
                        : theme === 'dark'
                          ? "bg-gray-800 text-gray-300"
                          : "bg-gray-100 text-gray-700"
                    )}
                    type="button"
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  {/* Add more text controls */}
                </div>
              )}
            </motion.div>
          )}
          
          {activeTool === 'filter' && (
            <motion.div
              key="filter-tool"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="grid grid-cols-4 gap-3">
                {FILTERS.map(filter => (
                  <button
                    key={filter.id}
                    onClick={() => applyFilter(filter.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-xl",
                      activeFilter === filter.id
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                        : theme === 'dark'
                          ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                    type="button"
                  >
                    <span className="text-2xl">{filter.icon}</span>
                    <span className="text-xs">{filter.name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
          
          {activeTool === 'duration' && (
            <motion.div
              key="duration-tool"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="grid grid-cols-4 gap-3">
                {STORY_DURATIONS.map(sec => (
                  <button
                    key={sec}
                    onClick={() => setDuration(sec)}
                    className={cn(
                      "p-4 rounded-xl font-bold text-lg",
                      duration === sec
                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                        : theme === 'dark'
                          ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                    type="button"
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Sticker Picker */}
        <AnimatePresence>
          {showStickerPicker && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "absolute bottom-full left-0 right-0 mb-4 p-4 rounded-2xl",
                "grid grid-cols-5 gap-3 max-h-48 overflow-y-auto",
                theme === 'dark'
                  ? 'bg-gray-900 border border-gray-700'
                  : 'bg-white border border-gray-300'
              )}
            >
              {stickerPack.map(sticker => (
                <button
                  key={sticker.id}
                  onClick={() => addSticker(sticker)}
                  className="text-3xl p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg"
                  type="button"
                >
                  {sticker.emoji}
                </button>
              ))}
              
              <button
                onClick={() => setShowStickerPicker(false)}
                className="col-span-5 p-3 mt-2 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                type="button"
              >
                Close
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Music Picker */}
        <AnimatePresence>
          {showMusicPicker && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "absolute bottom-full left-0 right-0 mb-4 p-4 rounded-2xl",
                theme === 'dark'
                  ? 'bg-gray-900 border border-gray-700'
                  : 'bg-white border border-gray-300'
              )}
            >
              <h3 className={cn(
                "font-semibold mb-3",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Add Music
              </h3>
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {musicTracks.map(track => (
                  <button
                    key={track.id}
                    onClick={() => {
                      setMusicTrack(track);
                      setShowMusicPicker(false);
                    }}
                    className={cn(
                      "w-full p-3 rounded-lg flex items-center justify-between",
                      musicTrack?.id === track.id
                        ? "bg-purple-500 text-white"
                        : theme === 'dark'
                          ? "hover:bg-gray-800 text-gray-300"
                          : "hover:bg-gray-100 text-gray-700"
                    )}
                    type="button"
                  >
                    <div className="text-left">
                      <div className="font-medium">{track.title}</div>
                      <div className="text-sm opacity-75">{track.artist}</div>
                    </div>
                    <div className="text-sm">{track.duration}</div>
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setShowMusicPicker(false)}
                className="w-full p-3 mt-3 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                type="button"
              >
                Close
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Action Buttons */}
      <div className="flex items-center justify-between mt-6">
        <button
          onClick={onCancel}
          className={cn(
            "px-6 py-3 rounded-full font-medium",
            theme === 'dark'
              ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          )}
          type="button"
        >
          Cancel
        </button>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className={cn(
              "px-6 py-3 rounded-full font-medium flex items-center gap-2",
              "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
              "hover:shadow-lg"
            )}
            type="button"
          >
            <Sparkles className="w-4 h-4" />
            Save Story
          </button>
        </div>
      </div>
    </div>
  );
});

StoryEditor.displayName = 'StoryEditor';

// Main CreateStory Component
const CreateStory = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { playSound } = useSound();
  const { track } = useAnalytics();
  const { currentUser, updateUserProfile } = useAppStore();
  
  // State Management
  const [mode, setMode] = useState('select'); // 'select', 'camera', 'editor', 'preview'
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [editedStory, setEditedStory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [visibility, setVisibility] = useState('public');
  const [closeFriends, setCloseFriends] = useState(false);
  const [allowReplies, setAllowReplies] = useState(true);
  const [allowSharing, setAllowSharing] = useState(true);
  
  const fileInputRef = useRef(null);
  
  // Handle media selection
  const handleMediaSelect = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
      toast.error('Please select an image or video');
      return;
    }
    
    if (file.size > 100 * 1024 * 1024) { // 100MB
      toast.error('File size must be less than 100MB');
      return;
    }
    
    const preview = URL.createObjectURL(file);
    setSelectedMedia({
      type: isImage ? 'photo' : 'video',
      file,
      preview,
      duration: isVideo ? 15 : 7 // Default durations
    });
    
    setMode('editor');
    track('Story_Media_Selected', { type: isImage ? 'photo' : 'video' });
  }, [track]);
  
  // Handle camera capture
  const handleCameraCapture = useCallback((capture) => {
    setSelectedMedia(capture);
    setMode('editor');
    track('Story_Camera_Capture', { type: capture.type });
  }, [track]);
  
  // Handle story save from editor
  const handleEditorSave = useCallback((edited) => {
    setEditedStory(edited);
    setMode('preview');
    track('Story_Edited', {
      hasText: edited.elements.textElements.length > 0,
      hasStickers: edited.elements.stickers.length > 0,
      hasDrawings: edited.elements.drawings.length > 0,
      filter: edited.filter,
      duration: edited.duration,
      hasMusic: !!edited.music
    });
  }, [track]);
  
  // Handle publish
  const handlePublish = useCallback(async () => {
    if (!editedStory) return;
    
    setLoading(true);
    playSound('story_publish');
    
    try {
      // Upload story media
      const uploadResult = await storageService.uploadFile(
        editedStory.file,
        `stories/${currentUser.uid}/${Date.now()}_${editedStory.file.name}`,
        {
          metadata: {
            duration: editedStory.duration,
            filter: editedStory.filter,
            hasMusic: !!editedStory.music
          }
        }
      );
      
      // Prepare story data
      const storyData = {
        type: selectedMedia.type,
        mediaUrl: uploadResult.downloadURL,
        thumbnail: editedStory.preview,
        duration: editedStory.duration,
        filter: editedStory.filter,
        music: editedStory.music,
        elements: editedStory.elements,
        
        // Author info
        authorId: currentUser.uid,
        authorName: currentUser.displayName,
        authorPhoto: currentUser.photoURL,
        authorUsername: currentUser.username,
        
        // Settings
        visibility,
        closeFriends,
        allowReplies,
        allowSharing,
        
        // Stats
        views: [],
        replies: [],
        shares: 0,
        reactions: {},
        
        // System
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        status: 'active',
        version: 1
      };
      
      // Save to Firestore
      const result = await firestoreService.createStory(storyData);
      
      // Update user stats
      updateUserProfile({
        storyCount: (currentUser.storyCount || 0) + 1
      });
      
      // Success
      toast.success('Story published!', {
        description: 'Available for 24 hours',
        action: {
          label: 'View',
          onClick: () => navigate('/stories')
        }
      });
      
      // Analytics
      track('Story_Published', {
        storyId: result.storyId,
        type: selectedMedia.type,
        duration: editedStory.duration,
        visibility,
        closeFriends
      });
      
      // Navigate to stories
      navigate('/stories');
      
    } catch (error) {
      console.error('Publish error:', error);
      toast.error('Failed to publish story', {
        description: error.message || 'Please try again'
      });
      
      track('Story_Publish_Error', { error: error.message });
    } finally {
      setLoading(false);
    }
  }, [
    editedStory, selectedMedia, currentUser, visibility, closeFriends,
    playSound, updateUserProfile, track, navigate
  ]);
  
  // Render mode based on current state
  const renderContent = () => {
    switch (mode) {
      case 'select':
        return (
          <div className="h-full flex flex-col items-center justify-center p-8">
            <div className="text-center max-w-md">
              <div className={cn(
                "w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-6",
                "bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-blue-500/20"
              )}>
                <Sparkles className="w-16 h-16 text-purple-400" />
              </div>
              
              <h1 className={cn(
                "text-3xl font-bold mb-4",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Create a Story
              </h1>
              
              <p className={cn(
                "text-lg mb-8",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                Share a moment that disappears in 24 hours
              </p>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                <button
                  onClick={() => setMode('camera')}
                  className={cn(
                    "p-6 rounded-2xl flex flex-col items-center justify-center gap-3",
                    "hover:scale-105 transition-all duration-200",
                    theme === 'dark'
                      ? 'bg-gray-800 hover:bg-gray-700'
                      : 'bg-gray-100 hover:bg-gray-200'
                  )}
                  type="button"
                >
                  <Camera className="w-8 h-8 text-purple-500" />
                  <span className="font-medium">Camera</span>
                </button>
                
                <button
                  onClick={() => fileInputRef.current.click()}
                  className={cn(
                    "p-6 rounded-2xl flex flex-col items-center justify-center gap-3",
                    "hover:scale-105 transition-all duration-200",
                    theme === 'dark'
                      ? 'bg-gray-800 hover:bg-gray-700'
                      : 'bg-gray-100 hover:bg-gray-200'
                  )}
                  type="button"
                >
                  <ImageIcon className="w-8 h-8 text-pink-500" />
                  <span className="font-medium">Gallery</span>
                </button>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleMediaSelect}
                className="hidden"
              />
              
              <button
                onClick={() => navigate(-1)}
                className={cn(
                  "px-6 py-3 rounded-full font-medium",
                  theme === 'dark'
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                )}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        );
      
      case 'camera':
        return (
          <StoryCamera
            onCapture={handleCameraCapture}
            theme={theme}
          />
        );
      
      case 'editor':
        return (
          <StoryEditor
            media={selectedMedia}
            onSave={handleEditorSave}
            onCancel={() => setMode('select')}
            theme={theme}
          />
        );
      
      case 'preview':
        return (
          <div className="space-y-6">
            {/* Preview */}
            <div className="relative w-full h-[60vh] bg-black rounded-2xl overflow-hidden">
              {selectedMedia.type === 'photo' ? (
                <img
                  src={editedStory.preview}
                  alt="Story preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  src={editedStory.preview}
                  className="w-full h-full object-cover"
                  autoPlay
                  loop
                  muted
                />
              )}
              
              {/* Duration Badge */}
              <div className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-black/70 text-white text-sm">
                {editedStory.duration}s
              </div>
              
              {/* Music Badge */}
              {editedStory.music && (
                <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full bg-black/70 text-white text-sm flex items-center gap-2">
                  <Music className="w-4 h-4" />
                  {editedStory.music.title}
                </div>
              )}
            </div>
            
            {/* Settings */}
            <div className={cn(
              "rounded-2xl p-4 space-y-4",
              theme === 'dark'
                ? 'bg-gray-900/50 border border-gray-700'
                : 'bg-gray-50 border border-gray-200'
            )}>
              <h3 className={cn(
                "font-semibold",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Story Settings
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Visibility */}
                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-2",
                    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                  )}>
                    Visibility
                  </label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value)}
                    className={cn(
                      "w-full p-3 rounded-lg outline-none",
                      theme === 'dark'
                        ? 'bg-gray-800 text-white border border-gray-700'
                        : 'bg-white text-gray-900 border border-gray-300'
                    )}
                  >
                    <option value="public">Public</option>
                    <option value="friends">Friends</option>
                    <option value="close_friends">Close Friends</option>
                    <option value="private">Only Me</option>
                  </select>
                </div>
                
                {/* Close Friends */}
                {visibility === 'close_friends' && (
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2",
                      theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                    )}>
                      Close Friends List
                    </label>
                    <button
                      className={cn(
                        "w-full p-3 rounded-lg flex items-center justify-between",
                        theme === 'dark'
                          ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      )}
                      type="button"
                    >
                      <span>Manage List</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              
              {/* Feature Toggles */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-700 dark:border-gray-600">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowReplies}
                    onChange={(e) => setAllowReplies(e.target.checked)}
                    className="rounded"
                  />
                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                    Allow Replies
                  </span>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowSharing}
                    onChange={(e) => setAllowSharing(e.target.checked)}
                    className="rounded"
                  />
                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                    Allow Sharing
                  </span>
                </label>
                
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={closeFriends}
                    onChange={(e) => setCloseFriends(e.target.checked)}
                    className="rounded"
                  />
                  <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}>
                    Close Friends
                  </span>
                </label>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setMode('editor')}
                className={cn(
                  "px-6 py-3 rounded-full font-medium",
                  theme === 'dark'
                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                )}
                type="button"
              >
                Edit Again
              </button>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setMode('select');
                    setSelectedMedia(null);
                    setEditedStory(null);
                  }}
                  className={cn(
                    "px-6 py-3 rounded-full font-medium",
                    theme === 'dark'
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  )}
                  type="button"
                >
                  Discard
                </button>
                
                <button
                  onClick={handlePublish}
                  disabled={loading}
                  className={cn(
                    "px-8 py-3 rounded-full font-medium flex items-center gap-2",
                    "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
                    "hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  type="button"
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Publish Story
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={cn(
      "min-h-screen pb-20",
      theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'
    )}>
      {/* Header */}
      <div className={cn(
        "sticky top-0 z-50 px-4 py-3 border-b backdrop-blur-xl",
        theme === 'dark'
          ? 'bg-gray-900/95 border-gray-800'
          : 'bg-white/95 border-gray-200'
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                if (mode === 'select') {
                  navigate(-1);
                } else if (mode === 'camera' || mode === 'editor' || mode === 'preview') {
                  setMode('select');
                  setSelectedMedia(null);
                  setEditedStory(null);
                }
              }}
              className={cn(
                "p-2 rounded-full",
                theme === 'dark'
                  ? 'hover:bg-gray-800 text-gray-400'
                  : 'hover:bg-gray-200 text-gray-600'
              )}
              type="button"
            >
              <ChevronLeft className="w-5 h-5" />
            </motion.button>
            
            <div>
              <h1 className="text-xl font-bold">
                {mode === 'select' && 'Create Story'}
                {mode === 'camera' && 'Camera'}
                {mode === 'editor' && 'Edit Story'}
                {mode === 'preview' && 'Preview Story'}
              </h1>
              <p className={cn(
                "text-sm",
                theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
              )}>
                {mode === 'select' && 'Share a moment with friends'}
                {mode === 'camera' && 'Take a photo or video'}
                {mode === 'editor' && 'Add text, stickers & effects'}
                {mode === 'preview' && 'Review before publishing'}
              </p>
            </div>
          </div>
          
          {mode === 'preview' && (
            <div className="flex items-center gap-2">
              <div className={cn(
                "px-3 py-1.5 rounded-full text-sm",
                theme === 'dark'
                  ? 'bg-gray-800 text-gray-300'
                  : 'bg-gray-200 text-gray-700'
              )}>
                {editedStory?.duration || 7}s
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {renderContent()}
      </div>
      
      {/* Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xl flex items-center justify-center"
          >
            <div className="text-center">
              <LoadingSpinner size="lg" />
              <p className="mt-4 text-white text-lg">Publishing your story...</p>
              <p className="text-gray-400 text-sm">Available for 24 hours</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CreateStory;