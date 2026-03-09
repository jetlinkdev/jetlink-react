import { useState, useEffect, useCallback, useRef } from 'react';
import { ConnectionStatus, WebSocketMessage } from '../types';
import { WS_URL, RECONNECT_CONFIG } from '../config/constants';

interface UseWebSocketReturn {
  status: ConnectionStatus;
  sendMessage: (message: WebSocketMessage) => void;
  isConnected: boolean;
}

/**
 * Calculates reconnect delay using exponential backoff with jitter
 * Formula: min(maxDelay, baseDelay * 2^attempt + randomJitter)
 */
function calculateBackoffDelay(attempt: number): number {
  const { BASE_DELAY_MS, MAX_DELAY_MS, JITTER_MS } = RECONNECT_CONFIG;
  const exponentialDelay = BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * JITTER_MS;
  return Math.min(MAX_DELAY_MS, exponentialDelay + jitter);
}

/**
 * Checks if WebSocket close was intentional/clean
 * Clean close codes: 1000 (Normal), 1001 (Going Away)
 */
function isCleanClose(code: number): boolean {
  return code === 1000 || code === 1001;
}

export function useWebSocket(onMessage?: (data: WebSocketMessage) => void): UseWebSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  const isManualCloseRef = useRef(false);
  const visibilityChangeHandlerRef = useRef<(() => void) | null>(null);

  // Update ref when onMessage changes
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    // Clear any pending reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;

      // Close without checking closeCode (not available on WebSocket object)
      wsRef.current.close(1000, 'Client reconnecting');
      wsRef.current = null;
    }

    // Don't auto-reconnect if user manually closed
    if (isManualCloseRef.current) {
      console.log('Manual close detected, skipping auto-reconnect');
      return;
    }

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      console.log('Connecting to WebSocket:', WS_URL);
      setStatus('connecting');

      ws.onopen = () => {
        console.log('WebSocket connected');
        setStatus('connected');
        reconnectAttemptsRef.current = 0;
      };

      ws.onclose = (event) => {
        const { code, reason, wasClean } = event;
        console.log('WebSocket disconnected:', { code, reason, wasClean });

        // Check if this was a clean/intentional close
        if (isCleanClose(code)) {
          console.log('Clean close detected, not reconnecting');
          setStatus('disconnected');
          return;
        }

        // Don't reconnect if max attempts reached
        if (reconnectAttemptsRef.current >= RECONNECT_CONFIG.MAX_ATTEMPTS) {
          console.log('Max reconnect attempts reached');
          setStatus('disconnected');
          return;
        }

        // Calculate exponential backoff delay
        const delay = calculateBackoffDelay(reconnectAttemptsRef.current);
        console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`);
        
        reconnectAttemptsRef.current++;
        setStatus('reconnecting');
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setStatus('disconnected');
      };

      ws.onmessage = (event) => {
        console.log('Message from server:', event.data);
        try {
          const data = JSON.parse(event.data);
          if (onMessageRef.current) {
            onMessageRef.current(data);
          }
        } catch (e) {
          console.log('Raw message:', event.data);
        }
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setStatus('disconnected');
      
      // Schedule reconnect with exponential backoff
      if (reconnectAttemptsRef.current < RECONNECT_CONFIG.MAX_ATTEMPTS) {
        const delay = calculateBackoffDelay(reconnectAttemptsRef.current);
        reconnectAttemptsRef.current++;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      }
    }
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    const ws = wsRef.current;
    
    // Strict readyState validation
    if (!ws) {
      console.warn('WebSocket not initialized, message not sent:', message);
      return;
    }

    if (ws.readyState !== WebSocket.OPEN) {
      const stateMap: Record<number, string> = {
        [WebSocket.CONNECTING]: 'CONNECTING',
        [WebSocket.OPEN]: 'OPEN',
        [WebSocket.CLOSING]: 'CLOSING',
        [WebSocket.CLOSED]: 'CLOSED',
      };
      console.warn(
        `WebSocket not ready (state: ${stateMap[ws.readyState]}), message not sent:`,
        message
      );
      return;
    }

    try {
      ws.send(JSON.stringify(message));
      console.log('Sent:', message);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Don't throw - let the app handle it gracefully
    }
  }, []);

  useEffect(() => {
    // Initial connection
    connect();

    // Visibility API handler - reconnect when user returns to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, checking connection...');

        // Don't reconnect if WebSocket is still open
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          console.log('WebSocket connection is healthy, skipping reconnect');
          return;
        }

        // If disconnected or reconnecting, try to connect
        if (status === 'disconnected' || status === 'reconnecting') {
          console.log('Connection lost, attempting reconnect...');
          reconnectAttemptsRef.current = 0; // Reset attempts for fresh start
          connect();
        } else {
          // Connection might be stale, force reconnect
          console.log('Connection stale, forcing reconnect...');
          connect();
        }
      }
    };

    // Store handler reference for cleanup
    visibilityChangeHandlerRef.current = handleVisibilityChange;

    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup function
    return () => {
      console.log('Cleaning up WebSocket hook...');

      // Remove visibility listener
      if (visibilityChangeHandlerRef.current) {
        document.removeEventListener('visibilitychange', visibilityChangeHandlerRef.current);
        visibilityChangeHandlerRef.current = null;
      }

      // Clear reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Close WebSocket connection with proper cleanup
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;

        // Use close code 1000 (Normal Closure)
        wsRef.current.close(1000, 'Component unmounting');
        wsRef.current = null;
      }

      // Reset manual close flag
      isManualCloseRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    status,
    sendMessage,
    isConnected: status === 'connected',
  };
}
