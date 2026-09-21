// src/components/profile/AvatarUploadModal.jsx

import React, { memo, useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, ZoomIn, ZoomOut, Check, Trash2, Camera, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getCroppedImg } from '../../utils/cropImage';
import { toast } from 'sonner';

const AvatarUploadModal = memo(({
  isOpen,
  onClose,
  onUpload,
  onRemoveAvatar,
  currentAvatarUrl,
  theme = 'light',
}) => {
  const isDark = theme === 'dark';
  const fileInputRef = useRef(null);

  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPEG, PNG, WebP)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be under 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSaveCrop = useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    setIsProcessing(true);
    try {
      const croppedFile = await getCroppedImg(imageSrc, croppedAreaPixels, 512);
      await onUpload(croppedFile);
      toast.success('Avatar updated successfully!');
      handleClose();
    } catch (err) {
      console.error('Error cropping/uploading image:', err);
      toast.error('Failed to process avatar. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [imageSrc, croppedAreaPixels, onUpload]);

  const handleRemove = useCallback(async () => {
    if (!onRemoveAvatar) return;
    setIsProcessing(true);
    try {
      await onRemoveAvatar();
      toast.success('Avatar reset to default');
      handleClose();
    } catch (err) {
      toast.error('Failed to remove avatar');
    } finally {
      setIsProcessing(false);
    }
  }, [onRemoveAvatar]);

  const handleClose = useCallback(() => {
    setImageSrc(null);
    setZoom(1);
    setCrop({ x: 0, y: 0 });
    setIsProcessing(false);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className={cn(
            'relative w-full max-w-md rounded-3xl p-6 shadow-2xl z-10 overflow-hidden',
            isDark
              ? 'bg-[#0d1424] border border-white/10 text-white'
              : 'bg-white border border-slate-200 text-slate-900'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200/60 dark:border-white/10">
            <div>
              <h3 className="text-lg font-bold">Profile Photo</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Crop & position your avatar (1:1 circular)
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Body */}
          <div className="py-4 space-y-4">
            {imageSrc ? (
              /* Cropper View */
              <div className="space-y-4">
                <div className="relative w-full h-72 rounded-2xl overflow-hidden bg-black/90 shadow-inner">
                  <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    cropShape="round"
                    showGrid={false}
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                  />
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center gap-3 px-2">
                  <ZoomOut className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.05}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-full accent-purple-600 h-1.5 bg-slate-200 dark:bg-white/10 rounded-lg cursor-pointer"
                    aria-label="Zoom avatar"
                  />
                  <ZoomIn className="w-4 h-4 text-slate-400 shrink-0" />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Choose Different</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-4 py-2.5 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCrop}
                      disabled={isProcessing}
                      className="px-5 py-2.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 shadow-md transition-opacity flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Apply Photo</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Initial Selection View */
              <div className="space-y-4 text-center py-2">
                <div className="relative w-32 h-32 mx-auto rounded-full overflow-hidden p-1 bg-gradient-to-tr from-[#B416DB] via-[#4B6BFF] to-[#0EA3E6] shadow-xl">
                  <div className="w-full h-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    {currentAvatarUrl ? (
                      <img
                        src={currentAvatarUrl}
                        alt="Current Avatar"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Camera className="w-10 h-10 text-slate-400" />
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-semibold">Upload a high-resolution photo</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Supports JPG, PNG, WebP up to 10MB
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 px-4 rounded-2xl font-semibold text-sm text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:opacity-95 shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Select from Device</span>
                  </button>

                  {currentAvatarUrl && onRemoveAvatar && (
                    <button
                      type="button"
                      onClick={handleRemove}
                      disabled={isProcessing}
                      className="w-full py-2.5 px-4 rounded-2xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Revert to Default Avatar</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
});

AvatarUploadModal.displayName = 'AvatarUploadModal';
export default AvatarUploadModal;
