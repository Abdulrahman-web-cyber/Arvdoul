/**
 * src/components/profile/AvatarUploadModal.jsx - ARVDOUL Avatar Upload Modal Component
 * 
 * Modal for uploading and editing user avatar with real-time progress tracking.
 * Uses storageService.uploadFileWithProgress() for reliable uploads.
 * 
 * @component
 */

import React, { memo, useCallback, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Camera, ZoomIn, ZoomOut, RotateCw, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTheme } from '../../context/ThemeContext';

/**
 * AvatarUploadModal Component
 * @param {Object} props
 * @param {boolean} props.isOpen - Modal visibility
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onUpload - Upload completion handler (receives downloadURL)
 * @param {string} props.currentAvatar - Current avatar URL
 * @param {string} props.userId - User ID for upload path
 * @param {string} props.theme - Theme (light/dark)
 */
const AvatarUploadModal = ({
  isOpen = false,
  onClose,
  onUpload,
  currentAvatar = null,
  userId,
  theme = 'light',
}) => {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // ARVDOUL DNA Gradient
  const gradientPrimary = 'linear-gradient(135deg, #B416DB 0%, #872FE2 35%, #4B6BFF 70%, #0EA3E6 100%)';
  const buttonGradient = 'linear-gradient(135deg, #B416DB 0%, #872FE2 50%, #4B6BFF 100%)';

  // Handle file selection
  const handleFileSelect = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setError(null);
    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
  }, []);

  // Handle drop
  const handleDrop = useCallback((event) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer?.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please drop an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setError(null);
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result);
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    };
    reader.readAsDataURL(file);
  }, []);

  // Handle zoom
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

  // Handle drag for position
  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((event) => {
    if (!isDragging) return;
    setPosition((prev) => ({
      x: prev.x + event.movementX,
      y: prev.y + event.movementY,
    }));
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle upload
  const handleUpload = useCallback(async () => {
    if (!selectedFile || !userId) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Dynamic import of storage service
      const { uploadFileWithProgress } = await import('../../services/storageService.js');

      const result = await uploadFileWithProgress(selectedFile, `avatars/${userId}`, {
        compressImages: true,
        maxSize: 2 * 1024 * 1024,
        userId,
        onProgress: (progress) => {
          setUploadProgress(progress.progress || 0);
        },
      });

      const downloadURL = result.url || result.downloadURL;

      if (!downloadURL) {
        throw new Error('Upload failed - no URL returned');
      }

      // Update user profile with new avatar
      const { updateUserProfile } = await import('../../services/userService.js');
      await updateUserProfile(userId, { photoURL: downloadURL });

      // Call completion handler
      if (onUpload) {
        onUpload(downloadURL);
      }

      // Reset and close
      setSelectedFile(null);
      setPreview(null);
      setUploadProgress(0);
      onClose?.();
    } catch (err) {
      console.error('❌ Avatar upload failed:', err);
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, userId, onUpload, onClose]);

  // Handle close
  const handleClose = useCallback(() => {
    if (isUploading) return;
    setSelectedFile(null);
    setPreview(null);
    setError(null);
    setUploadProgress(0);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    onClose?.();
  }, [isUploading, onClose]);

  // Handle cancel selection
  const handleCancel = useCallback(() => {
    setSelectedFile(null);
    setPreview(null);
    setError(null);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Don't render if not open
  if (!isOpen) return null;

  // Render modal content
  const modalContent = (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        'bg-black/60 backdrop-blur-sm',
        'animate-in fade-in duration-200'
      )}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-upload-title"
    >
      <div
        className={cn(
          'w-full max-w-md rounded-3xl overflow-hidden',
          'bg-white dark:bg-gray-900',
          'shadow-2xl',
          'transform transition-all'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2
            id="avatar-upload-title"
            className="text-xl font-bold text-gray-900 dark:text-white text-center"
          >
            Update Profile Picture
          </h2>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className={cn(
              'absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full',
              'hover:bg-gray-100 dark:hover:bg-gray-800',
              'transition-colors',
              isUploading && 'opacity-50 cursor-not-allowed'
            )}
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Preview Area */}
          <div
            className={cn(
              'relative w-48 h-48 mx-auto mb-6 rounded-full overflow-hidden',
              'bg-gray-100 dark:bg-gray-800',
              'border-4 border-dashed border-gray-300 dark:border-gray-600'
            )}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add('border-purple-500');
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove('border-purple-500');
            }}
            onDrop={handleDrop}
          >
            {preview ? (
              <div
                className="w-full h-full cursor-move"
                style={{
                  backgroundImage: `url(${preview})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  transform: `scale(${zoom}) translate(${position.x / 50}px, ${position.y / 50}px)`,
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
            ) : currentAvatar ? (
              <img
                src={currentAvatar}
                alt="Current avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <Camera className="w-12 h-12 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500 text-center px-4">
                  Drop an image here or click to select
                </p>
              </div>
            )}
          </div>

          {/* Zoom Controls */}
          {preview && (
            <div className="flex items-center justify-center gap-4 mb-6">
              <button
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className={cn(
                  'p-2 rounded-full',
                  'bg-gray-100 dark:bg-gray-800',
                  'hover:bg-gray-200 dark:hover:bg-gray-700',
                  'transition-colors',
                  zoom <= 0.5 && 'opacity-50 cursor-not-allowed'
                )}
                aria-label="Zoom out"
              >
                <ZoomOut className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400 min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className={cn(
                  'p-2 rounded-full',
                  'bg-gray-100 dark:bg-gray-800',
                  'hover:bg-gray-200 dark:hover:bg-gray-700',
                  'transition-colors',
                  zoom >= 3 && 'opacity-50 cursor-not-allowed'
                )}
                aria-label="Zoom in"
              >
                <ZoomIn className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={() => {
                  setZoom(1);
                  setPosition({ x: 0, y: 0 });
                }}
                className={cn(
                  'p-2 rounded-full',
                  'bg-gray-100 dark:bg-gray-800',
                  'hover:bg-gray-200 dark:hover:bg-gray-700',
                  'transition-colors'
                )}
                aria-label="Reset position"
              >
                <RotateCw className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="avatar-upload-input"
          />

          {/* Upload Button */}
          {!preview && (
            <label
              htmlFor="avatar-upload-input"
              className={cn(
                'flex items-center justify-center gap-2 w-full py-3 rounded-xl',
                'text-white font-semibold cursor-pointer',
                'transition-all hover:scale-[1.02] active:scale-[0.98]'
              )}
              style={{ background: buttonGradient }}
            >
              <Upload className="w-5 h-5" />
              Choose Photo
            </label>
          )}

          {/* Selected File Info */}
          {selectedFile && !preview && (
            <div className="mt-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
              <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Uploading...
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {Math.round(uploadProgress)}%
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${uploadProgress}%`,
                    background: gradientPrimary,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex gap-3">
          {preview ? (
            <>
              <button
                onClick={handleCancel}
                disabled={isUploading}
                className={cn(
                  'flex-1 py-3 rounded-xl font-semibold',
                  'bg-gray-100 dark:bg-gray-800',
                  'text-gray-700 dark:text-gray-300',
                  'hover:bg-gray-200 dark:hover:bg-gray-700',
                  'transition-colors',
                  isUploading && 'opacity-50 cursor-not-allowed'
                )}
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading || !selectedFile}
                className={cn(
                  'flex-1 py-3 rounded-xl font-semibold',
                  'text-white',
                  'transition-all hover:scale-[1.02] active:scale-[0.98]',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100'
                )}
                style={{ background: buttonGradient }}
              >
                {isUploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Check className="w-5 h-5" />
                    Upload
                  </span>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={handleClose}
              className={cn(
                'flex-1 py-3 rounded-xl font-semibold',
                'bg-gray-100 dark:bg-gray-800',
                'text-gray-700 dark:text-gray-300',
                'hover:bg-gray-200 dark:hover:bg-gray-700',
                'transition-colors'
              )}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // Portal to body
  return createPortal(modalContent, document.body);
};

export default memo(AvatarUploadModal);
