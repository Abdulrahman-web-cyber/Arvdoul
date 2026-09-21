// src/components/profile/ProfileQRScannerModal.jsx

import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, 
  Camera, 
  Upload, 
  Search, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ScanLine, 
  RefreshCw,
  UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { getUserService } from '../../services/userService';

const ProfileQRScannerModal = memo(({
  isOpen,
  onClose,
  theme = 'light',
}) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const fileInputRef = useRef(null);

  const [activeMode, setActiveMode] = useState('camera'); // 'camera', 'upload', 'manual'
  const [cameraAllowed, setCameraAllowed] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [scannedResult, setScannedResult] = useState(null);

  // Stop camera helper
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Parse QR string into a target user identifier.
  // Canonical links are /profile/<handle>; the explicit uid param wins because
  // it is immutable, while <handle> may be a username.
  const parseQRContent = useCallback((rawText) => {
    if (!rawText) return null;
    const text = String(rawText).trim();

    // 1. Explicit immutable user id param
    const uidMatch = text.match(/[?&](?:uid|gid)=([^&#]+)/);
    if (uidMatch && uidMatch[1]) return decodeURIComponent(uidMatch[1]);

    // 2. Arvdoul web link: https://arvdoul.app/profile/username or /profile/uid
    const webProfileMatch = text.match(/\/profile\/([^?&#/]+)/);
    if (webProfileMatch && webProfileMatch[1]) return decodeURIComponent(webProfileMatch[1]);

    // 3. Username param
    const uMatch = text.match(/[?&]u=([^&#]+)/);
    if (uMatch && uMatch[1]) return decodeURIComponent(uMatch[1]);

    // 4. Deep link: arvdoul://user/:id
    const deepLinkMatch = text.match(/arvdoul:\/\/user\/([^?&#/]+)/);
    if (deepLinkMatch && deepLinkMatch[1]) return decodeURIComponent(deepLinkMatch[1]);

    // 5. Global ARV identifier: ARV-XYZ123
    const arvMatch = text.match(/^ARV-([a-zA-Z0-9_-]+)/i);
    if (arvMatch && arvMatch[1]) return arvMatch[1];

    // 6. Handle starting with @
    if (text.startsWith('@')) return text.slice(1);

    // 7. Direct alphanumeric username/uid
    if (/^[a-zA-Z0-9_.-]{3,64}$/.test(text)) return text;

    return null;
  }, []);

  // Handle successful detection
  const handleDetected = useCallback(async (targetIdOrUsername) => {
    if (isProcessing) return;
    setIsProcessing(true);
    stopCamera();

    toast.success(`QR Code detected! Loading profile...`);

    // Fetch user to verify profile
    try {
      const userService = getUserService();
      let targetProfile = null;

      // Try fetching by userId or username
      targetProfile = await userService.getUserProfile(targetIdOrUsername).catch(() => null);
      if (!targetProfile) {
        targetProfile = await userService.getUserByUsername(targetIdOrUsername).catch(() => null);
      }

      const finalId = targetProfile?.id || targetProfile?.uid || targetIdOrUsername;
      setScannedResult({
        id: finalId,
        username: targetProfile?.username || targetIdOrUsername,
        displayName: targetProfile?.displayName || targetIdOrUsername,
        photoURL: targetProfile?.photoURL || null,
      });

      // Navigate after brief confirmation
      setTimeout(() => {
        onClose();
        navigate(`/profile/${finalId}`);
      }, 900);
    } catch (e) {
      // Direct navigation fallback
      setTimeout(() => {
        onClose();
        navigate(`/profile/${targetIdOrUsername}`);
      }, 700);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, navigate, onClose, stopCamera]);

  // Real-time camera scanner loop
  const startScanningLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
    let detector = null;

    if (hasBarcodeDetector) {
      try {
        detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) {
        detector = null;
      }
    }

    const scanFrame = async () => {
      if (!video || video.readyState < 2 || isProcessing) {
        animFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      try {
        canvas.width = video.videoWidth || 300;
        canvas.height = video.videoHeight || 300;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        if (detector) {
          const barcodes = await detector.detect(canvas);
          if (barcodes && barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            const parsed = parseQRContent(rawValue);
            if (parsed) {
              handleDetected(parsed);
              return;
            }
          }
        }
      } catch (e) {
        // Frame scan drop
      }

      animFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameRef.current = requestAnimationFrame(scanFrame);
  }, [handleDetected, isProcessing, parseQRContent]);

  // Start camera stream
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    setCameraAllowed(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not supported on this device');
      setCameraAllowed(false);
      setActiveMode('manual');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraAllowed(true);
      startScanningLoop();
    } catch (err) {
      console.warn('Camera request failed:', err);
      setCameraAllowed(false);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission was denied. You can upload a QR image or enter a username below.'
          : 'Unable to start camera. Please upload an image or type the username.'
      );
    }
  }, [startScanningLoop, stopCamera]);

  useEffect(() => {
    if (isOpen && activeMode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeMode, startCamera, stopCamera]);

  // File Upload scan handler
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const toastId = toast.loading('Reading QR code from image...');

    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      URL.revokeObjectURL(objectUrl);

      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          const barcodes = await detector.detect(canvas);
          if (barcodes && barcodes.length > 0) {
            const parsed = parseQRContent(barcodes[0].rawValue);
            if (parsed) {
              toast.dismiss(toastId);
              handleDetected(parsed);
              return;
            }
          }
        } catch {}
      }

      // If browser detector failed or not available, prompt manual entry
      toast.dismiss(toastId);
      toast.info('Could not automatically parse QR code. Please enter the username or ID below.');
      setActiveMode('manual');
    } catch (e) {
      toast.error('Failed to process image file', { id: toastId });
    } finally {
      setIsProcessing(false);
      if (event.target) event.target.value = '';
    }
  };

  // Manual lookup handler
  const handleManualSubmit = (e) => {
    e?.preventDefault();
    if (!manualInput.trim()) {
      toast.error('Please enter a username or Arvdoul ID');
      return;
    }
    const parsed = parseQRContent(manualInput.trim());
    if (parsed) {
      handleDetected(parsed);
    } else {
      toast.error('Invalid format. Please enter a valid username or ID');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div 
        className={cn(
          "relative w-full max-w-sm rounded-3xl p-6 border shadow-2xl transition-all overflow-hidden",
          isDark 
            ? "bg-[#0c1222] border-white/10 text-white shadow-[0_16px_50px_rgba(0,0,0,0.6)]" 
            : "bg-white border-slate-200 text-slate-900 shadow-[0_16px_50px_rgba(0,0,0,0.12)]"
        )}
      >
        {/* Close Button */}
        <button
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-white z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-4">
          <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/25">
            <ScanLine className="w-6 h-6 animate-pulse" />
          </div>
          <h3 className="text-lg font-bold">Scan Profile QR Code</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Scan another user's Arvdoul code to instantly open their profile
          </p>
        </div>

        {/* Mode Selector Switch */}
        <div className="flex p-1 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 mb-4">
          <button
            type="button"
            onClick={() => setActiveMode('camera')}
            className={cn(
              "flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all",
              activeMode === 'camera'
                ? "bg-white dark:bg-[#1a233a] text-purple-600 dark:text-purple-400 shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera</span>
          </button>

          <button
            type="button"
            onClick={() => {
              stopCamera();
              setActiveMode('upload');
              fileInputRef.current?.click();
            }}
            className={cn(
              "flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all",
              activeMode === 'upload'
                ? "bg-white dark:bg-[#1a233a] text-purple-600 dark:text-purple-400 shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>

          <button
            type="button"
            onClick={() => {
              stopCamera();
              setActiveMode('manual');
            }}
            className={cn(
              "flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all",
              activeMode === 'manual'
                ? "bg-white dark:bg-[#1a233a] text-purple-600 dark:text-purple-400 shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Username</span>
          </button>
        </div>

        {/* Hidden File Input for Image Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Hidden processing Canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* 1. Camera Viewfinder */}
        {activeMode === 'camera' && (
          <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black mb-4 border border-purple-500/20 shadow-inner flex items-center justify-center">
            {cameraAllowed ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Optical Reticle Frame */}
                <div className="absolute inset-8 pointer-events-none">
                  {/* Corners */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-purple-500 rounded-tl-xl" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-purple-500 rounded-tr-xl" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-purple-500 rounded-bl-xl" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-purple-500 rounded-br-xl" />

                  {/* Animated Laser Sweep */}
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#38bdf8] animate-[bounce_2.5s_ease-in-out_infinite]" />
                </div>

                <div className="absolute bottom-2 inset-x-0 text-center pointer-events-none">
                  <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-medium text-white/90">
                    Align QR code within the frame
                  </span>
                </div>
              </>
            ) : cameraError ? (
              <div className="p-5 text-center space-y-3">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                <p className="text-xs text-slate-400 leading-relaxed">
                  {cameraError}
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 text-white flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Camera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMode('manual')}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 text-white"
                  >
                    Type Username
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                <span className="text-xs">Requesting camera access...</span>
              </div>
            )}
          </div>
        )}

        {/* 2. Upload Mode View */}
        {activeMode === 'upload' && (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-full aspect-square rounded-2xl border-2 border-dashed border-purple-500/30 hover:border-purple-500 p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-purple-500/5 mb-4 group"
          >
            <div className="w-14 h-14 rounded-2xl bg-purple-600/10 text-purple-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <Upload className="w-7 h-7" />
            </div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Select QR Code Image
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-[200px]">
              Tap to browse photos or screenshots of an Arvdoul QR code
            </span>
          </div>
        )}

        {/* 3. Manual Input Mode */}
        {activeMode === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-4 mb-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Enter Arvdoul Username or Global ID
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="e.g., alex_creator or ARV-123"
                  className={cn(
                    "w-full pl-10 pr-3 py-2.5 rounded-2xl text-xs sm:text-sm font-medium border outline-none",
                    isDark
                      ? "bg-white/5 border-white/10 focus:border-purple-500 text-white placeholder-slate-500"
                      : "bg-slate-50 border-slate-200 focus:border-purple-600 text-slate-900 placeholder-slate-400"
                  )}
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isProcessing || !manualInput.trim()}
              className="w-full py-2.5 rounded-2xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25 hover:opacity-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <UserCheck className="w-4 h-4" />
              <span>Find & Open Profile</span>
            </button>
          </form>
        )}

        {/* Scanned Result Banner */}
        {scannedResult && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 animate-fade-in mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="truncate">
              <div className="text-xs font-bold text-emerald-500 truncate">
                Found {scannedResult.displayName}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                Opening profile @{scannedResult.username}...
              </div>
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="text-center">
          <span className="text-[10px] text-slate-400">
            Powered by Arvdoul Global Universal Identity Matrix
          </span>
        </div>
      </div>
    </div>
  );
});

ProfileQRScannerModal.displayName = 'ProfileQRScannerModal';

export default ProfileQRScannerModal;
