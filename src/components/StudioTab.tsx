import React, { useMemo, useState } from 'react';
import {
  AudioLines,
  ChevronDown,
  ChevronUp,
  Cpu,
  Download,
  Loader2,
  Play,
  SlidersHorizontal,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import {
  DEVANAGARI_QUICK_CHIPS,
  KOKORO_VOICES,
  SAMPLE_SCRIPTS,
  getVoiceById,
  type ModelDtype,
} from '../lib/voices';
import {
  containsDevanagari,
  hindiToKokoroIPA,
  segmentTextForSynthesis,
  type LexiconEntry,
} from '../lib/hindiG2P';
import { formatBytes, formatDuration } from '../lib/audioUtils';
import type { ModelLoadProgress, SynthProgress } from '../lib/kokoroClient';
import type { HindiG2PMode } from '../workers/kokoro.worker';
import { WaveformPlayer } from './WaveformPlayer';

export interface ActiveAudioOutput {
  id: string;
  wavBlob: Blob;
  peaks: number[];
  durationSec: number;
  phonemes: string;
  voiceLabel: string;
  language: 'en' | 'hi' | 'bilingual';
  elapsedMs: number;
  segmentCount: number;
}

interface StudioTabProps {
  text: string;
  onTextChange: (val: string) => void;
  languageMode: 'auto' | 'en' | 'hi';
  onLanguageModeChange: (mode: 'auto' | 'en' | 'hi') => void;
  hindiVoice: string;
  onHindiVoiceChange: (voiceId: string) => void;
  englishVoice: string;
  onEnglishVoiceChange: (voiceId: string) => void;
  blendEnabled: boolean;
  onBlendEnabledChange: (enabled: boolean) => void;
  blendVoiceId: string;
  onBlendVoiceIdChange: (voiceId: string) => void;
  blendRatio: number;
  onBlendRatioChange: (ratio: number) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  pauseMs: number;
  onPauseMsChange: (ms: number) => void;
  hindiG2P: HindiG2PMode;
  onHindiG2PChange: (mode: HindiG2PMode) => void;
  autoSaveLibrary: boolean;
  onAutoSaveLibraryChange: (v: boolean) => void;
  modelStatus: 'idle' | 'loading' | 'ready' | 'error';
  modelDtype: ModelDtype;
  modelDevice: 'webgpu' | 'wasm';
  loadProgress: ModelLoadProgress | null;
  modelError: string | null;
  onLoadModel: () => void;
  isSynthesizing: boolean;
  synthProgress: SynthProgress | null;
  synthError: string | null;
  onSynthesize: () => void;
  onQuickDeviceSpeak: () => void;
  isDeviceSpeaking: boolean;
  onStopDeviceSpeak: () => void;
  activeOutput: ActiveAudioOutput | null;
  lexicon: LexiconEntry[];
}

export const StudioTab: React.FC<StudioTabProps> = ({
  text,
  onTextChange,
  languageMode,
  onLanguageModeChange,
  hindiVoice,
  onHindiVoiceChange,
  englishVoice,
  onEnglishVoiceChange,
  blendEnabled,
  onBlendEnabledChange,
  blendVoiceId,
  onBlendVoiceIdChange,
  blendRatio,
  onBlendRatioChange,
  speed,
  onSpeedChange,
  pauseMs,
  onPauseMsChange,
  hindiG2P,
  onHindiG2PChange,
  autoSaveLibrary,
  onAutoSaveLibraryChange,
  modelStatus,
  modelDtype,
  modelDevice,
  loadProgress,
  modelError,
  onLoadModel,
  isSynthesizing,
  synthProgress,
  synthError,
  onSynthesize,
  onQuickDeviceSpeak,
  isDeviceSpeaking,
  onStopDeviceSpeak,
  activeOutput,
}) => {
  const [showInspector, setShowInspector] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hindiVoices = useMemo(() => KOKORO_VOICES.filter((v) => v.language === 'hi'), []);
  const englishVoices = useMemo(() => KOKORO_VOICES.filter((v) => v.language !== 'hi'), []);

  const segments = useMemo(
    () => segmentTextForSynthesis(text, languageMode, englishVoice, hindiVoice),
    [text, languageMode, englishVoice, hindiVoice]
  );

  const liveHindiIpaPreview = useMemo(() => {
    const hiSegs = segments.filter((s) => s.lang === 'hi');
    if (hiSegs.length === 0) return '';
    return hiSegs.map((s) => hindiToKokoroIPA(s.text)).join(' · ');
  }, [segments]);

  const wordCount = useMemo(() => {
    const trimmed = text.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [text]);

  const estimatedReadSec = Math.max(1, Math.round((wordCount / 2.6) / speed));

  const applySample = (sample: (typeof SAMPLE_SCRIPTS)[number]) => {
    onTextChange(sample.text);
    if (sample.language === 'hi') {
      onLanguageModeChange('hi');
      onHindiVoiceChange(sample.recommendedVoice);
    } else if (sample.language === 'en') {
      onLanguageModeChange('en');
      onEnglishVoiceChange(sample.recommendedVoice);
    } else {
      onLanguageModeChange('auto');
      if (sample.recommendedVoice.startsWith('h')) {
        onHindiVoiceChange(sample.recommendedVoice);
      } else {
        onEnglishVoiceChange(sample.recommendedVoice);
      }
      if (sample.secondaryHindiVoice) {
        onHindiVoiceChange(sample.secondaryHindiVoice);
      }
    }
  };

  const activeHiVoiceObj = getVoiceById(hindiVoice);
  const activeEnVoiceObj = getVoiceById(englishVoice);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
      {/* Left Column: Bilingual Script Composer + Phoneme Inspector */}
      <section className="space-y-4 lg:col-span-7">
        <div className="rounded-2xl border border-[#E5E5E0] bg-white p-5 sm:p-6 dark:border-[#252830] dark:bg-[#181A1E]">
          {/* Mode Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight text-[#141413] sm:text-2xl dark:text-[#EDEDEA]">
                Offline Speech Studio
              </h1>
              <p className="mt-0.5 text-xs text-[#66665F] dark:text-[#9A9CA3]">
                English &amp; Hindi Devanagari · 24 kHz Kokoro-82M ONNX · Multi-speaker script ready
              </p>
            </div>

            <div
              role="group"
              aria-label="Synthesis language mode"
              className="inline-flex rounded-xl bg-[#F1F1ED] p-1 dark:bg-[#23262D]"
            >
              {(
                [
                  { id: 'auto', label: 'Auto Mix' },
                  { id: 'hi', label: 'हिन्दी' },
                  { id: 'en', label: 'English' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onLanguageModeChange(item.id)}
                  className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    languageMode === item.id
                      ? 'bg-white text-[#141413] shadow-xs dark:bg-[#14161A] dark:text-white'
                      : 'text-[#66665F] hover:text-[#141413] dark:text-[#9A9CA3] dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sample Script Presets */}
          <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1">
            {SAMPLE_SCRIPTS.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => applySample(sample)}
                className="inline-flex min-h-[36px] items-center rounded-lg border border-[#E5E5E0] bg-[#FAF9F7] px-3 py-1.5 text-xs font-medium text-[#3F3F3B] transition-colors hover:border-[#D9481E]/50 hover:text-[#141413] dark:border-[#2B2E36] dark:bg-[#202228] dark:text-[#C5C7CD] dark:hover:border-[#F05A2B]/60 dark:hover:text-white whitespace-nowrap shrink-0"
              >
                {sample.label}
              </button>
            ))}
          </div>

          {/* Main Textarea */}
          <div className="mt-4">
            <label htmlFor="tts-script-input" className="sr-only">
              Enter English or Hindi text to synthesize
            </label>
            <textarea
              id="tts-script-input"
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              rows={7}
              placeholder="Type English, Hindi (हिन्दी देवनागरी), or both. Use [hf_alpha]: and [af_heart]: on new lines for multi-speaker dialogue…"
              className="w-full resize-y rounded-xl border border-[#DFDFD9] bg-[#FAF9F7] p-4 text-base leading-relaxed text-[#141413] placeholder:text-[#8A8A82] focus:border-[#D9481E] focus:bg-white focus:outline-none dark:border-[#2D313A] dark:bg-[#121417] dark:text-[#F2F2EE] dark:placeholder:text-[#6B6E76] dark:focus:border-[#F05A2B] dark:focus:bg-[#15171B]"
            />
          </div>

          {/* Devanagari Quick Insert + Stats Row */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {DEVANAGARI_QUICK_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => onTextChange(text + (text && !text.endsWith(' ') ? ' ' : '') + chip.text)}
                  className="inline-flex min-h-[34px] items-center rounded-lg bg-[#F1F1ED] px-2.5 py-1 text-xs font-medium text-[#474742] transition-colors hover:bg-[#E7E7E1] hover:text-[#141413] dark:bg-[#23262D] dark:text-[#B8BAC0] dark:hover:bg-[#2C3039] dark:hover:text-white whitespace-nowrap shrink-0"
                >
                  + {chip.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 text-xs text-[#66665F] dark:text-[#9A9CA3]">
              <span className="font-mono tabular-nums">
                {wordCount} words · {segments.length} {segments.length === 1 ? 'chunk' : 'chunks'} · ~
                {formatDuration(estimatedReadSec)}
              </span>
              {text.length > 0 && (
                <button
                  type="button"
                  onClick={() => onTextChange('')}
                  aria-label="Clear text"
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2 text-xs font-medium text-[#66665F] transition-colors hover:bg-[#F1F1ED] hover:text-[#141413] dark:text-[#9A9CA3] dark:hover:bg-[#23262D] dark:hover:text-white whitespace-nowrap shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Collapsible Bilingual Segment & Hindi IPA Phoneme Inspector */}
          <div className="mt-4 border-t border-[#ECECE7] pt-3 dark:border-[#252830]">
            <button
              type="button"
              onClick={() => setShowInspector((s) => !s)}
              className="flex min-h-[40px] w-full items-center justify-between text-left text-xs font-semibold text-[#474742] transition-colors hover:text-[#141413] dark:text-[#B8BAC0] dark:hover:text-white"
            >
              <span>Phoneme (IPA) &amp; Bilingual Segment Inspector</span>
              {showInspector ? (
                <ChevronUp className="h-4 w-4 shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0" />
              )}
            </button>

            {showInspector && (
              <div className="mt-3 space-y-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-[#66665F] dark:text-[#9A9CA3]">
                    Detected synthesis queue ({segments.length} segments)
                  </p>
                  {segments.length === 0 ? (
                    <p className="text-xs text-[#8A8A82]">Enter text above to inspect script segmentation.</p>
                  ) : (
                    <ul className="divide-y divide-[#ECECE7] rounded-xl border border-[#ECECE7] bg-[#FAF9F7] dark:divide-[#252830] dark:border-[#252830] dark:bg-[#121417]">
                      {segments.slice(0, 8).map((seg, idx) => {
                        const voiceId =
                          seg.voiceOverride ?? (seg.lang === 'hi' ? hindiVoice : englishVoice);
                        return (
                          <li
                            key={`${idx}-${seg.text.slice(0, 12)}`}
                            className="flex items-start justify-between gap-3 px-3 py-2 text-xs"
                          >
                            <span className="line-clamp-2 text-[#2C2C29] dark:text-[#DFDFE4]">
                              {seg.text}
                            </span>
                            <span className="font-mono text-[11px] text-[#66665F] dark:text-[#9A9CA3] whitespace-nowrap shrink-0">
                              {seg.lang === 'hi' ? 'HI' : 'EN'} · {voiceId}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {(activeOutput?.phonemes || liveHindiIpaPreview) && (
                  <div>
                    <p className="text-xs font-medium text-[#66665F] dark:text-[#9A9CA3]">
                      {activeOutput?.phonemes
                        ? 'Last synthesized Kokoro IPA tokens'
                        : 'Live offline Devanagari → Kokoro IPA preview'}
                    </p>
                    <p className="mt-1.5 break-words rounded-xl border border-[#ECECE7] bg-[#FAF9F7] p-3 font-mono text-xs leading-relaxed text-[#2C2C29] dark:border-[#252830] dark:bg-[#121417] dark:text-[#D4D6DC]">
                      {activeOutput?.phonemes || liveHindiIpaPreview}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Synthesized Output Deck */}
        <div className="rounded-2xl border border-[#E5E5E0] bg-white p-5 sm:p-6 dark:border-[#252830] dark:bg-[#181A1E]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-[#141413] dark:text-[#EDEDEA]">
              24 kHz Audio Output
            </h2>
            {activeOutput ? (
              <span className="font-mono text-xs tabular-nums text-[#66665F] dark:text-[#9A9CA3]">
                {activeOutput.voiceLabel} · 24 kHz WAV · {(activeOutput.elapsedMs / 1000).toFixed(1)}s render
              </span>
            ) : (
              <span className="text-xs text-[#8A8A82] dark:text-[#787B84]">
                Synthesized clips save automatically to Offline Library
              </span>
            )}
          </div>

          <WaveformPlayer
            wavBlob={activeOutput?.wavBlob ?? null}
            peaks={activeOutput?.peaks ?? []}
            durationSec={activeOutput?.durationSec ?? 0}
            autoPlayKey={activeOutput?.id}
            filename={`vaani-${activeOutput?.language ?? 'tts'}-${Date.now()}.wav`}
          />
        </div>
      </section>

      {/* Right Column: Offline Kokoro Engine + Voice & Prosody Controls */}
      <aside className="space-y-4 lg:col-span-5">
        {/* Offline Neural Engine Status Card */}
        <div className="rounded-2xl border border-[#E5E5E0] bg-white p-5 dark:border-[#252830] dark:bg-[#181A1E]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-[#141413] dark:text-[#EDEDEA]">
                Kokoro-82M ONNX Engine
              </h2>
              <p className="mt-0.5 text-xs text-[#66665F] dark:text-[#9A9CA3]">
                {modelStatus === 'ready'
                  ? `Cached locally · ${modelDtype.toUpperCase()} · ${modelDevice.toUpperCase()} · Ready offline`
                  : modelStatus === 'loading'
                    ? 'Downloading weights into local browser storage…'
                    : 'Download once (~92 MB INT8) for 100% offline neural synthesis'}
              </p>
            </div>
            <Cpu
              className={`h-5 w-5 shrink-0 ${
                modelStatus === 'ready'
                  ? 'text-[#D9481E] dark:text-[#F05A2B]'
                  : 'text-[#8A8A82] dark:text-[#6E717A]'
              }`}
              aria-hidden="true"
            />
          </div>

          {modelStatus === 'loading' && (
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate font-mono text-[#474742] dark:text-[#B8BAC0]">
                  {loadProgress?.file || 'Initializing ONNX Runtime…'}
                </span>
                <span className="font-mono tabular-nums text-[#141413] dark:text-[#EDEDEA] shrink-0">
                  {Math.round(loadProgress?.progress ?? 0)}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#ECECE7] dark:bg-[#262932]">
                <div
                  className="h-full rounded-full bg-[#D9481E] transition-all duration-200 dark:bg-[#F05A2B]"
                  style={{ width: `${Math.max(4, Math.min(100, loadProgress?.progress ?? 6))}%` }}
                />
              </div>
              {loadProgress?.loaded && loadProgress?.total && (
                <p className="font-mono text-[11px] tabular-nums text-[#66665F] dark:text-[#9A9CA3]">
                  {formatBytes(loadProgress.loaded)} / {formatBytes(loadProgress.total)}
                </p>
              )}
            </div>
          )}

          {modelError && (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
              {modelError}
            </p>
          )}

          {modelStatus !== 'ready' && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={onLoadModel}
                disabled={modelStatus === 'loading'}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#141413] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#2A2A28] disabled:opacity-60 dark:bg-[#EDEDEA] dark:text-[#141413] dark:hover:bg-white whitespace-nowrap"
              >
                {modelStatus === 'loading' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Caching Model…
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Load Kokoro ONNX ({modelDtype.toUpperCase()})
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Voice Selection & Prosody Card */}
        <div className="rounded-2xl border border-[#E5E5E0] bg-white p-5 dark:border-[#252830] dark:bg-[#181A1E]">
          <h2 className="font-display text-base font-semibold text-[#141413] dark:text-[#EDEDEA]">
            Voice &amp; Prosody
          </h2>

          <div className="mt-4 space-y-4">
            {/* Hindi Voice Selector */}
            {(languageMode === 'hi' || languageMode === 'auto') && (
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <label
                    htmlFor="hindi-voice-select"
                    className="text-xs font-semibold text-[#3F3F3B] dark:text-[#C5C7CD]"
                  >
                    Hindi Voice (हिन्दी)
                  </label>
                  <span className="text-[11px] text-[#66665F] dark:text-[#9A9CA3]">
                    {activeHiVoiceObj.gender} · Grade {activeHiVoiceObj.grade}
                  </span>
                </div>
                <select
                  id="hindi-voice-select"
                  value={hindiVoice}
                  onChange={(e) => onHindiVoiceChange(e.target.value)}
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#DFDFD9] bg-[#FAF9F7] px-3 text-sm font-medium text-[#141413] focus:border-[#D9481E] focus:outline-none dark:border-[#2D313A] dark:bg-[#121417] dark:text-[#EDEDEA]"
                >
                  {hindiVoices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.nativeLabel}) — {v.gender} · {v.id}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* English Voice Selector */}
            {(languageMode === 'en' || languageMode === 'auto') && (
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <label
                    htmlFor="english-voice-select"
                    className="text-xs font-semibold text-[#3F3F3B] dark:text-[#C5C7CD]"
                  >
                    English Voice
                  </label>
                  <span className="text-[11px] text-[#66665F] dark:text-[#9A9CA3]">
                    {activeEnVoiceObj.accent} · Grade {activeEnVoiceObj.grade}
                  </span>
                </div>
                <select
                  id="english-voice-select"
                  value={englishVoice}
                  onChange={(e) => onEnglishVoiceChange(e.target.value)}
                  className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#DFDFD9] bg-[#FAF9F7] px-3 text-sm font-medium text-[#141413] focus:border-[#D9481E] focus:outline-none dark:border-[#2D313A] dark:bg-[#121417] dark:text-[#EDEDEA]"
                >
                  {englishVoices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} — {v.languageLabel} · {v.gender} ({v.grade})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Speed Slider */}
            <div>
              <div className="flex items-center justify-between text-xs">
                <label
                  htmlFor="speed-slider"
                  className="font-semibold text-[#3F3F3B] dark:text-[#C5C7CD]"
                >
                  Speaking Speed
                </label>
                <span className="font-mono font-medium tabular-nums text-[#141413] dark:text-[#EDEDEA]">
                  {speed.toFixed(2)}x
                </span>
              </div>
              <input
                id="speed-slider"
                type="range"
                min={0.5}
                max={2.0}
                step={0.05}
                value={speed}
                onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                className="studio-slider mt-2 w-full"
              />
              <div className="mt-1 flex justify-between font-mono text-[10px] text-[#8A8A82]">
                <span>0.50x</span>
                <span>1.00x</span>
                <span>1.50x</span>
                <span>2.00x</span>
              </div>
            </div>

            {/* Advanced Blending & G2P Accordion */}
            <div className="border-t border-[#ECECE7] pt-3 dark:border-[#252830]">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex min-h-[40px] w-full items-center justify-between text-xs font-semibold text-[#474742] transition-colors hover:text-[#141413] dark:text-[#B8BAC0] dark:hover:text-white"
              >
                <span className="inline-flex items-center gap-2">
                  <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                  Voice Blending, Pause &amp; Hindi G2P
                </span>
                {showAdvanced ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-4">
                  {/* Style Vector Blending */}
                  <div className="space-y-2.5">
                    <label className="flex min-h-[36px] cursor-pointer items-center justify-between gap-2 text-xs font-medium text-[#2C2C29] dark:text-[#DFDFE4]">
                      <span>Blend with secondary Kokoro voice</span>
                      <input
                        type="checkbox"
                        checked={blendEnabled}
                        onChange={(e) => onBlendEnabledChange(e.target.checked)}
                        className="h-4 w-4 accent-[#D9481E]"
                      />
                    </label>

                    {blendEnabled && (
                      <div className="space-y-2.5 rounded-xl border border-[#ECECE7] bg-[#FAF9F7] p-3 dark:border-[#252830] dark:bg-[#121417]">
                        <select
                          aria-label="Secondary blend voice"
                          value={blendVoiceId}
                          onChange={(e) => onBlendVoiceIdChange(e.target.value)}
                          className="min-h-[40px] w-full rounded-lg border border-[#DFDFD9] bg-white px-2.5 text-xs font-medium text-[#141413] dark:border-[#2D313A] dark:bg-[#1A1C21] dark:text-[#EDEDEA]"
                        >
                          {KOKORO_VOICES.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} — {v.languageLabel} ({v.id})
                            </option>
                          ))}
                        </select>
                        <div>
                          <div className="flex justify-between font-mono text-[11px] tabular-nums text-[#66665F] dark:text-[#9A9CA3]">
                            <span>Primary {Math.round((1 - blendRatio) * 100)}%</span>
                            <span>Blend {Math.round(blendRatio * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min={0.1}
                            max={0.85}
                            step={0.05}
                            value={blendRatio}
                            onChange={(e) => onBlendRatioChange(parseFloat(e.target.value))}
                            className="studio-slider mt-1.5 w-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sentence Pause */}
                  <div>
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-[#3F3F3B] dark:text-[#C5C7CD]">
                        Pause between sentences
                      </span>
                      <span className="font-mono tabular-nums text-[#66665F] dark:text-[#9A9CA3]">
                        {pauseMs} ms
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={600}
                      step={30}
                      value={pauseMs}
                      onChange={(e) => onPauseMsChange(parseInt(e.target.value, 10))}
                      className="studio-slider mt-1.5 w-full"
                    />
                  </div>

                  {/* Hindi G2P Engine Selector */}
                  <div>
                    <label
                      htmlFor="hindi-g2p-mode"
                      className="block text-xs font-medium text-[#3F3F3B] dark:text-[#C5C7CD]"
                    >
                      Hindi Phonemizer (G2P)
                    </label>
                    <select
                      id="hindi-g2p-mode"
                      value={hindiG2P}
                      onChange={(e) => onHindiG2PChange(e.target.value as HindiG2PMode)}
                      className="mt-1.5 min-h-[40px] w-full rounded-xl border border-[#DFDFD9] bg-[#FAF9F7] px-3 text-xs font-medium text-[#141413] dark:border-[#2D313A] dark:bg-[#121417] dark:text-[#EDEDEA]"
                    >
                      <option value="auto">Auto (eSpeak-NG WASM → Devanagari G2P fallback)</option>
                      <option value="devanagari">Deterministic Devanagari G2P (Offline JS)</option>
                      <option value="espeak">eSpeak-NG WASM (hi)</option>
                    </select>
                  </div>

                  <label className="flex min-h-[36px] cursor-pointer items-center justify-between gap-2 text-xs font-medium text-[#2C2C29] dark:text-[#DFDFE4]">
                    <span>Auto-save generated clips to Offline Library</span>
                    <input
                      type="checkbox"
                      checked={autoSaveLibrary}
                      onChange={(e) => onAutoSaveLibraryChange(e.target.checked)}
                      className="h-4 w-4 accent-[#D9481E]"
                    />
                  </label>
                </div>
              )}
            </div>

            {synthError && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                {synthError}
              </p>
            )}

            {/* Primary Action Buttons */}
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={modelStatus === 'ready' ? onSynthesize : onLoadModel}
                disabled={isSynthesizing || modelStatus === 'loading' || !text.trim()}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#D9481E] px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-[#C03E18] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9481E] dark:bg-[#F05A2B] dark:hover:bg-[#D9481E]"
              >
                {isSynthesizing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span className="truncate">
                      {synthProgress
                        ? `Synthesizing ${synthProgress.segmentIndex + 1}/${synthProgress.totalSegments} (${synthProgress.segmentLang.toUpperCase()})…`
                        : 'Synthesizing offline…'}
                    </span>
                  </>
                ) : modelStatus === 'ready' ? (
                  <>
                    <AudioLines className="h-4 w-4" aria-hidden="true" />
                    <span>Generate Kokoro Speech</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" aria-hidden="true" />
                    <span>Download Kokoro &amp; Synthesize</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={isDeviceSpeaking ? onStopDeviceSpeak : onQuickDeviceSpeak}
                disabled={!text.trim()}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[#DFDFD9] bg-transparent px-4 py-2.5 text-xs font-semibold text-[#3F3F3B] transition-colors hover:bg-[#F1F1ED] hover:text-[#141413] disabled:opacity-40 dark:border-[#2D313A] dark:text-[#C5C7CD] dark:hover:bg-[#23262D] dark:hover:text-white"
              >
                {isDeviceSpeaking ? (
                  <>
                    <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    <span>Stop Instant Device Preview</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      Instant Preview via Device {containsDevanagari(text) ? 'hi-IN' : 'en-US'} Voice
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
