'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Download, Volume2, VolumeX, Music } from 'lucide-react';

interface MusicPlayerProps {
  audioUrl: string;
  title?: string;
  lyrics?: string;
  coverImageUrl?: string;
  duration?: string;
  isPreview?: boolean;
}

export default function MusicPlayer({ audioUrl, title, lyrics, coverImageUrl, duration, isPreview }: MusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [highlightedLineIndex, setHighlightedLineIndex] = useState(-1);

  const lyricLines = lyrics ? lyrics.split('\n').filter(line => line.trim()) : [];

  useEffect(() => {
    console.log('[MusicPlayer] lyrics:', lyrics ? 'has lyrics (' + lyrics.length + ' chars)' : 'none');
    console.log('[MusicPlayer] lyricLines:', lyricLines.length, 'lines');
    console.log('[MusicPlayer] audioUrl:', audioUrl);
    console.log('[MusicPlayer] title:', title);
  }, [lyrics, lyricLines.length, audioUrl, title]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      
      if (lyricLines.length > 0) {
        const avgTimePerLine = (totalDuration || 180) / lyricLines.length;
        const lineIndex = Math.floor(audio.currentTime / avgTimePerLine);
        setHighlightedLineIndex(Math.min(lineIndex, lyricLines.length - 1));
      }
    };

    const handleLoadedMetadata = () => {
      setTotalDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [lyricLines.length, totalDuration]);

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

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    audio.volume = newVolume;
    setIsMuted(newVolume === 0);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/download-audio?url=${encodeURIComponent(audioUrl)}&filename=${encodeURIComponent(title || 'song')}`);
      if (!response.ok) throw new Error('Failed to download');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'song'}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert('Download failed. Please try again later.');
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSkipBack = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime - 10);
  };

  const handleSkipForward = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(totalDuration || 180, audio.currentTime + 10);
  };

  return (
    <div className="space-y-6 w-full">
      {coverImageUrl && (
        <div className="flex justify-center">
          <img
            src={coverImageUrl}
            alt={title || 'Cover'}
            className="w-48 h-48 rounded-2xl object-cover shadow-2xl"
          />
        </div>
      )}

      {title && (
        <h3 className="text-xl font-bold text-white text-center">{title}</h3>
      )}

      <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
        />

        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            onClick={handleSkipBack}
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          <button
            onClick={togglePlay}
            className="p-5 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white transition-all transform hover:scale-110 shadow-lg"
          >
            {isPlaying ? (
              <Pause className="w-8 h-8" />
            ) : (
              <Play className="w-8 h-8" />
            )}
          </button>

          <button
            onClick={handleSkipForward}
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4">
          <input
            type="range"
            min="0"
            max={totalDuration || 180}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-white/60 text-sm mt-2">
            <span>{formatTime(currentTime)}</span>
            <span>{duration || formatTime(totalDuration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={toggleMute}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-24 h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer slider"
          />
        </div>

        <div className="flex justify-center mt-6">
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-medium rounded-xl transition-all transform hover:scale-105"
          >
            <Download className="w-5 h-5" />
            Download {isPreview ? 'Preview' : 'Full Song'}
          </button>
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10 min-h-[200px]">
        <h4 className="text-lg font-semibold text-white mb-4 text-center">🎵 Lyrics</h4>
        {lyricLines.length > 0 ? (
          <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
            {lyricLines.map((line, index) => (
              <p
                key={index}
                className={`text-center transition-all duration-300 ${
                  highlightedLineIndex === index
                    ? 'text-primary-400 text-lg font-semibold scale-105'
                    : 'text-white/60 text-sm'
                }`}
              >
                {line.trim()}
              </p>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Music className="w-12 h-12 text-white/30 mx-auto mb-3" />
            <p className="text-white/50">🎶 This is an instrumental track, no lyrics available</p>
          </div>
        )}
      </div>

      <style>{`
        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(to right, #a855f7, #ec4899);
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(to right, #a855f7, #ec4899);
          cursor: pointer;
          border: none;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}
