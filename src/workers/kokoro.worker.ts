/// <reference lib="webworker" />

import { KokoroTTS } from 'kokoro-js';
import { Tensor } from '@huggingface/transformers';
import { phonemize as espeakPhonemize } from 'phonemizer';
import {
  applyPronunciationLexicon,
  hindiToKokoroIPA,
  normalizeHindiNumbers,
  sanitizeKokoroPhonemes,
  segmentTextForSynthesis,
  type LexiconEntry,
} from '../lib/hindiG2P';
import { concatAudioBuffers, KOKORO_SAMPLE_RATE } from '../lib/audioUtils';
import type { ModelDtype } from '../lib/voices';

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const VOICE_CACHE_NAME = 'kokoro-voices';
const VOICE_BASE_URL = `https://huggingface.co/${MODEL_ID}/resolve/main/voices`;

let ttsInstance: KokoroTTS | null = null;
let loadedDtype: ModelDtype | null = null;
let loadedDevice: 'webgpu' | 'wasm' | null = null;
const voiceMemoryCache = new Map<string, Float32Array>();

export type HindiG2PMode = 'auto' | 'devanagari' | 'espeak';

export type WorkerRequest =
  | {
      type: 'LOAD_MODEL';
      id: string;
      dtype: ModelDtype;
      device: 'webgpu' | 'wasm';
    }
  | {
      type: 'SYNTHESIZE';
      id: string;
      text: string;
      mode: 'auto' | 'en' | 'hi';
      englishVoice: string;
      hindiVoice: string;
      blendVoiceId?: string;
      blendRatio?: number;
      speed: number;
      pauseMs: number;
      hindiG2P: HindiG2PMode;
      lexicon: LexiconEntry[];
    }
  | {
      type: 'PREFETCH_VOICES';
      id: string;
      voiceIds: string[];
    };

export type WorkerResponse =
  | {
      type: 'LOAD_PROGRESS';
      id: string;
      file: string;
      status: string;
      progress: number;
      loaded?: number;
      total?: number;
    }
  | {
      type: 'MODEL_READY';
      id: string;
      dtype: ModelDtype;
      device: 'webgpu' | 'wasm';
    }
  | {
      type: 'SYNTH_PROGRESS';
      id: string;
      segmentIndex: number;
      totalSegments: number;
      segmentText: string;
      segmentLang: 'en' | 'hi';
    }
  | {
      type: 'SYNTH_COMPLETE';
      id: string;
      audio: Float32Array;
      sampleRate: number;
      phonemes: string;
      segmentCount: number;
      elapsedMs: number;
    }
  | {
      type: 'PREFETCH_COMPLETE';
      id: string;
      cached: string[];
      failed: string[];
    }
  | {
      type: 'ERROR';
      id: string;
      message: string;
    };

async function loadVoiceEmbedding(voiceId: string): Promise<Float32Array> {
  const existing = voiceMemoryCache.get(voiceId);
  if (existing) return existing;

  const url = `${VOICE_BASE_URL}/${voiceId}.bin`;
  let cache: Cache | null = null;

  try {
    cache = await caches.open(VOICE_CACHE_NAME);
    const cachedRes = await cache.match(url);
    if (cachedRes) {
      const buf = await cachedRes.arrayBuffer();
      const arr = new Float32Array(buf);
      voiceMemoryCache.set(voiceId, arr);
      return arr;
    }
  } catch {
    // Cache API may be unavailable in opaque contexts
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to fetch voice embedding "${voiceId}" (HTTP ${response.status}).`);
  }
  const buf = await response.arrayBuffer();
  if (cache) {
    try {
      await cache.put(
        url,
        new Response(buf.slice(0), {
          headers: { 'Content-Type': 'application/octet-stream' },
        })
      );
    } catch {
      // Ignore quota errors
    }
  }

  const arr = new Float32Array(buf);
  voiceMemoryCache.set(voiceId, arr);
  return arr;
}

const PUNCT_SPLIT_RE = /(\s*[;:,.!?¡¿—…"«»“”(){}[\]]+\s*)+/g;

function normalizeEnglishText(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\bD[Rr]\.(?= [A-Z])/g, 'Doctor')
    .replace(/\bMr\.(?= [A-Z])/g, 'Mister')
    .replace(/\bMs\.(?= [A-Z])/g, 'Miss')
    .replace(/\bMrs\.(?= [A-Z])/g, 'Mrs')
    .replace(/\betc\.(?! [A-Z])/gi, 'etc')
    .replace(/(?<=\d),(?=\d)/g, '')
    .replace(/(?<=\d)-(?=\d)/g, ' to ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function phonemizeEnglish(text: string, voiceId: string): Promise<string> {
  const norm = normalizeEnglishText(text);
  const lang = voiceId.startsWith('b') ? 'en' : 'en-us';

  const parts: Array<{ match: boolean; text: string }> = [];
  let lastIdx = 0;
  for (const m of norm.matchAll(PUNCT_SPLIT_RE)) {
    const idx = m.index ?? 0;
    if (lastIdx < idx) parts.push({ match: false, text: norm.slice(lastIdx, idx) });
    if (m[0].length > 0) parts.push({ match: true, text: m[0] });
    lastIdx = idx + m[0].length;
  }
  if (lastIdx < norm.length) parts.push({ match: false, text: norm.slice(lastIdx) });

  const converted = await Promise.all(
    parts.map(async (p) => {
      if (p.match) return p.text;
      const res = await espeakPhonemize(p.text, lang);
      return res.join(' ');
    })
  );

  let ipa = converted
    .join('')
    .replace(/kəkˈoːɹoʊ/g, 'kˈoʊkəɹoʊ')
    .replace(/kəkˈɔːɹəʊ/g, 'kˈəʊkəɹəʊ')
    .replace(/ʲ/g, 'j')
    .replace(/r/g, 'ɹ')
    .replace(/x/g, 'k')
    .replace(/ɬ/g, 'l')
    .trim();

  if (lang === 'en-us') {
    ipa = ipa.replace(/(?<=nˈaɪn)ti(?!ː)/g, 'di');
  }
  return ipa;
}

async function phonemizeHindi(text: string, g2pMode: HindiG2PMode): Promise<string> {
  const norm = normalizeHindiNumbers(text).replace(/।/g, '. ').replace(/॥/g, '. ').trim();

  if (g2pMode === 'devanagari') {
    return hindiToKokoroIPA(norm);
  }

  try {
    const espeakOut = await espeakPhonemize(norm, 'hi');
    const joined = espeakOut.join(' ').trim();
    const cleaned = sanitizeKokoroPhonemes(joined);
    if (cleaned.length >= 2) {
      return cleaned;
    }
  } catch {
    // Fall back to deterministic Devanagari G2P
  }

  return hindiToKokoroIPA(norm);
}

async function synthesizeSegment(
  tts: KokoroTTS,
  phonemes: string,
  voiceId: string,
  speed: number,
  blendVoiceId?: string,
  blendRatio = 0
): Promise<Float32Array> {
  const safePhonemes = phonemes.trim();
  if (!safePhonemes) return new Float32Array(0);

  const { input_ids } = tts.tokenizer(safePhonemes, { truncation: true });
  const tokenCount = input_ids.dims[input_ids.dims.length - 1] ?? 2;
  const styleOffset = 256 * Math.min(Math.max(tokenCount - 2, 0), 509);

  const primaryVoice = await loadVoiceEmbedding(voiceId);
  let styleSlice = primaryVoice.slice(styleOffset, styleOffset + 256);

  if (blendVoiceId && blendVoiceId !== voiceId && blendRatio > 0.01) {
    const secondaryVoice = await loadVoiceEmbedding(blendVoiceId);
    const secondarySlice = secondaryVoice.slice(styleOffset, styleOffset + 256);
    const mixed = new Float32Array(256);
    const r = Math.max(0, Math.min(1, blendRatio));
    for (let i = 0; i < 256; i++) {
      mixed[i] = styleSlice[i] * (1 - r) + secondarySlice[i] * r;
    }
    styleSlice = mixed;
  }

  const inputs = {
    input_ids,
    style: new Tensor('float32', styleSlice, [1, 256]),
    speed: new Tensor('float32', [speed], [1]),
  };

  // Invoke underlying StyleTextToSpeech2Model directly so Hindi & blended style vectors work seamlessly
  const modelCallable = tts.model as unknown as (
    args: typeof inputs
  ) => Promise<{ waveform: { data: Float32Array } }>;
  const { waveform } = await modelCallable(inputs);
  return new Float32Array(waveform.data);
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;

  try {
    if (msg.type === 'LOAD_MODEL') {
      if (ttsInstance && loadedDtype === msg.dtype && loadedDevice === msg.device) {
        const readyMsg: WorkerResponse = {
          type: 'MODEL_READY',
          id: msg.id,
          dtype: loadedDtype,
          device: loadedDevice,
        };
        self.postMessage(readyMsg);
        return;
      }

      ttsInstance = await KokoroTTS.from_pretrained(MODEL_ID, {
        dtype: msg.dtype,
        device: msg.device,
        progress_callback: (info: Record<string, unknown>) => {
          const progressMsg: WorkerResponse = {
            type: 'LOAD_PROGRESS',
            id: msg.id,
            file: typeof info.file === 'string' ? info.file : 'model',
            status: typeof info.status === 'string' ? info.status : 'loading',
            progress: typeof info.progress === 'number' ? info.progress : 0,
            loaded: typeof info.loaded === 'number' ? info.loaded : undefined,
            total: typeof info.total === 'number' ? info.total : undefined,
          };
          self.postMessage(progressMsg);
        },
      });

      loadedDtype = msg.dtype;
      loadedDevice = msg.device;

      const readyMsg: WorkerResponse = {
        type: 'MODEL_READY',
        id: msg.id,
        dtype: loadedDtype,
        device: loadedDevice,
      };
      self.postMessage(readyMsg);
      return;
    }

    if (msg.type === 'PREFETCH_VOICES') {
      const cached: string[] = [];
      const failed: string[] = [];
      for (const vid of msg.voiceIds) {
        try {
          await loadVoiceEmbedding(vid);
          cached.push(vid);
        } catch {
          failed.push(vid);
        }
      }
      const doneMsg: WorkerResponse = {
        type: 'PREFETCH_COMPLETE',
        id: msg.id,
        cached,
        failed,
      };
      self.postMessage(doneMsg);
      return;
    }

    if (msg.type === 'SYNTHESIZE') {
      if (!ttsInstance) {
        throw new Error('Kokoro-82M ONNX model is not loaded yet.');
      }

      const t0 = performance.now();
      const segments = segmentTextForSynthesis(
        msg.text,
        msg.mode,
        msg.englishVoice,
        msg.hindiVoice
      );

      if (segments.length === 0) {
        throw new Error('Please enter English or Hindi text to synthesize.');
      }

      const audioChunks: Float32Array[] = [];
      const allPhonemes: string[] = [];

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const progressMsg: WorkerResponse = {
          type: 'SYNTH_PROGRESS',
          id: msg.id,
          segmentIndex: i,
          totalSegments: segments.length,
          segmentText: seg.text,
          segmentLang: seg.lang,
        };
        self.postMessage(progressMsg);

        const activeVoice =
          seg.voiceOverride ?? (seg.lang === 'hi' ? msg.hindiVoice : msg.englishVoice);

        const processedText = applyPronunciationLexicon(seg.text, msg.lexicon, seg.lang);
        const phonemes =
          seg.lang === 'hi'
            ? await phonemizeHindi(processedText, msg.hindiG2P)
            : await phonemizeEnglish(processedText, activeVoice);

        if (!phonemes) continue;
        allPhonemes.push(phonemes);

        // Split overly long phoneme strings into <= 420-char sub-chunks so Kokoro never clips at 510 tokens
        const subChunks = splitLongPhonemes(phonemes, 400);
        for (const sub of subChunks) {
          const chunkAudio = await synthesizeSegment(
            ttsInstance,
            sub,
            activeVoice,
            msg.speed,
            seg.voiceOverride ? undefined : msg.blendVoiceId,
            seg.voiceOverride ? 0 : msg.blendRatio
          );
          if (chunkAudio.length > 0) {
            audioChunks.push(chunkAudio);
          }
        }
      }

      const combined = concatAudioBuffers(audioChunks, msg.pauseMs, KOKORO_SAMPLE_RATE);
      const elapsedMs = Math.round(performance.now() - t0);

      const completeMsg: WorkerResponse = {
        type: 'SYNTH_COMPLETE',
        id: msg.id,
        audio: combined,
        sampleRate: KOKORO_SAMPLE_RATE,
        phonemes: allPhonemes.join('  ·  '),
        segmentCount: segments.length,
        elapsedMs,
      };
      self.postMessage(completeMsg, [combined.buffer]);
      return;
    }
  } catch (err) {
    const errMsg: WorkerResponse = {
      type: 'ERROR',
      id: msg.id,
      message: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(errMsg);
  }
};

function splitLongPhonemes(phonemes: string, maxChars: number): string[] {
  if (phonemes.length <= maxChars) return [phonemes];
  const words = phonemes.split(' ');
  const chunks: string[] = [];
  let current = '';
  for (const w of words) {
    if (current.length + w.length + 1 > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = w;
    } else {
      current = current ? `${current} ${w}` : w;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
