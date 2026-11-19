import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Search, Trash2, Volume2 } from 'lucide-react';
import type { SavedAudioClip } from '../lib/storage';
import { formatDuration } from '../lib/audioUtils';
import { WaveformPlayer } from './WaveformPlayer';

interface LibraryTabProps {
  clips: SavedAudioClip[];
  onDeleteClip: (id: string) => void;
  onLoadInStudio: (clip: SavedAudioClip) => void;
  onGoToStudio: () => void;
}

export const LibraryTab: React.FC<LibraryTabProps> = ({
  clips,
  onDeleteClip,
  onLoadInStudio,
  onGoToStudio,
}) => {
  const [query, setQuery] = useState('');
  const [langFilter, setLangFilter] = useState<'all' | 'hi' | 'en' | 'bilingual'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clips.filter((clip) => {
      if (langFilter !== 'all' && clip.language !== langFilter) return false;
      if (!q) return true;
      return (
        clip.text.toLowerCase().includes(q) ||
        clip.voiceId.toLowerCase().includes(q) ||
        clip.phonemes.toLowerCase().includes(q)
      );
    });
  }, [clips, query, langFilter]);

  const formatTimestamp = (ts: number) => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(ts));
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-[#141413] sm:text-2xl dark:text-[#EDEDEA]">
            Offline Audio Vault
          </h1>
          <p className="mt-0.5 text-xs text-[#66665F] dark:text-[#9A9CA3]">
            {clips.length} saved 24 kHz WAV {clips.length === 1 ? 'recording' : 'recordings'} · Stored locally in IndexedDB for instant offline playback
          </p>
        </div>

        <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:w-64">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A8A82]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search text or voice…"
              className="min-h-[42px] w-full rounded-xl border border-[#DFDFD9] bg-white pl-9 pr-3 text-sm text-[#141413] placeholder:text-[#8A8A82] focus:border-[#D9481E] focus:outline-none dark:border-[#2D313A] dark:bg-[#181A1E] dark:text-[#EDEDEA]"
            />
          </div>

          <div
            role="group"
            aria-label="Filter recordings by language"
            className="inline-flex rounded-xl bg-[#EAEAE4] p-1 dark:bg-[#1E2128]"
          >
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'hi', label: 'Hindi' },
                { id: 'en', label: 'English' },
                { id: 'bilingual', label: 'Bilingual' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setLangFilter(f.id)}
                className={`min-h-[36px] rounded-lg px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  langFilter === f.id
                    ? 'bg-white text-[#141413] shadow-xs dark:bg-[#14161A] dark:text-white'
                    : 'text-[#66665F] hover:text-[#141413] dark:text-[#9A9CA3] dark:hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[#E5E5E0] bg-white px-6 py-14 text-center dark:border-[#252830] dark:bg-[#181A1E]">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1F1ED] text-[#66665F] dark:bg-[#23262D] dark:text-[#9A9CA3]">
            <Volume2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="mt-4 font-display text-base font-semibold text-[#141413] dark:text-[#EDEDEA]">
            {clips.length === 0 ? 'No offline recordings saved yet' : 'No recordings match your filter'}
          </h2>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-[#66665F] dark:text-[#9A9CA3]">
            {clips.length === 0
              ? 'Synthesize English or Hindi speech in the Studio tab. Every 24 kHz WAV output is automatically stored locally for offline playback and export.'
              : 'Try clearing the search term or switching the language filter.'}
          </p>
          {clips.length === 0 && (
            <button
              type="button"
              onClick={onGoToStudio}
              className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#D9481E] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#C03E18]"
            >
              Open Speech Studio
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((clip) => (
            <article
              key={clip.id}
              className="flex flex-col justify-between rounded-2xl border border-[#E5E5E0] bg-white p-5 dark:border-[#252830] dark:bg-[#181A1E]"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-3 text-sm leading-relaxed text-[#141413] dark:text-[#EDEDEA]">
                    {clip.text}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onLoadInStudio(clip)}
                      aria-label="Open script in Studio"
                      title="Open in Studio"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#66665F] transition-colors hover:bg-[#F1F1ED] hover:text-[#141413] dark:text-[#9A9CA3] dark:hover:bg-[#23262D] dark:hover:text-white"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteClip(clip.id)}
                      aria-label="Delete recording"
                      title="Delete recording"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#66665F] transition-colors hover:bg-[#F1F1ED] hover:text-red-600 dark:text-[#9A9CA3] dark:hover:bg-[#23262D] dark:hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <p className="mt-2 font-mono text-[11px] tabular-nums text-[#66665F] dark:text-[#9A9CA3]">
                  {clip.language === 'hi'
                    ? 'Hindi'
                    : clip.language === 'bilingual'
                      ? 'Bilingual'
                      : 'English'}{' '}
                  · {clip.voiceId}
                  {clip.blendVoiceId ? ` + ${clip.blendVoiceId}` : ''} · {clip.speed.toFixed(2)}x ·{' '}
                  {formatDuration(clip.durationSec)} · {formatTimestamp(clip.createdAt)}
                </p>
              </div>

              <div className="mt-4 border-t border-[#F0F0EB] pt-3 dark:border-[#24272F]">
                <WaveformPlayer
                  wavBlob={clip.wavBlob}
                  peaks={clip.peaks}
                  durationSec={clip.durationSec}
                  filename={`vaani-${clip.voiceId}-${clip.id.slice(0, 6)}.wav`}
                  compact
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
