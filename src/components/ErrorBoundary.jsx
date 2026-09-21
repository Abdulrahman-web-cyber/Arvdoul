import React from 'react';

/**
 * ErrorBoundary — the canonical React error boundary for the app.
 *
 * Props:
 *  - children:  the subtree to guard.
 *  - fallback:  a node, or a function `(error, reset) => node` invoked when a
 *               descendant throws. Receives the caught error and a reset
 *               callback so callers can render their own recovery UI.
 *  - onError:   `(error, errorInfo) => void` invoked from componentDidCatch.
 *  - onReset:   `() => void` invoked after a reset is requested.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      if (typeof fallback === 'function') return fallback(this.state.error, this.reset);
      if (fallback) return fallback;
      return <div className="p-4 text-red-500">Something went wrong.</div>;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
