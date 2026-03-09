import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrder } from '../context/OrderContext';
import { Bid } from '../types';

interface WaitingBidsPanelProps {
  onAcceptBid: (bid: Bid) => void;
  onDeclineBid: (bid: Bid) => void;
  onCancelOrder: () => void;
  isSyncing?: boolean; // NEW: Track if waiting for server sync
}

export function WaitingBidsPanel({ onAcceptBid, onDeclineBid, onCancelOrder, isSyncing = false }: WaitingBidsPanelProps) {
  const { t } = useTranslation();
  const { pickupAddress, destinationAddress, priceEstimate, bids, orderCreatedAt, userTTLPreference } = useOrder();
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [timePercentage, setTimePercentage] = useState<number>(100);

  // Calculate time remaining based on order created timestamp and user TTL preference
  useEffect(() => {
    if (!orderCreatedAt || !userTTLPreference) {
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const orderAge = now - (orderCreatedAt * 1000); // Convert to milliseconds
      const ttlMilliseconds = userTTLPreference * 1000;
      const remaining = Math.max(0, ttlMilliseconds - orderAge);
      
      setTimeRemaining(remaining);
      setTimePercentage((remaining / ttlMilliseconds) * 100);
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [orderCreatedAt, userTTLPreference]);

  // Format time remaining as MM:SS
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Determine color based on time remaining (warning when < 30 seconds)
  const getTimeColor = () => {
    if (timeRemaining > 60000) return 'text-green-600 dark:text-green-400'; // > 1 min
    if (timeRemaining > 30000) return 'text-yellow-600 dark:text-yellow-400'; // 30-60 sec
    return 'text-red-600 dark:text-red-400'; // < 30 sec
  };

  const getProgressBarColor = () => {
    if (timeRemaining > 60000) return 'bg-green-500'; // > 1 min
    if (timeRemaining > 30000) return 'bg-yellow-500'; // 30-60 sec
    return 'bg-red-500'; // < 30 sec
  };

  return (
    <div className="p-6">
      {/* Countdown Timer */}
      {orderCreatedAt && userTTLPreference && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              ⏱️ {t('settings.ttl.label')}
            </span>
            <span className={`text-lg font-bold ${getTimeColor()}`}>
              {formatTime(timeRemaining)}
            </span>
          </div>
          <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ease-linear ${getProgressBarColor()}`}
              style={{ width: `${timePercentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
            {timeRemaining === 0 
              ? t('order.orderExpired') 
              : timeRemaining < 30000 
                ? t('order.orderExpiringSoon') 
                : t('order.orderWillExpire')}
          </p>
        </div>
      )}

      {/* Loading State */}
      <div className="text-center py-6">
        <div className="relative inline-block">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/20 border-t-primary" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl">🚗</span>
          </div>
        </div>
        <p className="mt-4 text-gray-700 dark:text-gray-300 font-medium">{t('order.searchingDrivers')}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">⏱️ {t('order.averageWait')}</p>
      </div>

      {/* Order Summary */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{t('order.summary')}</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              A
            </span>
            <p className="text-gray-600 dark:text-gray-400 truncate">{pickupAddress || '-'}</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              B
            </span>
            <p className="text-gray-600 dark:text-gray-400 truncate">{destinationAddress || '-'}</p>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
            <span className="text-gray-600 dark:text-gray-400">{t('order.estimatedFare')}</span>
            <span className="font-bold text-primary">
              Rp {priceEstimate?.totalPrice.toLocaleString('id-ID') || '0'}
            </span>
          </div>
        </div>
      </div>

      {/* Live Bids Section */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('order.liveBids')}</h3>
          <span className="text-xs bg-primary/10 dark:bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">
            {bids.length} {bids.length === 1 ? t('bid.minutes', { minutes: 'bid' }).replace(' min', '') : t('order.bidsReceived')}
          </span>
        </div>

        {/* Bids List */}
        <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
          {bids.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p className="text-sm">{t('order.noBidsYet')}</p>
              <p className="text-xs mt-1">{t('order.driversWillReceive')}</p>
            </div>
          ) : (
            bids.map((bid) => (
              <div
                key={`${bid.driver_id}-${Date.now()}`}
                className="bid-card bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:border-primary transition-all cursor-pointer animate-[slideIn_0.3s_ease-out]"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold">
                      {bid.driver_name?.charAt(0) || 'D'}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">{bid.driver_name || t('driver.name')}</h4>
                      <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                        <span>⭐</span>
                        <span className="font-medium">{bid.rating || '4.8'}</span>
                        <span>•</span>
                        <span>{bid.vehicle || t('vehicle.car')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">
                      Rp {bid.bid_price?.toLocaleString('id-ID') || '0'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{bid.eta_minutes || '5'} {t('driver.away')}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onAcceptBid(bid)}
                    className="flex-1 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-dark transition-all"
                  >
                    {t('order.acceptBid')}
                  </button>
                  <button
                    onClick={() => onDeclineBid(bid)}
                    className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                  >
                    {t('order.declineBid')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Cancel Button */}
      <button
        type="button"
        onClick={onCancelOrder}
        disabled={isSyncing}
        className="w-full py-3 border-2 border-red-500 text-red-500 dark:text-red-400 font-semibold rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSyncing ? t('order.loadingOrder') : t('order.cancelOrder')}
      </button>
    </div>
  );
}
