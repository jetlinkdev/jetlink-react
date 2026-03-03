import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useOrder } from '../context/OrderContext';
import { pickupIcon, destinationIcon } from '../utils/mapIcons';
import { MAP_CONFIG, TILE_LAYER, OSRM_URL, DEFAULT_LOCATION } from '../config/constants';

interface MapClickHandlerProps {
  onMapClick: (lat: number, lng: number) => void;
}

function MapClickHandler({ onMapClick }: MapClickHandlerProps) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface RouteDrawerProps {
  pickupLocation: { lat: number; lon: number } | null;
  destinationLocation: { lat: number; lon: number } | null;
  onRouteDrawn: (distance: number, coordinates: [number, number][]) => void;
  setRouteCoordinates: (coordinates: [number, number][] | null) => void;
}

function RouteDrawer({ pickupLocation, destinationLocation, onRouteDrawn, setRouteCoordinates }: RouteDrawerProps) {
  const map = useMapEvents({});
  const routeLineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!pickupLocation || !destinationLocation) {
      if (routeLineRef.current) {
        map.removeLayer(routeLineRef.current);
        routeLineRef.current = null;
      }
      setRouteCoordinates(null);
      return;
    }

    const drawRoute = async () => {
      try {
        const response = await fetch(
          `${OSRM_URL}/route/v1/driving/${pickupLocation.lon},${pickupLocation.lat};${destinationLocation.lon},${destinationLocation.lat}?overview=full&geometries=geojson`
        );
        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coordinates = route.geometry.coordinates.map(
            (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
          );

          // Store coordinates in context
          setRouteCoordinates(coordinates);

          if (routeLineRef.current) {
            map.removeLayer(routeLineRef.current);
          }

          routeLineRef.current = L.polyline(coordinates, {
            color: '#4CAF50',
            weight: 5,
            opacity: 0.7,
            dashArray: '10, 10',
          }).addTo(map);

          const group = L.featureGroup([
            ...(pickupLocation ? [L.marker([pickupLocation.lat, pickupLocation.lon], { icon: pickupIcon })] : []),
            ...(destinationLocation ? [L.marker([destinationLocation.lat, destinationLocation.lon], { icon: destinationIcon })] : []),
            routeLineRef.current,
          ]);

          map.fitBounds(group.getBounds(), { padding: [50, 50] });

          const distance = route.distance / 1000; // Convert to km
          onRouteDrawn(distance, coordinates);
        }
      } catch (error) {
        console.error('Routing error:', error);
      }
    };

    drawRoute();

    return () => {
      if (routeLineRef.current) {
        map.removeLayer(routeLineRef.current);
        routeLineRef.current = null;
      }
    };
  }, [pickupLocation, destinationLocation, map, onRouteDrawn, setRouteCoordinates]);

  return null;
}

interface MapProps {
  center?: [number, number];
  zoom?: number;
  onMapClick: (lat: number, lng: number) => void;
  onRouteDrawn: (distance: number, coordinates: [number, number][]) => void;
}

export function Map(props: MapProps) {
  // Destructure with default values to handle undefined
  const {
    center = [DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng] as [number, number],
    zoom = MAP_CONFIG.defaultZoom,
    onMapClick,
    onRouteDrawn
  } = props;

  // Safe context access
  let pickupLocation = null;
  let destinationLocation = null;
  let editingLocation = null;
  let setRouteCoordinates: (coordinates: [number, number][] | null) => void = () => {};

  try {
    const orderContext = useOrder();
    pickupLocation = orderContext?.pickupLocation ?? null;
    destinationLocation = orderContext?.destinationLocation ?? null;
    editingLocation = orderContext?.editingLocation ?? null;
    setRouteCoordinates = orderContext?.setRouteCoordinates ?? (() => {});
  } catch (error) {
    // Context not available, use null
    console.warn('Map: OrderContext not available');
  }

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="absolute inset-0 z-0 pointer-events-auto"
      zoomControl={false}
    >
      <TileLayer
        url={TILE_LAYER.URL}
        attribution={TILE_LAYER.ATTRIBUTION}
        maxZoom={MAP_CONFIG.maxZoom}
      />
      <MapClickHandler onMapClick={onMapClick} />
      <RouteDrawer
        pickupLocation={pickupLocation}
        destinationLocation={destinationLocation}
        onRouteDrawn={onRouteDrawn}
        setRouteCoordinates={setRouteCoordinates}
      />
      {pickupLocation && (
        <Marker
          position={[pickupLocation.lat, pickupLocation.lon]}
          icon={pickupIcon}
        />
      )}
      {destinationLocation && (
        <Marker
          position={[destinationLocation.lat, destinationLocation.lon]}
          icon={destinationIcon}
        />
      )}
      {/* Edit mode indicator - show which location user is selecting */}
      {editingLocation && (
        <div className="absolute top-5 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-xl shadow-lg z-[2000] animate-[slideIn_0.3s_ease-out] pointer-events-none">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {editingLocation === 'pickup' ? (
                <>
                  <span className="text-green-400">📍</span> Pilih lokasi jemput, lalu klik di map
                </>
              ) : (
                <>
                  <span className="text-red-400">🏁</span> Pilih lokasi tujuan, lalu klik di map
                </>
              )}
            </span>
          </div>
        </div>
      )}
      {/* Hint when not in selection mode */}
      {!editingLocation && (
        <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg shadow-md z-[2000] text-xs pointer-events-none">
          <span>💡 Klik input "Lokasi Jemput" atau "Lokasi Tujuan" untuk memilih lokasi di map</span>
        </div>
      )}
    </MapContainer>
  );
}
