import React from 'react';
import { X, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

export function ImageZoomModal({ imageUrl, isOpen, onClose }: { imageUrl: string | null, isOpen: boolean, onClose: () => void }) {
  if (!isOpen || !imageUrl) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <button onClick={onClose} className="absolute top-12 right-16 z-50 p-3 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-full transition-all">
        <X className="w-6 h-6" />
      </button>

      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={8}
        centerOnInit={true}
        wheel={{ step: 0.1 }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <React.Fragment>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-black/60 px-4 py-2 rounded-full border border-white/10">
              <button onClick={() => zoomOut()} className="text-white/70 hover:text-white p-2"><ZoomOut className="w-5 h-5" /></button>
              <button onClick={() => resetTransform()} className="text-white/70 hover:text-white p-2"><Maximize className="w-5 h-5" /></button>
              <button onClick={() => zoomIn()} className="text-white/70 hover:text-white p-2"><ZoomIn className="w-5 h-5" /></button>
            </div>
            
            <TransformComponent wrapperStyle={{ width: "100vw", height: "100vh" }}>
              <img 
                src={imageUrl} 
                alt="Zoomable Media" 
                className="max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain cursor-grab active:cursor-grabbing rounded-md shadow-2xl"
                draggable={false}
              />
            </TransformComponent>
          </React.Fragment>
        )}
      </TransformWrapper>
    </div>
  );
}
