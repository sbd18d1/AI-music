'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface VintageAudioPlayerProps {
  src: string;
  controlsList?: string;
}

export default function VintageAudioPlayer({ src, controlsList }: VintageAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setTotalDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
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
    setIsMuted(!isMuted);
    audio.muted = !isMuted;
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = totalDuration ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="w-full rounded-2xl overflow-hidden bg-base-200/80 border border-base-300 shadow-vintage">
      <audio ref={audioRef} src={src} preload="auto" controlsList={controlsList} className="hidden" />
      
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
              className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all"
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
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary border-2 border-white shadow-sm pointer-events-none transition-all"
              style={{ left: `calc(${progressPercent}% - 8px)` }}
            />
          </div>
          
          <div className="flex justify-between text-xs mt-2 text-base-content/70">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(totalDuration)}</span>
          </div>
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