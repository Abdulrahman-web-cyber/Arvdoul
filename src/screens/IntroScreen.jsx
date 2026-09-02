// src/screens/IntroScreen.jsx
/**
 * Arvdoul — Ultra Pro IntroScreen
 * Restored visual identity with refined, subtle ambient styling (reduced glow),
 * smooth canvas particles, honest feature pillars, and accessible interactions.
 */

import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  memo,
  Component,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@context/ThemeContext";
import { useTranslation } from "react-i18next";
import ThemeToggle from "@components/Shared/ThemeToggle";
import { motion, AnimatePresence } from "framer-motion";
import { withLanguage } from "../i18n/index.js";
import { Sparkles, Shield, Users, Palette, MessageCircle, Smartphone, Lock, Zap, Coins } from "lucide-react";

/* -------------------- Cryptographically Secure PRNG -------------------- */
function secureRandom() {
  if (typeof window !== "undefined" && window.crypto && typeof window.crypto.getRandomValues === "function") {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return arr[0] / 4294967296;
  }
  return 0.5;
}

/* -------------------- Safe reduced-motion hook -------------------- */
function useSafeReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        setReduced(false);
        return undefined;
      }
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReduced(Boolean(mq.matches));
      const onChange = (e) => setReduced(Boolean(e.matches));
      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
      }
      return undefined;
    } catch {
      setReduced(false);
      return undefined;
    }
  }, []);

  return reduced;
}

/* -------------------- Error Boundary -------------------- */
class IntroErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("[Arvdoul Intro Error]:", error, errorInfo);
  }
  handleContinue = () => {
    try {
      window.location.href = "/home";
    } catch {}
  };
  render() {
    const { t } = this.props;
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-50 dark:bg-[#03071B] p-4">
          <div className="max-w-md text-center p-8 rounded-2xl bg-white dark:bg-[#080F2E] shadow-xl border border-gray-200 dark:border-gray-800">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
              {t("intro.glitchTitle") || "Welcome to Arvdoul"}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">
              {t("intro.glitchText") || "Continue directly to explore the platform."}
            </p>
            <button
              onClick={this.handleContinue}
              className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium transition-all min-h-[44px]"
            >
              {t("intro.continueToApp") || "Continue to App"}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
const IntroErrorBoundaryTranslated = withLanguage(IntroErrorBoundary);

/* -------------------- Crisp Minimal Background (Zero Blurry Glow) -------------------- */
const AmbientBackground = memo(({ theme }) => {
  const isDark = theme === "dark";
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Subtle fine geometric dot grid without any blurry glow */}
      <div
        className="absolute inset-0 opacity-[0.035] dark:opacity-[0.05]"
        style={{
          backgroundImage: isDark
            ? "radial-gradient(circle, #ffffff 1px, transparent 1px)"
            : "radial-gradient(circle, #000000 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      {/* Crisp subtle border accents */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />
    </div>
  );
});

/* -------------------- Interactive Background Particles (Minimal & Non-intrusive) -------------------- */
const BackgroundParticles = memo(({ theme }) => {
  const canvasRef = useRef(null);
  const isReduced = useSafeReducedMotion();

  useEffect(() => {
    if (isReduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const isDark = theme === "dark";
    const particleCount = Math.min(14, Math.floor(width / 90));
    const particles = Array.from({ length: particleCount }).map(() => ({
      x: secureRandom() * width,
      y: secureRandom() * height,
      radius: secureRandom() * 1.2 + 0.6,
      vx: (secureRandom() - 0.5) * 0.2,
      vy: (secureRandom() - 0.5) * 0.2,
      opacity: secureRandom() * 0.15 + 0.05,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = isDark
          ? `rgba(167, 139, 250, ${p.opacity})`
          : `rgba(139, 92, 246, ${p.opacity * 0.6})`;
        ctx.fill();
      });
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, [theme, isReduced]);

  if (isReduced) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0 opacity-40"
      aria-hidden="true"
    />
  );
});

/* -------------------- Logo Component -------------------- */
const HeroLogo = memo(({ theme, onClick }) => {
  const [logoError, setLogoError] = useState(false);
  const isDark = theme === "dark";
  const logoPath = isDark ? "/logo/logo-dark.png" : "/logo/logo-light.png";

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center cursor-pointer select-none"
      onClick={onClick}
      role="img"
      aria-label="Arvdoul"
    >
      <div className="w-16 h-16 rounded-2xl border border-gray-200/80 dark:border-gray-800 flex items-center justify-center p-2 bg-white/90 dark:bg-[#080F2E]/90 shadow-sm backdrop-blur-sm">
        <img
          src={logoPath}
          alt="Arvdoul"
          className="w-full h-full object-contain rounded-xl"
          onError={(e) => {
            e.target.style.display = "none";
            setLogoError(true);
          }}
        />
        {logoError && (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-xl text-white font-bold text-xl">
            A
          </div>
        )}
      </div>
    </motion.div>
  );
});

/* -------------------- Feature Card -------------------- */
const FeatureCard = memo(({ icon: Icon, title, description, theme, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="relative rounded-2xl p-5 sm:p-6 transition-all duration-200 h-full flex flex-col justify-between group bg-white/80 dark:bg-[#080F2E]/80 backdrop-blur-sm border border-gray-200/80 dark:border-gray-800/80 hover:border-violet-500/40 dark:hover:border-violet-500/40 hover:shadow-md"
    >
      <div>
        <div className="w-11 h-11 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="font-bold text-base sm:text-lg mb-1.5 text-gray-900 dark:text-white">
          {title}
        </h3>
        <p className="text-xs sm:text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          {description}
        </p>
      </div>
    </motion.div>
  );
});

/* -------------------- Main Component -------------------- */
export default function IntroScreenWrapper() {
  return (
    <IntroErrorBoundaryTranslated>
      <IntroScreen />
    </IntroErrorBoundaryTranslated>
  );
}

function IntroScreen() {
  const navigate = useNavigate();
  const themeCtx = useTheme?.() || { theme: "light" };
  const { theme } = themeCtx;
  const { t } = useTranslation();

  const resolvedTheme = useMemo(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
    if (theme === "system") {
      try {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      } catch {
        return "light";
      }
    }
    return theme || "light";
  }, [theme]);

  const features = useMemo(
    () => [
      { icon: Sparkles, title: t("intro.features.smartFeed.title") || "Smart Discovery", description: t("intro.features.smartFeed.desc") || "Personalized feed optimized for quality creator content." },
      { icon: Shield, title: t("intro.features.privacy.title") || "Privacy First", description: t("intro.features.privacy.desc") || "Granular visibility controls with end-to-end encryption." },
      { icon: Users, title: t("intro.features.communities.title") || "Vibrant Communities", description: t("intro.features.communities.desc") || "Connect with creators, join topic circles, and collaborate." },
      { icon: Palette, title: t("intro.features.creation.title") || "Creator Studio", description: t("intro.features.creation.desc") || "Full-featured studio supporting rich text, video, polls, and events." },
      { icon: MessageCircle, title: t("intro.features.chat.title") || "Real-Time Messaging", description: t("intro.features.chat.desc") || "Instant chat, group conversations, and encrypted direct messaging." },
      { icon: Smartphone, title: t("intro.features.platform.title") || "Cross-Platform", description: t("intro.features.platform.desc") || "Seamless experience across desktop, tablet, and mobile devices." },
    ],
    [t]
  );

  const pillars = useMemo(
    () => [
      { icon: Lock, title: t("intro.pillars.e2ee.title") || "E2EE Security", description: t("intro.pillars.e2ee.desc") || "End-to-end encrypted messaging" },
      { icon: Shield, title: t("intro.pillars.privacy.title") || "Zero Trackers", description: t("intro.pillars.privacy.desc") || "Privacy-by-design architecture" },
      { icon: Coins, title: t("intro.pillars.creator.title") || "Creator Economy", description: t("intro.pillars.creator.desc") || "Direct monetization & tips" },
      { icon: Zap, title: t("intro.pillars.realtime.title") || "Instant Sync", description: t("intro.pillars.realtime.desc") || "Sub-second real-time delivery" },
    ],
    [t]
  );

  return (
    <div
      className={`relative w-full min-h-screen overflow-x-hidden ${
        resolvedTheme === "dark" ? "bg-[#03071B] text-white" : "bg-[#F8FAFC] text-gray-900"
      }`}
    >
      <AmbientBackground theme={resolvedTheme} />
      <BackgroundParticles theme={resolvedTheme} />

      {/* Theme Toggle - Fixed top right */}
      <div className="fixed top-5 right-5 z-50">
        <ThemeToggle
          variant="icon"
          size="lg"
          className="bg-white/80 dark:bg-[#080F2E]/80 backdrop-blur-md border border-gray-200/80 dark:border-gray-700/80 shadow-sm"
        />
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6">
        <section className="pt-12 sm:pt-16 pb-16 sm:pb-24">
          <div className="max-w-5xl mx-auto">
            {/* Hero Section */}
            <div className="text-center">
              <HeroLogo theme={resolvedTheme} onClick={() => navigate("/")} />

              <div className="mb-2">
                <span className="inline-block px-3.5 py-1 rounded-full text-xs font-semibold bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-200/60 dark:border-violet-700/40">
                  The Modern Creator Network
                </span>
              </div>

              <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tight mb-5">
                <span className="block">{t("intro.title1") || "Share Your Vision."}</span>
                <span className="block bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-500 bg-clip-text text-transparent">
                  {t("intro.title2") || "Empower Your Community."}
                </span>
              </h1>

              <p className="text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-8 leading-relaxed text-gray-600 dark:text-gray-400">
                {t("intro.tagline") || "A next-generation platform for creators, thinkers, and communities to connect, share, and thrive."}
              </p>

              {/* Hero Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-sm mx-auto mb-14">
                <button
                  onClick={() => navigate("/signup/step1")}
                  className="w-full sm:w-auto flex-1 px-7 py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 shadow-md hover:shadow-lg transition-all transform active:scale-95"
                >
                  {t("intro.createAccount") || "Get Started"}
                </button>
                <button
                  onClick={() => navigate("/login")}
                  className="w-full sm:w-auto flex-1 px-7 py-3.5 rounded-xl font-bold bg-white dark:bg-[#080F2E] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-all transform active:scale-95"
                >
                  {t("intro.signIn") || "Sign In"}
                </button>
              </div>
            </div>

            {/* Honest Pillars Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 mb-14">
              {pillars.map((pillar, i) => {
                const Icon = pillar.icon;
                return (
                  <div
                    key={pillar.title}
                    className="p-4 sm:p-5 rounded-2xl bg-white/70 dark:bg-[#080F2E]/70 backdrop-blur-sm border border-gray-200/80 dark:border-gray-800/80 flex flex-col justify-between"
                  >
                    <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 flex items-center justify-center mb-3">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                        {pillar.title}
                      </div>
                      <div className="text-xs mt-1 text-gray-500 dark:text-gray-400 leading-relaxed">
                        {pillar.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Features Grid */}
            <div className="mb-14">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-8">
                {t("intro.featuresTitle") || "Designed for Modern Creators"}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {features.map((feature, index) => (
                  <FeatureCard
                    key={feature.title}
                    {...feature}
                    index={index}
                    theme={resolvedTheme}
                  />
                ))}
              </div>
            </div>

            {/* CTA Section */}
            <div className="rounded-3xl p-8 sm:p-12 text-center bg-white/80 dark:bg-[#080F2E]/80 backdrop-blur-sm border border-gray-200/80 dark:border-gray-800/80 shadow-sm">
              <div className="max-w-2xl mx-auto">
                <h3 className="text-2xl sm:text-3xl font-extrabold mb-3">
                  {t("intro.ctaTitle") || "Ready to join the community?"}
                </h3>
                <p className="text-sm sm:text-base mb-6 text-gray-600 dark:text-gray-400">
                  {t("intro.ctaText") || "Create your account today and start sharing your thoughts with the world."}
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-sm mx-auto">
                  <button
                    onClick={() => navigate("/signup/step1")}
                    className="w-full flex-1 px-6 py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-sm transition-all"
                  >
                    {t("intro.createAccount") || "Create Free Account"}
                  </button>
                  <button
                    onClick={() => navigate("/home")}
                    className="w-full flex-1 px-6 py-3.5 rounded-xl font-semibold bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                  >
                    Explore App
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
