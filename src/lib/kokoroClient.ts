import type { LexiconEntry } from './hindiG2P';
import type { ModelDtype } from './voices';
import type {
  HindiG2PMode,
  WorkerRequest,
  WorkerResponse,
} from '../workers/kokoro.worker';

export interface ModelLoadProgress {
  file: string;
  status: string;
  progress: number;
  loaded?: number;
  total?: number;
}

export interface SynthProgress {
  segmentIndex: number;
  totalSegments: number;
  segmentText: string;
  segmentLang: 'en' | 'hi';
}

export interface SynthResult {
  audio: Float32Array;
  sampleRate: number;
  phonemes: string;
  segmentCount: number;
  elapsedMs: number;
}

class KokoroWorkerClient {
  private worker: Worker | null = null;
  private listeners = new Map<string, (msg: WorkerResponse) => void>();

  private ensureWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('../workers/kokoro.worker.ts', import.meta.url), {
        type: 'module',
      });
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;
        const handler = this.listeners.get(msg.id);
        if (handler) handler(msg);
      };
      this.worker.onerror = (err) => {
        for (const [, handler] of this.listeners) {
          handler({
            type: 'ERROR',
            id: '',
            message: err.message || 'Kokoro Web Worker encountered an unexpected error.',
          });
        }
        this.listeners.clear();
      };
    }
    return this.worker;
  }

  private nextId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  async detectWebGPU(): Promise<boolean> {
    if (typeof navigator === 'undefined') return false;
    const nav = navigator as Navigator & {
      gpu?: { requestAdapter: () => Promise<unknown | null> };
    };
    if (!nav.gpu) return false;
    try {
      const adapter = await nav.gpu.requestAdapter();
      return Boolean(adapter);
    } catch {
      return false;
    }
  }

  loadModel(
    dtype: ModelDtype,
    device: 'webgpu' | 'wasm',
    onProgress?: (p: ModelLoadProgress) => void
  ): Promise<{ dtype: ModelDtype; device: 'webgpu' | 'wasm' }> {
    const worker = this.ensureWorker();
    const id = this.nextId();

    return new Promise((resolve, reject) => {
      this.listeners.set(id, (msg) => {
        if (msg.type === 'LOAD_PROGRESS') {
          onProgress?.({
            file: msg.file,
            status: msg.status,
            progress: msg.progress,
            loaded: msg.loaded,
            total: msg.total,
          });
        } else if (msg.type === 'MODEL_READY') {
          this.listeners.delete(id);
          resolve({ dtype: msg.dtype, device: msg.device });
        } else if (msg.type === 'ERROR') {
          this.listeners.delete(id);
          reject(new Error(msg.message));
        }
      });

      const req: WorkerRequest = { type: 'LOAD_MODEL', id, dtype, device };
      worker.postMessage(req);
    });
  }

  synthesize(
    params: {
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
    },
    onProgress?: (p: SynthProgress) => void
  ): Promise<SynthResult> {
    const worker = this.ensureWorker();
    const id = this.nextId();

    return new Promise((resolve, reject) => {
      this.listeners.set(id, (msg) => {
        if (msg.type === 'SYNTH_PROGRESS') {
          onProgress?.({
            segmentIndex: msg.segmentIndex,
            totalSegments: msg.totalSegments,
            segmentText: msg.segmentText,
            segmentLang: msg.segmentLang,
          });
        } else if (msg.type === 'SYNTH_COMPLETE') {
          this.listeners.delete(id);
          resolve({
            audio: msg.audio,
            sampleRate: msg.sampleRate,
            phonemes: msg.phonemes,
            segmentCount: msg.segmentCount,
            elapsedMs: msg.elapsedMs,
          });
        } else if (msg.type === 'ERROR') {
          this.listeners.delete(id);
          reject(new Error(msg.message));
        }
      });

      const req: WorkerRequest = {
        type: 'SYNTHESIZE',
        id,
        ...params,
      };
      worker.postMessage(req);
    });
  }

  prefetchVoices(voiceIds: string[]): Promise<{ cached: string[]; failed: string[] }> {
    const worker = this.ensureWorker();
    const id = this.nextId();

    return new Promise((resolve, reject) => {
      this.listeners.set(id, (msg) => {
        if (msg.type === 'PREFETCH_COMPLETE') {
          this.listeners.delete(id);
          resolve({ cached: msg.cached, failed: msg.failed });
        } else if (msg.type === 'ERROR') {
          this.listeners.delete(id);
          reject(new Error(msg.message));
        }
      });
      const req: WorkerRequest = { type: 'PREFETCH_VOICES', id, voiceIds };
      worker.postMessage(req);
    });
  }
}

export const kokoroClient = new KokoroWorkerClient();

/**
 * Instant Zero-Download Device Speech Engine (Web Speech API)
 * Lets users speak English & Hindi immediately on Android/Desktop while
 * or before downloading the 92 MB Kokoro-82M ONNX neural weights.
 */
export function speakWithDeviceTTS(
  text: string,
  lang: 'en' | 'hi',
  speed: number,
  callbacks?: { onStart?: () => void; onEnd?: () => void; onError?: (err: string) => void }
): () => void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    callbacks?.onError?.('Device SpeechSynthesis API is not available in this browser.');
    return () => {};
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
  utterance.rate = Math.max(0.5, Math.min(2.0, speed));

  const voices = window.speechSynthesis.getVoices();
  const targetPrefix = lang === 'hi' ? 'hi' : 'en';
  const match =
    voices.find((v) => v.lang.toLowerCase().startsWith(targetPrefix) && v.localService) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(targetPrefix));
  if (match) {
    utterance.voice = match;
  }

  utterance.onstart = () => callbacks?.onStart?.();
  utterance.onend = () => callbacks?.onEnd?.();
  utterance.onerror = (e) => callbacks?.onError?.(e.error || 'Device speech failed');

  window.speechSynthesis.speak(utterance);
  return () => window.speechSynthesis.cancel();
}
