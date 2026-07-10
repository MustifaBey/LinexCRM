import React from 'react';
import { X } from 'lucide-react';

export function VideoPlayerModal({ videoUrl, isOpen, onClose }: { videoUrl: string | null, isOpen: boolean, onClose: () => void }) {
  if (!isOpen || !videoUrl) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <button 
        onClick={onClose} 
        className="absolute top-12 right-16 z-[10000] p-3 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-full transition-all"
      >
        <X className="w-6 h-6" />
      </button>
      
      <div className="relative w-full h-full flex items-center justify-center p-8">
        <video 
          src={videoUrl} 
          controls 
          autoPlay 
          className="max-w-full max-h-full rounded-xl shadow-2xl outline-none bg-black/50"
        />
      </div>
    </div>
  );
}
