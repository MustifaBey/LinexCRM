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
      // Fire Desktop Toast
      if (Notification.permission === "granted") {
        new Notification(title, { body, silent: true });
      }
    };

    // Chain only the notifications table listener to avoid duplicate notifications and WebSocket overhead
    const radarChannel = supabase
      .channel("global_radar_channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          if (!payload.new.user_id || String(payload.new.user_id) === String(userId)) {
            fireSiren(
              payload.new.title || "LinexCRM Bildirim",
              payload.new.message || "Yeni bir bildiriminiz var."
            );
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
