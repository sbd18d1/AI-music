import fs from 'fs';
import path from 'path';

const AUDIO_STORAGE_DIR = path.join(process.cwd(), 'public', 'audio');

export function getAudioStorageDir(): string {
  if (!fs.existsSync(AUDIO_STORAGE_DIR)) {
    fs.mkdirSync(AUDIO_STORAGE_DIR, { recursive: true });
  }
  return AUDIO_STORAGE_DIR;
}

export function getLocalAudioPath(orderId: string): string {
  return path.join(getAudioStorageDir(), `${orderId}.mp3`);
}

export function getLocalAudioUrl(orderId: string): string {
  return `/audio/${orderId}.mp3`;
}

export function isLocalAudioAvailable(orderId: string): boolean {
  const filePath = getLocalAudioPath(orderId);
  return fs.existsSync(filePath) && fs.statSync(filePath).size > 0;
}

/**
 * Download remote audio URL and save to local storage.
 * Returns local URL path if successful, null if failed.
 */
export async function downloadAndSaveAudio(remoteUrl: string, orderId: string): Promise<string | null> {
  try {
    console.log(`[audio-storage] Downloading audio for order ${orderId} from: ${remoteUrl}`);
    
    const response = await fetch(remoteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'audio/mpeg, audio/*;q=0.9, */*;q=0.8',
      },
    });

    if (!response.ok) {
      console.error(`[audio-storage] Failed to download: HTTP ${response.status}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 100) {
      console.error(`[audio-storage] Downloaded audio too small (${buffer.length} bytes), URL may be expired`);
      return null;
    }

    const filePath = getLocalAudioPath(orderId);
    fs.writeFileSync(filePath, buffer);
    
    console.log(`[audio-storage] Saved ${buffer.length} bytes to ${filePath}`);
    return getLocalAudioUrl(orderId);
  } catch (error) {
    console.error(`[audio-storage] Download failed:`, error);
    return null;
  }
}
