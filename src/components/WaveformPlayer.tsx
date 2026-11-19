import React, { useEffect, useRef, useState } from 'react';
import { Download, Pause, Play, RotateCcw } from 'lucide-react';
import { downloadBlob, formatDuration } from '../lib/audioUtils';

interface WaveformPlayerProps {
  wavBlob: Blob | null;
  peaks: number[];
  durationSec: number;
  title?: string;
  subtitle?: string;
  filename?: string;
  autoPlayKey?: string;
  compact?: boolean;
}

export const WaveformPlayer: React.FC<WaveformPlayerProps> = ({
  wavBlob,
  peaks,
  durationSec,
  title,
  subtitle,
  filename = 'vaani-kokoro-tts.wav',
  autoPlayKey,
  compact = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [actualDuration, setActualDuration] = useState(durationSec);

  useEffect(() => {
    setActualDuration(durationSec);
  }, [durationSec]);

  useEffect(() => {
    if (!wavBlob) {
      setObjectUrl(null);
      setIsPlaying(false);
      setCurrentTime(0);
      return;
    }
    const url = URL.createObjectURL(wavBlob);
    setObjectUrl(url);
    setCurrentTime(0);
    setIsPlaying(false);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [wavBlob]);

  useEffect(() => {
    if (!autoPlayKey || !objectUrl || !audioRef.current) return;
    const el = audioRef.current;
    el.currentTime = 0;
    el.play().catch(() => {
      // Browser autoplay policy may block until user interaction
    });
  }, [autoPlayKey, objectUrl]);

  // Draw crisp acoustic bar waveform on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const isDark = document.documentElement.classList.contains('dark');
    const bars = peaks.length ? peaks : Array(64).fill(0.12);
    const gap = 2.5;
    const barWidth = Math.max(2, (w - gap * (bars.length - 1)) / bars.length);
    const progress = actualDuration > 0 ? Math.min(1, currentTime / actualDuration) : 0;
    const playedColor = isDark ? '#F05A2B' : '#D9481E';
    const unplayedColor = isDark ? '#32363F' : '#DCDCD5';
    const emptyColor = isDark ? '#252830' : '#E7E7E2';

    for (let i = 0; i < bars.length; i++) {
      const ratio = i / bars.length;
      const amp = wavBlob ? bars[i] : 0.14 + Math.sin(i * 0.45) * 0.06;
      const barH = Math.max(4, amp * (h * 0.84));
      const x = i * (barWidth + gap);
      const y = (h - barH) / 2;

      ctx.fillStyle = !wavBlob
        ? emptyColor
        : ratio <= progress
          ? playedColor
          : unplayedColor;

      const r = Math.min(barWidth / 2, 2);
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, r);
      ctx.fill();
    }
  }, [peaks, currentTime, actualDuration, wavBlob, isPlaying]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el || !objectUrl) return;
    if (el.paused) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  };

  const restart = () => {
    const el = audioRef.current;
    if (!el || !objectUrl) return;
    el.currentTime = 0;
    setCurrentTime(0);
    el.play().catch(() => {});
  };

  const handleScrub = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const el = audioRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas || !actualDuration) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * actualDuration;
    setCurrentTime(el.currentTime);
  };

  return (
    <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
      {objectUrl && (
        <audio
          ref={audioRef}
          src={objectUrl}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(actualDuration);
          }}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setActualDuration(d);
          }}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        />
      )}

      {(title || subtitle) && (
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <p className="truncate text-sm font-semibold text-[#141413] dark:text-[#EDEDEA]">
                {title}
              </p>
            )}
            {subtitle && (
              <p className="truncate text-xs text-[#66665F] dark:text-[#9A9CA3]">{subtitle}</p>
            )}
          </div>
          <span className="font-mono text-xs tabular-nums text-[#66665F] dark:text-[#9A9CA3] shrink-0">
            {formatDuration(currentTime)} / {formatDuration(actualDuration)}
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!wavBlob}
          aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D9481E] text-white transition-transform hover:bg-[#C03E18] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9481E]"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-0.5" />}
        </button>

        <div className="relative flex-1">
          <canvas
            ref={canvasRef}
            onClick={handleScrub}
            aria-label="Interactive audio waveform scrubber"
            className={`block w-full cursor-pointer ${compact ? 'h-10' : 'h-14'}`}
          />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!compact && (
            <button
              type="button"
              onClick={restart}
              disabled={!wavBlob}
              aria-label="Replay from start"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#E5E5E0] text-[#474742] transition-colors hover:bg-[#F1F1ED] hover:text-[#141413] disabled:opacity-40 dark:border-[#2C2F36] dark:text-[#B4B6BC] dark:hover:bg-[#23262C] dark:hover:text-white"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => wavBlob && downloadBlob(wavBlob, filename)}
            disabled={!wavBlob}
            aria-label="Download 24 kHz WAV"
            className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-[#E5E5E0] px-3 text-xs font-medium text-[#141413] transition-colors hover:bg-[#F1F1ED] disabled:opacity-40 dark:border-[#2C2F36] dark:text-[#EDEDEA] dark:hover:bg-[#23262C] whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {!compact && <span>WAV</span>}
          </button>
        </div>
      </div>
    </div>
  );
};
