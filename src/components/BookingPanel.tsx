import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrder } from '../context/OrderContext';
import { Suggestion } from '../types';
import { NOMINATIM_URL } from '../config/constants';
import { RadioGroup } from '@headlessui/react';

interface BookingPanelProps {
  onSubmit: () => void;
  isSubmitting: boolean;
  getCurrentLocation: () => void;
  isGettingLocation: boolean;
  onEditPickup: () => void;
  onEditDestination: () => void;
  setEditingLocation: (location: 'pickup' | 'destination' | null) => void;
}

// Cache for geocoding results (Nominatim policy requires caching)
// Key: query string, Value: { results, timestamp }
const geocodeCache = new Map<string, { results: Suggestion[], timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

function debounce<T extends (...args: string[]) => Promise<void>>(func: T, wait: number): T {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

export function BookingPanel({ onSubmit, isSubmitting, getCurrentLocation, isGettingLocation, onEditPickup, onEditDestination, setEditingLocation }: BookingPanelProps) {
  const { t } = useTranslation();
  const {
    pickupAddress,
    destinationAddress,
    pickupTime,
    notes,
    paymentMethod,
    priceEstimate,
    pickupLocation,
    destinationLocation,
    setPickupTime,
    setNotes,
    setPaymentMethod,
    getPickupTimeLabel,
    editingLocation,
  } = useOrder();

  const [pickupSuggestions, setPickupSuggestions] = useState<Suggestion[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<Suggestion[]>([]);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
  const [pickupInputValue, setPickupInputValue] = useState('');
  const [destinationInputValue, setDestinationInputValue] = useState('');
  const [showTimeInput, setShowTimeInput] = useState(false); // Control visibility of time input
  const [selectedDate, setSelectedDate] = useState<'today' | 'tomorrow' | null>(null); // Date selection
  const [selectedTime, setSelectedTime] = useState<string>(''); // Time selection (HH:mm)

  const pickupInputRef = useRef<HTMLInputElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const pickupSuggestionsRef = useRef<HTMLDivElement>(null);
  const destinationSuggestionsRef = useRef<HTMLDivElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);

  // Update input values when addresses change from map selection
  useEffect(() => {
    if (pickupAddress) {
      setPickupInputValue(pickupAddress);
    }
  }, [pickupAddress]);

  useEffect(() => {
    if (destinationAddress) {
      setDestinationInputValue(destinationAddress);
    }
  }, [destinationAddress]);

  const geocodeAddress = useCallback(async (query: string): Promise<Suggestion[]> => {
    const cacheKey = `search:${query}`;
    const cached = geocodeCache.get(cacheKey);
    const now = Date.now();

    // Return cached results if still valid (Nominatim policy requires caching)
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      console.log('Geocode cache hit:', query);
      return cached.results;
    }

    try {
      const response = await fetch(
        `${NOMINATIM_URL}/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=id`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Jetlink Ride-Hailing App v1.0.0 (https://jetlink.com)',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 403 || response.status === 429) {
          console.warn('Nominatim rate limit or blocked. Using cached data if available.');
          if (cached) return cached.results;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const results = await response.json();
      
      // Cache the results (Nominatim policy requires caching)
      geocodeCache.set(cacheKey, {
        results,
        timestamp: now,
      });

      console.log('Geocode cache set:', query);
      return results;
    } catch (error) {
      console.error('Geocoding error:', error);
      // Return cached data on error if available
      if (cached) return cached.results;
      return [];
    }
  }, []);

  const handlePickupInput = useCallback(
    debounce(async (query: string) => {
      if (query.length < 3) {
        setPickupSuggestions([]);
        setShowPickupSuggestions(false);
        return;
      }

      const results = await geocodeAddress(query);
      setPickupSuggestions(results);
      setShowPickupSuggestions(results.length > 0);
    }, 500),
    [geocodeAddress]
  ) as (query: string) => void;

  const handleDestinationInput = useCallback(
    debounce(async (query: string) => {
      if (query.length < 3) {
        setDestinationSuggestions([]);
        setShowDestinationSuggestions(false);
        return;
      }

      const results = await geocodeAddress(query);
      setDestinationSuggestions(results);
      setShowDestinationSuggestions(results.length > 0);
    }, 500),
    [geocodeAddress]
  ) as (query: string) => void;

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickupSuggestionsRef.current &&
        !pickupSuggestionsRef.current.contains(event.target as Node) &&
        pickupInputRef.current &&
        !pickupInputRef.current.contains(event.target as Node)
      ) {
        setShowPickupSuggestions(false);
      }
      if (
        destinationSuggestionsRef.current &&
        !destinationSuggestionsRef.current.contains(event.target as Node) &&
        destinationInputRef.current &&
        !destinationInputRef.current.contains(event.target as Node)
      ) {
        setShowDestinationSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePickupSelect = (suggestion: Suggestion) => {
    setPickupInputValue(suggestion.display_name);
    setShowPickupSuggestions(false);
    // The actual location setting is handled by the parent via map click
  };

  const handleDestinationSelect = (suggestion: Suggestion) => {
    setDestinationInputValue(suggestion.display_name);
    setShowDestinationSuggestions(false);
    // The actual location setting is handled by the parent via map click
  };

  // Handle pickup input focus - enter pickup selection mode
  const handlePickupFocus = useCallback(() => {
    setEditingLocation('pickup');
    if (pickupSuggestions.length > 0) {
      setShowPickupSuggestions(true);
    }
  }, [pickupSuggestions.length, setEditingLocation]);

  // Handle destination input focus - enter destination selection mode
  const handleDestinationFocus = useCallback(() => {
    setEditingLocation('destination');
    if (destinationSuggestions.length > 0) {
      setShowDestinationSuggestions(true);
    }
  }, [destinationSuggestions.length, setEditingLocation]);

  // Get minimum time string (HH:mm) for today (10 minutes from now)
  const getMinTimeForToday = (): string => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 10);
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  // Handle time change with validation
  const handleTimeChange = (dateType: 'today' | 'tomorrow', timeValue: string) => {
    setSelectedDate(dateType);
    setSelectedTime(timeValue);

    if (!timeValue) {
      // If time is cleared, set to Segera
      setPickupTime(null);
      return;
    }

    const now = new Date();
    const [hours, minutes] = timeValue.split(':').map(Number);
    
    let selectedDateTime: Date;
    
    if (dateType === 'today') {
      selectedDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
      
      // Validate: must be at least 10 minutes from now
      const minDateTime = new Date(now.getTime() + 10 * 60 * 1000);
      
      if (selectedDateTime < minDateTime) {
        // Time is too soon, reset to Segera
        setPickupTime(null);
        setSelectedDate(null);
        setSelectedTime('');
        return;
      }
    } else {
      // Tomorrow - no time restriction (any time is valid)
      selectedDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hours, minutes);
    }

    // Convert to Unix timestamp (seconds)
    const timestamp = Math.floor(selectedDateTime.getTime() / 1000);
    setPickupTime(timestamp.toString());
  };

  // Determine border colors based on editing state AND whether location is set
  const getPickupBorderClass = () => {
    // Show green border when pickup location is already set (success state)
    if (pickupLocation) {
      return 'border-green-500';
    }
    // Highlight red when in pickup selection mode (waiting for user to click map)
    if (editingLocation === 'pickup') {
      return 'border-red-500 ring-2 ring-red-500/20';
    }
    // Normal border when not in selection mode and no location set
    return 'border-gray-300 dark:border-gray-600';
  };

  const getDestinationBorderClass = () => {
    // Show green border when destination location is already set (success state)
    if (destinationLocation) {
      return 'border-green-500';
    }
    // Highlight red when in destination selection mode (waiting for user to click map)
    if (editingLocation === 'destination') {
      return 'border-red-500 ring-2 ring-red-500/20';
    }
    // Normal border when not in selection mode and no location set
    return 'border-gray-300 dark:border-gray-600';
  };

  return (
    <div className="p-6 pb-24 md:pb-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="mb-5">
          <label
            htmlFor="pickupLocation"
            className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide"
          >
            {t('booking.pickupLabel')}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
              A
            </span>
            <input
              ref={pickupInputRef}
              type="text"
              id="pickupLocation"
              value={pickupInputValue}
              onChange={(e) => {
                setPickupInputValue(e.target.value);
                handlePickupInput(e.target.value);
              }}
              onFocus={handlePickupFocus}
              onClick={handlePickupFocus}
              placeholder={(() => {
                if (editingLocation === 'pickup') {
                  return 'Klik map untuk pilih lokasi jemput...';
                }
                if (pickupLocation) {
                  // Show coordinates as fallback if address not available
                  return `${pickupLocation.lat.toFixed(4)}, ${pickupLocation.lon.toFixed(4)}`;
                }
                return t('booking.pickupPlaceholder');
              })()}
              readOnly
              required
              autoComplete="off"
              className={`w-full pl-11 pr-12 py-3 text-sm border-2 ${getPickupBorderClass()} rounded-xl focus:outline-none transition-all pickup-input text-gray-900 dark:text-white bg-white dark:bg-gray-800`}
            />
            <button
              type="button"
              onClick={getCurrentLocation}
              disabled={isGettingLocation}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors"
              title={t('booking.useCurrentLocation')}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 ${isGettingLocation ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
            {/* Edit button - only show when both locations are set */}
            {pickupLocation && destinationLocation && (
              <button
                type="button"
                onClick={onEditPickup}
                className="absolute right-12 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-primary transition-colors md:hidden"
                title="Edit pickup location"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
            )}
            {showPickupSuggestions && (
              <div
                ref={pickupSuggestionsRef}
                className="location-suggestions absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-[1001] max-h-[200px] overflow-y-auto"
              >
                {pickupSuggestions.map((suggestion, index) => (
                  <div
                    key={`${suggestion.lat}-${suggestion.lon}-${index}`}
                    className="p-2.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-900 dark:text-gray-100"
                    onClick={() => handlePickupSelect(suggestion)}
                  >
                    {suggestion.display_name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mb-5">
          <label
            htmlFor="destination"
            className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide"
          >
            {t('booking.destinationLabel')}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
              B
            </span>
            <input
              ref={destinationInputRef}
              type="text"
              id="destination"
              value={destinationInputValue}
              onChange={(e) => {
                setDestinationInputValue(e.target.value);
                handleDestinationInput(e.target.value);
              }}
              onFocus={handleDestinationFocus}
              onClick={handleDestinationFocus}
              placeholder={(() => {
                if (editingLocation === 'destination') {
                  return 'Klik map untuk pilih lokasi tujuan...';
                }
                if (destinationLocation) {
                  // Show coordinates as fallback if address not available
                  return `${destinationLocation.lat.toFixed(4)}, ${destinationLocation.lon.toFixed(4)}`;
                }
                return t('booking.destinationPlaceholder');
              })()}
              readOnly
              required
              autoComplete="off"
              className={`w-full pl-11 pr-4 py-3 text-sm border-2 ${getDestinationBorderClass()} rounded-xl focus:outline-none transition-all destination-input text-gray-900 dark:text-white bg-white dark:bg-gray-800`}
            />
            {/* Edit button - only show when both locations are set */}
            {pickupLocation && destinationLocation && (
              <button
                type="button"
                onClick={onEditDestination}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-primary transition-colors md:hidden"
                title="Edit destination location"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
            )}
            {showDestinationSuggestions && (
              <div
                ref={destinationSuggestionsRef}
                className="location-suggestions absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-[1001] max-h-[200px] overflow-y-auto"
              >
                {destinationSuggestions.map((suggestion, index) => (
                  <div
                    key={`${suggestion.lat}-${suggestion.lon}-${index}`}
                    className="p-2.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-900 dark:text-gray-100"
                    onClick={() => handleDestinationSelect(suggestion)}
                  >
                    {suggestion.display_name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mb-5">
          <label
            htmlFor="pickupTime"
            className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide"
          >
            {t('booking.pickupTimeLabel')}
          </label>

          {!showTimeInput ? (
            // Display mode: show "Segera" or selected time with edit button
            <div className="relative">
              <div
                className="w-full px-4 py-3 text-sm border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 cursor-pointer hover:border-primary transition-all flex items-center justify-between"
                onClick={() => {
                  setShowTimeInput(true);
                  // Focus the time input after a short delay
                  setTimeout(() => timeInputRef.current?.focus(), 50);
                }}
              >
                <span className="text-gray-700 dark:text-gray-300">{getPickupTimeLabel()}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-gray-400 dark:text-gray-500 hover:text-primary transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </div>
            </div>
          ) : (
            // Edit mode: show date selection and time picker
            <div className="space-y-3">
              {/* Date Selection */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleTimeChange('today', selectedTime)}
                  className={`py-3 px-4 rounded-xl font-semibold transition-all border-2 ${
                    selectedDate === 'today'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-primary'
                  }`}
                >
                  📅 {t('booking.today')}
                </button>
                <button
                  type="button"
                  onClick={() => handleTimeChange('tomorrow', selectedTime)}
                  className={`py-3 px-4 rounded-xl font-semibold transition-all border-2 ${
                    selectedDate === 'tomorrow'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-primary'
                  }`}
                >
                  📅 {t('booking.tomorrow')}
                </button>
              </div>

              {/* Time Picker */}
              <div className="relative">
                <input
                  ref={timeInputRef}
                  type="time"
                  id="pickupTime"
                  value={selectedTime}
                  onChange={(e) => {
                    const dateType = selectedDate || 'today';
                    handleTimeChange(dateType, e.target.value);
                  }}
                  min={selectedDate === 'today' ? getMinTimeForToday() : undefined}
                  className="w-full px-4 py-3 text-sm border-2 border-primary rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all text-gray-700 dark:text-white bg-white dark:bg-gray-800 pr-12"
                  placeholder={t('booking.selectTime')}
                />
                <button
                  type="button"
                  onClick={() => {
                    setPickupTime(null);
                    setSelectedDate(null);
                    setSelectedTime('');
                    setShowTimeInput(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-red-500 transition-colors"
                  title="Clear pickup time (set to Segera)"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Info text */}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {selectedDate === 'today' && (
                  <span>⏰ {t('booking.todayTimeInfo')}</span>
                )}
                {selectedDate === 'tomorrow' && (
                  <span>📆 {t('booking.tomorrowTimeInfo')}</span>
                )}
                {!selectedDate && (
                  <span>👆 {t('booking.selectDateInfo')}</span>
                )}
              </p>
            </div>
          )}

          {!showTimeInput && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {pickupTime ? t('booking.pickupTimeEdit') : t('booking.pickupTimeDefault')}
            </p>
          )}
        </div>

        <div className="mb-5">
          <label
            htmlFor="notes"
            className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide"
          >
            {t('booking.notesLabel')}
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('booking.notesPlaceholder')}
            rows={3}
            className="w-full px-4 py-3 text-sm border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-y min-h-[80px] bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>

        <div className="mb-5">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
            {t('booking.paymentMethodLabel')}
          </label>
          <RadioGroup
            value={paymentMethod}
            onChange={(value) => setPaymentMethod(value)}
            className="grid grid-cols-2 gap-3"
          >
            <RadioGroup.Option value="cash">
              {({ checked }) => (
                <div
                  className={`relative flex flex-col items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    checked
                      ? 'border-primary bg-primary/5 dark:bg-primary/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-primary/50'
                  }`}
                >
                  <div className="text-2xl mb-2">💵</div>
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('booking.paymentCash')}</div>
                  {checked && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              )}
            </RadioGroup.Option>

            <RadioGroup.Option value="qris">
              {({ checked }) => (
                <div
                  className={`relative flex flex-col items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    checked
                      ? 'border-primary bg-primary/5 dark:bg-primary/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-primary/50'
                  }`}
                >
                  <div className="text-2xl mb-2">📱</div>
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('booking.paymentQris')}</div>
                  {checked && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              )}
            </RadioGroup.Option>
          </RadioGroup>
        </div>

        {priceEstimate && (
          <div className="distance-info bg-gray-100 dark:bg-gray-700 p-4 rounded-xl mb-5">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">{t('booking.distanceLabel')}</span>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                {priceEstimate.distance.toFixed(2)} km
              </span>
            </div>
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white dark:from-gray-900 via-white dark:via-gray-900 to-transparent md:static md:bg-none md:p-0">
          <button
            type="submit"
            disabled={isSubmitting || !pickupLocation || !destinationLocation}
            className="order-button w-full py-4 bg-gradient-to-r from-primary to-primary-dark text-white text-base font-semibold uppercase tracking-wider rounded-xl cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
          >
            {isSubmitting ? t('booking.placingOrder') : t('booking.bookButton')}
          </button>
        </div>
      </form>
    </div>
  );
}
