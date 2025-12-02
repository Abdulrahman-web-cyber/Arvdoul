// src/screens/IntroScreen.jsx
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@context/ThemeContext";
import ThemeToggle from "@components/Shared/ThemeToggle";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { useUser } from "@context/UserContext";

// Particle system for background
const useParticleSystem = (count = 40) => {
  const [particles, setParticles] = useState([]);
  
  useEffect(() => {
    const newParticles = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 4 + 1,
      speed: Math.random() * 0.5 + 0.2,
      opacity: Math.random() * 0.3 + 0.1,
      delay: Math.random() * 5,
    }));
    setParticles(newParticles);
  }, [count]);

  return particles;
};

// Holographic grid background
const HolographicGrid = ({ theme }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dimensions.width) return;

    const ctx = canvas.getContext('2d');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    let time = 0;
    const gridSize = 60;
    const primaryColor = theme === 'dark' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(79, 70, 229, 0.08)';
    const secondaryColor = theme === 'dark' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(139, 92, 246, 0.06)';

    const drawGrid = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw grid lines
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 0.5;
      
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw animated nodes
      const nodeCount = 25;
      for (let i = 0; i < nodeCount; i++) {
        const x = (Math.sin(time * 0.0005 + i) * 0.5 + 0.5) * canvas.width;
        const y = (Math.cos(time * 0.0003 + i * 1.3) * 0.5 + 0.5) * canvas.height;
        const size = (Math.sin(time * 0.002 + i) * 0.5 + 0.5) * 6 + 2;
        
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
        gradient.addColorStop(0, secondaryColor);
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, size * 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = primaryColor;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      time += 16;
      animationRef.current = requestAnimationFrame(drawGrid);
    };

    drawGrid();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [dimensions, theme]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ 
        opacity: theme === 'dark' ? 0.4 : 0.2,
        mixBlendMode: theme === 'dark' ? 'screen' : 'multiply'
      }}
    />
  );
};

// Animated feature cards with enhanced interactions
const FeatureCard = ({ emoji, title, desc, index, theme, prefersReducedMotion }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), index * 100);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={isVisible ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ 
        duration: 0.6, 
        delay: index * 0.1,
        type: "spring",
        stiffness: 100
      }}
      whileHover={prefersReducedMotion ? {} : { 
        y: -8, 
        scale: 1.03,
        transition: { type: "spring", stiffness: 400, damping: 25 }
      }}
      whileTap={{ scale: 0.98 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative group cursor-pointer"
    >
      {/* Animated background gradient */}
      <motion.div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: theme === 'dark' 
            ? 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(168,85,247,0.05))'
            : 'linear-gradient(135deg, rgba(79,70,229,0.08), rgba(139,92,246,0.04))',
        }}
        animate={isHovered ? { scale: 1.05 } : { scale: 1 }}
      />
      
      {/* Main card */}
      <div className={`
        relative rounded-2xl p-6 backdrop-blur-sm border transition-all duration-300
        ${theme === 'dark' 
          ? 'bg-gray-900/60 border-gray-700/50 hover:border-indigo-500/30' 
          : 'bg-white/80 border-gray-200/60 hover:border-indigo-400/30'
        }
        shadow-lg hover:shadow-2xl
      `}>
        {/* Emoji with floating animation */}
        <motion.div
          className="text-2xl mb-3"
          animate={isHovered && !prefersReducedMotion ? { 
            y: [0, -4, 0],
            scale: [1, 1.1, 1]
          } : {}}
          transition={{ duration: 0.6, repeat: isHovered ? Infinity : 0 }}
        >
          {emoji}
        </motion.div>

        <h3 className="font-semibold text-lg mb-2 flex items-center">
          <span className={`${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>
            {title}
          </span>
        </h3>
        
        <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
          {desc}
        </p>

        {/* Hover indicator line */}
        <motion.div
          className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-full ${
            theme === 'dark' ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-gradient-to-r from-indigo-400 to-purple-400'
          }`}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </motion.div>
  );
};

// Main component
export default function IntroScreen() {
  const navigate = useNavigate();
  const { theme, systemTheme } = useTheme();
  const { user, loading } = useUser();
  const resolvedTheme = theme === "system" ? systemTheme : theme;
  const prefersReducedMotion = useReducedMotion();
  
  const [mounted, setMounted] = useState(false);
  const [activeFeature, setActiveFeature] = useState(null);
  const particles = useParticleSystem(30);

  useEffect(() => {
    setMounted(true);
    
    // Auto-rotate active feature for demo effect
    const interval = setInterval(() => {
      setActiveFeature(prev => prev === null ? 0 : (prev + 1) % features.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Enhanced keyboard shortcuts with more options
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === "Enter" || e.key === " ") navigate("/signup/step1");
      if (e.key.toLowerCase() === "l") navigate("/login");
      if (e.key.toLowerCase() === "h") navigate("/home");
      if (e.key === "Escape") {
        // Optional: Add some cool effect
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [navigate]);

  // Enhanced features with categories
  const features = [
    { 
      emoji: "⚡", 
      title: "Lightning Fast", 
      desc: "Real-time interactions with sub-second latency",
      category: "Performance"
    },
    { 
      emoji: "🎨", 
      title: "Creator Studio", 
      desc: "Advanced tools for content creation and monetization",
      category: "Creation"
    },
    { 
      emoji: "🔒", 
      title: "Quantum Encryption", 
      desc: "Military-grade security for your data and privacy",
      category: "Security"
    },
    { 
      emoji: "🤖", 
      title: "AI Assistant", 
      desc: "Smart content suggestions and automation",
      category: "Intelligence"
    },
    { 
      emoji: "🌐", 
      title: "Global Network", 
      desc: "Connect with creators worldwide instantly",
      category: "Connectivity"
    },
    { 
      emoji: "💫", 
      title: "Immersive Experience", 
      desc: "Next-gen UI with spatial interactions",
      category: "Experience"
    },
  ];

  // Background style with dynamic gradients
  const backgroundStyle = useMemo(() => ({
    background: resolvedTheme === "dark"
      ? "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.15) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 100% 100%, rgba(168,85,247,0.1) 0%, transparent 50%), radial-gradient(ellipse 50% 50% at 0% 100%, rgba(236,72,153,0.1) 0%, transparent 50%), #0a0f1c"
      : "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.1) 0%, transparent 70%), radial-gradient(ellipse 50% 50% at 100% 100%, rgba(168,85,247,0.08) 0%, transparent 50%), radial-gradient(ellipse 50% 50% at 0% 100%, rgba(236,72,153,0.08) 0%, transparent 50%), #f9fafb",
  }), [resolvedTheme]);

  const logoSrc = resolvedTheme === "dark" 
    ? "/logo/logo-dark.png" 
    : "/logo/logo-light.png";

  // Stats for social proof
  const stats = [
    { value: "10M+", label: "Active Creators" },
    { value: "500M+", label: "Monthly Posts" },
    { value: "99.9%", label: "Uptime" },
  ];

  if (!mounted) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-screen overflow-hidden" style={backgroundStyle}>
      {/* Advanced Background Elements */}
      <HolographicGrid theme={resolvedTheme} />
      
      {/* Floating Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute rounded-full"
            style={{
              width: particle.size,
              height: particle.size,
              top: `${particle.y}%`,
              left: `${particle.x}%`,
              background: resolvedTheme === "dark" 
                ? "rgba(99,102,241,0.3)" 
                : "rgba(79,70,229,0.2)",
            }}
            animate={{
              y: [0, -20, 0],
              x: [0, (Math.random() - 0.5) * 10, 0],
              opacity: [particle.opacity, particle.opacity * 0.5, particle.opacity],
            }}
            transition={{
              duration: particle.speed * 10,
              repeat: Infinity,
              ease: "easeInOut",
              delay: particle.delay,
            }}
          />
        ))}
      </div>

      {/* Theme Toggle - Enhanced */}
      <motion.div
        className="absolute top-6 right-6 z-50"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5 }}
      >
        <ThemeToggle 
          variant="icon" 
          size="lg"
          showTooltip={true}
        />
      </motion.div>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-6 py-12">
        <motion.main
          className="max-w-7xl mx-auto text-center"
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          {/* Enhanced Logo */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0, rotateY: -180 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
            transition={{ 
              type: "spring", 
              stiffness: 260, 
              damping: 20,
              delay: 0.2
            }}
            className="mx-auto w-40 h-40 rounded-2xl overflow-hidden shadow-2xl ring-4 ring-primary-500/30 mb-8 bg-white dark:bg-gray-900 relative"
          >
            {/* Logo glow effect */}
            <motion.div
              className="absolute inset-0 rounded-2xl blur-xl opacity-50"
              animate={{
                opacity: [0.3, 0.6, 0.3],
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{
                background: resolvedTheme === 'dark'
                  ? 'linear-gradient(45deg, #6366f1, #8b5cf6)'
                  : 'linear-gradient(45deg, #4f46e5, #7c3aed)',
              }}
            />
            <img
              src={logoSrc}
              alt="Arvdoul Logo"
              className="relative z-10 w-full h-full object-contain p-6 select-none"
              draggable="false"
            />
          </motion.div>

          {/* Headline with gradient text */}
          <motion.div
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.55 }}
            className="mb-6"
          >
            <h1 className="text-6xl md:text-7xl font-black tracking-tight mb-4">
              Welcome to{" "}
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Arvdoul
              </span>
            </h1>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.8, duration: 0.8 }}
              className="h-1 w-24 mx-auto bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
            />
          </motion.div>

          {/* Subheadline */}
          <motion.p
            className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto mb-12 leading-relaxed"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.55 }}
          >
            The next-generation social platform for{" "}
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">creators</span> 
            {" "}and{" "}
            <span className="font-semibold text-purple-600 dark:text-purple-400">communities</span>
            . Built for the future. 🚀
          </motion.p>

          {/* Social Proof Stats */}
          <motion.div
            className="grid grid-cols-3 gap-8 max-w-2xl mx-auto mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className={`text-2xl font-bold ${
                  resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}>
                  {stat.value}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>

          {/* Enhanced Feature Cards */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.55 }}
          >
            {features.map((feature, index) => (
              <FeatureCard
                key={index}
                emoji={feature.emoji}
                title={feature.title}
                desc={feature.desc}
                index={index}
                theme={resolvedTheme}
                prefersReducedMotion={prefersReducedMotion}
              />
            ))}
          </motion.div>

          {/* Enhanced CTA Section */}
          <motion.div
            className="max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            {/* CTA buttons with enhanced design */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-8">
              <motion.button
                whileHover={{ scale: prefersReducedMotion ? 1 : 1.05 }}
                whileTap={{ scale: prefersReducedMotion ? 1 : 0.97 }}
                onClick={() => navigate("/signup/step1")}
                className="group relative w-full sm:w-64 px-8 py-4 rounded-2xl font-bold text-white shadow-2xl overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                }}
              >
                {/* Animated background */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600"
                  whileHover={{
                    scale: 1.1,
                    transition: { duration: 0.4 }
                  }}
                />
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Get Started 
                  <motion.span
                    animate={{ x: [0, 4, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    →
                  </motion.span>
                </span>
                
                {/* Shine effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
                  initial={{ x: '-100%' }}
                  whileHover={{ x: '200%' }}
                  transition={{ duration: 0.8 }}
                />
              </motion.button>

              <motion.button
                whileHover={{ scale: prefersReducedMotion ? 1 : 1.05 }}
                whileTap={{ scale: prefersReducedMotion ? 1 : 0.97 }}
                onClick={() => navigate("/login")}
                className="group relative w-full sm:w-64 px-8 py-4 rounded-2xl font-bold border-2 shadow-xl transition-all duration-300 overflow-hidden"
                style={{
                  borderColor: resolvedTheme === 'dark' ? 'rgba(99,102,241,0.4)' : 'rgba(79,70,229,0.3)',
                  background: resolvedTheme === 'dark' ? 'rgba(30, 41, 59, 0.4)' : 'rgba(255, 255, 255, 0.8)',
                  color: resolvedTheme === 'dark' ? '#e2e8f0' : '#374151',
                }}
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Sign In
                  <motion.span
                    initial={{ opacity: 0, x: -8 }}
                    whileHover={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    🔑
                  </motion.span>
                </span>
                
                {/* Hover background */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100"
                  transition={{ duration: 0.3 }}
                />
              </motion.button>
            </div>

            {/* Enhanced Keyboard Hints */}
            <motion.div
              className="text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1 }}
            >
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                Quick Navigation
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {[
                  { key: 'Enter', action: 'Get Started' },
                  { key: 'L', action: 'Sign In' },
                  { key: 'H', action: 'Home' }
                ].map((shortcut, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center gap-1 text-xs"
                    whileHover={{ scale: 1.05 }}
                  >
                    <kbd className="px-2 py-1 bg-black/10 dark:bg-white/10 rounded-md font-mono">
                      {shortcut.key}
                    </kbd>
                    <span className="text-gray-500 dark:text-gray-400">
                      {shortcut.action}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </motion.main>

        {/* Enhanced Footer */}
        <motion.footer
          className="mt-20 py-8 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
        >
          <div className="inline-flex items-center gap-4 px-6 py-3 rounded-full text-sm bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/50 shadow-lg">
            <span className="text-gray-600 dark:text-gray-300">
              © {new Date().getFullYear()} Arvdoul Technologies
            </span>
            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
            <span className="text-gray-500 dark:text-gray-400">
              Crafted for the future of social connection
            </span>
          </div>
        </motion.footer>
      </div>
    </div>
  );
}