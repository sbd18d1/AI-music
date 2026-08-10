'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface VintageAudioPlayerProps {
  src: string;
  controlsList?: string;
  isPreview?: boolean;
  /** Pre-known duration in seconds (from API), used when browser can't determine it from stream */
  duration?: number | string;
}

const WATERMARK_INTERVAL = 12000;
const WATERMARK_VOLUME_REDUCTION = 0.15;
const WATERMARK_PATH = '/audio/watermark.mp3';

export default function VintageAudioPlayer({ src, controlsList, isPreview = false, duration }: VintageAudioPlayerProps) {
  // Parse the prop duration to a finite number (seconds), or 0 if invalid
  const propDuration = (() => {
    if (duration === undefined || duration === null || duration === '') return 0;
    const n = typeof duration === 'string' ? parseFloat(duration) : duration;
    return typeof n === 'number' && isFinite(n) && n > 0 ? n : 0;
  })();
  const audioRef = useRef<HTMLAudioElement>(null);
  const watermarkAudioRef = useRef<HTMLAudioElement>(null);
  const watermarkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const originalVolumeRef = useRef(1);
  const watermarkUnlockedRef = useRef(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  // Initialize totalDuration from prop directly (do NOT wait for useEffect)
  const [totalDuration, setTotalDuration] = useState<number>(propDuration);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlayingWatermark, setIsPlayingWatermark] = useState(false);
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [watermarkLoaded, setWatermarkLoaded] = useState(false);

  const updateProgress = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
  }, []);

  const updateDuration = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isFinite(audio.duration) && audio.duration > 0) {
      setTotalDuration(audio.duration);
    } else if (propDuration > 0) {
      // Browser returned Infinity (streaming without Content-Length),
      // use the duration from API response
      setTotalDuration(propDuration);
    }
  }, [propDuration]);

  // Unlock watermark audio on mobile (must be triggered by user interaction)
  const unlockWatermarkAudio = useCallback(() => {
    if (watermarkUnlockedRef.current) return;
    const watermarkAudio = watermarkAudioRef.current;
    if (!watermarkAudio) return;

    // Force load on iOS Safari (won't load until user interaction)
    watermarkAudio.load();

    // Play silently to unlock audio on mobile browsers
    watermarkAudio.volume = 0;
    watermarkAudio.play().then(() => {
      watermarkAudio.pause();
      watermarkAudio.currentTime = 0;
      watermarkAudio.volume = 1;
      watermarkUnlockedRef.current = true;
      // Mark as loaded — on iOS, canplaythrough may never fire without user gesture
      setWatermarkLoaded(true);
      console.log('[Watermark] Audio unlocked + loaded for mobile playback');
    }).catch((e) => {
      console.warn('[Watermark] Unlock failed:', e);
      // Still mark as unlocked + loaded so timer starts; play() will retry
      watermarkUnlockedRef.current = true;
      setWatermarkLoaded(true);
    });
  }, []);

  const playWatermark = useCallback(() => {
    if (!isPreview) return;
    if (!watermarkLoaded) {
      console.log('[Watermark] Audio not loaded yet');
      return;
    }
    
    const watermarkAudio = watermarkAudioRef.current;
    const mainAudio = audioRef.current;
    
    if (!watermarkAudio || !mainAudio) {
      console.log('[Watermark] Refs not ready');
      return;
    }
    
    if (mainAudio.paused) {
      return;
    }

    console.log('[Watermark] Playing...');
    
    watermarkAudio.currentTime = 0;
    watermarkAudio.volume = 1;
    watermarkAudio.play().then(() => {
      console.log('[Watermark] Play succeeded');
      setIsPlayingWatermark(true);
      
      originalVolumeRef.current = mainAudio.volume;
      mainAudio.volume = originalVolumeRef.current * (1 - WATERMARK_VOLUME_REDUCTION);
    }).catch((error) => {
      console.error('[Watermark] Play failed:', error);
      // Re-attempt unlock
      watermarkUnlockedRef.current = false;
      unlockWatermarkAudio();
    });
  }, [isPreview, watermarkLoaded, unlockWatermarkAudio]);

  const stopWatermark = useCallback(() => {
    const watermarkAudio = watermarkAudioRef.current;
    const mainAudio = audioRef.current;
    
    if (watermarkAudio) {
      watermarkAudio.pause();
      watermarkAudio.currentTime = 0;
    }
    
    if (mainAudio && originalVolumeRef.current > 0) {
      mainAudio.volume = originalVolumeRef.current;
    }
    
    setIsPlayingWatermark(false);
  }, []);

  const startWatermarkTimer = useCallback(() => {
    if (!isPreview) return;
    
    console.log('[Watermark] Starting timer...');
    
    stopWatermark();
    
    if (watermarkTimerRef.current) {
      clearInterval(watermarkTimerRef.current);
    }
    
    const scheduleWatermark = () => {
      if (watermarkLoaded) {
        watermarkTimerRef.current = setInterval(() => {
          playWatermark();
        }, WATERMARK_INTERVAL);
      } else {
        setTimeout(scheduleWatermark, 500);
      }
    };
    
    scheduleWatermark();
    setWatermarkEnabled(true);
  }, [isPreview, playWatermark, stopWatermark, watermarkLoaded]);

  const stopWatermarkTimer = useCallback(() => {
    if (watermarkTimerRef.current) {
      clearInterval(watermarkTimerRef.current);
      watermarkTimerRef.current = null;
    }
    stopWatermark();
    setWatermarkEnabled(false);
  }, [stopWatermark]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => updateProgress();
    const handleLoadedMetadata = () => {
      updateDuration();
    };
    const handleDurationChange = () => updateDuration();
    const handlePlaying = () => {
      setIsPlaying(true);
      // Unlock watermark audio on user-initiated play (required for mobile)
      if (isPreview) {
        unlockWatermarkAudio();
        startWatermarkTimer();
      }
    };
    const handlePause = () => {
      setIsPlaying(false);
      stopWatermarkTimer();
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      stopWatermarkTimer();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    if (isFinite(audio.duration) && audio.duration > 0) {
      setTotalDuration(audio.duration);
    } else if (propDuration > 0) {
      setTotalDuration(propDuration);
    }

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      stopWatermarkTimer();
    };
  }, [updateProgress, updateDuration, isPreview, propDuration, startWatermarkTimer, stopWatermarkTimer, unlockWatermarkAudio]);

  useEffect(() => {
    const watermarkAudio = watermarkAudioRef.current;
    if (!watermarkAudio) return;

    const handleWatermarkLoaded = () => {
      console.log('[Watermark] Audio loaded');
      setWatermarkLoaded(true);
    };

    const handleWatermarkEnded = () => {
      stopWatermark();
    };

    watermarkAudio.addEventListener('canplaythrough', handleWatermarkLoaded);
    watermarkAudio.addEventListener('ended', handleWatermarkEnded);

    return () => {
      watermarkAudio.removeEventListener('canplaythrough', handleWatermarkLoaded);
      watermarkAudio.removeEventListener('ended', handleWatermarkEnded);
    };
  }, [stopWatermark]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!src) {
      console.warn('[AudioPlayer] No src provided, skipping load');
      return;
    }
    console.log('[AudioPlayer] Setting src:', src);
    audio.src = src;
    audio.load();
  }, [src]);

  // Initialize totalDuration from prop immediately (before audio metadata loads)
  useEffect(() => {
    if (propDuration > 0) {
      setTotalDuration(propDuration);
    }
  }, [propDuration]);

  useEffect(() => {
    return () => {
      stopWatermarkTimer();
    };
  }, [stopWatermarkTimer]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      if (!audio.src || audio.src === window.location.href) {
        console.error('[AudioPlayer] No valid audio src. audioUrl prop:', src);
        alert('Audio source is missing. Please generate a new song.');
        return;
      }
      console.log('[AudioPlayer] Attempting play. src:', audio.src, 'readyState:', audio.readyState);
      
      // Unlock watermark audio on this user click (mobile requires user gesture)
      if (isPreview) {
        unlockWatermarkAudio();
      }
      
      audio.play().catch((error) => {
        console.error('[AudioPlayer] Playback failed:', error.name, error.message, 'src:', audio.src, 'readyState:', audio.readyState, 'error:', audio.error);
        setIsPlaying(false);
        if (error.name === 'NotSupportedError') {
          alert('Audio playback failed (source: ' + audio.src + '). The audio file may be unavailable. Please try generating a new song.');
        } else if (error.name === 'NotAllowedError') {
          alert('Playback blocked by browser. Please click the play button again to allow audio.');
        } else {
          alert('Playback error: ' + error.message);
        }
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    audio.muted = newMuted;
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = totalDuration && isFinite(totalDuration) && totalDuration > 0
    ? Math.min((currentTime / totalDuration) * 100, 100)
    : 0;

  return (
    <div className="w-full rounded-2xl overflow-hidden bg-base-200/80 border border-base-300 shadow-vintage">
      <audio ref={audioRef} preload="auto" controlsList={controlsList} className="hidden" />
      {isPreview && (
        <audio ref={watermarkAudioRef} src={WATERMARK_PATH} preload="auto" className="hidden" />
      )}
      
      <div className="flex items-center gap-4 p-4">
        <button
          onClick={togglePlay}
          className="relative w-16 h-16 rounded-full bg-primary text-white shadow-md flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-7 h-7" />
          ) : (
            <Play className="w-7 h-7 ml-1" />
          )}
          
          {isPlaying && (
            <div className="absolute inset-0 rounded-full border-4 border-secondary/30 animate-ping" />
          )}
        </button>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-mono text-base-content/70">
              {formatTime(currentTime)} / {formatTime(totalDuration)}
            </span>
            <div className="flex items-center gap-2">
              {isPreview && watermarkEnabled && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/20 text-base-content/60 flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${isPlayingWatermark ? 'bg-secondary animate-pulse' : 'bg-base-content/30'}`} />
                  Preview
                </span>
              )}
              <button
                onClick={toggleMute}
                className="text-base-content/60 hover:text-base-content transition-colors"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          <input
            type="range"
            min="0"
            max={totalDuration || 0}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 rounded-full appearance-none cursor-pointer bg-base-300"
            style={{
              background: `linear-gradient(to right, hsl(var(--p)) ${progressPercent}%, hsl(var(--b3)) ${progressPercent}%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
