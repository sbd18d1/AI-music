export type DeliveryMode = 'INSTANT' | 'SESSION_LOCK';

export interface SongData {
  audioUrl: string;
  isPreview: boolean;
  title: string;
  lyrics: string;
  coverImageUrl: string;
  duration: string;
}

export interface DeviceSession {
  deviceToken: string;
  audioUrl: string;
  title: string;
  status: 'unpaid' | 'paid';
  email?: string;
}

export interface DeliveryStrategy {
  mode: DeliveryMode;
  
  init(): void;
  
  canDownload(): boolean;
  
  shouldHideDownloadButton(): boolean;
  
  saveSongData(songData: SongData): void;
  
  getSavedSongData(): SongData | null;
  
  clearSongData(): void;
  
  generateDeviceToken(): string;
  
  getDeviceToken(): string | null;
  
  saveDeviceSession(session: DeviceSession): void;
  
  getDeviceSession(): DeviceSession | null;
  
  updateSessionStatus(status: 'paid'): void;
  
  hasUnpaidSong(): boolean;
  
  hasPaidBefore(): boolean;
}

const DELIVERY_MODE = (process.env.NEXT_PUBLIC_DELIVERY_MODE as DeliveryMode) || 'INSTANT';

class InstantDeliveryStrategy implements DeliveryStrategy {
  mode: DeliveryMode = 'INSTANT';
  
  private SONG_DATA_KEY = 'instant_song_data';
  private TRIAL_USED_KEY = 'instant_trial_used';
  
  init(): void {
    // 清除旧的 key 数据
    localStorage.removeItem('has_used_free_trial');
    localStorage.removeItem('trial_song_data');
  }
  
  canDownload(): boolean {
    return localStorage.getItem(this.TRIAL_USED_KEY) === 'paid';
  }
  
  shouldHideDownloadButton(): boolean {
    return localStorage.getItem(this.TRIAL_USED_KEY) !== 'paid';
  }
  
  saveSongData(songData: SongData): void {
    localStorage.setItem(this.SONG_DATA_KEY, JSON.stringify(songData));
    if (localStorage.getItem(this.TRIAL_USED_KEY) !== 'paid') {
      localStorage.setItem(this.TRIAL_USED_KEY, 'trial_used');
    }
  }
  
  getSavedSongData(): SongData | null {
    const stored = localStorage.getItem(this.SONG_DATA_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  }
  
  clearSongData(): void {
    localStorage.removeItem(this.SONG_DATA_KEY);
    localStorage.removeItem(this.TRIAL_USED_KEY);
  }
  
  generateDeviceToken(): string {
    return '';
  }
  
  getDeviceToken(): string | null {
    return null;
  }
  
  saveDeviceSession(session: DeviceSession): void {}
  
  getDeviceSession(): DeviceSession | null {
    return null;
  }
  
  updateSessionStatus(status: 'paid'): void {
    localStorage.setItem(this.TRIAL_USED_KEY, status);
  }
  
  hasUnpaidSong(): boolean {
    return localStorage.getItem(this.TRIAL_USED_KEY) === 'trial_used';
  }
  
  hasPaidBefore(): boolean {
    return localStorage.getItem(this.TRIAL_USED_KEY) === 'paid';
  }
}

class SessionLockDeliveryStrategy implements DeliveryStrategy {
  mode: DeliveryMode = 'SESSION_LOCK';
  
  private DEVICE_TOKEN_KEY = 'session_lock_device_token';
  private SESSION_KEY = 'session_lock_session';
  private HAS_PAID_KEY = 'session_lock_has_paid';
  
  init(): void {
    if (!this.getDeviceToken()) {
      this.generateDeviceToken();
    }
  }
  
  canDownload(): boolean {
    const session = this.getDeviceSession();
    return session?.status === 'paid';
  }
  
  shouldHideDownloadButton(): boolean {
    const session = this.getDeviceSession();
    return !session || session.status === 'unpaid';
  }
  
  saveSongData(songData: SongData): void {
    localStorage.setItem('session_lock_song_data', JSON.stringify(songData));
  }
  
  getSavedSongData(): SongData | null {
    const stored = localStorage.getItem('session_lock_song_data');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  }
  
  clearSongData(): void {
    localStorage.removeItem('session_lock_song_data');
    localStorage.removeItem(this.SESSION_KEY);
  }
  
  generateDeviceToken(): string {
    const token = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(this.DEVICE_TOKEN_KEY, token);
    return token;
  }
  
  getDeviceToken(): string | null {
    return localStorage.getItem(this.DEVICE_TOKEN_KEY);
  }
  
  saveDeviceSession(session: DeviceSession): void {
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
  }
  
  getDeviceSession(): DeviceSession | null {
    const stored = localStorage.getItem(this.SESSION_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  }
  
  updateSessionStatus(status: 'paid'): void {
    const session = this.getDeviceSession();
    if (session) {
      session.status = status;
      this.saveDeviceSession(session);
      localStorage.setItem(this.HAS_PAID_KEY, 'true');
    }
  }
  
  hasUnpaidSong(): boolean {
    const session = this.getDeviceSession();
    return session?.status === 'unpaid';
  }
  
  hasPaidBefore(): boolean {
    return localStorage.getItem(this.HAS_PAID_KEY) === 'true';
  }
}

export function getDeliveryStrategy(): DeliveryStrategy {
  if (DELIVERY_MODE === 'SESSION_LOCK') {
    return new SessionLockDeliveryStrategy();
  }
  return new InstantDeliveryStrategy();
}

export { DELIVERY_MODE };