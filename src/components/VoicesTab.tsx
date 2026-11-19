import React, { useMemo, useState } from 'react';
import {
  Check,
  Download,
  HardDrive,
  Loader2,
  Play,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import {
  KOKORO_VOICES,
  MODEL_PRESETS,
  type KokoroVoice,
  type ModelDtype,
} from '../lib/voices';
import { formatBytes } from '../lib/audioUtils';
import type { LexiconEntry } from '../lib/hindiG2P';
import type { OfflineStorageReport } from '../lib/storage';

interface VoicesTabProps {
  modelStatus: 'idle' | 'loading' | 'ready' | 'error';
  modelDtype: ModelDtype;
  onModelDtypeChange: (dtype: ModelDtype) => void;
  modelDevice: 'webgpu' | 'wasm';
  onModelDeviceChange: (device: 'webgpu' | 'wasm') => void;
  webGpuAvailable: boolean;
  onLoadModel: () => void;
  storageReport: OfflineStorageReport;
  onPrefetchRecommendedVoices: () => void;
  isPrefetchingVoices: boolean;
  onClearCache: () => void;
  hindiVoice: string;
  englishVoice: string;
  onSelectVoice: (voice: KokoroVoice) => void;
  onAuditionVoice: (voice: KokoroVoice) => void;
  auditioningVoiceId: string | null;
  favoriteVoiceIds: string[];
  onToggleFavorite: (voiceId: string) => void;
  lexicon: LexiconEntry[];
  onAddLexicon: (entry: Omit<LexiconEntry, 'id' | 'updatedAt'>) => void;
  onDeleteLexicon: (id: string) => void;
}

export const VoicesTab: React.FC<VoicesTabProps> = ({
  modelStatus,
  modelDtype,
  onModelDtypeChange,
  modelDevice,
  onModelDeviceChange,
  webGpuAvailable,
  onLoadModel,
  storageReport,
  onPrefetchRecommendedVoices,
  isPrefetchingVoices,
  onClearCache,
  hindiVoice,
  englishVoice,
  onSelectVoice,
  onAuditionVoice,
  auditioningVoiceId,
  favoriteVoiceIds,
  onToggleFavorite,
  lexicon,
  onAddLexicon,
  onDeleteLexicon,
}) => {
  const [filter, setFilter] = useState<'all' | 'hi' | 'en-us' | 'en-gb'>('all');
  const [newWord, setNewWord] = useState('');
  const [newReplacement, setNewReplacement] = useState('');
  const [newLang, setNewLang] = useState<'both' | 'hi' | 'en'>('both');

  const filteredVoices = useMemo(() => {
    const list =
      filter === 'all' ? [...KOKORO_VOICES] : KOKORO_VOICES.filter((v) => v.language === filter);
    return list.sort((a, b) => {
      const aFav = favoriteVoiceIds.includes(a.id) ? 1 : 0;
      const bFav = favoriteVoiceIds.includes(b.id) ? 1 : 0;
      return bFav - aFav;
    });
  }, [filter, favoriteVoiceIds]);

  const handleLexiconSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim() || !newReplacement.trim()) return;
    onAddLexicon({
      word: newWord.trim(),
      replacement: newReplacement.trim(),
      lang: newLang,
      isIpa: false,
    });
    setNewWord('');
    setNewReplacement('');
  };

  return (
    <div className="space-y-8">
      {/* Offline Model & Cache Control Panel */}
      <section className="rounded-2xl border border-[#E5E5E0] bg-white p-5 sm:p-6 dark:border-[#252830] dark:bg-[#181A1E]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-xl font-semibold text-[#141413] sm:text-2xl dark:text-[#EDEDEA]">
              Offline Model &amp; Voice Packs
            </h1>
            <p className="mt-1 text-sm text-[#66665F] dark:text-[#9A9CA3]">
              Weights are fetched from <span className="font-mono text-xs">onnx-community/Kokoro-82M-v1.0-ONNX</span> and stored permanently on this device for airplane-mode use.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-[#474742] dark:text-[#B8BAC0]">
            <HardDrive className="h-4 w-4 text-[#D9481E] dark:text-[#F05A2B]" aria-hidden="true" />
            <span>
              {formatBytes(storageReport.usageBytes)} used · {storageReport.cachedVoiceIds.length} voices cached
            </span>
          </div>
        </div>

        {/* Quantization Presets */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MODEL_PRESETS.map((preset) => {
            const active = modelDtype === preset.dtype;
            return (
              <button
                key={preset.dtype}
                type="button"
                onClick={() => onModelDtypeChange(preset.dtype)}
                className={`flex flex-col items-start rounded-xl border p-4 text-left transition-colors ${
                  active
                    ? 'border-[#D9481E] bg-[#FDF6F3] dark:border-[#F05A2B] dark:bg-[#231916]'
                    : 'border-[#E5E5E0] bg-[#FAF9F7] hover:border-[#CFCFC8] dark:border-[#2A2D35] dark:bg-[#131519] dark:hover:border-[#3A3E48]'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#141413] dark:text-[#EDEDEA]">
                    {preset.label}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-[#66665F] dark:text-[#9A9CA3]">
                    {preset.approxSize}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-[#D9481E] dark:text-[#F05A2B]">
                  {preset.recommendedFor}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-[#66665F] dark:text-[#9A9CA3]">
                  {preset.notes}
                </p>
              </button>
            );
          })}
        </div>

        {/* Runtime Accelerator & Offline Actions */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[#ECECE7] pt-5 dark:border-[#252830]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-[#3F3F3B] dark:text-[#C5C7CD]">
              Execution Backend
            </span>
            <div className="inline-flex rounded-xl bg-[#F1F1ED] p-1 dark:bg-[#23262D]">
              <button
                type="button"
                onClick={() => onModelDeviceChange('wasm')}
                className={`min-h-[36px] rounded-lg px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  modelDevice === 'wasm'
                    ? 'bg-white text-[#141413] shadow-xs dark:bg-[#14161A] dark:text-white'
                    : 'text-[#66665F] dark:text-[#9A9CA3]'
                }`}
              >
                WASM CPU (Universal)
              </button>
              <button
                type="button"
                disabled={!webGpuAvailable}
                onClick={() => onModelDeviceChange('webgpu')}
                className={`min-h-[36px] rounded-lg px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-40 whitespace-nowrap shrink-0 ${
                  modelDevice === 'webgpu'
                    ? 'bg-white text-[#141413] shadow-xs dark:bg-[#14161A] dark:text-white'
                    : 'text-[#66665F] dark:text-[#9A9CA3]'
                }`}
              >
                WebGPU {webGpuAvailable ? '(Detected)' : '(Unavailable)'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onLoadModel}
              disabled={modelStatus === 'loading'}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#D9481E] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#C03E18] disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {modelStatus === 'loading' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              {modelStatus === 'ready' ? 'Reload Selected Precision' : 'Download & Cache Model'}
            </button>

            <button
              type="button"
              onClick={onPrefetchRecommendedVoices}
              disabled={isPrefetchingVoices}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#DFDFD9] px-4 py-2 text-xs font-semibold text-[#141413] transition-colors hover:bg-[#F1F1ED] disabled:opacity-50 dark:border-[#2D313A] dark:text-[#EDEDEA] dark:hover:bg-[#23262D] whitespace-nowrap shrink-0"
            >
              {isPrefetchingVoices ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Cache All Hindi + Top EN Voices
            </button>

            <button
              type="button"
              onClick={onClearCache}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#DFDFD9] px-3.5 py-2 text-xs font-medium text-[#66665F] transition-colors hover:border-red-300 hover:text-red-700 dark:border-[#2D313A] dark:text-[#9A9CA3] dark:hover:border-red-800 dark:hover:text-red-300 whitespace-nowrap shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Clear Cache
            </button>
          </div>
        </div>
      </section>

      {/* Voice Directory */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#141413] dark:text-[#EDEDEA]">
              Kokoro-82M Voice Directory
            </h2>
            <p className="text-xs text-[#66665F] dark:text-[#9A9CA3]">
              Each voice pack is a 510 KB Float32 style embedding cached offline after first use.
            </p>
          </div>

          <div
            role="group"
            aria-label="Filter voices by language"
            className="inline-flex rounded-xl bg-[#EAEAE4] p-1 dark:bg-[#1E2128]"
          >
            {(
              [
                { id: 'all', label: `All (${KOKORO_VOICES.length})` },
                { id: 'hi', label: 'Hindi (4)' },
                { id: 'en-us', label: 'English US' },
                { id: 'en-gb', label: 'English UK' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  filter === tab.id
                    ? 'bg-white text-[#141413] shadow-xs dark:bg-[#14161A] dark:text-white'
                    : 'text-[#66665F] hover:text-[#141413] dark:text-[#9A9CA3] dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVoices.map((voice) => {
            const isSelected = voice.id === hindiVoice || voice.id === englishVoice;
            const isCached = storageReport.cachedVoiceIds.includes(voice.id);
            const isFav = favoriteVoiceIds.includes(voice.id);
            const isAuditioning = auditioningVoiceId === voice.id;

            return (
              <article
                key={voice.id}
                className={`flex flex-col justify-between rounded-2xl border p-4 transition-colors ${
                  isSelected
                    ? 'border-[#D9481E] bg-white dark:border-[#F05A2B] dark:bg-[#1A1C20]'
                    : 'border-[#E5E5E0] bg-white hover:border-[#CFCFC8] dark:border-[#252830] dark:bg-[#181A1E] dark:hover:border-[#343843]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base font-semibold text-[#141413] dark:text-[#EDEDEA]">
                        {voice.name}
                        {voice.nativeLabel && (
                          <span className="ml-1.5 font-sans text-sm font-medium text-[#66665F] dark:text-[#9A9CA3]">
                            {voice.nativeLabel}
                          </span>
                        )}
                      </h3>
                      <p className="mt-0.5 font-mono text-[11px] text-[#66665F] dark:text-[#9A9CA3]">
                        {voice.id} · {voice.languageLabel} · {voice.gender} · Grade {voice.grade}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleFavorite(voice.id)}
                      aria-label={isFav ? `Remove ${voice.name} from favorites` : `Favorite ${voice.name}`}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#8A8A82] transition-colors hover:bg-[#F1F1ED] hover:text-[#D9481E] dark:hover:bg-[#23262D]"
                    >
                      <Star
                        className={`h-4 w-4 ${isFav ? 'fill-[#D9481E] text-[#D9481E]' : ''}`}
                      />
                    </button>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed text-[#52524D] dark:text-[#A8AAB1]">
                    {voice.styleNotes}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#F0F0EB] pt-3 dark:border-[#24272F]">
                  <span className="text-[11px] font-medium text-[#66665F] dark:text-[#9A9CA3]">
                    {isCached ? 'Cached offline' : 'On-demand (510 KB)'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onAuditionVoice(voice)}
                      disabled={isAuditioning}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#E5E5E0] px-2.5 text-xs font-medium text-[#141413] transition-colors hover:bg-[#F1F1ED] disabled:opacity-50 dark:border-[#2D313A] dark:text-[#EDEDEA] dark:hover:bg-[#23262D] whitespace-nowrap shrink-0"
                    >
                      {isAuditioning ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Play className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      Test
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectVoice(voice)}
                      className={`inline-flex min-h-[38px] items-center gap-1 rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        isSelected
                          ? 'bg-[#D9481E] text-white dark:bg-[#F05A2B]'
                          : 'bg-[#141413] text-white hover:bg-[#2A2A28] dark:bg-[#EDEDEA] dark:text-[#141413] dark:hover:bg-white'
                      }`}
                    >
                      {isSelected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                      {isSelected ? 'Active' : 'Use'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Offline Pronunciation Lexicon */}
      <section className="rounded-2xl border border-[#E5E5E0] bg-white p-5 sm:p-6 dark:border-[#252830] dark:bg-[#181A1E]">
        <h2 className="font-display text-lg font-semibold text-[#141413] dark:text-[#EDEDEA]">
          Offline Pronunciation Lexicon
        </h2>
        <p className="mt-0.5 text-xs text-[#66665F] dark:text-[#9A9CA3]">
          Override acronyms, names, or Hinglish spellings before Kokoro phonemization. Stored locally in IndexedDB.
        </p>

        <form onSubmit={handleLexiconSubmit} className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-12">
          <input
            type="text"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            placeholder="Word or acronym (e.g. UPI, Kokoro)"
            className="min-h-[44px] rounded-xl border border-[#DFDFD9] bg-[#FAF9F7] px-3 text-sm text-[#141413] focus:border-[#D9481E] focus:outline-none sm:col-span-4 dark:border-[#2D313A] dark:bg-[#121417] dark:text-[#EDEDEA]"
          />
          <input
            type="text"
            value={newReplacement}
            onChange={(e) => setNewReplacement(e.target.value)}
            placeholder="Spoken respelling (e.g. यू पी आई, ko-ko-ro)"
            className="min-h-[44px] rounded-xl border border-[#DFDFD9] bg-[#FAF9F7] px-3 text-sm text-[#141413] focus:border-[#D9481E] focus:outline-none sm:col-span-4 dark:border-[#2D313A] dark:bg-[#121417] dark:text-[#EDEDEA]"
          />
          <select
            aria-label="Lexicon language scope"
            value={newLang}
            onChange={(e) => setNewLang(e.target.value as 'both' | 'hi' | 'en')}
            className="min-h-[44px] rounded-xl border border-[#DFDFD9] bg-[#FAF9F7] px-3 text-xs font-medium text-[#141413] sm:col-span-2 dark:border-[#2D313A] dark:bg-[#121417] dark:text-[#EDEDEA]"
          >
            <option value="both">Both EN &amp; HI</option>
            <option value="hi">Hindi only</option>
            <option value="en">English only</option>
          </select>
          <button
            type="submit"
            disabled={!newWord.trim() || !newReplacement.trim()}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#141413] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#2A2A28] disabled:opacity-40 sm:col-span-2 dark:bg-[#EDEDEA] dark:text-[#141413] dark:hover:bg-white whitespace-nowrap"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Rule
          </button>
        </form>

        {lexicon.length > 0 && (
          <ul className="mt-4 divide-y divide-[#ECECE7] rounded-xl border border-[#ECECE7] dark:divide-[#252830] dark:border-[#252830]">
            {lexicon.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-[#141413] dark:text-[#EDEDEA]">
                    {entry.word}
                  </span>
                  <span className="mx-2 text-[#8A8A82]">→</span>
                  <span className="text-[#474742] dark:text-[#C5C7CD]">{entry.replacement}</span>
                  <span className="ml-2 font-mono text-[11px] text-[#8A8A82]">
                    · {entry.lang.toUpperCase()}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteLexicon(entry.id)}
                  aria-label={`Delete pronunciation rule for ${entry.word}`}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#8A8A82] transition-colors hover:bg-[#F1F1ED] hover:text-red-600 dark:hover:bg-[#23262D]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
