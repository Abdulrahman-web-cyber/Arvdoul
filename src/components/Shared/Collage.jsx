// src/components/Shared/Collage.jsx - ARVDOUL COLLAGE MAKER & COMPOSER
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Grid, Columns, Layout, Sliders, Check, Download,
  X, RefreshCw, Sparkles, Image as ImageIcon, Plus, ArrowLeftRight
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

export const COLLAGE_LAYOUTS = [
  { id: 'grid-2', count: 2, label: 'Split Vertical', icon: Columns },
  { id: 'stack-2', count: 2, label: 'Split Horizontal', icon: Layout },
  { id: 'hero-3', count: 3, label: '1 Large + 2 Small', icon: Layout },
  { id: 'cols-3', count: 3, label: '3 Columns', icon: Columns },
  { id: 'grid-4', count: 4, label: '2x2 Grid', icon: Grid },
  { id: 'strip-4', count: 4, label: '1 Top + 3 Bottom', icon: Layout },
  { id: 'grid-6', count: 6, label: '2x3 Gallery', icon: Grid },
];

export const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1 Square', ratio: 1 },
  { id: '4:5', label: '4:5 Social', ratio: 4 / 5 },
  { id: '16:9', label: '16:9 Wide', ratio: 16 / 9 },
  { id: '9:16', label: '9:16 Story', ratio: 9 / 16 },
];

export const BACKGROUND_COLORS = [
  { id: 'dark', color: '#03071B', label: 'Deep Blue' },
  { id: 'black', color: '#000000', label: 'Black' },
  { id: 'white', color: '#FFFFFF', label: 'Pure White' },
  { id: 'slate', color: '#1E293B', label: 'Slate' },
  { id: 'purple', color: '#8B1EF3', label: 'Arvdoul Purple' },
  { id: 'gradient', color: 'linear-gradient(135deg, #B416DB, #4B6BFF)', label: 'DNA Gradient' },
];

export default function Collage({
  images = [],
  onSave,
  onClose,
  isDark = true,
}) {
  const [selectedImages, setSelectedImages] = useState(() => {
    return images.slice(0, 6).map((img, idx) => ({
      id: img.id || `img-${idx}`,
      url: typeof img === 'string' ? img : img.url || img.preview || '',
      file: img.file || null,
    })).filter(i => i.url);
  });

  const [activeLayout, setActiveLayout] = useState('grid-4');
  const [spacing, setSpacing] = useState(8);
  const [radius, setRadius] = useState(12);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [bgColor, setBgColor] = useState(BACKGROUND_COLORS[0].color);
  const [isExporting, setIsExporting] = useState(false);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-adapt layout to number of images
  useEffect(() => {
    const len = selectedImages.length;
    if (len === 2) setActiveLayout('grid-2');
    else if (len === 3) setActiveLayout('hero-3');
    else if (len >= 4 && len <= 5) setActiveLayout('grid-4');
    else if (len >= 6) setActiveLayout('grid-6');
  }, [selectedImages.length]);

  // Add more images
  const handleAddImage = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const availableSlots = 6 - selectedImages.length;
    if (availableSlots <= 0) {
      toast.info('Maximum 6 images in a single collage');
      return;
    }

    const newItems = files.slice(0, availableSlots).map((file, idx) => ({
      id: `new-${Date.now()}-${idx}`,
      url: URL.createObjectURL(file),
      file,
    }));

    setSelectedImages((prev) => [...prev, ...newItems]);
    e.target.value = '';
  };

  const handleRemoveImage = (id) => {
    setSelectedImages((prev) => prev.filter((i) => i.id !== id));
  };

  const handleSwap = (i, j) => {
    setSelectedImages((prev) => {
      const arr = [...prev];
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
      return arr;
    });
  };

  // Render to Canvas for High-Resolution Export
  const renderCollageToCanvas = useCallback(async () => {
    if (!canvasRef.current || selectedImages.length === 0) return null;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const baseWidth = 1600;
    const ratioObj = ASPECT_RATIOS.find((r) => r.id === aspectRatio) || ASPECT_RATIOS[0];
    const baseHeight = Math.round(baseWidth / ratioObj.ratio);

    canvas.width = baseWidth;
    canvas.height = baseHeight;

    // Background
    if (bgColor.startsWith('linear-gradient')) {
      const grad = ctx.createLinearGradient(0, 0, baseWidth, baseHeight);
      grad.addColorStop(0, '#B416DB');
      grad.addColorStop(0.5, '#872FE2');
      grad.addColorStop(1, '#0EA3E6');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = bgColor;
    }
    ctx.fillRect(0, 0, baseWidth, baseHeight);

    // Preload HTMLImages
    const loadedImages = await Promise.all(
      selectedImages.map(
        (item) =>
          new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = item.url;
          })
      )
    );

    const pad = Math.round((spacing / 100) * baseWidth * 0.1);
    const cornerRadius = Math.round((radius / 100) * baseWidth * 0.08);

    // Calculate slots
    const slots = [];
    const count = Math.min(selectedImages.length, 6);

    const drawRoundedImage = (img, x, y, w, h) => {
      if (!img) return;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x + cornerRadius, y);
      ctx.arcTo(x + w, y, x + w, y + h, cornerRadius);
      ctx.arcTo(x + w, y + h, x, y + h, cornerRadius);
      ctx.arcTo(x, y + h, x, y, cornerRadius);
      ctx.arcTo(x, y, x + w, y, cornerRadius);
      ctx.closePath();
      ctx.clip();

      // Cover scaling
      const imgRatio = img.width / img.height;
      const slotRatio = w / h;
      let sx, sy, sw, sh;
      if (imgRatio > slotRatio) {
        sh = img.height;
        sw = img.height * slotRatio;
        sx = (img.width - sw) / 2;
        sy = 0;
      } else {
        sw = img.width;
        sh = img.width / slotRatio;
        sx = 0;
        sy = (img.height - sh) / 2;
      }
      ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
      ctx.restore();
    };

    if (activeLayout === 'grid-2' || count === 2) {
      const w = (baseWidth - pad * 3) / 2;
      const h = baseHeight - pad * 2;
      drawRoundedImage(loadedImages[0], pad, pad, w, h);
      drawRoundedImage(loadedImages[1], pad * 2 + w, pad, w, h);
    } else if (activeLayout === 'stack-2') {
      const w = baseWidth - pad * 2;
      const h = (baseHeight - pad * 3) / 2;
      drawRoundedImage(loadedImages[0], pad, pad, w, h);
      drawRoundedImage(loadedImages[1], pad, pad * 2 + h, w, h);
    } else if (activeLayout === 'hero-3' || count === 3) {
      const halfW = (baseWidth - pad * 3) / 2;
      const halfH = (baseHeight - pad * 3) / 2;
      drawRoundedImage(loadedImages[0], pad, pad, halfW, baseHeight - pad * 2);
      drawRoundedImage(loadedImages[1], pad * 2 + halfW, pad, halfW, halfH);
      drawRoundedImage(loadedImages[2], pad * 2 + halfW, pad * 2 + halfH, halfW, halfH);
    } else if (activeLayout === 'cols-3') {
      const colW = (baseWidth - pad * 4) / 3;
      const h = baseHeight - pad * 2;
      drawRoundedImage(loadedImages[0], pad, pad, colW, h);
      drawRoundedImage(loadedImages[1], pad * 2 + colW, pad, colW, h);
      drawRoundedImage(loadedImages[2], pad * 3 + colW * 2, pad, colW, h);
    } else if (activeLayout === 'strip-4') {
      const topH = (baseHeight - pad * 3) * 0.6;
      const botH = (baseHeight - pad * 3) * 0.4;
      const botW = (baseWidth - pad * 4) / 3;
      drawRoundedImage(loadedImages[0], pad, pad, baseWidth - pad * 2, topH);
      drawRoundedImage(loadedImages[1], pad, pad * 2 + topH, botW, botH);
      drawRoundedImage(loadedImages[2], pad * 2 + botW, pad * 2 + topH, botW, botH);
      drawRoundedImage(loadedImages[3], pad * 3 + botW * 2, pad * 2 + topH, botW, botH);
    } else if (activeLayout === 'grid-6') {
      const colW = (baseWidth - pad * 4) / 3;
      const rowH = (baseHeight - pad * 3) / 2;
      for (let i = 0; i < Math.min(6, count); i++) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = pad + col * (colW + pad);
        const y = pad + row * (rowH + pad);
        drawRoundedImage(loadedImages[i], x, y, colW, rowH);
      }
    } else {
      // Default: 2x2 Grid
      const cellW = (baseWidth - pad * 3) / 2;
      const cellH = (baseHeight - pad * 3) / 2;
      drawRoundedImage(loadedImages[0], pad, pad, cellW, cellH);
      drawRoundedImage(loadedImages[1], pad * 2 + cellW, pad, cellW, cellH);
      drawRoundedImage(loadedImages[2], pad, pad * 2 + cellH, cellW, cellH);
      drawRoundedImage(loadedImages[3] || loadedImages[0], pad * 2 + cellW, pad * 2 + cellH, cellW, cellH);
    }

    return canvas;
  }, [selectedImages, activeLayout, spacing, radius, aspectRatio, bgColor]);

  const handleExport = async (saveDirectlyToPost = true) => {
    if (selectedImages.length < 2) {
      toast.error('Add at least 2 images to create a collage');
      return;
    }

    setIsExporting(true);
    toast.loading('Composing high-resolution collage...', { id: 'collage_export' });

    try {
      const canvas = await renderCollageToCanvas();
      if (!canvas) throw new Error('Canvas render failed');

      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error('Failed to create collage image', { id: 'collage_export' });
          setIsExporting(false);
          return;
        }

        const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
        const file = new File([blob], `collage_${Date.now()}.jpg`, { type: 'image/jpeg' });

        toast.success('Collage created successfully! ✨', { id: 'collage_export' });
        setIsExporting(false);

        if (saveDirectlyToPost && onSave) {
          onSave({ file, blob, url: dataUrl });
        } else {
          // Download to device
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = `arvdoul_collage_${Date.now()}.jpg`;
          a.click();
        }
      }, 'image/jpeg', 0.92);
    } catch (err) {
      console.error('Collage export error:', err);
      toast.error('Error generating collage', { id: 'collage_export' });
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={cn(
          "w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden relative",
          isDark ? "bg-[#03071B] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"
        )}
      >
        {/* Hidden Export Canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-purple-600/30">
              <Grid className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Photo Collage Studio</h2>
              <p className="text-xs text-gray-400">Combine up to 6 photos with creative grid styles</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Workspace */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Preview Canvas Area */}
          <div className="flex-1 p-4 sm:p-6 flex items-center justify-center bg-black/40 overflow-auto relative">
            <div
              className="relative shadow-2xl transition-all duration-300 overflow-hidden flex items-center justify-center max-w-full max-h-[50vh] md:max-h-[65vh]"
              style={{
                aspectRatio: (ASPECT_RATIOS.find((r) => r.id === aspectRatio) || ASPECT_RATIOS[0]).ratio,
                background: bgColor,
                padding: `${spacing}px`,
                width: '100%',
                maxWidth: '480px',
              }}
            >
              {selectedImages.length === 0 ? (
                <div className="text-center p-8">
                  <ImageIcon className="w-12 h-12 text-gray-500 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-400">Add photos to start your collage</p>
                </div>
              ) : (
                <div
                  className="w-full h-full grid"
                  style={{
                    gap: `${spacing}px`,
                    gridTemplateColumns:
                      activeLayout === 'grid-2'
                        ? 'repeat(2, 1fr)'
                        : activeLayout === 'stack-2'
                        ? '1fr'
                        : activeLayout === 'cols-3'
                        ? 'repeat(3, 1fr)'
                        : activeLayout === 'hero-3'
                        ? '1fr 1fr'
                        : activeLayout === 'grid-6'
                        ? 'repeat(3, 1fr)'
                        : 'repeat(2, 1fr)',
                    gridTemplateRows:
                      activeLayout === 'stack-2'
                        ? 'repeat(2, 1fr)'
                        : activeLayout === 'grid-6'
                        ? 'repeat(2, 1fr)'
                        : activeLayout === 'grid-4'
                        ? 'repeat(2, 1fr)'
                        : '1fr',
                  }}
                >
                  {selectedImages.map((img, idx) => (
                    <div
                      key={img.id}
                      className={cn(
                        "relative overflow-hidden group shadow-md",
                        activeLayout === 'hero-3' && idx === 0 ? "row-span-2" : ""
                      )}
                      style={{ borderRadius: `${radius}px` }}
                    >
                      <img
                        src={img.url}
                        alt="Slot"
                        className="w-full h-full object-cover select-none"
                      />

                      {/* Hover Overlay Controls */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        {idx > 0 && (
                          <button
                            onClick={() => handleSwap(idx, idx - 1)}
                            className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white"
                            title="Swap Left"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveImage(img.id)}
                          className="p-1.5 rounded-lg bg-rose-500/80 hover:bg-rose-500 text-white"
                          title="Remove Photo"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Controls Sidebar */}
          <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-white/10 p-4 sm:p-5 space-y-4 overflow-y-auto shrink-0">
            {/* Image Thumbnails & Add */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Photos ({selectedImages.length}/6)
                </label>
                {selectedImages.length < 6 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleAddImage}
                />
              </div>

              <div className="grid grid-cols-4 gap-2">
                {selectedImages.map((img) => (
                  <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group">
                    <img src={img.url} alt="Thumb" className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleRemoveImage(img.id)}
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Layout Presets */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
                Layout Arrangement
              </label>
              <div className="grid grid-cols-2 gap-2">
                {COLLAGE_LAYOUTS.map((layout) => {
                  const Icon = layout.icon;
                  return (
                    <button
                      key={layout.id}
                      onClick={() => setActiveLayout(layout.id)}
                      className={cn(
                        "p-2 rounded-xl text-left border text-xs flex items-center gap-2 transition",
                        activeLayout === layout.id
                          ? "bg-purple-600/30 border-purple-500 text-white"
                          : "bg-white/5 border-white/5 text-gray-400 hover:text-white"
                      )}
                    >
                      <Icon className="w-4 h-4 text-purple-400 shrink-0" />
                      <span className="truncate">{layout.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Aspect Ratio */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
                Aspect Ratio
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {ASPECT_RATIOS.map((ar) => (
                  <button
                    key={ar.id}
                    onClick={() => setAspectRatio(ar.id)}
                    className={cn(
                      "py-1.5 rounded-xl text-xs font-semibold transition text-center",
                      aspectRatio === ar.id
                        ? "bg-purple-600 text-white shadow"
                        : "bg-white/5 text-gray-400 hover:text-white"
                    )}
                  >
                    {ar.id}
                  </button>
                ))}
              </div>
            </div>

            {/* Spacing & Radius Sliders */}
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400 font-medium">Border Spacing</span>
                  <span className="font-mono text-purple-400">{spacing}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="24"
                  value={spacing}
                  onChange={(e) => setSpacing(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400 font-medium">Corner Roundness</span>
                  <span className="font-mono text-purple-400">{radius}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="32"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>
            </div>

            {/* Background Color */}
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">
                Background Theme
              </label>
              <div className="flex items-center gap-2">
                {BACKGROUND_COLORS.map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => setBgColor(bg.color)}
                    style={{ background: bg.color }}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 transition-all",
                      bgColor === bg.color ? "border-purple-400 scale-110" : "border-transparent opacity-80 hover:opacity-100"
                    )}
                    title={bg.label}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-white/10 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleExport(false)}
              disabled={selectedImages.length < 2 || isExporting}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save File</span>
            </button>

            <button
              onClick={() => handleExport(true)}
              disabled={selectedImages.length < 2 || isExporting}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:opacity-95 text-white text-xs font-bold shadow-lg shadow-purple-600/30 active:scale-95 transition disabled:opacity-40 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Add to Post</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
