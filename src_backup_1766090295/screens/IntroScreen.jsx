\/\/ src/screens/IntroScreen.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
  memo,
  Component,
} from "react";
import { useNavigate } from "react-router-dom";
console.log('DEBUG: IntroScreen module loaded');
import { useTheme } from "@context/ThemeContext";
import ThemeToggle from "@components/Shared/ThemeToggle";
import {
  motion,
  useReducedMotion,
  AnimatePresence,
  useSpring,
} from "framer-motion";
import { useAuth } from "@context/AuthContext"; \/\/ safer / exists in your repo

/**
 * Arvdoul — IntroScreen (Production-Ready, Ultra Pro)
 * - No external deps (removed lodash-es, localforage, axios)
 * - Error boundary to avoid full blank screen
 * - Defensive checks for window/server rendering
 * - Cleaned motion usage and safe fallbacks
 */

/* -------------------- Local debounce (zero-deps) -------------------- */
const debounce = (fn, wait = 8) => {
  let t = null;
  const debounced = (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      fn.apply(null, args);
      t = null;
    }, wait);
  };
  debounced.cancel = () => {
    if (t) clearTimeout(t);
    t = null;
  };
  return debounced;
};

/* -------------------- Error Boundary -------------------- */
class IntroErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    \/\/ you can push this to your analytics / Sentry
    \/\/ but avoid importing heavy analytics here (keep file light)
    \/\/ eslint-disable-next-line no-console
    console.error("IntroScreen crashed:", error, info);
    this.setState({ info });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-black dark:to-gray-900">
          <div className="max-w-xl text-center space-y-6">
            <h2 className="text-2xl font-bold">Something went wrong</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Intro screen encountered an error. This is isolated — you can
              retry or continue to the app. Error details are logged to console.
            </p>
            <div className="flex items-center gap-4 justify-center">
              <button
                className="px-6 py-2 rounded-md bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold"
                onClick={() => this.setState({ hasError: false, error: null, info: null })}
              >
                Retry
              </button>
              <button
                className="px-6 py-2 rounded-md border"
                onClick={() => (window.location.href = "/")}
              >
                Go Home
              </button>
            </div>
            <pre className="text-xs text-left max-h-40 overflow-auto p-3 bg-black/5 dark:bg-white/5 rounded-md">
              {String(this.state.error ?? "No error details")}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* -------------------- Quantum Network Visualization (memoized) -------------------- */
const QuantumNetworkVisualization = memo(function QuantumNetworkVisualization({ theme }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const dims = useRef({ w: 0, h: 0 });
  const nodesRef = useRef([]);
  const connsRef = useRef([]);
  const tRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => {
      dims.current = { w: window.innerWidth, h: window.innerHeight };
      const nodeCount = Math.min(28, Math.max(8, Math.floor(dims.current.w / 60)));
      \/\/ init nodes
      nodesRef.current = Array.from({ length: nodeCount }, (_, i) => ({
        id: i,
        x: Math.random() * dims.current.w,
        y: Math.random() * dims.current.h,
        size: Math.random() * 3 + 2,
        speed: Math.random() * 0.9 + 0.2,
        phase: Math.random() * Math.PI * 2,
      }));
      \/\/ init connections
      connsRef.current = [];
      for (let i = 0; i < nodeCount; i++) {
        const cc = Math.floor(Math.random() * 3) + 1;
        for (let j = 0; j < cc; j++) {
          const target = Math.floor(Math.random() * nodeCount);
          if (target !== i) {
            connsRef.current.push({
              from: i,
              to: target,
              strength: Math.random() * 0.45 + 0.25,
              pulse: Math.random() * Math.PI * 2,
            });
          }
        }
      }
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const step = () => {
      const { w, h } = dims.current;
      if (!w || !h) return (rafRef.current = requestAnimationFrame(step));
      canvas.width = w;
      canvas.height = h;
      tRef.current += 0.014;

      \/\/ background subtle clear (fades nicely)
      ctx.fillStyle = theme === "dark" ? "rgba(6,8,17,0.08)" : "rgba(250,250,252,0.08)";
      ctx.fillRect(0, 0, w, h);

      \/\/ draw connections
      for (const c of connsRef.current) {
        const a = nodesRef.current[c.from];
        const b = nodesRef.current[c.to];
        if (!a || !b) continue;
        const pulse = Math.sin(tRef.current + c.pulse) * 0.5 + 0.5;
        const alpha = c.strength * pulse * (theme === "dark" ? 0.18 : 0.08);
        ctx.strokeStyle = theme === "dark" ? `rgba(139,92,246,${alpha})` : `rgba(99,102,241,${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        if (pulse > 0.78) {
          ctx.beginPath();
          ctx.arc((a.x + b.x) / 2, (a.y + b.y) / 2, pulse * 3, 0, Math.PI * 2);
          ctx.fillStyle = theme === "dark" ? `rgba(99,102,241,${pulse * 0.08})` : `rgba(79,70,229,${pulse * 0.06})`;
          ctx.fill();
        }
      }

      \/\/ draw nodes
      for (const n of nodesRef.current) {
        const p = Math.sin(tRef.current * n.speed + n.phase) * 0.5 + 0.5;
        const size = n.size + p * 2;
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, size * 2);
        grad.addColorStop(0, theme === "dark" ? `rgba(139,92,246,${0.28 + p * 0.15})` : `rgba(79,70,229,${0.18 + p * 0.08})`);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(n.x, n.y, size * 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.beginPath();
        ctx.arc(n.x, n.y, size * 0.65, 0, Math.PI * 2);
        ctx.fill();

        \/\/ gentle movement
        n.x += Math.sin(tRef.current * 0.6 + n.id) * 0.3;
        n.y += Math.cos(tRef.current * 0.6 + n.id) * 0.3;

        \/\/ wrap
        if (n.x < 0) n.x = w;
        if (n.x > w) n.x = 0;
        if (n.y < 0) n.y = h;
        if (n.y > h) n.y = 0;
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [theme]);

  return (
    <canvas
      aria-hidden
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{
        opacity: theme === "dark" ? 0.32 : 0.14,
        mixBlendMode: theme === "dark" ? "screen" : "overlay",
      }}
    />
  );
});

/* -------------------- Quantum Feature Card (lightweight, robust) -------------------- */
const QuantumFeatureCard = ({
  emoji,
  title,
  description,
  index,
  theme,
  reducedMotion,
  isActive,
  onHover,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      \/\/ entrance visual only; no state required externally
    }, index * 80);
    return () => clearTimeout(t);
  }, [index]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.6, type: "spring", stiffness: 110 }}
      onMouseEnter={() => {
        setIsHovered(true);
        if (onHover) onHover(index);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        if (onHover) onHover(null);
      }}
      className="relative group cursor-pointer"
    >
      <div
        className={`relative rounded-2xl p-6 border transition-all duration-300 ${
          theme === "dark" ? "bg-gray-900/70 border-gray-700/40" : "bg-white/90 border-gray-200/60"
        } shadow-lg`}
      >
        <div className="text-3xl mb-3 select-none">{emoji}</div>
        <h4 className="font-semibold text-lg mb-2">
          <span
            className={`bg-clip-text text-transparent ${
              theme === "dark" ? "bg-gradient-to-r from-purple-400 to-cyan-300" : "bg-gradient-to-r from-purple-600 to-cyan-500"
            }`}
          >
            {title}
          </span>
        </h4>
        <p className={`text-sm ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}>{description}</p>

        <div
          className={`absolute bottom-4 left-4 right-4 h-1 rounded-full transition-all ${
            isHovered || isActive
              ? theme === "dark"
                ? "bg-gradient-to-r from-purple-500 to-blue-400"
                : "bg-gradient-to-r from-purple-400 to-blue-500"
              : "bg-transparent"
          }`}
        />
      </div>
    </motion.div>
  );
};

/* -------------------- Main Component -------------------- */
export default function IntroScreenWrapper() {
  return (
    <IntroErrorBoundary>
      <IntroScreen />
    </IntroErrorBoundary>
  );
}

function IntroScreen() {
  const navigate = useNavigate();
  const themeCtx = useTheme?.() || { theme: "light", systemTheme: "light" };
  const { theme } = themeCtx;
  const auth = useAuth?.() || { user: null, loading: false };
  const { user, loading } = auth;

  const prefersReducedMotion = useReducedMotion();
  const prefersDark = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

  const [mounted, setMounted] = useState(false);
  const [activeFeature, setActiveFeature] = useState(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  \/\/ motion springs (used for subtle internal animation if needed)
  const mouseXSpring = useSpring(0, { stiffness: 100, damping: 30 });
  const mouseYSpring = useSpring(0, { stiffness: 100, damping: 30 });

  const resolvedTheme = useMemo(() => {
    if (theme === "system") return prefersDark ? "dark" : "light";
    return theme || "light";
  }, [theme, prefersDark]);

  useEffect(() => {
    setMounted(true);
    \/\/ small startup log (useful for debugging)
    \/\/ eslint-disable-next-line no-console
    console.info("IntroScreen mounted (Arvdoul) — resolvedTheme:", resolvedTheme);
    return () => {
      \/\/ eslint-disable-next-line no-console
      console.info("IntroScreen unmounted");
    };
  }, [resolvedTheme]);

  \/\/ mouse + scroll handlers (debounced)
  useEffect(() => {
    if (prefersReducedMotion || typeof window === "undefined") return;

    const mm = debounce((e) => {
      const x = e.clientX;
      const y = e.clientY;
      setMousePosition({ x, y });
      \/\/ update spring values for smoother motion if used
      mouseXSpring.set((x / window.innerWidth - 0.5) * 20);
      mouseYSpring.set((y / window.innerHeight - 0.5) * 15);
    }, 8);

    const onScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
      const docHeight = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      setScrollProgress(Math.min(1, Math.max(0, scrollTop / docHeight)));
    };

    window.addEventListener("mousemove", mm);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("scroll", onScroll);
      mm.cancel();
    };
  }, [prefersReducedMotion, mouseXSpring, mouseYSpring]);

  \/\/ keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCommandPalette((v) => !v);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        navigate("/signup/step1");
      }
      if (e.key.toLowerCase() === "l") {
        e.preventDefault();
        navigate("/login");
      }
      if (e.key.toLowerCase() === "h") {
        e.preventDefault();
        navigate("/home");
      }
      if (e.key >= "1" && e.key <= "6") {
        const idx = parseInt(e.key, 10) - 1;
        setActiveFeature(idx);
        setTimeout(() => setActiveFeature(null), 1100);
      }
      if (e.key === "Escape") {
        setShowCommandPalette(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  /* -------------------- Data (features & stats) -------------------- */
  const quantumFeatures = useMemo(
    () => [
      {
        emoji: "⚡",
        title: "Quantum Processing",
        description: "Real-time neural processing with sub-millisecond inference.",
      },
      {
        emoji: "🧠",
        title: "AI Co-Pilot",
        description: "Personalized assistant to accelerate content creation.",
      },
      {
        emoji: "🔐",
        title: "Quantum Encryption",
        description: "Post-quantum safe messaging and storage.",
      },
      {
        emoji: "🌌",
        title: "Metaverse Ready",
        description: "Spatial and immersive experiences baked-in.",
      },
      {
        emoji: "📊",
        title: "Predictive Analytics",
        description: "Actionable insights driven by advanced models.",
      },
      {
        emoji: "🤝",
        title: "Decentralized Network",
        description: "True ownership and control for creators.",
      },
    ],
    []
  );

  const quantumStats = useMemo(
    () => [
      { value: "500M+", label: "Quantum Nodes", description: "Distributed computing fabric" },
      { value: "99.999%", label: "Uptime", description: "Enterprise reliability" },
      { value: "0.001s", label: "Latency", description: "Near-instant responses" },
      { value: "∞", label: "Scalability", description: "Designed to grow" },
    ],
    []
  );

  const textStyles = useMemo(
    () => ({
      gradient: resolvedTheme === "dark" ? "bg-gradient-to-r from-purple-400 to-cyan-300" : "bg-gradient-to-r from-purple-600 to-cyan-500",
      primary: resolvedTheme === "dark" ? "text-gray-100" : "text-gray-900",
      secondary: resolvedTheme === "dark" ? "text-gray-300" : "text-gray-700",
    }),
    [resolvedTheme]
  );

  if (!mounted) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-black dark:to-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-indigo-500 mb-4" />
          <div className="text-sm text-gray-600 dark:text-gray-300">Initializing Arvdoul...</div>
        </div>
      </div>
    );
  }

  /* -------------------- Render UI -------------------- */
  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-transparent">
      {/* background visuals */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background: resolvedTheme === "dark"
              ? "radial-gradient(ellipse at 20% 10%, rgba(139,92,246,0.12), transparent), radial-gradient(ellipse at 80% 90%, rgba(6,182,212,0.08), transparent), #030517"
              : "radial-gradient(ellipse at 20% 10%, rgba(139,92,246,0.06), transparent), radial-gradient(ellipse at 80% 90%, rgba(6,182,212,0.04), transparent), #f7f9fc",
          }}
        />
        <QuantumNetworkVisualization theme={resolvedTheme} />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: "linear-gradient(45deg, transparent 49.5%, rgba(255,255,255,0.04) 49.5%, rgba(255,255,255,0.04) 50.5%, transparent 50.5%)",
            backgroundSize: "60px 60px",
            mixBlendMode: resolvedTheme === "dark" ? "screen" : "overlay",
          }}
        />
      </div>

      {/* main */}
      <div className="relative z-10">
        {/* nav */}
        <motion.nav
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.45 }}
          className="fixed top-0 left-0 right-0 z-50 px-6 py-4 backdrop-blur-md"
          style={{
            background: resolvedTheme === "dark" ? "rgba(6,8,17,0.6)" : "rgba(255,255,255,0.7)",
            borderBottom: resolvedTheme === "dark" ? "1px solid rgba(255,255,255,0.02)" : "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
                <span className="text-white font-bold">A</span>
              </div>
              <div className={`font-extrabold text-2xl bg-clip-text text-transparent ${textStyles.gradient}`}>
                Arvdoul
              </div>
            </div>

            <div className="flex items-center gap-4">
              <ThemeToggle variant="icon" size="lg" />
              <button
                onClick={() => setShowCommandPalette(true)}
                className={`px-3 py-2 rounded-lg text-sm ${resolvedTheme === "dark" ? "bg-black/30" : "bg-white/60"} border`}
              >
                ⌘K
              </button>
              <button
                onClick={() => navigate("/login")}
                className={`px-4 py-2 rounded-lg text-sm ${resolvedTheme === "dark" ? "bg-gray-800" : "bg-white"} border`}
              >
                Sign In
              </button>
              <button
                onClick={() => navigate("/signup/step1")}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-purple-600 to-blue-600 text-white"
              >
                Get Started
              </button>
            </div>
          </div>
        </motion.nav>

        {/* hero */}
        <section className="pt-28 pb-20 px-6">
          <div className="max-w-7xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold leading-tight">
                <span className="block">Welcome to the</span>
                <span className={`block ${textStyles.gradient} bg-clip-text text-transparent`}>Quantum Social Era</span>
              </h1>
              <p className="mt-6 text-lg md:text-xl max-w-3xl mx-auto text-gray-600 dark:text-gray-300">
                Arvdoul is built for creators and communities — a secure, fast, and intelligent social platform.
              </p>
            </motion.div>

            {/* stats */}
            <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
              {quantumStats.map((s, i) => (
                <div key={i} className={`p-4 rounded-xl ${resolvedTheme === "dark" ? "bg-gray-900/60 border border-gray-800" : "bg-white/90 border border-gray-200"}`}>
                  <div className={`text-2xl font-bold ${textStyles.gradient} bg-clip-text text-transparent`}>{s.value}</div>
                  <div className="font-semibold">{s.label}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{s.description}</div>
                </div>
              ))}
            </motion.div>

            {/* features */}
            <div className="mt-16">
              <h2 className="text-2xl md:text-3xl font-bold mb-8">Why Arvdoul</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {quantumFeatures.map((f, idx) => (
                  <QuantumFeatureCard
                    key={idx}
                    {...f}
                    index={idx}
                    theme={resolvedTheme}
                    reducedMotion={prefersReducedMotion}
                    isActive={activeFeature === idx}
                    onHover={setActiveFeature}
                  />
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="mt-14">
              <div className={`mx-auto max-w-3xl p-8 rounded-3xl ${resolvedTheme === "dark" ? "bg-gray-900/70 border border-gray-800" : "bg-white/80 border border-gray-200"}`}>
                <h3 className="text-2xl font-bold mb-3">Ready to join?</h3>
                <p className="text-sm mb-6 text-gray-600 dark:text-gray-300">Sign up now and start creating with powerful tools and safe defaults.</p>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => navigate("/signup/step1")}
                    className="px-8 py-3 rounded-2xl font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600"
                  >
                    Start your journey
                  </button>
                  <button
                    onClick={() => navigate("/login")}
                    className="px-6 py-3 rounded-2xl border"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* footer progress */}
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40">
          <div className={`px-4 py-2 rounded-full ${resolvedTheme === "dark" ? "bg-gray-900/70 border border-gray-800" : "bg-white/80 border border-gray-200"}`}>
            <div className="flex items-center gap-4">
              <div className="w-40 h-1 bg-gray-200 rounded-full overflow-hidden">
                <motion.div className="h-full bg-gradient-to-r from-purple-500 to-blue-500" style={`{ width: `${Math.round(scrollProgress * 100)}%` `}} />
              </div>
              <div className="text-sm font-medium">{Math.round(scrollProgress * 100)}% explored</div>
            </div>
          </div>
        </div>
      </div>

      {/* command palette */}
      <AnimatePresence>
        {showCommandPalette && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCommandPalette(false)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={(e) => e.stopPropagation()} />
            <motion.div className={`relative w-full max-w-2xl rounded-2xl p-4 ${resolvedTheme === "dark" ? "bg-gray-900 border border-gray-800" : "bg-white border border-gray-200"}`} initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-white">⌘</div>
                <div>
                  <div className="font-semibold">Arvdoul Command Center</div>
                  <div className="text-xs text-gray-500">Quick actions & navigation</div>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { label: "New Space", action: () => navigate("/create"), hint: "⌘N" },
                  { label: "AI Assistant", action: () => {}, hint: "⌘A" },
                  { label: "Settings", action: () => navigate("/settings"), hint: "⌘," },
                ].map((it, i) => (
                  <button key={i} onClick={it.action} className={`w-full p-3 rounded-lg text-left ${resolvedTheme === "dark" ? "hover:bg-gray-800" : "hover:bg-gray-100"}`}>
                    <div className="flex items-center justify-between">
                      <div>{it.label}</div>
                      <div className="text-xs text-gray-400 px-2 py-1 border rounded">{it.hint}</div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* accessibility live region */}
      <div className="sr-only" aria-live="polite">
        Welcome to Arvdoul — the next generation social platform.
      </div>
    </div>
  );
}