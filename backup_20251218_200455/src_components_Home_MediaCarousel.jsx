import PropTypes from 'prop-types';
import { useState, useEffect, useRef } from "react";
import { useTheme } from "@context/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";

export default function MediaCarousel({
  media = [],
  onSlideChange = () => {},
  autoplay = false,
  interval = 5000,
}) {
  const [current, setCurrent] = useState(0);
  const { theme } = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const carouselRef = useRef(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const videoRefs = useRef([]);

  \/\/ Notify parent of slide change & control video playback
  useEffect(() => {
    onSlideChange(current);
    videoRefs.current.forEach((vid, idx) => {
      if (vid) idx === current ? vid.play() : vid.pause();
    });
  }, [current, onSlideChange]);

  \/\/ Autoplay
  useEffect(() => {
    if (!autoplay || media.length <= 1) return;
    if (isHovered) return;
    const timer = setInterval(
      () => setCurrent((prev) => (prev + 1) % media.length),
      interval,
    );
    return () => clearInterval(timer);
  }, [autoplay, interval, media.length, isHovered]);

  if (!media.length) return null;

  const next = () => setCurrent((current + 1) % media.length);
  const prev = () => setCurrent((current - 1 + media.length) % media.length);

  \/\/ Swipe gestures
  const onTouchStart = (e) => (touchStartX.current = e.touches[0].clientX);
  const onTouchMove = (e) => (touchEndX.current = e.touches[0].clientX);
  const onTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
  };

  return (
    <div
      ref={carouselRef}
      className="relative w-full overflow-hidden rounded-lg bg-black"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <AnimatePresence initial={false}>
        {media.map(
          (item, index) =>
            index === current && (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 w-full flex items-center justify-center"
                style={{
                  aspectRatio:
                    item.width && item.height
                      ? `${item.width}/${item.height}`
                      : "16/9",
                }}
              >
                {item.type === "video" ? (
                  <video
                    ref={(el) => (videoRefs.current[index] = el)}
                    src={item.url}
                    controls
                    muted
                    loop
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src={item.url}
                    alt={`media-${index}`}
                    className="w-full h-full object-contain"
                  />
                )}
              </motion.div>
            ),
        )}
      </AnimatePresence>

      {media.length > 1 && (
        <>
          {/* Navigation */}
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition"
            aria-label="Previous media"
          >
            ◀
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition"
            aria-label="Next media"
          >
            ▶
          </button>

          {/* Dots */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
            {media.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2 h-2 rounded-full transition-all focus:outline-none ${
                  i === current
                    ? theme === "dark"
                      ? "bg-white"
                      : "bg-gray-900"
                    : "bg-gray-400/50"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
