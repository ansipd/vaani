import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  onOpenAndroidKit?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ onOpenAndroidKit }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#141413] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#2A2A28] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9481E] dark:bg-[#EDEDEA] dark:text-[#141413] dark:hover:bg-white whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        Install App
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#141413] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#2A2A28] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9481E] dark:bg-[#EDEDEA] dark:text-[#141413] dark:hover:bg-white whitespace-nowrap shrink-0"
      >
        <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
        Install on Android
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-xs sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-guide-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E5E5E0] bg-white p-6 shadow-xl dark:border-[#2A2D33] dark:bg-[#1A1C1F]">
            <div className="flex items-start justify-between gap-4">
              <h3
                id="install-guide-title"
                className="font-display text-lg font-semibold text-[#141413] dark:text-[#EDEDEA]"
              >
                {isIOS ? 'Install Vaani on iPhone / iPad' : 'Install Vaani on Android'}
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install instructions"
                className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-[#66665F] transition-colors hover:bg-[#F1F1ED] hover:text-[#141413] dark:text-[#9C9EA4] dark:hover:bg-[#26292F] dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="mt-4 space-y-2.5 text-sm leading-relaxed text-[#474742] dark:text-[#B8BAC0]">
                <li>1. Tap the Share button in Safari&apos;s toolbar.</li>
                <li>2. Scroll down and select Add to Home Screen.</li>
                <li>3. Launch Vaani from your home screen for standalone offline synthesis.</li>
              </ol>
            ) : (
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#474742] dark:text-[#B8BAC0]">
                <p>
                  <strong>Option 1 — Instant Offline Android PWA:</strong> Open this URL in Chrome
                  on Android, tap the menu button (⋮), and choose <strong>Install app</strong>.
                  Once you load the 92 MB Kokoro-82M INT8 model, synthesis works in airplane mode.
                </p>
                <p>
                  <strong>Option 2 — Native Android APK (LiteRT / ONNX):</strong> Export the
                  complete Kotlin + Jetpack Compose + System TTS Service project directly from the
                  Android Kit tab.
                </p>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
              {onOpenAndroidKit && !isIOS && (
                <button
                  type="button"
                  onClick={() => {
                    setShowGuide(false);
                    onOpenAndroidKit();
                  }}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#DFDFD9] px-4 py-2 text-xs font-semibold text-[#141413] transition-colors hover:bg-[#F6F6F4] dark:border-[#2F333B] dark:text-[#EDEDEA] dark:hover:bg-[#25282E] whitespace-nowrap shrink-0"
                >
                  Open Android Kit
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#D9481E] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#C03E18] whitespace-nowrap shrink-0"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
