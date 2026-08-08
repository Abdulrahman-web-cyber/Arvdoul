// src/services/postService.js
import { getFirestoreService, firestoreService } from './firestoreService.js';
import { getFeedService, feedService } from './feedService.js';

class PostService {
  constructor() {
    this.fs = getFirestoreService();
    this.feed = getFeedService();
  }

  async createPost(postData) {
    return await this.fs.createPost(postData);
  }

  async getPost(postId) {
    return await this.fs.getPost(postId);
  }

  async deletePost(postId, userId) {
    return await this.fs.deletePost(postId, userId);
  }

  async likePost(postId, userId) {
    return await this.fs.likePost(postId, userId);
  }

  async unlikePost(postId, userId) {
    return await this.fs.unlikePost(postId, userId);
  }
}

let instance = null;

export const getPostService = () => {
  if (!instance) {
    instance = new PostService();
  }
  return instance;
};

export const postService = {
  createPost: (data) => getPostService().createPost(data),
  getPost: (id) => getPostService().getPost(id),
  deletePost: (id, userId) => getPostService().deletePost(id, userId),
  likePost: (id, userId) => getPostService().likePost(id, userId),
  unlikePost: (id, userId) => getPostService().unlikePost(id, userId)
};

export default getPostService;
