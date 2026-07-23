// src/screens/Event/CreateEventScreen.jsx - ARVDOUL CREATE EVENT
// ✅ Create new event with all settings
// ✅ Cover image upload
// ✅ Ticket tiers and capacity

import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { 
  ArrowLeft, Upload, X, Calendar, MapPin, Users, 
  Video, Globe, Ticket, Plus, Check, Image as ImageIcon
} from 'lucide-react';
import { getEventService } from '../../services/eventService';
import { getStorageService } from '../../services/storageService';
import { useAuth } from '../../context/AuthContext';
import { format } from 'date-fns';

const CreateEventScreen = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const eventService = getEventService();
  const storageService = getStorageService();

  // Form state
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    coverImage: null,
    coverPreview: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    type: 'digital',
    location: '',
    capacity: 0,
    privacy: 'public',
    tickets: {
      tiers: [{ name: 'General', price: 0, quantity: 100 }],
      isFree: true
    }
  });

  // Cover input ref
  const coverInputRef = useRef(null);

  // Handle input change
  const handleChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Handle nested field change
  const handleNestedChange = useCallback((parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }));
  }, []);

  // Handle image selection
  const handleImageSelect = useCallback((file) => {
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please select a valid image file (JPEG, PNG, or WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      handleChange('coverPreview', e.target.result);
      handleChange('coverImage', file);
    };
    reader.readAsDataURL(file);
  }, [handleChange]);

  // Handle ticket tier changes
  const updateTicketTier = useCallback((index, field, value) => {
    const newTiers = [...formData.tickets.tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
    
    const isFree = newTiers.every(t => t.price === 0);
    handleNestedChange('tickets', 'tiers', newTiers);
    handleNestedChange('tickets', 'isFree', isFree);
  }, [formData.tickets.tiers, handleNestedChange]);

  // Add ticket tier
  const addTicketTier = useCallback(() => {
    const newTiers = [
      ...formData.tickets.tiers,
      { name: '', price: 0, quantity: 100 }
    ];
    handleNestedChange('tickets', 'tiers', newTiers);
  }, [formData.tickets.tiers, handleNestedChange]);

  // Remove ticket tier
  const removeTicketTier = useCallback((index) => {
    if (formData.tickets.tiers.length <= 1) {
      toast.error('At least one ticket tier is required');
      return;
    }
    const newTiers = formData.tickets.tiers.filter((_, i) => i !== index);
    handleNestedChange('tickets', 'tiers', newTiers);
  }, [formData.tickets.tiers, handleNestedChange]);

  // Validation
  const validateStep = useCallback((stepNum) => {
    switch (stepNum) {
      case 1:
        if (!formData.title.trim()) {
          toast.error('Event title is required');
          return false;
        }
        if (formData.title.length < 3) {
          toast.error('Event title must be at least 3 characters');
          return false;
        }
        return true;
      case 2:
        if (!formData.startDate) {
          toast.error('Start date is required');
          return false;
        }
        if (!formData.startTime) {
          toast.error('Start time is required');
          return false;
        }
        return true;
      default:
        return true;
    }
  }, [formData]);

  // Handle next step
  const handleNext = useCallback(() => {
    if (validateStep(step)) {
      setStep(prev => prev + 1);
    }
  }, [step, validateStep]);

  // Handle previous step
  const handleBack = useCallback(() => {
    setStep(prev => prev - 1);
  }, []);

  // Handle submit
  const handleSubmit = useCallback(async (publishNow = true) => {
    if (!user?.uid) {
      toast.error('Please sign in to create an event');
      return;
    }

    setLoading(true);

    try {
      // Upload cover image
      let coverUrl = '';
      if (formData.coverImage) {
        const coverPath = `events/covers/${user.uid}/${Date.now()}`;
        coverUrl = await storageService.uploadFile(formData.coverImage, coverPath);
      }

      // Parse dates
      const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
      const endDateTime = formData.endDate && formData.endTime
        ? new Date(`${formData.endDate}T${formData.endTime}`)
        : null;

      // Create event
      const event = await eventService.createEvent(user.uid, {
        title: formData.title.trim(),
        description: formData.description.trim(),
        coverImage: coverUrl,
        startDate: startDateTime,
        endDate: endDateTime,
        type: formData.type,
        location: formData.location.trim(),
        capacity: formData.capacity,
        privacy: formData.privacy,
        tickets: formData.tickets
      });

      // Publish if requested
      if (publishNow) {
        await eventService.publishEvent(event.id, user.uid);
        toast.success('Event created and published!');
      } else {
        toast.success('Event created as draft!');
      }

      navigate(`/event/${event.id}`);
    } catch (error) {
      console.error('Failed to create event:', error);
      toast.error(error.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, formData, storageService, eventService, navigate]);

  // Event type options
  const typeOptions = [
    {
      value: 'digital',
      label: 'Digital',
      description: 'Online event with video/stream',
      icon: Video,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    {
      value: 'physical',
      label: 'Physical',
      description: 'In-person event at a location',
      icon: MapPin,
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20'
    },
    {
      value: 'hybrid',
      label: 'Hybrid',
      description: 'Both in-person and online',
      icon: Globe,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Create Event
            </h1>
            <div className="w-10" />
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {[1, 2, 3].map((num) => (
              <div key={num} className="flex items-center">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors
                    ${step >= num 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}
                  `}
                >
                  {step > num ? <Check className="w-4 h-4" /> : num}
                </div>
                {num < 3 && (
                  <div className={`w-12 h-0.5 mx-1 ${step > num ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
                Event Details
              </h2>

              {/* Cover Image */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cover Image
                </label>
                <div
                  onClick={() => coverInputRef.current?.click()}
                  className={`
                    relative h-48 rounded-xl border-2 border-dashed cursor-pointer overflow-hidden
                    ${formData.coverPreview 
                      ? 'border-indigo-300 dark:border-indigo-700' 
                      : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400'}
                  `}
                >
                  {formData.coverPreview ? (
                    <>
                      <img
                        src={formData.coverPreview}
                        alt="Cover preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleChange('coverPreview', '');
                          handleChange('coverImage', null);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                      <ImageIcon className="w-10 h-10 mb-2" />
                      <span>Click to upload cover image</span>
                      <span className="text-xs mt-1">Recommended: 1920x1080px</span>
                    </div>
                  )}
                </div>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleImageSelect(e.target.files?.[0])}
                  className="hidden"
                />
              </div>

              {/* Title */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Event Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="Give your event a name"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Description */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Tell people about your event..."
                  rows={5}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Event Type */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Event Type
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {typeOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`
                        flex flex-col items-center p-4 rounded-xl border-2 cursor-pointer transition-all text-center
                        ${formData.type === option.value
                          ? `${option.bgColor} border-${option.color.replace('text-', '')}`
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}
                      `}
                    >
                      <input
                        type="radio"
                        name="type"
                        value={option.value}
                        checked={formData.type === option.value}
                        onChange={(e) => handleChange('type', e.target.value)}
                        className="sr-only"
                      />
                      <option.icon className={`w-8 h-8 mb-2 ${option.color}`} />
                      <span className="font-medium text-gray-900 dark:text-white">{option.label}</span>
                      <span className="text-xs text-gray-500 mt-1">{option.description}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Location
                </label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleChange('location', e.target.value)}
                    placeholder={formData.type === 'digital' ? 'Meeting link or URL' : 'Venue address'}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Capacity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Capacity
                </label>
                <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    value={formData.capacity || ''}
                    onChange={(e) => handleChange('capacity', parseInt(e.target.value) || 0)}
                    placeholder="0 = unlimited"
                    min={0}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Date & Time */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
                Date & Time
              </h2>

              {/* Start Date & Time */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Date & Time <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => handleChange('startDate', e.target.value)}
                      min={format(new Date(), 'yyyy-MM-dd')}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="relative">
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => handleChange('startTime', e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* End Date & Time */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  End Date & Time (Optional)
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => handleChange('endDate', e.target.value)}
                      min={formData.startDate || format(new Date(), 'yyyy-MM-dd')}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="relative">
                    <input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => handleChange('endTime', e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Timezone notice */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  All times are shown in your local timezone. Attendees will see times in their local timezone.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 3: Tickets */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
                Tickets
              </h2>

              {/* Free/Paid Toggle */}
              <div className="flex gap-4 mb-6">
                <button
                  onClick={() => {
                    handleNestedChange('tickets', 'isFree', true);
                    handleNestedChange('tickets', 'tiers', formData.tickets.tiers.map(t => ({ ...t, price: 0 })));
                  }}
                  className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                    formData.tickets.isFree
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Free Event
                </button>
                <button
                  onClick={() => handleNestedChange('tickets', 'isFree', false)}
                  className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                    !formData.tickets.isFree
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Paid Event
                </button>
              </div>

              {/* Ticket Tiers */}
              <div className="space-y-4 mb-6">
                {formData.tickets.tiers.map((tier, index) => (
                  <div key={index} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-gray-900 dark:text-white">
                        Ticket Tier {index + 1}
                      </span>
                      {formData.tickets.tiers.length > 1 && (
                        <button
                          onClick={() => removeTicketTier(index)}
                          className="text-red-500 hover:text-red-600 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">Name</label>
                        <input
                          type="text"
                          value={tier.name}
                          onChange={(e) => updateTicketTier(index, 'name', e.target.value)}
                          placeholder="General Admission"
                          className="w-full px-3 py-2 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Price</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                          <input
                            type="number"
                            value={tier.price}
                            onChange={(e) => updateTicketTier(index, 'price', parseFloat(e.target.value) || 0)}
                            disabled={formData.tickets.isFree}
                            min={0}
                            step={0.01}
                            className="w-full pl-7 pr-3 py-2 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg text-gray-900 dark:text-white text-sm disabled:opacity-50"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="block text-xs text-gray-500 mb-1">Quantity Available</label>
                      <input
                        type="number"
                        value={tier.quantity}
                        onChange={(e) => updateTicketTier(index, 'quantity', parseInt(e.target.value) || 0)}
                        min={1}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                  </div>
                ))}

                <button
                  onClick={addTicketTier}
                  className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Ticket Tier
                </button>
              </div>

              {/* Summary */}
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                <h4 className="font-medium text-indigo-900 dark:text-indigo-300 mb-2">
                  Summary
                </h4>
                <div className="space-y-1 text-sm text-indigo-700 dark:text-indigo-400">
                  <p><strong>Title:</strong> {formData.title}</p>
                  <p><strong>Type:</strong> {formData.type}</p>
                  <p><strong>Date:</strong> {formData.startDate} at {formData.startTime}</p>
                  <p><strong>Tickets:</strong> {formData.tickets.isFree ? 'Free' : 'Paid'}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6">
          {step > 1 ? (
            <button
              onClick={handleBack}
              className="px-6 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
            >
              Back
            </button>
          ) : (
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
          )}

          <div className="flex gap-3">
            {step === 3 && (
              <button
                onClick={() => handleSubmit(false)}
                disabled={loading}
                className="px-6 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                Save as Draft
              </button>
            )}
            <button
              onClick={() => step === 3 ? handleSubmit(true) : handleNext()}
              disabled={loading}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : step === 3 ? 'Create & Publish' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateEventScreen;
