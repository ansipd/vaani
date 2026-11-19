import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-4 z-40 flex items-center gap-2 rounded-xl border border-[#E5E5E0] bg-[#141413] px-3.5 py-2 text-xs font-medium text-[#EDEDEA] shadow-lg md:bottom-5 dark:border-[#2E323A] dark:bg-[#202328]"
    >
      <WifiOff className="h-3.5 w-3.5 text-[#F05A2B]" aria-hidden="true" />
      <span>Offline mode — using locally cached Kokoro weights and audio vault</span>
    </div>
  );
};
