import PropTypes from "prop-types";
import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { cn } from "../../lib/utils";

export default function SwipableMedia({
media = [],
autoplay = false,
interval = 5000,
}) {
const { theme } = useTheme();
const [index, setIndex] = useState(0);
const [muted, setMuted] = useState(true);
const total = media.length;
const touchStartX = useRef(0);
const touchEndX = useRef(0);
const autoplayRef = useRef(null);
const containerRef = useRef(null);
const videoRefs = useRef([]);

// ---------------- Autoplay ----------------
const startAutoplay = useCallback(() => {
if (!autoplay || total <= 1) return;
autoplayRef.current = setInterval(() => {
setIndex((prev) => (prev + 1) % total);
}, interval);
}, [autoplay, interval, total]);

const stopAutoplay = () => clearInterval(autoplayRef.current);

// ---------------- Intersection Observer ----------------
useEffect(() => {
const observer = new IntersectionObserver(
([entry]) => {
if (entry.isIntersecting) startAutoplay();
else stopAutoplay();
},
{ threshold: 0.5 }
);
if (containerRef.current) observer.observe(containerRef.current);
return () => observer.disconnect();
}, [startAutoplay]);

// ---------------- Swipe Handlers ----------------
const handleSwipe = (dir) => {
stopAutoplay();
if (dir === "next") setIndex((prev) => (prev + 1) % total);
if (dir === "prev") setIndex((prev) => (prev - 1 + total) % total);
startAutoplay();
};

const onTouchStart = (e) => (touchStartX.current = e.touches[0].clientX);
const onTouchMove = (e) => (touchEndX.current = e.touches[0].clientX);
const onTouchEnd = () => {
const diff = touchStartX.current - touchEndX.current;
if (Math.abs(diff) > 50) diff > 0 ? handleSwipe("next") : handleSwipe("prev");
};

// ---------------- Video Control ----------------
useEffect(() => {
videoRefs.current.forEach((vid, i) => {
if (!vid) return;
i === index ? vid.play().catch(() => {}) : vid.pause();
});
}, [index]);

if (!media.length) return null;

return (
<div
ref={containerRef}
className="relative w-full overflow-hidden rounded-lg bg-black"
onTouchStart={onTouchStart}
onTouchMove={onTouchMove}
onTouchEnd={onTouchEnd}
tabIndex={0}
onKeyDown={(e) => {
if (e.key === "ArrowLeft") handleSwipe("prev");
if (e.key === "ArrowRight") handleSwipe("next");
}}
>
<AnimatePresence initial={false}>
{media.map((item, i) =>
i === index ? (
<motion.div
key={i}
initial={{ opacity: 0, x: 50 }}
animate={{ opacity: 1, x: 0 }}
exit={{ opacity: 0, x: -50 }}
transition={{ duration: 0.3 }}
className="w-full relative"
>
{item.type === "video" ? (
<video
ref={(el) => (videoRefs.current[i] = el)}
src={item.url}
className="w-full object-cover aspect-[4/5] rounded-lg"
muted={muted}
loop
playsInline
preload="metadata"
/>
) : (
<img
src={item.url}
alt={`Post media ${i + 1}}
className="w-full object-cover aspect-[4/5] rounded-lg"
loading="lazy"
/>
)}

{/* Video mute toggle */}  
          {item.type === "video" && (  
            <button  
              onClick={() => setMuted((prev) => !prev)}  
              className={cn(  
                "absolute bottom-3 right-3 p-2 rounded-full bg-black/50 text-white",  
                theme === "dark" ? "bg-gray-700/50" : "bg-white/30 text-black"  
              )}  
              aria-label={muted ? "Unmute video" : "Mute video"}  
            >  
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}  
            </button>  
          )}  
        </motion.div>  
      ) : null  
    )}  
  </AnimatePresence>  

  {total > 1 && (  
    <>  
      {/* Navigation Arrows */}  
      <button  
        onClick={() => handleSwipe("prev")}  
        className={cn(  
          "absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition hover:scale-110",  
          theme === "dark" ? "bg-gray-700 text-white" : "bg-white/60 text-gray-900"  
        )}  
        aria-label="Previous media"  
      >  
        <ChevronLeft size={20} />  
      </button>  
      <button  
        onClick={() => handleSwipe("next")}  
        className={cn(  
          "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition hover:scale-110",  
          theme === "dark" ? "bg-gray-700 text-white" : "bg-white/60 text-gray-900"  
        )}  
        aria-label="Next media"  
      >  
        <ChevronRight size={20} />  
      </button>  

      {/* Progress Dots */}  
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">  
        {media.map((_, i) => (  
          <span  
            key={i}  
            className={cn(  
              "w-2 h-2 rounded-full transition-all",  
              i === index ? "bg-white" : "bg-white/50"  
            )}  
          />  
        ))}  
      </div>  
    </>  
  )}  
</div>

);
}

SwipableMedia.propTypes = {
media: PropTypes.arrayOf(
PropTypes.shape({
url: PropTypes.string.isRequired,
type: PropTypes.string, // "image" | "video"
})
),
autoplay: PropTypes.bool,
interval: PropTypes.number,
};