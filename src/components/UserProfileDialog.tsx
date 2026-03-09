import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { useDarkMode } from '../context/DarkModeContext';
import { authService } from '../services/authService';
import { userSettingsService } from '../services/userSettingsService';

interface UserProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export function UserProfileDialog({ isOpen, onClose, onLogout }: UserProfileDialogProps) {
  const { t } = useTranslation();
  const { language, changeLanguage, languages } = useLanguage();
  const { isDark, toggleDarkMode } = useDarkMode();
  const user = authService.getCurrentUser();
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [orderTTL, setOrderTTL] = useState<number>(300); // Default 5 minutes
  const [showTTLSelector, setShowTTLSelector] = useState(false);
  const [ttlLoading, setTtlLoading] = useState(false);
  const [ttlError, setTtlError] = useState<string | null>(null);
  const [ttlSuccess, setTtlSuccess] = useState<string | null>(null);

  // Load user's TTL preference when dialog opens
  useEffect(() => {
    if (isOpen && user) {
      loadTTLPreference();
    }
  }, [isOpen, user]);

  const loadTTLPreference = async () => {
    try {
      setTtlError(null);
      const ttl = await userSettingsService.getOrderTTLPreference();
      setOrderTTL(ttl);
    } catch (err) {
      console.error('Failed to load TTL preference:', err);
      setTtlError(t('settings.ttl.loadError'));
    }
  };

  const handleTTLChange = async (newTTL: number) => {
    try {
      setTtlLoading(true);
      setTtlError(null);
      setTtlSuccess(null);
      
      await userSettingsService.updateOrderTTLPreference(newTTL);
      setOrderTTL(newTTL);
      setTtlSuccess(t('settings.ttl.saveSuccess'));
      setShowTTLSelector(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setTtlSuccess(null), 3000);
    } catch (err) {
      console.error('Failed to update TTL preference:', err);
      setTtlError(err instanceof Error ? err.message : t('settings.ttl.saveError'));
    } finally {
      setTtlLoading(false);
    }
  };

  const ttlMinutes = Math.floor(orderTTL / 60);
  const ttlSeconds = orderTTL % 60;

  if (!isOpen) return null;

  const currentLanguage = languages.find(lang => lang.code === language);

  const handleLogout = () => {
    onLogout();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[5000] animate-[fadeIn_0.2s_ease-out]">
      <div 
        className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md mx-4 overflow-hidden shadow-2xl animate-[scaleIn_0.3s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex items-center gap-4">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="w-20 h-20 rounded-full border-4 border-white/30 object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold border-4 border-white/30">
                {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-xl font-bold">{user?.displayName || t('profile.nameLabel')}</h2>
              <p className="text-green-100 text-sm">{user?.email || t('profile.emailLabel')}</p>
            </div>
          </div>
        </div>

        {/* Settings Sections */}
        <div className="p-6 space-y-6">
          {/* Language Setting */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
              {t('language.select')}
            </label>
            <div className="relative">
              <button
                onClick={() => setShowLanguageSelector(!showLanguageSelector)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-green-500 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.148" />
                  </svg>
                  <span className="text-gray-700 dark:text-gray-200 font-medium">{currentLanguage?.name}</span>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${showLanguageSelector ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showLanguageSelector && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowLanguageSelector(false)} />
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-700 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600 z-20 overflow-hidden">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          changeLanguage(lang.code);
                          setShowLanguageSelector(false);
                        }}
                        className={`w-full text-left px-4 py-3 transition-colors ${
                          language === lang.code
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        <div className="font-medium">{lang.name}</div>
                        {lang.code !== language && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">{lang.label}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Dark Mode Toggle */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
              {isDark ? t('settings.darkMode') : t('settings.lightMode')}
            </label>
            <button
              onClick={toggleDarkMode}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                isDark
                  ? 'bg-gray-800 border-gray-600 text-white'
                  : 'bg-gray-50 border-gray-200 text-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                {isDark ? (
                  <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 000-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z" />
                  </svg>
                )}
                <span className="font-medium">{isDark ? t('settings.darkMode') : t('settings.lightMode')}</span>
              </div>
              <div
                className={`w-14 h-8 rounded-full transition-colors relative ${
                  isDark ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
                    isDark ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </div>
            </button>
          </div>

          {/* Order TTL Preference */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
              {t('settings.ttl.label')}
            </label>
            
            {/* Success/Error Messages */}
            {ttlSuccess && (
              <div className="mb-3 px-4 py-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl border border-green-200 dark:border-green-800 text-sm">
                {ttlSuccess}
              </div>
            )}
            {ttlError && (
              <div className="mb-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800 text-sm">
                {ttlError}
              </div>
            )}
            
            <div className="relative">
              <button
                onClick={() => setShowTTLSelector(!showTTLSelector)}
                disabled={ttlLoading}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-green-500 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-left">
                    <span className="text-gray-700 dark:text-gray-200 font-medium">
                      {ttlMinutes}m {ttlSeconds > 0 ? `${ttlSeconds}s` : ''}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('settings.ttl.description')}</p>
                  </div>
                </div>
                {ttlLoading ? (
                  <svg className="animate-spin w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${showTTLSelector ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>

              {showTTLSelector && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowTTLSelector(false)} />
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-700 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600 z-20 overflow-hidden">
                    <div className="p-4 space-y-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('settings.ttl.select')}</p>
                      {[
                        { value: 60, label: '1 min' },
                        { value: 120, label: '2 min' },
                        { value: 180, label: '3 min' },
                        { value: 300, label: '5 min (default)' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => handleTTLChange(option.value)}
                          disabled={ttlLoading}
                          className={`w-full text-left px-4 py-3 rounded-lg transition-colors disabled:opacity-50 ${
                            orderTTL === option.value
                              ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 font-medium'
                              : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Legal Links */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
              {t('settings.legal')}
            </label>
            <div className="space-y-2">
              <a
                href="/terms-of-service.html"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors group"
              >
                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-green-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-gray-700 dark:text-gray-200 font-medium flex-1">{t('login.termsLink')}</span>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <a
                href="/privacy-policy.html"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors group"
              >
                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-green-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-gray-700 dark:text-gray-200 font-medium flex-1">{t('login.privacyLink')}</span>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-semibold rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors border-2 border-red-200 dark:border-red-800"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {t('app.logout')}
          </button>
        </div>
      </div>
    </div>
  );
}
