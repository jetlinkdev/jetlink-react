export const WS_URL = 'ws://localhost:8080/ws';

export const DEFAULT_LOCATION = {
  lat: -8.1716,
  lng: 113.6969, // Universitas Jember
};

export const MAP_CONFIG = {
  defaultZoom: 13,
  locationZoom: 15,
  maxZoom: 19,
};

export const PRICING = {
  BASE_FARE: 10000,
  PRICE_PER_KM: 5000,
};

export const RECONNECT_CONFIG = {
  MAX_ATTEMPTS: 5,
  BASE_DELAY_MS: 1000,    // Starting delay: 1 second
  MAX_DELAY_MS: 30000,    // Maximum delay: 30 seconds
  JITTER_MS: 1000,        // Random jitter: up to 1 second
};

export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
export const OSRM_URL = 'https://router.project-osrm.org';

export const TILE_LAYER = {
  URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  ATTRIBUTION: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};
