/**
 * src/components/profile/AvatarUploadModal.jsx - ARVDOUL Avatar Upload Modal Component
 */
import React, { memo, useState, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { X, Upload, Camera } from 'lucide-react';

const AvatarUploadModal = memo(({
  isOpen,
  onClose,
  onUpload,
  theme = 'light',
}) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result);
      reader.readAsDataURL(file);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      await onUpload(selectedFile);
      onClose();
    } finally {
      setUploading(false);
    }
  }, [selectedFile, onUpload, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className={cn(
        'w-full max-w-md rounded-2xl p-6',
        'bg-white dark:bg-gray-900',
        'shadow-2xl'
      )}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Change Avatar
          </h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex justify-center mb-4">
          <div className="w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            {preview ? (
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Camera className="w-12 h-12 text-gray-400" />
              </div>
            )}
          </div>
        </div>
        
        <label className={cn(
          'flex items-center justify-center gap-2 w-full p-3 rounded-xl cursor-pointer',
          'bg-gradient-to-r from-purple-500 to-blue-500 text-white',
          'hover:opacity-90 transition-opacity'
        )}>
          <Upload className="w-5 h-5" />
          <span>Choose Photo</span>
          <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
        </label>
        
        {selectedFile && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className={cn(
              'w-full mt-4 p-3 rounded-xl font-medium text-white',
              'bg-gradient-to-r from-purple-500 to-blue-500',
              'disabled:opacity-50'
            )}
          >
            {uploading ? 'Uploading...' : 'Save'}
          </button>
        )}
      </div>
    </div>
  );
});

AvatarUploadModal.displayName = 'AvatarUploadModal';
export default AvatarUploadModal;
