import type { LexiconEntry } from './hindiG2P';

export interface SavedAudioClip {
  id: string;
  text: string;
  phonemes: string;
  language: 'en' | 'hi' | 'bilingual';
  voiceId: string;
  blendVoiceId?: string;
  blendRatio?: number;
  speed: number;
  durationSec: number;
  sampleRate: number;
  engine: 'kokoro-onnx' | 'device-speech';
  createdAt: number;
  wavBlob: Blob;
  peaks: number[];
}

export interface OfflineStorageReport {
  usageBytes: number;
  quotaBytes: number;
  cachedVoiceIds: string[];
  modelCacheEntries: number;
}

const DB_NAME = 'vaani-offline-tts-db';
const DB_VERSION = 1;
const STORE_CLIPS = 'clips';
const STORE_LEXICON = 'lexicon';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CLIPS)) {
        const store = db.createObjectStore(STORE_CLIPS, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_LEXICON)) {
        db.createObjectStore(STORE_LEXICON, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveClipToLibrary(clip: SavedAudioClip): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CLIPS, 'readwrite');
    tx.objectStore(STORE_CLIPS).put(clip);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAllClips(): Promise<SavedAudioClip[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CLIPS, 'readonly');
    const req = tx.objectStore(STORE_CLIPS).getAll();
    req.onsuccess = () => {
      const items = (req.result as SavedAudioClip[]) ?? [];
      items.sort((a, b) => b.createdAt - a.createdAt);
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteClipFromLibrary(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CLIPS, 'readwrite');
    tx.objectStore(STORE_CLIPS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadLexicon(): Promise<LexiconEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LEXICON, 'readonly');
    const req = tx.objectStore(STORE_LEXICON).getAll();
    req.onsuccess = () => {
      const entries = (req.result as LexiconEntry[]) ?? [];
      entries.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(entries);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveLexiconEntry(entry: LexiconEntry): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LEXICON, 'readwrite');
    tx.objectStore(STORE_LEXICON).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteLexiconEntry(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LEXICON, 'readwrite');
    tx.objectStore(STORE_LEXICON).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineStorageReport(): Promise<OfflineStorageReport> {
  let usageBytes = 0;
  let quotaBytes = 0;

  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      usageBytes = est.usage ?? 0;
      quotaBytes = est.quota ?? 0;
    } catch {
      // ignore estimate errors in restricted contexts
    }
  }

  const cachedVoiceIds: string[] = [];
  let modelCacheEntries = 0;

  if (typeof caches !== 'undefined') {
    try {
      const voiceCache = await caches.open('kokoro-voices');
      const keys = await voiceCache.keys();
      for (const req of keys) {
        const match = req.url.match(/\/voices\/([a-z]{2}_[a-z]+)\.bin/i);
        if (match) cachedVoiceIds.push(match[1]);
      }
    } catch {
      // ignore
    }

    try {
      const names = await caches.keys();
      for (const name of names) {
        if (name.includes('transformers') || name.includes('kokoro')) {
          const c = await caches.open(name);
          const keys = await c.keys();
          modelCacheEntries += keys.length;
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    usageBytes,
    quotaBytes,
    cachedVoiceIds: Array.from(new Set(cachedVoiceIds)),
    modelCacheEntries,
  };
}

export async function clearKokoroOfflineCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((n) => n.includes('transformers') || n.includes('kokoro'))
      .map((n) => caches.delete(n))
  );
}
