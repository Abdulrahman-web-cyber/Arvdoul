// src/screens/Event/EventDetailScreen.jsx - ARVDOUL EVENT DETAIL
// ✅ View event info, schedule, attendees
// ✅ Register/Unregister for event
// ✅ Real-time updates

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { 
  ArrowLeft, Calendar, MapPin, Users, Clock, Share2, 
  Ticket, Video, Globe, Settings, Check, X, MessageCircle,
  Star, UserPlus, UserMinus, ExternalLink
} from 'lucide-react';
import { getEventService } from '../../services/eventService';
import { useAuth } from '../../context/AuthContext';
import { format, formatDistanceToNow, isPast, isFuture, isToday } from 'date-fns';

const EventDetailScreen = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const eventService = getEventService();

  // State
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [stats, setStats] = useState(null);

  // Load event
  const loadEvent = useCallback(async () => {
    try {
      setLoading(true);
      
      const data = await eventService.getEvent(eventId);
      if (!data) {
        toast.error('Event not found');
        navigate('/event');
        return;
      }

      setEvent(data);

      // Set default ticket
      if (data.tickets?.tiers?.length > 0) {
        setSelectedTicket(data.tickets.tiers[0].name);
      }

      // Load stats
      const eventStats = await eventService.getEventStats(eventId);
      setStats(eventStats);

    } catch (error) {
      console.error('Failed to load event:', error);
      toast.error('Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [eventId, eventService, navigate]);

  // Initial load
  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  // Subscribe to updates
  useEffect(() => {
    if (!eventId) return;

    const unsubscribe = eventService.subscribeToEvent(eventId, (updated) => {
      setEvent(prev => ({ ...prev, ...updated }));
    });

    return () => unsubscribe();
  }, [eventId, eventService]);

  // Handle registration
  const handleRegister = useCallback(async () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to register');
      return;
    }

    setRegistering(true);
    try {
      const result = await eventService.registerForEvent(eventId, user.uid, selectedTicket);
      
      if (result.status === 'registered') {
        toast.success('Successfully registered for the event!');
      } else if (result.status === 'waitlisted') {
        toast.info('Event is full. You have been added to the waitlist.');
      }
      
      loadEvent();
    } catch (error) {
      console.error('Registration failed:', error);
      toast.error(error.message || 'Failed to register');
    } finally {
      setRegistering(false);
    }
  }, [isAuthenticated, eventId, user?.uid, selectedTicket, eventService, loadEvent]);

  // Handle cancellation
  const handleCancelRegistration = useCallback(async () => {
    try {
      await eventService.cancelRegistration(eventId, user.uid);
      toast.success('Registration cancelled');
      loadEvent();
    } catch (error) {
      console.error('Cancellation failed:', error);
      toast.error(error.message || 'Failed to cancel registration');
    }
  }, [eventId, user?.uid, eventService, loadEvent]);

  // Check registration status
  const isRegistered = event?.attendees?.[user?.uid]?.status === 'registered';
  const isWaitlisted = event?.attendees?.[user?.uid]?.status === 'waitlisted';
  const isOrganizer = event?.organizerId === user?.uid;

  // Get event status
  const getEventStatus = () => {
    if (!event?.startDate) return 'unknown';
    const start = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
    const end = event.endDate?.toDate ? event.endDate.toDate() : null;
    const now = new Date();

    if (event.status === 'cancelled') return { text: 'Cancelled', className: 'bg-red-500 text-white' };
    if (now >= start && (!end || now <= end)) return { text: 'Live Now', className: 'bg-red-500 text-white animate-pulse' };
    if (end && isPast(end)) return { text: 'Ended', className: 'bg-gray-500 text-white' };
    if (isToday(start)) return { text: 'Today', className: 'bg-amber-500 text-white' };
    if (isFuture(start)) return { text: 'Upcoming', className: 'bg-green-500 text-white' };
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Event not found
          </h2>
          <button
            onClick={() => navigate('/event')}
            className="text-indigo-600 hover:text-indigo-700"
          >
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  const startDate = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
  const endDate = event.endDate?.toDate ? event.endDate.toDate() : null;
  const status = getEventStatus();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero */}
      <div className="relative h-64 md:h-80 bg-gray-900">
        {event.coverImage ? (
          <img 
            src={event.coverImage} 
            alt={event.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-600 to-purple-700" />
        )}
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        
        {/* Status Badge */}
        {status && (
          <div className="absolute top-4 left-4 px-3 py-1.5 text-sm font-medium rounded-full ${status.className}">
            {status.text}
          </div>
        )}

        {/* Type Badge */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {event.type === 'digital' && (
            <span className="px-3 py-1.5 bg-blue-500/80 backdrop-blur-sm text-white text-sm rounded-full flex items-center gap-1">
              <Video className="w-4 h-4" />
              Digital
            </span>
          )}
          {event.type === 'physical' && (
            <span className="px-3 py-1.5 bg-green-500/80 backdrop-blur-sm text-white text-sm rounded-full flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              Physical
            </span>
          )}
          {event.type === 'hybrid' && (
            <span className="px-3 py-1.5 bg-purple-500/80 backdrop-blur-sm text-white text-sm rounded-full flex items-center gap-1">
              <Globe className="w-4 h-4" />
              Hybrid
            </span>
          )}
        </div>

        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-1/2 -translate-x-1/2 p-2 bg-white/20 backdrop-blur-sm hover:bg-white/30 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        {/* Event Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">{event.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-white/90">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                <span>{format(startDate, 'EEEE, MMMM d, yyyy')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <span>{format(startDate, 'h:mm a')}</span>
                {endDate && <span> - {format(endDate, 'h:mm a')}</span>}
              </div>
              {event.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  <span>{event.location}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                {['details', 'schedule', 'attendees'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`
                      flex-1 py-3 text-sm font-medium transition-colors capitalize
                      ${activeTab === tab
                        ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}
                    `}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {/* Details Tab */}
                {activeTab === 'details' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                      About This Event
                    </h2>
                    
                    {event.description ? (
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {event.description}
                      </p>
                    ) : (
                      <p className="text-gray-500 italic">No description provided</p>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mt-8">
                      <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                        <div className="text-2xl font-bold text-indigo-600">
                          {event.stats?.attendeeCount || 0}
                        </div>
                        <div className="text-sm text-gray-500">Attending</div>
                      </div>
                      {event.capacity > 0 && (
                        <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                          <div className="text-2xl font-bold text-indigo-600">
                            {event.capacity}
                          </div>
                          <div className="text-sm text-gray-500">Capacity</div>
                        </div>
                      )}
                      <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                        <div className="text-2xl font-bold text-indigo-600">
                          {event.stats?.waitlistCount || 0}
                        </div>
                        <div className="text-sm text-gray-500">Waitlisted</div>
                      </div>
                    </div>

                    {/* Progress bar for capacity */}
                    {event.capacity > 0 && stats && (
                      <div className="mt-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-500">Capacity</span>
                          <span className="text-gray-700 dark:text-gray-300">
                            {stats.registered} / {event.capacity}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${stats.isFull ? 'bg-red-500' : 'bg-indigo-500'}`}
                            style={{ width: `${Math.min(stats.attendeePercentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Schedule Tab */}
                {activeTab === 'schedule' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                      Event Schedule
                    </h2>
                    
                    {event.schedule && event.schedule.length > 0 ? (
                      <div className="space-y-4">
                        {event.schedule.map((item, index) => (
                          <div 
                            key={index}
                            className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl"
                          >
                            <div className="text-indigo-600 dark:text-indigo-400 font-medium">
                              {item.startTime}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{item.title}</p>
                              {item.description && (
                                <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                              )}
                              {item.speaker && (
                                <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-1">
                                  Speaker: {item.speaker}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No schedule provided</p>
                    )}
                  </motion.div>
                )}

                {/* Attendees Tab */}
                {activeTab === 'attendees' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                      Attendees
                    </h2>
                    
                    {event.attendees && Object.keys(event.attendees).length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {Object.entries(event.attendees)
                          .filter(([_, data]) => data.status !== 'waitlisted')
                          .slice(0, 16)
                          .map(([userId, data]) => (
                            <div 
                              key={userId}
                              className="p-3 bg-gray-50 dark:bg-gray-700 rounded-xl text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                              onClick={() => navigate(`/profile/${userId}`)}
                            >
                              <div className="w-16 h-16 mx-auto rounded-full bg-gray-200 mb-2">
                                <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500" />
                              </div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {data.displayName || 'User'}
                              </p>
                              {data.status === 'checked_in' && (
                                <span className="text-xs text-green-600 flex items-center justify-center gap-1 mt-1">
                                  <Check className="w-3 h-3" />
                                  Checked In
                                </span>
                              )}
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No attendees yet</p>
                    )}

                    {(event.stats?.waitlistCount || 0) > 0 && (
                      <div className="mt-6">
                        <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                          Waitlist ({event.stats.waitlistCount})
                        </h3>
                        <p className="text-sm text-gray-500">
                          {event.stats.waitlistCount} people are on the waitlist
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Registration Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 sticky top-24">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">
                {isOrganizer ? 'Event Management' : 'Register for Event'}
              </h3>

              {/* Organizer view */}
              {isOrganizer ? (
                <div className="space-y-3">
                  <button
                    onClick={() => navigate(`/event/${eventId}/edit`)}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Settings className="w-5 h-5" />
                    Edit Event
                  </button>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <p className="text-sm text-gray-500 mb-2">Share your event</p>
                    <button className="w-full py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 text-sm flex items-center justify-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                      <Share2 className="w-4 h-4" />
                      Copy Event Link
                    </button>
                  </div>
                </div>
              ) : isRegistered || isWaitlisted ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                    <Check className="w-6 h-6 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800 dark:text-green-300">
                        {isRegistered ? 'You\'re registered!' : 'On the waitlist'}
                      </p>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        {isRegistered ? 'See you there!' : 'We\'ll notify you if a spot opens up'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCancelRegistration}
                    className="w-full py-3 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-xl font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Cancel Registration
                  </button>
                </div>
              ) : event.status === 'cancelled' ? (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-center">
                  <X className="w-8 h-8 text-red-500 mx-auto mb-2" />
                  <p className="font-medium text-red-800 dark:text-red-300">
                    Event Cancelled
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    This event has been cancelled
                  </p>
                </div>
              ) : isFuture(startDate) ? (
                <div className="space-y-3">
                  {/* Ticket Selection */}
                  {event.tickets?.tiers?.length > 1 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Select Ticket
                      </label>
                      <div className="space-y-2">
                        {event.tickets.tiers.map((tier, index) => (
                          <label
                            key={index}
                            className={`
                              flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all
                              ${selectedTicket === tier.name
                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}
                            `}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="radio"
                                name="ticket"
                                checked={selectedTicket === tier.name}
                                onChange={() => setSelectedTicket(tier.name)}
                                className="sr-only"
                              />
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">{tier.name}</p>
                                <p className="text-sm text-gray-500">
                                  {tier.quantity} available
                                </p>
                              </div>
                            </div>
                            <span className="font-bold text-gray-900 dark:text-white">
                              {tier.price === 0 ? 'Free' : `$${tier.price.toFixed(2)}`}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleRegister}
                    disabled={registering || (event.capacity > 0 && stats?.isFull)}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Ticket className="w-5 h-5" />
                    {registering ? 'Registering...' : 
                      stats?.isFull ? 'Event Full' : 
                      event.tickets?.isFree ? 'Register (Free)' : `Register - ${selectedTicket}`}
                  </button>

                  <p className="text-xs text-center text-gray-500">
                    By registering, you agree to the event terms
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl text-center">
                  <p className="text-gray-500">Registration is closed</p>
                </div>
              )}

              {/* Share */}
              <button className="w-full mt-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 text-sm flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <Share2 className="w-4 h-4" />
                Share Event
              </button>
            </div>

            {/* Date & Time Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">
                Date & Time
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-indigo-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {format(startDate, 'EEEE, MMMM d, yyyy')}
                    </p>
                    <p className="text-sm text-gray-500">
                      {format(startDate, 'h:mm a')}
                      {endDate && ` - ${format(endDate, 'h:mm a')}`}
                    </p>
                  </div>
                </div>
                {event.location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-indigo-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {event.type === 'digital' ? 'Online Event' : 'Location'}
                      </p>
                      <p className="text-sm text-gray-500">{event.location}</p>
                      {event.type === 'digital' && (
                        <a href={event.location} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mt-1">
                          Join Link <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetailScreen;
