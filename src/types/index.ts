export type OrderState = 'booking' | 'waiting_bids' | 'driver_assigned' | 'completed' | 'cancelled';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export type PaymentMethod = 'cash' | 'qris';

export interface Location {
  lat: number;
  lon: number;
  address?: string;
}

export interface Bid {
  bid_id: number;
  driver_id: string;
  driver_name: string;
  rating: number;
  vehicle: string;
  plate_number: string;
  bid_price: number;
  eta_minutes: number;
}

export interface OrderData {
  pickup: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  destination: string;
  destination_latitude?: number;
  destination_longitude?: number;
  notes: string;
  time: number | null; // null means "Segera"
  payment: PaymentMethod;
  user_id: string;
  route_coordinates?: string; // Stringified array of [lon, lat] coordinates from OSRM
}

export interface TimeOption {
  value: string | null; // ISO string or null for "Segera"
  label: string;
}

export interface DriverInfo {
  driver_name: string;
  rating: number;
  vehicle: string;
  plate_number: string;
  eta_minutes: number;
  bid_price: number;
}

export interface PriceEstimate {
  baseFare: number;
  distance: number;
  totalPrice: number;
}

export interface WebSocketMessage {
  intent: string;
  data?: unknown;
  timestamp: number;
}

export interface Suggestion {
  lat: string;
  lon: string;
  display_name: string;
}

export interface ReviewData {
  order_id: number;
  driver_id: string;
  driver_name: string;
  driver_photo?: string;
  vehicle?: string;
  plate_number?: string;
  rating: number;
  review?: string;
}
