import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@context/ThemeContext";
import ThemeToggle from "@components/Shared/ThemeToggle";
import { motion, useReducedMotion } from "framer-motion";

export default function IntroScreen() {
const navigate = useNavigate();
const { theme, systemTheme } = useTheme();
const resolvedTheme = theme === "system" ? systemTheme : theme;
const prefersReducedMotion = useReducedMotion();

const logoSrc =
resolvedTheme === "dark" ? "/logo/logo-dark.png" : "/logo/logo-light.png";

// Background style
const backgroundStyle = useMemo(
() => ({
background:
resolvedTheme === "dark"
? "radial-gradient(1200px 800px at 50% 100%, #0a0f1c 0%, #05070d 60%, #03040a 100%)"
: "radial-gradient(1200px 800px at 50% 100%, #f9fafb 0%, #e2e8f0 55%, #e5e7eb 100%)",
}),
[resolvedTheme]
);

// Keyboard shortcuts
useEffect(() => {
const onKey = (e) => {
if (e.key === "Enter") navigate("/signup/step1");
if (e.key.toLowerCase() === "l") navigate("/login");
};
window.addEventListener("keydown", onKey);
return () => window.removeEventListener("keydown", onKey);
}, [navigate]);

// Floating blobs
const [blobs] = useState(() =>
Array.from({ length: 12 }, (_, i) => ({
id: i,
x: Math.random() * 100,
y: Math.random() * 100,
size: Math.random() * 80 + 120,
duration: Math.random() * 18 + 12,
opacity: Math.random() * 0.2 + 0.08,
}))
);

// Feature cards with emojis
const features = [
{ emoji: "⚡", title: "Real-time Interactions", desc: "Instant chat & updates." },
{ emoji: "🎨", title: "Creator-first Tools", desc: "Empower your content creation." },
{ emoji: "🔒", title: "Privacy Controls", desc: "Full control of your data." },
{ emoji: "🖌️", title: "Modern UI/UX", desc: "Minimal, intuitive & elegant." },
{ emoji: "🚀", title: "Optimized Performance", desc: "Lightning fast & smooth." },
{ emoji: "🌙", title: "Native Dark Mode", desc: "Beautiful in any theme." },
];

return (
<div
className="relative w-full min-h-screen flex flex-col items-center justify-center px-6" 
style={backgroundStyle}
>
{/* Floating blobs */}
{!prefersReducedMotion && (
<div className="absolute inset-0 overflow-hidden">
{blobs.map((b) => (
<motion.div
key={b.id}
className="absolute rounded-full"
style={{
top: `${b.y}%`,
left: `${b.x}%`,
width: b.size,
height: b.size,
background:
resolvedTheme === "dark"
? "linear-gradient(145deg, rgba(99,102,241,0.14), rgba(167,139,250,0.1))"
: "linear-gradient(145deg, rgba(99,102,241,0.18), rgba(167,139,250,0.12))",
filter: "blur(25px)",
opacity: b.opacity,
}}
animate={{ x: [0, 18, -18, 0], y: [0, -14, 14, 0] }}
transition={{
duration: b.duration,
repeat: Infinity,
ease: "easeInOut",
delay: b.id * 0.25,
}}
aria-hidden="true"
/>
))}
</div>
)}

{/* Theme toggle */}
  <div className="absolute top-5 right-5 z-30">
    <ThemeToggle variant="icon" />
  </div>

  {/* Main content */}
  <motion.main
    className="relative z-20 w-full max-w-5xl text-center overflow-hidden sm:overflow-auto"
    initial={{ opacity: 0, y: 25 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.7, ease: "easeOut" }}
  >
    {/* Circular logo */}
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }} 
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
      className="mx-auto w-32 h-32 rounded-full overflow-hidden shadow-xl ring-4 ring-primary-500/40 mb-6 bg-white dark:bg-gray-900"
    >
      <img
        src={logoSrc}
        alt="Arvdoul Logo"
        className="w-full h-full object-contain select-none"
        draggable="false"
      />
    </motion.div>

    {/* Headline */}
    <motion.h1
      className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white"  
      initial={{ y: 14, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.1, duration: 0.55 }}
    >
      Welcome to{" "}
      <span className="text-primary-600 dark:text-primary-400 drop-shadow-md">
        Arvdoul
      </span>
    </motion.h1>

    {/* Subheadline */}
    <motion.p
      className="mt-4 text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto"
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.55 }}
    >
      A refined social space for creators and communities ✨—fast, elegant, and crafted for the future.
    </motion.p>

    {/* Feature cards */}
    <motion.div
      className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.35, duration: 0.55 }}
    >
      {features.map((f, i) => (
        <motion.div
          key={i}
          whileHover={{ y: -6, scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          className="rounded-2xl p-6 shadow-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition cursor-default"
        >
          <h3 className="font-semibold text-lg mb-2">
            <span className="mr-2">{f.emoji}</span>
            <span className="text-gray-900 dark:text-gray-100">{f.title}</span>
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{f.desc}</p>
        </motion.div>
      ))}
    </motion.div>

    {/* CTA buttons */}
    <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-5"> 
      <motion.button
        whileHover={{ scale: prefersReducedMotion ? 1 : 1.05 }}
        whileTap={{ scale: prefersReducedMotion ? 1 : 0.97 }}
        onClick={() => navigate("/signup/step1")}
        className="w-full sm:w-56 px-6 py-4 rounded-xl font-semibold text-white shadow-lg bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 transition"
      >
         Get Started
      </motion.button>

      <motion.button
        whileHover={{ scale: prefersReducedMotion ? 1 : 1.05 }}
        whileTap={{ scale: prefersReducedMotion ? 1 : 0.97 }}
        onClick={() => navigate("/login")}  
        className="w-full sm:w-56 px-6 py-4 rounded-xl font-semibold border border-primary-600/70 dark:border-primary-400/70 text-primary-700 dark:text-primary-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-md transition"
      >
         Sign In
      </motion.button>
    </div>

    {/* Hints */}
    <p className="mt-6 text-xs text-gray-500 dark:text-gray-400">
      Press{" "}
      <kbd className="px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded">
        Enter
      </kbd>{" "}
      to Get Started or{" "}
      <kbd className="px-1.5 py-0.5 bg-black/5 dark:bg-white/10 rounded">
        L
      </kbd>{" "}
      to Sign In
    </p>
  </motion.main>

  {/* Footer */}
  <footer className="relative z-20 mt-16 py-6 flex items-center justify-center">
    <div className="px-5 py-2 rounded-full text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm">
      © {new Date().getFullYear()} Arvdoul — crafted for creators
    </div>
  </footer>
</div>

);
}