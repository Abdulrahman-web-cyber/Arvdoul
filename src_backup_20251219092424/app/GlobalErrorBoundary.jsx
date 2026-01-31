// src/app/GlobalErrorBoundary.jsx
import React from "react";
import FatalError from "../components/System/FatalError.jsx";

/**
 * GlobalErrorBoundary
 * - Catches render-time errors and shows a friendly, actionable UI
 * - Good place to integrate Sentry/LogRocket later (calls `reportError`)
 */

export default class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Persist error to console (and later to remote logging)
    console.error("[ARVDOUL][GlobalErrorBoundary] caught:", error, info);

    // Hook point: send to analytics or error-tracking service
    if (typeof window !== "undefined" && window.__ARVDOUL_REPORT_ERROR__) {
      try {
        window.__ARVDOUL_REPORT_ERROR__(error, info);
      } catch (e) {
        console.warn("Error reporting failed", e);
      }
    }

    this.setState({ info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <FatalError
          title="Unexpected error"
          error={this.state.error}
          details={this.state.info}
        />
      );
    }

    return this.props.children;
  }
}