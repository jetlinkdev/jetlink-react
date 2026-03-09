import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  OrderState,
  Location,
  Bid,
  OrderData,
  DriverInfo,
  PriceEstimate,
  WebSocketMessage,
} from '../types';
import { PRICING } from '../config/constants';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface OrderContextType {
  orderState: OrderState;
  pickupLocation: Location | null;
  destinationLocation: Location | null;
  pickupAddress: string;
  destinationAddress: string;
  pickupTime: string | null; // null means "Segera"
  notes: string;
  paymentMethod: 'cash' | 'qris';
  priceEstimate: PriceEstimate | null;
  currentOrderId: string | null;
  bids: Bid[];
  assignedDriver: DriverInfo | null;
  user: AuthUser | null;
  editingLocation: 'pickup' | 'destination' | null;
  routeCoordinates: [number, number][] | null; // Route coordinates from OSRM
  orderCreatedAt: number | null; // Timestamp when order was created (for countdown)
  userTTLPreference: number; // User's TTL preference in seconds
  setPickupLocation: (location: Location, address: string) => void;
  setDestinationLocation: (location: Location, address: string) => void;
  resetLocations: () => void;
  setPickupTime: (time: string | null) => void;
  setNotes: (notes: string) => void;
  setPaymentMethod: (method: 'cash' | 'qris') => void;
  calculatePrice: (distanceKm: number) => void;
  setOrderState: (state: OrderState) => void;
  setCurrentOrderId: (id: string | null) => void;
  addBid: (bid: Bid) => void;
  setAssignedDriver: (driver: DriverInfo | null) => void;
  setUser: (user: AuthUser | null) => void;
  setEditingLocation: (location: 'pickup' | 'destination' | null) => void;
  setRouteCoordinates: (coordinates: [number, number][] | null) => void;
  setOrderCreatedAt: (timestamp: number | null) => void;
  setUserTTLPreference: (ttl: number) => void;
  createOrderMessage: () => WebSocketMessage | null;
  cancelOrderMessage: () => WebSocketMessage | null;
  acceptBidMessage: (bid: Bid) => WebSocketMessage | null;
  declineBidMessage: (bid: Bid) => WebSocketMessage | null;
  removeBid: (bidId: number) => void;
  getMinPickupTime: () => string;
  getPickupTimeLabel: () => string;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export function OrderProvider({ children }: { children: ReactNode }) {
  const [orderState, setOrderState] = useState<OrderState>('booking');
  const [pickupLocation, setPickupLocationState] = useState<Location | null>(null);
  const [destinationLocation, setDestinationLocationState] = useState<Location | null>(null);
  const [pickupAddress, setPickupAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [pickupTime, setPickupTime] = useState<string | null>(null); // null = "Segera"
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris'>('cash');
  const [priceEstimate, setPriceEstimate] = useState<PriceEstimate | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [assignedDriver, setAssignedDriver] = useState<DriverInfo | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [editingLocation, setEditingLocation] = useState<'pickup' | 'destination' | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][] | null>(null);
  const [orderCreatedAt, setOrderCreatedAt] = useState<number | null>(null);
  const [userTTLPreference, setUserTTLPreference] = useState<number>(300); // Default 5 minutes

  const setPickupLocation = useCallback((location: Location, address: string) => {
    setPickupLocationState(location);
    setPickupAddress(address);
    // Reset destination when pickup changes
    setDestinationLocationState(null);
    setDestinationAddress('');
    setPriceEstimate(null);
  }, []);

  const setDestinationLocation = useCallback((location: Location, address: string) => {
    setDestinationLocationState(location);
    setDestinationAddress(address);
  }, []);

  const resetLocations = useCallback(() => {
    setPickupLocationState(null);
    setDestinationLocationState(null);
    setPickupAddress('');
    setDestinationAddress('');
    setPriceEstimate(null);
  }, []);

  // Get minimum pickup time (10 minutes from now)
  const getMinPickupTime = useCallback(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 10);
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }, []);

  // Get display label for pickup time
  const getPickupTimeLabel = useCallback(() => {
    if (!pickupTime) return 'Segera';
    const date = new Date(pickupTime);
    return date.toLocaleString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [pickupTime]);

  const calculatePrice = useCallback((distanceKm: number) => {
    const baseFare = PRICING.BASE_FARE;
    const totalPrice = baseFare + (distanceKm * PRICING.PRICE_PER_KM);
    setPriceEstimate({
      baseFare,
      distance: distanceKm,
      totalPrice: Math.round(totalPrice),
    });
  }, []);

  const addBid = useCallback((bid: Bid) => {
    setBids((prev) => [bid, ...prev]);
  }, []);

  const createOrderMessage = useCallback((): WebSocketMessage | null => {
    // Require user to be authenticated
    if (!user || !user.uid) {
      console.error('User must be authenticated to create an order');
      return null;
    }

    if (!pickupLocation || !destinationLocation) {
      return null;
    }

    const orderData: OrderData = {
      pickup: pickupAddress,
      pickup_latitude: pickupLocation.lat,
      pickup_longitude: pickupLocation.lon,
      destination: destinationAddress,
      destination_latitude: destinationLocation.lat,
      destination_longitude: destinationLocation.lon,
      notes,
      time: pickupTime ? Math.floor(new Date(pickupTime).getTime() / 1000) : null,
      payment: paymentMethod,
      user_id: user.uid, // Use Firebase UID directly without prefix
      // Stringify route coordinates array for backend storage
      route_coordinates: routeCoordinates ? JSON.stringify(routeCoordinates) : undefined,
    };

    return {
      intent: 'create_order',
      data: orderData,
      timestamp: Math.floor(Date.now() / 1000),
    };
  }, [pickupLocation, destinationLocation, pickupAddress, destinationAddress, notes, pickupTime, paymentMethod, user, routeCoordinates]);

  const cancelOrderMessage = useCallback((): WebSocketMessage | null => {
    // Client doesn't need to send order_id anymore
    // Server will get it from the client's session (stored in Hub/Redis)
    return {
      intent: 'cancel_order',
      data: {}, // Empty data, server will use client's active order
      timestamp: Math.floor(Date.now() / 1000),
    };
  }, []);

  const acceptBidMessage = useCallback((bid: Bid): WebSocketMessage | null => {
    if (!currentOrderId) {
      return null;
    }

    // Convert to number for backend
    const orderId = parseInt(currentOrderId, 10);

    return {
      intent: 'select_bid',
      data: {
        order_id: orderId,
        bid_id: bid.bid_id,
      },
      timestamp: Math.floor(Date.now() / 1000),
    };
  }, [currentOrderId]);

  const declineBidMessage = useCallback((bid: Bid): WebSocketMessage | null => {
    // Currently, there's no backend endpoint for declining individual bids
    // Customer can only accept one bid (which auto-declines others)
    // This is a placeholder for future implementation
    console.log('Decline bid (not implemented):', bid);
    return null;
  }, []);

  const removeBid = useCallback((bidId: number) => {
    setBids((prev) => prev.filter((b) => b.bid_id !== bidId));
  }, []);

  return (
    <OrderContext.Provider
      value={{
        orderState,
        pickupLocation,
        destinationLocation,
        pickupAddress,
        destinationAddress,
        pickupTime,
        notes,
        paymentMethod,
        priceEstimate,
        currentOrderId,
        bids,
        assignedDriver,
        user,
        editingLocation,
        routeCoordinates,
        orderCreatedAt,
        userTTLPreference,
        setPickupLocation,
        setDestinationLocation,
        resetLocations,
        setPickupTime,
        setNotes,
        setPaymentMethod,
        calculatePrice,
        setOrderState,
        setCurrentOrderId,
        addBid,
        setAssignedDriver,
        setUser,
        setEditingLocation,
        setRouteCoordinates,
        setOrderCreatedAt,
        setUserTTLPreference,
        createOrderMessage,
        cancelOrderMessage,
        acceptBidMessage,
        declineBidMessage,
        removeBid,
        getMinPickupTime,
        getPickupTimeLabel,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}

export function useOrder() {
  const context = useContext(OrderContext);
  if (context === undefined) {
    throw new Error('useOrder must be used within an OrderProvider');
  }
  return context;
}
