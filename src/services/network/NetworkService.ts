import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { logger } from '../../utils/logger';

/**
 * Service for checking network connectivity
 */
export class NetworkService {
  private static listeners: Array<(isOnline: boolean) => void> = [];

  /**
   * Check if device is currently online
   */
  static async isOnline(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      return state.isConnected === true && state.isInternetReachable !== false;
    } catch (error) {
      logger.error('[NetworkService] Error checking connectivity:', error);
      // Fail closed - assume offline if we can't check
      return false;
    }
  }

  /**
   * Subscribe to network state changes
   * Returns unsubscribe function
   */
  static subscribe(callback: (isOnline: boolean) => void): () => void {
    this.listeners.push(callback);

    // Subscribe to NetInfo
    const unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      const isOnline = state.isConnected === true && state.isInternetReachable !== false;
      this.notifyListeners(isOnline);
    });

    // Return combined unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
      unsubscribeNetInfo();
    };
  }

  private static notifyListeners(isOnline: boolean) {
    this.listeners.forEach(listener => {
      try {
        listener(isOnline);
      } catch (error) {
        logger.error('[NetworkService] Error notifying listener:', error);
      }
    });
  }

  /**
   * Get detailed network state information
   */
  static async getNetworkState(): Promise<NetInfoState> {
    return await NetInfo.fetch();
  }
}
