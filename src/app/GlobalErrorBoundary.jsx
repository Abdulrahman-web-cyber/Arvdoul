// 🛡️ ARVDOUL GLOBAL ERROR BOUNDARY v3
// Theme-aware + Neon system + production-grade crash UI

import React, { Component } from 'react';
import { useTheme } from '../context/ThemeContext';

/**
 * Wrapper to inject theme into class component
 */
function withTheme(ComponentClass) {
  return function Wrapper(props) {
    const theme = useTheme();
    return <ComponentClass {...props} theme={theme} />;
  };
}

class GlobalErrorBoundaryBase extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      recoveryAttempts: 0,
      isRecovering: false,
      copied: false
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  async componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    try {
      localStorage.setItem(
        "arvdoul_crash_log",
        JSON.stringify({
          message: error?.message,
          stack: error?.stack,
          componentStack: errorInfo?.componentStack,
          time: new Date().toISOString(),
        })
      );
    } catch {}

    console.error("💥 ARVDOUL CRASH:", error, errorInfo);
  }

  handleRecover = async () => {
    this.setState(prev => ({
      recoveryAttempts: prev.recoveryAttempts + 1,
      isRecovering: true
    }));

    try {
      const mod = await import('../firebase/firebase.js');
      await mod?.initializeFirebase?.();

      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        isRecovering: false
      });

    } catch {
      this.setState({ isRecovering: false });

      if (this.state.recoveryAttempts >= 2) {
        window.location.reload();
      }
    }
  };

  handleReload = () => window.location.reload();

  handleReset = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  handleCopy = async () => {
    const data = {
      message: this.state.error?.message,
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack
    };

    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 1500);
  };

  // 🎨 REAL NEON SYSTEM (theme-aware)
  getGlow(type) {
    const theme = this.props.theme?.resolvedTheme;

    const isDark = theme === 'dark';

    const styles = {
      purple: isDark
        ? "shadow-[0_0_25px_rgba(168,85,247,0.45)]"
        : "shadow-[0_0_18px_rgba(168,85,247,0.25)]",

      blue: isDark
        ? "shadow-[0_0_25px_rgba(59,130,246,0.45)]"
        : "shadow-[0_0_18px_rgba(59,130,246,0.25)]",

      red: isDark
        ? "shadow-[0_0_25px_rgba(239,68,68,0.45)]"
        : "shadow-[0_0_18px_rgba(239,68,68,0.25)]"
    };

    return styles[type] || "";
  }

  renderSection(title, content, color = "purple") {
    const theme = this.props.theme?.resolvedTheme;
    const isDark = theme === "dark";

    return (
      <div
        className={`
          rounded-xl border p-3 mb-3 backdrop-blur-md
          ${this.getGlow(color)}
          ${isDark ? "bg-black/40 border-white/10" : "bg-white/70 border-gray-200"}
        `}
      >
        <p className={`text-xs uppercase tracking-wider mb-2
          ${isDark ? "text-gray-400" : "text-gray-500"}
        `}>
          {title}
        </p>

        {content}
      </div>
    );
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const theme = this.props.theme?.resolvedTheme;
    const isDark = theme === "dark";

    const bg = isDark
      ? "bg-[#05060a] text-white"
      : "bg-gray-50 text-gray-900";

    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${bg}`}>

        <div className="w-full max-w-xl">

          {/* HEADER */}
          <div className="text-center mb-6">

            <div
              className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center
              ${this.getGlow("red")} bg-red-500/20`}
            >
              <span className="text-2xl">💥</span>
            </div>

            <h1 className="text-2xl font-bold mt-4">
              System Crash Detected
            </h1>

            <p className={`text-sm mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Arvdoul runtime boundary captured a fatal exception
            </p>

            <p className="text-[11px] text-gray-500 mt-2">
              Crash ID: {Date.now()}
            </p>

          </div>

          {/* ERROR */}
          {this.renderSection(
            "Error Message",
            <p className="text-red-400 font-medium break-words">
              {this.state.error?.message || "Unknown error"}
            </p>,
            "red"
          )}

          {/* STACK */}
          {this.state.error?.stack &&
            this.renderSection(
              "Stack Trace",
              <pre className="text-[11px] text-purple-400 overflow-auto whitespace-pre-wrap">
                {this.state.error.stack}
              </pre>,
              "purple"
            )}

          {/* COMPONENT TRACE */}
          {this.state.errorInfo?.componentStack &&
            this.renderSection(
              "Component Trace",
              <pre className="text-[11px] text-blue-400 overflow-auto whitespace-pre-wrap">
                {this.state.errorInfo.componentStack}
              </pre>,
              "blue"
            )}

          {/* ACTIONS */}
          <div className="space-y-3 mt-5">

            <button
              onClick={this.handleRecover}
              className={`w-full py-3 rounded-xl font-semibold text-white
              bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600
              ${this.getGlow("purple")} transition hover:scale-[1.02]`}
            >
              Auto Recover System
            </button>

            <button
              onClick={this.handleCopy}
              className={`w-full py-3 rounded-xl font-semibold text-white
              bg-gradient-to-r from-blue-600 to-cyan-500
              ${this.getGlow("blue")} transition hover:scale-[1.02]`}
            >
              {this.state.copied ? "Copied ✔" : "Copy Error Report"}
            </button>

            <button
              onClick={this.handleReload}
              className={`w-full py-3 rounded-xl font-semibold
              ${isDark ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-900"}
              transition hover:scale-[1.02]`}
            >
              Reload App
            </button>

            <button
              onClick={this.handleReset}
              className={`w-full py-3 rounded-xl font-semibold text-red-500
              bg-red-500/10 border border-red-500/30
              ${this.getGlow("red")}
              transition hover:scale-[1.02]`}
            >
              Clear Cache & Reset
            </button>

          </div>

          {/* FOOTER */}
          <div className="mt-6 text-center text-[11px] text-gray-500">
            Recovery Attempts: {this.state.recoveryAttempts}
          </div>

        </div>
      </div>
    );
  }
}

export default withTheme(GlobalErrorBoundaryBase);
