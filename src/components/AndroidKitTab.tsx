import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, ExternalLink, FileCode2, FolderArchive } from 'lucide-react';
import {
  exportAndroidProjectZip,
  generateAndroidProjectFiles,
  type AndroidProjectConfig,
} from '../lib/androidProjectGenerator';
import { downloadBlob } from '../lib/audioUtils';

export const AndroidKitTab: React.FC = () => {
  const [config, setConfig] = useState<AndroidProjectConfig>({
    appName: 'Vaani Kokoro TTS',
    packageName: 'com.vaani.kokorotts',
    runtime: 'litert',
    includeSystemTtsService: true,
    includeHindiVoices: true,
    includeEnglishVoices: true,
    minSdk: 26,
    quantization: 'int8_gpu_fp16',
  });

  const files = useMemo(() => generateAndroidProjectFiles(config), [config]);
  const [selectedPath, setSelectedPath] = useState<string>(() => files[0]?.path ?? 'README.md');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);

  const activeFile = useMemo(
    () => files.find((f) => f.path === selectedPath) ?? files[0],
    [files, selectedPath]
  );

  const handleCopy = async () => {
    if (!activeFile) return;
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopiedPath(activeFile.path);
      setTimeout(() => setCopiedPath(null), 1800);
    } catch {
      // Clipboard may be restricted in iframe
    }
  };

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      const zipBlob = await exportAndroidProjectZip(config);
      const slug = config.appName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'vaani-kokoro-android';
      downloadBlob(zipBlob, `${slug}-${config.runtime}-android.zip`);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Direct Model Comparison */}
      <section className="rounded-2xl border border-[#E5E5E0] bg-white p-5 sm:p-6 dark:border-[#252830] dark:bg-[#181A1E]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="font-display text-xl font-semibold text-[#141413] sm:text-2xl dark:text-[#EDEDEA]">
              Native Android App Kit (LiteRT-LM &amp; ONNX)
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-[#52524D] dark:text-[#A8AAB1]">
              Configure and export a complete Android Studio Kotlin + Jetpack Compose + System{' '}
              <span className="font-mono text-xs">TextToSpeechService</span> project targeting either{' '}
              <a
                href="https://huggingface.co/litert-community/Kokoro-82M"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 font-medium text-[#D9481E] underline-offset-2 hover:underline dark:text-[#F05A2B]"
              >
                litert-community/Kokoro-82M
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>{' '}
              or{' '}
              <a
                href="https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 font-medium text-[#D9481E] underline-offset-2 hover:underline dark:text-[#F05A2B]"
              >
                onnx-community/Kokoro-82M-v1.0-ONNX
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
              .
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={isZipping}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#D9481E] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#C03E18] disabled:opacity-50 dark:bg-[#F05A2B] dark:hover:bg-[#D9481E] whitespace-nowrap shrink-0"
          >
            <FolderArchive className="h-4 w-4" aria-hidden="true" />
            {isZipping ? 'Packaging ZIP…' : 'Download Android Studio Project (.zip)'}
          </button>
        </div>

        {/* LiteRT vs ONNX Technical Matrix */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#E5E5E0] text-[#66665F] dark:border-[#2A2D35] dark:text-[#9A9CA3]">
                <th className="py-2.5 pr-4 font-semibold">Criterion</th>
                <th className="py-2.5 pr-4 font-semibold">
                  LiteRT-LM (litert-community/Kokoro-82M)
                </th>
                <th className="py-2.5 font-semibold">
                  ONNX Runtime (onnx-community/Kokoro-82M-v1.0-ONNX)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0EB] text-[#2C2C29] dark:divide-[#24272F] dark:text-[#D4D6DC]">
              <tr>
                <td className="py-3 pr-4 font-semibold">Artifact Format</td>
                <td className="py-3 pr-4 font-mono">
                  kokoro_int8_gpu_fp16.litertlm / kokoro_int8_fp16.litertlm
                </td>
                <td className="py-3 font-mono">onnx/model_quantized.onnx (~92 MB INT8)</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold">Hardware Acceleration</td>
                <td className="py-3 pr-4">Google LiteRT GPU delegate (Adreno / Mali) + CPU fallback</td>
                <td className="py-3">ONNX Runtime XNNPACK CPU + Android NNAPI delegate</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold">English &amp; Hindi Voices</td>
                <td className="py-3 pr-4">
                  Same Kokoro-82M v1.0 voice style bank (hf_alpha, hf_beta, hm_omega, hm_psi, af_heart…)
                </td>
                <td className="py-3">
                  Direct Float32 [510, 1, 256] .bin embeddings; also compatible with sherpa-onnx AAR
                </td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold">Offline Hindi G2P</td>
                <td className="py-3 pr-4">
                  Included pure-Kotlin HindiPhonemizer.kt (zero native C++ build friction)
                </td>
                <td className="py-3">
                  Included pure-Kotlin HindiPhonemizer.kt or optional espeak-ng JNI / sherpa-onnx
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Get an .APK & USB Sideload Paths */}
      <section className="rounded-2xl border border-[#E5E5E0] bg-white p-5 sm:p-6 dark:border-[#252830] dark:bg-[#181A1E]">
        <h2 className="font-display text-base font-semibold text-[#141413] dark:text-[#EDEDEA]">
          How to Get an Installable .APK or Sideload via USB Debugging
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-[#66665F] dark:text-[#9A9CA3]">
          Browser web apps cannot access your phone&apos;s USB port or run the Android SDK directly in the cloud. Use one of the three paths below:
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-[#ECECE7] bg-[#FAF9F7] p-4 dark:border-[#2A2D35] dark:bg-[#121417]">
            <p className="text-xs font-semibold text-[#141413] dark:text-[#EDEDEA]">
              01. Cloud Build .APK (No Android Studio)
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-[#52524D] dark:text-[#A8AAB1]">
              Download the project ZIP above — it includes{' '}
              <span className="font-mono text-[11px]">.github/workflows/build-apk.yml</span>. Push to a free GitHub repo and download the compiled{' '}
              <span className="font-mono text-[11px]">app-debug.apk</span> directly from the Actions tab.
            </p>
          </div>

          <div className="rounded-xl border border-[#ECECE7] bg-[#FAF9F7] p-4 dark:border-[#2A2D35] dark:bg-[#121417]">
            <p className="text-xs font-semibold text-[#141413] dark:text-[#EDEDEA]">
              02. USB Debugging Sideload (adb)
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-[#52524D] dark:text-[#A8AAB1]">
              Plug your Android phone into your computer with USB Debugging enabled, unzip the project, and run{' '}
              <span className="font-mono text-[11px]">./scripts/build_and_sideload.sh</span> (macOS/Linux) or{' '}
              <span className="font-mono text-[11px]">scripts\build_and_sideload.bat</span> (Windows).
            </p>
          </div>

          <div className="rounded-xl border border-[#ECECE7] bg-[#FAF9F7] p-4 dark:border-[#2A2D35] dark:bg-[#121417]">
            <p className="text-xs font-semibold text-[#141413] dark:text-[#EDEDEA]">
              03. Instant Android Install (Zero APK)
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-[#52524D] dark:text-[#A8AAB1]">
              Open this app URL in Chrome on your Android phone and tap{' '}
              <strong>Install App</strong> (or Chrome menu ⋮ → Install app). It installs as a standalone offline Kokoro-82M app immediately.
            </p>
          </div>
        </div>
      </section>

      {/* Project Configurator + Live File Explorer */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* Left: Configuration Form */}
        <section className="rounded-2xl border border-[#E5E5E0] bg-white p-5 lg:col-span-4 dark:border-[#252830] dark:bg-[#181A1E]">
          <h2 className="font-display text-base font-semibold text-[#141413] dark:text-[#EDEDEA]">
            Project Configuration
          </h2>

          <div className="mt-4 space-y-4">
            <div>
              <span className="block text-xs font-semibold text-[#3F3F3B] dark:text-[#C5C7CD]">
                Target Android Runtime
              </span>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'litert', title: 'LiteRT-LM', sub: 'litert-community' },
                    { id: 'onnx', title: 'ONNX Runtime', sub: 'model_quantized.onnx' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setConfig((c) => ({ ...c, runtime: opt.id }))}
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      config.runtime === opt.id
                        ? 'border-[#D9481E] bg-[#FDF6F3] dark:border-[#F05A2B] dark:bg-[#231916]'
                        : 'border-[#DFDFD9] bg-[#FAF9F7] dark:border-[#2D313A] dark:bg-[#121417]'
                    }`}
                  >
                    <p className="text-xs font-semibold text-[#141413] dark:text-[#EDEDEA]">
                      {opt.title}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-[#66665F] dark:text-[#9A9CA3]">
                      {opt.sub}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {config.runtime === 'litert' && (
              <div>
                <label
                  htmlFor="litert-quant"
                  className="block text-xs font-semibold text-[#3F3F3B] dark:text-[#C5C7CD]"
                >
                  LiteRT Model Variant
                </label>
                <select
                  id="litert-quant"
                  value={config.quantization}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      quantization: e.target.value as 'int8_gpu_fp16' | 'int8_cpu',
                    }))
                  }
                  className="mt-1.5 min-h-[42px] w-full rounded-xl border border-[#DFDFD9] bg-[#FAF9F7] px-3 font-mono text-xs text-[#141413] dark:border-[#2D313A] dark:bg-[#121417] dark:text-[#EDEDEA]"
                >
                  <option value="int8_gpu_fp16">kokoro_int8_gpu_fp16.litertlm (GPU)</option>
                  <option value="int8_cpu">kokoro_int8_fp16.litertlm (CPU)</option>
                </select>
              </div>
            )}

            <div>
              <label
                htmlFor="android-app-name"
                className="block text-xs font-semibold text-[#3F3F3B] dark:text-[#C5C7CD]"
              >
                Android App Name
              </label>
              <input
                id="android-app-name"
                type="text"
                value={config.appName}
                onChange={(e) => setConfig((c) => ({ ...c, appName: e.target.value }))}
                className="mt-1.5 min-h-[42px] w-full rounded-xl border border-[#DFDFD9] bg-[#FAF9F7] px-3 text-sm text-[#141413] focus:border-[#D9481E] focus:outline-none dark:border-[#2D313A] dark:bg-[#121417] dark:text-[#EDEDEA]"
              />
            </div>

            <div>
              <label
                htmlFor="android-pkg"
                className="block text-xs font-semibold text-[#3F3F3B] dark:text-[#C5C7CD]"
              >
                Package ID
              </label>
              <input
                id="android-pkg"
                type="text"
                value={config.packageName}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    packageName: e.target.value.replace(/[^a-zA-Z0-9._]/g, ''),
                  }))
                }
                className="mt-1.5 min-h-[42px] w-full rounded-xl border border-[#DFDFD9] bg-[#FAF9F7] px-3 font-mono text-xs text-[#141413] focus:border-[#D9481E] focus:outline-none dark:border-[#2D313A] dark:bg-[#121417] dark:text-[#EDEDEA]"
              />
            </div>

            <div className="space-y-2 border-t border-[#ECECE7] pt-3 dark:border-[#252830]">
              <label className="flex min-h-[38px] cursor-pointer items-center justify-between gap-2 text-xs font-medium text-[#2C2C29] dark:text-[#DFDFE4]">
                <span>Register System TextToSpeechService</span>
                <input
                  type="checkbox"
                  checked={config.includeSystemTtsService}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, includeSystemTtsService: e.target.checked }))
                  }
                  className="h-4 w-4 accent-[#D9481E]"
                />
              </label>

              <label className="flex min-h-[38px] cursor-pointer items-center justify-between gap-2 text-xs font-medium text-[#2C2C29] dark:text-[#DFDFE4]">
                <span>Bundle 4 Hindi Voices (hf_alpha..hm_psi)</span>
                <input
                  type="checkbox"
                  checked={config.includeHindiVoices}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, includeHindiVoices: e.target.checked }))
                  }
                  className="h-4 w-4 accent-[#D9481E]"
                />
              </label>

              <label className="flex min-h-[38px] cursor-pointer items-center justify-between gap-2 text-xs font-medium text-[#2C2C29] dark:text-[#DFDFE4]">
                <span>Bundle 5 Top English Voices (US &amp; UK)</span>
                <input
                  type="checkbox"
                  checked={config.includeEnglishVoices}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, includeEnglishVoices: e.target.checked }))
                  }
                  className="h-4 w-4 accent-[#D9481E]"
                />
              </label>
            </div>
          </div>
        </section>

        {/* Right: Generated Source Explorer */}
        <section className="overflow-hidden rounded-2xl border border-[#E5E5E0] bg-white lg:col-span-8 dark:border-[#252830] dark:bg-[#181A1E]">
          {/* File Selector Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[#E5E5E0] bg-[#FAF9F7] px-4 py-2.5 dark:border-[#252830] dark:bg-[#131519]">
            {files.map((f) => {
              const shortName = f.path.split('/').pop() ?? f.path;
              const isSelected = activeFile?.path === f.path;
              return (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => setSelectedPath(f.path)}
                  className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 py-1 font-mono text-xs transition-colors whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-[#141413] text-white dark:bg-[#EDEDEA] dark:text-[#141413]'
                      : 'text-[#52524D] hover:bg-[#ECECE7] hover:text-[#141413] dark:text-[#A8AAB1] dark:hover:bg-[#23262D] dark:hover:text-white'
                  }`}
                >
                  <FileCode2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {shortName}
                </button>
              );
            })}
          </div>

          {activeFile && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ECECE7] px-5 py-3 dark:border-[#252830]">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-semibold text-[#141413] dark:text-[#EDEDEA]">
                    {activeFile.path}
                  </p>
                  <p className="text-xs text-[#66665F] dark:text-[#9A9CA3]">
                    {activeFile.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#DFDFD9] px-3 text-xs font-medium text-[#141413] transition-colors hover:bg-[#F1F1ED] dark:border-[#2D313A] dark:text-[#EDEDEA] dark:hover:bg-[#23262D] whitespace-nowrap"
                  >
                    {copiedPath === activeFile.path ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-[#D9481E]" aria-hidden="true" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        Copy
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadZip}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#141413] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#2A2A28] dark:bg-[#EDEDEA] dark:text-[#141413] dark:hover:bg-white whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    Export All ({files.length})
                  </button>
                </div>
              </div>

              <pre className="max-h-[520px] overflow-auto bg-[#141518] p-5 font-mono text-xs leading-relaxed text-[#E6E6E2]">
                <code>{activeFile.content}</code>
              </pre>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
