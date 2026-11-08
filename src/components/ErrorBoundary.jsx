import React from 'react';

/**
 * Generic error boundary.
 *
 * `fallback` accepts either a node or a render function. A function fallback
 * is called with `{ error, reset }` so the caller can offer a retry; a node
 * fallback renders as-is. Rendering the function directly (the previous
 * behaviour) threw "Functions are not valid as a React child" while handling a
 * crash, so the feed's retry UI never appeared.
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
    if (this.props.onError) this.props.onError(error, errorInfo);
    else console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { fallback } = this.props;
    if (typeof fallback === 'function') {
      return fallback({ error: this.state.error, reset: this.reset });
    }
    return (
      fallback || (
        <div className="p-4 text-red-500">
          Something went wrong.
        </div>
      )
    );
  }
}

export default ErrorBoundary;
