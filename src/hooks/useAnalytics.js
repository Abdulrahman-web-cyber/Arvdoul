// src/hooks/useAnalytics.js
/**
 * Professional Analytics Hook
 * Battery optimized event tracking
 */

export const useAnalytics = () => {
  const track = (event, data = {}) => {
    // Don't track if user prefers reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    // Track event
    const analyticsData = {
      event,
      timestamp: new Date().toISOString(),
      ...data,
      path: window.location.pathname,
      screen: `${window.innerWidth}x${window.innerHeight}`
    };
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Analytics Event:', analyticsData);
    }
    
    // TODO: Integrate with your analytics service
    // Example: Firebase Analytics, Google Analytics, etc.
  };

  const trackPageView = (pageName) => {
    track('page_view', { page: pageName });
  };

  const trackError = (error, context = {}) => {
    track('error', { error: error.message, ...context });
  };

  return { track, trackPageView, trackError };
};
