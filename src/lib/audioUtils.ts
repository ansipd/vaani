/**
 * Audio utilities for 24 kHz mono PCM WAV encoding, silence-padded concatenation,
 * and Canvas waveform peak calculation.
 */

export const KOKORO_SAMPLE_RATE = 24000;

export function encodeWav(samples: Float32Array, sampleRate = KOKORO_SAMPLE_RATE): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

export function concatAudioBuffers(
  chunks: Float32Array[],
  pauseMs = 180,
  sampleRate = KOKORO_SAMPLE_RATE
): Float32Array {
  if (chunks.length === 0) return new Float32Array(0);
  if (chunks.length === 1) return chunks[0];

  const pauseSamples = Math.round((pauseMs / 1000) * sampleRate);
  const totalLength =
    chunks.reduce((sum, c) => sum + c.length, 0) + pauseSamples * (chunks.length - 1);

  const combined = new Float32Array(totalLength);
  let cursor = 0;
  for (let i = 0; i < chunks.length; i++) {
    combined.set(chunks[i], cursor);
    cursor += chunks[i].length;
    if (i < chunks.length - 1) {
      cursor += pauseSamples;
    }
  }
  return combined;
}

export function computeWaveformPeaks(samples: Float32Array, barCount = 72): number[] {
  if (!samples.length) return Array(barCount).fill(0.08);
  const blockSize = Math.max(1, Math.floor(samples.length / barCount));
  const peaks: number[] = [];
  let maxPeak = 0.001;

  for (let i = 0; i < barCount; i++) {
    const start = i * blockSize;
    const end = Math.min(samples.length, start + blockSize);
    let sumSq = 0;
    for (let j = start; j < end; j++) {
      sumSq += samples[j] * samples[j];
    }
    const rms = Math.sqrt(sumSq / Math.max(1, end - start));
    peaks.push(rms);
    if (rms > maxPeak) maxPeak = rms;
  }

  return peaks.map((p) => Math.max(0.08, Math.min(1, p / maxPeak)));
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
