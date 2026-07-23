// src/services/eventService.js - ARVDOUL EVENT SERVICE
// ✅ Complete CRUD for events
// ✅ Registration management
// ✅ Event analytics

import {
  getFirestoreInstance,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment
} from '../firebase/firebase.js';

const EVENTS_PER_PAGE = 20;

class EventService {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    this.db = getFirestoreInstance();
    this.initialized = true;
  }

  // ========== EVENT CRUD ==========

  /**
   * Create a new event
   * @param {string} userId - Creator's user ID
   * @param {Object} data - Event data
   * @returns {Promise<Object>} Created event
   */
  async createEvent(userId, data) {
    await this.initialize();
    
    const eventId = doc(collection(this.db, 'events')).id;
    const eventData = {
      id: eventId,
      title: data.title,
      description: data.description || '',
      coverImage: data.coverImage || '',
      startDate: data.startDate,
      endDate: data.endDate || null,
      location: data.location || '',
      locationLat: data.locationLat || null,
      locationLng: data.locationLng || null,
      type: data.type || 'digital', // digital, physical, hybrid
      capacity: data.capacity || 0,
      privacy: data.privacy || 'public',
      tickets: {
        tiers: data.tickets?.tiers || [],
        isFree: data.tickets?.isFree !== false,
        registrationRequired: data.tickets?.registrationRequired !== false
      },
      communityId: data.communityId || null,
      organizerId: userId,
      attendees: {},
      stats: {
        attendeeCount: 0,
        waitlistCount: 0,
        feedbackScore: 0
      },
      schedule: data.schedule || [],
      media: data.media || [],
      status: 'draft', // draft, published, open, live, ended, archived, cancelled
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(this.db, 'events', eventId), eventData);
    return { id: eventId, ...eventData };
  }

  /**
   * Get event by ID
   * @param {string} eventId - Event ID
   * @returns {Promise<Object|null>} Event data or null
   */
  async getEvent(eventId) {
    await this.initialize();
    const snap = await getDoc(doc(this.db, 'events', eventId));
    
    if (!snap.exists) {
      return null;
    }
    
    return { id: snap.id, ...snap.data() };
  }

  /**
   * Update an event
   * @param {string} eventId - Event ID
   * @param {Object} data - Update data
   * @param {string} userId - User making the update
   * @returns {Promise<boolean>} Success status
   */
  async updateEvent(eventId, data, userId) {
    await this.initialize();
    
    const event = await this.getEvent(eventId);
    if (!event) throw new Error('Event not found');
    
    // Check permissions
    if (event.organizerId !== userId) {
      throw new Error('Only the organizer can update this event');
    }

    const allowedFields = [
      'title', 'description', 'coverImage', 'startDate', 'endDate',
      'location', 'locationLat', 'locationLng', 'type', 'capacity',
      'privacy', 'tickets', 'schedule', 'media', 'status'
    ];
    
    const updateData = { updatedAt: serverTimestamp() };
    
    Object.keys(data).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = data[key];
      }
    });

    await updateDoc(doc(this.db, 'events', eventId), updateData);
    return true;
  }

  /**
   * Delete an event
   * @param {string} eventId - Event ID
   * @param {string} userId - User making the deletion
   * @returns {Promise<boolean>} Success status
   */
  async deleteEvent(eventId, userId) {
    await this.initialize();
    
    const event = await this.getEvent(eventId);
    if (!event) throw new Error('Event not found');
    
    if (event.organizerId !== userId) {
      throw new Error('Only the organizer can delete this event');
    }

    await updateDoc(doc(this.db, 'events', eventId), {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // Notify attendees
    await this.notifyAttendees(eventId, 'Event Cancelled', 'This event has been cancelled by the organizer.');

    return true;
  }

  /**
   * Publish an event
   * @param {string} eventId - Event ID
   * @param {string} userId - User publishing
   * @returns {Promise<boolean>} Success status
   */
  async publishEvent(eventId, userId) {
    await this.initialize();
    
    const event = await this.getEvent(eventId);
    if (!event) throw new Error('Event not found');
    
    if (event.organizerId !== userId) {
      throw new Error('Only the organizer can publish this event');
    }

    await updateDoc(doc(this.db, 'events', eventId), {
      status: 'published',
      updatedAt: serverTimestamp()
    });

    return true;
  }

  // ========== REGISTRATION ==========

  /**
   * Register for an event
   * @param {string} eventId - Event ID
   * @param {string} userId - User ID
   * @param {string} ticketTier - Selected ticket tier
   * @returns {Promise<Object>} Registration result
   */
  async registerForEvent(eventId, userId, ticketTier = 'general') {
    await this.initialize();
    
    const event = await this.getEvent(eventId);
    if (!event) throw new Error('Event not found');
    
    if (event.attendees?.[userId]) {
      throw new Error('Already registered for this event');
    }

    // Check capacity
    const isFull = event.capacity > 0 && event.stats?.attendeeCount >= event.capacity;
    const status = isFull ? 'waitlisted' : 'registered';

    const updateData = {
      [`attendees.${userId}`]: {
        status,
        ticketTier,
        registeredAt: serverTimestamp(),
        checkedInAt: null
      },
      'stats.attendeeCount': status === 'registered' ? increment(1) : increment(0),
      'stats.waitlistCount': status === 'waitlisted' ? increment(1) : increment(0),
      updatedAt: serverTimestamp()
    };

    await updateDoc(doc(this.db, 'events', eventId), updateData);

    // Update user's events
    await updateDoc(doc(this.db, 'users', userId), {
      attendingEvents: arrayUnion(eventId),
      updatedAt: serverTimestamp()
    });

    return { success: true, status, event };
  }

  /**
   * Cancel registration
   * @param {string} eventId - Event ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async cancelRegistration(eventId, userId) {
    await this.initialize();
    
    const event = await this.getEvent(eventId);
    if (!event) throw new Error('Event not found');
    
    const registration = event.attendees?.[userId];
    if (!registration) {
      throw new Error('Not registered for this event');
    }

    const wasRegistered = registration.status === 'registered';
    const wasWaitlisted = registration.status === 'waitlisted';

    const updateData = {
      [`attendees.${userId}`]: null,
      updatedAt: serverTimestamp()
    };

    if (wasRegistered) {
      updateData['stats.attendeeCount'] = increment(-1);
    }
    if (wasWaitlisted) {
      updateData['stats.waitlistCount'] = increment(-1);
    }

    await updateDoc(doc(this.db, 'events', eventId), updateData);

    // Update user's events
    await updateDoc(doc(this.db, 'users', userId), {
      attendingEvents: arrayRemove(eventId),
      updatedAt: serverTimestamp()
    });

    // Promote from waitlist if applicable
    if (wasRegistered && event.stats?.waitlistCount > 0) {
      await this.promoteFromWaitlist(eventId);
    }

    return true;
  }

  /**
   * Promote next person from waitlist
   * @param {string} eventId - Event ID
   * @returns {Promise<void>}
   */
  async promoteFromWaitlist(eventId) {
    const event = await this.getEvent(eventId);
    if (!event) return;

    // Find waitlisted users
    const waitlisted = Object.entries(event.attendees || {})
      .filter(([_, data]) => data.status === 'waitlisted')
      .sort((a, b) => a[1].registeredAt?.seconds - b[1].registeredAt?.seconds);

    if (waitlisted.length > 0) {
      const [nextUserId] = waitlisted[0];
      await updateDoc(doc(this.db, 'events', eventId), {
        [`attendees.${nextUserId}.status`]: 'registered',
        'stats.waitlistCount': increment(-1),
        updatedAt: serverTimestamp()
      });
    }
  }

  /**
   * Check in attendee
   * @param {string} eventId - Event ID
   * @param {string} attendeeId - Attendee user ID
   * @param {string} organizerId - Organizer user ID
   * @returns {Promise<boolean>} Success status
   */
  async checkInAttendee(eventId, attendeeId, organizerId) {
    await this.initialize();
    
    const event = await this.getEvent(eventId);
    if (!event) throw new Error('Event not found');
    
    if (event.organizerId !== organizerId) {
      throw new Error('Only the organizer can check in attendees');
    }

    const registration = event.attendees?.[attendeeId];
    if (!registration) {
      throw new Error('User is not registered');
    }

    await updateDoc(doc(this.db, 'events', eventId), {
      [`attendees.${attendeeId}.checkedInAt`]: serverTimestamp(),
      [`attendees.${attendeeId}.status`]: 'checked_in',
      updatedAt: serverTimestamp()
    });

    return true;
  }

  /**
   * Get user's registrations
   * @param {string} userId - User ID
   * @returns {Promise<Array>} List of events
   */
  async getUserRegistrations(userId) {
    await this.initialize();
    
    const q = query(
      collection(this.db, 'events'),
      where(`attendees.${userId}.status`, 'in', ['registered', 'waitlisted', 'checked_in']),
      orderBy('startDate', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // ========== LISTING & SEARCH ==========

  /**
   * List events
   * @param {Object} options - Query options
   * @returns {Promise<Object>} List of events and pagination info
   */
  async listEvents(options = {}) {
    await this.initialize();
    
    const {
      page = 1,
      sortBy = 'upcoming',
      filter = 'all',
      type = null,
      communityId = null,
      userId = null
    } = options;

    let q = collection(this.db, 'events');
    const constraints = [
      where('status', 'in', ['published', 'open', 'live'])
    ];

    if (type) {
      constraints.push(where('type', '==', type));
    }

    if (communityId) {
      constraints.push(where('communityId', '==', communityId));
    }

    if (userId) {
      constraints.push(where('organizerId', '==', userId));
    }

    if (sortBy === 'upcoming') {
      constraints.push(orderBy('startDate', 'asc'));
    } else if (sortBy === 'popular') {
      constraints.push(orderBy('stats.attendeeCount', 'desc'));
    } else if (sortBy === 'recent') {
      constraints.push(orderBy('createdAt', 'desc'));
    }

    constraints.push(limit(EVENTS_PER_PAGE));

    const querySnapshot = await getDocs(query(q, ...constraints));
    
    const events = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {
      events,
      hasMore: events.length === EVENTS_PER_PAGE,
      page
    };
  }

  /**
   * Search events
   * @param {string} searchQuery - Search query
   * @param {number} limitNum - Max results
   * @returns {Promise<Array>} Matching events
   */
  async searchEvents(searchQuery, limitNum = 10) {
    await this.initialize();
    
    const q = query(
      collection(this.db, 'events'),
      where('status', 'in', ['published', 'open']),
      orderBy('startDate', 'asc'),
      limit(limitNum * 2)
    );

    const snapshot = await getDocs(q);
    const lowerQuery = searchQuery.toLowerCase();
    
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(e =>
        e.title?.toLowerCase().includes(lowerQuery) ||
        e.description?.toLowerCase().includes(lowerQuery) ||
        e.location?.toLowerCase().includes(lowerQuery)
      )
      .slice(0, limitNum);
  }

  /**
   * Get upcoming events
   * @param {number} limitNum - Max results
   * @returns {Promise<Array>} Upcoming events
   */
  async getUpcomingEvents(limitNum = 10) {
    await this.initialize();
    
    const now = serverTimestamp();
    const q = query(
      collection(this.db, 'events'),
      where('status', 'in', ['published', 'open']),
      where('startDate', '>=', now),
      orderBy('startDate', 'asc'),
      limit(limitNum)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get community events
   * @param {string} communityId - Community ID
   * @param {number} limitNum - Max results
   * @returns {Promise<Array>} Community events
   */
  async getCommunityEvents(communityId, limitNum = 20) {
    await this.initialize();
    
    const q = query(
      collection(this.db, 'events'),
      where('communityId', '==', communityId),
      where('status', 'not-in', ['cancelled', 'deleted']),
      orderBy('startDate', 'desc'),
      limit(limitNum)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get user's events (as organizer)
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Organized events
   */
  async getOrganizedEvents(userId) {
    await this.initialize();
    
    const q = query(
      collection(this.db, 'events'),
      where('organizerId', '==', userId),
      orderBy('startDate', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // ========== FEEDBACK ==========

  /**
   * Submit event feedback
   * @param {string} eventId - Event ID
   * @param {string} userId - User ID
   * @param {number} rating - Rating (1-5)
   * @param {string} comment - Comment
   * @returns {Promise<boolean>} Success status
   */
  async submitFeedback(eventId, userId, rating, comment = '') {
    await this.initialize();
    
    const event = await this.getEvent(eventId);
    if (!event) throw new Error('Event not found');
    
    const registration = event.attendees?.[userId];
    if (!registration) {
      throw new Error('Must be registered to submit feedback');
    }

    const feedbackId = doc(collection(this.db, 'event_feedback')).id;
    await setDoc(doc(this.db, 'event_feedback', feedbackId), {
      eventId,
      userId,
      rating,
      comment,
      createdAt: serverTimestamp()
    });

    // Update average rating
    const feedbackQuery = query(
      collection(this.db, 'event_feedback'),
      where('eventId', '==', eventId)
    );
    const feedbackSnapshot = await getDocs(feedbackQuery);
    
    let totalRating = 0;
    feedbackSnapshot.docs.forEach(doc => {
      totalRating += doc.data().rating;
    });
    
    const avgRating = totalRating / feedbackSnapshot.size;
    
    await updateDoc(doc(this.db, 'events', eventId), {
      'stats.feedbackScore': avgRating,
      updatedAt: serverTimestamp()
    });

    return true;
  }

  /**
   * Get event feedback
   * @param {string} eventId - Event ID
   * @returns {Promise<Array>} Feedback list
   */
  async getEventFeedback(eventId) {
    await this.initialize();
    
    const q = query(
      collection(this.db, 'event_feedback'),
      where('eventId', '==', eventId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // ========== NOTIFICATIONS ==========

  /**
   * Notify all attendees
   * @param {string} eventId - Event ID
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @returns {Promise<void>}
   */
  async notifyAttendees(eventId, title, message) {
    const event = await this.getEvent(eventId);
    if (!event) return;

    const notifications = Object.keys(event.attendees || {});
    
    for (const userId of notifications) {
      try {
        const notifId = doc(collection(this.db, 'notifications')).id;
        await setDoc(doc(this.db, 'notifications', notifId), {
          type: 'event_update',
          recipientId: userId,
          title,
          message,
          actionUrl: `/event/${eventId}`,
          eventId,
          isRead: false,
          createdAt: serverTimestamp()
        });
      } catch (err) {
        console.warn(`Failed to notify user ${userId}:`, err);
      }
    }
  }

  // ========== REAL-TIME SUBSCRIPTIONS ==========

  /**
   * Subscribe to event updates
   * @param {string} eventId - Event ID
   * @param {Function} callback - Update callback
   * @returns {Function} Unsubscribe function
   */
  subscribeToEvent(eventId, callback) {
    return onSnapshot(doc(this.db, 'events', eventId), (doc) => {
      if (doc.exists) {
        callback({ id: doc.id, ...doc.data() });
      }
    });
  }

  /**
   * Subscribe to event attendees
   * @param {string} eventId - Event ID
   * @param {Function} callback - Update callback
   * @returns {Function} Unsubscribe function
   */
  subscribeToAttendees(eventId, callback) {
    return onSnapshot(doc(this.db, 'events', eventId), (doc) => {
      if (doc.exists) {
        const attendees = doc.data().attendees || {};
        callback(Object.entries(attendees).map(([id, data]) => ({ id, ...data })));
      }
    });
  }

  // ========== STATISTICS ==========

  /**
   * Get event statistics
   * @param {string} eventId - Event ID
   * @returns {Promise<Object>} Statistics
   */
  async getEventStats(eventId) {
    const event = await this.getEvent(eventId);
    if (!event) throw new Error('Event not found');

    const attendees = Object.values(event.attendees || {});
    const registered = attendees.filter(a => a.status === 'registered').length;
    const waitlisted = attendees.filter(a => a.status === 'waitlisted').length;
    const checkedIn = attendees.filter(a => a.status === 'checked_in').length;

    return {
      totalRegistrations: attendees.length,
      registered,
      waitlisted,
      checkedIn,
      capacity: event.capacity,
      isFull: event.capacity > 0 && registered >= event.capacity,
      feedbackScore: event.stats?.feedbackScore || 0,
      attendeePercentage: event.capacity > 0 
        ? Math.round((registered / event.capacity) * 100) 
        : 100
    };
  }
}

// Singleton instance
let eventServiceInstance = null;

export function getEventService() {
  if (!eventServiceInstance) {
    eventServiceInstance = new EventService();
  }
  return eventServiceInstance;
}

export default getEventService;
