// src/screens/Event/EventDiscoveryScreen.jsx - ARVDOUL EVENT DISCOVERY
// ✅ Browse and search events
// ✅ Filter by type, date, location
// ✅ View upcoming and past events

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { 
  Search, Plus, Calendar, MapPin, Users, Filter, 
  Clock, ChevronRight, X, Video, Globe, Ticket,
  Sparkles, TrendingUp, Grid, List
} from 'lucide-react';
import { getEventService } from '../../services/eventService';
import { useAuth } from '../../context/AuthContext';
import Skeleton from 'react-loading-skeleton';
import { format } from 'date-fns';

const EventDiscoveryScreen = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const eventService = getEventService();

  // State
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all, upcoming, live, past
  const [type, setType] = useState('all'); // all, digital, physical, hybrid
  const [sortBy, setSortBy] = useState('upcoming');
  const [viewMode, setViewMode] = useState('grid');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [myEvents, setMyEvents] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  // Load events
  const loadEvents = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      const currentPage = reset ? 1 : page;
      
      const options = {
        page: currentPage,
        sortBy
      };

      if (type !== 'all') {
        options.type = type;
      }

      if (filter === 'upcoming') {
        options.status = ['published', 'open'];
      } else if (filter === 'live') {
        options.status = ['live'];
      }

      const result = await eventService.listEvents(options);

      if (reset) {
        setEvents(result.events);
      } else {
        setEvents(prev => [...prev, ...result.events]);
      }
      
      setHasMore(result.hasMore);
      setPage(currentPage + 1);
    } catch (error) {
      console.error('Failed to load events:', error);
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [eventService, page, sortBy, type, filter]);

  // Load user's events
  const loadMyEvents = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      const registrations = await eventService.getUserRegistrations(user.uid);
      const organized = await eventService.getOrganizedEvents(user.uid);
      setMyEvents([...registrations, ...organized]);
    } catch (error) {
      console.error('Failed to load my events:', error);
    }
  }, [eventService, user?.uid]);

  // Initial load
  useEffect(() => {
    loadEvents(true);
    loadMyEvents();
  }, [sortBy, type, filter]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      loadEvents(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load more
  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadEvents(false);
    }
  }, [loading, hasMore, loadEvents]);

  // Get event type icon
  const getTypeIcon = (eventType) => {
    switch (eventType) {
      case 'digital':
        return <Video className="w-4 h-4 text-blue-500" />;
      case 'physical':
        return <MapPin className="w-4 h-4 text-green-500" />;
      case 'hybrid':
        return <Globe className="w-4 h-4 text-purple-500" />;
      default:
        return <Calendar className="w-4 h-4" />;
    }
  };

  // Event status badge
  const getStatusBadge = (event) => {
    const now = new Date();
    const start = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
    const end = event.endDate?.toDate ? event.endDate.toDate() : new Date(event.endDate);

    if (now >= start && now <= end) {
      return { text: 'Live Now', className: 'bg-red-500 text-white' };
    }
    if (event.status === 'ended') {
      return { text: 'Ended', className: 'bg-gray-500 text-white' };
    }
    if (event.status === 'cancelled') {
      return { text: 'Cancelled', className: 'bg-red-500/80 text-white' };
    }
    if (event.capacity > 0 && event.stats?.attendeeCount >= event.capacity) {
      return { text: 'Sold Out', className: 'bg-amber-500 text-white' };
    }
    return null;
  };

  // Event card component
  const EventCard = ({ event, isList = false }) => {
    const statusBadge = getStatusBadge(event);
    const startDate = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);

    return (
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
        onClick={() => navigate(`/event/${event.id}`)}
      >
        {/* Cover Image */}
        <div className={`relative ${isList ? 'w-48 h-32' : 'h-48'}`}>
          {event.coverImage ? (
            <img 
              src={event.coverImage} 
              alt={event.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Calendar className="w-12 h-12 text-white/50" />
            </div>
          )}
          
          {/* Status Badge */}
          {statusBadge && (
            <div className="absolute top-2 left-2 px-2 py-1 text-xs font-medium rounded-full ${statusBadge.className}">
              {statusBadge.text}
            </div>
          )}

          {/* Type Badge */}
          <div className="absolute top-2 right-2 p-1.5 bg-black/50 backdrop-blur-sm rounded-full">
            {getTypeIcon(event.type)}
          </div>
        </div>

        {/* Content */}
        <div className={`p-4 ${isList ? 'flex-1' : ''}`}>
          {/* Date */}
          <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 mb-2">
            <Calendar className="w-4 h-4" />
            <span>{format(startDate, 'EEE, MMM d, yyyy')}</span>
            <span>•</span>
            <Clock className="w-4 h-4" />
            <span>{format(startDate, 'h:mm a')}</span>
          </div>

          {/* Title */}
          <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
            {event.title}
          </h3>

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500 dark:text-gray-400">
              <MapPin className="w-4 h-4" />
              <span className="truncate">{event.location}</span>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>
                {event.stats?.attendeeCount || 0}
                {event.capacity > 0 && ` / ${event.capacity}`}
              </span>
            </div>
            {event.tickets?.isFree === false && (
              <div className="flex items-center gap-1">
                <Ticket className="w-4 h-4" />
                <span>Paid</span>
              </div>
            )}
          </div>

          {/* Arrow */}
          <ChevronRight className="absolute bottom-4 right-4 w-5 h-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Events
            </h1>
            
            {isAuthenticated && (
              <button
                onClick={() => navigate('/event/create')}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span>Create Event</span>
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
                placeholder="Search events..."
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
                  {/* Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Time
                    </label>
                    <div className="flex gap-2">
                      {[
                        { value: 'all', label: 'All', icon: Sparkles },
                        { value: 'upcoming', label: 'Upcoming', icon: Calendar },
                        { value: 'live', label: 'Live', icon: TrendingUp }
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

                  {/* Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Type
                    </label>
                    <div className="flex gap-2">
                      {[
                        { value: 'all', label: 'All' },
                        { value: 'digital', label: 'Digital' },
                        { value: 'physical', label: 'Physical' },
                        { value: 'hybrid', label: 'Hybrid' }
                      ].map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => setType(value)}
                          className={`
                            px-3 py-2 rounded-lg text-sm font-medium transition-colors
                            ${type === value
                              ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}
                          `}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sort */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Sort by
                    </label>
                    <div className="flex gap-2">
                      {[
                        { value: 'upcoming', label: 'Soonest' },
                        { value: 'popular', label: 'Popular' },
                        { value: 'recent', label: 'Recently Added' }
                      ].map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() => setSortBy(value)}
                          className={`
                            px-3 py-2 rounded-lg text-sm font-medium transition-colors
                            ${sortBy === value
                              ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}
                          `}
                        >
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
        {/* My Events */}
        {myEvents.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Your Events
            </h2>
            <div className={`grid gap-4 ${viewMode === 'grid' ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : ''}`}>
              {myEvents.slice(0, 4).map(event => (
                <EventCard 
                  key={event.id} 
                  event={event} 
                  isList={viewMode === 'list'}
                />
              ))}
            </div>
          </div>
        )}

        {/* All Events */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
            {searchQuery ? `Results for "${searchQuery}"` : 'Discover Events'}
          </h2>
          
          {loading && events.length === 0 ? (
            <div className={`grid gap-4 ${viewMode === 'grid' ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : ''}`}>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden">
                  <Skeleton height={viewMode === 'list' ? 128 : 192} />
                  <div className="p-4">
                    <Skeleton height={20} width="40%" className="mb-2" />
                    <Skeleton height={24} width="80%" />
                    <Skeleton height={16} width="60%" className="mt-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Calendar className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No events found
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {searchQuery 
                  ? 'Try adjusting your search or filters'
                  : 'Be the first to create an event!'}
              </p>
              {isAuthenticated && (
                <button
                  onClick={() => navigate('/event/create')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Create Event
                </button>
              )}
            </div>
          ) : (
            <>
              <div className={`grid gap-4 ${viewMode === 'grid' ? 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : ''}`}>
                <AnimatePresence mode="popLayout">
                  {events.map(event => (
                    <EventCard 
                      key={event.id} 
                      event={event} 
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

export default EventDiscoveryScreen;
