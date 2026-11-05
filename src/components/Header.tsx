import React, { useState, useEffect } from 'react';
import { MarketMetadata } from '../types/market';
import { RefreshCw, Calendar, Lock } from 'lucide-react';
import { AdminRefreshModal } from './AdminRefreshModal';

interface HeaderProps {
  metadata: MarketMetadata;
  onRefresh: () => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({ metadata, onRefresh, isLoading }) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format times in SGT, EST, and GMT
  const sgtString = currentTime.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Singapore',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const estString = currentTime.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });

  const londonString = currentTime.toLocaleTimeString('en-US', {
    timeZone: 'Europe/London',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <header className="border-b border-slate-700/80 bg-gradient-to-r from-[#111824] via-[#162030] to-[#111824] px-4 py-3 select-none shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Terminal Title & Branding */}
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-8 bg-blue-500 rounded-xs shadow-[0_0_12px_rgba(59,130,246,0.55)]"></div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base font-bold tracking-wider text-slate-100 uppercase font-display flex items-center gap-2">
                AI Macro Testbed
              </h1>
              <span className="text-[10px] font-mono tracking-tight text-sky-300 bg-blue-950/60 border border-blue-700/60 px-1.5 py-0.5 rounded-xs">
                DAILY 5:00 AM SGT
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
              <span>US Yield Curve</span>
              <span>·</span>
              <span>Global FX & Futures</span>
              <span>·</span>
              <span>IndoGB & SRBI</span>
              <span>·</span>
              <span>USD/IDR NDFs</span>
            </p>
          </div>
        </div>

        {/* Global Market Clocks */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1a2436] border border-slate-700/90 rounded-xs">
            <span className="text-slate-400 text-[10px]">SGT</span>
            <span className="text-sky-400 font-semibold">{sgtString}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 bg-[#151e2d] border border-slate-700/70 rounded-xs">
            <span className="text-slate-400 text-[10px]">NY / EST</span>
            <span className="text-slate-200">{estString}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-1 bg-[#151e2d] border border-slate-700/70 rounded-xs">
            <span className="text-slate-400 text-[10px]">LDN / GMT</span>
            <span className="text-slate-200">{londonString}</span>
          </div>

          {/* Reload Snapshot Action */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            title="Reload snapshot data"
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1c2739] hover:bg-blue-900/50 active:bg-slate-900 border border-slate-600/80 hover:border-blue-500/70 text-slate-200 hover:text-sky-300 transition-colors rounded-xs cursor-pointer text-xs whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-sky-400' : ''}`} />
            <span>Reload</span>
          </button>

          {/* Owner Password-Protected GitHub Action Refresh Trigger */}
          <button
            onClick={() => setIsAdminModalOpen(true)}
            title="Owner Password-Protected Refresh (Triggers GitHub Action)"
            className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-950/60 hover:bg-blue-900/70 active:bg-slate-900 border border-blue-700/70 hover:border-sky-400/80 text-sky-300 hover:text-white transition-colors rounded-xs cursor-pointer text-xs whitespace-nowrap shrink-0"
          >
            <Lock className="w-3.5 h-3.5 text-blue-400" />
            <span>Admin Refresh</span>
          </button>
        </div>
      </div>

      {/* Subheader Status Ticker */}
      <div className="max-w-7xl mx-auto mt-2.5 pt-2 border-t border-slate-800/90 flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-mono gap-y-1">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-slate-300">
            <Calendar className="w-3 h-3 text-blue-400" />
            <span>Snapshot: <strong className="text-slate-200">{metadata.lastUpdatedSGT}</strong></span>
          </span>
          <span className="hidden sm:inline text-slate-600">|</span>
          <span className="hidden sm:inline text-slate-400">
            Next Scheduled: <strong className="text-slate-300">{metadata.nextRefreshSGT}</strong>
          </span>
        </div>

        <div className="text-slate-400">
          <span>{metadata.edition}</span>
        </div>
      </div>

      {/* Password-Protected GitHub Action Refresh Modal */}
      <AdminRefreshModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onRefreshData={onRefresh}
      />
    </header>
  );
};
