"use client";

import { useEffect, useState } from "react";

interface SplashScreenProps {
  isLoading: boolean;
}

export function SplashScreen({ isLoading }: SplashScreenProps) {
  const [mounted, setMounted] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setFadeOut(true);
      const timer = setTimeout(() => {
        setMounted(false);
      }, 600); // 600ms fade-out transition duration
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black transition-opacity duration-[600ms] ease-in-out ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Decorative background glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-burgundy/10 rounded-full blur-[80px] pointer-events-none animate-pulse duration-[4000ms]" />

      <div className="relative flex flex-col items-center gap-7 z-10">
        {/* Breathing Logo Container */}
        <div className="relative w-24 h-24 flex items-center justify-center animate-[pulse_2.5s_ease-in-out_infinite]">
          <img
            src="/icon.ico"
            alt="Linex Medya Logo"
            className="w-full h-full object-contain filter drop-shadow-[0_0_15px_rgba(128,0,32,0.3)]"
            onError={(e) => {
              // Hide image if missing
              e.currentTarget.style.display = "none";
            }}
          />
        </div>

        <div className="flex flex-col items-center gap-3">
          {/* Custom Breathing loading bar */}
          <div className="w-40 h-[3px] bg-neutral-900/80 rounded-full overflow-hidden border border-neutral-800/10">
            <div className="h-full bg-burgundy rounded-full w-0 animate-[loadingBar_2s_cubic-bezier(0.4,0,0.2,1)_infinite]" />
          </div>

          <p className="text-[10px] text-neutral-500 uppercase tracking-[0.25em] font-medium animate-pulse duration-1000 select-none">
            Sistem Hazırlanıyor
          </p>
        </div>
      </div>

      {/* Tailwind inline Keyframes styling */}
      <style jsx global>{`
        @keyframes loadingBar {
          0% {
            width: 0%;
            margin-left: 0%;
          }
          50% {
            width: 70%;
            margin-left: 15%;
          }
          100% {
            width: 0%;
            margin-left: 100%;
          }
        }
      `}</style>
    </div>
  );
}
