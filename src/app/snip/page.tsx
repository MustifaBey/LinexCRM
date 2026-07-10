"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface Rect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export default function SnipPage() {
  const [bgDataUrl, setBgDataUrl] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [status, setStatus] = useState<string>("");

  const rectRef = useRef<Rect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<HTMLDivElement>(null);

  // 1. Receive screenshot DataURL from Electron main process.
  //    HANDSHAKE: register the listener FIRST, then signal main.js that we
  //    are ready. Main will only send 'snip-image' after receiving 'snip-ready',
  //    which eliminates the race condition entirely.
  useEffect(() => {
    const electron = (window as any).electron;
    if (!electron?.onSnipImage) return;

    // Step A: register the listener before signalling readiness
    const unsubscribe = electron.onSnipImage((dataUrl: string) => {
      setBgDataUrl(dataUrl);
    });

    // Step B: tell main.js the listener is live — main will now send the image
    electron.signalSnipReady?.();

    return () => { if (typeof unsubscribe === "function") unsubscribe(); };
  }, []);

  // 2. ESC closes the snip window
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        (window as any).electron?.closeSnipWindow?.();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // 3. Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isDone) return;
    e.preventDefault();
    rectRef.current = { startX: e.clientX, startY: e.clientY, endX: e.clientX, endY: e.clientY };
    setIsSelecting(true);
    updateBox(e.clientX, e.clientY, e.clientX, e.clientY);
  }, [isDone]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting || !rectRef.current) return;
    rectRef.current.endX = e.clientX;
    rectRef.current.endY = e.clientY;
    updateBox(rectRef.current.startX, rectRef.current.startY, e.clientX, e.clientY);
  }, [isSelecting]);

  const handleMouseUp = useCallback(async (e: React.MouseEvent) => {
    if (!isSelecting || !rectRef.current) return;
    setIsSelecting(false);
    rectRef.current.endX = e.clientX;
    rectRef.current.endY = e.clientY;
    await cropAndUpload(rectRef.current);
  }, [isSelecting]);

  function updateBox(sx: number, sy: number, ex: number, ey: number) {
    const el = selectionRef.current;
    if (!el) return;
    const left = Math.min(sx, ex);
    const top  = Math.min(sy, ey);
    const w    = Math.abs(ex - sx);
    const h    = Math.abs(ey - sy);
    el.style.left    = `${left}px`;
    el.style.top     = `${top}px`;
    el.style.width   = `${w}px`;
    el.style.height  = `${h}px`;
    el.style.display = w > 2 && h > 2 ? "block" : "none";
  }

  // 4. Crop selected area and upload to Supabase
  async function cropAndUpload(rect: Rect) {
    if (!bgDataUrl) return;
    const x = Math.min(rect.startX, rect.endX);
    const y = Math.min(rect.startY, rect.endY);
    const w = Math.abs(rect.endX - rect.startX);
    const h = Math.abs(rect.endY - rect.startY);

    if (w < 4 || h < 4) {
      (window as any).electron?.closeSnipWindow?.();
      return;
    }

    setIsDone(true);
    setStatus("Kirpiliyor...");

    try {
      const img = await loadImage(bgDataUrl);
      const scaleX = img.naturalWidth  / window.innerWidth;
      const scaleY = img.naturalHeight / window.innerHeight;

      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(w * scaleX);
      canvas.height = Math.round(h * scaleY);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(
        img,
        Math.round(x * scaleX), Math.round(y * scaleY), canvas.width, canvas.height,
        0, 0, canvas.width, canvas.height
      );

      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error("Canvas toBlob failed"))), "image/png")
      );
      const file = new File([blob], `snip_${Date.now()}.png`, { type: "image/png" });

      setStatus("Yukleniyor...");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("thumbnail", file); // send the cropped file as thumbnail directly
      const uploadRes = await fetch("/api/media/upload", { method: "POST", body: formData });

      if (!uploadRes.ok) {
        const errJson = await uploadRes.json();
        throw new Error(errJson.error || "Dosya sunucuya yuklenemedi.");
      }
      const uploadData = await uploadRes.json();
      if (!uploadData.data?.file_path) throw new Error("Yuklenen dosya yolu alinamadi.");

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://gmxurdlsoczhnkdjdkqv.supabase.co";
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/media/${uploadData.data.file_path}`;

      const electron = (window as any).electron;
      await electron?.copyToClipboard(publicUrl);
      await electron?.showNotification({ title: "Linex CRM", body: "Ekran goruntusu kirpildi ve link panoya kopyalandi!" });
      electron?.closeSnipWindow();
    } catch (err: any) {
      console.error("Snip error:", err);
      setStatus("Hata: " + err.message);
      const electron = (window as any).electron;
      await electron?.showNotification({ title: "Linex CRM Hatasi", body: "Ekran yakalama hatasi: " + err.message });
      setTimeout(() => electron?.closeSnipWindow(), 2000);
    }
  }

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  if (!bgDataUrl) {
    return (
      <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.15)",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:14,fontFamily:"Inter, sans-serif" }}>
        Ekran hazirlanıyor...
      </div>
    );
  }

  return (
    <div
      ref={overlayRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ position:"fixed",inset:0,cursor:"crosshair",userSelect:"none",WebkitUserSelect:"none",overflow:"hidden" }}
    >
      {/* Full-screen background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={bgDataUrl} alt="" draggable={false}
        style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"fill",pointerEvents:"none",display:"block" }} />

      {/* Dim overlay */}
      <div style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.45)",pointerEvents:"none" }} />

      {/* Rubber-band selection box */}
      <div ref={selectionRef} style={{ position:"absolute",display:"none",border:"2px solid rgba(255,255,255,0.9)",boxShadow:"0 0 0 1px rgba(0,0,0,0.4)",background:"rgba(255,255,255,0.08)",pointerEvents:"none",borderRadius:2 }} />

      {/* Instruction hint */}
      {!isSelecting && !isDone && (
        <div style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",background:"rgba(0,0,0,0.72)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,padding:"14px 22px",color:"white",fontFamily:"Inter, sans-serif",fontSize:13,fontWeight:500,textAlign:"center",pointerEvents:"none",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",lineHeight:1.6 }}>
          <div style={{ fontSize:22,marginBottom:6 }}>✂️</div>
          <div>Kirpmak istediginiz alani surukleyin</div>
          <div style={{ fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:4 }}>ESC ile iptal edin</div>
        </div>
      )}

      {/* Status overlay */}
      {isDone && status && (
        <div style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",background:"rgba(0,0,0,0.82)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,padding:"14px 24px",color:"white",fontFamily:"Inter, sans-serif",fontSize:13,fontWeight:500,backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",pointerEvents:"none" }}>
          {status}
        </div>
      )}
    </div>
  );
}
