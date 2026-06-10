"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function GlobalNotificationListener({ userId }: { userId?: string }) {
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission();
    }

    const fireSiren = (title: string, body: string) => {
      // 1. Fire Desktop Toast BUT mute the native Windows chime
      if (Notification.permission === "granted") {
        new Notification(title, { body, silent: true });
      }

      // 2. Play our custom OGG Audio
      const pool = [
        "/notify1.ogg",
        "/notify2.ogg",
        "/notify3.ogg",
        "/notify4.ogg",
        "/notify5.ogg",
        "/notify6.ogg",
        "/notify7.ogg",
        "/notify8.ogg",
        "/notify9.ogg"
      ];
      const randomSound = pool[Math.floor(Math.random() * pool.length)];
      const audio = new Audio(randomSound);
      
      // Force play
      audio.play().catch((e) => console.warn("Audio play failed:", e));
    };

    // Chain ALL listeners to ONE single 'global_radar_channel' for a stable WebSocket connection
    const radarChannel = supabase
      .channel("global_radar_channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "team_chat" },
        (payload) => {
          if (payload.new.sender_id !== userId) {
            fireSiren("Ekip Sohbeti", payload.new.message || "Yeni bir mesaj/medya geldi.");
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          // Convert both to strings to ensure UUID matches don't fail
          if (!payload.new.user_id || String(payload.new.user_id) === String(userId)) {
            fireSiren(
              "LinexCRM Bildirim",
              payload.new.title || "Yeni bir bildiriminiz var."
            );
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tickets" },
        (payload) => {
          fireSiren("Yeni Destek Talebi", payload.new.subject || "Müşteri yeni bir bilet açtı.");
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ticket_messages" },
        (payload) => {
          if (payload.new.is_staff === false) {
            fireSiren("Destek Talebi Yanıtı", "Müşteri talebine cevap yazdı.");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(radarChannel);
    };
  }, [userId]);

  return null;
}
