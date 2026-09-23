import React, { Component } from "react";
import { 
  AlertCircle, 
  RefreshCw, 
  Layers, 
  MessageSquare, 
  User, 
  Image, 
  Sparkles, 
  Home, 
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ShieldAlert
} from "lucide-react";

/**
 * SectionErrorBoundary - Catches runtime exceptions in isolated UI sections
 * without crashing the main application or kicking the user out of their session.
 * Styled with ARVDOUL premium dark/light glass aesthetic.
 */
export class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      retryCount: 0, 
      isRetrying: false,
      showDetails: false,
      copied: false
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn(`[SectionErrorBoundary:${this.props.sectionName || "Section"}] caught error:`, error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    const nextRetry = (this.state.retryCount || 0) + 1;
    this.setState({ isRetrying: true });

    // Self-healing: heal corrupted local storage entries
    try {
      if (typeof window !== 'undefined') {
        const suspectKeys = ['user', 'authUser', 'profile', 'theme'];
        suspectKeys.forEach((k) => {
          const raw = localStorage.getItem(k);
          if (raw === 'undefined' || raw === '[object Object]' || raw === 'null') {
            localStorage.removeItem(k);
          }
        });
      }
    } catch {
      // Ignore storage errors
    }

    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch (err) {
        console.warn('onReset callback note:', err);
      }
    }

    setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
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
      window.location.href = '/home';
    }
  };

  handleCopyError = () => {
    const errText = `${this.state.error?.name || 'Error'}: ${this.state.error?.message || 'Unknown error'}\n${this.state.error?.stack || ''}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(errText).then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      }).catch(() => {});
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { sectionName = "Section", icon: Icon = AlertCircle } = this.props;
      const { retryCount, isRetrying, error, showDetails, copied } = this.state;
      const errorMessage = error?.message || "A temporary issue occurred while rendering this view.";

      return (
        <div className="w-full max-w-xl mx-auto my-8 px-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="relative rounded-3xl p-6 sm:p-8 bg-[#0d1424]/90 dark:bg-[#0d1424]/90 bg-white/95 border border-slate-200/90 dark:border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl text-center overflow-hidden">
            {/* Ambient Background Glow Halo */}
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              {/* Status Pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                <span>{sectionName} System Sync</span>
              </div>

              {/* Glowing Icon Container */}
              <div className="relative mx-auto w-16 h-16 rounded-2xl p-[2px] bg-gradient-to-tr from-purple-500 via-indigo-500 to-cyan-400 shadow-lg shadow-purple-500/20">
                <div className="w-full h-full rounded-2xl bg-white dark:bg-[#080d19] flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Icon className="w-8 h-8" />
                </div>
              </div>

              {/* Title & Subtitle */}
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Unable to display {sectionName}
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  A temporary synchronization hiccup occurred while preparing this section. You can retry safely without losing your state.
                </p>
              </div>

              {/* Primary & Secondary Action CTAs */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={this.handleReset}
                  disabled={isRetrying}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full font-bold text-xs sm:text-sm text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:via-indigo-500 hover:to-cyan-500 shadow-lg shadow-purple-500/25 active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                  <span>{isRetrying ? 'Syncing...' : 'Retry Loading'}</span>
                </button>

                <button
                  type="button"
                  onClick={this.handleGoHome}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full font-semibold text-xs sm:text-sm text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 border border-slate-200/80 dark:border-white/10 transition-all active:scale-95 cursor-pointer"
                >
                  <Home className="w-4 h-4" />
                  <span>Return Home</span>
                </button>

                {retryCount > 0 && (
                  <button
                    type="button"
                    onClick={this.handleReload}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full font-semibold text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reload Page</span>
                  </button>
                )}
              </div>

              {/* Diagnostic Collapsible Accordion (Premium Dev & Tech Support Experience) */}
              {error && (
                <div className="pt-2 text-left">
                  <button
                    type="button"
                    onClick={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-400 transition-colors mx-auto block"
                  >
                    <span>{showDetails ? 'Hide Diagnostics' : 'View Diagnostics'}</span>
                    {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {showDetails && (
                    <div className="mt-3 p-3.5 rounded-2xl bg-slate-950/90 dark:bg-black/80 border border-slate-800 text-slate-300 text-xs font-mono relative overflow-hidden">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-[10px] uppercase tracking-wider text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                          <span>Technical Details</span>
                        </div>
                        <button
                          type="button"
                          onClick={this.handleCopyError}
                          className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 transition-colors"
                          title="Copy details"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copied ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <p className="text-rose-400 font-semibold text-[11px] break-all">
                        {errorMessage}
                      </p>
                      {error?.stack && (
                        <pre className="mt-2 text-[10px] text-slate-500 overflow-x-auto max-h-32 scrollbar-thin">
                          {error.stack.split('\n').slice(0, 5).join('\n')}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
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
