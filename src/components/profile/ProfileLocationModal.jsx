// src/components/profile/ProfileLocationModal.jsx

import React, { memo, useState, useEffect } from 'react';
import { 
  X, 
  MapPin, 
  Navigation, 
  Search, 
  Globe, 
  Check, 
  Shield, 
  Loader2, 
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { getUserService } from '../../services/userService';
import { useAppStore } from '../../store/appStore';
import { useProfileStore } from '../../store/profileStore';

// Popular curated global cities for 1-tap selection
const POPULAR_LOCATIONS = [
  { city: 'New York', country: 'United States', flag: '🇺🇸' },
  { city: 'London', country: 'United Kingdom', flag: '🇬🇧' },
  { city: 'Tokyo', country: 'Japan', flag: '🇯🇵' },
  { city: 'Paris', country: 'France', flag: '🇫🇷' },
  { city: 'Dubai', country: 'United Arab Emirates', flag: '🇦🇪' },
  { city: 'Lagos', country: 'Nigeria', flag: '🇳🇬' },
  { city: 'Toronto', country: 'Canada', flag: '🇨🇦' },
  { city: 'Berlin', country: 'Germany', flag: '🇩🇪' },
  { city: 'Sydney', country: 'Australia', flag: '🇦🇺' },
  { city: 'Singapore', country: 'Singapore', flag: '🇸🇬' },
  { city: 'São Paulo', country: 'Brazil', flag: '🇧🇷' },
  { city: 'Seoul', country: 'South Korea', flag: '🇰🇷' },
  { city: 'Mumbai', country: 'India', flag: '🇮🇳' },
  { city: 'Amsterdam', country: 'Netherlands', flag: '🇳🇱' },
  { city: 'Cairo', country: 'Egypt', flag: '🇪🇬' },
  { city: 'Nairobi', country: 'Kenya', flag: '🇰🇪' },
];

const ProfileLocationModal = memo(({
  isOpen,
  onClose,
  currentLocation = '',
  userId,
  theme = 'light',
  onLocationUpdated,
}) => {
  const isDark = theme === 'dark';
  const [selectedLocation, setSelectedLocation] = useState(currentLocation || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [privacy, setPrivacy] = useState('public'); // 'public', 'country_only', 'hidden'
  const [isDetecting, setIsDetecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedLocation(currentLocation || '');
      setSearchQuery('');
    }
  }, [isOpen, currentLocation]);

  if (!isOpen) return null;

  // Filter popular locations based on search query
  const filteredLocations = POPULAR_LOCATIONS.filter(item => 
    `${item.city}, ${item.country}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 1. One-tap GPS Auto-Detection
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setIsDetecting(true);
    const toastId = toast.loading('Detecting your location via GPS...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ lat: latitude, lng: longitude });

        try {
          // Attempt reverse geocoding via OpenStreetMap Nominatim
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`,
            {
              headers: {
                'Accept-Language': 'en',
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            const addr = data.address || {};
            const city = addr.city || addr.town || addr.village || addr.municipality || addr.state_district || addr.county || 'Local Area';
            const country = addr.country || '';
            const detectedStr = country ? `${city}, ${country}` : city;

            setSelectedLocation(detectedStr);
            toast.success(`Location detected: ${detectedStr}`, { id: toastId });
          } else {
            // Fallback to coordinates string
            const coordStr = `Near ${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`;
            setSelectedLocation(coordStr);
            toast.success(`Coordinates found: ${coordStr}`, { id: toastId });
          }
        } catch (err) {
          console.warn('Reverse geocode lookup failed:', err);
          const coordStr = `${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`;
          setSelectedLocation(coordStr);
          toast.success(`Location set to GPS coordinates`, { id: toastId });
        } finally {
          setIsDetecting(false);
        }
      },
      (error) => {
        setIsDetecting(false);
        let msg = 'Could not retrieve location.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission was denied. You can select a city below manually.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Location signal is unavailable.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Location detection timed out.';
        }
        toast.error(msg, { id: toastId });
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 60000 }
    );
  };

  // 2. Save location to Firestore and local stores
  const handleSave = async () => {
    if (!userId) {
      toast.error('User authentication required to save location');
      return;
    }

    setIsSaving(true);
    try {
      const userService = getUserService();
      const finalLocation = privacy === 'hidden' ? '' : selectedLocation.trim();
      
      const payload = {
        location: finalLocation,
        locationPrivacy: privacy,
        updatedAt: new Date().toISOString(),
      };

      if (coords) {
        payload.locationCoordinates = coords;
      }

      await userService.updateUserProfile(userId, payload);

      // Update appStore currentUser
      const currentUser = useAppStore.getState().currentUser;
      if (currentUser) {
        useAppStore.getState().setAppState({
          currentUser: {
            ...currentUser,
            location: finalLocation,
            locationPrivacy: privacy,
          }
        });
      }

      // Update profileStore
      useProfileStore.setState((state) => {
        if (state.profile) {
          state.profile.location = finalLocation;
          state.profile.locationPrivacy = privacy;
        }
      });

      // Update in localStorage
      try {
        const localAuth = JSON.parse(localStorage.getItem('user') || '{}');
        if (localAuth && localAuth.uid === userId) {
          localAuth.location = finalLocation;
          localStorage.setItem('user', JSON.stringify(localAuth));
        }
      } catch {}

      toast.success(finalLocation ? `Location updated to "${finalLocation}"!` : 'Location set to private');
      if (onLocationUpdated) onLocationUpdated(finalLocation);
      onClose();
    } catch (err) {
      console.error('Failed to save location:', err);
      toast.error(err?.message || 'Failed to update location');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearLocation = () => {
    setSelectedLocation('');
    setCoords(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div 
        className={cn(
          "relative w-full max-w-md rounded-3xl p-6 border shadow-2xl transition-all max-h-[90vh] overflow-y-auto",
          isDark 
            ? "bg-[#0c1222] border-white/10 text-white shadow-[0_16px_50px_rgba(0,0,0,0.6)]" 
            : "bg-white border-slate-200 text-slate-900 shadow-[0_16px_50px_rgba(0,0,0,0.12)]"
        )}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-white"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/25 shrink-0">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Profile Location</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Share where you are creating from with the Arvdoul community
            </p>
          </div>
        </div>

        {/* 1. GPS Auto-Detect Button */}
        <button
          onClick={handleDetectGPS}
          disabled={isDetecting}
          className={cn(
            "w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all mb-4 group text-left",
            isDark 
              ? "bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 text-purple-300" 
              : "bg-purple-50 border-purple-200 hover:bg-purple-100 text-purple-700"
          )}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/30 shrink-0">
              {isDetecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Navigation className="w-4 h-4" />
              )}
            </div>
            <div>
              <div className="text-xs font-bold flex items-center gap-1.5">
                <span>Detect via GPS</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-purple-500/20 text-purple-400 font-semibold">Auto</span>
              </div>
              <div className="text-[11px] opacity-80">
                {isDetecting ? 'Determining coordinates...' : 'Use device sensor to fetch your current city'}
              </div>
            </div>
          </div>
          <Sparkles className="w-4 h-4 text-purple-400 opacity-60 group-hover:opacity-100" />
        </button>

        {/* 2. Manual Custom Input */}
        <div className="space-y-1.5 mb-4">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            Location Name
          </label>
          <div className="relative">
            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              placeholder="e.g., Tokyo, Japan or London, UK"
              className={cn(
                "w-full pl-10 pr-9 py-2.5 rounded-2xl text-xs sm:text-sm font-medium border outline-none transition-all",
                isDark 
                  ? "bg-white/5 border-white/10 focus:border-purple-500 text-white placeholder-slate-500" 
                  : "bg-slate-50 border-slate-200 focus:border-purple-600 text-slate-900 placeholder-slate-400"
              )}
            />
            {selectedLocation && (
              <button
                type="button"
                onClick={handleClearLocation}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                title="Clear"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 3. Popular Global Cities Quick Picker */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Popular Global Cities
            </label>
            <span className="text-[10px] text-slate-400">Tap to select</span>
          </div>

          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cities..."
              className={cn(
                "w-full pl-8 pr-3 py-1.5 rounded-xl text-xs border outline-none",
                isDark ? "bg-white/5 border-white/10 text-white" : "bg-slate-100 border-slate-200 text-slate-900"
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
            {filteredLocations.map((item) => {
              const fullStr = `${item.city}, ${item.country}`;
              const isSelected = selectedLocation === fullStr;

              return (
                <button
                  key={fullStr}
                  type="button"
                  onClick={() => setSelectedLocation(fullStr)}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-xl text-xs font-medium border text-left transition-all",
                    isSelected
                      ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                      : isDark
                        ? "bg-white/5 border-white/5 hover:bg-white/10 text-slate-300"
                        : "bg-slate-50 border-slate-200/80 hover:bg-slate-100 text-slate-700"
                  )}
                >
                  <span className="text-sm">{item.flag}</span>
                  <div className="truncate flex-1">
                    <div className="font-semibold truncate">{item.city}</div>
                    <div className="text-[10px] opacity-70 truncate">{item.country}</div>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Privacy Scope Selector */}
        <div className="space-y-1.5 mb-5 pt-1 border-t border-slate-200 dark:border-white/10">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5 pt-2">
            <Shield className="w-3.5 h-3.5 text-purple-500" />
            <span>Privacy Setting</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'public', label: 'City & Country', desc: 'Visible to all' },
              { id: 'country_only', label: 'Country Only', desc: 'General region' },
              { id: 'hidden', label: 'Keep Hidden', desc: 'Private to you' },
            ].map((p) => {
              const active = privacy === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPrivacy(p.id)}
                  className={cn(
                    "p-2 rounded-xl text-left border transition-all flex flex-col justify-between",
                    active
                      ? "bg-purple-500/10 border-purple-500 text-purple-600 dark:text-purple-400 font-bold"
                      : isDark
                        ? "bg-white/5 border-white/5 text-slate-400 hover:text-white"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900"
                  )}
                >
                  <span className="text-xs leading-tight">{p.label}</span>
                  <span className="text-[10px] opacity-70 font-normal">{p.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "flex-1 py-2.5 rounded-2xl text-xs font-semibold border transition-all",
              isDark ? "bg-white/5 border-white/10 hover:bg-white/10 text-white" : "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700"
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-2.5 rounded-2xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25 hover:opacity-95 transition-all flex items-center justify-center gap-1.5"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Location</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

ProfileLocationModal.displayName = 'ProfileLocationModal';

export default ProfileLocationModal;
