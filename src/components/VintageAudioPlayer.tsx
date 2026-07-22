'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface VintageAudioPlayerProps {
  src: string;
  controlsList?: string;
  isPreview?: boolean;
}

const WATERMARK_INTERVAL = 12000;
const WATERMARK_VOLUME_REDUCTION = 0.15;
const WATERMARK_PATH = '/audio/watermark.mp3';

export default function VintageAudioPlayer({ src, controlsList, isPreview = false }: VintageAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const watermarkAudioRef = useRef<HTMLAudioElement>(null);
  const watermarkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const originalVolumeRef = useRef(1);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
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
    if (!isNaN(audio.duration) && audio.duration > 0) {
      setTotalDuration(audio.duration);
    }
  }, []);

  const playWatermark = useCallback(() => {
    if (!isPreview) return;
    if (!watermarkLoaded) {
      console.log('Watermark audio not loaded yet');
      return;
    }
    
    const watermarkAudio = watermarkAudioRef.current;
    const mainAudio = audioRef.current;
    
    if (!watermarkAudio || !mainAudio) {
      console.log('Watermark audio refs not ready');
      return;
    }
    
    if (mainAudio.paused) {
      console.log('Main audio is paused');
      return;
    }

    console.log('Playing watermark...');
    
    watermarkAudio.currentTime = 0;
    watermarkAudio.play().then(() => {
      console.log('Watermark play succeeded');
      setIsPlayingWatermark(true);
      
      originalVolumeRef.current = mainAudio.volume;
      mainAudio.volume = originalVolumeRef.current * (1 - WATERMARK_VOLUME_REDUCTION);
      console.log('Main audio volume reduced to:', mainAudio.volume);
    }).catch((error) => {
      console.error('Watermark play failed:', error);
    });
  }, [isPreview, watermarkLoaded]);

  const stopWatermark = useCallback(() => {
    const watermarkAudio = watermarkAudioRef.current;
    const mainAudio = audioRef.current;
    
    if (watermarkAudio) {
      watermarkAudio.pause();
      watermarkAudio.currentTime = 0;
    }
    
    if (mainAudio && originalVolumeRef.current > 0) {
      mainAudio.volume = originalVolumeRef.current;
      console.log('Main audio volume restored to:', mainAudio.volume);
    }
    
    setIsPlayingWatermark(false);
  }, []);

  const startWatermarkTimer = useCallback(() => {
    if (!isPreview) return;
    
    console.log('Starting watermark timer...');
    
    stopWatermark();
    
    if (watermarkTimerRef.current) {
      clearInterval(watermarkTimerRef.current);
    }
    
    const scheduleWatermark = () => {
      if (watermarkLoaded) {
        watermarkTimerRef.current = setInterval(() => {
          console.log('Watermark timer triggered');
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
      console.log('Watermark timer stopped');
    }
    stopWatermark();
    setWatermarkEnabled(false);
  }, [stopWatermark]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => updateProgress();
    const handleLoadedMetadata = () => updateDuration();
    const handleDurationChange = () => updateDuration();
    const handlePlaying = () => {
      setIsPlaying(true);
      if (isPreview) {
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

    if (!isNaN(audio.duration) && audio.duration > 0) {
      setTotalDuration(audio.duration);
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
  }, [updateProgress, updateDuration, isPreview, startWatermarkTimer, stopWatermarkTimer]);

  useEffect(() => {
    const watermarkAudio = watermarkAudioRef.current;
    if (!watermarkAudio) return;

    const handleWatermarkLoaded = () => {
      console.log('Watermark audio loaded');
      setWatermarkLoaded(true);
    };

    const handleWatermarkEnded = () => {
      console.log('Watermark ended, restoring volume');
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
    audio.src = src;
    audio.load();
  }, [src]);

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
      audio.play().catch((error) => {
        console.error('Playback failed:', error);
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
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = totalDuration && totalDuration > 0 
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
        
        <div className="flex-1">
          <div className="flex items-center gap-1 h-8">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <div
                key={i}
                className="w-1 rounded-full bg-primary/60 transition-all"
                style={{
                  height: isPlaying 
                    ? `${20 + Math.sin(Date.now() / 200 + i) * 15}px` 
                    : `${10 + (i % 3) * 5}px`,
                  opacity: isPlaying ? 0.8 + Math.sin(Date.now() / 150 + i) * 0.3 : 0.6,
                }}
              />
            ))}
          </div>
          
          <div className="relative h-2 mt-3 rounded-full overflow-hidden bg-base-300/50">
            <div 
              className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all duration-100"
              style={{ width: `${progressPercent}%` }}
            />
            <input
              type="range"
              min="0"
              max={totalDuration || 180}
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary border-2 border-white shadow-sm pointer-events-none transition-all duration-100"
              style={{ left: `calc(${progressPercent}% - 8px)` }}
            />
          </div>
          
          <div className="flex justify-between text-xs mt-2 text-base-content/70">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(totalDuration)}</span>
          </div>
          
          {isPreview && (
            <div className="text-xs text-warning/80 mt-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
              <span>Preview Mode - Watermark {watermarkEnabled ? 'active' : 'enabled'} {watermarkLoaded ? '(ready)' : '(loading...)'}</span>
            </div>
          )}
        </div>
        
        <button
          onClick={toggleMute}
          className="w-10 h-10 rounded-full bg-base-300/50 hover:bg-base-300 text-base-content flex items-center justify-center transition-all"
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
