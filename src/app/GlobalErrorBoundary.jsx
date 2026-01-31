// src/app/GlobalErrorBoundary.jsx
// 🛡️ Global error boundary with recovery options

import React, { Component } from 'react';

export default class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      recoveryAttempts: 0
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('GlobalErrorBoundary caught:', error, errorInfo);
    this.setState({ errorInfo });
    
    // Log to analytics if available
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: error.toString(),
        fatal: true
      });
    }
  }

  handleRecover = async () => {
    try {
      this.setState(prev => ({ 
        recoveryAttempts: prev.recoveryAttempts + 1,
        isRecovering: true 
      }));
      
      // Attempt to reconnect Firebase via service layer
      const { initializeFirebase } = await import('../firebase/firebase.js');
      await initializeFirebase();
      
      // Clear error state
      this.setState({ 
        hasError: false, 
        error: null, 
        errorInfo: null,
        isRecovering: false 
      });
      
    } catch (error) {
      console.error('Recovery failed:', error);
      this.setState({ isRecovering: false });
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
          <div className="max-w-md w-full text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              Application Error
            </h2>
            
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 mb-6">
              <p className="text-red-600 dark:text-red-400 font-medium">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
              {this.state.errorInfo && (
                <details className="mt-3 text-left">
                  <summary className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                    Technical details
                  </summary>
                  <pre className="mt-2 text-xs text-gray-700 dark:text-gray-300 overflow-auto p-2 bg-gray-100 dark:bg-gray-900 rounded">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            <div className="space-y-3">
              <button
                onClick={this.handleRecover}
                disabled={this.state.isRecovering}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {this.state.isRecovering ? 'Recovering...' : 'Attempt Recovery'}
              </button>
              
              <button
                onClick={this.handleReload}
                className="w-full py-3 px-4 bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                Reload Application
              </button>

              <button
                onClick={this.handleReset}
                className="w-full py-3 px-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg font-medium hover:bg-red-200 dark:hover:bg-red-800/40 transition-colors text-sm"
              >
                Clear Cache & Reload
              </button>
            </div>
            
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                If this persists, contact support@arvdoul.com
                <br />
                Recovery attempts: {this.state.recoveryAttempts}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}