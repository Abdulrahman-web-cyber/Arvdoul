/**
 * Provides an enterprise-grade location configuration dialog:
 * - One-tap GPS auto-detection with reverse-geocoding (City, Country)
 * - Searchable curated global cities & territories
 * - Custom location text input
 * - Granular location privacy settings (Public, Country Only, Hidden)
 * - Live Firestore synchronization via userService
 * 
 * @component
 */

import { memo, useState, useEffect } from "react";
import { X, MapPin, Navigation, Search, Check, Shield, Loader2, Sparkles } from "lucide-react";
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { getUserService } from '../../services/userService';
import { useAppStore } from '../../store/appStore';
import { useProfileStore } from '../../store/profileStore';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';

// Popular curated global cities for 1-tap selection
const POPULAR_LOCATIONS = [
  { city: 'New York', country: 'United States', code: 'US' },
  { city: 'London', country: 'United Kingdom', code: 'GB' },
  { city: 'Tokyo', country: 'Japan', code: 'JP' },
  { city: 'Paris', country: 'France', code: 'FR' },
  { city: 'Dubai', country: 'United Arab Emirates', code: 'AE' },
  { city: 'Lagos', country: 'Nigeria', code: 'NG' },
  { city: 'Toronto', country: 'Canada', code: 'CA' },
  { city: 'Berlin', country: 'Germany', code: 'DE' },
  { city: 'Sydney', country: 'Australia', code: 'AU' },
  { city: 'Singapore', country: 'Singapore', code: 'SG' },
  { city: 'São Paulo', country: 'Brazil', code: 'BR' },
  { city: 'Seoul', country: 'South Korea', code: 'KR' },
  { city: 'Mumbai', country: 'India', code: 'IN' },
  { city: 'Amsterdam', country: 'Netherlands', code: 'NL' },
  { city: 'Cairo', country: 'Egypt', code: 'EG' },
  { city: 'Nairobi', country: 'Kenya', code: 'KE' },
];

const ProfileLocationModal = memo(({
  isOpen,
  onClose,
  currentLocation = '',
  currentPrivacy = 'public',
  userId,
  theme = 'light',
  onLocationUpdated,
}) => {
  const isDark = theme === 'dark';
  const [selectedLocation, setSelectedLocation] = useState(currentLocation || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [privacy, setPrivacy] = useState(currentPrivacy || 'public'); // 'public', 'country_only', 'hidden'
  const [isDetecting, setIsDetecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedLocation(currentLocation || '');
      setSearchQuery('');
      setPrivacy(currentPrivacy || 'public');
    }
  }, [isOpen, currentLocation, currentPrivacy]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !isSaving) onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isSaving, onClose]);

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
      let finalLocation = privacy === 'hidden' ? '' : selectedLocation.trim();
      // `country_only` keeps the country, not the city.
      if (privacy === 'country_only' && finalLocation.includes(',')) {
        finalLocation = finalLocation.split(',').pop().trim();
      }

      const payload = {
        location: finalLocation,
        locationPrivacy: privacy,
        updatedAt: new Date().toISOString(),
      };

      // Coordinates are only ever stored for a `public` city selection; any other
      // choice actively clears them so a previous precise location cannot linger
      // in the world-readable users/{uid} document.
      if (privacy === 'public' && coords) {
        payload.locationCoordinates = coords;
      } else {
        payload.locationCoordinates = null;
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
      } catch (e) {
        console.warn('Cached auth-user location sync failed', e?.message);
      }

      toast.success(finalLocation ? `Location updated to "${finalLocation}"!` : 'Location set to private');
      if (onLocationUpdated) onLocationUpdated(finalLocation, privacy);
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in"
      onClick={() => !isSaving && onClose?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Profile Location"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative w-full max-w-md rounded-3xl p-6 border shadow-2xl transition-all max-h-[90vh] overflow-y-auto",
          isDark
            ? "bg-[#03071B]/88 backdrop-blur-2xl border-white/[0.10] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_14px_40px_rgba(3,7,27,0.55)]"
            : "bg-white border-slate-200 text-slate-900 shadow-[0_16px_50px_rgba(0,0,0,0.12)]"
        )}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5 pr-8">
          <div
            style={{ background: BRAND_GRADIENT }}
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-arvdoul-purple/25 shrink-0"
          >
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
          type="button"
          onClick={handleDetectGPS}
          disabled={isDetecting}
          className={cn(
            "w-full min-h-[44px] flex items-center justify-between p-3.5 rounded-2xl border transition-all mb-4 group text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
            isDark
              ? "bg-arvdoul-purple/10 border-arvdoul-purple/30 hover:bg-arvdoul-purple/20 text-purple-300"
              : "bg-purple-50 border-purple-200 hover:bg-purple-100 text-purple-700"
          )}
        >
          <div className="flex items-center gap-3">
            <div style={{ background: BRAND_GRADIENT }} className="w-9 h-9 rounded-xl text-white flex items-center justify-center shadow-md shrink-0">
              {isDetecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Navigation className="w-4 h-4" />
              )}
            </div>
            <div>
              <div className="text-xs font-bold flex items-center gap-1.5">
                <span>Detect via GPS</span>
                <span className="text-[10px] font-semibold opacity-75">• Automatic</span>
              </div>
              <div className="text-[11px] opacity-80">
                {isDetecting ? 'Determining coordinates...' : 'Use device sensor to fetch your current city'}
              </div>
            </div>
          </div>
          <Sparkles className="w-4 h-4 text-arvdoul-purple opacity-60 group-hover:opacity-100" />
        </button>

        {/* 2. Manual Custom Input */}
        <div className="space-y-1.5 mb-4">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            Location Name
          </label>
          <div className="relative">
            <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              aria-label="Location Name"
              type="text"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              placeholder="e.g., Tokyo, Japan or London, UK"
              className={cn(
                "w-full pl-10 pr-12 py-2.5 min-h-[44px] rounded-2xl text-xs sm:text-sm font-medium border outline-none transition-all focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                isDark 
                  ? "bg-white/5 border-white/10 focus:border-arvdoul-purple text-white placeholder-slate-500" 
                  : "bg-slate-50 border-slate-200 focus:border-arvdoul-purple text-slate-900 placeholder-slate-400"
              )}
            />
            {selectedLocation && (
              <button
                type="button"
                onClick={handleClearLocation}
                aria-label="Clear location"
                className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
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
              aria-label="Search cities"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cities..."
              className={cn(
                "w-full pl-8 pr-3 py-2 min-h-[40px] rounded-xl text-xs border outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
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
                  style={isSelected ? { background: BRAND_GRADIENT } : undefined}
                  className={cn(
                    "flex items-center gap-2 p-2 min-h-[44px] rounded-xl text-xs font-medium border text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                    isSelected
                      ? "text-white border-transparent shadow-sm"
                      : isDark
                        ? "bg-white/5 border-white/5 hover:bg-white/10 text-slate-300"
                        : "bg-slate-50 border-slate-200/80 hover:bg-slate-100 text-slate-700"
                  )}
                >
                  <span className={cn(
                    "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md shrink-0",
                    isSelected ? "bg-white/20 text-white" : isDark ? "bg-white/10 text-slate-300" : "bg-slate-200/80 text-slate-600"
                  )}>
                    {item.code}
                  </span>
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
            <Shield className="w-3.5 h-3.5 text-arvdoul-purple" />
            <span>Privacy Setting</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Location privacy setting">
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
                  aria-pressed={active}
                  onClick={() => setPrivacy(p.id)}
                  className={cn(
                    "p-2 min-h-[44px] rounded-xl text-left border transition-all flex flex-col justify-between cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                    active
                      ? "bg-arvdoul-purple/10 border-arvdoul-purple text-arvdoul-purple dark:text-[#C896FF] font-bold"
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
              "flex-1 py-2.5 min-h-[44px] rounded-2xl text-xs font-semibold border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
              isDark ? "bg-white/5 border-white/10 hover:bg-white/10 text-white" : "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700"
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            style={{ background: BRAND_GRADIENT }}
            className="flex-1 py-2.5 min-h-[44px] rounded-2xl text-xs font-bold text-white shadow-md hover:opacity-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
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
