/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  FolderHeart,
  Moon,
  Sliders,
  Smartphone,
  Sun,
} from 'lucide-react';
import { StudioTab, type ActiveAudioOutput } from './components/StudioTab';
import { VoicesTab } from './components/VoicesTab';
import { LibraryTab } from './components/LibraryTab';
import { AndroidKitTab } from './components/AndroidKitTab';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  kokoroClient,
  speakWithDeviceTTS,
  type ModelLoadProgress,
  type SynthProgress,
} from './lib/kokoroClient';
import {
  SAMPLE_SCRIPTS,
  getVoiceById,
  type KokoroVoice,
  type ModelDtype,
} from './lib/voices';
import {
  computeWaveformPeaks,
  encodeWav,
  KOKORO_SAMPLE_RATE,
} from './lib/audioUtils';
import {
  clearKokoroOfflineCaches,
  deleteClipFromLibrary,
  deleteLexiconEntry,
  getOfflineStorageReport,
  loadAllClips,
  loadLexicon,
  saveClipToLibrary,
  saveLexiconEntry,
  type OfflineStorageReport,
  type SavedAudioClip,
} from './lib/storage';
import { containsDevanagari, type LexiconEntry } from './lib/hindiG2P';
import type { HindiG2PMode } from './workers/kokoro.worker';

type NavTab = 'studio' | 'voices' | 'library' | 'android';

const PREFETCH_PACK_VOICES = [
  'hf_alpha',
  'hf_beta',
  'hm_omega',
  'hm_psi',
  'af_heart',
  'af_bella',
  'am_michael',
  'bf_emma',
  'bm_george',
];

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('studio');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('vaani-theme') === 'dark';
  });

  // Synthesis workspace state
  const [text, setText] = useState<string>(SAMPLE_SCRIPTS[3].text);
  const [languageMode, setLanguageMode] = useState<'auto' | 'en' | 'hi'>('auto');
  const [hindiVoice, setHindiVoice] = useState<string>('hf_alpha');
  const [englishVoice, setEnglishVoice] = useState<string>('af_heart');
  const [blendEnabled, setBlendEnabled] = useState<boolean>(false);
  const [blendVoiceId, setBlendVoiceId] = useState<string>('af_bella');
  const [blendRatio, setBlendRatio] = useState<number>(0.3);
  const [speed, setSpeed] = useState<number>(1.0);
  const [pauseMs, setPauseMs] = useState<number>(180);
  const [hindiG2P, setHindiG2P] = useState<HindiG2PMode>('auto');
  const [autoSaveLibrary, setAutoSaveLibrary] = useState<boolean>(true);

  // Kokoro-82M ONNX engine state
  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [modelDtype, setModelDtype] = useState<ModelDtype>('q8');
  const [modelDevice, setModelDevice] = useState<'webgpu' | 'wasm'>('wasm');
  const [webGpuAvailable, setWebGpuAvailable] = useState<boolean>(false);
  const [loadProgress, setLoadProgress] = useState<ModelLoadProgress | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);

  // Synthesis execution state
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [synthProgress, setSynthProgress] = useState<SynthProgress | null>(null);
  const [synthError, setSynthError] = useState<string | null>(null);
  const [activeOutput, setActiveOutput] = useState<ActiveAudioOutput | null>(null);

  // Instant Device Speech preview
  const [isDeviceSpeaking, setIsDeviceSpeaking] = useState<boolean>(false);
  const stopDeviceSpeakRef = useRef<(() => void) | null>(null);

  // Offline Library, Lexicon, Favorites & Cache state
  const [clips, setClips] = useState<SavedAudioClip[]>([]);
  const [lexicon, setLexicon] = useState<LexiconEntry[]>([]);
  const [favoriteVoiceIds, setFavoriteVoiceIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('vaani-favorites');
      return saved ? JSON.parse(saved) : ['hf_alpha', 'hm_omega', 'af_heart'];
    } catch {
      return ['hf_alpha', 'hm_omega', 'af_heart'];
    }
  });
  const [storageReport, setStorageReport] = useState<OfflineStorageReport>({
    usageBytes: 0,
    quotaBytes: 0,
    cachedVoiceIds: [],
    modelCacheEntries: 0,
  });
  const [isPrefetchingVoices, setIsPrefetchingVoices] = useState<boolean>(false);
  const [auditioningVoiceId, setAuditioningVoiceId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3200);
  }, []);

  // Sync theme class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('vaani-theme', darkMode ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [darkMode]);

  const refreshStorageReport = useCallback(async () => {
    const report = await getOfflineStorageReport();
    setStorageReport(report);
  }, []);

  // Hydrate offline IndexedDB clips, lexicon, WebGPU detection & cache status on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [loadedClips, loadedLex, hasWebGpu, report] = await Promise.all([
        loadAllClips().catch(() => []),
        loadLexicon().catch(() => []),
        kokoroClient.detectWebGPU(),
        getOfflineStorageReport(),
      ]);
      if (!mounted) return;
      setClips(loadedClips);
      setLexicon(loadedLex);
      setWebGpuAvailable(hasWebGpu);
      setStorageReport(report);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLoadModel = useCallback(async (): Promise<boolean> => {
    setModelStatus('loading');
    setModelError(null);
    setLoadProgress({ file: 'onnx-community/Kokoro-82M-v1.0-ONNX', status: 'initiate', progress: 2 });
    try {
      await kokoroClient.loadModel(modelDtype, modelDevice, (p) => {
        setLoadProgress(p);
      });
      setModelStatus('ready');
      setLoadProgress(null);
      await refreshStorageReport();
      showToast(`Kokoro-82M (${modelDtype.toUpperCase()}) cached for offline synthesis`);
      return true;
    } catch (err) {
      setModelStatus('error');
      setModelError(
        err instanceof Error
          ? err.message
          : 'Failed to download Kokoro-82M ONNX weights. Check internet connection for initial cache.'
      );
      return false;
    }
  }, [modelDtype, modelDevice, refreshStorageReport, showToast]);

  const runSynthesis = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (modelStatus !== 'ready') {
      const loaded = await handleLoadModel();
      if (!loaded) return;
    }

    setIsSynthesizing(true);
    setSynthError(null);
    setSynthProgress(null);

    try {
      const result = await kokoroClient.synthesize(
        {
          text: trimmed,
          mode: languageMode,
          englishVoice,
          hindiVoice,
          blendVoiceId: blendEnabled ? blendVoiceId : undefined,
          blendRatio: blendEnabled ? blendRatio : 0,
          speed,
          pauseMs,
          hindiG2P,
          lexicon,
        },
        (p) => setSynthProgress(p)
      );

      const wavBlob = encodeWav(result.audio, result.sampleRate || KOKORO_SAMPLE_RATE);
      const peaks = computeWaveformPeaks(result.audio, 72);
      const durationSec = result.audio.length / (result.sampleRate || KOKORO_SAMPLE_RATE);

      const hasHi = containsDevanagari(trimmed);
      const hasEn = /[A-Za-z]{2,}/.test(trimmed);
      const detectedLang: 'en' | 'hi' | 'bilingual' =
        languageMode === 'hi'
          ? 'hi'
          : languageMode === 'en'
            ? 'en'
            : hasHi && hasEn
              ? 'bilingual'
              : hasHi
                ? 'hi'
                : 'en';

      const primaryVoiceId = detectedLang === 'hi' ? hindiVoice : englishVoice;
      const voiceLabel =
        detectedLang === 'bilingual'
          ? `${englishVoice} + ${hindiVoice}`
          : blendEnabled
            ? `${primaryVoiceId} × ${blendVoiceId}`
            : primaryVoiceId;

      const outputId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      setActiveOutput({
        id: outputId,
        wavBlob,
        peaks,
        durationSec,
        phonemes: result.phonemes,
        voiceLabel,
        language: detectedLang,
        elapsedMs: result.elapsedMs,
        segmentCount: result.segmentCount,
      });

      if (autoSaveLibrary) {
        const clip: SavedAudioClip = {
          id: outputId,
          text: trimmed,
          phonemes: result.phonemes,
          language: detectedLang,
          voiceId: primaryVoiceId,
          blendVoiceId: blendEnabled ? blendVoiceId : undefined,
          blendRatio: blendEnabled ? blendRatio : undefined,
          speed,
          durationSec,
          sampleRate: result.sampleRate || KOKORO_SAMPLE_RATE,
          engine: 'kokoro-onnx',
          createdAt: Date.now(),
          wavBlob,
          peaks,
        };
        await saveClipToLibrary(clip);
        setClips((prev) => [clip, ...prev]);
      }

      await refreshStorageReport();
    } catch (err) {
      setSynthError(err instanceof Error ? err.message : 'Synthesis failed unexpectedly.');
    } finally {
      setIsSynthesizing(false);
      setSynthProgress(null);
    }
  }, [
    text,
    modelStatus,
    handleLoadModel,
    languageMode,
    englishVoice,
    hindiVoice,
    blendEnabled,
    blendVoiceId,
    blendRatio,
    speed,
    pauseMs,
    hindiG2P,
    lexicon,
    autoSaveLibrary,
    refreshStorageReport,
  ]);

  const handleQuickDeviceSpeak = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const lang: 'en' | 'hi' =
      languageMode === 'hi' || (languageMode === 'auto' && containsDevanagari(trimmed))
        ? 'hi'
        : 'en';

    stopDeviceSpeakRef.current?.();
    stopDeviceSpeakRef.current = speakWithDeviceTTS(trimmed, lang, speed, {
      onStart: () => setIsDeviceSpeaking(true),
      onEnd: () => setIsDeviceSpeaking(false),
      onError: (msg) => {
        setIsDeviceSpeaking(false);
        showToast(msg);
      },
    });
  }, [text, languageMode, speed, showToast]);

  const handleStopDeviceSpeak = useCallback(() => {
    stopDeviceSpeakRef.current?.();
    setIsDeviceSpeaking(false);
  }, []);

  const handlePrefetchRecommendedVoices = useCallback(async () => {
    setIsPrefetchingVoices(true);
    try {
      const res = await kokoroClient.prefetchVoices(PREFETCH_PACK_VOICES);
      await refreshStorageReport();
      showToast(`Cached ${res.cached.length} Hindi & English voice packs offline`);
    } catch {
      showToast('Could not prefetch voices — check network connection');
    } finally {
      setIsPrefetchingVoices(false);
    }
  }, [refreshStorageReport, showToast]);

  const handleClearCache = useCallback(async () => {
    await clearKokoroOfflineCaches();
    setModelStatus('idle');
    await refreshStorageReport();
    showToast('Cleared cached Kokoro ONNX weights and voice packs');
  }, [refreshStorageReport, showToast]);

  const handleSelectVoice = useCallback(
    (voice: KokoroVoice) => {
      if (voice.language === 'hi') {
        setHindiVoice(voice.id);
      } else {
        setEnglishVoice(voice.id);
      }
      showToast(`Active ${voice.language === 'hi' ? 'Hindi' : 'English'} voice: ${voice.name}`);
    },
    [showToast]
  );

  const handleAuditionVoice = useCallback(
    async (voice: KokoroVoice) => {
      const sampleLine =
        voice.language === 'hi'
          ? 'नमस्ते, मैं वाणी कोकोरो ऑफ़लाइन आवाज़ हूँ।'
          : `Hello, this is ${voice.name} speaking offline with Kokoro.`;

      if (modelStatus !== 'ready') {
        speakWithDeviceTTS(sampleLine, voice.language === 'hi' ? 'hi' : 'en', 1.0, {
          onStart: () => setAuditioningVoiceId(voice.id),
          onEnd: () => setAuditioningVoiceId(null),
          onError: () => setAuditioningVoiceId(null),
        });
        showToast('Previewed via device voice — load Kokoro ONNX for neural voice audition');
        return;
      }

      setAuditioningVoiceId(voice.id);
      try {
        const res = await kokoroClient.synthesize({
          text: sampleLine,
          mode: voice.language === 'hi' ? 'hi' : 'en',
          englishVoice: voice.language === 'hi' ? englishVoice : voice.id,
          hindiVoice: voice.language === 'hi' ? voice.id : hindiVoice,
          speed: 1.0,
          pauseMs: 120,
          hindiG2P,
          lexicon,
        });
        const blob = encodeWav(res.audio, res.sampleRate);
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);
        await audio.play();
        await refreshStorageReport();
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Voice audition failed');
      } finally {
        setAuditioningVoiceId(null);
      }
    },
    [modelStatus, englishVoice, hindiVoice, hindiG2P, lexicon, refreshStorageReport, showToast]
  );

  const handleToggleFavorite = useCallback((voiceId: string) => {
    setFavoriteVoiceIds((prev) => {
      const next = prev.includes(voiceId) ? prev.filter((v) => v !== voiceId) : [...prev, voiceId];
      try {
        localStorage.setItem('vaani-favorites', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const handleAddLexicon = useCallback(
    async (entry: Omit<LexiconEntry, 'id' | 'updatedAt'>) => {
      const full: LexiconEntry = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        updatedAt: Date.now(),
      };
      await saveLexiconEntry(full);
      setLexicon((prev) => [full, ...prev]);
      showToast(`Saved pronunciation rule for "${entry.word}"`);
    },
    [showToast]
  );

  const handleDeleteLexicon = useCallback(async (id: string) => {
    await deleteLexiconEntry(id);
    setLexicon((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleDeleteClip = useCallback(async (id: string) => {
    await deleteClipFromLibrary(id);
    setClips((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleLoadInStudio = useCallback((clip: SavedAudioClip) => {
    setText(clip.text);
    setLanguageMode(clip.language === 'bilingual' ? 'auto' : clip.language);
    const vObj = getVoiceById(clip.voiceId);
    if (vObj.language === 'hi') {
      setHindiVoice(clip.voiceId);
    } else {
      setEnglishVoice(clip.voiceId);
    }
    setSpeed(clip.speed);
    setActiveOutput({
      id: clip.id,
      wavBlob: clip.wavBlob,
      peaks: clip.peaks,
      durationSec: clip.durationSec,
      phonemes: clip.phonemes,
      voiceLabel: clip.voiceId,
      language: clip.language,
      elapsedMs: 0,
      segmentCount: 1,
    });
    setActiveTab('studio');
  }, []);

  const navItems: Array<{ id: NavTab; label: string; icon: typeof AudioLines }> = [
    { id: 'studio', label: 'Studio', icon: AudioLines },
    { id: 'voices', label: 'Voices', icon: Sliders },
    { id: 'library', label: 'Library', icon: FolderHeart },
    { id: 'android', label: 'Android Kit', icon: Smartphone },
  ];

  return (
    <div className="min-h-screen bg-[#F6F6F4] text-[#141413] dark:bg-[#111214] dark:text-[#EDEDEA]">
      {/* Strict 3-Zone Top Navigation Bar (Compact 56px height) */}
      <header className="sticky top-0 z-30 border-b border-[#E5E5E0] bg-[#F6F6F4]/90 backdrop-blur-md dark:border-[#24272F] dark:bg-[#111214]/90">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('studio')}
            className="font-display text-lg font-bold tracking-tight text-[#141413] dark:text-[#EDEDEA] whitespace-nowrap shrink-0"
          >
            Vaani
          </button>

          {/* Zone 2: Clean single-line text nav links (Desktop) */}
          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-7 md:flex"
          >
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative min-h-[40px] px-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'text-[#141413] dark:text-white'
                      : 'text-[#66665F] hover:text-[#141413] dark:text-[#9A9CA3] dark:hover:text-white'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 -bottom-[9px] h-[2px] rounded-full bg-[#D9481E] dark:bg-[#F05A2B]"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            <PWAInstallButton onOpenAndroidKit={() => setActiveTab('android')} />
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 md:pb-12">
        {activeTab === 'studio' && (
          <StudioTab
            text={text}
            onTextChange={setText}
            languageMode={languageMode}
            onLanguageModeChange={setLanguageMode}
            hindiVoice={hindiVoice}
            onHindiVoiceChange={setHindiVoice}
            englishVoice={englishVoice}
            onEnglishVoiceChange={setEnglishVoice}
            blendEnabled={blendEnabled}
            onBlendEnabledChange={setBlendEnabled}
            blendVoiceId={blendVoiceId}
            onBlendVoiceIdChange={setBlendVoiceId}
            blendRatio={blendRatio}
            onBlendRatioChange={setBlendRatio}
            speed={speed}
            onSpeedChange={setSpeed}
            pauseMs={pauseMs}
            onPauseMsChange={setPauseMs}
            hindiG2P={hindiG2P}
            onHindiG2PChange={setHindiG2P}
            autoSaveLibrary={autoSaveLibrary}
            onAutoSaveLibraryChange={setAutoSaveLibrary}
            modelStatus={modelStatus}
            modelDtype={modelDtype}
            modelDevice={modelDevice}
            loadProgress={loadProgress}
            modelError={modelError}
            onLoadModel={handleLoadModel}
            isSynthesizing={isSynthesizing}
            synthProgress={synthProgress}
            synthError={synthError}
            onSynthesize={runSynthesis}
            onQuickDeviceSpeak={handleQuickDeviceSpeak}
            isDeviceSpeaking={isDeviceSpeaking}
            onStopDeviceSpeak={handleStopDeviceSpeak}
            activeOutput={activeOutput}
            lexicon={lexicon}
          />
        )}

        {activeTab === 'voices' && (
          <VoicesTab
            modelStatus={modelStatus}
            modelDtype={modelDtype}
            onModelDtypeChange={(d) => {
              setModelDtype(d);
              if (modelStatus === 'ready') setModelStatus('idle');
            }}
            modelDevice={modelDevice}
            onModelDeviceChange={(dev) => {
              setModelDevice(dev);
              if (modelStatus === 'ready') setModelStatus('idle');
            }}
            webGpuAvailable={webGpuAvailable}
            onLoadModel={handleLoadModel}
            storageReport={storageReport}
            onPrefetchRecommendedVoices={handlePrefetchRecommendedVoices}
            isPrefetchingVoices={isPrefetchingVoices}
            onClearCache={handleClearCache}
            hindiVoice={hindiVoice}
            englishVoice={englishVoice}
            onSelectVoice={handleSelectVoice}
            onAuditionVoice={handleAuditionVoice}
            auditioningVoiceId={auditioningVoiceId}
            favoriteVoiceIds={favoriteVoiceIds}
            onToggleFavorite={handleToggleFavorite}
            lexicon={lexicon}
            onAddLexicon={handleAddLexicon}
            onDeleteLexicon={handleDeleteLexicon}
          />
        )}

        {activeTab === 'library' && (
          <LibraryTab
            clips={clips}
            onDeleteClip={handleDeleteClip}
            onLoadInStudio={handleLoadInStudio}
            onGoToStudio={() => setActiveTab('studio')}
          />
        )}

        {activeTab === 'android' && <AndroidKitTab />}
      </main>

      {/* Quiet Footer with Theme Switch */}
      <footer className="mx-auto hidden max-w-6xl items-center justify-between border-t border-[#E5E5E0] px-6 py-5 text-xs text-[#66665F] md:flex dark:border-[#24272F] dark:text-[#8E9199]">
        <span>
          Vaani Offline TTS · English &amp; Hindi Kokoro-82M (Apache 2.0) · 24 kHz Local Synthesis
        </span>
        <button
          type="button"
          onClick={() => setDarkMode((d) => !d)}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-[#474742] transition-colors hover:bg-[#EAEAE4] hover:text-[#141413] dark:text-[#B8BAC0] dark:hover:bg-[#23262D] dark:hover:text-white whitespace-nowrap shrink-0"
        >
          {darkMode ? (
            <>
              <Sun className="h-3.5 w-3.5" aria-hidden="true" />
              Light theme
            </>
          ) : (
            <>
              <Moon className="h-3.5 w-3.5" aria-hidden="true" />
              Dark theme
            </>
          )}
        </button>
      </footer>

      {/* Mobile Fixed Thumb-Zone Bottom Tab Bar (60px height — combined with 56px top bar stays under 15% cap) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E5E5E0] bg-white/95 backdrop-blur-md pb-safe md:hidden dark:border-[#24272F] dark:bg-[#14161A]/95"
      >
        <div className="grid h-[60px] grid-cols-5 items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-1 transition-colors ${
                  active
                    ? 'text-[#D9481E] dark:text-[#F05A2B]'
                    : 'text-[#66665F] dark:text-[#9A9CA3]'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="text-[10px] font-semibold tracking-tight whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            aria-label={darkMode ? 'Switch to light theme' : 'Switch to dark theme'}
            className="flex min-h-[48px] flex-col items-center justify-center gap-1 text-[#66665F] dark:text-[#9A9CA3]"
          >
            {darkMode ? (
              <Sun className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Moon className="h-5 w-5" aria-hidden="true" />
            )}
            <span className="text-[10px] font-semibold tracking-tight whitespace-nowrap">
              {darkMode ? 'Light' : 'Dark'}
            </span>
          </button>
        </div>
      </nav>

      {/* Non-intrusive Offline Banner & Action Toast */}
      <OfflineIndicator />

      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-20 right-4 z-40 max-w-xs rounded-xl border border-[#E5E5E0] bg-[#141413] px-4 py-2.5 text-xs font-medium text-[#EDEDEA] shadow-lg md:bottom-5 dark:border-[#2E323A] dark:bg-[#23262E]"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
