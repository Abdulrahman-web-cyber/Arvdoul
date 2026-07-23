// src/screens/Community/CommunityDirectoryScreen.jsx - ARVDOUL COMMUNITY DIRECTORY
// ✅ Browse and search communities
// ✅ Filter by privacy type
// ✅ Sort by popularity, newest, active

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { 
  Search, Plus, Filter, Grid, List, Users, TrendingUp, Clock, 
  Lock, Globe, Shield, ChevronRight, X, Sparkles
} from 'lucide-react';
import { getCommunityService } from '../../services/communityService';
import { useAuth } from '../../context/AuthContext';
import Skeleton from 'react-loading-skeleton';

const CommunityDirectoryScreen = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const communityService = getCommunityService();

  // State
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all, public, private, secret
  const [sortBy, setSortBy] = useState('popular'); // popular, newest, active
  const [viewMode, setViewMode] = useState('grid'); // grid, list
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [myCommunities, setMyCommunities] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  // Load communities
  const loadCommunities = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      const currentPage = reset ? 1 : page;
      
      const result = await communityService.listCommunities({
        page: currentPage,
        sortBy,
        filter: filter === 'all' ? null : filter,
        searchQuery
      });

      if (reset) {
        setCommunities(result.communities);
      } else {
        setCommunities(prev => [...prev, ...result.communities]);
      }
      
      setHasMore(result.hasMore);
      setPage(currentPage + 1);
    } catch (error) {
      console.error('Failed to load communities:', error);
      toast.error('Failed to load communities');
    } finally {
      setLoading(false);
    }
  }, [communityService, page, sortBy, filter, searchQuery]);

  // Load user's communities
  const loadMyCommunities = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      const communities = await communityService.getUserCommunities(user.uid);
      setMyCommunities(communities);
    } catch (error) {
      console.error('Failed to load my communities:', error);
    }
  }, [communityService, user?.uid]);

  // Initial load
  useEffect(() => {
    loadCommunities(true);
    loadMyCommunities();
  }, [sortBy, filter]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery || true) {
        loadCommunities(true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load more
  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadCommunities(false);
    }
  }, [loading, hasMore, loadCommunities]);

  // Privacy icon
  const getPrivacyIcon = (privacy) => {
    switch (privacy) {
      case 'public':
        return <Globe className="w-4 h-4 text-green-500" />;
      case 'private':
        return <Lock className="w-4 h-4 text-yellow-500" />;
      case 'secret':
        return <Shield className="w-4 h-4 text-purple-500" />;
      default:
        return <Globe className="w-4 h-4" />;
    }
  };

  // Community card component
  const CommunityCard = ({ community, isList = false }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`
        group relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden
        border border-gray-200 dark:border-gray-700
        hover:border-indigo-300 dark:hover:border-indigo-600
        transition-all duration-300 cursor-pointer
        ${isList ? 'flex' : ''}
      `}
      onClick={() => navigate(`/community/${community.id}`)}
    >
      {/* Cover Image */}
      <div className={`relative ${isList ? 'w-32 h-32' : 'h-32'}`}>
        {community.cover ? (
          <img 
            src={community.cover} 
            alt={community.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600" />
        )}
        
        {/* Privacy Badge */}
        <div className="absolute top-2 right-2 p-1.5 bg-black/50 backdrop-blur-sm rounded-full">
          {getPrivacyIcon(community.privacy)}
        </div>

        {/* Avatar */}
        <div className="absolute -bottom-8 left-4">
          <div className="w-16 h-16 rounded-full border-4 border-white dark:border-gray-800 overflow-hidden bg-white">
            {community.avatar ? (
              <img 
                src={community.avatar} 
                alt={community.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold">
                {community.name?.charAt(0)?.toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={`p-4 ${isList ? 'flex-1 ml-20' : 'pt-12'}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {community.name}
            </h3>
            {community.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                {community.description}
              </p>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{(community.stats?.memberCount || 0).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            <span>{community.stats?.activityScore || 0} activity</span>
          </div>
        </div>

        {/* Tags */}
        {community.tags && community.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {community.tags.slice(0, 3).map((tag, index) => (
              <span 
                key={index}
                className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Communities
            </h1>
            
            {isAuthenticated && (
              <button
                onClick={() => navigate('/community/create')}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>Create</span>
              </button>
            )}
          </div>

          {/* Search & Filters */}
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search communities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              )}
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`
                flex items-center gap-2 px-4 py-3 rounded-xl border transition-colors
                ${showFilters 
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400' 
                  : 'bg-gray-100 dark:bg-gray-700 border-transparent text-gray-700 dark:text-gray-300'}
              `}
            >
              <Filter className="w-5 h-5" />
              <span>Filters</span>
            </button>

            {/* View Toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''}`}
              >
                <Grid className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''}`}
              >
                <List className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
            </div>
          </div>

          {/* Filter Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-4 pb-2 flex flex-wrap gap-4">
                  {/* Sort */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Sort by
                    </label>
                    <div className="flex gap-2">
                      {[
                        { value: 'popular', label: 'Popular', icon: TrendingUp },
                        { value: 'newest', label: 'Newest', icon: Clock },
                        { value: 'active', label: 'Active', icon: Sparkles }
                      ].map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          onClick={() => setSortBy(value)}
                          className={`
                            flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                            ${sortBy === value
                              ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}
                          `}
                        >
                          <Icon className="w-4 h-4" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Privacy Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Privacy
                    </label>
                    <div className="flex gap-2">
                      {[
                        { value: 'all', label: 'All', icon: Globe },
                        { value: 'public', label: 'Public', icon: Globe },
                        { value: 'private', label: 'Private', icon: Lock },
                        { value: 'secret', label: 'Secret', icon: Shield }
                      ].map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          onClick={() => setFilter(value)}
                          className={`
                            flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                            ${filter === value
                              ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}
                          `}
                        >
                          <Icon className="w-4 h-4" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* My Communities */}
        {myCommunities.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Your Communities
            </h2>
            <div className={`grid gap-4 ${viewMode === 'grid' ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : ''}`}>
              {myCommunities.slice(0, 4).map(community => (
                <CommunityCard 
                  key={community.id} 
                  community={community} 
                  isList={viewMode === 'list'}
                />
              ))}
            </div>
          </div>
        )}

        {/* All Communities */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            {searchQuery ? `Results for "${searchQuery}"` : 'Discover Communities'}
          </h2>
          
          {loading && communities.length === 0 ? (
            <div className={`grid gap-4 ${viewMode === 'grid' ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : ''}`}>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden">
                  <Skeleton height={viewMode === 'list' ? 128 : 160} />
                  <div className="p-4">
                    <Skeleton height={24} width="60%" />
                    <Skeleton height={16} width="80%" className="mt-2" />
                    <div className="flex gap-4 mt-3">
                      <Skeleton height={16} width={60} />
                      <Skeleton height={16} width={60} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : communities.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No communities found
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {searchQuery 
                  ? 'Try adjusting your search or filters'
                  : 'Be the first to create a community!'}
              </p>
              {isAuthenticated && (
                <button
                  onClick={() => navigate('/community/create')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Create Community
                </button>
              )}
            </div>
          ) : (
            <>
              <div className={`grid gap-4 ${viewMode === 'grid' ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : ''}`}>
                <AnimatePresence mode="popLayout">
                  {communities.map(community => (
                    <CommunityCard 
                      key={community.id} 
                      community={community} 
                      isList={viewMode === 'list'}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="mt-8 text-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="px-8 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommunityDirectoryScreen;
