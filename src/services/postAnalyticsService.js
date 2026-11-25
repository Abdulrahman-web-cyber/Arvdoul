// src/services/postAnalyticsService.js
// Server-authoritative Organic vs Paid separated post analytics reader.

import { callFunction, FUNCTIONS } from './callableService.js';

class PostAnalyticsService {
  async getPostSeparatedAnalytics(postId) {
    if (!postId) throw new Error('postId is required.');
    return callFunction(FUNCTIONS.GET_POST_SEPARATED_ANALYTICS, { postId });
  }
}

export const postAnalyticsService = new PostAnalyticsService();
export default postAnalyticsService;
