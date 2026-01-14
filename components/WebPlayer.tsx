'use client';

import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  analyticsClient,
  generateSessionId,
  SessionMetadata,
} from '@/shared/api/analyticsClient';

interface WebPlayerProps {
  contentId: number;
  videoUrl: string;
  title: string;
  poster?: string;
  autoplay?: boolean;
  onEnded?: () => void;
}

export const WebPlayer: React.FC<WebPlayerProps> = ({
  contentId,
  videoUrl,
  title,
  poster,
  autoplay = false,
  onEnded,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [quality, setQuality] = useState('auto');

  const [sessionId] = useState(generateSessionId());
  const [sessionStarted, setSessionStarted] = useState(false);
  const startTimeRef = useRef<number>(0);

  /* =========================
     HLS Setup
  ========================= */

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      hls.loadSource(videoUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoplay) {
          video.play();
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
          }
        }
      });

      hlsRef.current = hls;

      return () => {
        hls.destroy();
      };
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = videoUrl;
    }
  }, [videoUrl, autoplay]);

  /* =========================
     Start Analytics Session
  ========================= */

  useEffect(() => {
    if (playing && !sessionStarted) {
      setSessionStarted(true);
      startTimeRef.current = Date.now();

      const metadata: SessionMetadata = {
        device_type: 'desktop',
        platform: 'web',
        browser: navigator.userAgent,
        screen_resolution: `${window.screen.width}x${window.screen.height}`,
      };

      analyticsClient.startSession(
        String(contentId),
        sessionId,
        metadata
      );
    }
  }, [playing, sessionStarted, contentId, sessionId]);

  /* =========================
     Heartbeat (every 30s)
  ========================= */

  useEffect(() => {
    if (!playing) return;

    const interval = setInterval(() => {
      analyticsClient.sendHeartbeat(sessionId, Math.floor(currentTime));
    }, 30000);

    return () => clearInterval(interval);
  }, [playing, currentTime, sessionId]);

  /* =========================
     Video Handlers
  ========================= */

  const handlePlay = () => setPlaying(true);

  const handlePause = () => setPlaying(false);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleEnded = () => {
    setPlaying(false);

    const watchTime = Math.floor(
      (Date.now() - startTimeRef.current) / 1000
    );

    analyticsClient.endSession(sessionId, watchTime);

    onEnded?.();
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    playing ? videoRef.current.pause() : videoRef.current.play();
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !muted;
    setMuted(!muted);
  };

  const handleVolumeChange = (newVolume: number) => {
    if (!videoRef.current) return;
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    setMuted(newVolume === 0);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.parentElement?.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /* =========================
     Render
  ========================= */

  return (
    <div className="relative bg-black rounded-lg overflow-hidden group">
      <video
        ref={videoRef}
        className="w-full h-full"
        poster={poster}
        onPlay={handlePlay}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        playsInline
      />

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="mb-4">
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className="w-full h-1 bg-gray-600 rounded-lg"
          />
          <div className="flex justify-between text-xs text-white mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={togglePlay} className="text-white">
              {playing ? '⏸' : '▶️'}
            </button>

            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="text-white">
                {muted || volume === 0 ? '🔇' : '🔊'}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={muted ? 0 : volume}
                onChange={(e) =>
                  handleVolumeChange(Number(e.target.value))
                }
                className="w-20 h-1 bg-gray-600 rounded-lg"
              />
            </div>

            <div className="text-white font-medium">{title}</div>
          </div>

          <div className="flex items-center gap-4">
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              className="bg-gray-700 text-white px-2 py-1 rounded text-sm"
            >
              <option value="auto">Auto</option>
              <option value="1080p">1080p</option>
              <option value="720p">720p</option>
              <option value="480p">480p</option>
            </select>

            <button
              onClick={toggleFullscreen}
              className="text-white"
            >
              {fullscreen ? '🡼' : '🡾'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
