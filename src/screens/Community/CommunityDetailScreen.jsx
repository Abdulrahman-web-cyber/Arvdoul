// src/screens/Community/CommunityDetailScreen.jsx - ARVDOUL COMMUNITY DETAIL
// ✅ View community info, posts, members
// ✅ Join/Leave community
// ✅ Access to spaces and channels

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { 
  ArrowLeft, Users, Calendar, Settings, Shield, 
  Globe, Lock, Plus, MoreVertical, UserPlus, UserMinus,
  MessageCircle, FileText, Image as ImageIcon, Video,
  Send, Bell, BellOff, Share2, Bookmark, Flag
} from 'lucide-react';
import { getCommunityService } from '../../services/communityService';
import { useAuth } from '../../context/AuthContext';

const CommunityDetailScreen = () => {
  const { communityId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const communityService = getCommunityService();

  // State
  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('feed');
  const [posts, setPosts] = useState([]);
  const [members, setMembers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isMember, setIsMember] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Load community
  const loadCommunity = useCallback(async () => {
    try {
      setLoading(true);
      
      const data = await communityService.getCommunity(communityId);
      if (!data) {
        toast.error('Community not found');
        navigate('/community');
        return;
      }

      setCommunity(data);

      // Check membership
      if (user?.uid) {
        const membership = data.members?.[user.uid];
        setIsMember(!!membership);
        setIsAdmin(['owner', 'admin', 'moderator'].includes(membership?.role));
      }

      // Load posts
      if (data.privacy === 'public' || data.members?.[user?.uid]) {
        const communityPosts = await communityService.getCommunityPosts(communityId);
        setPosts(communityPosts);
      }

      // Load members
      const memberList = Object.entries(data.members || {}).map(([id, data]) => ({
        id,
        ...data
      }));
      setMembers(memberList.slice(0, 12)); // Show first 12

    } catch (error) {
      console.error('Failed to load community:', error);
      toast.error('Failed to load community');
    } finally {
      setLoading(false);
    }
  }, [communityId, user?.uid, communityService, navigate]);

  // Initial load
  useEffect(() => {
    loadCommunity();
  }, [loadCommunity]);

  // Subscribe to updates
  useEffect(() => {
    if (!communityId) return;

    const unsubscribe = communityService.subscribeToCommunity(communityId, (updated) => {
      setCommunity(prev => ({ ...prev, ...updated }));
    });

    return () => unsubscribe();
  }, [communityId, communityService]);

  // Subscribe to pending requests (for admins)
  useEffect(() => {
    if (!communityId || !isAdmin) return;

    const unsubscribe = communityService.subscribeToPendingRequests(communityId, (requests) => {
      setPendingRequests(requests);
    });

    return () => unsubscribe();
  }, [communityId, isAdmin, communityService]);

  // Handle join/leave
  const handleJoinLeave = useCallback(async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to join this community');
      return;
    }

    try {
      if (isMember) {
        await communityService.leaveCommunity(communityId, user.uid);
        toast.success('Left community');
        setIsMember(false);
      } else if (community.privacy === 'public') {
        const result = await communityService.joinCommunity(communityId, user.uid);
        if (result.requiresApproval) {
          toast.info('Your request has been sent for approval');
        } else {
          toast.success('Joined community!');
        }
        setIsMember(true);
      } else {
        await communityService.requestToJoin(communityId, user.uid);
        toast.info('Join request sent');
      }
      loadCommunity();
    } catch (error) {
      console.error('Failed to join/leave:', error);
      toast.error(error.message || 'Failed to update membership');
    }
  }, [isAuthenticated, isMember, community, communityId, user?.uid, communityService, loadCommunity]);

  // Get role badge color
  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300';
      case 'admin':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300';
      case 'moderator':
        return 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  // Privacy icon
  const PrivacyIcon = community?.privacy === 'private' ? Lock : 
                      community?.privacy === 'secret' ? Shield : Globe;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Community not found
          </h2>
          <button
            onClick={() => navigate('/community')}
            className="text-indigo-600 hover:text-indigo-700"
          >
            Back to Communities
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                {community.avatar ? (
                  <img src={community.avatar} alt={community.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                    {community.name?.charAt(0)?.toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <h1 className="font-bold text-gray-900 dark:text-white">{community.name}</h1>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <PrivacyIcon className="w-3 h-3" />
                  <span>{community.privacy}</span>
                  <span>•</span>
                  <span>{(community.stats?.memberCount || 0).toLocaleString()} members</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isMember && (
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
                <Share2 className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => navigate(`/community/${communityId}/settings`)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                <Settings className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
            )}
            {isMember ? (
              <button
                onClick={handleJoinLeave}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
              >
                <UserMinus className="w-4 h-4" />
                <span>Leave</span>
              </button>
            ) : (
              <button
                onClick={handleJoinLeave}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                <span>{community.privacy === 'public' ? 'Join' : 'Request'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-6 border-t border-gray-200 dark:border-gray-700">
            {['feed', 'about', 'members'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`
                  py-3 text-sm font-medium border-b-2 transition-colors capitalize
                  ${activeTab === tab
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}
                `}
              >
                {tab}
              </button>
            ))}
            {isAdmin && (
              <button
                onClick={() => setActiveTab('moderation')}
                className={`
                  py-3 text-sm font-medium border-b-2 transition-colors
                  ${activeTab === 'moderation'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}
                `}
              >
                Moderation
                {pendingRequests.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {pendingRequests.length}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {/* Feed Tab */}
          {activeTab === 'feed' && (
            <motion.div
              key="feed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {!isMember && community.privacy !== 'public' ? (
                <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl">
                  <Lock className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    Private Community
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    Join this community to see posts and content
                  </p>
                  <button
                    onClick={handleJoinLeave}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium"
                  >
                    Request to Join
                  </button>
                </div>
              ) : posts.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    No posts yet
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    Be the first to post in this community!
                  </p>
                  {isMember && (
                    <button
                      onClick={() => navigate(`/create-post?community=${communityId}`)}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium"
                    >
                      Create Post
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <div key={post.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                          {post.authorAvatar ? (
                            <img src={post.authorAvatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 dark:text-white">{post.authorName}</span>
                            <span className="text-sm text-gray-500">
                              {new Date(post.createdAt?.seconds * 1000).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="mt-1 text-gray-700 dark:text-gray-300">{post.content}</p>
                          {post.media && post.media.length > 0 && (
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              {post.media.slice(0, 4).map((media, i) => (
                                <div key={i} className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                                  <img src={media.url} alt="" className="w-full h-full object-cover" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* About Tab */}
          {activeTab === 'about' && (
            <motion.div
              key="about"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
                {/* Cover */}
                {community.cover && (
                  <div className="h-40 -mx-6 -mt-6 mb-6 rounded-t-2xl overflow-hidden">
                    <img src={community.cover} alt="" className="w-full h-full object-cover" />
                  </div>
                )}

                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  About
                </h2>
                
                {community.description ? (
                  <p className="text-gray-700 dark:text-gray-300 mb-6 whitespace-pre-wrap">
                    {community.description}
                  </p>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 mb-6 italic">
                    No description provided
                  </p>
                )}

                {community.rules && (
                  <>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                      Community Rules
                    </h3>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl mb-6">
                      <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 text-sm">
                        {community.rules}
                      </pre>
                    </div>
                  </>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <div className="text-2xl font-bold text-indigo-600">
                      {community.stats?.memberCount || 0}
                    </div>
                    <div className="text-sm text-gray-500">Members</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <div className="text-2xl font-bold text-indigo-600">
                      {community.stats?.postCount || 0}
                    </div>
                    <div className="text-sm text-gray-500">Posts</div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <div className="text-2xl font-bold text-indigo-600">
                      {community.stats?.eventCount || 0}
                    </div>
                    <div className="text-sm text-gray-500">Events</div>
                  </div>
                </div>

                {/* Tags */}
                {community.tags && community.tags.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {community.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && (
            <motion.div
              key="members"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Members ({community.stats?.memberCount || 0})
                  </h2>
                  {isAdmin && (
                    <button
                      onClick={() => navigate(`/community/${communityId}/members`)}
                      className="text-sm text-indigo-600 hover:text-indigo-700"
                    >
                      View all
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      onClick={() => navigate(`/profile/${member.id}`)}
                    >
                      <div className="w-16 h-16 mx-auto rounded-full bg-gray-200 overflow-hidden mb-3">
                        <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500" />
                      </div>
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {member.displayName || 'User'}
                      </p>
                      <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${getRoleBadgeColor(member.role)}`}>
                        {member.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Moderation Tab */}
          {activeTab === 'moderation' && isAdmin && (
            <motion.div
              key="moderation"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Pending Requests */}
              {pendingRequests.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 mb-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                    Pending Requests ({pendingRequests.length})
                  </h2>
                  <div className="space-y-3">
                    {pendingRequests.map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-200" />
                          <span className="font-medium text-gray-900 dark:text-white">
                            User {request.id.slice(0, 8)}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => communityService.approveJoinRequest(communityId, request.id, user.uid)}
                            className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => communityService.rejectJoinRequest(communityId, request.id, user.uid)}
                            className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Moderation Actions */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Moderation Tools
                </h2>

                <div className="space-y-4">
                  {/* Content Approval */}
                  <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl cursor-pointer">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Content Approval</p>
                        <p className="text-sm text-gray-500">Posts require approval before going live</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={community.moderation?.contentApproval}
                      onChange={async (e) => {
                        if (e.target.checked) {
                          await communityService.enableContentApproval(communityId, user.uid);
                        } else {
                          await communityService.disableContentApproval(communityId, user.uid);
                        }
                        loadCommunity();
                      }}
                      className="w-5 h-5 rounded text-indigo-600"
                    />
                  </label>

                  {/* Slow Mode */}
                  <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl cursor-pointer">
                    <div className="flex items-center gap-3">
                      <MessageCircle className="w-5 h-5 text-gray-500" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Slow Mode</p>
                        <p className="text-sm text-gray-500">Limit message frequency</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={community.moderation?.slowMode}
                      onChange={async (e) => {
                        if (e.target.checked) {
                          await communityService.enableSlowMode(communityId, 10, user.uid);
                        } else {
                          await communityService.disableSlowMode(communityId, user.uid);
                        }
                        loadCommunity();
                      }}
                      className="w-5 h-5 rounded text-indigo-600"
                    />
                  </label>

                  {/* Banned Users */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-gray-500" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Banned Users</p>
                          <p className="text-sm text-gray-500">
                            {community.moderation?.bannedUsers?.length || 0} banned
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/community/${communityId}/bans`)}
                        className="text-sm text-indigo-600 hover:text-indigo-700"
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CommunityDetailScreen;
