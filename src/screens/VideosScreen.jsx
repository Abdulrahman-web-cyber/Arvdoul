import React, { useEffect, useRef, useState } from "react";

/**
 * VideosScreen — self-contained Arvdoul-level download/player component
 * Props:
 *   post: {
 *     id: string,
 *     title?: string,
 *     videoUrl?: string,    // remote url
 *     videoBlob?: Blob      // already-fetched blob (optional)
 *   }
 *
 * No external libs required.
 */

const VideosScreen = ({ post }) => {
  const videoRef = useRef(null);
  const controllerRef = useRef(null);
  const blobUrlRef = useRef(null);

  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [videoSrc, setVideoSrc] = useState(post?.videoUrl || null);

  useEffect(() => {
    // If a Blob was provided, create an object URL for the video player
    if (post?.videoBlob instanceof Blob) {
      const url = URL.createObjectURL(post.videoBlob);
      blobUrlRef.current = url;
      setVideoSrc(url);
    } else if (post?.videoUrl) {
      setVideoSrc(post.videoUrl);
    }

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      // Abort any ongoing fetch on unmount
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
    };
  }, [post]);

  // Tiny internal toast helper
  const showMessage = (txt, ms = 3000) => {
    setMessage(txt);
    setTimeout(() => setMessage(""), ms);
  };

  // Download helper using stream so we can show progress
  const fetchBlobWithProgress = async (url, onProgress, signal) => {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);

    const contentLength = res.headers.get("content-length");
    const total = contentLength ? parseInt(contentLength, 10) : null;
    if (!res.body || typeof res.body.getReader !== "function") {
      // Fallback: no streaming support
      const fallbackBlob = await res.blob();
      onProgress(100);
      return fallbackBlob;
    }

    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length || value.byteLength || 0;
      if (total) {
        onProgress(Math.floor((received / total) * 100));
      } else {
        // if total unknown, show indeterminate progression but provide some feedback
        onProgress(Math.min(99, Math.floor(received / (1024 * 250))));
      }
    }

    const contentType = res.headers.get("content-type") || "video/mp4";
    return new Blob(chunks, { type: contentType });
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    // Append, click, cleanup
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 500);
  };

  const handleDownload = async () => {
    if (!post) {
      showMessage("No post to download");
      return;
    }

    setDownloading(true);
    setProgress(0);

    try {
      // If Blob already present, use it directly
      if (post.videoBlob instanceof Blob) {
        downloadBlob(post.videoBlob, `${post.id}.mp4`);
        setProgress(100);
        showMessage("Download started");
        return;
      }

      if (!post.videoUrl) throw new Error("No video URL available");

      // Abort controller so user can cancel and cleanup on unmount
      const controller = new AbortController();
      controllerRef.current = controller;

      const blob = await fetchBlobWithProgress(
        post.videoUrl,
        (p) => setProgress(p),
        controller.signal
      );

      downloadBlob(blob, `${post.id}.mp4`);
      setProgress(100);
      showMessage("Download started");
    } catch (err) {
      if (err.name === "AbortError") {
        showMessage("Download cancelled");
      } else {
        console.error("Download error:", err);
        showMessage("Download failed");
      }
    } finally {
      setDownloading(false);
      // clear controller
      controllerRef.current = null;
      // small delay to keep progress visible at 100%
      setTimeout(() => setProgress(0), 800);
    }
  };

  const handleCancelDownload = () => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    setDownloading(false);
    setProgress(0);
  };

  const handleNativeShare = async () => {
    try {
      if (navigator.canShare && navigator.canShare({ url: post.videoUrl })) {
        await navigator.share({
          title: post.title || "Arvdoul Video",
          text: post.title || "",
          url: post.videoUrl,
        });
      } else if (navigator.share && post.videoUrl) {
        await navigator.share({
          title: post.title || "Arvdoul Video",
          url: post.videoUrl,
        });
      } else {
        // fallback: copy link to clipboard
        await navigator.clipboard.writeText(post.videoUrl || "");
        showMessage("Link copied to clipboard");
      }
    } catch (e) {
      console.error("Share failed:", e);
      showMessage("Share failed");
    }
  };

  return (
    <div className="w-full h-full bg-black text-white flex flex-col">
      <div className="w-full max-h-[72vh] flex items-center justify-center bg-black">
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            controls
            playsInline
            preload="metadata"
            className="w-full max-h-[72vh] object-contain bg-black"
          />
        ) : (
          <div className="p-6 text-center text-sm text-gray-300">
            No video available
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-3">
        <div className="flex gap-3">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className={`px-4 py-2 rounded-lg transition-transform active:scale-95 ${
              downloading ? "bg-gray-600 cursor-not-allowed" : "bg-blue-600"
            }`}
          >
            {downloading ? "Downloading…" : "Download"}
          </button>

          <button
            onClick={handleNativeShare}
            className="px-4 py-2 rounded-lg bg-neutral-700"
          >
            Share
          </button>

          {downloading && (
            <button
              onClick={handleCancelDownload}
              className="px-4 py-2 rounded-lg bg-red-600"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="w-full">
          <div className="h-2 bg-gray-800 rounded overflow-hidden">
            <div
              style={{ width: `${progress}%` }}
              className="h-full bg-gradient-to-r from-blue-500 to-green-400 transition-all"
            />
          </div>
          <div className="text-xs mt-1 text-gray-300">
            {progress > 0 ? `Progress: ${progress}%` : "Ready"}
          </div>
        </div>

        {message && (
          <div className="rounded p-2 bg-white/10 text-xs text-white max-w-max">
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideosScreen;
