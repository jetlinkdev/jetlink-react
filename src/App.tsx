import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { OrderProvider, useOrder } from './context/OrderContext';
import { useWebSocket } from './hooks/useWebSocket';
import { useGeolocation } from './hooks/useGeolocation';
import { Map } from './components/Map';
import { BookingPanel } from './components/BookingPanel';
import { WaitingBidsPanel } from './components/WaitingBidsPanel';
import { DriverAssignedPanel } from './components/DriverAssignedPanel';
import { LoginDialog } from './components/LoginDialog';
import { ProfileCompletionDialog } from './components/ProfileCompletionDialog';
import { RatingDialog } from './components/RatingDialog';
import { UserProfileDialog } from './components/UserProfileDialog';
import { Bid, WebSocketMessage, OrderState, ReviewData } from './types';
import { DEFAULT_LOCATION, MAP_CONFIG } from './config/constants';
import { authService } from './services/authService';

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'info'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className="fixed top-5 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-lg z-[2000] animate-[slideIn_0.3s_ease-out]"
    >
      <div className="flex items-center gap-2">
        <span>{type === 'success' ? '✅' : '📬'}</span>
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}

function AppContent() {
  const { t } = useTranslation();
  const {
    orderState,
    setOrderState,
    setPickupLocation,
    setDestinationLocation,
    resetLocations,
    calculatePrice,
    setCurrentOrderId,
    addBid,
    setAssignedDriver,
    createOrderMessage,
    cancelOrderMessage,
    acceptBidMessage,
    removeBid,
    pickupLocation,
    destinationLocation,
    user,
    setUser,
    editingLocation,
    setEditingLocation,
  } = useOrder();

  const [mapCenter, setMapCenter] = useState<[number, number]>(
    [DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng]
  );
  const [mapZoom, setMapZoom] = useState(MAP_CONFIG.defaultZoom);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null); // null = checking, false = not logged in, true = logged in
  const [needsProfile, setNeedsProfile] = useState(false);
  const [isSyncingOrder, setIsSyncingOrder] = useState(true); // Track if waiting for server sync
  const [hasReceivedOrderSync, setHasReceivedOrderSync] = useState(false); // Track if we received order sync from server
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [showUserProfileDialog, setShowUserProfileDialog] = useState(false);

  const { location: geoLocation, getCurrentLocation: getGeoLocation } = useGeolocation();

  // Subscribe to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = authService.subscribeToAuthState((authUser) => {
      setUser(authUser);
      setIsLoggedIn(!!authUser);
      // Reset needsProfile when user logs out
      if (!authUser) {
        setNeedsProfile(false);
      }
    });

    return () => unsubscribe();
  }, [setUser]);

  // Stop syncing after auth is resolved and we've waited for server sync
  useEffect(() => {
    if (isLoggedIn !== null) {
      // Auth state resolved, give server 2 seconds to send order_state_sync
      const timer = setTimeout(() => {
        if (!hasReceivedOrderSync) {
          // No order sync received, user doesn't have active order
          setIsSyncingOrder(false);
        }
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, hasReceivedOrderSync]);

  const handleLoginSuccess = useCallback(() => {
    // isLoggedIn will be updated by the auth state listener
  }, []);

  const handleLogout = useCallback(() => {
    authService.signOut();
    setIsLoggedIn(false);
    setUser(null);
    setNeedsProfile(false);
    setHasReceivedOrderSync(false);
    setOrderState('booking');
    resetLocations();
    setCurrentOrderId(null);
    setAssignedDriver(null);
  }, [setUser, setOrderState, resetLocations, setCurrentOrderId]);

  // Send auth message to backend when user logs in
  useEffect(() => {
    if (user && isLoggedIn && !needsProfile) {
      const authMessage: WebSocketMessage = {
        intent: 'auth',
        data: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        },
        timestamp: Math.floor(Date.now() / 1000),
      };
      sendMessage(authMessage);
    }
  }, [user, isLoggedIn, needsProfile]);

  const handleWebSocketMessage = useCallback((data: WebSocketMessage) => {
    console.log('Received message:', data);

    switch (data.intent) {
      case 'auth_success':
        console.log('Auth success:', data.data);
        // Server will send order_state_sync if user has active order
        break;

      case 'order_state_sync':
        console.log('Order state synced from server:', data.data);
        // Server tells us what state to show (multi-tab sync)
        const { order_id, ui_state, pickup, destination, bids, ...orderData } = data.data as any;

        // Update state
        setCurrentOrderId(order_id.toString());
        setOrderState(ui_state as OrderState);

        // Restore order data from server
        if (pickup) {
          setPickupLocation(
            { lat: orderData.pickup_latitude, lon: orderData.pickup_longitude },
            pickup
          );
        }
        if (destination) {
          setDestinationLocation(
            { lat: orderData.destination_latitude, lon: orderData.destination_longitude },
            destination
          );
        }

        // Restore bids from server
        if (bids && Array.isArray(bids)) {
          console.log(`Restoring ${bids.length} existing bids`);
          bids.forEach((bid: any) => {
            // Convert bid to Bid type and add to context
            addBid({
              bid_id: bid.bid_id?.toString() || bid.id?.toString() || '',
              driver_id: bid.driver_id || '',
              driver_name: bid.driver_name || 'Driver',
              bid_price: bid.bid_price || 0,
              eta_minutes: bid.eta_minutes || 5,
              rating: bid.rating || 4.8,
              vehicle: bid.vehicle || 'Toyota Avanza',
              plate_number: bid.plate_number || '',
            });
          });
        }

        // Mark that we received order sync
        setHasReceivedOrderSync(true);
        // Stop syncing - we have the state
        setIsSyncingOrder(false);
        break;

      case 'existing_order_found':
        console.log('Existing order found:', data.data);
        // User tried to create order while one is active
        const { order_id: existingOrderId, ui_state: existingUiState } = data.data as any;
        setCurrentOrderId(existingOrderId.toString());
        setOrderState(existingUiState as OrderState);
        // Mark that we received order sync
        setHasReceivedOrderSync(true);
        // Stop syncing
        setIsSyncingOrder(false);
        setToast({
          message: 'You already have an active order',
          type: 'info',
        });
        break;

      case 'order_created':
        console.log('Order created:', data.data);
        const orderId = data.data as number;
        setCurrentOrderId(orderId.toString());
        setOrderState('waiting_bids');
        break;

      case 'new_bid_received':
        console.log('New bid received:', data.data);
        const bid = (data.data as { bid?: Bid })?.bid || (data.data as Bid);
        if (bid) {
          addBid(bid);
          setToast({ message: 'New bid received!', type: 'info' });
        }
        break;

      case 'bid_accepted':
        console.log('Bid accepted:', data.data);
        break;

      case 'bid_rejected':
        console.log('Bid rejected:', data.data);
        // Note: Backend broadcasts this to the driver, not customer
        // Customer doesn't need to handle this
        break;

      case 'driver_arrived':
        setToast({ message: 'Driver has arrived at pickup location!', type: 'success' });
        break;

      case 'trip_completed':
        console.log('Trip completed:', data.data);
        const tripData = data.data as any;
        
        // Show rating dialog if flag is set
        if (tripData.show_rating) {
          setReviewData({
            order_id: tripData.order_id,
            driver_id: tripData.driver_id,
            driver_name: tripData.driver_name || 'Driver',
            driver_photo: tripData.driver_photo,
            vehicle: tripData.vehicle,
            plate_number: tripData.plate_number,
            rating: 0,
          });
          setShowRatingDialog(true);
        }
        
        setToast({ message: 'Trip completed! Please rate your driver.', type: 'success' });
        break;

      case 'order_cancelled':
        console.log('Order cancelled:', data.data);
        setIsSubmitting(false);
        setOrderState('booking');
        resetLocations();
        setToast({ message: 'Order cancelled successfully', type: 'info' });
        break;

      case 'error':
        console.error('Error from server:', data.data);
        setToast({
          message: `Error: ${(data.data as { message?: string })?.message || 'Unknown error'}`,
          type: 'info',
        });
        break;

      default:
        console.log('Unhandled message intent:', data.intent);
    }
  }, [setCurrentOrderId, setOrderState, addBid, resetLocations]);

  const { status, sendMessage } = useWebSocket(handleWebSocketMessage);

  // Send complete profile message to backend
  const handleCompleteProfile = useCallback((profileData: { email: string; displayName: string; phoneNumber: string }) => {
    if (!user) return;

    const completeProfileMessage: WebSocketMessage = {
      intent: 'complete_profile',
      data: {
        uid: user.uid,
        email: profileData.email,
        displayName: profileData.displayName,
        phoneNumber: profileData.phoneNumber,
      },
      timestamp: Math.floor(Date.now() / 1000),
    };
    sendMessage(completeProfileMessage);
  }, [user, sendMessage]);

  // Handle geolocation result
  useEffect(() => {
    if (geoLocation && !geoLocation.error) {
      setMapCenter([geoLocation.lat, geoLocation.lng]);
      setMapZoom(MAP_CONFIG.locationZoom);
      setIsGettingLocation(false);
      setToast({ message: 'Location found!', type: 'success' });
    }
  }, [geoLocation]);

  const handleGetCurrentLocation = useCallback(() => {
    setIsGettingLocation(true);
    getGeoLocation();
  }, [getGeoLocation]);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `/api/nominatim/reverse?format=json&lat=${lat}&lon=${lng}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Response is not JSON');
      }
      
      const data = await response.json();
      const address = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

      // Handle location selection based on editing mode
      if (editingLocation === 'pickup') {
        // User is editing pickup location
        setPickupLocation({ lat, lon: lng }, address);
        setEditingLocation(null); // Exit edit mode
      } else if (editingLocation === 'destination') {
        // User is editing destination location
        setDestinationLocation({ lat, lon: lng }, address);
        setEditingLocation(null); // Exit edit mode
      } else if (!pickupLocation) {
        // No pickup yet - set pickup
        setPickupLocation({ lat, lon: lng }, address);
      } else if (!destinationLocation) {
        // Has pickup, no destination - set destination
        setDestinationLocation({ lat, lon: lng }, address);
      } else {
        // Both set, no edit mode - do nothing (user should use edit buttons)
        console.log('Both locations set. Use edit buttons to change locations.');
      }
    } catch (error) {
      console.warn('Reverse geocoding failed, using coordinates:', error);
      const coords = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      
      if (editingLocation === 'pickup') {
        setPickupLocation({ lat, lon: lng }, coords);
        setEditingLocation(null);
      } else if (editingLocation === 'destination') {
        setDestinationLocation({ lat, lon: lng }, coords);
        setEditingLocation(null);
      } else if (!pickupLocation) {
        setPickupLocation({ lat, lon: lng }, coords);
      } else if (!destinationLocation) {
        setDestinationLocation({ lat, lon: lng }, coords);
      } else {
        setPickupLocation({ lat, lon: lng }, coords);
      }
    }
  }, [pickupLocation, destinationLocation, editingLocation, setEditingLocation, setPickupLocation, setDestinationLocation]);

  const handleRouteDrawn = useCallback((distance: number) => {
    calculatePrice(distance);
  }, [calculatePrice]);

  const handleSubmitOrder = useCallback(() => {
    const message = createOrderMessage();
    if (message) {
      setIsSubmitting(true);
      sendMessage(message);
    }
  }, [createOrderMessage, sendMessage]);

  const handleCancelOrder = useCallback(() => {
    // Prevent cancel while waiting for server sync
    if (isSyncingOrder) {
      setToast({
        message: 'Please wait while loading your order...',
        type: 'info',
      });
      return;
    }
    
    if (window.confirm('Are you sure you want to cancel this order?')) {
      setIsSubmitting(false);
      const message = cancelOrderMessage();
      if (message) {
        sendMessage(message);
      }
    }
  }, [cancelOrderMessage, sendMessage, isSyncingOrder]);

  const handleAcceptBid = useCallback((bid: Bid) => {
    console.log('Accepting bid:', bid);
    const message = acceptBidMessage(bid);
    if (message) {
      sendMessage(message);
    }

    setAssignedDriver({
      driver_name: bid.driver_name,
      rating: bid.rating,
      vehicle: bid.vehicle,
      plate_number: bid.plate_number,
      eta_minutes: bid.eta_minutes,
      bid_price: bid.bid_price,
    });
    setOrderState('driver_assigned');
    setToast({ message: 'Driver accepted! They are on the way.', type: 'success' });
  }, [acceptBidMessage, sendMessage, setAssignedDriver, setOrderState]);

  const handleDeclineBid = useCallback((bid: Bid) => {
    console.log('Declining bid:', bid);
    // Remove the declined bid from the list
    removeBid(bid.bid_id);
    setToast({
      message: `Bid from ${bid.driver_name || 'Driver'} declined`,
      type: 'info'
    });
  }, [removeBid]);

  const handleBackToHome = useCallback(() => {
    setIsSubmitting(false);
    setOrderState('booking');
    resetLocations();
    setAssignedDriver(null);
  }, [setOrderState, resetLocations, setAssignedDriver]);

  const handleReviewSubmit = useCallback((rating: number, review: string) => {
    if (!reviewData) return;

    const reviewMessage: WebSocketMessage = {
      intent: 'submit_review',
      data: {
        order_id: reviewData.order_id,
        driver_id: reviewData.driver_id,
        rating: rating,
        review: review,
      },
      timestamp: Math.floor(Date.now() / 1000),
    };

    sendMessage(reviewMessage);
    setShowRatingDialog(false);
    setReviewData(null);
    setToast({ message: 'Thank you for your review!', type: 'success' });
    
    // Reset to booking state after review
    setOrderState('booking');
    resetLocations();
    setCurrentOrderId(null);
  }, [reviewData, sendMessage, setOrderState, resetLocations, setCurrentOrderId]);

  const handleRatingDialogClose = useCallback(() => {
    setShowRatingDialog(false);
    setReviewData(null);
  }, []);

  // Initialize map with current location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setMapCenter([lat, lng]);
          console.log('Map initialized with current location:', lat, lng);
        },
        () => {
          console.warn('Geolocation not available, using default location');
          setMapCenter([DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng]);
        },
        {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    } else {
      console.warn('Geolocation not supported, using default location');
      setMapCenter([DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng]);
    }
  }, []);

  return (
    <>
      {/* Show loading overlay while checking auth state */}
      {isLoggedIn === null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[4000]">
          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-600 font-medium">{t('app.loading')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Show Login Dialog only if user is confirmed NOT logged in */}
      {isLoggedIn === false && <LoginDialog onLoginSuccess={handleLoginSuccess} />}

      {/* Show Profile Completion Dialog if user needs to complete profile */}
      {isLoggedIn === true && needsProfile && (
        <ProfileCompletionDialog onComplete={handleCompleteProfile} />
      )}

      {/* Show main app when logged in and profile is complete (or not needed) */}
      {isLoggedIn === true && !needsProfile && (
        <>
          <Map
            center={mapCenter}
            zoom={mapZoom}
            onMapClick={handleMapClick}
            onRouteDrawn={handleRouteDrawn}
          />

      <div className="order-panel absolute top-5 right-5 w-[380px] max-h-[calc(100vh-40px)] bg-white rounded-2xl shadow-xl z-[1000] overflow-y-auto custom-scrollbar">
        {orderState === 'booking' && (
          <>
            <div className="p-6 pb-4 border-b border-gray-200">
              <div className="flex justify-between items-center mb-1">
                <h1 className="text-2xl font-bold text-gray-900">🚗 {t('booking.title')}</h1>
                {user && (
                  <button
                    onClick={() => setShowUserProfileDialog(true)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors ${
                      status === 'connecting' || status === 'reconnecting'
                        ? 'animate-pulse ring-2 ring-yellow-500'
                        : status === 'connected'
                        ? 'ring-2 ring-green-500'
                        : 'ring-2 ring-red-500'
                    }`}
                    title={t('settings.profile')}
                  >
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'User'}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                        status === 'connecting' || status === 'reconnecting'
                          ? 'bg-yellow-500'
                          : status === 'connected'
                          ? 'bg-green-500'
                          : 'bg-red-500'
                      }`}>
                        {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-600">{t('booking.subtitle')}</p>
            </div>
            <BookingPanel
              onSubmit={handleSubmitOrder}
              isSubmitting={isSubmitting}
              getCurrentLocation={handleGetCurrentLocation}
              isGettingLocation={isGettingLocation}
              onEditPickup={() => setEditingLocation('pickup')}
              onEditDestination={() => setEditingLocation('destination')}
            />
          </>
        )}

        {orderState === 'waiting_bids' && (
          <>
            <div className="p-6 pb-4 border-b border-gray-200">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">🚗 {t('order.status.searching')}</h1>
              <p className="text-sm text-gray-600">{t('order.waitingForDriver')}</p>
            </div>
            <WaitingBidsPanel
              onAcceptBid={handleAcceptBid}
              onDeclineBid={handleDeclineBid}
              onCancelOrder={handleCancelOrder}
              isSyncing={isSyncingOrder}
            />
          </>
        )}

        {orderState === 'driver_assigned' && (
          <DriverAssignedPanel onBackToHome={handleBackToHome} />
        )}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <RatingDialog
        isOpen={showRatingDialog}
        reviewData={reviewData}
        onSubmit={handleReviewSubmit}
        onClose={handleRatingDialogClose}
      />

      <UserProfileDialog
        isOpen={showUserProfileDialog}
        onClose={() => setShowUserProfileDialog(false)}
        onLogout={handleLogout}
      />
        </>
      )}
    </>
  );
}

export default function App() {
  return (
    <OrderProvider>
      <AppContent />
    </OrderProvider>
  );
}
