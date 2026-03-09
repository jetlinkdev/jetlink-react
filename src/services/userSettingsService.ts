import { authService } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export type UserSettings = {
  orderTtlPreference: number; // in seconds
};

class UserSettingsService {
  private async getAuthHeaders(): Promise<HeadersInit> {
    const user = authService.getCurrentUser();
    const token = user ? await user.getIdToken() : null;
    
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }

  /**
   * Get user's order TTL preference
   */
  public async getOrderTTLPreference(): Promise<number> {
    const user = authService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const response = await fetch(
      `${API_BASE_URL}/user/settings/order-ttl?uid=${user.uid}`,
      {
        method: 'GET',
        headers: await this.getAuthHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get TTL preference');
    }

    const data = await response.json();
    return data.data.ttlSeconds || 300; // Default 5 minutes
  }

  /**
   * Update user's order TTL preference
   * @param ttlSeconds - TTL in seconds (60-300)
   */
  public async updateOrderTTLPreference(ttlSeconds: number): Promise<void> {
    const user = authService.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    if (ttlSeconds < 60 || ttlSeconds > 300) {
      throw new Error('TTL must be between 60 and 300 seconds (1-5 minutes)');
    }

    const response = await fetch(
      `${API_BASE_URL}/user/settings/order-ttl`,
      {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({
          uid: user.uid,
          ttlSeconds,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update TTL preference');
    }
  }

  /**
   * Get all user settings
   */
  public async getAllSettings(): Promise<UserSettings> {
    const orderTtlPreference = await this.getOrderTTLPreference();
    return { orderTtlPreference };
  }
}

export const userSettingsService = new UserSettingsService();
