import React, { Component } from "react";
import { AlertCircle, RefreshCw, Layers, MessageSquare, User, Image, Sparkles } from "lucide-react";

/**
 * SectionErrorBoundary - Catches runtime exceptions in isolated UI sections
 * without crashing the main application or kicking the user out of their session.
 */
export class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn(`[SectionErrorBoundary:${this.props.sectionName || "Section"}] caught error:`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { sectionName = "Section", icon: Icon = AlertCircle } = this.props;

      return (
        <div className="p-6 rounded-2xl bg-white dark:bg-[#080F2E] border border-gray-200/80 dark:border-gray-800/80 shadow-sm text-center my-4">
          <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 mx-auto flex items-center justify-center mb-3">
            <Icon className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-gray-900 dark:text-white mb-1">
            Unable to display {sectionName}
          </h4>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-4">
            A temporary issue occurred while loading this section.
          </p>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold shadow-sm transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try again
          </button>
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
