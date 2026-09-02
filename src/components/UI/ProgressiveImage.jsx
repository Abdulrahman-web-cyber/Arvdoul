import React, { useState, useEffect, useRef } from "react";

/**
 * ProgressiveImage - Smooth blur-up placeholder & progressive image loader
 * Renders an instant blur shimmer placeholder while decoding high-resolution images.
 */
export default function ProgressiveImage({
  src,
  placeholderSrc,
  alt = "",
  className = "",
  containerClassName = "",
  aspectRatio,
  onClick,
  referrerPolicy = "no-referrer",
  loading = "lazy",
  fallbackSrc = "/assets/default-profile.png",
  ...props
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    setIsLoaded(false);
    setError(false);
    if (!src) return;

    // Pre-check if image is already cached in browser memory
    const img = new Image();
    img.src = src;
    if (img.complete && img.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [src]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setError(true);
  };

  const currentSrc = error ? fallbackSrc : (src || fallbackSrc);

  return (
    <div
      className={`relative overflow-hidden bg-gray-100 dark:bg-gray-800 ${containerClassName}`}
      style={aspectRatio ? { aspectRatio } : undefined}
      onClick={onClick}
    >
      {/* Low-res Blur Shimmer Placeholder */}
      {!isLoaded && (
        <div
          className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse"
          style={
            placeholderSrc
              ? {
                  backgroundImage: `url(${placeholderSrc})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: "blur(12px)",
                  transform: "scale(1.05)",
                }
              : undefined
          }
        />
      )}

      {/* High-Res Target Image */}
      {src && (
        <img
          ref={imgRef}
          src={currentSrc}
          alt={alt}
          loading={loading}
          referrerPolicy={referrerPolicy}
          onLoad={handleLoad}
          onError={handleError}
          className={`w-full h-full object-cover transition-all duration-300 ${
            isLoaded ? "opacity-100 filter-none" : "opacity-0 filter blur-sm"
          } ${className}`}
          {...props}
        />
      )}
    </div>
  );
}
