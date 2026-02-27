# Jetlink Customer App (React)

React-based customer application for Jetlink ride-hailing service.

## Tech Stack

- **React 18.3** with TypeScript
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Leaflet** - Interactive maps
- **Firebase** - Authentication (Google Sign-In)
- **WebSocket** - Real-time communication with backend
- **i18next** - Internationalization

## Features

- 🗺️ Interactive map with OpenStreetMap
- 🔐 Google Sign-In authentication via Firebase
- 🚕 Real-time ride booking
- 💬 WebSocket communication for live updates
- 🌍 Multi-language support (i18n)
- 📍 Reverse geocoding for address lookup
- 🎨 Modern UI with Tailwind CSS

## Prerequisites

- Node.js 18+ and npm
- Firebase project configured with Google Sign-In

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (Vite) |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |

## Configuration

### Firebase Setup

See [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) for detailed Firebase authentication configuration.

### API Configuration

Update WebSocket URL in `src/config/constants.ts`:

```typescript
export const WS_URL = 'wss://api.jetlink.my.id/ws';
```

### Environment Variables

Create a `.env` file in the root directory if needed:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
# ... other Firebase config
```

## Project Structure

```
jetlink-react/
├── public/              # Static assets
├── src/
│   ├── components/      # React components
│   │   ├── BookingPanel.tsx
│   │   ├── LoginDialog.tsx
│   │   ├── Map.tsx
│   │   └── ...
│   ├── config/          # Configuration files
│   │   ├── constants.ts
│   │   └── firebase.ts
│   ├── context/         # React Context providers
│   │   └── OrderContext.tsx
│   ├── hooks/           # Custom React hooks
│   │   └── useWebSocket.ts
│   ├── services/        # API and external services
│   │   └── authService.ts
│   ├── types/           # TypeScript type definitions
│   │   └── index.ts
│   ├── App.tsx          # Main application component
│   ├── main.tsx         # Application entry point
│   └── index.css        # Global styles
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## Development

### Running in Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

Production files will be generated in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Authentication Flow

1. User opens app → Login dialog appears
2. User clicks "Sign in with Google"
3. Firebase popup authentication
4. On success: Dialog closes, user info displayed
5. User can now book rides
6. Logout via header button

User ID format for orders: `customer_{firebase_uid}`

## WebSocket Communication

The app uses WebSocket for real-time communication with the backend:

- **Connection**: `wss://api.jetlink.my.id/ws`
- **Messages**: Order updates, bid notifications, driver tracking
- **Reconnection**: Automatic with exponential backoff

See `src/hooks/useWebSocket.ts` for implementation details.

## Map Integration

- **Provider**: OpenStreetMap
- **Geocoding**: Nominatim API
- **Routing**: OSRM (Open Source Routing Machine)
- **Library**: React-Leaflet

## Internationalization (i18n)

The app supports multiple languages using `react-i18next`. Configure translations in the `src/locales/` directory.

## Firebase Project

- **Project ID**: `jetlink-47eb8`
- **App ID**: `1:706026144910:web:9363c4e13dd7d5947475df`

## License

Proprietary - Jetlink

## Repository

https://github.com/jetlinkdev/jetlink-react.git
