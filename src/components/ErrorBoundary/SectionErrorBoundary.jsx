import React, { Component } from "react";
import { AlertCircle, RefreshCw, Layers, MessageSquare, User, Image, Sparkles, Home, RotateCcw } from "lucide-react";

/**
 * SectionErrorBoundary - Catches runtime exceptions in isolated UI sections
 * without crashing the main application or kicking the user out of their session.
 */
export class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0, isRetrying: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn(`[SectionErrorBoundary:${this.props.sectionName || "Section"}] caught error:`, error, errorInfo);
  }

  handleReset = () => {
    const nextRetry = (this.state.retryCount || 0) + 1;
    this.setState({ isRetrying: true });

    // If local storage user key is corrupted, safely heal it
    try {
      if (typeof window !== 'undefined') {
        const rawUser = localStorage.getItem('user');
        if (rawUser === 'undefined' || rawUser === '[object Object]' || rawUser === 'null') {
          localStorage.removeItem('user');
        }
      }
    } catch {
      // Ignore
    }

    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch (err) {
        console.warn('onReset callback failed:', err);
      }
    }

    setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        retryCount: nextRetry,
        isRetrying: false,
      });
    }, 150);
  };

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { sectionName = "Section", icon: Icon = AlertCircle } = this.props;
      const { retryCount, isRetrying } = this.state;

      return (
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#0d1424] border border-gray-200/80 dark:border-white/10 shadow-xl text-center my-6 max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-500/20 to-purple-500/20 text-violet-600 dark:text-violet-400 mx-auto flex items-center justify-center mb-4 ring-1 ring-violet-500/30">
            <Icon className="w-7 h-7" />
          </div>
          <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            Unable to display {sectionName}
          </h4>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6 leading-relaxed">
            A temporary issue occurred while loading this section. You can retry loading or refresh the application.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={this.handleReset}
              disabled={isRetrying}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-violet-500/20 active:scale-95 transition-all disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
              {isRetrying ? 'Retrying...' : 'Try again'}
            </button>

            {retryCount > 0 && (
              <button
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold transition-all active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reload Page
              </button>
            )}

            <button
              onClick={this.handleGoHome}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold transition-all active:scale-95"
            >
              <Home className="w-3.5 h-3.5" />
              Feed
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const FeedErrorBoundary = (props) => (
  <SectionErrorBoundary sectionName="Feed" icon={Layers} {...props} />
);

export const PostErrorBoundary = (props) => (
  <SectionErrorBoundary sectionName="Post" icon={Image} {...props} />
);

export const ProfileErrorBoundary = (props) => (
  <SectionErrorBoundary sectionName="Profile" icon={User} {...props} />
);

export const ChatErrorBoundary = (props) => (
  <SectionErrorBoundary sectionName="Chat" icon={MessageSquare} {...props} />
);

export const CreatorErrorBoundary = (props) => (
  <SectionErrorBoundary sectionName="Creator Studio" icon={Sparkles} {...props} />
);

export default SectionErrorBoundary;
