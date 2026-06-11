"use client";

import { useEffect, useState } from "react";

interface ProgressData {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

interface ElectronBridge {
  onUpdateAvailable: (callback: (info: unknown) => void) => (() => void) | undefined;
  onUpdateProgress: (callback: (progress: ProgressData) => void) => (() => void) | undefined;
  onUpdateDownloaded: (callback: (info: unknown) => void) => (() => void) | undefined;
  restartApp: () => void;
}

export function UpdateNotifier() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  useEffect(() => {
    // Graceful check if running inside Electron environment (client-side only)
    if (typeof window === "undefined") return;
    const electron = (window as unknown as { electron?: ElectronBridge }).electron;
    if (!electron) return;

    const unsubAvailable = electron.onUpdateAvailable((info: unknown) => {
      console.log("Yeni güncelleme mevcut:", info);
      setUpdateAvailable(true);
      setDownloaded(false);
    });

    const unsubProgress = electron.onUpdateProgress((progressObj: ProgressData) => {
      console.log("İndirme ilerlemesi:", progressObj);
      setUpdateAvailable(true);
      setProgress(progressObj);
    });

    const unsubDownloaded = electron.onUpdateDownloaded((info: unknown) => {
      console.log("Güncelleme indirildi:", info);
      setDownloaded(true);
      setProgress(null);
    });

    return () => {
      if (unsubAvailable) unsubAvailable();
      if (unsubProgress) unsubProgress();
      if (unsubDownloaded) unsubDownloaded();
    };
  }, []);

  if (!updateAvailable) {
    return null;
  }

  const handleRestart = () => {
    const electron = (window as unknown as { electron?: ElectronBridge }).electron;
    if (electron && electron.restartApp) {
      electron.restartApp();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex w-80 flex-col gap-3.5 rounded-2xl border border-white/10 bg-neutral-900/95 p-4 text-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all duration-500 animate-in slide-in-from-bottom-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
            <svg
              className="h-3 w-3 animate-bounce"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
          <span className="font-semibold text-xs tracking-wide text-neutral-200">
            {downloaded ? "Güncelleme Hazır" : "Sistem Güncellemesi"}
          </span>
        </div>
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
        </span>
      </div>

      {!downloaded && progress && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
            <span>İndiriliyor...</span>
            <span className="font-bold text-neutral-200">{Math.round(progress.percent)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-500 transition-all duration-200 ease-out"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <span className="text-[10px] text-neutral-500 self-end font-mono">
            {progress.bytesPerSecond ? `${(progress.bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s` : ""}
          </span>
        </div>
      )}

      {!downloaded && !progress && (
        <p className="text-xs text-neutral-400 leading-relaxed">
          Yeni bir sürüm algılandı, arka planda indiriliyor...
        </p>
      )}

      {downloaded && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-neutral-400 leading-relaxed">
            Yeni sürüm başarıyla indirildi. Değişiklikleri uygulamak için uygulamayı yeniden başlatın.
          </p>
          <button
            onClick={handleRestart}
            className="w-full rounded-xl bg-gradient-to-r from-red-600 to-rose-600 py-2.5 text-xs font-semibold text-white transition-all hover:from-red-500 hover:to-rose-500 active:scale-[0.98] shadow-lg shadow-red-500/20"
          >
            Yeniden Başlat ve Kur
          </button>
        </div>
      )}
    </div>
  );
}
