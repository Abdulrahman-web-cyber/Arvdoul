// src/services/postService.js

import { getFirestoreService } from "./firestoreService.js";
import { getFeedService } from "./feedService.js";

class PostService {
  constructor() {
    this.fs = getFirestoreService();
    this.feed = getFeedService();
  }

  async ensureInitialized() {
    if (this.fs?.ensureInitialized) {
      await this.fs.ensureInitialized();
    }
    return this;
  }

  async _ensureInitialized() {
    return this.ensureInitialized();
  }

  async ensureinitialize() {
    return this.ensureInitialized();
  }

  async _ensureinitialize() {
    return this.ensureInitialized();
  }

  async createPost(postData) {
    return await this.fs.createPost(postData);
  }

  async getPost(postId) {
    // firestoreService returns a `{ success, post }` envelope; the service
    // contract is the post itself (or a thrown error). Callers read
    // `post.stats`/`post.views` directly, so returning the envelope silently
    // made every metric read undefined.
    const res = await this.fs.getPost(postId);
    if (!res?.success || !res.post) {
      const err = new Error(res?.error || 'Post not found');
      err.code = res?.code || 'not-found';
      throw err;
    }
    return res.post;
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

  async savePost(postId, userId) {
    return await this.fs.savePost(postId, userId);
  }

  async unsavePost(postId, userId) {
    return await this.fs.unsavePost(postId, userId);
  }

  async sharePost(postId, userId) {
    return await this.fs.sharePost(postId, userId);
  }

  async addReaction(postId, userId, reaction) {
    return await this.fs.addReaction(postId, userId, reaction);
  }

  async removeReaction(postId, userId) {
    return await this.fs.removeReaction(postId, userId);
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
  ensureInitialized: () => getPostService().ensureInitialized(),
  _ensureInitialized: () => getPostService().ensureInitialized(),
  ensureinitialize: () => getPostService().ensureInitialized(),
  _ensureinitialize: () => getPostService().ensureInitialized(),
  createPost: (data) => getPostService().createPost(data),
  getPost: (id) => getPostService().getPost(id),
  deletePost: (id, userId) => getPostService().deletePost(id, userId),
  likePost: (id, userId) => getPostService().likePost(id, userId),
  unlikePost: (id, userId) => getPostService().unlikePost(id, userId),
  savePost: (id, userId) => getPostService().savePost(id, userId),
  unsavePost: (id, userId) => getPostService().unsavePost(id, userId),
  sharePost: (id, userId) => getPostService().sharePost(id, userId),
  addReaction: (id, userId, reaction) => getPostService().addReaction(id, userId, reaction),
  removeReaction: (id, userId) => getPostService().removeReaction(id, userId)
};

export default getPostService;
